import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChatLayout } from "@/components/layout/ChatLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { MediaPreview } from "@/components/MediaPreview";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { AudioPlayer } from "@/components/AudioPlayer";
import { EmojiType } from "@/services/notificationService";
import {
  ArrowLeft, Users, Send, Image as ImageIcon,
  ChevronDown, MessageCircle, Heart, Info
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export default function Community() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [postContent, setPostContent] = useState("");
  const [commentContent, setCommentContent] = useState<{ [key: string]: string }>({});
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [animatingPost, setAnimatingPost] = useState<string | null>(null);
  const [showComments, setShowComments] = useState<{ [key: string]: boolean }>({});
  const [showScrollButton, setShowScrollButton] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    }
  };

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data;
    },
  });

  const { data: community, isLoading: communityLoading } = useQuery({
    queryKey: ["community", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("communities")
        .select("*, profiles(*)")
        .eq("id", id)
        .single();
      return data;
    },
  });

  const { data: membership } = useQuery({
    queryKey: ["membership", id, profile?.id],
    queryFn: async () => {
      if (!profile) return null;
      const { data } = await supabase
        .from("memberships")
        .select("*")
        .eq("community_id", id)
        .eq("user_id", profile.id)
        .maybeSingle();
      return data;
    },
    enabled: !!profile,
  });

  const { data: hasAccess } = useQuery({
    queryKey: ["paid-access", id, profile?.id],
    queryFn: async () => {
      if (!profile) return false;
      const { data, error } = await supabase.rpc("has_paid_access", {
        _user_id: profile.id,
        _community_id: id,
      });
      if (error) return false;
      return data;
    },
    enabled: !!profile && !!id,
  });

  const { data: members } = useQuery({
    queryKey: ["members", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("memberships")
        .select("*, profiles(*)")
        .eq("community_id", id);
      return data || [];
    },
    enabled: !!membership || !!hasAccess,
  });

  const { data: posts } = useQuery({
    queryKey: ["posts", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select(`*, profiles(*), reactions(id, user_id, type, emoji)`)
        .eq("community_id", id)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!membership || !!hasAccess,
  });

  const { data: commentsData } = useQuery({
    queryKey: ["comments", id],
    queryFn: async () => {
      if (!posts) return [];
      const postIds = posts.map((p: any) => p.id);
      const { data } = await supabase
        .from("comments")
        .select(`*, profiles(*), comment_reactions(id, user_id, type, emoji)`)
        .in("post_id", postIds)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!posts && posts.length > 0,
  });

  // Set up realtime
  useEffect(() => {
    if (!membership && !hasAccess) return;

    const channel = supabase
      .channel(`posts-${id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "posts",
        filter: `community_id=eq.${id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["posts", id] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, membership, hasAccess, queryClient]);

  useEffect(() => {
    scrollToBottom();
  }, [posts]);

  const joinMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase.from("memberships").insert({
        community_id: id,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["membership", id, profile?.id] });
      queryClient.invalidateQueries({ queryKey: ["members", id] });
      queryClient.invalidateQueries({ queryKey: ["paid-access", id, profile?.id] });
      toast({ title: "Joined!", description: `Welcome to ${community?.name}!` });
    },
    onError: () => {
      toast({ title: "Something went wrong", description: "Please try again.", className: "bg-muted text-foreground border-border" });
    },
  });

  const handleMediaUpload = async (files: File[]): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    
    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile?.id}/${Date.now()}_${Math.random()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('community-media')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('community-media')
        .getPublicUrl(fileName);
      
      uploadedUrls.push(publicUrl);
    }
    
    return uploadedUrls;
  };

  const createPostMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Not authenticated");
      
      // Allow empty content if media is attached
      let mediaUrls: string[] = [];
      if (mediaFiles.length > 0) {
        setUploading(true);
        mediaUrls = await handleMediaUpload(mediaFiles);
      }
      
      // If no content and no media, just return silently
      if (!postContent.trim() && mediaUrls.length === 0) {
        return;
      }
      
      const { error } = await supabase.from("posts").insert({
        community_id: id,
        author_id: profile.id,
        content: postContent || "",
        media_urls: mediaUrls.length > 0 ? mediaUrls : null,
      });
      if (error) throw error;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["posts", id] });
      const previousPosts = queryClient.getQueryData(["posts", id]);
      
      if (profile && (postContent.trim() || mediaFiles.length > 0)) {
        const optimisticPost = {
          id: `temp-${Date.now()}`,
          community_id: id,
          author_id: profile.id,
          content: postContent,
          media_urls: null,
          created_at: new Date().toISOString(),
          profiles: profile,
          reactions: [],
        };
        
        queryClient.setQueryData(["posts", id], (old: any) => [...(old || []), optimisticPost]);
      }
      
      const savedContent = postContent;
      setPostContent("");
      setMediaFiles([]);
      
      return { previousPosts, savedContent };
    },
    onSuccess: () => {
      setUploading(false);
      queryClient.invalidateQueries({ queryKey: ["posts", id] });
    },
    onError: (error: any, _, context) => {
      setUploading(false);
      if (context?.savedContent) setPostContent(context.savedContent);
      if (context?.previousPosts) queryClient.setQueryData(["posts", id], context.previousPosts);
      // Soft error message
      toast({ 
        title: "Something went wrong", 
        description: "Please try again.", 
        className: "bg-muted text-foreground border-border"
      });
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: async ({ postId, content, parentId }: { postId: string; content: string; parentId?: string }) => {
      if (!profile) throw new Error("Not authenticated");
      const { error } = await supabase.from("comments").insert({
        post_id: postId,
        author_id: profile.id,
        content,
        parent_id: parentId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setCommentContent({});
      queryClient.invalidateQueries({ queryKey: ["comments", id] });
    },
  });

  const sendVoiceMessageMutation = useMutation({
    mutationFn: async (audioBlob: Blob) => {
      if (!profile) throw new Error("Not authenticated");
      
      const fileName = `voice-${Date.now()}.webm`;
      const filePath = `${profile.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("community-media")
        .upload(filePath, audioBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("community-media")
        .getPublicUrl(filePath);

      const { error: postError } = await supabase
        .from("posts")
        .insert({
          content: "",
          media_urls: [publicUrl],
          author_id: profile.id,
          community_id: id!,
        });

      if (postError) throw postError;
      await queryClient.invalidateQueries({ queryKey: ['posts', id] });
    },
    onError: () => {
      toast({ 
        title: "Something went wrong", 
        description: "Please try again.", 
        className: "bg-muted text-foreground border-border"
      });
    },
  });

  const toggleReactionMutation = useMutation({
    mutationFn: async ({ postId, emoji }: { postId: string; emoji: EmojiType }) => {
      if (!profile) throw new Error("Not authenticated");
      
      const existingReaction = posts?.find((p: any) => p.id === postId)?.reactions
        ?.find((r: any) => r.user_id === profile.id && r.emoji === emoji);
      
      if (existingReaction) {
        const { error } = await supabase.from("reactions").delete().eq("id", existingReaction.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reactions").insert({
          post_id: postId,
          user_id: profile.id,
          emoji,
          type: "like",
        });
        if (error && error.code !== '23505') throw error;
      }
    },
    onMutate: async ({ postId, emoji }) => {
      setAnimatingPost(postId);
      setTimeout(() => setAnimatingPost(null), 150);
      
      await queryClient.cancelQueries({ queryKey: ["posts", id] });
      const previousPosts = queryClient.getQueryData(["posts", id]);
      
      queryClient.setQueryData(["posts", id], (old: any) => {
        if (!old) return old;
        return old.map((post: any) => {
          if (post.id !== postId) return post;
          
          const existingReaction = post.reactions?.find(
            (r: any) => r.user_id === profile?.id && r.emoji === emoji
          );
          
          if (existingReaction) {
            return { ...post, reactions: post.reactions.filter((r: any) => r.id !== existingReaction.id) };
          } else {
            return {
              ...post,
              reactions: [...(post.reactions || []), { id: 'temp-' + Date.now(), user_id: profile?.id, emoji, type: 'like' }]
            };
          }
        });
      });
      
      return { previousPosts };
    },
    onError: (_, __, context) => {
      if (context?.previousPosts) queryClient.setQueryData(["posts", id], context.previousPosts);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["posts", id] });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setMediaFiles(Array.from(e.target.files));
  };

  const handleRemoveFile = (index: number) => {
    setMediaFiles(files => files.filter((_, i) => i !== index));
  };

  const isOwner = community?.owner_id === profile?.id;
  const canPost = isOwner || (community?.allow_member_posts && membership);

  if (communityLoading) {
    return (
      <ChatLayout showSidebar={false}>
        <div className="flex items-center justify-center h-screen bg-chat-bg">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </ChatLayout>
    );
  }

  if (!community) {
    return (
      <ChatLayout showSidebar={false}>
        <div className="flex items-center justify-center h-screen bg-chat-bg">
          <p className="text-muted-foreground">Community not found</p>
        </div>
      </ChatLayout>
    );
  }

  if (!membership && !hasAccess) {
    return (
      <ChatLayout showSidebar={false}>
        <div className="flex flex-col items-center justify-center h-screen p-4 bg-chat-bg">
          <Avatar className="h-20 w-20 mb-4 border-4 border-primary/20">
            <AvatarImage src={community.avatar_url || ""} />
            <AvatarFallback className="text-2xl bg-primary/10 text-primary">{community.name[0]}</AvatarFallback>
          </Avatar>
          <h1 className="text-2xl font-bold mb-2 text-foreground">{community.name}</h1>
          <p className="text-muted-foreground mb-6 text-center max-w-sm text-sm">{community.description}</p>
          
          {community.pricing_type === "free" ? (
            <Button 
              size="lg" 
              onClick={() => joinMutation.mutate()}
              className="rounded-xl px-6"
              disabled={joinMutation.isPending}
            >
              {joinMutation.isPending ? "Joining..." : "Join Community"}
            </Button>
          ) : (
            <Button 
              size="lg" 
              onClick={() => navigate(`/community/${id}/pricing`)}
              className="rounded-xl px-6"
            >
              View Pricing & Join
            </Button>
          )}
          
          <Button 
            variant="ghost" 
            onClick={() => navigate("/dashboard")}
            className="mt-3 text-muted-foreground text-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>
      </ChatLayout>
    );
  }

  return (
    <ChatLayout showSidebar={false}>
      <div className="flex h-full flex-col">
        {/* Header */}
        <header className="flex items-center gap-2 px-3 py-2 bg-card border-b border-border/50 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="rounded-full h-8 w-8 flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <Avatar className="h-9 w-9 flex-shrink-0">
            <AvatarImage src={community.avatar_url || ""} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm">{community.name[0]}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-foreground truncate text-sm">{community.name}</h1>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>{members?.length || 0} members</span>
            </div>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                <Info className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-72">
              <SheetHeader>
                <SheetTitle className="text-sm">Community Info</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="text-center">
                  <Avatar className="h-16 w-16 mx-auto mb-2">
                    <AvatarImage src={community.avatar_url || ""} />
                    <AvatarFallback className="text-xl bg-primary/10 text-primary">{community.name[0]}</AvatarFallback>
                  </Avatar>
                  <h2 className="font-semibold text-sm">{community.name}</h2>
                  <p className="text-xs text-muted-foreground mt-1">{community.description}</p>
                </div>
                
                <div>
                  <h3 className="font-medium mb-2 text-xs text-muted-foreground uppercase tracking-wide">
                    Members ({members?.length || 0})
                  </h3>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {members?.map((member: any) => (
                      <div key={member.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={member.profiles?.avatar_url || ""} />
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                            {member.profiles?.username?.[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{member.profiles?.username || "Unknown"}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {member.user_id === community.owner_id ? "Owner" : "Member"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </header>

        {/* Messages */}
        <div 
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-3 space-y-3 bg-chat-bg"
        >
          {posts?.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageCircle className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-sm">No messages yet</p>
              <p className="text-xs text-muted-foreground/70">Be the first to post something!</p>
            </div>
          )}
          
          {posts?.map((post: any) => {
            // Owner posts on right, joiner posts on left
            const isPostOwner = post.author_id === community.owner_id;
            const postComments = commentsData?.filter((c: any) => c.post_id === post.id) || [];
            const userReaction = post.reactions?.find((r: any) => r.user_id === profile?.id);

            return (
              <div 
                key={post.id} 
                className={cn("flex gap-2 animate-fade-in", isPostOwner ? "flex-row-reverse" : "flex-row")}
              >
                {!isPostOwner && (
                  <Avatar className="h-7 w-7 flex-shrink-0 mt-1">
                    <AvatarImage src={post.profiles?.avatar_url} />
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                      {post.profiles?.username?.[0]}
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div className={cn("max-w-[75%] space-y-0.5", isPostOwner && "items-end")}>
                  {!isPostOwner && (
                    <span className="text-[10px] font-medium text-primary ml-1">
                      {post.profiles?.username}
                    </span>
                  )}
                  
                  {/* Message Bubble */}
                  <div className={cn(
                    "rounded-2xl px-3 py-2 shadow-sm",
                    isPostOwner 
                      ? "bg-chat-outgoing rounded-br-md" 
                      : "bg-chat-incoming rounded-bl-md"
                  )}>
                    {post.content && (
                      <p className="text-foreground text-sm whitespace-pre-wrap break-words">
                        {post.content}
                      </p>
                    )}
                    
                    {/* Media */}
                    {post.media_urls?.map((url: string, idx: number) => {
                      const isAudio = url.includes('voice-') || url.endsWith('.webm') || url.endsWith('.mp3');
                      const isVideo = url.endsWith('.mp4') || url.endsWith('.mov');
                      
                      if (isAudio) return <AudioPlayer key={idx} audioUrl={url} />;
                      if (isVideo) return (
                        <video key={idx} src={url} controls className="rounded-xl max-h-48 mt-1" />
                      );
                      return (
                        <img 
                          key={idx} 
                          src={url} 
                          alt="Media" 
                          className="rounded-xl max-h-48 mt-1 cursor-pointer"
                          loading="lazy"
                        />
                      );
                    })}
                    
                    <div className={cn(
                      "flex items-center gap-1 mt-1",
                      isPostOwner ? "justify-end" : "justify-start"
                    )}>
                      <span className="text-[9px] text-muted-foreground">
                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: false })}
                      </span>
                    </div>
                  </div>
                  
                  {/* Reactions */}
                  <div className={cn("flex items-center gap-2 px-1", isPostOwner && "justify-end")}>
                    <button
                      onClick={() => toggleReactionMutation.mutate({ postId: post.id, emoji: "❤️" })}
                      className={cn(
                        "flex items-center gap-1 text-xs transition-all",
                        userReaction?.emoji === "❤️" ? "text-like" : "text-muted-foreground hover:text-like",
                        animatingPost === post.id && "animate-bounce-scale"
                      )}
                    >
                      <Heart className={cn("h-3 w-3", userReaction?.emoji === "❤️" && "fill-like text-like")} />
                      {post.reactions?.length > 0 && <span>{post.reactions.length}</span>}
                    </button>
                    
                    <button
                      onClick={() => setShowComments({ ...showComments, [post.id]: !showComments[post.id] })}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-all"
                    >
                      <MessageCircle className="h-3 w-3" />
                      {postComments.length > 0 && <span>{postComments.length}</span>}
                    </button>
                  </div>
                  
                  {/* Comments */}
                  {showComments[post.id] && (
                    <div className="space-y-1.5 ml-3 pt-1 animate-fade-in">
                      {postComments.map((comment: any) => (
                        <div key={comment.id} className="flex items-start gap-1.5">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={comment.profiles?.avatar_url} />
                            <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                              {comment.profiles?.username?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="bg-card rounded-xl px-2 py-1 text-xs">
                            <span className="font-medium text-primary">{comment.profiles?.username}</span>
                            <p className="text-foreground">{comment.content}</p>
                          </div>
                        </div>
                      ))}
                      
                      <div className="flex gap-1.5 mt-1">
                        <Input
                          value={commentContent[post.id] || ""}
                          onChange={(e) => setCommentContent({ ...commentContent, [post.id]: e.target.value })}
                          placeholder="Add a comment..."
                          className="text-xs h-7 bg-card border-border/50 rounded-full px-3"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && commentContent[post.id]?.trim()) {
                              createCommentMutation.mutate({ postId: post.id, content: commentContent[post.id] });
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                {isPostOwner && (
                  <Avatar className="h-7 w-7 flex-shrink-0 mt-1">
                    <AvatarImage src={post.profiles?.avatar_url} />
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                      {post.profiles?.username?.[0]}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to Bottom */}
        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-20 right-4 z-20 bg-card text-foreground rounded-full p-1.5 shadow-elegant border border-border"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}

        {/* Input Area - Always visible for members */}
        {canPost && (
          <div className="bg-card border-t border-border/50 p-2 flex-shrink-0">
            <MediaPreview files={mediaFiles} onRemove={handleRemoveFile} />
            <div className="flex items-center gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded-full h-9 w-9 flex-shrink-0"
              >
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              </Button>
              
              <VoiceRecorder
                onSend={(blob) => sendVoiceMessageMutation.mutate(blob)}
                onCancel={() => {}}
              />
              
              <div className="flex-1 flex items-center bg-muted rounded-full px-3 h-10 border border-border/50">
                <input
                  type="text"
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-transparent text-sm focus:outline-none text-foreground placeholder:text-muted-foreground"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (postContent.trim() || mediaFiles.length > 0) {
                        createPostMutation.mutate();
                      }
                    }
                  }}
                />
              </div>
              
              <Button
                onClick={() => createPostMutation.mutate()}
                disabled={(!postContent.trim() && mediaFiles.length === 0) || uploading}
                size="icon"
                className="rounded-full h-9 w-9 flex-shrink-0"
              >
                {uploading ? (
                  <span className="animate-pulse text-xs">...</span>
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </ChatLayout>
  );
}
