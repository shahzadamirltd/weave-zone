import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Lock, Globe, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();

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

  const { data: createdCommunities } = useQuery({
    queryKey: ["created-communities"],
    queryFn: async () => {
      if (!profile) return [];

      const { data } = await supabase
        .from("communities")
        .select("*, memberships(count)")
        .eq("owner_id", profile.id)
        .order("created_at", { ascending: false });

      return data || [];
    },
    enabled: !!profile,
  });

  const { data: joinedCommunities } = useQuery({
    queryKey: ["joined-communities"],
    queryFn: async () => {
      if (!profile) return [];

      const { data } = await supabase
        .from("memberships")
        .select("*, communities(*)")
        .eq("user_id", profile.id)
        .neq("role", "owner");

      return data?.map((m: any) => m.communities) || [];
    },
    enabled: !!profile,
  });

  const { data: allCommunities } = useQuery({
    queryKey: ["all-communities", profile?.id],
    queryFn: async () => {
      const { data: communities } = await supabase
        .from("communities")
        .select("*, memberships(count)")
        .eq("is_private", false)
        .order("created_at", { ascending: false });

      if (!profile) return communities || [];

      // Check membership status for each community
      const { data: userMemberships } = await supabase
        .from("memberships")
        .select("community_id")
        .eq("user_id", profile.id);

      const membershipSet = new Set(userMemberships?.map(m => m.community_id) || []);
      
      return (communities || []).map(community => ({
        ...community,
        isJoined: membershipSet.has(community.id)
      }));
    },
    enabled: !!profile,
  });

  const CommunityCard = ({ community, showJoinButton = false }: any) => (
    <div 
      className="group cursor-pointer border-2 border-border/50 rounded-2xl hover:border-foreground/20 transition-all bg-card/50 p-6 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]" 
      onClick={() => navigate(`/community/${community.id}`)}
    >
      <div className="flex gap-4 items-start">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg tracking-tight line-clamp-1">{community.name}</h3>
            {community.is_private && <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {community.description || "No description"}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span className="font-medium">{community.memberships?.[0]?.count || 0} members</span>
          </div>
        </div>
        {showJoinButton && (
          <Button 
            size="sm" 
            variant={community.isJoined ? "secondary" : "default"}
            className="h-10 px-5 text-xs shrink-0 rounded-xl"
            disabled={community.isJoined}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {community.isJoined ? "Joined" : "Join"}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8 animate-fade-in">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">Communities</h1>
          <p className="text-muted-foreground text-base">Discover and join communities that inspire you</p>
        </div>
        
        <Tabs defaultValue="created" className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-12 glass p-1.5 rounded-2xl">
            <TabsTrigger value="created" className="text-sm font-semibold rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
              Created
            </TabsTrigger>
            <TabsTrigger value="joined" className="text-sm font-semibold rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
              Joined
            </TabsTrigger>
            <TabsTrigger value="discover" className="text-sm font-semibold rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
              Discover
            </TabsTrigger>
          </TabsList>

          <TabsContent value="created" className="space-y-4 mt-6 animate-fade-in">
            {createdCommunities && createdCommunities.length > 0 ? (
              <div className="space-y-4">
                {createdCommunities.map((community: any) => (
                  <CommunityCard key={community.id} community={community} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 glass border-2 border-dashed border-border/50 rounded-2xl">
                <Users className="h-16 w-16 text-muted-foreground/20 mb-4" />
                <p className="text-center text-muted-foreground font-medium">
                  No communities yet
                </p>
                <p className="text-center text-muted-foreground/60 text-sm mt-1">
                  Create your first community to get started
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="joined" className="space-y-4 mt-6 animate-fade-in">
            {joinedCommunities && joinedCommunities.length > 0 ? (
              <div className="space-y-4">
                {joinedCommunities.map((community: any) => (
                  <CommunityCard key={community.id} community={community} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 glass border-2 border-dashed border-border/50 rounded-2xl">
                <Users className="h-16 w-16 text-muted-foreground/20 mb-4" />
                <p className="text-center text-muted-foreground font-medium">
                  No communities joined yet
                </p>
                <p className="text-center text-muted-foreground/60 text-sm mt-1">
                  Explore and join communities that interest you
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="discover" className="space-y-4 mt-6 animate-fade-in">
            {allCommunities && allCommunities.length > 0 ? (
              <div className="space-y-4">
                {allCommunities.map((community: any) => (
                  <CommunityCard key={community.id} community={community} showJoinButton />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 glass border-2 border-dashed border-border/50 rounded-2xl">
                <Users className="h-16 w-16 text-muted-foreground/20 mb-4" />
                <p className="text-center text-muted-foreground font-medium">
                  No communities available
                </p>
                <p className="text-center text-muted-foreground/60 text-sm mt-1">
                  Check back soon for new communities
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
