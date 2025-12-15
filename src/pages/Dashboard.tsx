import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChatLayout } from "@/components/layout/ChatLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Share2, Check, Settings, Users, MessageCircle, ChevronRight, Crown, Plus, DollarSign, Radio, TrendingUp, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { cn } from "@/lib/utils";

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

  // Get earnings
  const { data: earnings } = useQuery({
    queryKey: ["creator-earnings", profile?.id],
    queryFn: async () => {
      if (!profile) return { today: 0, total: 0 };
      
      const { data } = await supabase
        .from("payments")
        .select("creator_earnings, created_at")
        .eq("status", "completed");
      
      const today = new Date().toDateString();
      const todayEarnings = data?.filter(p => new Date(p.created_at).toDateString() === today)
        .reduce((sum, p) => sum + (p.creator_earnings || 0), 0) || 0;
      const totalEarnings = data?.reduce((sum, p) => sum + (p.creator_earnings || 0), 0) || 0;
      
      return { today: todayEarnings / 100, total: totalEarnings / 100 };
    },
    enabled: !!profile,
  });

  // Get unread notifications
  const { data: unreadCount } = useQuery({
    queryKey: ["unread-notifications", profile?.id],
    queryFn: async () => {
      if (!profile) return 0;
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("is_read", false);
      return count || 0;
    },
    enabled: !!profile,
  });

  const isLoading = loadingJoined || loadingOwned;
  const liveCommunities = (ownedCommunities?.length || 0) + (joinedCommunities?.length || 0);

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
        className="flex items-center gap-3 p-3 bg-card rounded-xl hover:shadow-elegant transition-all text-left border border-border/50 w-full sm:w-auto sm:min-w-[280px] sm:max-w-[320px]"
      >
        <div className="relative">
          <Avatar className="h-12 w-12 flex-shrink-0">
            <AvatarImage src={community.avatar_url || ""} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {community.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {/* Random live indicator for demo */}
          {Math.random() > 0.6 && (
            <span className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-like rounded-full border-2 border-card animate-pulse" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-semibold text-foreground truncate text-sm">{community.name}</h3>
            {isOwner && <Crown className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 font-medium">
              <Users className="h-3 w-3" />
              {memberCount}
            </span>
            <span className="flex items-center gap-1">
              {community.pricing_type === "free" ? "Free" : `$${(community.price_amount / 100).toFixed(0)}`}
            </span>
            {!isOwner && ownerProfile && (
              <span className="truncate">by {ownerProfile.username}</span>
            )}
          </div>
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </button>
    );
  };

  return (
    <ChatLayout>
      <div className="flex-1 flex flex-col bg-chat-bg">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-4 lg:p-6">
            {/* Stats Cards - Side by Side */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
              <div className="bg-card rounded-xl p-3 border border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-7 w-7 rounded-lg bg-success/10 flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-success" />
                  </div>
                </div>
                <p className="text-lg font-bold text-foreground">${earnings?.today.toFixed(2) || "0.00"}</p>
                <p className="text-[10px] text-muted-foreground">Today's earnings</p>
              </div>
              
              <div className="bg-card rounded-xl p-3 border border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Radio className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <p className="text-lg font-bold text-foreground">{liveCommunities}</p>
                <p className="text-[10px] text-muted-foreground">Communities</p>
              </div>
              
              <div className="bg-card rounded-xl p-3 border border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-7 w-7 rounded-lg bg-like/10 flex items-center justify-center relative">
                    <Bell className="h-4 w-4 text-like" />
                    {(unreadCount || 0) > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 bg-like text-[9px] text-white rounded-full flex items-center justify-center font-bold">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-lg font-bold text-foreground">{unreadCount || 0}</p>
                <p className="text-[10px] text-muted-foreground">New messages</p>
              </div>
              
              <div className="bg-card rounded-xl p-3 border border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-amber-500" />
                  </div>
                </div>
                <p className="text-lg font-bold text-foreground">${earnings?.total.toFixed(0) || "0"}</p>
                <p className="text-[10px] text-muted-foreground">Total earned</p>
              </div>
            </div>

            {/* Quick Actions - Side by Side */}
            <div className="flex flex-wrap gap-2 mb-6">
              <Button
                onClick={() => navigate("/create-community")}
                className="rounded-xl h-9 text-sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Create
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/creator-dashboard")}
                className="rounded-xl h-9 text-sm"
              >
                <TrendingUp className="h-4 w-4 mr-1" />
                Analytics
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/settings")}
                className="rounded-xl h-9 text-sm"
              >
                <Settings className="h-4 w-4 mr-1" />
                Settings
              </Button>
            </div>

            {/* Communities */}
            <div className="space-y-4">
              {isLoading ? (
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 w-72 bg-card rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                  {/* Joined Communities (First) */}
                  {joinedCommunities && joinedCommunities.length > 0 && (
                    <div>
                      <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        Joined Communities
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        {joinedCommunities.map((community: any) => (
                          <CommunityCard key={community.id} community={community} isOwner={false} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Owned Communities (Second) */}
                  {ownedCommunities && ownedCommunities.length > 0 && (
                    <div>
                      <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        Your Communities
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        {ownedCommunities.map((community: any) => (
                          <CommunityCard key={community.id} community={community} isOwner={true} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty State */}
                  {(!joinedCommunities || joinedCommunities.length === 0) && 
                   (!ownedCommunities || ownedCommunities.length === 0) && (
                    <div className="text-center py-12 bg-card rounded-xl border border-dashed border-border">
                      <MessageCircle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                      <h3 className="font-medium text-foreground mb-1 text-sm">No communities yet</h3>
                      <p className="text-xs text-muted-foreground mb-4">
                        Create your first community to get started
                      </p>
                      <Button onClick={() => navigate("/create-community")} size="sm">
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
