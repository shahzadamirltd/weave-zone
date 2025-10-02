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
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    
    if (!user) throw new Error("Not authenticated");

    const { community_id, product_name, price_amount, recurring_interval } = await req.json();

    // Verify user owns the community
    const { data: community } = await supabaseClient
      .from("communities")
      .select("*")
      .eq("id", community_id)
      .eq("owner_id", user.id)
      .single();

    if (!community) throw new Error("Community not found or unauthorized");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Create Stripe product
    const product = await stripe.products.create({
      name: product_name,
      description: community.description || undefined,
    });

    console.log("Created Stripe product:", product.id);

    // Create Stripe price
    const priceParams: any = {
      product: product.id,
      unit_amount: price_amount,
      currency: "usd",
    };

    if (recurring_interval) {
      priceParams.recurring = { interval: recurring_interval };
    }

    const price = await stripe.prices.create(priceParams);

    console.log("Created Stripe price:", price.id);

    // Update community with Stripe IDs
    const { error: updateError } = await supabaseClient
      .from("communities")
      .update({
        stripe_product_id: product.id,
        stripe_price_id: price.id,
      })
      .eq("id", community_id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        product_id: product.id,
        price_id: price.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error creating Stripe product:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
