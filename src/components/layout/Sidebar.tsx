import { Home, CreditCard, Settings, HelpCircle, Plus } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";

const navigation = [
  { name: "Dashboard", icon: Home, to: "/dashboard" },
  { name: "Payments", icon: CreditCard, to: "/payments" },
  { name: "Settings", icon: Settings, to: "/settings" },
  { name: "Help", icon: HelpCircle, to: "/help" },
];

export function Sidebar() {
  const navigate = useNavigate();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-card border-r border-border/10 flex flex-col">
      <div className="p-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">Communities</h2>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <ThemeToggle />
        </div>
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      <div className="p-4">
        <Button 
          onClick={() => navigate("/create-community")}
          className="w-full rounded-xl py-6"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Community
        </Button>
      </div>
    </aside>
  );
}
