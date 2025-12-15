import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, MoreVertical, MessageCircle, Settings, Plus, Menu, X,
  Home, CreditCard, HelpCircle, Users
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatSidebar({ isOpen, onClose }: ChatSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data;
    },
  });

  const { data: communities, isLoading } = useQuery({
    queryKey: ["all-communities", profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      
      // Get owned communities
      const { data: owned } = await supabase
        .from("communities")
        .select("*, memberships(count), posts(created_at)")
        .eq("owner_id", profile.id)
        .order("created_at", { ascending: false });

      // Get joined communities
      const { data: memberships } = await supabase
        .from("memberships")
        .select(`community_id, communities(*, memberships(count), posts(created_at))`)
        .eq("user_id", profile.id)
        .neq("role", "owner");

      const joined = memberships?.map(m => (m as any).communities).filter(Boolean) || [];
      
      return [...(owned || []), ...joined];
    },
    enabled: !!profile,
  });

  const filteredCommunities = communities?.filter((c: any) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const navItems = [
    { icon: Home, label: "Dashboard", path: "/dashboard" },
    { icon: CreditCard, label: "Payments", path: "/payments" },
    { icon: Settings, label: "Settings", path: "/settings" },
    { icon: HelpCircle, label: "Help", path: "/help" },
  ];

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        "fixed lg:relative inset-y-0 left-0 z-50 w-80 bg-card border-r border-sidebar-border flex flex-col transition-transform duration-300 lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          <h1 className="text-xl font-bold text-foreground">Chats</h1>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-9 w-9 lg:hidden"
              onClick={onClose}
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                  <MoreVertical className="h-5 w-5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => handleNavigate("/create-community")}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Community
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigate("/settings")}>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search */}
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted border-0 rounded-lg h-10"
            />
          </div>
        </div>

        {/* Communities List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-1 p-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredCommunities && filteredCommunities.length > 0 ? (
            <div className="space-y-0.5 p-2">
              {filteredCommunities.map((community: any) => {
                const isActive = location.pathname === `/community/${community.id}`;
                const lastPost = community.posts?.[0];
                
                return (
                  <button
                    key={community.id}
                    onClick={() => handleNavigate(`/community/${community.id}`)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                      isActive ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50"
                    )}
                  >
                    <Avatar className="h-12 w-12 flex-shrink-0">
                      <AvatarImage src={community.avatar_url || ""} />
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {community.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground truncate">
                          {community.name}
                        </span>
                        {lastPost && (
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {formatDistanceToNow(new Date(lastPost.created_at), { addSuffix: false })}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {community.description || "No messages yet"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground text-sm">
                {searchQuery ? "No communities found" : "No communities yet"}
              </p>
              <Button
                variant="link"
                onClick={() => handleNavigate("/create-community")}
                className="mt-2 text-primary"
              >
                Create your first community
              </Button>
            </div>
          )}
        </div>

        {/* Bottom Navigation */}
        <div className="border-t border-sidebar-border p-2">
          <div className="grid grid-cols-4 gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Create Button */}
        <div className="p-3 border-t border-sidebar-border">
          <Button
            onClick={() => handleNavigate("/create-community")}
            className="w-full rounded-lg py-5"
          >
            <Plus className="h-5 w-5 mr-2" />
            New Community
          </Button>
        </div>
      </aside>
    </>
  );
}
