import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Home, Plus, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { NotificationBell } from "@/components/NotificationBell";

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const isActive = (path: string) => location.pathname === path;
  
  // Check if we're on a community page
  const isCommunityPage = location.pathname.startsWith('/community/') && 
                          location.pathname.split('/').length === 3;

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar - Hidden on community pages */}
      {!isCommunityPage && (
        <header className="fixed top-0 z-50 w-full border-b border-border/30 glass">
          <div className="flex h-16 items-center justify-between px-6">
            <h1 className="text-xl font-semibold tracking-tight">Communities</h1>
            <NotificationBell />
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={isCommunityPage ? "" : "pt-16 pb-24"}>{children}</main>

      {/* Bottom Navigation - Hidden on community pages */}
      {!isCommunityPage && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border/30">
          <div className="flex items-center justify-around h-20 px-4 max-w-lg mx-auto">
            {/* Home */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className={`flex flex-col items-center gap-1.5 h-auto py-2 px-5 rounded-2xl transition-all ${
                isActive("/dashboard") ? "text-foreground bg-accent" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <Home className={`h-6 w-6 transition-all ${isActive("/dashboard") ? "fill-current scale-110" : ""}`} />
              <span className="text-[10px] font-semibold">Home</span>
            </Button>

            {/* Create */}
            <Button
              onClick={() => navigate("/create-community")}
              className="h-16 w-16 rounded-3xl bg-foreground hover:bg-foreground/90 shadow-lg hover:shadow-2xl transition-all hover:scale-110 active:scale-95"
            >
              <Plus className="h-8 w-8 text-background" />
            </Button>

            {/* Profile */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/profile")}
              className={`flex flex-col items-center gap-1.5 h-auto py-2 px-5 rounded-2xl transition-all ${
                isActive("/profile") ? "text-foreground bg-accent" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <Avatar className={`h-6 w-6 transition-all ${isActive("/profile") ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110" : ""}`}>
                <AvatarImage src={profile?.avatar_url || ""} />
                <AvatarFallback className={`text-xs ${isActive("/profile") ? "bg-foreground text-background" : "bg-muted"}`}>
                  {profile?.username?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="text-[10px] font-semibold">Profile</span>
            </Button>

            {/* Settings */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/settings")}
              className={`flex flex-col items-center gap-1.5 h-auto py-2 px-5 rounded-2xl transition-all ${
                isActive("/settings") ? "text-foreground bg-accent" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <Settings className={`h-6 w-6 transition-all ${isActive("/settings") ? "fill-current scale-110" : ""}`} />
              <span className="text-[10px] font-semibold">Settings</span>
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
};
