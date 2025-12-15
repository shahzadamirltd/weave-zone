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
  ChevronDown, MessageCircle, Heart, Info, Phone, Video, MoreVertical, Smile
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
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
  const canPost = isOwner || (community?.allow_member_posts && membership) || membership;

  // Group posts by date
  const groupPostsByDate = (posts: any[]) => {
    const groups: { [key: string]: any[] } = {};
    posts?.forEach((post: any) => {
      const date = format(new Date(post.created_at), 'yyyy-MM-dd');
      if (!groups[date]) groups[date] = [];
      groups[date].push(post);
    });
    return groups;
  };

  const groupedPosts = groupPostsByDate(posts || []);

  if (communityLoading) {
    return (
      <ChatLayout>
        <div className="flex items-center justify-center h-screen bg-chat-bg">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </ChatLayout>
    );
  }

  if (!community) {
    return (
      <ChatLayout>
        <div className="flex items-center justify-center h-screen bg-chat-bg">
          <p className="text-muted-foreground">Community not found</p>
        </div>
      </ChatLayout>
    );
  }

  if (!membership && !hasAccess) {
    return (
      <ChatLayout>
        <div className="flex flex-col items-center justify-center h-screen p-6 bg-chat-bg">
          <Avatar className="h-24 w-24 mb-6 border-4 border-card shadow-lg">
            <AvatarImage src={community.avatar_url || ""} />
            <AvatarFallback className="text-3xl bg-muted text-muted-foreground">{community.name[0]}</AvatarFallback>
          </Avatar>
          <h1 className="text-2xl font-bold mb-2 text-foreground">{community.name}</h1>
          <p className="text-muted-foreground mb-8 text-center max-w-md">{community.description}</p>
          
          {community.pricing_type === "free" ? (
            <Button 
              size="lg" 
              onClick={() => joinMutation.mutate()}
              className="rounded-xl px-8 py-6 text-lg"
              disabled={joinMutation.isPending}
            >
              {joinMutation.isPending ? "Joining..." : "Join Community"}
            </Button>
          ) : (
            <Button 
              size="lg" 
              onClick={() => navigate(`/community/${id}/pricing`)}
              className="rounded-xl px-8 py-6 text-lg"
            >
              View Pricing & Join
            </Button>
          )}
          
          <Button 
            variant="ghost" 
            onClick={() => navigate("/dashboard")}
            className="mt-4 text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </ChatLayout>
    );
  }

  return (
    <ChatLayout>
      <div className="flex h-full flex-col bg-chat-bg">
        {/* Header - WhatsApp Style */}
        <header className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="rounded-full h-10 w-10 flex-shrink-0 lg:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarImage src={community.avatar_url || ""} />
            <AvatarFallback className="bg-muted text-muted-foreground">{community.name[0]}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-foreground truncate">{community.name}</h1>
            <p className="text-xs text-muted-foreground">{members?.length || 0} members</p>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="rounded-full h-10 w-10">
              <Video className="h-5 w-5 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full h-10 w-10">
              <Phone className="h-5 w-5 text-muted-foreground" />
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-10 w-10">
                  <MoreVertical className="h-5 w-5 text-muted-foreground" />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-80">
                <SheetHeader>
                  <SheetTitle>Community Info</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-6">
                  <div className="text-center">
                    <Avatar className="h-20 w-20 mx-auto mb-3">
                      <AvatarImage src={community.avatar_url || ""} />
                      <AvatarFallback className="text-2xl bg-muted text-muted-foreground">{community.name[0]}</AvatarFallback>
                    </Avatar>
                    <h2 className="font-semibold text-lg">{community.name}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{community.description}</p>
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-3 text-sm text-muted-foreground uppercase tracking-wide">
                      Members ({members?.length || 0})
                    </h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {members?.map((member: any) => (
                        <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={member.profiles?.avatar_url || ""} />
                            <AvatarFallback className="bg-muted text-muted-foreground">
                              {member.profiles?.username?.[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{member.profiles?.username || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">
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
          </div>
        </header>

        {/* Messages Area */}
        <div 
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-3"
          style={{ 
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%239C92AC" fill-opacity="0.03"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")'
          }}
        >
          {posts?.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageCircle className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground text-lg">No messages yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Be the first to say something!</p>
            </div>
          )}
          
          {Object.entries(groupedPosts).map(([date, datePosts]) => (
            <div key={date}>
              {/* Date Separator */}
              <div className="flex justify-center my-4">
                <span className="bg-card/80 text-muted-foreground text-xs px-3 py-1 rounded-full shadow-sm">
                  {format(new Date(date), 'MMMM d, yyyy') === format(new Date(), 'MMMM d, yyyy') 
                    ? 'Today' 
                    : format(new Date(date), 'MMMM d, yyyy')}
                </span>
              </div>

              {datePosts.map((post: any) => {
                const isPostOwner = post.author_id === community.owner_id;
                const postComments = commentsData?.filter((c: any) => c.post_id === post.id) || [];
                const userReaction = post.reactions?.find((r: any) => r.user_id === profile?.id);

                return (
                  <div 
                    key={post.id} 
                    className={cn("flex gap-2 mb-3 animate-fade-in", isPostOwner ? "justify-end" : "justify-start")}
                  >
                    {!isPostOwner && (
                      <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
                        <AvatarImage src={post.profiles?.avatar_url} />
                        <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                          {post.profiles?.username?.[0]}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    
                    <div className={cn("max-w-[70%]", isPostOwner && "items-end")}>
                      {!isPostOwner && (
                        <span className="text-xs font-medium text-primary ml-2 mb-1 block">
                          {post.profiles?.username}
                        </span>
                      )}
                      
                      {/* Message Bubble */}
                      <div className={cn(
                        "rounded-2xl px-4 py-2 shadow-sm relative",
                        isPostOwner 
                          ? "bg-chat-outgoing rounded-tr-md" 
                          : "bg-chat-incoming rounded-tl-md"
                      )}>
                        {post.content && (
                          <p className="text-foreground whitespace-pre-wrap break-words">
                            {post.content}
                          </p>
                        )}
                        
                        {/* Media */}
                        {post.media_urls?.map((url: string, idx: number) => {
                          const isAudio = url.includes('voice-') || url.endsWith('.webm') || url.endsWith('.mp3');
                          const isVideo = url.endsWith('.mp4') || url.endsWith('.mov');
                          
                          if (isAudio) return <AudioPlayer key={idx} audioUrl={url} />;
                          if (isVideo) return (
                            <video key={idx} src={url} controls className="rounded-xl max-w-full mt-2" />
                          );
                          return (
                            <img 
                              key={idx} 
                              src={url} 
                              alt="Media" 
                              className="rounded-xl max-w-full max-h-64 mt-2 cursor-pointer object-cover"
                              loading="lazy"
                            />
                          );
                        })}
                        
                        <div className={cn(
                          "flex items-center gap-2 mt-1",
                          isPostOwner ? "justify-end" : "justify-start"
                        )}>
                          <span className="text-[11px] text-muted-foreground">
                            {format(new Date(post.created_at), 'h:mm a')}
                          </span>
                        </div>
                      </div>
                      
                      {/* Reactions */}
                      <div className={cn("flex items-center gap-3 px-2 mt-1", isPostOwner && "justify-end")}>
                        <button
                          onClick={() => toggleReactionMutation.mutate({ postId: post.id, emoji: "❤️" })}
                          className={cn(
                            "flex items-center gap-1 text-sm transition-all",
                            userReaction?.emoji === "❤️" ? "text-like" : "text-muted-foreground hover:text-like",
                            animatingPost === post.id && "animate-bounce-scale"
                          )}
                        >
                          <Heart className={cn("h-4 w-4", userReaction?.emoji === "❤️" && "fill-like text-like")} />
                          {post.reactions?.length > 0 && <span>{post.reactions.length}</span>}
                        </button>
                        
                        <button
                          onClick={() => setShowComments({ ...showComments, [post.id]: !showComments[post.id] })}
                          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-all"
                        >
                          <MessageCircle className="h-4 w-4" />
                          {postComments.length > 0 && <span>{postComments.length}</span>}
                        </button>
                      </div>
                      
                      {/* Comments */}
                      {showComments[post.id] && (
                        <div className="space-y-2 ml-4 pt-2 animate-fade-in">
                          {postComments.map((comment: any) => (
                            <div key={comment.id} className="flex items-start gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={comment.profiles?.avatar_url} />
                                <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                                  {comment.profiles?.username?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="bg-card rounded-xl px-3 py-1.5 text-sm">
                                <span className="font-medium text-primary">{comment.profiles?.username}</span>
                                <p className="text-foreground">{comment.content}</p>
                              </div>
                            </div>
                          ))}
                          
                          <div className="flex gap-2 mt-2">
                            <Input
                              value={commentContent[post.id] || ""}
                              onChange={(e) => setCommentContent({ ...commentContent, [post.id]: e.target.value })}
                              placeholder="Write a comment..."
                              className="text-sm h-9 bg-card border-border/50 rounded-full px-4"
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
                      <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
                        <AvatarImage src={post.profiles?.avatar_url} />
                        <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                          {post.profiles?.username?.[0]}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to Bottom */}
        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-24 right-6 z-20 bg-card text-foreground rounded-full p-2 shadow-lg border border-border"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        )}

        {/* Input Area - Always visible */}
        {canPost && (
          <div className="bg-card border-t border-border p-3 flex-shrink-0">
            <MediaPreview files={mediaFiles} onRemove={handleRemoveFile} />
            <div className="flex items-center gap-2">
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
                className="rounded-full h-10 w-10 flex-shrink-0"
              >
                <Smile className="h-6 w-6 text-muted-foreground" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded-full h-10 w-10 flex-shrink-0"
              >
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              </Button>
              
              {/* Main Input */}
              <div className="flex-1 flex items-center bg-muted rounded-full px-4 h-12 border border-border/50">
                <input
                  type="text"
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="Type a message"
                  className="flex-1 bg-transparent focus:outline-none text-foreground placeholder:text-muted-foreground"
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
              
              {/* Voice or Send */}
              {postContent.trim() || mediaFiles.length > 0 ? (
                <Button
                  onClick={() => createPostMutation.mutate()}
                  disabled={uploading}
                  size="icon"
                  className="rounded-full h-12 w-12 flex-shrink-0"
                >
                  {uploading ? (
                    <span className="animate-pulse">...</span>
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              ) : (
                <VoiceRecorder
                  onSend={(blob) => sendVoiceMessageMutation.mutate(blob)}
                  onCancel={() => {}}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </ChatLayout>
  );
}
