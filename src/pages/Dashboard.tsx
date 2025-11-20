import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search, Share2, Check, Settings, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      return data;
    },
  });

  const { data: ownedCommunities } = useQuery({
    queryKey: ["owned-communities", profile?.id],
    queryFn: async () => {
      if (!profile) return [];

      const { data } = await supabase
        .from("communities")
        .select("*, memberships(count)")
        .eq("owner_id", profile.id)
        .order("created_at", { ascending: false });

      return data || [];
    },
    enabled: !!profile,
  });

  const { data: joinedCommunities } = useQuery({
    queryKey: ["joined-communities", profile?.id],
    queryFn: async () => {
      if (!profile) return [];

      const { data: memberships } = await supabase
        .from("memberships")
        .select("community_id, communities!inner(*, memberships(count))")
        .eq("user_id", profile.id)
        .neq("role", "owner");

      return memberships?.map(m => m.communities).filter(Boolean) || [];
    },
    enabled: !!profile,
  });

  const { data: searchResults } = useQuery({
    queryKey: ["search-communities", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];

      const { data } = await supabase
        .from("communities")
        .select("*, memberships(count)")
        .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,handle.ilike.%${searchQuery}%`)
        .eq("is_private", false)
        .order("created_at", { ascending: false })
        .limit(20);

      return data || [];
    },
    enabled: !!searchQuery.trim(),
  });

  const joinCommunityMutation = useMutation({
    mutationFn: async (communityId: string) => {
      if (!profile) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("memberships")
        .insert({
          community_id: communityId,
          user_id: profile.id,
          role: "member"
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "You've joined the community!",
      });
      queryClient.invalidateQueries({ queryKey: ["joined-communities"] });
      queryClient.invalidateQueries({ queryKey: ["search-communities"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to join community",
        variant: "destructive",
      });
    },
  });

  const CommunityCard = ({ community, showEdit, showJoin }: any) => {
    const { toast } = useToast();
    const [copied, setCopied] = useState(false);
    const memberCount = community.memberships?.[0]?.count || 0;
    const isPaid = community.pricing_type !== "free";
    const price = community.price_amount || 0;
    const isOwner = community.owner_id === profile?.id;
    const isMember = joinedCommunities?.some((c: any) => c.id === community.id);

    const communityUrl = `${window.location.origin}/community/${community.id}`;

    const handleShare = (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(communityUrl);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "Community link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    };

    const handleEdit = (e: React.MouseEvent) => {
      e.stopPropagation();
      navigate(`/community/${community.id}/edit`);
    };

    const handleJoin = (e: React.MouseEvent) => {
      e.stopPropagation();
      joinCommunityMutation.mutate(community.id);
    };

    return (
      <div 
        className="flex items-center gap-4 bg-card rounded-2xl p-4 hover:shadow-elegant transition-all cursor-pointer border border-border/30"
        onClick={() => navigate(`/community/${community.id}`)}
      >
        {/* Community Image */}
        <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex-shrink-0 overflow-hidden">
          {community.avatar_url ? (
            <img src={community.avatar_url} alt={community.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-primary">
              {community.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Community Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-card-foreground mb-1 truncate">
            {community.name}
          </h3>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{memberCount.toLocaleString()} Members</span>
          </div>
        </div>

        {/* Price/Status and Action */}
        <div className="flex items-center gap-3">
          {isPaid ? (
            <>
              <div className="text-right">
                <div className="text-xs text-muted-foreground mb-1">Price</div>
                <div className="text-lg font-bold text-foreground">
                  ${(price / 100).toFixed(2)}
                </div>
              </div>
              <Badge variant="secondary" className="bg-green-500/10 text-green-600 hover:bg-green-500/20 px-3 py-1">
                Paid
              </Badge>
            </>
          ) : (
            <>
              <div className="text-right">
                <div className="text-xs text-muted-foreground mb-1">Status</div>
                <div className="text-lg font-bold text-foreground">Free</div>
              </div>
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 px-3 py-1">
                Free
              </Badge>
            </>
          )}
          {showEdit && (
            <Button 
              size="sm"
              variant="outline"
              className="rounded-xl w-10 h-10 p-0"
              onClick={handleEdit}
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
          <Button 
            size="sm"
            variant="outline"
            className="rounded-xl w-10 h-10 p-0"
            onClick={handleShare}
          >
            {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
          </Button>
          {showJoin && !isOwner && !isMember && (
            <Button 
              size="sm"
              className="rounded-xl px-6"
              onClick={handleJoin}
              disabled={joinCommunityMutation.isPending}
            >
              {joinCommunityMutation.isPending ? "Joining..." : "Join"}
            </Button>
          )}
          {!showJoin && (
            <Button 
              size="sm"
              className="rounded-xl px-6"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/community/${community.id}`);
              }}
            >
              Open
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <main className="flex-1 ml-64">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-card/98 backdrop-blur-md border-b border-border/30 px-8 py-4 shadow-card">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold text-card-foreground">Communities</h1>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search communities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 bg-muted/40 border-border/40"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 hover:bg-accent rounded-full p-1"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-8">
          <div className="max-w-5xl">
            {searchQuery ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-card-foreground">
                    Search Results {searchResults && `(${searchResults.length})`}
                  </h2>
                </div>
                {searchResults && searchResults.length > 0 ? (
                  searchResults.map((community: any) => (
                    <CommunityCard key={community.id} community={community} showJoin={true} />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 glass-card border-2 border-dashed border-border/30 rounded-2xl">
                    <Search className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-center text-card-foreground font-medium">
                      No communities found
                    </p>
                    <p className="text-center text-muted-foreground text-sm mt-1">
                      Try searching with different keywords
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <Tabs defaultValue="owned" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2 bg-accent/30">
                  <TabsTrigger value="owned" className="data-[state=active]:bg-card data-[state=active]:shadow-sm">My Communities</TabsTrigger>
                  <TabsTrigger value="joined" className="data-[state=active]:bg-card data-[state=active]:shadow-sm">Joined Communities</TabsTrigger>
                </TabsList>
              
              <TabsContent value="owned" className="space-y-4 mt-6">
                {ownedCommunities && ownedCommunities.length > 0 ? (
                  ownedCommunities.map((community: any) => (
                    <CommunityCard key={community.id} community={community} showEdit={true} />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 glass-card border-2 border-dashed border-border/30 rounded-2xl">
                    <p className="text-center text-card-foreground font-medium">
                      No communities yet
                    </p>
                    <p className="text-center text-muted-foreground text-sm mt-1">
                      Create your first community to get started
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="joined" className="space-y-4 mt-6">
                {joinedCommunities && joinedCommunities.length > 0 ? (
                  joinedCommunities.map((community: any) => (
                    <CommunityCard key={community.id} community={community} showEdit={false} />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 glass-card border-2 border-dashed border-border/30 rounded-2xl">
                    <p className="text-center text-card-foreground font-medium">
                      No joined communities yet
                    </p>
                    <p className="text-center text-muted-foreground text-sm mt-1">
                      Join a community to see it here
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
