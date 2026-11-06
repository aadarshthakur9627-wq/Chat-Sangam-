import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminSupabaseClient } from "../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function validSignature(rawBody, suppliedSignature, secret) {
  if (!suppliedSignature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const supplied = Buffer.from(suppliedSignature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return supplied.length === expectedBuffer.length && timingSafeEqual(supplied, expectedBuffer);
}

export async function POST(request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Webhook is not configured." }, { status: 503 });

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") || "";
  if (!validSignature(rawBody, signature, secret)) {
    return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let event;
  try { event = JSON.parse(rawBody); } catch { return Response.json({ error: "Invalid event payload." }, { status: 400 }); }
  const eventId = request.headers.get("x-razorpay-event-id");
  if (!eventId || eventId.length > 200) return Response.json({ error: "Missing event identifier." }, { status: 400 });

  if (event?.event !== "payment.captured" && event?.event !== "order.paid") {
    return Response.json({ received: true, ignored: true });
  }

  const payment = event?.payload?.payment?.entity;
  const orderEntity = event?.payload?.order?.entity;
  const orderId = payment?.order_id || orderEntity?.id;
  const paymentId = payment?.id;
  const amount = payment?.amount ?? orderEntity?.amount_paid;
  const currency = payment?.currency || orderEntity?.currency;
  if (!orderId || !paymentId || !Number.isInteger(amount) || !currency) {
    return Response.json({ error: "Payment event is incomplete." }, { status: 400 });
  }

  try {
    const admin = createAdminSupabaseClient();
    const { data, error } = await admin.rpc("process_chat_sangam_razorpay_payment", {
      p_order_id: orderId,
      p_payment_id: paymentId,
      p_amount: amount,
      p_currency: currency,
      p_event_id: eventId,
    });
    if (error) {
      console.error("Billing activation RPC failed:", error.message);
      return Response.json({ error: "Could not process payment event." }, { status: 503 });
    }
    if (data !== true) return Response.json({ error: "Payment does not match a pending Chat Sangam order." }, { status: 400 });
    return Response.json({ received: true });
  } catch (error) {
    console.error("Billing webhook processing failed:", error);
    return Response.json({ error: "Webhook processing failed." }, { status: 503 });
  }
}
