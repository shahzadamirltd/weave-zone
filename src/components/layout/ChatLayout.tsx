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

const ONBOARDING_KEY = "onboarding_completed";

export function ChatLayout({ children, showSidebar = true }: ChatLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        // Only show onboarding for NEW users who haven't completed it
        const hasCompleted = localStorage.getItem(`${ONBOARDING_KEY}_${session.user.id}`);
        if (!hasCompleted) {
          setShowOnboarding(true);
        }
      }
    };
    checkAuth();
  }, []);

  const handleOnboardingComplete = () => {
    if (userId) {
      localStorage.setItem(`${ONBOARDING_KEY}_${userId}`, "true");
    }
    setShowOnboarding(false);
  };

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  if (showOnboarding && userId) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="flex h-screen bg-chat-bg overflow-hidden w-full">
      {showSidebar && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="fixed top-3 left-3 z-30 lg:hidden bg-card shadow-sm rounded-full h-9 w-9"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <ChatSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        </>
      )}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}