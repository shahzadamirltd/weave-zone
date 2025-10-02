import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, Mail, AlertTriangle, Settings as SettingsIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
    toast({ title: "Logged out successfully" });
  };

  const handleHelp = () => {
    window.location.href = "mailto:buyverly@buyverly.store?subject=Help Request";
  };

  const handleReport = () => {
    window.location.href = "mailto:buyverly@buyverly.store?subject=Report Issue";
  };

  return (
    <AppLayout>
      <div className="container max-w-2xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account Settings</CardTitle>
            <CardDescription>Manage your account and preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2"
              onClick={() => navigate("/profile")}
            >
              <SettingsIcon className="h-4 w-4" />
              Profile Settings
            </Button>

            <Button 
              variant="outline" 
              className="w-full justify-start gap-2"
              onClick={() => navigate("/creator-dashboard")}
            >
              <SettingsIcon className="h-4 w-4" />
              Creator Dashboard
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Support</CardTitle>
            <CardDescription>Get help or report issues</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2"
              onClick={handleHelp}
            >
              <Mail className="h-4 w-4" />
              Contact Support
            </Button>

            <Button 
              variant="outline" 
              className="w-full justify-start gap-2 text-destructive hover:text-destructive"
              onClick={handleReport}
            >
              <AlertTriangle className="h-4 w-4" />
              Report Issue
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              variant="destructive" 
              className="w-full gap-2"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}