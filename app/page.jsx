"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const STORAGE_KEY = "chat-sangam-history-v2";

const ACTIVE_ENGINE = {
  id: "groq",
  name: "Groq",
  model: "GPT-OSS 20B",
  provider: "Groq API",
  icon: "⚡",
  color: "pink",
};

const FUTURE_ENGINES = [
  { name: "Gemini", icon: "✦" },
  { name: "OpenAI", icon: "◉" },
  { name: "Claude", icon: "◌" },
  { name: "Perplexity", icon: "⌕" },
  { name: "DeepSeek", icon: "◆" },
];

const PROMPTS = [
  { icon: "✦", title: "Learn", text: "Teach me a difficult topic from basics with examples." },
  { icon: "⌁", title: "Plan", text: "Create a practical step-by-step plan for my goal." },
  { icon: "✎", title: "Create", text: "Help me create a polished piece of content." },
  { icon: "⌘", title: "Code", text: "Review this idea and help me build it cleanly." },
];

function createChat() {
  return {
    id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 7),
    title: "New conversation",
    messages: [],
    updatedAt: Date.now(),
  };
}

function formatTime(timestamp) {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(timestamp);
}

export default function Home() {
  const [reasoningEffort, setReasoningEffort] = useState("medium");
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [webSearch, setWebSearch] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const abortControllerRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      const initial = Array.isArray(parsed) && parsed.length ? parsed : [createChat()];
      setChats(initial);
      setActiveChatId(initial[0].id);
    } catch (error) {
      console.error("History load error:", error);
      const initial = [createChat()];
      setChats(initial);
      setActiveChatId(initial[0].id);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch (error) {
      console.error("History save error:", error);
    }
  }, [chats, loaded]);

  useEffect(() => {
    if (!loading) textareaRef.current?.focus();
  }, [activeChatId, loading]);

  const activeChat = chats.find((chat) => chat.id === activeChatId) || null;
  const messages = activeChat?.messages || [];

  const filteredChats = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return chats.slice(0, 20);
    return chats.filter((chat) => (chat.title || "").toLowerCase().includes(query)).slice(0, 20);
  }, [chats, search]);

  const selectedModel = ACTIVE_ENGINE;

  function updateChat(id, updater) {
    setChats((current) => current.map((chat) => chat.id === id ? updater(chat) : chat));
  }

  function startNewChat() {
    if (loading) return;
    const chat = createChat();
    setChats((current) => [chat, ...current]);
    setActiveChatId(chat.id);
    setMessage("");
    setSearch("");
    setMobileMenuOpen(false);
  }

  function openChat(id) {
    if (loading) return;
    setActiveChatId(id);
    setMessage("");
    setMobileMenuOpen(false);
  }

  function deleteChat(id, event) {
    event?.stopPropagation();
    if (loading) return;
    setChats((current) => {
      const remaining = current.filter((chat) => chat.id !== id);
      const next = remaining.length ? remaining : [createChat()];
      setActiveChatId((active) => active === id ? next[0].id : active);
      return next;
    });
  }

  function usePrompt(text) {
    setMessage(text);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  async function requestCompletion(chatId, nextMessages) {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);

    updateChat(chatId, (chat) => ({
      ...chat,
      updatedAt: Date.now(),
      messages: [...nextMessages, { role: "assistant", content: "" }],
    }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, webSearch, reasoningEffort }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let detail = "AI response failed.";
        try {
          const data = await response.json();
          detail = data.error || detail;
        } catch {}
        throw new Error(detail);
      }
      if (!response.body) throw new Error("AI response failed.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const result = await reader.read();
        if (result.done) break;
        fullText += decoder.decode(result.value, { stream: true });
        updateChat(chatId, (chat) => ({
          ...chat,
          updatedAt: Date.now(),
          messages: chat.messages.map((msg, index) => index === chat.messages.length - 1 ? { ...msg, content: fullText } : msg),
        }));
      }

      fullText += decoder.decode();
      updateChat(chatId, (chat) => ({
        ...chat,
        updatedAt: Date.now(),
        messages: chat.messages.map((msg, index) => index === chat.messages.length - 1 ? { ...msg, content: fullText } : msg),
      }));
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error("Chat error:", error);
      updateChat(chatId, (chat) => ({
        ...chat,
        messages: chat.messages.map((msg, index) => index === chat.messages.length - 1 ? { ...msg, content: "⚠️ " + (error?.message || "Kuch problem aa gayi. Please dobara try karo.") } : msg),
      }));
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
    }
  }

  function stopGeneration() {
    abortControllerRef.current?.abort();
  }

  async function sendMessage(event) {
    event?.preventDefault();
    const text = message.trim();
    if (!text || loading || !activeChat) return;

    const userMessage = { role: "user", content: text };
    const nextMessages = [...messages, userMessage];
    const title = messages.length === 0 ? text.replace(/\s+/g, " ").slice(0, 42) || "New conversation" : activeChat.title;

    updateChat(activeChat.id, (chat) => ({
      ...chat,
      title,
      updatedAt: Date.now(),
    }));
    setMessage("");
    setEditingIndex(null);
    await requestCompletion(activeChat.id, nextMessages);
  }

  async function regenerateMessage(index) {
    if (loading || !activeChat || index <= 0) return;
    const userIndex = index - 1;
    if (messages[userIndex]?.role !== "user") return;
    const nextMessages = messages.slice(0, index);
    updateChat(activeChat.id, (chat) => ({
      ...chat,
      updatedAt: Date.now(),
      messages: nextMessages,
    }));
    await requestCompletion(activeChat.id, nextMessages);
  }

  function editMessage(index) {
    if (loading || !activeChat || messages[index]?.role !== "user") return;
    setEditingIndex(index);
    setMessage(messages[index].content);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function copyText(text) {
    navigator.clipboard?.writeText(text);
  }

  if (!loaded) {
    return <main className="boot-screen"><div className="boot-mark">✦</div><span>Loading Chat Sangam…</span></main>;
  }

  return (
    <main className="app-shell">
      <aside className={"sidebar " + (mobileMenuOpen ? "sidebar-open" : "")}>
        <div className="sidebar-head">
          <button className="brand" onClick={startNewChat} aria-label="Chat Sangam home">
            <span className="brand-mark">✦</span>
            <span className="brand-copy"><strong>Chat Sangam</strong><small>Many AIs. One workspace.</small></span>
          </button>
          <button className="icon-button mobile-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">×</button>
        </div>

        <button className="new-chat-button" onClick={startNewChat} disabled={loading}>
          <span>＋</span><span>New conversation</span><kbd>⌘ K</kbd>
        </button>

        <div className="sidebar-search">
          <span>⌕</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations" aria-label="Search conversations" />
          <kbd>/</kbd>
        </div>

        <div className="history-header"><span>RECENT</span><span>{filteredChats.length}</span></div>

        <div className="chat-history">
          {filteredChats.length ? filteredChats.map((chat) => (
            <button key={chat.id} className={"history-item " + (chat.id === activeChatId ? "selected" : "")} onClick={() => openChat(chat.id)} disabled={loading}>
              <span className="history-icon">◌</span>
              <span className="history-text">
                <strong>{chat.title || "New conversation"}</strong>
                <small>{chat.messages.length ? chat.messages.length + " messages · " + formatTime(chat.updatedAt) : "Empty conversation"}</small>
              </span>
              <span className="history-delete" onClick={(e) => deleteChat(chat.id, e)}>×</span>
            </button>
          )) : <div className="no-results">No conversations found.</div>}
        </div>

        <div className="sidebar-footer">
          <div className="footer-pill"><span className="status-dot" /> All systems ready</div>
          <div className="footer-links"><span>⚙ Settings</span><span>◉ Account</span></div>
        </div>
      </aside>

      {mobileMenuOpen && <button className="mobile-backdrop" onClick={() => setMobileMenuOpen(false)} aria-label="Close sidebar" />}

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu-button" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">☰</button>
            <div><div className="eyebrow">AI WORKSPACE</div><h1>{activeChat?.title || "New conversation"}</h1></div>
          </div>
          <div className="topbar-right">
            <button className={"web-search-toggle " + (webSearch ? "active" : "")} onClick={() => setWebSearch((value) => !value)} disabled={loading} type="button" aria-pressed={webSearch} title="Search the live web before answering">
              <span>⌕</span> Web Search <b>{webSearch ? "ON" : "OFF"}</b>
            </button>
            <div className="engine-badge" title="Current AI engine">
              <span className="engine-dot" /> <strong>Groq</strong><span>GPT-OSS 20B</span>
            </div>
            <label className="thinking-picker" title="Groq reasoning effort">
              <span>THINK</span>
              <select value={reasoningEffort} onChange={(e) => setReasoningEffort(e.target.value)} disabled={loading} aria-label="Reasoning effort">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <button className="top-action" onClick={startNewChat} disabled={loading}>＋ <span>New</span></button>
          </div>
        </header>

        <div className="model-strip">
          <div className="selected-model">
            <span className={"model-orb " + selectedModel.color}>{selectedModel.icon}</span>
            <span><strong>{selectedModel.name} · {selectedModel.model}</strong><small>{selectedModel.provider}</small></span>
            <i />
            <span className="live-label"><b /> Online</span>
          </div>
          <div className="coming-soon">
            <span>FUTURE ENGINES</span>
            {FUTURE_ENGINES.map((item) => <span key={item.name} title={item.name}>{item.icon} {item.name}</span>)}
          </div>
        </div>

        <div className="messages">
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="hero-glow" />
              <div className="hero-mark">✦</div>
              <div className="hero-kicker">THE MULTI-MODEL AI WORKSPACE</div>
              <h2>One question.<br /><span>Many minds.</span></h2>
              <p>Chat Sangam brings powerful AI models into one clean workspace. Pick a model, ask anything, and build faster.</p>
              <div className="prompt-grid">
                {PROMPTS.map((prompt) => (
                  <button key={prompt.title} className="prompt-card" onClick={() => usePrompt(prompt.text)}>
                    <span className="prompt-icon">{prompt.icon}</span>
                    <span><strong>{prompt.title}</strong><small>{prompt.text}</small></span>
                    <b>→</b>
                  </button>
                ))}
              </div>
              <div className="trust-row"><span>● Private local chat history</span><span>● Streaming responses</span><span>● Markdown & code support</span></div>
            </div>
          ) : (
            <div className="conversation">
              {messages.map((msg, index) => (
                <article className={"message-row " + msg.role} key={index}>
                  <div className={"message-avatar " + msg.role}>{msg.role === "user" ? "A" : "✦"}</div>
                  <div className="message-main">
                    <div className="message-meta"><strong>{msg.role === "user" ? "You" : "Chat Sangam"}</strong><span>{msg.role === "assistant" ? "Groq · GPT-OSS 20B" : "Message"}</span></div>
                    <div className="message-bubble">
                      {msg.role === "assistant" ? (
                        <div className="markdown-content">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content || ""}</ReactMarkdown>
                          {loading && index === messages.length - 1 && <span className="typing-cursor">▋</span>}
                          {!loading && msg.content && (
                            <div className="message-actions">
                              <button type="button" onClick={() => copyText(msg.content)} title="Copy response">Copy</button>
                              <button type="button" onClick={() => regenerateMessage(index)} title="Regenerate response">Regenerate</button>
                            </div>
                          )}
                        </div>
                      ) : msg.content}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="composer-dock">
          <form className="composer" onSubmit={sendMessage}>
            <div className="composer-top"><span className="composer-model">{selectedModel.icon} {selectedModel.name} · {selectedModel.model}{webSearch && <em> · Web Search</em>}</span><span className="composer-hint">Enter to send · Shift + Enter for new line</span></div>
            <div className="composer-input-row">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={loading ? "Generating response…" : "Ask Chat Sangam anything…"}
                rows={1}
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(e); }
                }}
              />
              <button className={"send-button " + (loading ? "stop-button" : "")} type={loading ? "button" : "submit"} onClick={loading ? stopGeneration : undefined} disabled={!loading && !message.trim()} aria-label={loading ? "Stop generation" : "Send message"}>{loading ? "■" : "↑"}</button>
            </div>
          </form>
          <div className="composer-note">{loading ? "■ Generation in progress · Tap stop to end it." : webSearch ? "⌕ Live web search is ON · Groq browser search verifies current information with sources." : "⚡ Powered by Groq · Chat Sangam may make mistakes. Verify important information."}</div>
        </div>
      </section>
    </main>
  );
}
