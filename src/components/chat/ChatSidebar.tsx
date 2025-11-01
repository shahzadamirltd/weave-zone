import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MessageSquare, Users, Settings as SettingsIcon, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface ChatSidebarProps {
  currentUserId?: string;
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
}

export function ChatSidebar({ currentUserId, selectedUserId, onSelectUser }: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all users with their latest messages and presence
  const { data: conversations } = useQuery({
    queryKey: ["conversations", currentUserId],
    queryFn: async () => {
      if (!currentUserId) return [];

      // Get all unique users I've chatted with
      const { data: messages } = await supabase
        .from("messages")
        .select(`
          sender_id,
          receiver_id,
          content,
          media_type,
          created_at,
          is_read
        `)
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .order("created_at", { ascending: false });

      if (!messages) return [];

      // Get unique user IDs
      const userIds = new Set<string>();
      messages.forEach((msg) => {
        const otherUserId = msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id;
        userIds.add(otherUserId);
      });

      // Fetch user profiles and presence
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", Array.from(userIds));

      const { data: presenceData } = await supabase
        .from("user_presence")
        .select("*")
        .in("user_id", Array.from(userIds));

      // Build conversations with latest message
      return Array.from(userIds).map((userId) => {
        const profile = profiles?.find((p) => p.id === userId);
        const presence = presenceData?.find((p) => p.user_id === userId);
        
        // Find latest message with this user
        const latestMsg = messages.find(
          (msg) =>
            (msg.sender_id === currentUserId && msg.receiver_id === userId) ||
            (msg.sender_id === userId && msg.receiver_id === currentUserId)
        );

        // Count unread messages from this user
        const unreadCount = messages.filter(
          (msg) => msg.sender_id === userId && msg.receiver_id === currentUserId && !msg.is_read
        ).length;

        return {
          userId,
          profile,
          presence,
          latestMessage: latestMsg,
          unreadCount,
        };
      }).sort((a, b) => {
        const aTime = a.latestMessage?.created_at || "";
        const bTime = b.latestMessage?.created_at || "";
        return bTime.localeCompare(aTime);
      });
    },
    enabled: !!currentUserId,
  });

  const { data: allUsers } = useQuery({
    queryKey: ["all-users", currentUserId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", currentUserId || "");
      return data || [];
    },
    enabled: !!currentUserId,
  });

  const filteredConversations = conversations?.filter((conv) =>
    conv.profile?.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const recentChats = filteredConversations?.slice(0, 5);

  return (
    <div className="w-80 border-r border-border flex flex-col bg-background h-screen">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Chats</h2>
          <div className="flex gap-2">
            <button className="p-2 hover:bg-muted rounded-full transition-colors">
              <MessageSquare className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search For Contacts or Messages"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Recent Chats */}
      {recentChats && recentChats.length > 0 && (
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Recent Chats</h3>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {recentChats.map((conv) => (
              <button
                key={conv.userId}
                onClick={() => onSelectUser(conv.userId)}
                className="flex-shrink-0 text-center"
              >
                <div className="relative">
                  <Avatar className="h-14 w-14 border-2 border-primary">
                    <AvatarImage src={conv.profile?.avatar_url || ""} />
                    <AvatarFallback>{conv.profile?.username?.[0] || "U"}</AvatarFallback>
                  </Avatar>
                  {conv.presence?.is_online && (
                    <div className="absolute bottom-0 right-0 h-4 w-4 bg-green-500 rounded-full border-2 border-background" />
                  )}
                </div>
                <p className="text-xs mt-1 truncate max-w-[60px]">
                  {conv.profile?.username || "User"}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* All Chats */}
      <div className="flex-1 overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">All Chats</h3>
        </div>
        <ScrollArea className="h-full">
          <div className="px-2">
            {filteredConversations?.map((conv) => (
              <button
                key={conv.userId}
                onClick={() => onSelectUser(conv.userId)}
                className={cn(
                  "w-full p-3 rounded-lg hover:bg-muted transition-colors flex items-start gap-3 mb-1",
                  selectedUserId === conv.userId && "bg-muted"
                )}
              >
                <div className="relative flex-shrink-0">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={conv.profile?.avatar_url || ""} />
                    <AvatarFallback>{conv.profile?.username?.[0] || "U"}</AvatarFallback>
                  </Avatar>
                  {conv.presence?.is_online && (
                    <div className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-background" />
                  )}
                </div>
                
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-sm truncate">
                        {conv.profile?.username || "Unknown User"}
                      </h4>
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                      {conv.latestMessage?.created_at
                        ? formatDistanceToNow(new Date(conv.latestMessage.created_at), {
                            addSuffix: false,
                          }).replace("about ", "")
                        : ""}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.latestMessage?.media_type === "image" && "📷 Photo"}
                      {conv.latestMessage?.media_type === "audio" && "🎵 Audio"}
                      {conv.latestMessage?.media_type === "file" && "📎 File"}
                      {!conv.latestMessage?.media_type && (conv.latestMessage?.content || "No messages yet")}
                    </p>
                    {conv.unreadCount > 0 && (
                      <Badge variant="destructive" className="ml-2 h-5 min-w-5 rounded-full flex items-center justify-center text-xs">
                        {conv.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
