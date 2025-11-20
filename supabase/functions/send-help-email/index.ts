import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  subject: string;
  message: string;
  userEmail: string;
  userName: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subject, message, userEmail, userName }: EmailRequest = await req.json();

    // In production, you would use a service like SendGrid, Mailgun, or AWS SES
    // For now, we'll log it and return success
    console.log("Help email received:", {
      to: "buyverly@gmail.com",
      from: userEmail,
      subject: `[Help Request] ${subject}`,
      body: `
From: ${userName} (${userEmail})
Subject: ${subject}

Message:
${message}
      `,
    });

    // You can integrate with email services here
    // Example with fetch to a service:
    /*
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("SENDGRID_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: "buyverly@gmail.com" }],
        }],
        from: { email: "support@yourdomain.com" },
        subject: `[Help Request] ${subject}`,
        content: [{
          type: "text/plain",
          value: `From: ${userName} (${userEmail})\n\n${message}`,
        }],
      }),
    });
    */

    return new Response(
      JSON.stringify({
        success: true,
        message: "Help request sent successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
