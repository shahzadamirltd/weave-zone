// App Router
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LiveChatButton } from "@/components/LiveChatButton";
import { BlockedScreen } from "@/components/BlockedScreen";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import CreateCommunity from "./pages/CreateCommunity";
import EditCommunity from "./pages/EditCommunity";
import Community from "./pages/Community";
import Profile from "./pages/Profile";
import CommunityPricing from "./pages/CommunityPricing";
import CreatorDashboard from "./pages/CreatorDashboard";
import StripeSetup from "./pages/StripeSetup";
import Settings from "./pages/Settings";
import Payments from "./pages/Payments";
import Help from "./pages/Help";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";

const queryClient = new QueryClient();

function BlockingCheck({ children }: { children: React.ReactNode }) {
  const [blockStatus, setBlockStatus] = useState<{ blocked: boolean; reason?: "country" | "user" | "ip" } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile-blocking"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data;
    },
  });

  const { data: blockedCountries } = useQuery({
    queryKey: ["blocked-countries"],
    queryFn: async () => {
      const { data } = await supabase.from("country_blocklist").select("country_code");
      return data || [];
    },
  });

  const { data: blockedIPs } = useQuery({
    queryKey: ["blocked-ips"],
    queryFn: async () => {
      const { data } = await supabase.from("ip_blocklist").select("ip_address");
      return data || [];
    },
  });

  useEffect(() => {
    // Check if user is suspended
    if (profile?.suspended) {
      setBlockStatus({ blocked: true, reason: "user" });
      return;
    }

    // Check if user's country is blocked
    if (profile?.country && blockedCountries?.some((c: any) => c.country_code === profile.country)) {
      setBlockStatus({ blocked: true, reason: "country" });
      return;
    }

    // Check if user's IP is blocked
    if (profile?.ip_address && blockedIPs?.some((ip: any) => ip.ip_address === profile.ip_address)) {
      setBlockStatus({ blocked: true, reason: "ip" });
      return;
    }

    setBlockStatus({ blocked: false });
  }, [profile, blockedCountries, blockedIPs]);

  if (blockStatus === null) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (blockStatus.blocked && blockStatus.reason) {
    return <BlockedScreen reason={blockStatus.reason} />;
  }

  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isAuthenticated === null) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
}

function AppContent() {
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setShowChat(!!session);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setShowChat(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <BlockingCheck>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create-community"
          element={
            <ProtectedRoute>
              <CreateCommunity />
            </ProtectedRoute>
          }
        />
        <Route
          path="/community/:id"
          element={
            <ProtectedRoute>
              <Community />
            </ProtectedRoute>
          }
        />
        <Route
          path="/community/:id/edit"
          element={
            <ProtectedRoute>
              <EditCommunity />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/community/:id/pricing"
          element={
            <ProtectedRoute>
              <CommunityPricing />
            </ProtectedRoute>
          }
        />
        <Route
          path="/creator-dashboard"
          element={
            <ProtectedRoute>
              <CreatorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/stripe-setup"
          element={
            <ProtectedRoute>
              <StripeSetup />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payments"
          element={
            <ProtectedRoute>
              <Payments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/help"
          element={
            <ProtectedRoute>
              <Help />
            </ProtectedRoute>
          }
        />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      
      {/* Global Live Chat Button - visible on all pages when logged in */}
      {showChat && <LiveChatButton />}
    </BlockingCheck>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
