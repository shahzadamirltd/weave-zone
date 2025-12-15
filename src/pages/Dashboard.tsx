import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChatLayout } from "@/components/layout/ChatLayout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, MessageCircle, ChevronRight, Crown, Plus, DollarSign, Radio, TrendingUp, Bell, Settings, CreditCard, HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
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
    const memberCount = community.memberships?.[0]?.count || 0;
    const ownerProfile = community.profiles;

    return (
      <button
        onClick={() => navigate(`/community/${community.id}`)}
        className="flex items-center gap-3 p-4 bg-card rounded-xl hover:shadow-md transition-all text-left border border-border/50 w-full"
      >
        <Avatar className="h-14 w-14 flex-shrink-0">
          <AvatarImage src={community.avatar_url || ""} />
          <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-lg">
            {community.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">{community.name}</h3>
            {isOwner && <Crown className="h-4 w-4 text-primary flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {memberCount} members
            </span>
            <span>
              {community.pricing_type === "free" ? "Free" : `$${(community.price_amount / 100).toFixed(0)}/mo`}
            </span>
          </div>
        </div>

        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      </button>
    );
  };

  const QuickAction = ({ icon: Icon, label, onClick, variant = "default" }: any) => (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 p-4 rounded-xl transition-all",
        variant === "primary" 
          ? "bg-primary text-primary-foreground hover:bg-primary/90" 
          : "bg-card border border-border/50 hover:bg-muted/50"
      )}
    >
      <Icon className="h-6 w-6" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );

  return (
    <ChatLayout>
      <div className="flex-1 flex flex-col bg-chat-bg overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full p-4 lg:p-6">
          {/* Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="bg-card rounded-xl p-4 border border-border/50">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-success" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">${earnings?.today.toFixed(2) || "0.00"}</p>
              <p className="text-sm text-muted-foreground">Today's earnings</p>
            </div>
            
            <div className="bg-card rounded-xl p-4 border border-border/50">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Radio className="h-5 w-5 text-primary" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{liveCommunities}</p>
              <p className="text-sm text-muted-foreground">Active communities</p>
            </div>
            
            <div className="bg-card rounded-xl p-4 border border-border/50">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-like/10 flex items-center justify-center relative">
                  <Bell className="h-5 w-5 text-like" />
                  {(unreadCount || 0) > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-like text-xs text-white rounded-full flex items-center justify-center font-bold">
                      {unreadCount}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{unreadCount || 0}</p>
              <p className="text-sm text-muted-foreground">New notifications</p>
            </div>
            
            <div className="bg-card rounded-xl p-4 border border-border/50">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-amber-500" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">${earnings?.total.toFixed(0) || "0"}</p>
              <p className="text-sm text-muted-foreground">Total earned</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <QuickAction icon={Plus} label="Create" onClick={() => navigate("/create-community")} variant="primary" />
            <QuickAction icon={TrendingUp} label="Analytics" onClick={() => navigate("/creator-dashboard")} />
            <QuickAction icon={CreditCard} label="Payments" onClick={() => navigate("/payments")} />
            <QuickAction icon={Settings} label="Settings" onClick={() => navigate("/settings")} />
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
                {/* Joined Communities */}
                {joinedCommunities && joinedCommunities.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      Joined Communities
                    </h2>
                    <div className="space-y-2">
                      {joinedCommunities.map((community: any) => (
                        <CommunityCard key={community.id} community={community} isOwner={false} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Owned Communities */}
                {ownedCommunities && ownedCommunities.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      Your Communities
                    </h2>
                    <div className="space-y-2">
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
                    <MessageCircle className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
                    <h3 className="font-semibold text-foreground text-lg mb-2">No communities yet</h3>
                    <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                      Create your first community and start building your audience
                    </p>
                    <Button onClick={() => navigate("/create-community")} size="lg">
                      <Plus className="h-5 w-5 mr-2" />
                      Create Community
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </ChatLayout>
  );
}
