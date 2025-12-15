import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, MoreVertical, Settings, Plus, X,
  Home, CreditCard, HelpCircle, Users, Crown,
  TrendingUp, Camera, MessageCircle
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

  // Global search for ALL communities
  const { data: allCommunities } = useQuery({
    queryKey: ["all-communities-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) return [];
      
      const { data } = await supabase
        .from("communities")
        .select("*, profiles(*), memberships(count)")
        .ilike("name", `%${searchQuery}%`)
        .limit(20);

      return data || [];
    },
    enabled: searchQuery.length >= 2,
  });

  const isLoading = loadingJoined || loadingOwned;

  // Filter user's communities based on search
  const filterCommunities = (communities: any[]) => {
    if (!searchQuery.trim()) return communities;
    return communities.filter((c: any) =>
      c.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const filteredJoined = filterCommunities(joinedCommunities || []);
  const filteredOwned = filterCommunities(ownedCommunities || []);
  
  // Filter out already joined/owned from global search
  const userCommunityIds = [...(joinedCommunities || []), ...(ownedCommunities || [])].map((c: any) => c.id);
  const discoverCommunities = (allCommunities || []).filter((c: any) => !userCommunityIds.includes(c.id));

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
          "w-full flex items-center gap-3 px-4 py-3 transition-colors text-left border-b border-border/30",
          isActive ? "bg-primary/5" : "hover:bg-muted/50"
        )}
      >
        <Avatar className="h-12 w-12 flex-shrink-0">
          <AvatarImage src={community.avatar_url || ""} />
          <AvatarFallback className="bg-muted text-muted-foreground font-medium">
            {community.name?.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-medium text-foreground truncate">
                {community.name}
              </span>
              {isOwner && <Crown className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
            </div>
            {lastPost && (
              <span className="text-[11px] text-muted-foreground flex-shrink-0">
                {formatDistanceToNow(new Date(lastPost.created_at), { addSuffix: false })}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate mt-0.5">
            {isDiscover 
              ? `by ${ownerProfile?.username || "Unknown"} • ${memberCount} members`
              : `${memberCount} members`
            }
          </p>
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
        "fixed lg:relative inset-y-0 left-0 z-50 w-80 bg-card border-r border-border flex flex-col transition-transform duration-300 lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <h1 className="text-xl font-semibold text-foreground">Chats</h1>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-9 w-9"
              onClick={() => handleNavigate("/create-community")}
            >
              <Camera className="h-5 w-5 text-muted-foreground" />
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
                <DropdownMenuItem onClick={() => handleNavigate("/dashboard")}>
                  <Home className="h-4 w-4 mr-2" />
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigate("/payments")}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Payments
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigate("/settings")}>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigate("/help")}>
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Help
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-9 w-9 lg:hidden"
              onClick={onClose}
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search all communities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted border-0 rounded-lg h-10"
            />
          </div>
        </div>

        {/* Communities List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-0">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
                  <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {/* Discover Communities from Search */}
              {searchQuery.length >= 2 && discoverCommunities.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-muted/50">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Discover
                    </span>
                  </div>
                  {discoverCommunities.map((community: any) => (
                    <CommunityItem key={community.id} community={community} isOwner={false} isDiscover />
                  ))}
                </div>
              )}

              {/* Joined Communities */}
              {filteredJoined.length > 0 && (
                <div>
                  {(filteredOwned.length > 0 || discoverCommunities.length > 0) && (
                    <div className="px-4 py-2 bg-muted/50">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Joined ({filteredJoined.length})
                      </span>
                    </div>
                  )}
                  {filteredJoined.map((community: any) => (
                    <CommunityItem key={community.id} community={community} isOwner={false} />
                  ))}
                </div>
              )}

              {/* Owned Communities */}
              {filteredOwned.length > 0 && (
                <div>
                  {(filteredJoined.length > 0 || discoverCommunities.length > 0) && (
                    <div className="px-4 py-2 bg-muted/50">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Created ({filteredOwned.length})
                      </span>
                    </div>
                  )}
                  {filteredOwned.map((community: any) => (
                    <CommunityItem key={community.id} community={community} isOwner={true} />
                  ))}
                </div>
              )}

              {/* Empty State */}
              {filteredJoined.length === 0 && filteredOwned.length === 0 && discoverCommunities.length === 0 && (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <MessageCircle className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">
                    {searchQuery ? "No communities found" : "No communities yet"}
                  </p>
                  {searchQuery.length > 0 && searchQuery.length < 2 && (
                    <p className="text-xs text-muted-foreground/70 mt-1">Type 2+ characters to search</p>
                  )}
                  <Button
                    onClick={() => handleNavigate("/create-community")}
                    className="mt-4"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Community
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Profile Footer */}
        {profile && (
          <div className="border-t border-border p-3">
            <button 
              onClick={() => handleNavigate("/settings")}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile.avatar_url || ""} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {profile.username?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <p className="font-medium text-sm">{profile.username}</p>
                <p className="text-xs text-muted-foreground">My Account</p>
              </div>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
