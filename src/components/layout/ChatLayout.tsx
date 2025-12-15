import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ChatSidebar } from "./ChatSidebar";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { Onboarding } from "@/components/Onboarding";

interface ChatLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

export function ChatLayout({ children, showSidebar = true }: ChatLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Check if this is the first visit
    const hasSeenOnboarding = localStorage.getItem("hasSeenOnboarding");
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem("hasSeenOnboarding", "true");
    setShowOnboarding(false);
  };

  // Close sidebar when route changes on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="flex h-screen bg-chat-bg overflow-hidden">
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
