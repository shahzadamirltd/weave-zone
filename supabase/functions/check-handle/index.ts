import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  console.log("WebSocket connection established for handle checking");

  socket.onopen = () => {
    console.log("WebSocket opened");
    socket.send(JSON.stringify({ type: "connected", message: "Handle checker ready" }));
  };

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("Received message:", data);

      if (data.type === "check_handle") {
        const handle = data.handle?.trim().toLowerCase();
        
        // Validate handle format
        if (!handle) {
          socket.send(JSON.stringify({
            type: "handle_response",
            available: false,
            error: "Handle cannot be empty"
          }));
          return;
        }

        // Check handle format (alphanumeric, dashes, underscores only)
        const handleRegex = /^[a-z0-9_-]+$/;
        if (!handleRegex.test(handle)) {
          socket.send(JSON.stringify({
            type: "handle_response",
            available: false,
            error: "Handle can only contain lowercase letters, numbers, dashes, and underscores"
          }));
          return;
        }

        // Check minimum length
        if (handle.length < 3) {
          socket.send(JSON.stringify({
            type: "handle_response",
            available: false,
            error: "Handle must be at least 3 characters"
          }));
          return;
        }

        // Check maximum length
        if (handle.length > 30) {
          socket.send(JSON.stringify({
            type: "handle_response",
            available: false,
            error: "Handle must be less than 30 characters"
          }));
          return;
        }

        // Check if handle exists in database
        const { data: existingCommunity, error } = await supabaseClient
          .from("communities")
          .select("id")
          .eq("handle", handle)
          .maybeSingle();

        if (error) {
          console.error("Database error:", error);
          socket.send(JSON.stringify({
            type: "handle_response",
            available: false,
            error: "Error checking handle availability"
          }));
          return;
        }

        const available = !existingCommunity;
        
        socket.send(JSON.stringify({
          type: "handle_response",
          handle: handle,
          available: available,
          message: available 
            ? `@${handle} is available!` 
            : `@${handle} is already taken`
        }));
      }
    } catch (error) {
      console.error("Error processing message:", error);
      socket.send(JSON.stringify({
        type: "error",
        message: "Failed to process request"
      }));
    }
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  socket.onclose = () => {
    console.log("WebSocket closed");
  };

  return response;
});