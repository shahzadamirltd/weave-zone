import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, MoreVertical, Settings, Plus, X,
  Home, CreditCard, HelpCircle, Users, Crown,
  Radio, TrendingUp
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
  const [isSearching, setIsSearching] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data;
    },
  });

  // Get joined communities (not owner)
  const { data: joinedCommunities, isLoading: loadingJoined } = useQuery({
    queryKey: ["joined-communities", profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      
      const { data: memberships } = await supabase
        .from("memberships")
        .select(`community_id, communities(*, profiles(*), memberships(count), posts(created_at))`)
        .eq("user_id", profile.id)
        .neq("role", "owner");

      return memberships?.map(m => (m as any).communities).filter(Boolean) || [];
    },
    enabled: !!profile,
  });

  // Get owned communities
  const { data: ownedCommunities, isLoading: loadingOwned } = useQuery({
    queryKey: ["owned-communities", profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      
      const { data } = await supabase
        .from("communities")
        .select("*, profiles(*), memberships(count), posts(created_at)")
        .eq("owner_id", profile.id)
        .order("created_at", { ascending: false });

      return data || [];
    },
    enabled: !!profile,
  });

  // Global search for ALL communities (not just user's)
  const { data: allCommunities } = useQuery({
    queryKey: ["all-communities-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) return [];
      
      const { data } = await supabase
        .from("communities")
        .select("*, profiles(*), memberships(count)")
        .ilike("name", `%${searchQuery}%`)
        .limit(10);

      return data || [];
    },
    enabled: searchQuery.length >= 2,
  });

  const isLoading = loadingJoined || loadingOwned;

  // Filter user's communities based on search
  const filterCommunities = (communities: any[]) => {
    if (!searchQuery.trim()) return communities;
    return communities.filter((c: any) =>
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const filteredJoined = filterCommunities(joinedCommunities || []);
  const filteredOwned = filterCommunities(ownedCommunities || []);
  
  // Filter out already joined/owned from global search
  const userCommunityIds = [...(joinedCommunities || []), ...(ownedCommunities || [])].map((c: any) => c.id);
  const discoverCommunities = (allCommunities || []).filter((c: any) => !userCommunityIds.includes(c.id));

  const navItems = [
    { icon: Home, label: "Home", path: "/dashboard" },
    { icon: CreditCard, label: "Pay", path: "/payments" },
    { icon: Settings, label: "Settings", path: "/settings" },
    { icon: HelpCircle, label: "Help", path: "/help" },
  ];

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  const CommunityItem = ({ community, isOwner, isDiscover }: { community: any; isOwner: boolean; isDiscover?: boolean }) => {
    const isActive = location.pathname === `/community/${community.id}`;
    const lastPost = community.posts?.[0];
    const ownerProfile = community.profiles;
    const memberCount = community.memberships?.[0]?.count || 0;
    
    return (
      <button
        onClick={() => handleNavigate(`/community/${community.id}`)}
        className={cn(
          "w-full flex items-center gap-2 p-2 rounded-lg transition-colors text-left",
          isActive ? "bg-primary/10" : "hover:bg-sidebar-accent"
        )}
      >
        <div className="relative">
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarImage src={community.avatar_url || ""} />
            <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
              {community.name?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {/* Live indicator */}
          {Math.random() > 0.7 && (
            <span className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-like rounded-full border-2 border-card animate-pulse" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1 min-w-0">
              <span className="font-medium text-foreground truncate text-sm">
                {community.name}
              </span>
              {isOwner && <Crown className="h-3 w-3 text-primary flex-shrink-0" />}
            </div>
            {lastPost && (
              <span className="text-[9px] text-muted-foreground flex-shrink-0">
                {formatDistanceToNow(new Date(lastPost.created_at), { addSuffix: false })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <Users className="h-2.5 w-2.5" />
              {memberCount}
            </span>
            {isDiscover && ownerProfile && (
              <span className="truncate">by {ownerProfile.username}</span>
            )}
            {!isDiscover && (isOwner ? "Owner" : `by ${ownerProfile?.username || "Unknown"}`)}
          </div>
        </div>
      </button>
    );
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
        "fixed lg:relative inset-y-0 left-0 z-50 w-72 bg-card border-r border-sidebar-border flex flex-col transition-transform duration-300 lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-sidebar-border">
          <h1 className="text-lg font-bold text-foreground">Communities</h1>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-8 w-8 lg:hidden"
              onClick={onClose}
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
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
        <div className="p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search all communities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 bg-muted border-0 rounded-lg h-9 text-sm"
            />
          </div>
        </div>

        {/* Communities List */}
        <div className="flex-1 overflow-y-auto px-2">
          {isLoading ? (
            <div className="space-y-1 p-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2 p-2">
                  <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                    <div className="h-2 w-16 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3 pb-2">
              {/* Discover Communities from Search */}
              {searchQuery.length >= 2 && discoverCommunities.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2 mb-1 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Discover
                  </h3>
                  <div className="space-y-0.5">
                    {discoverCommunities.map((community: any) => (
                      <CommunityItem key={community.id} community={community} isOwner={false} isDiscover />
                    ))}
                  </div>
                </div>
              )}

              {/* Joined Communities */}
              {filteredJoined.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2 mb-1">
                    Joined ({filteredJoined.length})
                  </h3>
                  <div className="space-y-0.5">
                    {filteredJoined.map((community: any) => (
                      <CommunityItem key={community.id} community={community} isOwner={false} />
                    ))}
                  </div>
                </div>
              )}

              {/* Owned Communities */}
              {filteredOwned.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2 mb-1">
                    Created ({filteredOwned.length})
                  </h3>
                  <div className="space-y-0.5">
                    {filteredOwned.map((community: any) => (
                      <CommunityItem key={community.id} community={community} isOwner={true} />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {filteredJoined.length === 0 && filteredOwned.length === 0 && discoverCommunities.length === 0 && (
                <div className="flex flex-col items-center justify-center p-6 text-center">
                  <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground text-sm">
                    {searchQuery ? "No communities found" : "No communities yet"}
                  </p>
                  {searchQuery.length > 0 && searchQuery.length < 2 && (
                    <p className="text-xs text-muted-foreground/70 mt-1">Type 2+ characters to search</p>
                  )}
                  <Button
                    variant="link"
                    onClick={() => handleNavigate("/create-community")}
                    className="mt-2 text-primary text-sm"
                  >
                    Create your first community
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Navigation - Compact */}
        <div className="border-t border-sidebar-border p-1.5">
          <div className="grid grid-cols-4 gap-0.5">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="text-[9px] font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Create Button - Compact */}
        <div className="p-2 border-t border-sidebar-border">
          <Button
            onClick={() => handleNavigate("/create-community")}
            className="w-full rounded-lg py-2 h-9 text-sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            New Community
          </Button>
        </div>
      </aside>
    </>
  );
}
