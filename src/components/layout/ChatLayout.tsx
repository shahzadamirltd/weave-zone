import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ChatSidebar } from "./ChatSidebar";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { Onboarding } from "@/components/Onboarding";
import { supabase } from "@/integrations/supabase/client";

interface ChatLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

export function ChatLayout({ children, showSidebar = true }: ChatLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    // Check authentication status first
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
      
      // Only show onboarding for authenticated users who haven't seen it
      if (session) {
        const hasSeenOnboarding = localStorage.getItem("hasSeenOnboarding");
        if (!hasSeenOnboarding) {
          setShowOnboarding(true);
        }
      }
    };
    
    checkAuth();
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem("hasSeenOnboarding", "true");
    setShowOnboarding(false);
  };

  // Close sidebar when route changes on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  if (showOnboarding && isAuthenticated) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="flex h-screen bg-chat-bg overflow-hidden w-full">
      {showSidebar && (
        <>
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="fixed top-4 left-4 z-30 lg:hidden bg-card shadow-elegant rounded-full h-10 w-10"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <ChatSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        </>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}