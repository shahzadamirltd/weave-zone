import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Heart, DollarSign } from "lucide-react";
import { subDays, format } from "date-fns";

interface AnalyticsDashboardProps {
  communityIds: string[];
}

export const AnalyticsDashboard = ({ communityIds }: AnalyticsDashboardProps) => {
  const { data: earningsAnalytics } = useQuery({
    queryKey: ["earnings-analytics", communityIds],
    queryFn: async () => {
      const now = new Date();
      const dayAgo = subDays(now, 1);
      const weekAgo = subDays(now, 7);
      const monthAgo = subDays(now, 30);

      const fetchEarnings = async (startDate: Date) => {
        const { data } = await supabase
          .from("payments")
          .select("creator_earnings")
          .in("community_id", communityIds)
          .eq("status", "completed")
          .gte("created_at", startDate.toISOString());
        
        return data?.reduce((sum, p) => sum + parseFloat(String(p.creator_earnings)), 0) || 0;
      };

      const [lastDay, lastWeek, lastMonth] = await Promise.all([
        fetchEarnings(dayAgo),
        fetchEarnings(weekAgo),
        fetchEarnings(monthAgo),
      ]);

      return { lastDay, lastWeek, lastMonth };
    },
    enabled: communityIds.length > 0,
  });

  const { data: likesAnalytics } = useQuery({
    queryKey: ["likes-analytics", communityIds],
    queryFn: async () => {
      const results = await Promise.all(
        communityIds.map(async (communityId) => {
          const { data: community } = await supabase
            .from("communities")
            .select("name")
            .eq("id", communityId)
            .single();

          const { data: posts } = await supabase
            .from("posts")
            .select("id, reactions(count)")
            .eq("community_id", communityId);

          const totalLikes = posts?.reduce((sum, post: any) => {
            return sum + (post.reactions?.[0]?.count || 0);
          }, 0) || 0;

          return {
            communityId,
            communityName: community?.name || "Unknown",
            totalLikes,
          };
        })
      );

      return results;
    },
    enabled: communityIds.length > 0,
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Analytics</h2>

      <Tabs defaultValue="earnings" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
        </TabsList>

        <TabsContent value="earnings" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Last 24 Hours</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${earningsAnalytics?.lastDay.toFixed(2) || "0.00"}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Last 7 Days</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${earningsAnalytics?.lastWeek.toFixed(2) || "0.00"}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Last 30 Days</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${earningsAnalytics?.lastMonth.toFixed(2) || "0.00"}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Likes by Community</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {likesAnalytics?.map((community) => (
                  <div key={community.communityId} className="flex justify-between items-center">
                    <span className="font-medium">{community.communityName}</span>
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-red-500" />
                      <span className="font-bold">{community.totalLikes}</span>
                    </div>
                  </div>
                ))}
                {(!likesAnalytics || likesAnalytics.length === 0) && (
                  <p className="text-center text-muted-foreground">No data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};