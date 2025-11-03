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
        <header className="fixed top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-6">
            <h1 className="text-xl font-medium tracking-tight">Communities</h1>
            <NotificationBell />
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={isCommunityPage ? "" : "pt-16 pb-24"}>{children}</main>

      {/* Bottom Navigation - Hidden on community pages */}
      {!isCommunityPage && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/40">
          <div className="flex items-center justify-around h-20 px-4 max-w-lg mx-auto">
            {/* Home */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className={`flex flex-col items-center gap-1.5 h-auto py-2 px-5 rounded-xl transition-colors ${
                isActive("/dashboard") ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Home className={`h-6 w-6 ${isActive("/dashboard") ? "fill-current" : ""}`} />
              <span className="text-[10px] font-medium">Home</span>
            </Button>

            {/* Create */}
            <Button
              onClick={() => navigate("/create-community")}
              className="h-14 w-14 rounded-2xl bg-foreground hover:bg-foreground/90 shadow-lg hover:shadow-xl transition-all hover:scale-105"
            >
              <Plus className="h-7 w-7 text-background" />
            </Button>

            {/* Profile */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/profile")}
              className={`flex flex-col items-center gap-1.5 h-auto py-2 px-5 rounded-xl transition-colors ${
                isActive("/profile") ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={profile?.avatar_url || ""} />
                <AvatarFallback className={`text-xs ${isActive("/profile") ? "bg-foreground text-background" : "bg-muted"}`}>
                  {profile?.username?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="text-[10px] font-medium">Profile</span>
            </Button>

            {/* Settings */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/settings")}
              className={`flex flex-col items-center gap-1.5 h-auto py-2 px-5 rounded-xl transition-colors ${
                isActive("/settings") ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Settings className={`h-6 w-6 ${isActive("/settings") ? "fill-current" : ""}`} />
              <span className="text-[10px] font-medium">Settings</span>
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
};
