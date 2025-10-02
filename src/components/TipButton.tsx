import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TipButtonProps {
  creatorId: string;
  creatorName: string;
  communityId?: string;
}

export function TipButton({ creatorId, creatorName, communityId }: TipButtonProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("5.00");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleTip = async () => {
    const tipAmount = parseFloat(amount);
    if (tipAmount < 5) {
      toast({
        title: "Minimum tip is $5",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-tip-checkout", {
        body: {
          creator_id: creatorId,
          amount: tipAmount,
          community_id: communityId,
        },
      });

      if (error) throw error;

      if (data.url) {
        window.open(data.url, "_blank");
        setOpen(false);
        toast({ title: "Redirecting to checkout..." });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <DollarSign className="h-4 w-4" />
          Send Tip
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Tip to {creatorName}</DialogTitle>
          <DialogDescription>
            Support this creator with a tip (minimum $5)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Tip Amount ($)</Label>
            <Input
              id="amount"
              type="number"
              min="5"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="5.00"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[5, 10, 20].map((preset) => (
              <Button
                key={preset}
                variant="outline"
                onClick={() => setAmount(preset.toString())}
              >
                ${preset}
              </Button>
            ))}
          </div>
          <Button onClick={handleTip} disabled={loading} className="w-full">
            {loading ? "Processing..." : `Send $${amount} Tip`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}