import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;

    if (!user?.email) {
      throw new Error("Not authenticated");
    }

    const { liveStreamId, amount } = await req.json();

    if (!liveStreamId || !amount || amount < 1) {
      throw new Error("Invalid tip amount");
    }

    // Get platform fee config
    const { data: config } = await supabaseClient
      .from("platform_config")
      .select("platform_fee_percentage")
      .single();

    const platformFeePercentage = config?.platform_fee_percentage || 10;
    const platformFee = Math.round(amount * (platformFeePercentage / 100));
    const creatorEarnings = amount - platformFee;

    // Get live stream details
    const { data: liveStream } = await supabaseClient
      .from("live_streams")
      .select("*, communities(owner_id)")
      .eq("id", liveStreamId)
      .single();

    if (!liveStream || liveStream.status !== "active") {
      throw new Error("Live stream not found or not active");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Get or create Stripe customer
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    let customerId = customers.data[0]?.id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Live Stream Tip",
              description: `Tip during live stream`,
            },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/community/${liveStream.community_id}?tip=success`,
      cancel_url: `${req.headers.get("origin")}/community/${liveStream.community_id}?tip=cancelled`,
      metadata: {
        live_stream_id: liveStreamId,
        sender_id: user.id,
        amount: amount.toString(),
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
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
