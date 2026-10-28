import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Setup CORS headers for secure browser requests from Quickly App
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY is not configured yet in Supabase Secrets.');
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 200, // Non-blocking so checkout/app flow never fails
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { to, subject, html, fromName = 'Quickly' } = await req.json()

    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Call Resend free tier REST API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: `${fromName} <onboarding@resend.dev>`, // When you verify your domain, change to orders@yourdomain.com
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: html
      })
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('Edge function send-email error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
