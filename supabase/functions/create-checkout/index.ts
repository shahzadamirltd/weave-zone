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
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user?.email) {
      throw new Error("User not authenticated");
    }

    const { community_id, coupon_code } = await req.json();
    
    // Get community details
    const { data: community, error: communityError } = await supabaseClient
      .from("communities")
      .select("*")
      .eq("id", community_id)
      .single();
    
    if (communityError || !community) {
      throw new Error("Community not found");
    }

    if (community.pricing_type === "free") {
      throw new Error("This community is free");
    }

    // Get platform config
    const { data: config } = await supabaseClient
      .from("platform_config")
      .select("platform_fee_percentage")
      .single();

    const platformFee = (community.price_amount * (config?.platform_fee_percentage || 10)) / 100;
    const creatorEarnings = community.price_amount - platformFee;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

    const sessionParams: any = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: community.stripe_price_id,
          quantity: 1,
        },
      ],
      mode: community.pricing_type === "recurring_monthly" ? "subscription" : "payment",
      success_url: `${req.headers.get("origin")}/community/${community_id}?payment=success`,
      cancel_url: `${req.headers.get("origin")}/community/${community_id}?payment=canceled`,
      metadata: {
        community_id,
        user_id: user.id,
        platform_fee: platformFee.toFixed(2),
        creator_earnings: creatorEarnings.toFixed(2),
      },
    };

    // Add coupon if provided
    if (coupon_code) {
      const { data: coupon } = await supabaseClient
        .from("coupon_codes")
        .select("*")
        .eq("code", coupon_code)
        .eq("active", true)
        .single();
      
      if (coupon && coupon.stripe_coupon_id) {
        sessionParams.discounts = [{ coupon: coupon.stripe_coupon_id }];
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Create pending payment record
    await supabaseClient.from("payments").insert({
      user_id: user.id,
      community_id,
      stripe_checkout_session_id: session.id,
      amount: community.price_amount,
      platform_fee: platformFee,
      creator_earnings: creatorEarnings,
      status: "pending",
      payment_type: community.pricing_type,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Checkout error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
