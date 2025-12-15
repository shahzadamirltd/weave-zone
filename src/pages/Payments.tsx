import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChatLayout } from "@/components/layout/ChatLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { DollarSign, TrendingUp, Calendar } from "lucide-react";

export default function Payments() {
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

  const { data: payments } = useQuery({
    queryKey: ["my-payments"],
    queryFn: async () => {
      if (!profile) return [];

      const { data } = await supabase
        .from("payments")
        .select("*, communities(name)")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      return data || [];
    },
    enabled: !!profile,
  });

  const totalEarnings = payments?.reduce((sum, p) => sum + Number(p.creator_earnings || 0), 0) || 0;

  return (
    <ChatLayout>
      <div className="flex-1 overflow-y-auto bg-chat-bg">
        <div className="max-w-4xl mx-auto p-6 lg:p-8 pt-16 lg:pt-8 space-y-6">
          <h1 className="text-2xl font-bold text-foreground">Payments & Earnings</h1>
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-2">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Earnings</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${(totalEarnings / 100).toFixed(2)}</div>
                </CardContent>
              </Card>

              <Card className="border-2">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Transactions</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{payments?.length || 0}</div>
                </CardContent>
              </Card>

              <Card className="border-2">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${((payments?.filter(p => {
                      const date = new Date(p.created_at);
                      const now = new Date();
                      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                    }).reduce((sum, p) => sum + Number(p.creator_earnings || 0), 0) || 0) / 100).toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Transactions */}
            <Card className="border-2">
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>Your payment history and earnings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {payments && payments.length > 0 ? (
                    payments.map((payment: any) => (
                      <div key={payment.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 hover:bg-accent/30 transition-all">
                        <div className="flex-1">
                          <p className="font-medium">{payment.communities?.name || "Unknown Community"}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(payment.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">${(Number(payment.creator_earnings) / 100).toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground capitalize">{payment.status}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      No transactions yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
        </div>
      </div>
    </ChatLayout>
  );
}
