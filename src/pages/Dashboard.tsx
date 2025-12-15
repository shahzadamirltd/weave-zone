import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChatLayout } from "@/components/layout/ChatLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Share2, Check, Settings, Users, MessageCircle, ChevronRight, Crown, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      return data;
    },
  });

  // Get joined communities (not owner)
  const { data: joinedCommunities, isLoading: loadingJoined } = useQuery({
    queryKey: ["joined-communities", profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      
      const { data: memberships } = await supabase
        .from("memberships")
        .select(`community_id, communities(*, profiles(*), memberships(count))`)
        .eq("user_id", profile.id)
        .neq("role", "owner");

      return memberships?.map(m => (m as any).communities).filter(Boolean) || [];
    },
    enabled: !!profile,
  });

  // Get owned communities
  const { data: ownedCommunities, isLoading: loadingOwned } = useQuery({
    queryKey: ["owned-communities", profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      
      const { data } = await supabase
        .from("communities")
        .select("*, profiles(*), memberships(count)")
        .eq("owner_id", profile.id)
        .order("created_at", { ascending: false });

      return data || [];
    },
    enabled: !!profile,
  });

  const isLoading = loadingJoined || loadingOwned;

  const CommunityCard = ({ community, isOwner }: { community: any; isOwner: boolean }) => {
    const [copied, setCopied] = useState(false);
    const memberCount = community.memberships?.[0]?.count || 0;
    const ownerProfile = community.profiles;

    const handleShare = (e: React.MouseEvent) => {
      e.stopPropagation();
      const url = `${window.location.origin}/community/${community.id}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Link copied!" });
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <button
        onClick={() => navigate(`/community/${community.id}`)}
        className="w-full flex items-center gap-4 p-4 bg-card rounded-xl hover:shadow-elegant transition-all text-left border border-border/50"
      >
        <Avatar className="h-14 w-14 flex-shrink-0">
          <AvatarImage src={community.avatar_url || ""} />
          <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
            {community.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">{community.name}</h3>
            {isOwner && (
              <Crown className="h-4 w-4 text-primary flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {memberCount}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" />
              {community.pricing_type === "free" ? "Free" : `$${(community.price_amount / 100).toFixed(0)}`}
            </span>
            {!isOwner && ownerProfile && (
              <span className="text-xs">by {ownerProfile.username}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOwner && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/community/${community.id}/edit`);
              }}
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={handleShare}
          >
            {copied ? (
              <Check className="h-4 w-4 text-success" />
            ) : (
              <Share2 className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </button>
    );
  };

  return (
    <ChatLayout>
      {/* Welcome Section */}
      <div className="flex-1 flex flex-col bg-chat-bg">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-6 lg:p-8">
            {/* Header */}
            <div className="mb-8 pt-12 lg:pt-0">
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Welcome back{profile?.username ? `, ${profile.username}` : ""}!
              </h1>
              <p className="text-muted-foreground">
                Select a community to start chatting or create a new one.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-3 mb-8">
              <Button
                onClick={() => navigate("/create-community")}
                className="rounded-xl"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Community
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/settings")}
                className="rounded-xl"
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>

            {/* Communities */}
            <div className="space-y-6">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-card rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                  {/* Joined Communities (First) */}
                  {joinedCommunities && joinedCommunities.length > 0 && (
                    <div>
                      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                        Joined Communities
                      </h2>
                      <div className="space-y-3">
                        {joinedCommunities.map((community: any) => (
                          <CommunityCard key={community.id} community={community} isOwner={false} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Owned Communities (Second) */}
                  {ownedCommunities && ownedCommunities.length > 0 && (
                    <div>
                      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                        Your Communities
                      </h2>
                      <div className="space-y-3">
                        {ownedCommunities.map((community: any) => (
                          <CommunityCard key={community.id} community={community} isOwner={true} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty State */}
                  {(!joinedCommunities || joinedCommunities.length === 0) && 
                   (!ownedCommunities || ownedCommunities.length === 0) && (
                    <div className="text-center py-16 bg-card rounded-xl border border-dashed border-border">
                      <MessageCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                      <h3 className="font-medium text-foreground mb-2">No communities yet</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Create your first community to get started
                      </p>
                      <Button onClick={() => navigate("/create-community")}>
                        Create Community
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </ChatLayout>
  );
}