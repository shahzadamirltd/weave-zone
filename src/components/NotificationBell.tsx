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
import { requestNotificationPermission, showNotification, initNotificationSound } from "@/services/notificationService";

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
      
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(20);

      return data || [];
    },
    enabled: !!profile,
  });

  const unreadCount = notifications?.filter((n: any) => !n.is_read).length || 0;

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    setHasPermission(granted);
    if (granted) {
      toast({ title: "Notifications enabled" });
    }
  };

  useEffect(() => {
    if ("Notification" in window) {
      setHasPermission(Notification.permission === "granted");
    }
    // Initialize notification sound
    initNotificationSound();
  }, []);

  // Listen for new notifications
  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${profile.id}`,
        },
        (payload: any) => {
          refetch();
          // Show notification with sound
          showNotification(payload.new.title, payload.new.message);
          // Also show toast
          toast({
            title: payload.new.title,
            description: payload.new.message,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, hasPermission, refetch, toast]);

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);
    refetch();
  };

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
              <Button size="sm" variant="outline" onClick={handleRequestPermission}>
                Enable
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {notifications && notifications.length > 0 ? (
              notifications.map((notification: any) => (
                <div 
                  key={notification.id} 
                  className={`p-2 border rounded-lg text-sm cursor-pointer transition-colors ${
                    !notification.is_read ? 'bg-primary/5 border-primary/20' : ''
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <p className="font-medium">
                    {notification.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
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