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

    const { community_id, amount, payment_method, payment_details, bank_details } = await req.json();

    // Verify user is community owner and get user profile
    const { data: community } = await supabaseClient
      .from("communities")
      .select("owner_id, name")
      .eq("id", community_id)
      .single();

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("username")
      .eq("id", user.id)
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
        bank_details,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;

    // Get admin email from platform config
    const { data: platformConfig } = await supabaseClient
      .from("platform_config")
      .select("admin_email")
      .limit(1)
      .single();

    // Send email notification to admin using fetch
    try {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Payout Requests <onboarding@resend.dev>",
          to: [platformConfig?.admin_email || "admin@example.com"],
          subject: `New Payout Request - $${amount}`,
          html: `
            <h2>New Payout Request</h2>
            <p><strong>User:</strong> ${profile?.username || user.email}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Community:</strong> ${community?.name || 'Unknown'}</p>
            <p><strong>Amount:</strong> $${amount}</p>
            <p><strong>Payment Method:</strong> ${payment_method}</p>
            <h3>Bank Details:</h3>
            <pre>${bank_details}</pre>
            ${payment_details ? `<h3>Additional Payment Details:</h3><pre>${JSON.stringify(payment_details, null, 2)}</pre>` : ''}
            <p><strong>Request ID:</strong> ${payout.id}</p>
            <p><strong>Requested At:</strong> ${new Date().toLocaleString()}</p>
          `,
        }),
      });
      
      console.log("Payout request email sent successfully");
    } catch (emailError) {
      console.error("Failed to send email notification:", emailError);
      // Don't fail the request if email fails
    }

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
