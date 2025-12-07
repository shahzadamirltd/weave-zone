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
import { MediaPreview } from "@/components/MediaPreview";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { AudioPlayer } from "@/components/AudioPlayer";
import { EmojiType } from "@/services/notificationService";
import {
  ArrowLeft, Users, Send, Image as ImageIcon, CheckCircle2, Search, X,
  ChevronDown, ChevronUp, FileText, Video as VideoIcon, Music, Link as LinkIcon, MessageCircle, MoreVertical, Heart
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  const [animatingPost, setAnimatingPost] = useState<string | null>(null);
  const [showGroupInfo, setShowGroupInfo] = useState(true);
  const [filesExpanded, setFilesExpanded] = useState(true);
  const [showComments, setShowComments] = useState<{ [key: string]: boolean }>({});
  const [collapsedPosts, setCollapsedPosts] = useState<{ [key: string]: boolean }>({});
  const [replyingTo, setReplyingTo] = useState<{ [key: string]: string | null }>({});
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

  const { data: activeLiveStream } = useQuery({
    queryKey: ["active-live-stream", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("live_streams")
        .select("*, profiles(*)")
        .eq("community_id", id)
        .eq("status", "active")
        .maybeSingle();
      return data;
    },
    refetchInterval: 5000,
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
    onMutate: async () => {
      // Optimistic update - show post immediately
      await queryClient.cancelQueries({ queryKey: ["posts", id] });
      const previousPosts = queryClient.getQueryData(["posts", id]);
      
      if (profile && postContent.trim()) {
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
        
        queryClient.setQueryData(["posts", id], (old: any) => {
          return [...(old || []), optimisticPost];
        });
      }
      
      // Clear form immediately for instant feedback
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
      // Restore form content on error
      if (context?.savedContent) {
        setPostContent(context.savedContent);
      }
      if (context?.previousPosts) {
        queryClient.setQueryData(["posts", id], context.previousPosts);
      }
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
    onSuccess: (_, variables) => {
      setCommentContent({});
      setReplyingTo({});
      queryClient.invalidateQueries({ queryKey: ["comments", id] });
      toast({ title: "Success", description: "Comment posted" });
    },
  });

  const sendVoiceMessageMutation = useMutation({
    mutationFn: async (audioBlob: Blob) => {
      if (!profile) throw new Error("Not authenticated");
      
      const fileName = `voice-${Date.now()}.webm`;
      const filePath = `${profile.id}/${fileName}`;

      // Create optimistic post immediately
      const tempId = `temp-${Date.now()}`;
      const optimisticPost = {
        id: tempId,
        content: "",
        media_urls: null,
        created_at: new Date().toISOString(),
        author_id: profile.id,
        community_id: id!,
        profiles: {
          id: profile.id,
          username: profile.username || 'User',
          avatar_url: null,
          bio: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      // Return optimistic data immediately
      queryClient.setQueryData(['posts', id], (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any, i: number) => 
            i === 0 ? { ...page, data: [optimisticPost, ...page.data] } : page
          ),
        };
      });

      // Upload in background
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

      // Refresh to get actual post
      await queryClient.invalidateQueries({ queryKey: ['posts', id] });
    },
    onError: (error) => {
      toast({
        title: "Failed to send voice message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from("posts").delete().eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts", id] });
      toast({ title: "Success", description: "Post deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", id] });
      toast({ title: "Success", description: "Comment deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleCommentReactionMutation = useMutation({
    mutationFn: async ({ commentId, emoji }: { commentId: string; emoji: string }) => {
      if (!profile) throw new Error("Not authenticated");
      
      // Query database for existing reaction (not cache, to avoid temp IDs)
      const { data: existingReaction } = await supabase
        .from("comment_reactions")
        .select("id")
        .eq("comment_id", commentId)
        .eq("user_id", profile.id)
        .eq("emoji", emoji)
        .maybeSingle();

      if (existingReaction) {
        const { error } = await supabase
          .from("comment_reactions")
          .delete()
          .eq("id", existingReaction.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("comment_reactions").insert({
          comment_id: commentId,
          user_id: profile.id,
          emoji,
          type: "like",
        });
        // Ignore duplicate key errors (happens with fast clicks)
        if (error && error.code !== '23505') throw error;
      }
    },
    onMutate: async ({ commentId, emoji }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["comments", id] });
      
      // Snapshot previous value
      const previousComments = queryClient.getQueryData(["comments", id]);
      
      // Optimistically update
      queryClient.setQueryData(["comments", id], (old: any) => {
        if (!old) return old;
        return old.map((comment: any) => {
          if (comment.id !== commentId) return comment;
          
          const existingReaction = comment.comment_reactions?.find(
            (r: any) => r.user_id === profile?.id && r.emoji === emoji
          );
          
          if (existingReaction) {
            return {
              ...comment,
              comment_reactions: comment.comment_reactions.filter((r: any) => r.id !== existingReaction.id)
            };
          } else {
            return {
              ...comment,
              comment_reactions: [
                ...(comment.comment_reactions || []),
                {
                  id: 'temp-' + Date.now(),
                  user_id: profile?.id,
                  emoji,
                  type: 'like'
                }
              ]
            };
          }
        });
      });
      
      return { previousComments };
    },
    onError: (error: any, _, context) => {
      // Rollback on error
      if (context?.previousComments) {
        queryClient.setQueryData(["comments", id], context.previousComments);
      }
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
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
          type: "like",
        });
        // Ignore duplicate key errors (happens with fast clicks)
        if (error && error.code !== '23505') throw error;
      }
    },
    onMutate: async ({ postId, emoji }) => {
      // Instant animation
      setAnimatingPost(postId);
      setTimeout(() => setAnimatingPost(null), 150);
      
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["posts", id] });
      
      // Snapshot previous value
      const previousPosts = queryClient.getQueryData(["posts", id]);
      
      // Optimistically update
      queryClient.setQueryData(["posts", id], (old: any) => {
        if (!old) return old;
        return old.map((post: any) => {
          if (post.id !== postId) return post;
          
          const existingReaction = post.reactions?.find(
            (r: any) => r.user_id === profile?.id && r.emoji === emoji
          );
          
          if (existingReaction) {
            // Remove reaction
            return {
              ...post,
              reactions: post.reactions.filter((r: any) => r.id !== existingReaction.id)
            };
          } else {
            // Add reaction
            return {
              ...post,
              reactions: [
                ...(post.reactions || []),
                {
                  id: 'temp-' + Date.now(),
                  user_id: profile?.id,
                  emoji,
                  type: 'like'
                }
              ]
            };
          }
        });
      });
      
      return { previousPosts };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousPosts) {
        queryClient.setQueryData(["posts", id], context.previousPosts);
      }
    },
    onSettled: () => {
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
  const canPost = isOwner || (community?.allow_member_posts && membership);

  // Organize comments into tree structure (parent-child)
  const organizeComments = (comments: any[]) => {
    const commentMap = new Map();
    const rootComments: any[] = [];

    comments.forEach((comment) => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    comments.forEach((comment) => {
      if (comment.parent_id) {
        const parent = commentMap.get(comment.parent_id);
        if (parent) {
          parent.replies.push(commentMap.get(comment.id));
        }
      } else {
        rootComments.push(commentMap.get(comment.id));
      }
    });

    return rootComments;
  };

  // Calculate media stats
  const mediaStats = posts?.reduce((acc: any, post: any) => {
    if (post.media_urls && post.media_urls.length > 0) {
      post.media_urls.forEach((url: string) => {
        if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          acc.photos++;
        } else if (url.match(/\.(mp4|webm|mov)$/i)) {
          acc.videos++;
        } else if (url.match(/\.(mp3|wav|ogg)$/i)) {
          acc.audio++;
        } else {
          acc.files++;
        }
      });
    }
    return acc;
  }, { photos: 0, videos: 0, files: 0, audio: 0 }) || { photos: 0, videos: 0, files: 0, audio: 0 };

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
        <div className="flex flex-col items-center justify-center h-screen p-6">
          <Avatar className="h-32 w-32 mb-6 border-4 border-primary/20 ring-4 ring-primary/10">
            <AvatarImage src={community.avatar_url || ""} />
            <AvatarFallback className="text-4xl bg-primary/20 text-primary">{community.name[0]}</AvatarFallback>
          </Avatar>
          <h1 className="text-4xl font-bold mb-4 text-card-foreground">{community.name}</h1>
          <p className="text-muted-foreground mb-8 text-center max-w-md">{community.description}</p>
          
          {community.pricing_type === "free" ? (
            <Button 
              size="lg" 
              onClick={() => joinMutation.mutate()}
              className="bg-primary hover:bg-primary/90 shadow-glow rounded-2xl px-8 py-6"
            >
              Join Community
            </Button>
          ) : (
            <Button 
              size="lg" 
              onClick={() => navigate(`/community-pricing/${id}`)}
              className="bg-primary hover:bg-primary/90 shadow-glow rounded-2xl px-8 py-6"
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
      <div className="flex h-screen">
        {/* Main Chat Area */}
        <div className={`flex flex-col transition-all relative ${showGroupInfo ? 'flex-1' : 'w-full'}`}>
          {/* Header */}
          <header className="sticky top-0 z-10 bg-card/98 backdrop-blur-md border-b border-border/30 px-6 py-4 shadow-card">
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
                <h1 className="text-lg font-semibold text-card-foreground">{community.name}</h1>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{members?.length || 0} members</span>
                  </div>
                  {membership && (
                    <Badge variant="secondary" className="text-xs bg-primary/20 text-primary border-primary/30">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Joined
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search posts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-10 bg-muted/40 border-border/40 h-9"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 hover:bg-accent rounded-full p-1"
                    >
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* Messages */}
          <div 
            ref={chatContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-transparent to-background/5 relative"
          >
            {filteredPosts?.map((post: any) => {
              const postComments = commentsData?.filter((c: any) => c.post_id === post.id) || [];
              const userReaction = post.reactions?.find((r: any) => r.user_id === profile?.id);
              const isCollapsed = collapsedPosts[post.id];

              return (
                <Collapsible
                  key={post.id}
                  open={!isCollapsed}
                  onOpenChange={() => setCollapsedPosts({ ...collapsedPosts, [post.id]: !isCollapsed })}
                  className="flex gap-3 animate-slide-up"
                >
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={post.profiles?.avatar_url} />
                    <AvatarFallback className="bg-primary/10 text-primary">{post.profiles?.username?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-70 transition-opacity">
                        <span className="font-semibold text-base text-card-foreground">{post.profiles?.username}</span>
                        {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                      </CollapsibleTrigger>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                      </span>
                      {(post.author_id === profile?.id || isOwner) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 ml-auto hover:bg-destructive/10 hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this post?")) {
                              deletePostMutation.mutate(post.id);
                            }
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <CollapsibleContent className="space-y-2">
                      {/* Text Content - Only show if there's actual content */}
                      {post.content && post.content.trim() && (
                        <div className="inline-block bg-card rounded-2xl px-3 py-2 border border-border/40 shadow-sm max-w-[85%] md:max-w-[75%]">
                          <p className="text-base text-card-foreground whitespace-pre-wrap break-words leading-relaxed">{post.content}</p>
                        </div>
                      )}
                      
                      {/* Media Content */}
                      {post.media_urls && post.media_urls.length > 0 && (
                        <div className="space-y-2">
                          {post.media_urls.map((url: string, idx: number) => {
                            const isAudio = url.includes('voice-') || url.endsWith('.webm') || url.endsWith('.mp3') || url.endsWith('.wav');
                            const isVideo = url.endsWith('.mp4') || url.endsWith('.mov');
                            
                            if (isAudio) {
                              return <AudioPlayer key={idx} audioUrl={url} />;
                            }
                            
                            if (isVideo) {
                              return (
                                <div key={idx} className="inline-block bg-card rounded-2xl p-2 border border-border/40 shadow-sm max-w-md">
                                  <video
                                    src={url}
                                    controls
                                    className="rounded-xl w-full max-h-80 object-cover"
                                  />
                                </div>
                              );
                            }
                            
                            return (
                              <div key={idx} className="inline-block bg-card rounded-2xl p-2 border border-border/40 shadow-sm">
                                <img
                                  src={url}
                                  alt="Post media"
                                  className="rounded-xl max-h-80 object-cover"
                                  loading="lazy"
                                  decoding="async"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {/* Like Button */}
                        <button
                          onClick={() => toggleReactionMutation.mutate({ postId: post.id, emoji: "❤️" })}
                          className={`relative flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all overflow-hidden ${
                            userReaction?.emoji === "❤️" 
                              ? "bg-primary/15 text-primary border border-primary/30" 
                              : "bg-muted/60 hover:bg-muted text-muted-foreground border border-border/30"
                          } ${animatingPost === post.id ? 'animate-bounce-scale' : ''}`}
                        >
                          <Heart className={`h-4 w-4 transition-all ${userReaction?.emoji === "❤️" ? "fill-primary scale-110" : ""}`} />
                          <span>{post.reactions?.filter((r: any) => r.emoji === "❤️").length || 0}</span>
                          {animatingPost === post.id && (
                            <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <Heart className="h-6 w-6 text-primary fill-primary animate-reaction-burst" />
                            </span>
                          )}
                        </button>
                        
                        {/* Comment Button - Always show */}
                        <button
                          onClick={() => setShowComments({ ...showComments, [post.id]: !showComments[post.id] })}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-muted/60 hover:bg-muted text-muted-foreground border border-border/30 transition-all hover:scale-105"
                        >
                          <MessageCircle className="h-4 w-4" />
                          <span>{postComments.length}</span>
                        </button>
                      </div>

                      {/* Comments */}
                      {showComments[post.id] && (
                        <div className="mt-3 space-y-3 animate-fade-in">
                          {organizeComments(postComments).map((comment: any) => (
                            <div key={comment.id} className="ml-4 border-l-2 border-primary/20 pl-4">
                              <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-primary text-sm">{comment.profiles?.username}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                                      </span>
                                      {comment.author_id === profile?.id && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-5 w-5 hover:bg-destructive/10 hover:text-destructive"
                                          onClick={() => {
                                            if (confirm("Delete this comment?")) {
                                              deleteCommentMutation.mutate(comment.id);
                                            }
                                          }}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                    <p className="text-sm text-card-foreground/90 mt-1">{comment.content}</p>
                                    <div className="flex items-center gap-3 mt-2">
                                      <button
                                        onClick={() => toggleCommentReactionMutation.mutate({ commentId: comment.id, emoji: "❤️" })}
                                        className={`flex items-center gap-1 text-xs ${
                                          comment.comment_reactions?.find((r: any) => r.user_id === profile?.id && r.emoji === "❤️")
                                            ? "text-primary font-medium"
                                            : "text-muted-foreground hover:text-primary"
                                        } transition-colors`}
                                      >
                                        <Heart className={`h-3 w-3 ${
                                          comment.comment_reactions?.find((r: any) => r.user_id === profile?.id && r.emoji === "❤️")
                                            ? "fill-primary"
                                            : ""
                                        }`} />
                                        <span>{comment.comment_reactions?.filter((r: any) => r.emoji === "❤️").length || 0}</span>
                                      </button>
                                      <button
                                        onClick={() => setReplyingTo({ ...replyingTo, [post.id]: comment.id })}
                                        className="text-xs text-muted-foreground hover:text-primary transition-colors"
                                      >
                                        Reply
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* Nested Replies */}
                                {comment.replies && comment.replies.length > 0 && (
                                  <div className="ml-4 space-y-2 border-l-2 border-primary/10 pl-4 mt-2">
                                    {comment.replies.map((reply: any) => (
                                      <div key={reply.id} className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold text-primary text-xs">{reply.profiles?.username}</span>
                                          <span className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                                          </span>
                                          {reply.author_id === profile?.id && (
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-4 w-4 hover:bg-destructive/10 hover:text-destructive"
                                              onClick={() => {
                                                if (confirm("Delete this reply?")) {
                                                  deleteCommentMutation.mutate(reply.id);
                                                }
                                              }}
                                            >
                                              <X className="h-2 w-2" />
                                            </Button>
                                          )}
                                        </div>
                                        <p className="text-xs text-card-foreground/80">{reply.content}</p>
                                        <button
                                          onClick={() => toggleCommentReactionMutation.mutate({ commentId: reply.id, emoji: "❤️" })}
                                          className={`flex items-center gap-1 text-xs ${
                                            reply.comment_reactions?.find((r: any) => r.user_id === profile?.id && r.emoji === "❤️")
                                              ? "text-primary font-medium"
                                              : "text-muted-foreground hover:text-primary"
                                          } transition-colors`}
                                        >
                                          <Heart className={`h-2.5 w-2.5 ${
                                            reply.comment_reactions?.find((r: any) => r.user_id === profile?.id && r.emoji === "❤️")
                                              ? "fill-primary"
                                              : ""
                                          }`} />
                                          <span>{reply.comment_reactions?.filter((r: any) => r.emoji === "❤️").length || 0}</span>
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Reply Input */}
                                {replyingTo[post.id] === comment.id && (
                                  <div className="mt-2 flex gap-2 items-center">
                                    <Input
                                      value={commentContent[`${post.id}-${comment.id}`] || ""}
                                      onChange={(e) => setCommentContent({ ...commentContent, [`${post.id}-${comment.id}`]: e.target.value })}
                                      placeholder={`Reply to ${comment.profiles?.username}...`}
                                      className="text-xs h-8 bg-card border-border/50 rounded-full px-3"
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && commentContent[`${post.id}-${comment.id}`]?.trim()) {
                                          createCommentMutation.mutate({
                                            postId: post.id,
                                            content: commentContent[`${post.id}-${comment.id}`],
                                            parentId: comment.id,
                                          });
                                        }
                                      }}
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => setReplyingTo({ ...replyingTo, [post.id]: null })}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Comment Input - Only show when comments section is open */}
                      {showComments[post.id] && (
                        <div className="mt-2 flex gap-2">
                          <Input
                            value={commentContent[post.id] || ""}
                            onChange={(e) => setCommentContent({ ...commentContent, [post.id]: e.target.value })}
                            placeholder="Write a comment..."
                            className="text-sm h-9 bg-card border-border/50 rounded-full px-4"
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
                      )}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Scroll to Bottom Button */}
          {showScrollButton && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-24 right-8 z-20 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full p-3 shadow-lg transition-all hover:scale-105"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          )}

          {/* Input Area - For Creator or Members with posting permission */}
          {canPost && (
            <div className="border-t border-border/30 bg-card/98 backdrop-blur-md p-3 shadow-card">
              <MediaPreview files={mediaFiles} onRemove={handleRemoveFile} />
              <div className="flex gap-2 items-center">
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
                  className="hover:bg-accent rounded-full flex-shrink-0 h-9 w-9"
                >
                  <ImageIcon className="h-4 w-4" />
                </Button>
                <VoiceRecorder
                  onSend={(blob) => sendVoiceMessageMutation.mutate(blob)}
                  onCancel={() => {}}
                />
                <div className="flex-1 bg-muted/40 rounded-full px-4 py-1 border border-border/40 flex items-center gap-2">
                  <input
                    type="text"
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-transparent text-sm focus:outline-none"
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
                    size="icon"
                    className="bg-primary hover:bg-primary/90 shadow-sm rounded-full h-8 w-8 flex-shrink-0"
                  >
                    {uploading ? (
                      <span className="animate-pulse text-xs">...</span>
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Group Info Sidebar */}
        {showGroupInfo && (
          <div className="w-80 border-l border-border/30 bg-card flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border/30 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-card-foreground">Group Info</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowGroupInfo(false)} className="rounded-full">
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {/* Files Section */}
              <Collapsible open={filesExpanded} onOpenChange={setFilesExpanded} className="border-b border-border/30">
                <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-accent/50 transition-colors">
                  <span className="font-semibold text-card-foreground">Files</span>
                  {filesExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 pb-4 space-y-3">
                  {/* Photos Preview */}
                  {mediaStats.photos > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{mediaStats.photos} photos</span>
                        </div>
                        <ChevronDown className="h-4 w-4" />
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {posts?.slice(0, 6).map((post: any) => 
                          post.media_urls?.slice(0, 2).map((url: string, idx: number) => 
                            url.match(/\.(jpg|jpeg|png|gif|webp)$/i) && (
                              <img key={`${post.id}-${idx}`} src={url} className="w-full h-20 object-cover rounded-lg" />
                            )
                          )
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Videos */}
                  {mediaStats.videos > 0 && (
                    <div className="flex items-center justify-between text-sm py-2 hover:bg-accent/30 rounded-lg px-2 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <VideoIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{mediaStats.videos} videos</span>
                      </div>
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  )}
                  
                  {/* Files */}
                  {mediaStats.files > 0 && (
                    <div className="flex items-center justify-between text-sm py-2 hover:bg-accent/30 rounded-lg px-2 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{mediaStats.files} files</span>
                      </div>
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  )}
                  
                  {/* Audio */}
                  {mediaStats.audio > 0 && (
                    <div className="flex items-center justify-between text-sm py-2 hover:bg-accent/30 rounded-lg px-2 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Music className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{mediaStats.audio} audio files</span>
                      </div>
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Members Section */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-card-foreground">{members?.length || 0} members</h3>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {members?.map((member: any) => (
                    <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                      <Avatar className="h-8 w-8 border border-border/20">
                        <AvatarImage src={member.profiles?.avatar_url || ""} />
                        <AvatarFallback className="bg-primary/20 text-primary text-xs">
                          {member.profiles?.username?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-card-foreground truncate">
                          {member.profiles?.username || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {member.user_id === community?.owner_id ? "Community Creator" : "Member"}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!members || members.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">No members yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
