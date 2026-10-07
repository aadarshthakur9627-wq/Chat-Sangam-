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

function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);
  const code = String(children?.props?.children ?? children).replace(/\n$/, "");

  async function copyCode() {
    try {
      await navigator.clipboard?.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  return (
    <div className="code-block">
      <div className="code-toolbar">
        <span>CODE</span>
        <button type="button" onClick={copyCode}>{copied ? "Copied" : "Copy"}</button>
      </div>
      <pre>{children}</pre>
    </div>
  );
}

function ActionIcon({ type, size = 17 }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" };
  if (type === "copy") return <svg {...common}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
  if (type === "check") return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>;
  if (type === "up") return <svg {...common}><path d="M7 10v10" /><path d="M11 10V5.5A2.5 2.5 0 0 1 13.5 3L14 3v7h5.2a2 2 0 0 1 2 2.3l-1 6A2 2 0 0 1 18.2 20H7" /></svg>;
  if (type === "down") return <svg {...common}><path d="M7 14V4" /><path d="M11 14v4.5a2.5 2.5 0 0 0 2.5 2.5l.5 0v-7h5.2a2 2 0 0 0 2-2.3l-1-6A2 2 0 0 0 18.2 4H7" /></svg>;
  if (type === "volume") return <svg {...common}><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 6a9 9 0 0 1 0 12" /></svg>;
  if (type === "share") return <svg {...common}><path d="M12 16V3" /><path d="m7 8 5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>;
  if (type === "more") return <svg {...common}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></svg>;
  if (type === "branch") return <svg {...common}><path d="M6 4v12" /><path d="M6 8h8a4 4 0 0 1 4 4v1" /><path d="m15 10 3 3 3-3" /><circle cx="6" cy="4" r="2" /><circle cx="6" cy="20" r="2" /></svg>;
  if (type === "retry") return <svg {...common}><path d="M20 11a8 8 0 1 0 1 5" /><path d="M20 4v7h-7" /></svg>;
  if (type === "web") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3Z" /></svg>;
  return null;
}

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

function getCitedSources(content, sources) {
  if (!content || !Array.isArray(sources)) return [];
  const citedIds = new Set();
  const cleaned = content
    .replace(/(?:\[(\d+)\u2020[^\]]*\]|【(\d+)\u2020[^】]*】|〖(\d+)\u2020[^〗]*〗)/g, (_, a, b, c) => "[" + (a || b || c) + "]")
    .replace(/\[(\d+)\]\s*\[L\d+(?:[-–—]L?\d+)?\](?:\s*\[L\d+(?:[-–—]L?\d+)?\])*/gi, "[$1]")
    .replace(/\[(\d+)\]\s*L\d+(?:[-–—]L?\d+)?/gi, "[$1]");
  for (const match of cleaned.matchAll(/\[(\d+)\]/g)) {
    const id = Number(match[1]);
    if (id > 0) citedIds.add(String(id));
  }
  return sources.filter((source) => citedIds.has(String(source.id)));
}

