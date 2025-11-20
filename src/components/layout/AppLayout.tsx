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
    <div className="min-h-screen">
      {/* Top Bar - Hidden on community pages */}
      {!isCommunityPage && (
        <header className="fixed top-0 z-50 w-full border-b border-border/30 glass-card">
          <div className="flex h-16 items-center justify-between px-6">
            <h1 className="text-xl font-semibold tracking-tight text-card-foreground">Communities</h1>
            <NotificationBell />
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={isCommunityPage ? "" : "pt-16 pb-24"}>{children}</main>

      {/* Bottom Navigation - Hidden on community pages */}
      {!isCommunityPage && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 glass-card border-t border-border/30">
          <div className="flex items-center justify-around h-20 px-4 max-w-lg mx-auto">
            {/* Home */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className={`flex flex-col items-center gap-1.5 h-auto py-2 px-5 rounded-2xl transition-all ${
                isActive("/dashboard") ? "bg-primary/20" : "hover:bg-accent"
              }`}
            >
              <Home className={`h-6 w-6 transition-all ${isActive("/dashboard") ? "fill-primary text-primary scale-110" : "text-muted-foreground"}`} />
              <span className={`text-[10px] font-semibold ${isActive("/dashboard") ? "text-primary" : "text-muted-foreground"}`}>Home</span>
            </Button>

            {/* Create */}
            <Button
              onClick={() => navigate("/create-community")}
              className="h-16 w-16 rounded-3xl bg-primary hover:bg-primary/90 shadow-glow hover:shadow-elevated transition-all hover:scale-110 active:scale-95"
            >
              <Plus className="h-8 w-8 text-primary-foreground" />
            </Button>

            {/* Profile */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/profile")}
              className={`flex flex-col items-center gap-1.5 h-auto py-2 px-5 rounded-2xl transition-all ${
                isActive("/profile") ? "bg-primary/20" : "hover:bg-accent"
              }`}
            >
              <Avatar className={`h-6 w-6 transition-all ${isActive("/profile") ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110" : ""}`}>
                <AvatarImage src={profile?.avatar_url || ""} />
                <AvatarFallback className={`text-xs ${isActive("/profile") ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {profile?.username?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <span className={`text-[10px] font-semibold ${isActive("/profile") ? "text-primary" : "text-muted-foreground"}`}>Profile</span>
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
};
