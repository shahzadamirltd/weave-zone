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
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("Not authenticated");

    const { liveStreamId, amount } = await req.json();

    if (!liveStreamId || !amount || amount < 5) {
      throw new Error("Invalid gift amount (minimum $5)");
    }

    // Get platform config for fee calculation
    const { data: platformConfig } = await supabaseClient
      .from("platform_config")
      .select("platform_fee_percentage")
      .single();

    const platformFeePercentage = platformConfig?.platform_fee_percentage || 10;
    const platformFee = (amount * platformFeePercentage) / 100;
    const creatorEarnings = amount - platformFee;

    // Get live stream details
    const { data: liveStream } = await supabaseClient
      .from("live_streams")
      .select("*, communities(*)")
      .eq("id", liveStreamId)
      .eq("status", "active")
      .single();

    if (!liveStream) {
      throw new Error("Live stream not found or ended");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Gift to ${liveStream.communities.name}`,
              description: "Live stream gift",
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/community/${liveStream.community_id}/live?gift=success`,
      cancel_url: `${req.headers.get("origin")}/community/${liveStream.community_id}/live?gift=cancel`,
      metadata: {
        live_stream_id: liveStreamId,
        sender_id: user.id,
        platform_fee: platformFee.toString(),
        creator_earnings: creatorEarnings.toString(),
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});