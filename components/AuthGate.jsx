"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/client";

export default function AuthGate() {
  const [supabase, setSupabase] = useState(null);
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    setSupabase(client);
    if (!client) {
      setAuthLoading(false);
      return;
    }

    client.auth.getUser().then(({ data, error: authError }) => {
      const nextUser = authError ? null : data?.user ?? null;
      setUser(nextUser);
      setAuthLoading(false);
      window.dispatchEvent(new CustomEvent("chat-sangam-auth-changed", { detail: { user: nextUser } }));
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setAuthLoading(false);
      window.dispatchEvent(new CustomEvent("chat-sangam-auth-changed", { detail: { user: nextUser } }));
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (authError) throw authError;
        if (data.session && data.user) {
          setUser(data.user);
          setNotice("Account created. You are signed in.");
        } else {
          setNotice("Signup submitted. Check your email to confirm your account, then return here to sign in.");
        }
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;
        setUser(data.user);
        setNotice("Signed in successfully.");
      }
    } catch (authError) {
      setError(authError?.message || "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    const { error: authError } = await supabase.auth.signOut();
    if (authError) setError(authError.message);
  }

  if (authLoading) return null;

  if (user) {
    return (
      <div style={{ position: "fixed", top: 12, right: 12, zIndex: 9000, display: "flex", alignItems: "center", gap: 8, maxWidth: "calc(100vw - 24px)", padding: "8px 10px", border: "1px solid rgba(255,255,255,.14)", borderRadius: 999, background: "rgba(15,13,22,.92)", color: "#f7f4fa", backdropFilter: "blur(14px)", font: "12px system-ui,sans-serif" }}>
        <span aria-label="Signed in" style={{ width: 7, height: 7, borderRadius: "50%", background: "#30d158", flexShrink: 0 }} />
        <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email || "Chat Sangam account"}</span>
        <button type="button" onClick={signOut} style={{ border: 0, borderRadius: 999, padding: "6px 10px", color: "#fff", background: "rgba(255,255,255,.1)", cursor: "pointer" }}>Sign out</button>
      </div>
    );
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="chat-sangam-auth-title" style={{ position: "fixed", inset: 0, zIndex: 10000, display: "grid", placeItems: "center", padding: 18, background: "rgba(5,4,9,.82)", backdropFilter: "blur(16px)", color: "#f7f4fa", fontFamily: "system-ui,sans-serif" }}>
      <form onSubmit={submit} style={{ width: "min(100%, 420px)", padding: 26, border: "1px solid rgba(255,255,255,.12)", borderRadius: 24, background: "linear-gradient(145deg,#17121f,#0d0b12 70%)", boxShadow: "0 24px 90px rgba(0,0,0,.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: 14, color: "#fff", fontSize: 22, background: "linear-gradient(135deg,#f43f8c,#8b5cf6)" }}>✦</div>
          <div>
            <div id="chat-sangam-auth-title" style={{ fontSize: 21, fontWeight: 750 }}>Chat Sangam</div>
            <div style={{ color: "#aaa2b4", fontSize: 12 }}>One workspace. Many AIs.</div>
          </div>
        </div>
        <h2 style={{ margin: "0 0 7px", fontSize: 19 }}>{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
        <p style={{ margin: "0 0 20px", color: "#aaa2b4", fontSize: 13, lineHeight: 1.5 }}>Sign in to use AI chat, keep your chats synced to your account, and access your daily free quota.</p>
        {!supabase && <p style={{ color: "#ff9eac", fontSize: 13 }}>Supabase is not configured. Check the Vercel environment variables.</p>}
        <label style={{ display: "block", marginBottom: 12, fontSize: 12, color: "#c8c1d0" }}>
          Email
          <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} style={{ display: "block", width: "100%", marginTop: 6, padding: "12px 13px", border: "1px solid rgba(255,255,255,.15)", borderRadius: 12, outline: "none", background: "#09080d", color: "#fff" }} />
        </label>
        <label style={{ display: "block", marginBottom: 14, fontSize: 12, color: "#c8c1d0" }}>
          Password (minimum 8 characters)
          <input required minLength={8} type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} style={{ display: "block", width: "100%", marginTop: 6, padding: "12px 13px", border: "1px solid rgba(255,255,255,.15)", borderRadius: 12, outline: "none", background: "#09080d", color: "#fff" }} />
        </label>
        {error && <p role="alert" style={{ color: "#ff9eac", fontSize: 13, lineHeight: 1.45 }}>{error}</p>}
        {notice && <p role="status" style={{ color: "#a8f0bd", fontSize: 13, lineHeight: 1.45 }}>{notice}</p>}
        <button disabled={!supabase || busy} type="submit" style={{ width: "100%", border: 0, borderRadius: 12, padding: "13px 15px", fontWeight: 700, color: "#fff", background: "linear-gradient(100deg,#f43f8c,#8b5cf6)", cursor: busy ? "wait" : "pointer", opacity: !supabase || busy ? .65 : 1 }}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</button>
        <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setNotice(""); }} style={{ width: "100%", marginTop: 10, border: "1px solid rgba(255,255,255,.14)", borderRadius: 12, padding: "11px 15px", color: "#e8e0ee", background: "transparent", cursor: "pointer" }}>{mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}</button>
        <p style={{ margin: "16px 0 0", color: "#8e8798", fontSize: 11, textAlign: "center" }}>Free plan: 20 AI requests per day. Your chats are private to your account.</p>
      </form>
    </div>
  );
}
