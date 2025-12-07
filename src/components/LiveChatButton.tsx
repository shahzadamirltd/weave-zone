import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, X, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const LiveChatButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [chatId, setChatId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data;
    },
  });

  // Find or create chat
  const { data: existingChat } = useQuery({
    queryKey: ["my-support-chat"],
    queryFn: async () => {
      if (!profile) return null;
      const { data } = await supabase
        .from("support_chats")
        .select("*")
        .eq("user_id", profile.id)
        .neq("status", "closed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!profile,
  });

  useEffect(() => {
    if (existingChat) {
      setChatId(existingChat.id);
    }
  }, [existingChat]);

  // Fetch messages
  const { data: messages } = useQuery({
    queryKey: ["support-messages", chatId],
    queryFn: async () => {
      if (!chatId) return [];
      const { data } = await supabase
        .from("support_messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!chatId,
    refetchInterval: 2000,
  });

  // Subscribe to realtime messages
  useEffect(() => {
    if (!chatId) return;

    const channel = supabase
      .channel(`chat-${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `chat_id=eq.${chatId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["support-messages", chatId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, queryClient]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const createChatMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("support_chats")
        .insert({ user_id: profile.id, status: "pending" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setChatId(data.id);
      queryClient.invalidateQueries({ queryKey: ["my-support-chat"] });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!profile) throw new Error("Not authenticated");
      
      let currentChatId = chatId;
      
      // Create chat if doesn't exist
      if (!currentChatId) {
        const { data: newChat, error: chatError } = await supabase
          .from("support_chats")
          .insert({ user_id: profile.id, status: "pending" })
          .select()
          .single();
        if (chatError) throw chatError;
        currentChatId = newChat.id;
        setChatId(currentChatId);
      }

      const { error } = await supabase.from("support_messages").insert({
        chat_id: currentChatId,
        sender_id: profile.id,
        content,
        is_admin: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["support-messages", chatId] });
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessageMutation.mutate(message);
  };

  if (!profile) return null;

  return (
    <>
      {/* Floating Chat Button */}
      <motion.div
        className="fixed bottom-6 right-6 z-50"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        <Button
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 hover:scale-110 transition-all duration-200"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <MessageCircle className="h-6 w-6" />
          )}
        </Button>
      </motion.div>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-50 w-[360px] h-[480px] bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                <div>
                  <h3 className="font-semibold">Live Support</h3>
                  <p className="text-xs opacity-80">We typically reply instantly</p>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="text-primary-foreground hover:bg-white/20"
                onClick={() => setIsOpen(false)}
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {/* Welcome message */}
                {(!messages || messages.length === 0) && (
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        S
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-muted rounded-2xl rounded-tl-none p-3 max-w-[80%]">
                      <p className="text-sm">
                        👋 Hi {profile.username}! How can we help you today?
                      </p>
                    </div>
                  </div>
                )}

                {messages?.map((msg: any) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.is_admin ? "" : "flex-row-reverse"}`}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback
                        className={`text-xs ${
                          msg.is_admin
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {msg.is_admin ? "A" : profile.username?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={`rounded-2xl p-3 max-w-[80%] ${
                        msg.is_admin
                          ? "bg-muted rounded-tl-none"
                          : "bg-primary text-primary-foreground rounded-tr-none"
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-border">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex gap-2"
              >
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 rounded-full"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="rounded-full"
                  disabled={!message.trim() || sendMessageMutation.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
