import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { createAdminSupabaseClient } from "../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return Response.json({ error: "Please sign in." }, { status: 401 });

    const admin = createAdminSupabaseClient();
    const { data: subscription, error: subscriptionError } = await admin
      .from("subscriptions").select("plan,status,current_period_end")
      .eq("user_id", data.user.id).maybeSingle();
    if (subscriptionError) throw subscriptionError;

    const active = subscription?.plan === "pro" && subscription.status === "active"
      && subscription.current_period_end && new Date(subscription.current_period_end).getTime() > Date.now();
    return Response.json({
      plan: active ? "pro" : "free",
      status: active ? "active" : "inactive",
      currentPeriodEnd: active ? subscription.current_period_end : null,
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    console.error("Subscription status error:", error);
    return Response.json({ error: "Subscription status is temporarily unavailable." }, { status: 503 });
  }
}
