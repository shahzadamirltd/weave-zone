import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Home, Plus, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

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

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Top Bar */}
      <header className="fixed top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-center px-4">
          <h1 className="text-lg font-semibold">Communities</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-14">{children}</main>

      {/* TikTok-style Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t">
        <div className="flex items-center justify-around h-16 px-4">
          {/* Home */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className={`flex flex-col items-center gap-1 h-auto py-2 px-6 ${
              isActive("/dashboard") ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            <Home className={`h-6 w-6 ${isActive("/dashboard") ? "fill-current" : ""}`} />
            <span className="text-xs">Home</span>
          </Button>

          {/* Create - Centered with special styling */}
          <Button
            onClick={() => navigate("/create-community")}
            className="relative -mt-6 h-12 w-12 rounded-xl bg-foreground hover:bg-foreground/90 shadow-lg"
          >
            <Plus className="h-6 w-6 text-background" />
          </Button>

          {/* Profile */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/profile")}
            className={`flex flex-col items-center gap-1 h-auto py-2 px-6 ${
              isActive("/profile") ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            <Avatar className="h-6 w-6">
              <AvatarImage src={profile?.avatar_url || ""} />
              <AvatarFallback className={`text-xs ${isActive("/profile") ? "bg-foreground text-background" : "bg-muted"}`}>
                {profile?.username?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs">Profile</span>
          </Button>
        </div>
        
        {/* Copyright */}
        <div className="text-center py-2 text-xs text-muted-foreground border-t">
          © Buyverly Ltd. All rights reserved
        </div>
      </nav>
    </div>
  );
};
