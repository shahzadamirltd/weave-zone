import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    
    if (!user) throw new Error("Not authenticated");

    const { community_id, amount, payment_method, payment_details } = await req.json();

    // Verify user is community owner
    const { data: community } = await supabaseClient
      .from("communities")
      .select("owner_id")
      .eq("id", community_id)
      .single();

    if (community?.owner_id !== user.id) {
      throw new Error("Not authorized");
    }

    // Calculate available earnings
    const { data: payments } = await supabaseClient
      .from("payments")
      .select("creator_earnings")
      .eq("community_id", community_id)
      .eq("status", "completed");

    const { data: previousPayouts } = await supabaseClient
      .from("payouts")
      .select("amount")
      .eq("community_id", community_id)
      .in("status", ["completed", "pending"]);

    const totalEarnings = payments?.reduce((sum, p) => sum + parseFloat(p.creator_earnings), 0) || 0;
    const totalPayouts = previousPayouts?.reduce((sum, p) => sum + parseFloat(p.amount), 0) || 0;
    const available = totalEarnings - totalPayouts;

    if (amount > available) {
      throw new Error(`Insufficient balance. Available: $${available.toFixed(2)}`);
    }

    // Create payout request
    const { data: payout, error } = await supabaseClient
      .from("payouts")
      .insert({
        creator_id: user.id,
        community_id,
        amount,
        payment_method,
        payment_details,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, payout }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Payout request error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
