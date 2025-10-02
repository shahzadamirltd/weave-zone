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
    <Card 
      className="group cursor-pointer border-none shadow-sm hover:shadow-md transition-all bg-card" 
      onClick={() => navigate(`/community/${community.id}`)}
    >
      <CardContent className="p-4">
        <div className="flex gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base line-clamp-1">{community.name}</h3>
              {community.is_private && <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {community.description || "No description"}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>{community.memberships?.[0]?.count || 0} members</span>
            </div>
          </div>
          {showJoinButton && (
            <Button 
              size="sm" 
              variant="outline"
              className="h-8 px-4 text-xs"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              Join
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 space-y-4">
        <Tabs defaultValue="created" className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-12 bg-muted/50">
            <TabsTrigger value="created" className="text-xs">
              Created
            </TabsTrigger>
            <TabsTrigger value="joined" className="text-xs">
              Joined
            </TabsTrigger>
            <TabsTrigger value="discover" className="text-xs">
              Discover
            </TabsTrigger>
          </TabsList>

          <TabsContent value="created" className="space-y-3 mt-4">
            {createdCommunities && createdCommunities.length > 0 ? (
              <div className="space-y-3">
                {createdCommunities.map((community: any) => (
                  <CommunityCard key={community.id} community={community} />
                ))}
              </div>
            ) : (
              <Card className="border-none shadow-none">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Users className="h-16 w-16 text-muted-foreground/30 mb-4" />
                  <p className="text-center text-muted-foreground text-sm">
                    No communities yet
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="joined" className="space-y-3 mt-4">
            {joinedCommunities && joinedCommunities.length > 0 ? (
              <div className="space-y-3">
                {joinedCommunities.map((community: any) => (
                  <CommunityCard key={community.id} community={community} />
                ))}
              </div>
            ) : (
              <Card className="border-none shadow-none">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Users className="h-16 w-16 text-muted-foreground/30 mb-4" />
                  <p className="text-center text-muted-foreground text-sm">
                    No communities joined yet
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="discover" className="space-y-3 mt-4">
            {allCommunities && allCommunities.length > 0 ? (
              <div className="space-y-3">
                {allCommunities.map((community: any) => (
                  <CommunityCard key={community.id} community={community} showJoinButton />
                ))}
              </div>
            ) : (
              <Card className="border-none shadow-none">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Users className="h-16 w-16 text-muted-foreground/30 mb-4" />
                  <p className="text-center text-muted-foreground text-sm">
                    No communities available
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
