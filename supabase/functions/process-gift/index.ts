import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user) throw new Error("Not authenticated");

    const { sessionId } = await req.json();

    if (!sessionId) {
      throw new Error("Session ID required");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      throw new Error("Payment not completed");
    }

    const { live_stream_id, sender_id, platform_fee, creator_earnings } = session.metadata || {};

    if (!live_stream_id || !sender_id) {
      throw new Error("Invalid session metadata");
    }

    // Record the gift
    const { error: giftError } = await supabaseClient.from("gifts").insert({
      live_stream_id,
      sender_id,
      amount: session.amount_total! / 100,
      platform_fee: parseFloat(platform_fee || "0"),
      creator_earnings: parseFloat(creator_earnings || "0"),
      stripe_payment_intent_id: session.payment_intent as string,
    });

    if (giftError) throw giftError;

    // Update live stream total
    const { error: updateError } = await supabaseClient.rpc("increment", {
      row_id: live_stream_id,
      x: parseFloat(creator_earnings || "0"),
    }).eq("id", live_stream_id);

    console.log("Gift processed successfully");

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});