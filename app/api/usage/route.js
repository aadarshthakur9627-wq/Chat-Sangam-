import { createServerSupabaseClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return Response.json({ error: "Please sign in to view usage." }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("get_chat_sangam_daily_usage");
  if (error) {
    console.error("Chat usage read error:", error);
    return Response.json({ error: "Usage information is temporarily unavailable." }, { status: 503 });
  }

  const usage = Array.isArray(data) ? data[0] : data;
  return Response.json({
    used: Number(usage?.used) || 0,
    limit: Number(usage?.daily_limit) || 20,
    resetsAt: usage?.resets_at || null,
    plan: Number(usage?.daily_limit) > 5 ? "pro" : "free",
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
