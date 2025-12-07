import { ShieldX } from "lucide-react";

interface BlockedScreenProps {
  reason: "country" | "user" | "ip";
}

export const BlockedScreen = ({ reason }: BlockedScreenProps) => {
  const messages = {
    country: "This application is not available in your country.",
    user: "Your account has been suspended.",
    ip: "Your IP address has been blocked.",
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted to-background">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldX className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-4">Access Denied</h1>
        <p className="text-muted-foreground mb-6">{messages[reason]}</p>
        <p className="text-sm text-muted-foreground">
          If you believe this is an error, please contact support.
        </p>
      </div>
    </div>
  );
};
