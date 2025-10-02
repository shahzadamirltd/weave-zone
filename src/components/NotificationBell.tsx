import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export function NotificationBell() {
  const [hasPermission, setHasPermission] = useState(false);
  const { toast } = useToast();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data;
    },
  });

  const { data: notifications, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      if (!profile) return [];
      
      // Get recent payments where user is the creator
      const { data: payments } = await supabase
        .from("payments")
        .select("*, communities!inner(owner_id, name)")
        .eq("communities.owner_id", profile.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(10);

      return payments || [];
    },
    enabled: !!profile,
  });

  const unreadCount = notifications?.length || 0;

  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setHasPermission(permission === "granted");
      if (permission === "granted") {
        toast({ title: "Notifications enabled" });
      }
    }
  };

  useEffect(() => {
    if ("Notification" in window) {
      setHasPermission(Notification.permission === "granted");
    }
  }, []);

  // Listen for new payments
  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel("payments-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "payments",
          filter: `status=eq.completed`,
        },
        (payload: any) => {
          refetch();
          if (hasPermission) {
            new Notification("New Payment Received!", {
              body: `You received a payment of $${payload.new.creator_earnings}`,
              icon: "/favicon.ico",
            });
          }
          toast({
            title: "New Payment!",
            description: `You received $${payload.new.creator_earnings}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, hasPermission, refetch, toast]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Notifications</h4>
            {!hasPermission && (
              <Button size="sm" variant="outline" onClick={requestNotificationPermission}>
                Enable
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {notifications && notifications.length > 0 ? (
              notifications.map((payment: any) => (
                <div key={payment.id} className="p-2 border rounded-lg text-sm">
                  <p className="font-medium">
                    Payment received: ${payment.creator_earnings}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    From {payment.communities?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(payment.created_at), { addSuffix: true })}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No notifications yet
              </p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}