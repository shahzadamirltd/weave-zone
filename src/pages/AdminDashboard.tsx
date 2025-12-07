import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  DollarSign,
  Shield,
  LogOut,
  Search,
  Ban,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Globe,
  Clock,
  TrendingUp,
  Loader2,
  Plus,
  ShieldBan,
  Activity,
  Radio,
  MessageCircle,
  Send,
  ExternalLink,
  FileText,
  UserCheck,
  Wallet,
  Pause,
} from "lucide-react";
import { format, subDays, startOfDay, subMinutes } from "date-fns";

const COUNTRIES = [
  { code: "AF", name: "Afghanistan" },
  { code: "CN", name: "China" },
  { code: "RU", name: "Russia" },
  { code: "IR", name: "Iran" },
  { code: "KP", name: "North Korea" },
  { code: "SY", name: "Syria" },
  { code: "PK", name: "Pakistan" },
  { code: "NG", name: "Nigeria" },
  { code: "IN", name: "India" },
  { code: "BD", name: "Bangladesh" },
  { code: "VN", name: "Vietnam" },
  { code: "ID", name: "Indonesia" },
  { code: "PH", name: "Philippines" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showBlockIPDialog, setShowBlockIPDialog] = useState(false);
  const [showBlockCountryDialog, setShowBlockCountryDialog] = useState(false);
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [newBlockIP, setNewBlockIP] = useState({ ip: "", reason: "" });
  const [newBlockCountry, setNewBlockCountry] = useState({ code: "", reason: "" });
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/admin-login");
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        navigate("/admin-login");
        return;
      }
      setIsAdmin(true);
    };

    checkAdmin();
  }, [navigate]);

  // Fetch all users
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin === true,
  });

  // Fetch active users (last 5 minutes)
  const { data: liveUsers } = useQuery({
    queryKey: ["admin-live-users"],
    queryFn: async () => {
      const fiveMinutesAgo = subMinutes(new Date(), 5).toISOString();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .gte("last_seen_at", fiveMinutesAgo)
        .order("last_seen_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin === true,
    refetchInterval: 10000,
  });

  // Fetch all payments
  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, communities(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin === true,
  });

  // Fetch pending payouts
  const { data: payouts, isLoading: payoutsLoading } = useQuery({
    queryKey: ["admin-payouts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payouts")
        .select("*, communities(name), profiles:creator_id(username)")
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin === true,
  });

  // Fetch all posts
  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ["admin-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*, communities(name), profiles:author_id(username)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: isAdmin === true,
  });

  // Fetch communities
  const { data: communities } = useQuery({
    queryKey: ["admin-communities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communities")
        .select("*, profiles:owner_id(username)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin === true,
  });

  // Fetch IP blocklist
  const { data: ipBlocklist } = useQuery({
    queryKey: ["admin-ip-blocklist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ip_blocklist")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin === true,
  });

  // Fetch country blocklist
  const { data: countryBlocklist } = useQuery({
    queryKey: ["admin-country-blocklist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("country_blocklist")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin === true,
  });

  // Fetch support chats
  const { data: supportChats } = useQuery({
    queryKey: ["admin-support-chats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_chats")
        .select("*, profiles:user_id(username, avatar_url)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin === true,
    refetchInterval: 5000,
  });

  // Fetch chat messages for selected chat
  const { data: chatMessages } = useQuery({
    queryKey: ["admin-chat-messages", selectedChat?.id],
    queryFn: async () => {
      if (!selectedChat) return [];
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("chat_id", selectedChat.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedChat,
    refetchInterval: 2000,
  });

  // Fetch user stats for selected user
  const { data: userStats } = useQuery({
    queryKey: ["admin-user-stats", selectedUser?.id],
    queryFn: async () => {
      if (!selectedUser) return null;
      
      // Fetch communities created
      const { data: createdCommunities } = await supabase
        .from("communities")
        .select("id, name")
        .eq("owner_id", selectedUser.id);
      
      // Fetch communities joined
      const { data: joinedMemberships } = await supabase
        .from("memberships")
        .select("community_id, communities(name)")
        .eq("user_id", selectedUser.id);
      
      // Fetch posts
      const { data: userPosts } = await supabase
        .from("posts")
        .select("id, content, created_at, communities(name)")
        .eq("author_id", selectedUser.id)
        .order("created_at", { ascending: false })
        .limit(10);
      
      // Fetch earnings
      const { data: userPayments } = await supabase
        .from("payments")
        .select("creator_earnings")
        .in("community_id", createdCommunities?.map(c => c.id) || [])
        .eq("status", "completed");
      
      const totalEarnings = userPayments?.reduce((sum, p) => sum + Number(p.creator_earnings), 0) || 0;
      
      // Get total followers (members in communities they own)
      const { data: followers } = await supabase
        .from("memberships")
        .select("id")
        .in("community_id", createdCommunities?.map(c => c.id) || []);
      
      return {
        createdCommunities: createdCommunities || [],
        joinedCommunities: joinedMemberships || [],
        posts: userPosts || [],
        totalEarnings,
        totalFollowers: followers?.length || 0,
      };
    },
    enabled: !!selectedUser,
  });

  // Subscribe to realtime chat updates
  useEffect(() => {
    if (!selectedChat) return;

    const channel = supabase
      .channel(`admin-chat-${selectedChat.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `chat_id=eq.${selectedChat.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-chat-messages", selectedChat.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChat, queryClient]);

  // Auto scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Mutations
  const suspendMutation = useMutation({
    mutationFn: async ({ userId, suspend }: { userId: string; suspend: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          suspended: suspend,
          suspended_at: suspend ? new Date().toISOString() : null,
        })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: (_, { suspend }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(suspend ? "User suspended" : "User unsuspended");
    },
    onError: () => toast.error("Failed to update user status"),
  });

  const processPayoutMutation = useMutation({
    mutationFn: async ({ payoutId, status }: { payoutId: string; status: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("payouts")
        .update({
          status,
          processed_at: new Date().toISOString(),
          processed_by: user?.id,
        })
        .eq("id", payoutId);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-payouts"] });
      toast.success(`Payout ${status}`);
    },
    onError: () => toast.error("Failed to process payout"),
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from("posts").delete().eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
      toast.success("Post deleted");
    },
    onError: () => toast.error("Failed to delete post"),
  });

  const blockIPMutation = useMutation({
    mutationFn: async ({ ip, reason }: { ip: string; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("ip_blocklist").insert({
        ip_address: ip,
        reason,
        blocked_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ip-blocklist"] });
      toast.success("IP blocked successfully");
      setShowBlockIPDialog(false);
      setNewBlockIP({ ip: "", reason: "" });
    },
    onError: (e: any) => toast.error(e.message || "Failed to block IP"),
  });

  const unblockIPMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ip_blocklist").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ip-blocklist"] });
      toast.success("IP unblocked");
    },
    onError: () => toast.error("Failed to unblock IP"),
  });

  const blockCountryMutation = useMutation({
    mutationFn: async ({ code, reason }: { code: string; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const country = COUNTRIES.find(c => c.code === code);
      const { error } = await supabase.from("country_blocklist").insert({
        country_code: code,
        country_name: country?.name || code,
        reason,
        blocked_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-country-blocklist"] });
      toast.success("Country blocked successfully");
      setShowBlockCountryDialog(false);
      setNewBlockCountry({ code: "", reason: "" });
    },
    onError: (e: any) => toast.error(e.message || "Failed to block country"),
  });

  const unblockCountryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("country_blocklist").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-country-blocklist"] });
      toast.success("Country unblocked");
    },
    onError: () => toast.error("Failed to unblock country"),
  });

  const sendChatMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedChat) throw new Error("No chat selected");
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("support_messages").insert({
        chat_id: selectedChat.id,
        sender_id: user?.id,
        content,
        is_admin: true,
      });
      if (error) throw error;

      // Update chat status to active
      await supabase
        .from("support_chats")
        .update({ status: "active", admin_id: user?.id })
        .eq("id", selectedChat.id);
    },
    onSuccess: () => {
      setChatMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-chat-messages", selectedChat?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-support-chats"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const closeChatMutation = useMutation({
    mutationFn: async (chatId: string) => {
      const { error } = await supabase
        .from("support_chats")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", chatId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-support-chats"] });
      setSelectedChat(null);
      toast.success("Chat closed");
    },
  });

  const blockUserIP = (user: any) => {
    if (user.ip_address) {
      blockIPMutation.mutate({ ip: user.ip_address, reason: `Blocked from user: ${user.username}` });
    } else {
      toast.error("User has no recorded IP address");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin-login");
  };

  // Calculate stats
  const today = new Date();
  const todayPayments = payments?.filter(
    (p) => new Date(p.created_at) >= startOfDay(today) && p.status === "completed"
  ) || [];
  const monthPayments = payments?.filter(
    (p) => new Date(p.created_at) >= subDays(today, 30) && p.status === "completed"
  ) || [];

  const totalToday = todayPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalMonth = monthPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  const activeUsers = users?.filter(u => !u.suspended).length || 0;
  const suspendedUsers = users?.filter(u => u.suspended).length || 0;
  const pendingPayouts = payouts?.filter(p => p.status === "pending") || [];
  const pendingChats = supportChats?.filter(c => c.status === "pending") || [];

  const filteredUsers = users?.filter(
    (u) =>
      u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.id.includes(searchTerm) ||
      u.ip_address?.includes(searchTerm) ||
      u.country?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      {/* Modern Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text">
                Admin Dashboard
              </h1>
              <p className="text-xs text-muted-foreground">Platform Control Center</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {pendingChats.length > 0 && (
              <div className="flex items-center gap-2 bg-orange-500/10 text-orange-500 px-3 py-2 rounded-xl animate-pulse">
                <MessageCircle className="h-4 w-4" />
                <span className="font-semibold text-sm">{pendingChats.length} New Chat{pendingChats.length > 1 ? 's' : ''}</span>
              </div>
            )}
            <div className="flex items-center gap-2 bg-green-500/10 text-green-500 px-3 py-2 rounded-xl">
              <Radio className="h-4 w-4 animate-pulse" />
              <span className="font-semibold text-sm">{liveUsers?.length || 0} Live</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} className="rounded-xl">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <Card className="bg-card/60 backdrop-blur border-border/50 hover:shadow-lg transition-all">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <Users className="h-5 w-5 text-muted-foreground" />
                <Badge variant="secondary" className="text-xs">{suspendedUsers} suspended</Badge>
              </div>
              <p className="text-2xl font-bold mt-2">{users?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Total Users</p>
            </CardContent>
          </Card>

          <Card className="bg-green-500/5 border-green-500/30 hover:shadow-lg transition-all">
            <CardContent className="pt-4">
              <Activity className="h-5 w-5 text-green-500" />
              <p className="text-2xl font-bold mt-2 text-green-500">{liveUsers?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Live Now</p>
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur border-border/50 hover:shadow-lg transition-all">
            <CardContent className="pt-4">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <p className="text-2xl font-bold mt-2">${totalToday.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">Today's Revenue</p>
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur border-border/50 hover:shadow-lg transition-all">
            <CardContent className="pt-4">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <p className="text-2xl font-bold mt-2">${totalMonth.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">Monthly Revenue</p>
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur border-border/50 hover:shadow-lg transition-all">
            <CardContent className="pt-4">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <p className="text-2xl font-bold mt-2">{pendingPayouts.length}</p>
              <p className="text-xs text-muted-foreground">Pending Payouts</p>
            </CardContent>
          </Card>

          <Card className="bg-orange-500/5 border-orange-500/30 hover:shadow-lg transition-all">
            <CardContent className="pt-4">
              <MessageCircle className="h-5 w-5 text-orange-500" />
              <p className="text-2xl font-bold mt-2 text-orange-500">{pendingChats.length}</p>
              <p className="text-xs text-muted-foreground">Pending Chats</p>
            </CardContent>
          </Card>
        </div>

        {/* Live Users Panel */}
        {liveUsers && liveUsers.length > 0 && (
          <Card className="mb-6 border-green-500/30 bg-gradient-to-r from-green-500/5 to-transparent">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Radio className="h-5 w-5 text-green-500 animate-pulse" />
                Live Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {liveUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-2 bg-card border border-border/50 rounded-xl px-3 py-2 hover:border-primary/50 transition-all cursor-pointer"
                    onClick={() => {
                      setSelectedUser(user);
                      setShowUserDialog(true);
                    }}
                  >
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-medium text-sm">{user.username}</span>
                    {user.country && (
                      <span className="text-xs text-muted-foreground">({user.country})</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Tabs */}
        <Tabs defaultValue="chats" className="space-y-4">
          <TabsList className="grid grid-cols-8 w-full bg-card/60 backdrop-blur rounded-xl p-1">
            <TabsTrigger value="chats" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <MessageCircle className="h-4 w-4 mr-2" />
              Chats {pendingChats.length > 0 && <Badge className="ml-2 h-5 w-5 p-0 justify-center bg-orange-500">{pendingChats.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Users</TabsTrigger>
            <TabsTrigger value="payments" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Payments</TabsTrigger>
            <TabsTrigger value="payouts" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Payouts</TabsTrigger>
            <TabsTrigger value="posts" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Posts</TabsTrigger>
            <TabsTrigger value="communities" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Communities</TabsTrigger>
            <TabsTrigger value="ip-blocks" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">IP Blocks</TabsTrigger>
            <TabsTrigger value="country-blocks" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Countries</TabsTrigger>
          </TabsList>

          {/* Live Chat Tab */}
          <TabsContent value="chats">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Chat List */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Support Chats</CardTitle>
                  <CardDescription>Click to respond to users</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    {supportChats?.map((chat: any) => (
                      <div
                        key={chat.id}
                        className={`p-4 border-b border-border/50 cursor-pointer hover:bg-muted/50 transition-all ${selectedChat?.id === chat.id ? 'bg-primary/10' : ''}`}
                        onClick={() => setSelectedChat(chat)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/20 text-primary">
                                {chat.profiles?.username?.[0]?.toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-sm">{chat.profiles?.username || 'User'}</span>
                          </div>
                          <Badge variant={chat.status === 'pending' ? 'destructive' : chat.status === 'active' ? 'default' : 'secondary'}>
                            {chat.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(chat.updated_at), "MMM d, HH:mm")}
                        </p>
                      </div>
                    ))}
                    {(!supportChats || supportChats.length === 0) && (
                      <div className="p-8 text-center text-muted-foreground">
                        No support chats yet
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Chat Window */}
              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>
                      {selectedChat ? `Chat with ${selectedChat.profiles?.username}` : 'Select a chat'}
                    </CardTitle>
                    <CardDescription>
                      {selectedChat ? `Status: ${selectedChat.status}` : 'Click on a chat to start responding'}
                    </CardDescription>
                  </div>
                  {selectedChat && selectedChat.status !== 'closed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => closeChatMutation.mutate(selectedChat.id)}
                    >
                      Close Chat
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {selectedChat ? (
                    <div className="space-y-4">
                      <ScrollArea className="h-[350px] pr-4" ref={chatScrollRef}>
                        <div className="space-y-4">
                          {chatMessages?.map((msg: any) => (
                            <div
                              key={msg.id}
                              className={`flex ${msg.is_admin ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[70%] rounded-2xl p-3 ${
                                  msg.is_admin
                                    ? 'bg-primary text-primary-foreground rounded-br-none'
                                    : 'bg-muted rounded-bl-none'
                                }`}
                              >
                                <p className="text-sm">{msg.content}</p>
                                <p className={`text-xs mt-1 ${msg.is_admin ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                  {format(new Date(msg.created_at), "HH:mm")}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      
                      {selectedChat.status !== 'closed' && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (chatMessage.trim()) {
                              sendChatMessageMutation.mutate(chatMessage);
                            }
                          }}
                          className="flex gap-2"
                        >
                          <Input
                            value={chatMessage}
                            onChange={(e) => setChatMessage(e.target.value)}
                            placeholder="Type your response..."
                            className="flex-1 rounded-xl"
                          />
                          <Button type="submit" className="rounded-xl" disabled={!chatMessage.trim()}>
                            <Send className="h-4 w-4" />
                          </Button>
                        </form>
                      )}
                    </div>
                  ) : (
                    <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Select a chat to view messages</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>View and manage all user accounts</CardDescription>
                  </div>
                </div>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by username, ID, IP, or country..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 rounded-xl"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/50 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead>User</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Last Seen</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers?.map((user) => (
                          <TableRow key={user.id} className="hover:bg-muted/30">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-primary/20 text-primary text-xs">
                                    {user.username?.[0]?.toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{user.username}</p>
                                  <p className="text-xs text-muted-foreground font-mono">{user.id.slice(0, 8)}...</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {user.suspended ? (
                                <Badge variant="destructive">Suspended</Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-green-500/10 text-green-600">Active</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm">
                                <Globe className="h-3 w-3" />
                                {user.country || "Unknown"}
                              </div>
                              <p className="text-xs text-muted-foreground font-mono">{user.ip_address || "No IP"}</p>
                            </TableCell>
                            <TableCell className="text-sm">
                              {user.last_seen_at
                                ? format(new Date(user.last_seen_at), "MMM d, HH:mm")
                                : "Never"}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg"
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setShowUserDialog(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant={user.suspended ? "default" : "destructive"}
                                  className="rounded-lg"
                                  onClick={() =>
                                    suspendMutation.mutate({
                                      userId: user.id,
                                      suspend: !user.suspended,
                                    })
                                  }
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg"
                                  onClick={() => blockUserIP(user)}
                                  title="Block IP"
                                >
                                  <ShieldBan className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>All platform transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Date</TableHead>
                        <TableHead>Community</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Platform Fee</TableHead>
                        <TableHead>Creator Earnings</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments?.map((payment) => (
                        <TableRow key={payment.id} className="hover:bg-muted/30">
                          <TableCell className="text-sm">
                            {format(new Date(payment.created_at), "MMM d, yyyy HH:mm")}
                          </TableCell>
                          <TableCell>{payment.communities?.name || "N/A"}</TableCell>
                          <TableCell className="font-medium">
                            ${Number(payment.amount).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">${Number(payment.platform_fee).toFixed(2)}</TableCell>
                          <TableCell className="text-green-600">${Number(payment.creator_earnings).toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                payment.status === "completed"
                                  ? "default"
                                  : payment.status === "pending"
                                  ? "secondary"
                                  : "destructive"
                              }
                            >
                              {payment.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payouts Tab */}
          <TabsContent value="payouts">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Payout Requests</CardTitle>
                <CardDescription>Manage withdrawal requests from creators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Date</TableHead>
                        <TableHead>Creator</TableHead>
                        <TableHead>Community</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Bank Details</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payouts?.map((payout) => (
                        <TableRow key={payout.id} className="hover:bg-muted/30">
                          <TableCell className="text-sm">
                            {format(new Date(payout.requested_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="font-medium">{(payout as any).profiles?.username || "N/A"}</TableCell>
                          <TableCell>{payout.communities?.name || "N/A"}</TableCell>
                          <TableCell className="font-bold text-green-600">
                            ${Number(payout.amount).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{payout.payment_method || "N/A"}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            <p className="truncate text-xs text-muted-foreground">{payout.bank_details || "N/A"}</p>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                payout.status === "completed"
                                  ? "default"
                                  : payout.status === "pending"
                                  ? "secondary"
                                  : payout.status === "on_hold"
                                  ? "outline"
                                  : "destructive"
                              }
                            >
                              {payout.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {payout.status === "pending" && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="rounded-lg bg-green-600 hover:bg-green-700"
                                  onClick={() =>
                                    processPayoutMutation.mutate({
                                      payoutId: payout.id,
                                      status: "completed",
                                    })
                                  }
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg"
                                  onClick={() =>
                                    processPayoutMutation.mutate({
                                      payoutId: payout.id,
                                      status: "on_hold",
                                    })
                                  }
                                >
                                  <Pause className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="rounded-lg"
                                  onClick={() =>
                                    processPayoutMutation.mutate({
                                      payoutId: payout.id,
                                      status: "rejected",
                                    })
                                  }
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Posts Tab */}
          <TabsContent value="posts">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Community Posts</CardTitle>
                <CardDescription>Click to view, moderate content</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Date</TableHead>
                        <TableHead>Author</TableHead>
                        <TableHead>Community</TableHead>
                        <TableHead>Content</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {posts?.map((post) => (
                        <TableRow
                          key={post.id}
                          className="hover:bg-muted/30 cursor-pointer"
                          onClick={() => {
                            setSelectedPost(post);
                            setShowPostDialog(true);
                          }}
                        >
                          <TableCell className="text-sm">
                            {format(new Date(post.created_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="font-medium">{(post as any).profiles?.username || "N/A"}</TableCell>
                          <TableCell>{post.communities?.name || "N/A"}</TableCell>
                          <TableCell className="max-w-[300px]">
                            <p className="truncate">{post.content}</p>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg"
                                onClick={() => {
                                  setSelectedPost(post);
                                  setShowPostDialog(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="rounded-lg"
                                onClick={() => deletePostMutation.mutate(post.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Communities Tab */}
          <TabsContent value="communities">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>All Communities</CardTitle>
                <CardDescription>Platform communities overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Name</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Pricing</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {communities?.map((community) => (
                        <TableRow key={community.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium">{community.name}</TableCell>
                          <TableCell>{(community as any).profiles?.username || "N/A"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{community.pricing_type}</Badge>
                          </TableCell>
                          <TableCell>
                            {community.price_amount
                              ? `$${Number(community.price_amount).toFixed(2)}`
                              : "Free"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(community.created_at), "MMM d, yyyy")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* IP Blocks Tab */}
          <TabsContent value="ip-blocks">
            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>IP Blocklist</CardTitle>
                  <CardDescription>Blocked IP addresses cannot access the app</CardDescription>
                </div>
                <Button onClick={() => setShowBlockIPDialog(true)} className="rounded-xl">
                  <Plus className="h-4 w-4 mr-2" />
                  Block IP
                </Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>IP Address</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Blocked At</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ipBlocklist?.map((block) => (
                        <TableRow key={block.id} className="hover:bg-muted/30">
                          <TableCell className="font-mono">{block.ip_address}</TableCell>
                          <TableCell>{block.reason || "No reason"}</TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(block.created_at), "MMM d, yyyy HH:mm")}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="rounded-lg"
                              onClick={() => unblockIPMutation.mutate(block.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!ipBlocklist || ipBlocklist.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            No blocked IP addresses
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Country Blocks Tab */}
          <TabsContent value="country-blocks">
            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Country Blocklist</CardTitle>
                  <CardDescription>Users from blocked countries cannot access the app</CardDescription>
                </div>
                <Button onClick={() => setShowBlockCountryDialog(true)} className="rounded-xl">
                  <Plus className="h-4 w-4 mr-2" />
                  Block Country
                </Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Country</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Blocked At</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {countryBlocklist?.map((block) => (
                        <TableRow key={block.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium">{block.country_name}</TableCell>
                          <TableCell>{block.country_code}</TableCell>
                          <TableCell>{block.reason || "No reason"}</TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(block.created_at), "MMM d, yyyy HH:mm")}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="rounded-lg"
                              onClick={() => unblockCountryMutation.mutate(block.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!countryBlocklist || countryBlocklist.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No blocked countries
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Enhanced User Details Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/20 text-primary">
                  {selectedUser?.username?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {selectedUser?.username}
            </DialogTitle>
            <DialogDescription>Complete user profile and analytics</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6">
              {/* Basic Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">User ID</p>
                  <p className="font-mono text-xs break-all">{selectedUser.id}</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">Username</p>
                  <p className="font-medium">{selectedUser.username}</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">Country</p>
                  <p className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    {selectedUser.country || "Unknown"}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">IP Address</p>
                  <p className="font-mono text-xs">{selectedUser.ip_address || "Unknown"}</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  {selectedUser.suspended ? (
                    <Badge variant="destructive">Suspended</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-green-500/10 text-green-600">Active</Badge>
                  )}
                </div>
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">Joined</p>
                  <p className="text-sm">{format(new Date(selectedUser.created_at), "PPP")}</p>
                </div>
              </div>

              <Separator />

              {/* Analytics Section */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-primary/10 to-transparent rounded-xl p-4 text-center">
                  <Wallet className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold">${userStats?.totalEarnings?.toFixed(2) || '0.00'}</p>
                  <p className="text-xs text-muted-foreground">Total Earnings</p>
                </div>
                <div className="bg-gradient-to-br from-secondary/10 to-transparent rounded-xl p-4 text-center">
                  <Users className="h-6 w-6 mx-auto mb-2 text-secondary" />
                  <p className="text-2xl font-bold">{userStats?.totalFollowers || 0}</p>
                  <p className="text-xs text-muted-foreground">Total Followers</p>
                </div>
                <div className="bg-gradient-to-br from-muted to-transparent rounded-xl p-4 text-center">
                  <FileText className="h-6 w-6 mx-auto mb-2" />
                  <p className="text-2xl font-bold">{userStats?.posts?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Total Posts</p>
                </div>
              </div>

              {/* Communities Created */}
              {userStats?.createdCommunities && userStats.createdCommunities.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    Communities Created ({userStats.createdCommunities.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {userStats.createdCommunities.map((c: any) => (
                      <Badge key={c.id} variant="outline">{c.name}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Communities Joined */}
              {userStats?.joinedCommunities && userStats.joinedCommunities.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Communities Joined ({userStats.joinedCommunities.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {userStats.joinedCommunities.map((m: any) => (
                      <Badge key={m.community_id} variant="secondary">{m.communities?.name || 'Unknown'}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Posts */}
              {userStats?.posts && userStats.posts.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Recent Posts
                  </h4>
                  <div className="space-y-2 max-h-[150px] overflow-y-auto">
                    {userStats.posts.map((post: any) => (
                      <div key={post.id} className="bg-muted/30 rounded-lg p-3">
                        <p className="text-sm truncate">{post.content || 'No content'}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {post.communities?.name} • {format(new Date(post.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedUser.bio && (
                <div>
                  <h4 className="font-semibold mb-2">Bio</h4>
                  <p className="text-sm text-muted-foreground">{selectedUser.bio}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => window.open(`/profile?user=${selectedUser?.id}`, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Profile
            </Button>
            {selectedUser?.ip_address && (
              <Button
                variant="outline"
                onClick={() => {
                  blockUserIP(selectedUser);
                  setShowUserDialog(false);
                }}
              >
                <ShieldBan className="h-4 w-4 mr-2" />
                Block IP
              </Button>
            )}
            <Button
              variant={selectedUser?.suspended ? "default" : "destructive"}
              onClick={() => {
                suspendMutation.mutate({
                  userId: selectedUser.id,
                  suspend: !selectedUser.suspended,
                });
                setShowUserDialog(false);
              }}
            >
              {selectedUser?.suspended ? "Unsuspend User" : "Suspend User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post Preview Dialog */}
      <Dialog open={showPostDialog} onOpenChange={setShowPostDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Post Details</DialogTitle>
            <DialogDescription>
              By {(selectedPost as any)?.profiles?.username} in {selectedPost?.communities?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedPost && (
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-xl p-4">
                <p className="whitespace-pre-wrap">{selectedPost.content}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Posted on {format(new Date(selectedPost.created_at), "PPP 'at' HH:mm")}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPostDialog(false)}>
              Close
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deletePostMutation.mutate(selectedPost.id);
                setShowPostDialog(false);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block IP Dialog */}
      <Dialog open={showBlockIPDialog} onOpenChange={setShowBlockIPDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block IP Address</DialogTitle>
            <DialogDescription>
              Users from this IP will be blocked from accessing the app
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ip">IP Address</Label>
              <Input
                id="ip"
                placeholder="e.g., 192.168.1.1"
                value={newBlockIP.ip}
                onChange={(e) => setNewBlockIP({ ...newBlockIP, ip: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                placeholder="Why is this IP being blocked?"
                value={newBlockIP.reason}
                onChange={(e) => setNewBlockIP({ ...newBlockIP, reason: e.target.value })}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBlockIPDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => blockIPMutation.mutate(newBlockIP)}
              disabled={!newBlockIP.ip}
            >
              Block IP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block Country Dialog */}
      <Dialog open={showBlockCountryDialog} onOpenChange={setShowBlockCountryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block Country</DialogTitle>
            <DialogDescription>
              Users from this country will be blocked from accessing the app
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Select
                value={newBlockCountry.code}
                onValueChange={(value) => setNewBlockCountry({ ...newBlockCountry, code: value })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select a country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      {country.name} ({country.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="country-reason">Reason (optional)</Label>
              <Textarea
                id="country-reason"
                placeholder="Why is this country being blocked?"
                value={newBlockCountry.reason}
                onChange={(e) => setNewBlockCountry({ ...newBlockCountry, reason: e.target.value })}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBlockCountryDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => blockCountryMutation.mutate(newBlockCountry)}
              disabled={!newBlockCountry.code}
            >
              Block Country
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
