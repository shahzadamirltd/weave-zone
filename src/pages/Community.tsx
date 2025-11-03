import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { TipButton } from "@/components/TipButton";
import { CommunityLiveStream } from "@/components/community/CommunityLiveStream";
import { 
  ArrowLeft, Users, Lock, Globe, MessageSquare, Heart, 
  Sparkles, Send, Image as ImageIcon, Video, Share2, Reply, RadioIcon, MoreVertical
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Community() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [postContent, setPostContent] = useState("");
  const [commentContent, setCommentContent] = useState<{ [key: string]: string }>({});
  const [replyingTo, setReplyingTo] = useState<{ [key: string]: string | null }>({});
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showLiveStream, setShowLiveStream] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      
      if (error) {
        console.error("Error checking paid access:", error);
        return false;
      }
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
          reactions(id, user_id, type)
        `)
        .eq("community_id", id)
        .order("created_at", { ascending: false });
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
          comment_reactions(id, user_id, type)
        `)
        .in("post_id", postIds)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!posts && posts.length > 0,
  });

  // Set up realtime subscription for posts
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
    onMutate: () => {
      toast({ title: "Joining...", description: "Adding you to the community" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["membership", id, profile?.id] });
      queryClient.invalidateQueries({ queryKey: ["members", id] });
      queryClient.invalidateQueries({ queryKey: ["paid-access", id, profile?.id] });
      toast({ title: "Success!", description: "You're now a member!" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleMediaUpload = async (files: File[]): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    
    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile?.id}/${Math.random()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('community-media')
        .upload(fileName, file);

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
      
      // Require either content or media
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
      toast({ title: "Success!", description: "Post created" });
    },
    onError: (error: any) => {
      setUploading(false);
      toast({ title: "Error", description: error.message || "Failed to create post", variant: "destructive" });
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: async ({ postId, parentId }: { postId: string; parentId?: string }) => {
      if (!profile) throw new Error("Not authenticated");
      const content = commentContent[postId] || "";
      if (!content.trim()) throw new Error("Comment cannot be empty");
      
      const { error } = await supabase.from("comments").insert({
        post_id: postId,
        author_id: profile.id,
        content: content,
        parent_id: parentId || null,
      });
      if (error) throw error;
      return postId;
    },
    onSuccess: (postId) => {
      setCommentContent((prev) => ({ ...prev, [postId]: "" }));
      setReplyingTo((prev) => ({ ...prev, [postId]: null }));
      queryClient.invalidateQueries({ queryKey: ["comments", id] });
      toast({ title: "Success!", description: "Comment added" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add comment", variant: "destructive" });
    },
  });

  const toggleReactionMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (!profile) throw new Error("Not authenticated");
      
      const { data: existing } = await supabase
        .from("reactions")
        .select("*")
        .eq("post_id", postId)
        .eq("user_id", profile.id)
        .eq("type", "like")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase.from("reactions").delete().eq("id", existing.id);
        if (error) throw error;
        return { action: 'removed' };
      } else {
        const { error } = await supabase.from("reactions").insert({
          post_id: postId,
          user_id: profile.id,
          type: "like",
        });
        if (error) throw error;
        return { action: 'added' };
      }
    },
    onMutate: async (postId: string) => {
      await queryClient.cancelQueries({ queryKey: ["posts", id] });
      const previousPosts = queryClient.getQueryData(["posts", id]);
      
      queryClient.setQueryData(["posts", id], (old: any) => {
        if (!old) return old;
        return old.map((post: any) => {
          if (post.id !== postId) return post;
          
          const hasLiked = post.reactions?.some((r: any) => r.user_id === profile?.id);
          const newReactions = hasLiked
            ? post.reactions.filter((r: any) => r.user_id !== profile?.id)
            : [...(post.reactions || []), { user_id: profile?.id, type: "like" }];
          
          return { ...post, reactions: newReactions };
        });
      });
      
      return { previousPosts };
    },
    onError: (error: any, postId, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(["posts", id], context.previousPosts);
      }
      toast({ title: "Error", description: error.message || "Failed to update reaction", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["posts", id] });
    },
  });

  const toggleCommentReactionMutation = useMutation({
    mutationFn: async (commentId: string) => {
      if (!profile) throw new Error("Not authenticated");
      
      const { data: existing } = await supabase
        .from("comment_reactions")
        .select("*")
        .eq("comment_id", commentId)
        .eq("user_id", profile.id)
        .eq("type", "like")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase.from("comment_reactions").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("comment_reactions").insert({
          comment_id: commentId,
          user_id: profile.id,
          type: "like",
        });
        if (error) throw error;
      }
    },
    onMutate: async (commentId: string) => {
      await queryClient.cancelQueries({ queryKey: ["comments", id] });
      const previousComments = queryClient.getQueryData(["comments", id]);
      
      queryClient.setQueryData(["comments", id], (old: any) => {
        if (!old) return old;
        return old.map((comment: any) => {
          if (comment.id !== commentId) return comment;
          
          const hasLiked = comment.comment_reactions?.some((r: any) => r.user_id === profile?.id);
          const newReactions = hasLiked
            ? comment.comment_reactions.filter((r: any) => r.user_id !== profile?.id)
            : [...(comment.comment_reactions || []), { user_id: profile?.id, type: "like" }];
          
          return { ...comment, comment_reactions: newReactions };
        });
      });
      
      return { previousComments };
    },
    onError: (error: any, commentId, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(["comments", id], context.previousComments);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", id] });
    },
  });

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/community/${id}`;
    navigator.clipboard.writeText(shareUrl);
    toast({ title: "Link copied!", description: "Community link copied to clipboard" });
  };

  if (!community) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </AppLayout>
    );
  }

  const needsPayment = community.pricing_type !== "free" && !hasAccess && community.owner_id !== profile?.id;

  if (needsPayment) {
    return (
      <AppLayout>
        <div className="container mx-auto p-4 max-w-2xl">
          <Card>
            <CardHeader>
              <div className="text-center space-y-4">
                <h2 className="text-3xl font-bold">{community.name}</h2>
                <p className="text-muted-foreground">{community.description}</p>
                <div className="py-6">
                  <p className="text-lg mb-2">This is a paid community</p>
                  <p className="text-4xl font-bold text-primary">${community.price_amount}</p>
                  {community.pricing_type === "recurring_monthly" && (
                    <p className="text-sm text-muted-foreground">per month</p>
                  )}
                </div>
                <Button size="lg" onClick={() => navigate(`/community/${id}/pricing`)}>
                  View Pricing & Join
                </Button>
              </div>
            </CardHeader>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (!membership && !hasAccess) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
          <Card>
            <CardHeader className="text-center space-y-4 py-12">
              <div className="flex justify-center">
                <div className="h-20 w-20 rounded-full bg-gradient-primary flex items-center justify-center">
                  <Users className="h-10 w-10 text-primary-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold">{community.name}</h1>
                <p className="text-muted-foreground">{community.description}</p>
              </div>
              <div className="flex items-center justify-center gap-2">
                {community.is_private ? (
                  <Badge variant="secondary" className="gap-1">
                    <Lock className="h-3 w-3" />
                    Private
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <Globe className="h-3 w-3" />
                    Public
                  </Badge>
                )}
              </div>
              <Button onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending}>
                {joinMutation.isPending ? "Joining..." : "Join Community"}
              </Button>
            </CardHeader>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Custom Header */}
      <header className="glass border-b border-border/30 px-5 py-3 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="h-10 w-10 hover:bg-accent/50 transition-all active:scale-90"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <Avatar className="h-10 w-10 ring-2 ring-border/50">
            <AvatarImage src={community.profiles?.avatar_url} />
            <AvatarFallback className="font-semibold">
              {community.name?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <h1 className="font-semibold text-base">{community.name}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              {members?.length || 0} members
            </p>
          </div>
          
          <Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-accent/50 transition-all active:scale-90">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Content - Posts Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-28">
        {posts && posts.length > 0 ? (
          posts.map((post: any) => (
            <div key={post.id} className="space-y-3 animate-fade-in">
              <div className="flex items-start gap-3 p-4 rounded-2xl hover:bg-accent/30 transition-all">
                <Avatar className="h-10 w-10 ring-2 ring-border/30">
                  <AvatarImage src={post.profiles?.avatar_url} />
                  <AvatarFallback className="text-xs font-semibold">
                    {post.profiles?.username?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{post.profiles?.username}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
                  {post.media_urls && post.media_urls.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {post.media_urls.map((url: string, idx: number) => (
                        <div key={idx} className="rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-all">
                          {url.match(/\.(mp4|webm|ogg)$/i) ? (
                            <video src={url} controls className="w-full" />
                          ) : (
                            <img src={url} alt="Post media" className="w-full object-cover hover:scale-105 transition-transform" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-4 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 h-9 px-3 hover:bg-accent/50 rounded-xl transition-all active:scale-95"
                      onClick={() => toggleReactionMutation.mutate(post.id)}
                    >
                      <Heart className={`h-4 w-4 transition-all ${post.reactions?.some((r: any) => r.user_id === profile?.id) ? 'fill-red-500 text-red-500 scale-110' : ''}`} />
                      <span className="text-xs font-medium">{post.reactions?.length || 0}</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1.5 h-9 px-3 hover:bg-accent/50 rounded-xl transition-all active:scale-95">
                      <MessageSquare className="h-4 w-4" />
                      <span className="text-xs font-medium">{commentsData?.filter((c: any) => c.post_id === post.id).length || 0}</span>
                    </Button>
                  </div>

                  {/* Comments Section */}
                  <div className="space-y-3 pl-2">
                    {commentsData?.filter((c: any) => c.post_id === post.id && !c.parent_id).map((comment: any) => (
                      <div key={comment.id} className="space-y-1">
                        <div className="flex gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={comment.profiles?.avatar_url} />
                            <AvatarFallback>
                              {comment.profiles?.username?.[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 space-y-1">
                            <div className="bg-muted/50 rounded-2xl px-3 py-2">
                              <div className="font-semibold text-xs">{comment.profiles?.username}</div>
                              <p className="text-xs">{comment.content}</p>
                            </div>
                            <div className="flex items-center gap-3 px-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto p-0 text-xs hover:bg-transparent"
                                onClick={() => toggleCommentReactionMutation.mutate(comment.id)}
                              >
                                <Heart className={`h-3 w-3 mr-1 ${comment.comment_reactions?.some((r: any) => r.user_id === profile?.id) ? 'fill-red-500 text-red-500' : ''}`} />
                                {comment.comment_reactions?.length || 0}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto p-0 text-xs hover:bg-transparent"
                                onClick={() => setReplyingTo((prev) => ({ ...prev, [post.id]: comment.id }))}
                              >
                                Reply
                              </Button>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Replies */}
                        {commentsData?.filter((r: any) => r.parent_id === comment.id).map((reply: any) => (
                          <div key={reply.id} className="ml-9 flex gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={reply.profiles?.avatar_url} />
                              <AvatarFallback className="text-xs">
                                {reply.profiles?.username?.[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 space-y-1">
                              <div className="bg-muted/50 rounded-2xl px-3 py-2">
                                <div className="font-semibold text-xs">{reply.profiles?.username}</div>
                                <p className="text-xs">{reply.content}</p>
                              </div>
                              <div className="flex items-center gap-2 px-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 text-xs hover:bg-transparent"
                                  onClick={() => toggleCommentReactionMutation.mutate(reply.id)}
                                >
                                  <Heart className={`h-3 w-3 mr-1 ${reply.comment_reactions?.some((r: any) => r.user_id === profile?.id) ? 'fill-red-500 text-red-500' : ''}`} />
                                  {reply.comment_reactions?.length || 0}
                                </Button>
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="border-t pt-2" />
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-center text-muted-foreground">
              No posts yet. Be the first to share something!
            </p>
          </div>
        )}
      </div>

      {/* Fixed Bottom Input */}
      <div className="glass border-t border-border/30 px-5 py-4 fixed bottom-0 left-0 right-0 z-40">
        <div className="flex gap-3 items-center max-w-3xl mx-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                setMediaFiles(Array.from(e.target.files));
              }
            }}
          />
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="h-11 w-11 hover:bg-accent/50 rounded-xl transition-all active:scale-90"
          >
            <ImageIcon className="h-5 w-5" />
          </Button>
          <Input
            placeholder="Type a message..."
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (postContent.trim() || mediaFiles.length > 0) {
                  createPostMutation.mutate();
                }
              }
            }}
            className="flex-1 rounded-2xl bg-accent/50 border-0 h-11 focus-visible:bg-accent"
          />
          <Button
            onClick={() => createPostMutation.mutate()}
            disabled={(!postContent.trim() && mediaFiles.length === 0) || createPostMutation.isPending || uploading}
            size="icon"
            className="h-11 w-11 rounded-2xl shadow-md hover:shadow-lg transition-all active:scale-90"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
        {mediaFiles.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-3 max-w-3xl mx-auto">
            {mediaFiles.map((file, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs px-3 py-1 rounded-lg">{file.name}</Badge>
            ))}
          </div>
        )}
      </div>

      {showLiveStream && (
        <CommunityLiveStream 
          communityId={id!}
          isOwner={community.owner_id === profile?.id}
          onClose={() => setShowLiveStream(false)}
        />
      )}
    </div>
  );
}
