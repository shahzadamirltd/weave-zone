import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const StripeSetup = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [creatingFor, setCreatingFor] = useState<string | null>(null);

  const { data: communities, isLoading } = useQuery({
    queryKey: ["paid-communities"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("communities")
        .select("*")
        .eq("owner_id", user?.id)
        .neq("pricing_type", "free");
      
      if (error) throw error;
      return data;
    },
  });

  const createStripePriceMutation = useMutation({
    mutationFn: async ({ communityId, name, amount, recurring }: any) => {
      const { data, error } = await supabase.functions.invoke("create-stripe-product", {
        body: {
          community_id: communityId,
          product_name: name,
          price_amount: amount,
          recurring_interval: recurring ? "month" : undefined,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["paid-communities"] });
      toast({
        title: "Success!",
        description: "Stripe product created and linked to community",
      });
      setCreatingFor(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setCreatingFor(null);
    },
  });

  const handleCreatePrice = async (community: any) => {
    setCreatingFor(community.id);
    createStripePriceMutation.mutate({
      communityId: community.id,
      name: community.name,
      amount: community.price_amount * 100, // Convert to cents
      recurring: community.pricing_type === "recurring_monthly",
    });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Stripe Setup</h1>
          <p className="text-muted-foreground">
            Create Stripe products and prices for your paid communities
          </p>
        </div>

        {!communities?.length && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                No paid communities found. Create a paid community first!
              </p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {communities?.map((community) => (
            <Card key={community.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{community.name}</span>
                  {community.stripe_price_id && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Price</p>
                    <p className="font-semibold">${community.price_amount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Type</p>
                    <p className="font-semibold">
                      {community.pricing_type === "recurring_monthly" ? "Monthly" : "One-Time"}
                    </p>
                  </div>
                </div>

                {community.stripe_price_id ? (
                  <div className="space-y-2">
                    <div>
                      <Label>Stripe Product ID</Label>
                      <Input value={community.stripe_product_id || "N/A"} readOnly />
                    </div>
                    <div>
                      <Label>Stripe Price ID</Label>
                      <Input value={community.stripe_price_id} readOnly />
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                    <p className="text-sm mb-3">
                      ⚠️ No Stripe product configured. Create one to enable payments.
                    </p>
                    <Button
                      onClick={() => handleCreatePrice(community)}
                      disabled={creatingFor === community.id}
                    >
                      {creatingFor === community.id && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Create Stripe Product & Price
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6">
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            ← Back to Dashboard
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default StripeSetup;
