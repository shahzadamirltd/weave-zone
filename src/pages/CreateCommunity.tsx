import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

export default function CreateCommunity() {
  const navigate = useNavigate();
  const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [pricingType, setPricingType] = useState<"free" | "one_time" | "lifetime" | "recurring_monthly">("free");
  const [price, setPrice] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    try {
      // Get authenticated user and session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to create a community",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      const user = session.user;

      // Validate minimum price
      if (pricingType !== "free" && parseFloat(price) < 20) {
        toast({
          title: "Invalid Price",
          description: "Minimum price is $20",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Check for unique community name
      const { data: existingCommunity } = await supabase
        .from("communities")
        .select("id")
        .ilike("name", name)
        .maybeSingle();

      if (existingCommunity) {
        toast({
          title: "Name Already Taken",
          description: "This community name is already in use. Please choose another.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const inviteCode = isPrivate ? Math.random().toString(36).substring(2, 10) : null;

      const { data: community, error } = await supabase
        .from("communities")
        .insert({
          name,
          description,
          owner_id: user.id,
          is_private: isPrivate,
          invite_code: inviteCode,
          pricing_type: pricingType,
          price_amount: pricingType !== "free" && price ? parseFloat(price) : null,
        })
        .select()
        .single();

      if (error) {
        console.error("Database error:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to create community. Please make sure you're logged in.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: "Success!",
        description: "Community created successfully",
      });

      navigate(`/community/${community.id}`);
    } catch (error: any) {
      console.error("Create community error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create community",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>

        <div>
          <h1 className="text-3xl font-bold mb-2">Create Community</h1>
          <p className="text-muted-foreground">
            Build your own premium niche community
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Community Details</CardTitle>
            <CardDescription>
              Provide information about your new community
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Community Name *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g., Web Developers"
                  required
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Describe what your community is about..."
                  rows={4}
                  maxLength={500}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="private">Private Community</Label>
                  <p className="text-sm text-muted-foreground">
                    Only people with an invite link can join
                  </p>
                </div>
                <Switch
                  id="private"
                  checked={isPrivate}
                  onCheckedChange={setIsPrivate}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pricing">Pricing Type</Label>
                <select
                  id="pricing"
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  value={pricingType}
                  onChange={(e) => setPricingType(e.target.value as any)}
                >
                  <option value="free">Free</option>
                  <option value="one_time">One-Time Payment</option>
                  <option value="lifetime">Lifetime Access</option>
                  <option value="recurring_monthly">Monthly Subscription</option>
                </select>
              </div>

              {pricingType !== "free" && (
                <div className="space-y-2">
                  <Label htmlFor="price">Price ($)</Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    min="20"
                    placeholder="20.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                  />
                  <p className="text-sm text-muted-foreground">Minimum price is $20</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/dashboard")}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading ? "Creating..." : "Create Community"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
