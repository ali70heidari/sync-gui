"use client";
import { useEffect, useRef, useState } from "react";
import { House, List, Plus, X } from "@phosphor-icons/react";
import { toast } from "./Toast";
import { terminalKeyInput } from "../../lib/terminal-keys";

export default function TerminalPanel({ remote, onClose, onNew, className = "" }) {
  const [session, setSession] = useState(null);
  const [height, setHeight] = useState(360);
  const [starting, setStarting] = useState(true);
  const [focused, setFocused] = useState(false);
  const outputRef = useRef(null);
  const inputRef = useRef(null);
  const sessionIdRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    let cancelled = false;
    async function start() {
      setStarting(true);
      setSession(null);
      try {
        const response = await fetch("/api/remotes/terminal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ remoteId: remote.id }),
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || "Failed to open terminal.");
        if (cancelled) return;
        sessionIdRef.current = data.session.id;
        setSession(data.session);
      } catch (error) {
        toast(error.message, "error");
        if (!cancelled) onCloseRef.current();
      } finally {
        if (!cancelled) setStarting(false);
      }
    }
    start();
    return () => {
      cancelled = true;
      if (sessionIdRef.current) {
        fetch(`/api/remotes/terminal?id=${encodeURIComponent(sessionIdRef.current)}`, {
          method: "DELETE",
        }).catch(() => {});
      }
      sessionIdRef.current = null;
    };
  }, [remote.id]);

  useEffect(() => {
    if (!session?.id) return;
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/remotes/terminal?id=${encodeURIComponent(session.id)}`);
        const data = await response.json();
        if (response.ok && data.ok) setSession(data.session);
      } catch {}
    }, 500);
    return () => clearInterval(timer);
  }, [session?.id]);

  useEffect(() => {
    if (!outputRef.current) return;
    outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [session?.output]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [remote.id, session?.status]);

  function startResize(event) {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = height;
    const onMove = (moveEvent) => {
      const next = Math.min(720, Math.max(220, startHeight + startY - moveEvent.clientY));
      setHeight(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  async function sendInput(input) {
    if (!session?.id || session.status !== "running") return;
    try {
      const response = await fetch("/api/remotes/terminal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session.id, input }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Failed to send input.");
      setSession(data.session);
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function handleKeyDown(event) {
    const input = terminalKeyInput(event);
    if (!input) return;
    event.preventDefault();
    await sendInput(input);
  }

  async function handlePaste(event) {
    const text = event.clipboardData.getData("text");
    if (!text) return;
    event.preventDefault();
    await sendInput(text);
  }

  const status = starting ? "opening" : session?.status || "closed";

  return (
    <section className={`terminal-panel ${className}`} style={{ height }}>
      <div
        className="terminal-resize-handle"
        onMouseDown={startResize}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize terminal"
      />
      <header className="terminal-panel-head">
        <div className="terminal-nav-icons">
          <button type="button" aria-label="Terminal menu">
            <List size={17} />
          </button>
          <button type="button" aria-label="Terminal home">
            <House size={17} />
          </button>
        </div>
        <div className="terminal-tab active">
          <button type="button" onClick={onClose} aria-label="Close terminal">
            <X size={13} />
          </button>
          <strong>{remote.name || remote.host || "Terminal"}</strong>
          <span>{status}</span>
        </div>
        <button className="terminal-add-tab" type="button" onClick={onNew} aria-label="New terminal">
          <Plus size={17} />
        </button>
      </header>
      <div className="terminal-screen" onClick={() => inputRef.current?.focus()}>
        <pre
          ref={outputRef}
          className={`terminal-output ${focused && session?.status === "running" ? "focused" : ""}`}
        >
          {starting ? "Opening terminal...\n" : session?.output || ""}
        </pre>
        <input
          className="terminal-hidden-input"
          ref={inputRef}
          value=""
          onChange={() => {}}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={!session || session.status !== "running"}
          spellCheck="false"
          autoComplete="off"
          aria-label="Terminal input"
        />
      </div>
    </section>
  );
}
