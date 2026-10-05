"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const STORAGE_KEY = "chat-sangam-history-v2";

const MODELS = [
  { id: "groq", name: "Groq", provider: "Fast inference", icon: "⚡", color: "pink" },
  { id: "gemini", name: "Gemini", provider: "Google AI", icon: "✦", color: "violet" },
];

const COMING_SOON = [
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
  const [model, setModel] = useState("groq");
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
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

  const selectedModel = MODELS.find((item) => item.id === model) || MODELS[0];

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
      messages: [...nextMessages, { role: "assistant", content: "" }],
    }));

    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: nextMessages }),
      });

      if (!response.ok || !response.body) throw new Error("AI response failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const result = await reader.read();
        if (result.done) break;
        fullText += decoder.decode(result.value, { stream: true });
        updateChat(activeChat.id, (chat) => ({
          ...chat,
          updatedAt: Date.now(),
          messages: chat.messages.map((msg, index) => index === chat.messages.length - 1 ? { ...msg, content: fullText } : msg),
        }));
      }

      fullText += decoder.decode();
      updateChat(activeChat.id, (chat) => ({
        ...chat,
        updatedAt: Date.now(),
        messages: chat.messages.map((msg, index) => index === chat.messages.length - 1 ? { ...msg, content: fullText } : msg),
      }));
    } catch (error) {
      console.error("Chat error:", error);
      updateChat(activeChat.id, (chat) => ({
        ...chat,
        messages: chat.messages.map((msg, index) => index === chat.messages.length - 1 ? { ...msg, content: "Sorry, kuch problem aa gayi. Please dobara try karo." } : msg),
      }));
    } finally {
      setLoading(false);
    }
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
            <div className="model-picker">
              <span className="picker-label">MODEL</span>
              <select value={model} onChange={(e) => setModel(e.target.value)} disabled={loading} aria-label="Select AI model">
                {MODELS.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
              </select>
              <span className="chevron">⌄</span>
            </div>
            <button className="top-action" onClick={startNewChat} disabled={loading}>＋ <span>New</span></button>
          </div>
        </header>

        <div className="model-strip">
          <div className="selected-model">
            <span className={"model-orb " + selectedModel.color}>{selectedModel.icon}</span>
            <span><strong>{selectedModel.name}</strong><small>{selectedModel.provider}</small></span>
            <i />
            <span className="live-label"><b /> Live</span>
          </div>
          <div className="coming-soon">
            <span>COMING NEXT</span>
            {COMING_SOON.map((item) => <span key={item.name} title={item.name}>{item.icon} {item.name}</span>)}
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
                    <div className="message-meta"><strong>{msg.role === "user" ? "You" : selectedModel.name}</strong><span>{msg.role === "assistant" ? "AI response" : "Message"}</span></div>
                    <div className="message-bubble">
                      {msg.role === "assistant" ? (
                        <div className="markdown-content">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content || ""}</ReactMarkdown>
                          {loading && index === messages.length - 1 && <span className="typing-cursor">▋</span>}
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
            <div className="composer-top"><span className="composer-model">{selectedModel.icon} {selectedModel.name}</span><span className="composer-hint">Enter to send · Shift + Enter for new line</span></div>
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
              <button className="send-button" type="submit" disabled={!message.trim() || loading} aria-label="Send message">{loading ? "…" : "↑"}</button>
            </div>
          </form>
          <div className="composer-note">Chat Sangam may make mistakes. Verify important information.</div>
        </div>
      </section>
    </main>
  );
}
