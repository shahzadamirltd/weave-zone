import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Share2, Check, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Dashboard() {
  const navigate = useNavigate();

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

  const CommunityCard = ({ community, showEdit }: any) => {
    const { toast } = useToast();
    const [copied, setCopied] = useState(false);
    const memberCount = community.memberships?.[0]?.count || 0;
    const isPaid = community.pricing_type !== "free";
    const price = community.price_amount || 0;

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

    return (
      <div 
        className="flex items-center gap-4 bg-white rounded-2xl p-4 hover:shadow-lg transition-all cursor-pointer border border-border/50"
        onClick={() => navigate(`/community/${community.id}`)}
      >
        {/* Community Image */}
        <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex-shrink-0 overflow-hidden">
          {community.avatar_url ? (
            <img src={community.avatar_url} alt={community.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-primary/40">
              {community.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Community Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-foreground mb-1 truncate">
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
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 ml-64">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50 px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Communities</h1>
            <Button variant="ghost" size="icon" className="rounded-lg">
              <Search className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Content */}
        <div className="p-8">
          <div className="max-w-5xl">
            <Tabs defaultValue="owned" className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="owned">My Communities</TabsTrigger>
                <TabsTrigger value="joined">Joined Communities</TabsTrigger>
              </TabsList>
              
              <TabsContent value="owned" className="space-y-4 mt-6">
                {ownedCommunities && ownedCommunities.length > 0 ? (
                  ownedCommunities.map((community: any) => (
                    <CommunityCard key={community.id} community={community} showEdit={true} />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 glass border-2 border-dashed border-border/50 rounded-2xl">
                    <p className="text-center text-muted-foreground font-medium">
                      No communities yet
                    </p>
                    <p className="text-center text-muted-foreground/60 text-sm mt-1">
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
                  <div className="flex flex-col items-center justify-center py-20 glass border-2 border-dashed border-border/50 rounded-2xl">
                    <p className="text-center text-muted-foreground font-medium">
                      No joined communities yet
                    </p>
                    <p className="text-center text-muted-foreground/60 text-sm mt-1">
                      Join a community to see it here
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}
