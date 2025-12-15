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
        // Check if user is new (created within last 5 minutes) and hasn't completed onboarding
        const createdAt = new Date(session.user.created_at);
        const now = new Date();
        const isNewUser = (now.getTime() - createdAt.getTime()) < 5 * 60 * 1000;
        const hasCompleted = localStorage.getItem(`${ONBOARDING_KEY}_${session.user.id}`);
        
        if (isNewUser && !hasCompleted) {
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
            className="fixed top-4 left-4 z-30 lg:hidden bg-card shadow-md rounded-full h-10 w-10"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
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
