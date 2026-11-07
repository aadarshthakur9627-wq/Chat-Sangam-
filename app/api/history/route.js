import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { parseHistoryPayload, normalizeHistoryTimestamp } from "../../../lib/history/validation.mjs";

export const dynamic = "force-dynamic";

function safeMetadata(message) {
  return {
    modelId: typeof message?.modelId === "string" ? message.modelId.slice(0, 120) : null,
    modelName: typeof message?.modelName === "string" ? message.modelName.slice(0, 120) : null,
    modelProvider: typeof message?.modelProvider === "string" ? message.modelProvider.slice(0, 120) : null,
    fallbackFrom: typeof message?.fallbackFrom === "string" ? message.fallbackFrom.slice(0, 120) : null,
    vision: Boolean(message?.vision),
    sources: Array.isArray(message?.sources) ? message.sources.slice(0, 8).map((source) => ({
      id: Number(source?.id) || 0,
      title: String(source?.title || "").slice(0, 300),
      url: String(source?.url || "").slice(0, 2000),
      snippet: String(source?.snippet || "").slice(0, 1500),
    })) : [],
  };
}

async function requireUser(supabase) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return { error: Response.json({ error: "Please sign in to sync your chat history." }, { status: 401 }) };
  return { user: data.user };
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { user, error: authResponse } = await requireUser(supabase);
    if (!user) return authResponse;

    const { data: conversations, error: conversationsError } = await supabase
      .from("conversations")
      .select("id, external_id, title, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(30);
    if (conversationsError) throw conversationsError;

    const ids = (conversations || []).map((chat) => chat.id);
    let messages = [];
    if (ids.length) {
      // Supabase projects commonly cap one Data API response at 1,000 rows.
      // Page through the bounded history window so users don't lose older messages.
      for (let offset = 0; offset < 3600; offset += 1000) {
        const result = await supabase
          .from("messages")
          .select("external_id, conversation_id, role, content, metadata, created_at")
          .in("conversation_id", ids)
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .range(offset, offset + 999);
        if (result.error) throw result.error;
        messages.push(...(result.data || []));
        if (!result.data || result.data.length < 1000) break;
      }
    }

    const byConversation = new Map();
    for (const message of messages) {
      const list = byConversation.get(message.conversation_id) || [];
      list.push({
        id: message.external_id,
        role: message.role,
        content: message.content,
        createdAt: new Date(message.created_at).getTime(),
        ...(message.metadata && typeof message.metadata === "object" ? message.metadata : {}),
      });
      byConversation.set(message.conversation_id, list);
    }

    const chats = (conversations || []).map((chat) => ({
      id: chat.external_id,
      title: chat.title,
      createdAt: new Date(chat.created_at).getTime(),
      updatedAt: new Date(chat.updated_at).getTime(),
      messages: byConversation.get(chat.id) || [],
    }));
    return Response.json({ userId: user.id, chats }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Chat history load error:", error);
    return Response.json({ error: "Could not load chat history." }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { user, error: authResponse } = await requireUser(supabase);
    if (!user) return authResponse;

    let rawBody;
    try {
      rawBody = await request.text();
    } catch {
      return Response.json({ error: "Could not read history payload." }, { status: 400 });
    }
    const parsed = parseHistoryPayload(rawBody);
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status });

    const chats = parsed.body.chats.slice(0, 30);
    const uniqueChats = new Map();
    for (const chat of chats) {
      if (typeof chat?.id !== "string") continue;
      const id = chat.id.trim();
      if (!id || id.length > 100) continue;
      uniqueChats.set(id, { ...chat, id });
    }
    const normalizedChats = [...uniqueChats.values()];
    const now = Date.now();
    const conversationRows = normalizedChats.map((chat) => ({
      user_id: user.id,
      external_id: chat.id,
      title: String(chat.title || "New conversation").replace(/\s+/g, " ").slice(0, 200) || "New conversation",
      updated_at: normalizeHistoryTimestamp(chat.updatedAt, now),
    }));
    if (!conversationRows.length) return Response.json({ ok: true, saved: 0 });

    const { error: upsertConversationsError } = await supabase
      .from("conversations")
      .upsert(conversationRows, { onConflict: "user_id,external_id" });
    if (upsertConversationsError) throw upsertConversationsError;

    const externalIds = conversationRows.map((chat) => chat.external_id);
    const { data: savedConversations, error: loadConversationsError } = await supabase
      .from("conversations")
      .select("id, external_id")
      .eq("user_id", user.id)
      .in("external_id", externalIds);
    if (loadConversationsError) throw loadConversationsError;

    const databaseIds = new Map((savedConversations || []).map((chat) => [chat.external_id, chat.id]));
    const messageRows = [];
    const seenMessageIds = new Set();
    for (const chat of normalizedChats) {
      if (!databaseIds.has(chat.id) || !Array.isArray(chat.messages)) continue;
      const recentMessages = chat.messages.slice(-120);
      for (let messageIndex = 0; messageIndex < recentMessages.length; messageIndex += 1) {
        const message = recentMessages[messageIndex];
        if (!message || !["user", "assistant"].includes(message.role) || typeof message.content !== "string") continue;
        const fallbackId = String(chat.id) + ":" + String(Math.max(0, chat.messages.length - recentMessages.length + messageIndex));
        const externalId = typeof message.id === "string" && message.id.trim() && message.id.length <= 120 ? message.id.trim() : fallbackId;
        if (seenMessageIds.has(externalId)) continue;
        seenMessageIds.add(externalId);
        messageRows.push({
          user_id: user.id,
          conversation_id: databaseIds.get(chat.id),
          external_id: externalId,
          role: message.role,
          content: message.content.slice(0, 120000),
          metadata: safeMetadata(message),
          created_at: normalizeHistoryTimestamp(message.createdAt, Number.isFinite(Number(chat.updatedAt)) ? Number(chat.updatedAt) - (chat.messages.length - recentMessages.length + messageIndex) : now),
        });
      }
    }

    for (let offset = 0; offset < messageRows.length; offset += 500) {
      const batch = messageRows.slice(offset, offset + 500);
      const { error: messagesError } = await supabase
        .from("messages")
        .upsert(batch, { onConflict: "user_id,external_id" });
      if (messagesError) throw messagesError;
    }

    return Response.json({ ok: true, saved: conversationRows.length, messages: messageRows.length }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Chat history save error:", error);
    return Response.json({ error: "Could not save chat history." }, { status: 500 });
  }
}
