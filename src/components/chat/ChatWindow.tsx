import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { 
  Search, Phone, Video, MoreVertical, Send, 
  Image as ImageIcon, Smile, Mic
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatWindowProps {
  currentUserId?: string;
  selectedUserId: string | null;
}

export function ChatWindow({ currentUserId, selectedUserId }: ChatWindowProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [messageText, setMessageText] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch selected user profile
  const { data: selectedUser } = useQuery({
    queryKey: ["user-profile", selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", selectedUserId)
        .single();
      return data;
    },
    enabled: !!selectedUserId,
  });

  // Fetch user presence
  const { data: presence } = useQuery({
    queryKey: ["user-presence", selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return null;
      const { data } = await supabase
        .from("user_presence")
        .select("*")
        .eq("user_id", selectedUserId)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedUserId,
  });

  // Fetch messages
  const { data: messages } = useQuery({
    queryKey: ["messages", currentUserId, selectedUserId],
    queryFn: async () => {
      if (!currentUserId || !selectedUserId) return [];
      
      const { data } = await supabase
        .from("messages")
        .select(`
          *,
          message_reactions(*)
        `)
        .or(
          `and(sender_id.eq.${currentUserId},receiver_id.eq.${selectedUserId}),and(sender_id.eq.${selectedUserId},receiver_id.eq.${currentUserId})`
        )
        .order("created_at", { ascending: true });

      return data || [];
    },
    enabled: !!currentUserId && !!selectedUserId,
  });

  // Set up realtime subscription for messages
  useEffect(() => {
    if (!currentUserId || !selectedUserId) return;

    const channel = supabase
      .channel(`messages-${currentUserId}-${selectedUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["messages", currentUserId, selectedUserId] });
          queryClient.invalidateQueries({ queryKey: ["conversations", currentUserId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, selectedUserId, queryClient]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserId || !selectedUserId) throw new Error("Missing user IDs");
      if (!messageText.trim() && !mediaFile) throw new Error("Message is empty");

      let mediaUrl = null;
      let mediaType = null;

      if (mediaFile) {
        const fileExt = mediaFile.name.split(".").pop();
        const fileName = `${currentUserId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("chat-media")
          .upload(fileName, mediaFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("chat-media")
          .getPublicUrl(fileName);

        mediaUrl = publicUrl;
        mediaType = mediaFile.type.startsWith("image/") ? "image" : 
                   mediaFile.type.startsWith("audio/") ? "audio" : "file";
      }

      const { error } = await supabase.from("messages").insert({
        sender_id: currentUserId,
        receiver_id: selectedUserId,
        content: messageText.trim() || null,
        media_url: mediaUrl,
        media_type: mediaType,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setMessageText("");
      setMediaFile(null);
      queryClient.invalidateQueries({ queryKey: ["messages", currentUserId, selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ["conversations", currentUserId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!selectedUserId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-6xl mb-4">👋</div>
          <p className="text-muted-foreground">Select a conversation to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="h-16 border-b border-border px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
          <Avatar className="h-10 w-10">
              <AvatarImage src={selectedUser?.avatar_url || ""} />
              <AvatarFallback>{selectedUser?.username?.[0] || "U"}</AvatarFallback>
            </Avatar>
            {presence?.is_online && (
              <div className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-background" />
            )}
          </div>
          <div>
            <h3 className="font-semibold">{selectedUser?.username || "User"}</h3>
            <p className="text-xs text-muted-foreground">
              {presence?.is_online ? "Online" : "Offline"}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Search className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Phone className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Video className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-4">
          {messages?.map((message, index) => {
            const isOwnMessage = message.sender_id === currentUserId;
            const showDate = index === 0 || 
              new Date(messages[index - 1].created_at).toDateString() !== 
              new Date(message.created_at).toDateString();

            return (
              <div key={message.id}>
                {showDate && (
                  <div className="flex justify-center my-4">
                    <Badge variant="secondary" className="bg-background text-xs">
                      {new Date(message.created_at).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </Badge>
                  </div>
                )}
                
                <div className={cn("flex gap-3", isOwnMessage && "flex-row-reverse")}>
                  {!isOwnMessage && (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={selectedUser?.avatar_url || ""} />
                      <AvatarFallback>{selectedUser?.username?.[0] || "U"}</AvatarFallback>
                    </Avatar>
                  )}
                  
                  <div className={cn("flex flex-col", isOwnMessage && "items-end")}>
                    <div
                      className={cn(
                        "max-w-md rounded-2xl px-4 py-2",
                        isOwnMessage
                          ? "bg-primary text-primary-foreground rounded-br-none"
                          : "bg-muted rounded-bl-none"
                      )}
                    >
                      {message.media_url && (
                        <div className="mb-2">
                          {message.media_type === "image" ? (
                            <img
                              src={message.media_url}
                              alt="Shared image"
                              className="rounded-lg max-w-full"
                            />
                          ) : message.media_type === "audio" ? (
                            <audio controls className="w-full">
                              <source src={message.media_url} />
                            </audio>
                          ) : (
                            <a
                              href={message.media_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm hover:underline"
                            >
                              📎 File attachment
                            </a>
                          )}
                        </div>
                      )}
                      {message.content && <p className="text-sm">{message.content}</p>}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                      </span>
                      {message.message_reactions && message.message_reactions.length > 0 && (
                        <div className="flex gap-1">
                          {message.message_reactions.map((reaction: any) => (
                            <span key={reaction.id} className="text-xs">
                              {reaction.type === "like" && "👍"}
                              {reaction.type === "heart" && "❤️"}
                            </span>
                          ))}
                          <span className="text-xs text-muted-foreground">
                            {message.message_reactions.length}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {isOwnMessage && (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback>You</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Smile className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon className="h-5 w-5" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                setMediaFile(e.target.files[0]);
              }
            }}
          />
          
          <Input
            placeholder="Type a message"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessageMutation.mutate();
              }
            }}
            className="flex-1"
          />
          
          <Button variant="ghost" size="icon">
            <Mic className="h-5 w-5" />
          </Button>
          <Button
            size="icon"
            onClick={() => sendMessageMutation.mutate()}
            disabled={!messageText.trim() && !mediaFile}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {mediaFile && (
          <div className="mt-2 text-sm text-muted-foreground">
            📎 {mediaFile.name}
            <button
              onClick={() => setMediaFile(null)}
              className="ml-2 text-destructive hover:underline"
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