function prepareCitationMarkdown(content, sources) {
  if (!content) return "";

  const available = new Set((sources || []).map((source) => String(source.id)));
  const cleaned = content
    // Normalize Groq/browser-search citation wrappers to [N].
    .replace(/(?:\[(\d+)\u2020[^\]]*\]|【(\d+)\u2020[^】]*】|〖(\d+)\u2020[^〗]*〗)/g, (_, a, b, c) => "[" + (a || b || c) + "]")
    .replace(/\[(\d+)\]\s*\[L\d+(?:[-–—]L?\d+)?\](?:\s*\[L\d+(?:[-–—]L?\d+)?\])*/gi, "[$1]")
    .replace(/\[(\d+)\]\s*L\d+(?:[-–—]L?\d+)?/gi, "[$1]")
    .replace(/\s*\[L\d+(?:[-–—]L?\d+)?\]/gi, "")
    .replace(/\s*【L\d+(?:[-–—]L?\d+)?】/gi, "")
    .replace(/\s*〖L\d+(?:[-–—]L?\d+)?〗/gi, "")
    // Convert raw HTML breaks into clean Markdown line breaks.
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<p>/gi, "")
    .replace(/<\/p>/gi, "\n\n")
    // Remove accidental web-search table scaffolding.
    .replace(/\|\s*#\s*\|\s*Headline\s*\|\s*Key point\s*\|\s*Source\s*\|/gi, "")
    .replace(/\|?\s*-{2,}\s*\|\s*-{2,}\s*\|\s*-{2,}\s*\|\s*-{2,}\s*\|?/g, "")
    .trim();

  return cleaned.replace(/\[(\d+)\](?!\()/g, (match, id) => {
    if (!available.has(String(id))) return match;
    return "[" + id + "](#source-" + id + ")";
  });
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
  const [deepResearch, setDeepResearch] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [attachedImages, setAttachedImages] = useState([]);
  const imageCacheRef = useRef(new Map());
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [imageInputKey, setImageInputKey] = useState(0);
  const [editingIndex, setEditingIndex] = useState(null);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState(null);
  const [messageContextMenu, setMessageContextMenu] = useState(null);
  const [assistantMenuIndex, setAssistantMenuIndex] = useState(null);
  const [feedbackByIndex, setFeedbackByIndex] = useState({});
  const abortControllerRef = useRef(null);
  const textareaRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const longPressStartRef = useRef(null);
  const longPressTriggeredRef = useRef(false);

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

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!messageContextMenu) return;
    function closeMenu(event) {
      if (event.target?.closest?.(".message-context-menu")) return;
      setMessageContextMenu(null);
    }
    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setMessageContextMenu(null);
    });
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
    };
  }, [messageContextMenu]);

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

  async function handleFileChange(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setFileLoading(true);
    try {
      const extracted = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/file", { method: "POST", body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "File read failed.");
        extracted.push(data);
      }
      setAttachedFiles((current) => [...current, ...extracted].slice(0, 5));
    } catch (error) {
      alert(error?.message || "File read failed.");
    } finally {
      setFileLoading(false);
      setFileInputKey((value) => value + 1);
    }
  }

  async function fileToDataUrl(file) {
    if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
    if (file.size > 10 * 1024 * 1024) throw new Error("Image is too large. Maximum size is 10 MB.");
    const source = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read the image."));
      reader.readAsDataURL(file);
    });
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not process the image."));
      img.src = source;
    });
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    let quality = 0.82;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    while (dataUrl.length > 1_350_000 && quality > 0.52) {
      quality -= 0.06;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    if (dataUrl.length > 1_500_000) throw new Error("Image is still too large after compression. Please choose a smaller image.");
    return dataUrl;
  }

  async function handleImageChange(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setFileLoading(true);
    try {
      const remaining = Math.max(0, 3 - attachedImages.length);
      const selected = files.slice(0, remaining);
      if (!selected.length) throw new Error("You can attach up to 3 images per message.");
      const converted = [];
      for (const file of selected) converted.push({ name: file.name || "Image", dataUrl: await fileToDataUrl(file) });
      setAttachedImages((current) => [...current, ...converted].slice(0, 3));
    } catch (error) {
      alert(error?.message || "Image upload failed.");
    } finally {
      setFileLoading(false);
      setImageInputKey((value) => value + 1);
      setAttachMenuOpen(false);
    }
  }

  function removeAttachedImage(index) {
    setAttachedImages((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setImageInputKey((value) => value + 1);
  }

  function openAttachMenu() { if (!loading && !fileLoading) setAttachMenuOpen((current) => !current); }

  function handleImageOption() {
    if (loading || fileLoading) return;
    setAttachMenuOpen(false);
    document.getElementById("camera-upload-" + imageInputKey)?.click();
  }

  function handleFilesOption() { if (loading || fileLoading) return; setAttachMenuOpen(false); document.getElementById("file-upload-" + fileInputKey)?.click(); }

  function removeAttachedFile(index) {
    setAttachedFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setFileInputKey((value) => value + 1);
  }

  function usePrompt(text) {
    setMessage(text);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function parseStreamPayload(text) {
    const marker = "__CHAT_SANGAM_SOURCES__";
    const endMarker = "__END_CHAT_SANGAM_SOURCES__";
    const start = text.indexOf(marker);
    if (start === -1) return { text, sources: null };
    const end = text.indexOf(endMarker, start);
    if (end === -1) return { text: text.slice(0, start), sources: null };
    try {
      return { text: text.slice(0, start).trimEnd(), sources: JSON.parse(text.slice(start + marker.length, end)) };
    } catch {
      return { text: text.slice(0, start).trimEnd(), sources: null };
    }
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
      // Keep file text separate from provider messages.
      // The API route safely injects it server-side, avoiding provider payload issues.
      const apiMessages = nextMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));
      const attachments = nextMessages.flatMap((msg, index) => {
        if (Array.isArray(msg.fileContexts)) {
          return msg.fileContexts.map((file) => ({ messageIndex: index, name: file.name || "Attached file", text: file.text || "" }));
        }
        return msg.fileContext ? [{ messageIndex: index, name: msg.fileName || "Attached file", text: msg.fileContext }] : [];
      });
      const imageAttachments = nextMessages.flatMap((msg, index) => {
        const cached = imageCacheRef.current.get(index);
        return Array.isArray(cached) ? cached.map((image) => ({ messageIndex: index, name: image.name || "Image", dataUrl: image.dataUrl })) : [];
      });

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, attachments, imageAttachments, webSearch, deepResearch, reasoningEffort }),
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
        const parsed = parseStreamPayload(fullText);
        updateChat(chatId, (chat) => ({
          ...chat,
          updatedAt: Date.now(),
          messages: chat.messages.map((msg, index) => index === chat.messages.length - 1 ? { ...msg, content: parsed.text, sources: parsed.sources || msg.sources || [] } : msg),
        }));
      }

      fullText += decoder.decode();
      const parsed = parseStreamPayload(fullText);
      updateChat(chatId, (chat) => ({
        ...chat,
        updatedAt: Date.now(),
        messages: chat.messages.map((msg, index) => index === chat.messages.length - 1 ? { ...msg, content: parsed.text, sources: parsed.sources || msg.sources || [] } : msg),
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

  function clearLongPress() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
  }

  function openMessageContextMenu(index, role, clientX, clientY) {
    if (loading) return;
    const menuWidth = 196;
    const menuHeight = role === "user" ? 148 : 148;
    const x = Math.min(Math.max(clientX, 8), Math.max(8, window.innerWidth - menuWidth - 8));
    const y = Math.min(Math.max(clientY, 8), Math.max(8, window.innerHeight - menuHeight - 8));
    window.getSelection?.()?.removeAllRanges();
    setMessageContextMenu({ index, role, x, y });
  }

  function handleMessageTouchStart(event, index, role) {
    if (loading || event.touches.length !== 1) return;
    clearLongPress();
    const touch = event.touches[0];
    longPressTriggeredRef.current = false;
    longPressStartRef.current = { x: touch.clientX, y: touch.clientY };
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      longPressTriggeredRef.current = true;
      openMessageContextMenu(index, role, touch.clientX, touch.clientY);
    }, 560);
  }

  function handleMessageTouchMove(event) {
    if (!longPressTimerRef.current || !longPressStartRef.current || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const dx = Math.abs(touch.clientX - longPressStartRef.current.x);
    const dy = Math.abs(touch.clientY - longPressStartRef.current.y);
    if (dx > 10 || dy > 10) clearLongPress();
  }

  function handleMessageTouchEnd() {
    clearLongPress();
  }

  function handleMessageContextMenu(event, index, role) {
    event.preventDefault();
    clearLongPress();
    openMessageContextMenu(index, role, event.clientX, event.clientY);
  }

  function selectMessageText(index) {
    const element = document.getElementById("message-selectable-" + index);
    if (!element) return;
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);
    setMessageContextMenu(null);
  }

  function handleMessageMenuAction(action) {
    if (!messageContextMenu) return;
    const { index } = messageContextMenu;
    setMessageContextMenu(null);

    if (action === "edit") editMessage(index);
    if (action === "copy") copyText(messages[index]?.content || "", index);
    if (action === "regenerate") regenerateMessage(index);
    if (action === "select") selectMessageText(index);
  }

  async function sendMessage(event) {
    event?.preventDefault();
    const text = message.trim();
    if ((!text && !attachedFiles.length && !attachedImages.length) || loading || fileLoading || !activeChat) return;

    let nextMessages;
    let title = activeChat.title;

    if (editingIndex !== null && messages[editingIndex]?.role === "user") {
      nextMessages = [
        ...messages.slice(0, editingIndex),
        {
          role: "user",
          content: (attachedFiles.length || attachedImages.length) ? (text || "Please analyze the attached file(s) and image(s).") : text,
          ...(attachedFiles.length ? {
            fileNames: attachedFiles.map((file) => file.name),
            fileContexts: attachedFiles.map((file) => ({ name: file.name, text: file.text })),
            ...(attachedImages.length ? { imageNames: attachedImages.map((image) => image.name) } : {}),
          } : {}),
        },
      ];
      title = editingIndex === 0 ? text.replace(/\s+/g, " ").slice(0, 42) || "New conversation" : activeChat.title;
    } else {
      nextMessages = [
        ...messages,
        {
          role: "user",
          content: attachedFiles.length ? (text || "Please analyze the attached file(s).") : text,
          ...(attachedFiles.length ? {
            fileNames: attachedFiles.map((file) => file.name),
            fileContexts: attachedFiles.map((file) => ({ name: file.name, text: file.text })),
          } : {}),
        },
      ];
      title = messages.length === 0 ? text.replace(/\s+/g, " ").slice(0, 42) || "New conversation" : activeChat.title;
    }

    updateChat(activeChat.id, (chat) => ({
      ...chat,
      title,
      updatedAt: Date.now(),
      messages: nextMessages,
    }));
    setMessage("");
    setEditingIndex(null);
    const imageMessageIndex = nextMessages.length - 1;
    if (attachedImages.length) imageCacheRef.current.set(imageMessageIndex, attachedImages.map((image) => ({ ...image })));
    setAttachedFiles([]);
    setAttachedImages([]);
    setFileInputKey((value) => value + 1);
    setImageInputKey((value) => value + 1);
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
    const target = messages[index];
    setEditingIndex(index);
    setMessage(target.content || "");
    if (Array.isArray(target.fileContexts) && target.fileContexts.length) {
      setAttachedFiles(target.fileContexts.map((file) => ({
        name: file.name || "Attached file",
        text: file.text || "",
        characters: (file.text || "").length,
        truncated: false,
      })));
    } else {
      setAttachedFiles([]);
    }
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function cancelEdit() {
    if (loading) return;
    setEditingIndex(null);
    setMessage("");
    setAttachedFiles([]);
    setFileInputKey((value) => value + 1);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  async function copyText(text, index = null) {
    try {
      await navigator.clipboard?.writeText(text);
      if (index !== null) {
        setCopiedMessageIndex(index);
        setTimeout(() => setCopiedMessageIndex((current) => current === index ? null : current), 1200);
      }
    } catch {}
  }

  function toggleAssistantFeedback(index, value) {
    setFeedbackByIndex((current) => ({ ...current, [index]: current[index] === value ? null : value }));
  }

  function speakMessage(text) {
    if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }

  async function shareMessage(text) {
    try {
      if (navigator.share) await navigator.share({ title: "Chat Sangam response", text });
      else {
        await navigator.clipboard?.writeText(text);
        alert("Response copied. Share it anywhere you want.");
      }
    } catch {}
  }

  function branchInNewChat(index) {
    if (loading || !activeChat) return;
    const branchMessages = messages.slice(0, index + 1).map((msg) => ({
      ...msg,
      ...(Array.isArray(msg.sources) ? { sources: [...msg.sources] } : {}),
      ...(Array.isArray(msg.fileNames) ? { fileNames: [...msg.fileNames] } : {}),
      ...(Array.isArray(msg.fileContexts) ? { fileContexts: msg.fileContexts.map((file) => ({ ...file })) } : {}),
    }));
    const sourceTitle = branchMessages.find((msg) => msg.role === "user")?.content || activeChat.title || "New conversation";
    const chat = { ...createChat(), title: "Branch: " + sourceTitle.replace(/\s+/g, " ").slice(0, 38), messages: branchMessages, updatedAt: Date.now() };
    setChats((current) => [chat, ...current]);
    setActiveChatId(chat.id);
    setAssistantMenuIndex(null);
    setMessage("");
    setEditingIndex(null);
    setAttachedFiles([]);
    setMobileMenuOpen(false);
  }

  function removeWebResults(index) {
    if (!activeChat || !messages[index]) return;
    updateChat(activeChat.id, (chat) => ({
      ...chat,
      updatedAt: Date.now(),
      messages: chat.messages.map((msg, messageIndex) => messageIndex !== index ? msg : {
        ...msg,
        sources: [],
        content: (msg.content || "")
          .replace(/\[(\d+)\]\(#source-\d+\)/g, "")
          .replace(/\[(\d+)\](?!\()/g, "")
          .replace(/[ \t]{2,}/g, " ")
          .replace(/ \n/g, "\n")
          .trim(),
      }),
    }));
    setAssistantMenuIndex(null);
  }

  function handleAssistantMenuAction(action, index) {
    setAssistantMenuIndex(null);
    if (action === "branch") branchInNewChat(index);
    if (action === "retry") regenerateMessage(index);
    if (action === "remove-web") removeWebResults(index);
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
            <button className={"deep-research-toggle " + (deepResearch ? "active" : "")} onClick={() => { setDeepResearch((value) => !value); setWebSearch(true); }} disabled={loading} type="button" aria-pressed={deepResearch} title="Run a deeper multi-source research pass">
              <span>◈</span> Deep Research <b>{deepResearch ? "ON" : "OFF"}</b>
            </button>
            <div className="model-selector">
              <button className="engine-badge model-selector-button" type="button" onClick={() => setModelMenuOpen((value) => !value)} disabled={loading} aria-expanded={modelMenuOpen} aria-haspopup="menu">
                <span className="engine-dot" /> <strong>{selectedModel.name}</strong><span>{selectedModel.model}</span><b className="model-chevron">⌄</b>
              </button>
              {modelMenuOpen && (
                <div className="model-menu" role="menu">
                  <div className="model-menu-head"><span>SELECT MODEL</span><small>1 active</small></div>
                  <button className="model-option active" type="button" role="menuitem" onClick={() => setModelMenuOpen(false)}>
                    <span className="model-option-icon">⚡</span>
                    <span className="model-option-copy"><strong>Groq · GPT-OSS 20B</strong><small>Groq API · Fast · Active</small></span>
                    <span className="model-check">✓</span>
                  </button>
                  {FUTURE_ENGINES.map((item) => (
                    <button className="model-option disabled" type="button" role="menuitem" key={item.name} disabled title={`${item.name} integration coming soon`}>
                      <span className="model-option-icon">{item.icon}</span>
                      <span className="model-option-copy"><strong>{item.name}</strong><small>Integration coming soon</small></span>
                      <span className="model-lock">SOON</span>
                    </button>
                  ))}
                </div>
              )}
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
                <article
                  className={"message-row " + msg.role}
                  key={index}
                  onTouchStart={(event) => handleMessageTouchStart(event, index, msg.role)}
                  onTouchMove={handleMessageTouchMove}
                  onTouchEnd={handleMessageTouchEnd}
                  onTouchCancel={handleMessageTouchEnd}
                  onContextMenu={(event) => handleMessageContextMenu(event, index, msg.role)}
                >
                  <div className={"message-avatar " + msg.role}>{msg.role === "user" ? "A" : "✦"}</div>
                  <div className="message-main">
                    <div className="message-meta"><strong>{msg.role === "user" ? "You" : "Chat Sangam"}</strong><span>{msg.role === "assistant" ? "Groq · GPT-OSS 20B" : "Message"}</span></div>
                    <div className={"message-bubble " + (msg.role === "assistant" ? "assistant-answer-bubble" : "")}>
                      {msg.role === "assistant" ? (
                        <div className="markdown-content">
                          <div className="message-selectable" id={"message-selectable-" + index}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                            pre: CodeBlock,
                            table: ({ children }) => <div className="table-scroll"><table>{children}</table></div>,
                          }}>{prepareCitationMarkdown(msg.content || "", msg.sources)}</ReactMarkdown>
                          {loading && index === messages.length - 1 && <span className="typing-cursor">▋</span>}
                          {!loading && msg.content && (
                            <>
                              {(() => {
                                const usedSources = getCitedSources(msg.content || "", msg.sources);
                                return (
                                  <>
                                    <div className="assistant-action-bar">
                                       <button className={copiedMessageIndex === index ? "action-icon-button selected" : "action-icon-button"} type="button" onClick={() => copyText(msg.content, index)} data-tooltip={copiedMessageIndex === index ? "Copied" : "Copy"} aria-label={copiedMessageIndex === index ? "Copied" : "Copy response"}><ActionIcon type={copiedMessageIndex === index ? "check" : "copy"} /></button>
                                       <button className={feedbackByIndex[index] === "up" ? "action-icon-button selected" : "action-icon-button"} type="button" onClick={() => toggleAssistantFeedback(index, "up")} data-tooltip="Good response" aria-label="Good response"><ActionIcon type="up" /></button>
                                       <button className={feedbackByIndex[index] === "down" ? "action-icon-button selected" : "action-icon-button"} type="button" onClick={() => toggleAssistantFeedback(index, "down")} data-tooltip="Bad response" aria-label="Bad response"><ActionIcon type="down" /></button>
                                       <button className="action-icon-button" type="button" onClick={() => speakMessage(msg.content)} data-tooltip="Read aloud" aria-label="Read aloud"><ActionIcon type="volume" /></button>
                                       <button className="action-icon-button" type="button" onClick={() => shareMessage(msg.content)} data-tooltip="Share" aria-label="Share response"><ActionIcon type="share" /></button>
                                       <div className="assistant-more-wrap">
                                         <button className={assistantMenuIndex === index ? "action-icon-button active" : "action-icon-button"} type="button" onClick={() => setAssistantMenuIndex((current) => current === index ? null : index)} data-tooltip="More" aria-label="More actions" aria-expanded={assistantMenuIndex === index}><ActionIcon type="more" /></button>
                                         {assistantMenuIndex === index && (
                                           <div className="assistant-more-menu" role="menu">
                                             <div className="assistant-more-time">Response actions</div>
                                             <button type="button" role="menuitem" onClick={() => handleAssistantMenuAction("branch", index)}><ActionIcon type="branch" size={19} /><span>Branch in new chat</span></button>
                                             <button type="button" role="menuitem" onClick={() => handleAssistantMenuAction("retry", index)}><ActionIcon type="retry" size={19} /><span>Retry response</span></button>
                                             {usedSources.length > 0 && <button type="button" role="menuitem" onClick={() => handleAssistantMenuAction("remove-web", index)}><ActionIcon type="web" size={19} /><span>Remove web results</span></button>}
                                           </div>
                                         )}
                                       </div>
                                       {usedSources.length > 0 && <button type="button" className="assistant-sources-button" onClick={() => document.getElementById("sources-panel-" + index)?.scrollIntoView({ behavior: "smooth", block: "nearest" })} data-tooltip="View sources" aria-label="View sources"><ActionIcon type="web" size={15} /><span>Sources</span></button>}
                                     </div>
                                    {usedSources.length > 0 && (
                                      <div className="source-panel" id={"sources-panel-" + index}>
                                        <div className="source-heading"><span>⌕</span> Sources <small>{usedSources.length} used</small></div>
                                        <div className="source-grid">
                                          {usedSources.map((source) => (
                                            <a className="source-card" id={`source-${source.id}`} key={source.id} href={source.url} target="_blank" rel="noreferrer">
                                              <span className="source-number">{source.id}</span>
                                              <span className="source-copy"><strong>{source.title}</strong><small>{source.url.replace(/^https?:\/\//, "").split("/")[0]}</small></span>
                                              <span className="source-arrow">↗</span>
                                            </a>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </>
                          )}
                          </div>
                        </div>
                      ) : (
                        <>
                          {Array.isArray(msg.fileNames) && msg.fileNames.length ? (
                            <div className="message-file-list">
                              {msg.fileNames.map((name, fileIndex) => (
                                <div className="message-file-card" key={name + fileIndex}>
                                  <span className="message-file-icon">📄</span>
                                  <span className="message-file-copy">
                                    <strong>{name}</strong>
                                    <small>{msg.fileContexts?.[fileIndex]?.text ? msg.fileContexts[fileIndex].text.length.toLocaleString() + " characters" : "Attached document"}</small>
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : msg.fileName && (
                            <div className="message-file-card">
                              <span className="message-file-icon">📄</span>
                              <span className="message-file-copy">
                                <strong>{msg.fileName}</strong>
                                <small>{msg.fileContext ? msg.fileContext.length.toLocaleString() + " characters" : "Attached document"}</small>
                              </span>
                            </div>
                          )}
                          <div className="message-user-text message-selectable" id={"message-selectable-" + index}>{msg.content}</div>
                          {!loading && (
                            <div className="message-actions user-message-actions">
                              <button type="button" onClick={() => editMessage(index)} title="Edit message">Edit</button>
                              <button type="button" onClick={() => copyText(msg.content, index)} title="Copy message">{copiedMessageIndex === index ? "Copied" : "Copy"}</button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {messageContextMenu && (
          <>
            <button
              className="message-context-backdrop"
              type="button"
              aria-label="Close message actions"
              onClick={() => setMessageContextMenu(null)}
            />
            <div
              className="message-context-menu"
              role="menu"
              aria-label="Message actions"
              style={{ left: messageContextMenu.x, top: messageContextMenu.y }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className="message-context-title">
                {messageContextMenu.role === "user" ? "Message actions" : "Response actions"}
              </div>
              <div className="message-context-grid">
                {messageContextMenu.role === "user" && (
                  <button type="button" role="menuitem" onClick={() => handleMessageMenuAction("edit")}>
                    <span>✎</span> Edit
                  </button>
                )}
                <button type="button" role="menuitem" onClick={() => handleMessageMenuAction("copy")}>
                  <span>▣</span> Copy
                </button>
                {messageContextMenu.role === "assistant" && (
                  <button type="button" role="menuitem" onClick={() => handleMessageMenuAction("regenerate")}>
                    <span>↻</span> Regenerate
                  </button>
                )}
                <button type="button" role="menuitem" onClick={() => handleMessageMenuAction("select")}>
                  <span>⌁</span> Select text
                </button>
              </div>
            </div>
          </>
        )}

        <div className="composer-dock">
          <form className="composer" onSubmit={sendMessage}>
            <div className="composer-top">
              <span className="composer-model">{editingIndex !== null ? "✎ Editing message" : <>{selectedModel.icon} {selectedModel.name} · {selectedModel.model}{deepResearch ? <em> · Deep Research</em> : webSearch ? <em> · Web Search</em> : null}</>}</span>
              {editingIndex !== null ? (
                <button className="composer-cancel" type="button" onClick={cancelEdit}>Cancel</button>
              ) : (
                <span className="composer-hint">Enter to send · Shift + Enter for new line</span>
              )}
            </div>
            {attachedImages.length > 0 && (
              <div className="attachment-list image-attachment-list">
                {attachedImages.map((image, index) => (
                  <div className="attachment-chip image-attachment-chip" key={image.name + index}>
                    <img src={image.dataUrl} alt={image.name} />
                    <span><strong>{image.name}</strong><small>Image · ready for vision</small></span>
                    <button type="button" onClick={() => removeAttachedImage(index)} disabled={loading}>×</button>
                  </div>
                ))}
              </div>
            )}
            {attachedFiles.length > 0 && (
              <div className="attachment-list">
                {attachedFiles.map((file, index) => (
                  <div className="attachment-chip" key={file.name + index}>
                    <span>📎</span>
                    <span><strong>{file.name}</strong><small>{file.characters.toLocaleString()} chars{file.truncated ? " · truncated" : ""}</small></span>
                    <button type="button" onClick={() => removeAttachedFile(index)} disabled={loading}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="composer-input-row">
              <div className="attach-menu-wrap">
                <button className={"attach-button " + (attachMenuOpen ? "active" : "")} type="button" onClick={openAttachMenu} title="Add attachment" aria-label="Add attachment" aria-expanded={attachMenuOpen}>+</button>
                {attachMenuOpen && (
                  <>
                    <button className="attach-menu-backdrop" type="button" aria-label="Close attachment menu" onClick={() => setAttachMenuOpen(false)} />
                    <div className="attach-menu" role="menu">
                      <button type="button" role="menuitem" onClick={handleImageOption}><span className="attach-menu-icon">⌁</span><span><strong>Camera</strong><small>Take a photo</small></span></button>
                      <button type="button" role="menuitem" onClick={() => { setAttachMenuOpen(false); document.getElementById("image-upload-" + imageInputKey)?.click(); }}><span className="attach-menu-icon">▧</span><span><strong>Photos</strong><small>Choose from gallery</small></span></button>
                      <button type="button" role="menuitem" onClick={handleFilesOption}><span className="attach-menu-icon">□</span><span><strong>Files</strong><small>PDF, TXT, CSV, JSON</small></span></button>
                    </div>
                  </>
                )}
                <input key={fileInputKey} id={"file-upload-" + fileInputKey} className="hidden-file-input" type="file" multiple accept=".pdf,.txt,.md,.csv,.json,application/pdf,text/plain,text/markdown,text/csv,application/json" onChange={handleFileChange} disabled={loading || fileLoading} />
                <input key={"camera-" + imageInputKey} id={"camera-upload-" + imageInputKey} className="hidden-file-input" type="file" accept="image/*" capture="environment" onChange={handleImageChange} disabled={loading || fileLoading} />
                <input key={"photos-" + imageInputKey} id={"image-upload-" + imageInputKey} className="hidden-file-input" type="file" accept="image/*" multiple onChange={handleImageChange} disabled={loading || fileLoading} />
              </div>
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
              <button className={"send-button " + (loading ? "stop-button" : "")} type={loading ? "button" : "submit"} onClick={loading ? stopGeneration : undefined} disabled={!loading && (!message.trim() && !attachedFiles.length)} aria-label={loading ? "Stop generation" : "Send message"}>{loading ? "■" : "↑"}</button>
            </div>
          </form>
          <div className="composer-note">{loading ? "■ Generation in progress · Tap stop to end it." : deepResearch ? "◈ Deep Research is ON · Multiple web searches + source synthesis." : webSearch ? "⌕ Live web search is ON · Groq browser search verifies current information with sources." : "⚡ Powered by Groq · Chat Sangam may make mistakes. Verify important information."}</div>
        </div>
      </section>
    </main>
  );
}
