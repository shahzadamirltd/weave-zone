import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/layout/Sidebar";
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
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 ml-64">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50 px-8 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="rounded-lg"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Create Community</h1>
          </div>
        </header>

        <div className="p-8">
          <div className="max-w-2xl">
            <div className="border border-border rounded-2xl p-6 space-y-6 bg-card">
              <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">Community Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Web Developers"
                required
                maxLength={100}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Describe what your community is about..."
                rows={4}
                maxLength={500}
                className="resize-none"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-4 bg-muted/30">
              <div className="space-y-1">
                <Label htmlFor="private" className="text-sm font-medium">Private Community</Label>
                <p className="text-xs text-muted-foreground">
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
              <Label htmlFor="pricing" className="text-sm font-medium">Pricing Type</Label>
              <select
                id="pricing"
                className="w-full h-11 px-4 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                <Label htmlFor="price" className="text-sm font-medium">Price ($)</Label>
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
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">Minimum price is $20</p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/dashboard")}
                className="flex-1 h-11"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="flex-1 h-11">
                {isLoading ? "Creating..." : "Create Community"}
              </Button>
            </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
