import { Home, CreditCard, Settings, HelpCircle, Plus } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Dashboard", icon: Home, to: "/dashboard" },
  { name: "Payments", icon: CreditCard, to: "/payments" },
  { name: "Settings", icon: Settings, to: "/settings" },
  { name: "Help", icon: HelpCircle, to: "/help" },
];

export function Sidebar() {
  const navigate = useNavigate();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-[#1a1a1a] border-r border-border/10 flex flex-col">
      <div className="p-6">
        <h2 className="text-xl font-bold text-white">Communities</h2>
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
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
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
          className="w-full bg-white text-black hover:bg-white/90 rounded-xl py-6"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Community
        </Button>
      </div>
    </aside>
  );
}
