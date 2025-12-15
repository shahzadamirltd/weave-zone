import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChatLayout } from "@/components/layout/ChatLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, DollarSign, Users, TrendingUp, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PayoutRequestDialog } from "@/components/creator/PayoutRequestDialog";
import { AnalyticsDashboard } from "@/components/creator/AnalyticsDashboard";

const CreatorDashboard = () => {
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: communities, isLoading: communitiesLoading } = useQuery({
    queryKey: ["creator-communities"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("communities")
        .select("*")
        .eq("owner_id", user?.id);
      
      if (error) throw error;
      return data;
    },
  });

  const { data: earnings, isLoading: earningsLoading } = useQuery({
    queryKey: ["creator-earnings"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get all payments (subscriptions, one-time, and tips)
      const { data: payments } = await supabase
        .from("payments")
        .select("creator_earnings, community_id, payment_type, communities!inner(owner_id)")
        .eq("communities.owner_id", user?.id)
        .eq("status", "completed");

      const { data: payouts } = await supabase
        .from("payouts")
        .select("amount, status")
        .eq("creator_id", user?.id);

      const totalEarnings = payments?.reduce((sum, p) => sum + parseFloat(String(p.creator_earnings)), 0) || 0;
      const tipEarnings = payments?.filter(p => p.payment_type === "one_time")
        .reduce((sum, p) => sum + parseFloat(String(p.creator_earnings)), 0) || 0;
      const completedPayouts = payouts?.filter(p => p.status === "completed")
        .reduce((sum, p) => sum + parseFloat(String(p.amount)), 0) || 0;
      const pendingPayouts = payouts?.filter(p => p.status === "pending")
        .reduce((sum, p) => sum + parseFloat(String(p.amount)), 0) || 0;

      return {
        total: totalEarnings,
        tips: tipEarnings,
        paid: completedPayouts,
        pending: pendingPayouts,
        available: totalEarnings - completedPayouts - pendingPayouts,
      };
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["creator-stats"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const communityIds = communities?.map(c => c.id) || [];
      
      const { count: totalMembers } = await supabase
        .from("memberships")
        .select("*", { count: "exact", head: true })
        .in("community_id", communityIds);

      const { count: totalPayments } = await supabase
        .from("payments")
        .select("*", { count: "exact", head: true })
        .in("community_id", communityIds)
        .eq("status", "completed");

      return {
        totalMembers: totalMembers || 0,
        totalPayments: totalPayments || 0,
      };
    },
    enabled: !!communities,
  });

  if (communitiesLoading || earningsLoading) {
    return (
      <ChatLayout>
        <div className="flex items-center justify-center h-full bg-chat-bg">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ChatLayout>
    );
  }

  return (
    <ChatLayout>
      <div className="flex-1 overflow-y-auto bg-chat-bg">
        <div className="max-w-4xl mx-auto p-6 lg:p-8 pt-16 lg:pt-8 space-y-6">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-foreground">Creator Dashboard</h1>
            <Button onClick={() => navigate("/create-community")}>
              Create New Community
            </Button>
          </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${earnings?.available?.toFixed(2) || "0.00"}</div>
              <p className="text-xs text-muted-foreground">
                Total earned: ${earnings?.total?.toFixed(2) || "0.00"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tips Received</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                ${earnings?.tips?.toFixed(2) || "0.00"}
              </div>
              <p className="text-xs text-muted-foreground">
                From supporters
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalMembers || 0}</div>
              <p className="text-xs text-muted-foreground">
                Across {communities?.length || 0} communities
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalPayments || 0}</div>
              <p className="text-xs text-muted-foreground">
                Pending: ${earnings?.pending?.toFixed(2) || "0.00"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Withdrawal</CardTitle>
              <PayoutRequestDialog
                availableBalance={earnings?.available || 0}
                communities={communities || []}
              />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Request a payout when you have earnings available. Our team will process it within 3-5 business days.
            </p>
          </CardContent>
        </Card>

        <AnalyticsDashboard communityIds={communities?.map(c => c.id) || []} />

        <Card>
          <CardHeader>
            <CardTitle>Your Communities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {communities?.map((community) => (
                <div
                  key={community.id}
                  className="flex justify-between items-center p-4 border rounded-lg hover:bg-accent cursor-pointer"
                  onClick={() => navigate(`/community/${community.id}`)}
                >
                  <div>
                    <h3 className="font-semibold">{community.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {community.pricing_type === "free" ? "Free" : `$${community.price_amount}`}
                      {community.pricing_type === "recurring_monthly" && "/month"}
                    </p>
                  </div>
                  <Button variant="outline" onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/community/${community.id}/settings`);
                  }}>
                    Manage
                  </Button>
                </div>
              ))}
              {!communities?.length && (
                <p className="text-center text-muted-foreground">
                  No communities yet. Create your first one to get started!
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </ChatLayout>
  );
};

export default CreatorDashboard;
