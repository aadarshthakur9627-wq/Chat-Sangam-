import { randomUUID } from "node:crypto";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { createAdminSupabaseClient } from "../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRO_AMOUNT_PAISE = 14900;

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return Response.json({ error: "Please sign in before upgrading." }, { status: 401 });

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return Response.json({ error: "Pro checkout is not configured yet. Please try again later." }, { status: 503 });
    }

    const receipt = "cs_" + randomUUID().replace(/-/g, "").slice(0, 30);
    const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(keyId + ":" + keySecret).toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: PRO_AMOUNT_PAISE, currency: "INR", receipt, notes: { product: "Chat Sangam Pro 30 days", user_id: data.user.id } }),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    const order = await razorpayResponse.json().catch(() => ({}));
    if (!razorpayResponse.ok || !order.id || order.amount !== PRO_AMOUNT_PAISE || order.currency !== "INR") {
      console.error("Razorpay order creation failed:", { status: razorpayResponse.status, code: order?.error?.code });
      return Response.json({ error: "Could not start checkout. Please try again later." }, { status: 502 });
    }

    const admin = createAdminSupabaseClient();
    const { error: saveError } = await admin.from("billing_orders").insert({
      user_id: data.user.id,
      razorpay_order_id: order.id,
      amount_paise: PRO_AMOUNT_PAISE,
      currency: "INR",
      status: "created",
    });
    if (saveError) {
      console.error("Billing order ledger insert failed:", saveError.message);
      return Response.json({ error: "Could not prepare secure checkout. Please try again." }, { status: 503 });
    }

    return Response.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId, name: "Chat Sangam", description: "Pro access for 30 days", prefill: { email: data.user.email || "" } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Billing order error:", error);
    return Response.json({ error: "Checkout is temporarily unavailable." }, { status: 503 });
  }
}
