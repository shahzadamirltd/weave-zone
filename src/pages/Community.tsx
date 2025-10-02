import { useEffect, useState } from "react";
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
import { 
  ArrowLeft, Users, Lock, Globe, MessageSquare, Heart, 
  Sparkles, Send, Image as ImageIcon, Video
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Community() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [postContent, setPostContent] = useState("");
  const [commentContent, setCommentContent] = useState<{ [key: string]: string }>({});

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

  const { data: members } = useQuery({
    queryKey: ["members", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("memberships")
        .select("*, profiles(*)")
        .eq("community_id", id);
      return data || [];
    },
    enabled: !!membership,
  });

  const { data: posts } = useQuery({
    queryKey: ["posts", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select("*, profiles(*), comments(count), reactions(count)")
        .eq("community_id", id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!membership,
  });

  // Set up realtime subscription for posts
  useEffect(() => {
    if (!membership) return;

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
  }, [id, membership, queryClient]);

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Not authenticated");
      const { error } = await supabase.from("memberships").insert({
        community_id: id,
        user_id: profile.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["membership", id, profile?.id] });
      toast({ title: "Success!", description: "Joined community" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createPostMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Not authenticated");
      const { error } = await supabase.from("posts").insert({
        community_id: id,
        author_id: profile.id,
        content: postContent,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setPostContent("");
      queryClient.invalidateQueries({ queryKey: ["posts", id] });
      toast({ title: "Success!", description: "Post created" });
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (!profile) throw new Error("Not authenticated");
      const { error } = await supabase.from("comments").insert({
        post_id: postId,
        author_id: profile.id,
        content: commentContent[postId] || "",
      });
      if (error) throw error;
      return postId;
    },
    onSuccess: (postId) => {
      setCommentContent((prev) => ({ ...prev, [postId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["posts", id] });
      toast({ title: "Success!", description: "Comment added" });
    },
  });

  const toggleReactionMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (!profile) throw new Error("Not authenticated");
      
      // Check if reaction exists
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
      } else {
        const { error } = await supabase.from("reactions").insert({
          post_id: postId,
          user_id: profile.id,
          type: "like",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts", id] });
    },
  });

  if (!community) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </AppLayout>
    );
  }

  if (!membership) {
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
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{community.name}</h1>
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
            <p className="text-muted-foreground mt-1">{community.description}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{members?.length || 0} members</span>
          </div>
        </div>

        {/* Create Post */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Textarea
                placeholder="Share something with the community..."
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                rows={3}
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" disabled>
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" disabled>
                    <Video className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  onClick={() => createPostMutation.mutate()}
                  disabled={!postContent.trim() || createPostMutation.isPending}
                  size="sm"
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                  Post
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Posts Feed */}
        <div className="space-y-4">
          {posts && posts.length > 0 ? (
            posts.map((post: any) => (
              <Card key={post.id} className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <Avatar>
                      <AvatarImage src={post.profiles?.avatar_url} />
                      <AvatarFallback>
                        {post.profiles?.username?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{post.profiles?.username}</span>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2"
                      onClick={() => toggleReactionMutation.mutate(post.id)}
                    >
                      <Heart className="h-4 w-4" />
                      {post.reactions?.[0]?.count || 0}
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <MessageSquare className="h-4 w-4" />
                      {post.comments?.[0]?.count || 0}
                    </Button>
                  </div>

                  <div className="space-y-3 border-t pt-4">
                    <div className="flex gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={profile?.avatar_url} />
                        <AvatarFallback>
                          {profile?.username?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 flex gap-2">
                        <Input
                          placeholder="Add a comment..."
                          value={commentContent[post.id] || ""}
                          onChange={(e) =>
                            setCommentContent((prev) => ({
                              ...prev,
                              [post.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              createCommentMutation.mutate(post.id);
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={() => createCommentMutation.mutate(post.id)}
                          disabled={
                            !commentContent[post.id]?.trim() ||
                            createCommentMutation.isPending
                          }
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-center text-muted-foreground">
                  No posts yet. Be the first to share something!
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
