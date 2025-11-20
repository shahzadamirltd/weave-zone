import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { EmojiReactionPicker } from "@/components/EmojiReactionPicker";
import { ReactionAnimation } from "@/components/ReactionAnimation";
import { MediaPreview } from "@/components/MediaPreview";
import { EmojiType } from "@/services/notificationService";
import { 
  ArrowLeft, Users, Send, Image as ImageIcon, CheckCircle2, Search, Settings
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Community() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [postContent, setPostContent] = useState("");
  const [commentContent, setCommentContent] = useState<{ [key: string]: string }>({});
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [animatingEmoji, setAnimatingEmoji] = useState<EmojiType | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

  const { data: community } = useQuery({
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
        .select(`
          *,
          profiles(*),
          reactions(id, user_id, type, emoji)
        `)
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
        .select(`
          *,
          profiles(*),
          comment_reactions(id, user_id, type, emoji)
        `)
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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "posts",
          filter: `community_id=eq.${id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["posts", id] });
        }
      )
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
      toast({ 
        title: "✅ Joined!", 
        description: `Welcome to ${community?.name}!`,
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleMediaUpload = async (files: File[]): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    
    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile?.id}/${Date.now()}_${Math.random()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('community-media')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

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
      
      if (!postContent.trim() && mediaFiles.length === 0) {
        throw new Error("Please add some content or media");
      }
      
      let mediaUrls: string[] = [];
      if (mediaFiles.length > 0) {
        setUploading(true);
        mediaUrls = await handleMediaUpload(mediaFiles);
      }
      
      const { error } = await supabase.from("posts").insert({
        community_id: id,
        author_id: profile.id,
        content: postContent || "",
        media_urls: mediaUrls.length > 0 ? mediaUrls : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setPostContent("");
      setMediaFiles([]);
      setUploading(false);
      queryClient.invalidateQueries({ queryKey: ["posts", id] });
    },
    onError: (error: any) => {
      setUploading(false);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      if (!profile) throw new Error("Not authenticated");
      const { error } = await supabase.from("comments").insert({
        post_id: postId,
        author_id: profile.id,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setCommentContent({});
      queryClient.invalidateQueries({ queryKey: ["comments", id] });
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
          type: "emoji",
        });
        if (error) throw error;
        setAnimatingEmoji(emoji);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts", id] });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setMediaFiles(Array.from(e.target.files));
    }
  };

  const handleRemoveFile = (index: number) => {
    setMediaFiles(files => files.filter((_, i) => i !== index));
  };

  const filteredPosts = posts?.filter((post: any) =>
    post.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.profiles?.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isOwner = community?.owner_id === profile?.id;

  if (!community) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </AppLayout>
    );
  }

  if (!membership && !hasAccess) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-screen bg-background p-6">
          <Avatar className="h-32 w-32 mb-6 border-4 border-primary ring-4 ring-primary/20">
            <AvatarImage src={community.avatar_url || ""} />
            <AvatarFallback className="text-4xl bg-primary text-primary-foreground">{community.name[0]}</AvatarFallback>
          </Avatar>
          <h1 className="text-4xl font-bold mb-4">{community.name}</h1>
          <p className="text-muted-foreground mb-8 text-center max-w-md">{community.description}</p>
          
          {community.pricing_type === "free" ? (
            <Button 
              size="lg" 
              onClick={() => joinMutation.mutate()}
              className="bg-primary hover:bg-primary/90 shadow-lg"
            >
              Join Community
            </Button>
          ) : (
            <Button 
              size="lg" 
              onClick={() => navigate(`/community-pricing/${id}`)}
              className="bg-primary hover:bg-primary/90 shadow-lg"
            >
              View Pricing & Join
            </Button>
          )}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {animatingEmoji && (
        <ReactionAnimation 
          emoji={animatingEmoji} 
          onComplete={() => setAnimatingEmoji(null)} 
        />
      )}
      
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border/50 px-6 py-4 shadow-sm">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="hover:bg-accent rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Avatar className="h-10 w-10 border-2 border-primary/20">
              <AvatarImage src={community.avatar_url || ""} />
              <AvatarFallback className="bg-primary text-primary-foreground">{community.name[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-lg font-semibold">{community.name}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>{members?.length || 0} members</span>
                {membership && (
                  <Badge variant="secondary" className="ml-2 gap-1 bg-primary/10 text-primary border-primary/20">
                    <CheckCircle2 className="h-3 w-3" />
                    Joined
                  </Badge>
                )}
              </div>
            </div>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="pl-9 bg-accent/50 border-border/50"
              />
            </div>
            {isOwner && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/edit-community/${id}`)}
                className="hover:bg-accent rounded-full"
              >
                <Settings className="h-5 w-5" />
              </Button>
            )}
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {filteredPosts?.map((post: any) => {
            const postComments = commentsData?.filter((c: any) => c.post_id === post.id) || [];
            const userReaction = post.reactions?.find((r: any) => r.user_id === profile?.id);

            return (
              <div key={post.id} className="flex gap-3 animate-slide-up">
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage src={post.profiles?.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-primary">{post.profiles?.username?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-semibold text-foreground">{post.profiles?.username}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="bg-card rounded-2xl px-4 py-3 border border-border/50 shadow-sm">
                    <p className="text-foreground whitespace-pre-wrap break-words">{post.content}</p>
                    {post.media_urls && post.media_urls.length > 0 && (
                      <div className="mt-3 grid gap-2">
                        {post.media_urls.map((url: string, idx: number) => (
                          <img
                            key={idx}
                            src={url}
                            alt="Post media"
                            className="rounded-lg max-w-full h-auto max-h-96 object-cover border border-border/30"
                            loading="lazy"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <EmojiReactionPicker
                      onSelect={(emoji) => toggleReactionMutation.mutate({ postId: post.id, emoji })}
                      currentEmoji={userReaction?.emoji}
                    />
                    <div className="flex gap-1">
                      {Object.entries(
                        post.reactions?.reduce((acc: any, r: any) => {
                          acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                          return acc;
                        }, {}) || {}
                      ).map(([emoji, count]) => (
                        <button
                          key={emoji}
                          className="px-2 py-1 rounded-full bg-accent/50 hover:bg-accent text-sm transition-all hover:scale-110 border border-border/30"
                          onClick={() => toggleReactionMutation.mutate({ postId: post.id, emoji: emoji as EmojiType })}
                        >
                          {emoji} {String(count)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Comments */}
                  {postComments.length > 0 && (
                    <div className="mt-3 space-y-2 ml-4 border-l-2 border-primary/20 pl-4">
                      {postComments.map((comment: any) => (
                        <div key={comment.id} className="text-sm">
                          <span className="font-medium text-primary">{comment.profiles?.username}</span>
                          <span className="ml-2 text-foreground/90">{comment.content}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Comment Input */}
                  <div className="mt-2 flex gap-2">
                    <Input
                      value={commentContent[post.id] || ""}
                      onChange={(e) => setCommentContent({ ...commentContent, [post.id]: e.target.value })}
                      placeholder="Reply..."
                      className="text-sm h-8 bg-accent/30 border-border/50"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && commentContent[post.id]?.trim()) {
                          createCommentMutation.mutate({
                            postId: post.id,
                            content: commentContent[post.id],
                          });
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-border/50 bg-card/95 backdrop-blur-sm p-4">
          <MediaPreview files={mediaFiles} onRemove={handleRemoveFile} />
          <div className="flex gap-2 items-end">
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
              className="hover:bg-accent rounded-full"
            >
              <ImageIcon className="h-5 w-5" />
            </Button>
            <Textarea
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              placeholder="Type a message..."
              className="resize-none bg-accent/30 border-border/50 min-h-[44px] max-h-32 rounded-2xl"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (postContent.trim() || mediaFiles.length > 0) {
                    createPostMutation.mutate();
                  }
                }
              }}
            />
            <Button
              onClick={() => createPostMutation.mutate()}
              disabled={(!postContent.trim() && mediaFiles.length === 0) || uploading}
              className="bg-primary hover:bg-primary/90 shadow-sm rounded-full"
            >
              {uploading ? (
                <span className="animate-pulse">...</span>
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
