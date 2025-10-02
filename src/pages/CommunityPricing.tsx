import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CommunityPricing = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [couponCode, setCouponCode] = useState("");

  const { data: community, isLoading } = useQuery({
    queryKey: ["community", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communities")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const handleCheckout = async () => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { community_id: id, coupon_code: couponCode || undefined },
      });

      if (error) throw error;

      if (data.url) {
        window.open(data.url, "_blank");
        
        // After opening checkout, wait for payment confirmation
        toast({
          title: "Checkout opened",
          description: "Complete your payment in the new tab, then return here.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Checkout failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
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

  if (!community) {
    return (
      <AppLayout>
        <div className="container mx-auto p-4">
          <p>Community not found</p>
        </div>
      </AppLayout>
    );
  }

  const pricingTypeLabels = {
    free: "Free",
    one_time: "One-Time Payment",
    lifetime: "Lifetime Access",
    recurring_monthly: "Monthly Subscription",
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-4 max-w-2xl">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          ← Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">{community.name}</CardTitle>
            <CardDescription>{community.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border-l-4 border-primary pl-4">
              <p className="text-sm text-muted-foreground">Pricing Type</p>
              <p className="text-2xl font-bold">{pricingTypeLabels[community.pricing_type]}</p>
            </div>

            {community.pricing_type !== "free" && (
              <>
                <div className="border-l-4 border-primary pl-4">
                  <p className="text-sm text-muted-foreground">Price</p>
                  <p className="text-4xl font-bold">${community.price_amount}</p>
                  {community.pricing_type === "recurring_monthly" && (
                    <p className="text-sm text-muted-foreground">per month</p>
                  )}
                </div>

                {community.trial_period_days > 0 && (
                  <div className="bg-accent p-4 rounded-lg">
                    <p className="font-semibold flex items-center gap-2">
                      <Check className="h-5 w-5 text-primary" />
                      {community.trial_period_days}-day free trial
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="coupon">Coupon Code (Optional)</Label>
                  <Input
                    id="coupon"
                    placeholder="Enter coupon code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                  />
                </div>
              </>
            )}

            {community.preview_enabled && (
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold mb-2">What's included:</h3>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Access to all community posts
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Interact with other members
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Exclusive content from creator
                  </li>
                </ul>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleCheckout}
              disabled={isProcessing || community.pricing_type === "free"}
              className="w-full"
              size="lg"
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {community.pricing_type === "free" ? "Free to Join" : "Proceed to Checkout"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </AppLayout>
  );
};

export default CommunityPricing;
