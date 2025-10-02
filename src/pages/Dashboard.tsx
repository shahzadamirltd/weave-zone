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
    queryKey: ["all-communities"],
    queryFn: async () => {
      const { data } = await supabase
        .from("communities")
        .select("*, memberships(count)")
        .eq("is_private", false)
        .order("created_at", { ascending: false });

      return data || [];
    },
  });

  const CommunityCard = ({ community, showJoinButton = false }: any) => (
    <Card className="group hover:shadow-card transition-all cursor-pointer" onClick={() => navigate(`/community/${community.id}`)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="flex items-center gap-2">
              {community.name}
              {community.is_private ? (
                <Lock className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Globe className="h-4 w-4 text-muted-foreground" />
              )}
            </CardTitle>
            <CardDescription className="line-clamp-2">
              {community.description || "No description"}
            </CardDescription>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{community.memberships?.[0]?.count || 0} members</span>
          </div>
          {showJoinButton && (
            <Button size="sm" variant="outline" onClick={(e) => {
              e.stopPropagation();
              // Join functionality will be added
            }}>
              Join
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your communities and discover new ones
          </p>
        </div>

        <Tabs defaultValue="created" className="w-full">
          <TabsList>
            <TabsTrigger value="created">Created ({createdCommunities?.length || 0})</TabsTrigger>
            <TabsTrigger value="joined">Joined ({joinedCommunities?.length || 0})</TabsTrigger>
            <TabsTrigger value="discover">Discover ({allCommunities?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="created" className="space-y-4 mt-6">
            {createdCommunities && createdCommunities.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {createdCommunities.map((community: any) => (
                  <CommunityCard key={community.id} community={community} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-center text-muted-foreground mb-4">
                    You haven't created any communities yet
                  </p>
                  <Button onClick={() => navigate("/create-community")}>
                    Create Your First Community
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="joined" className="space-y-4 mt-6">
            {joinedCommunities && joinedCommunities.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {joinedCommunities.map((community: any) => (
                  <CommunityCard key={community.id} community={community} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-center text-muted-foreground">
                    You haven't joined any communities yet
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="discover" className="space-y-4 mt-6">
            {allCommunities && allCommunities.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {allCommunities.map((community: any) => (
                  <CommunityCard key={community.id} community={community} showJoinButton />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-center text-muted-foreground">
                    No public communities available yet
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
