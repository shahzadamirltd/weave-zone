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
      className="group cursor-pointer border border-border rounded-lg hover:border-foreground/20 transition-all bg-card p-6" 
      onClick={() => navigate(`/community/${community.id}`)}
    >
      <div className="flex gap-4 items-start">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-lg tracking-tight line-clamp-1">{community.name}</h3>
            {community.is_private && <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {community.description || "No description"}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{community.memberships?.[0]?.count || 0} members</span>
          </div>
        </div>
        {showJoinButton && (
          <Button 
            size="sm" 
            variant={community.isJoined ? "secondary" : "default"}
            className="h-9 px-4 text-xs shrink-0"
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
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Communities</h1>
          <p className="text-muted-foreground">Discover and join communities</p>
        </div>
        
        <Tabs defaultValue="created" className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-11 bg-muted/30 p-1">
            <TabsTrigger value="created" className="text-sm font-medium data-[state=active]:bg-background">
              Created
            </TabsTrigger>
            <TabsTrigger value="joined" className="text-sm font-medium data-[state=active]:bg-background">
              Joined
            </TabsTrigger>
            <TabsTrigger value="discover" className="text-sm font-medium data-[state=active]:bg-background">
              Discover
            </TabsTrigger>
          </TabsList>

          <TabsContent value="created" className="space-y-4 mt-6">
            {createdCommunities && createdCommunities.length > 0 ? (
              <div className="space-y-4">
                {createdCommunities.map((community: any) => (
                  <CommunityCard key={community.id} community={community} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-lg">
                <Users className="h-12 w-12 text-muted-foreground/20 mb-3" />
                <p className="text-center text-muted-foreground text-sm">
                  No communities yet
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="joined" className="space-y-4 mt-6">
            {joinedCommunities && joinedCommunities.length > 0 ? (
              <div className="space-y-4">
                {joinedCommunities.map((community: any) => (
                  <CommunityCard key={community.id} community={community} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-lg">
                <Users className="h-12 w-12 text-muted-foreground/20 mb-3" />
                <p className="text-center text-muted-foreground text-sm">
                  No communities joined yet
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="discover" className="space-y-4 mt-6">
            {allCommunities && allCommunities.length > 0 ? (
              <div className="space-y-4">
                {allCommunities.map((community: any) => (
                  <CommunityCard key={community.id} community={community} showJoinButton />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-lg">
                <Users className="h-12 w-12 text-muted-foreground/20 mb-3" />
                <p className="text-center text-muted-foreground text-sm">
                  No communities available
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
