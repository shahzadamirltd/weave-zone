import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";

export default function Messages() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data;
    },
  });

  // Update user presence
  useEffect(() => {
    if (!profile?.id) return;

    const updatePresence = async () => {
      await supabase
        .from("user_presence")
        .upsert({
          user_id: profile.id,
          is_online: true,
          last_seen: new Date().toISOString(),
        });
    };

    updatePresence();

    // Update presence every 30 seconds
    const interval = setInterval(updatePresence, 30000);

    // Set offline on unmount
    return () => {
      clearInterval(interval);
      supabase
        .from("user_presence")
        .upsert({
          user_id: profile.id,
          is_online: false,
          last_seen: new Date().toISOString(),
        });
    };
  }, [profile?.id]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ChatSidebar
        currentUserId={profile?.id}
        selectedUserId={selectedUserId}
        onSelectUser={setSelectedUserId}
      />
      <ChatWindow currentUserId={profile?.id} selectedUserId={selectedUserId} />
    </div>
  );
}
