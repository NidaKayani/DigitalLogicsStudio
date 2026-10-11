import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
  LogOut,
  MoreHorizontal,
  Send,
  SquarePen,
} from "lucide-react";
import { useQuantumChatAuth } from "../../quantumchat/context/QuantumChatAuthContext";
import {
  downloadKeyFile,
  formatKeyFile,
  parseKeyFile,
} from "../../quantumchat/crypto/keyFile";
import { KEY_SET_SIZE } from "../../quantumchat/crypto/keys";
import {
  decryptMessage,
  fetchConversation,
  fetchDiscoverUsers,
  fetchFriends,
  sendDirectMessage,
} from "../../quantumchat/services/chatService";
import { resolveQuantumChatUrl } from "../../config/apiConfig";
import "./QuantumChatWidget.css";

function getInitials(name) {
  const trimmed = name?.trim();
  if (!trimmed) return "Q";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function AuthPanel({ mode, onSwitchMode }) {
  const { login, register, verify2fa } = useQuantumChatAuth();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending2fa, setPending2fa] = useState(null);
  const [totpCode, setTotpCode] = useState("");
  const [freshKeySet, setFreshKeySet] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (pending2fa) {
        if (!/^\d{6}$/.test(totpCode.trim())) {
          setError("Enter the 6-digit authenticator code.");
          return;
        }
        await verify2fa({
          tempToken: pending2fa.tempToken,
          token: totpCode.trim(),
          rememberMe: pending2fa.rememberMe !== false,
        });
        setPending2fa(null);
        return;
      }

      if (mode === "signup") {
        if (!form.username.trim() || !form.email.trim() || form.password.length < 8) {
          setError("Username, email, and password (8+ chars) are required.");
          return;
        }
        const result = await register({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
        });
        setFreshKeySet(result.keySet);
        return;
      }

      const result = await login({
        email: form.email.trim(),
        password: form.password,
        rememberMe: true,
      });
      if (result?.requires2fa) {
        setPending2fa({
          tempToken: result.tempToken,
          rememberMe: result.rememberMe !== false,
        });
        setTotpCode("");
      }
    } catch (err) {
      const isNetwork =
        err.code === "ERR_NETWORK" || err.message === "Network Error";
      setError(
        isNetwork
          ? "Cannot reach QuantumChat (network/CORS). Restart the DLS dev server, or push the QuantumChat-Backend CORS change."
          : err.response?.data?.error || err.message || "Request failed.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (freshKeySet) {
    const secretKeys = freshKeySet.map((k) => k.secretKey);
    return (
      <div className="quantum-chat-fallback">
        <p className="quantum-chat-fallback__title">Save your keys</p>
        <p className="quantum-chat-fallback__text">
          Download <code>keys.txt</code> now. You need this file to read chats on
          other devices. Anyone with it can read your messages.
        </p>
        <div className="quantum-chat-fallback__actions">
          <button
            type="button"
            className="quantum-chat-fallback__btn quantum-chat-fallback__btn--primary"
            onClick={() => {
              const content = formatKeyFile({
                username: form.username.trim(),
                email: form.email.trim(),
                secretKeys,
              });
              downloadKeyFile(content);
            }}
          >
            <Download size={14} style={{ marginRight: 6 }} />
            Download keys.txt
          </button>
          <button
            type="button"
            className="quantum-chat-fallback__btn"
            onClick={() => setFreshKeySet(null)}
          >
            Continue to chats
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="qc-auth-form" onSubmit={handleSubmit}>
      <p className="qc-auth-form__lead">
        {pending2fa
          ? "Enter your authenticator code"
          : mode === "signup"
            ? "Create a QuantumChat account"
            : "Sign in to decrypt your conversations"}
      </p>

      {!pending2fa && mode === "signup" && (
        <label className="qc-field">
          Username
          <input
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            autoComplete="username"
            required
          />
        </label>
      )}

      {!pending2fa && (
        <>
          <label className="qc-field">
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="email"
              required
            />
          </label>
          <label className="qc-field">
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={mode === "signup" ? 8 : undefined}
            />
          </label>
        </>
      )}

      {pending2fa && (
        <label className="qc-field">
          Authenticator code
          <input
            value={totpCode}
            onChange={(e) =>
              setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            autoComplete="one-time-code"
            autoFocus
            required
          />
        </label>
      )}

      {error && <p className="qc-auth-form__error">{error}</p>}

      <button type="submit" className="qc-auth-form__submit" disabled={loading}>
        {loading
          ? "Please wait…"
          : pending2fa
            ? "Verify"
            : mode === "signup"
              ? "Create account"
              : "Sign in"}
      </button>

      {!pending2fa && (
        <button
          type="button"
          className="qc-auth-form__switch"
          onClick={() => onSwitchMode(mode === "signup" ? "signin" : "signup")}
        >
          {mode === "signup"
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
        </button>
      )}
    </form>
  );
}

function KeyGatePanel() {
  const { user, importKeys, regenerateKeys } = useQuantumChatAuth();
  const fileRef = useRef(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const text = await file.text();
      const secretKeys = parseKeyFile(text);
      if (secretKeys.length < KEY_SET_SIZE) {
        throw new Error(
          `Found ${secretKeys.length} keys — need ${KEY_SET_SIZE} in keys.txt.`,
        );
      }
      await importKeys(secretKeys.slice(0, KEY_SET_SIZE));
    } catch (err) {
      setError(err.message || "Could not import keys.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };

  const onRegenerate = async () => {
    const ok = window.confirm(
      "Generate new keys? Old messages encrypted with your previous keys will become unreadable.",
    );
    if (!ok) return;
    setError("");
    setBusy(true);
    try {
      const { keySet } = await regenerateKeys();
      const content = formatKeyFile({
        username: user.username || "user",
        email: user.email || "",
        secretKeys: keySet.map((k) => k.secretKey),
      });
      downloadKeyFile(content);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not regenerate keys.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="quantum-chat-fallback">
      <p className="quantum-chat-fallback__title">Import your keys</p>
      <p className="quantum-chat-fallback__text">
        Signed in as <strong>{user?.email || user?.username}</strong>. Upload your{" "}
        <code>keys.txt</code> to decrypt chats on this device.
      </p>
      {error && <p className="qc-auth-form__error">{error}</p>}
      <div className="quantum-chat-fallback__actions">
        <button
          type="button"
          className="quantum-chat-fallback__btn quantum-chat-fallback__btn--primary"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          Import keys.txt
        </button>
        <button
          type="button"
          className="quantum-chat-fallback__btn"
          disabled={busy}
          onClick={onRegenerate}
        >
          Generate new keys
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".txt,text/plain"
        hidden
        onChange={onFile}
      />
    </div>
  );
}

function ChatReadyPanel({ composeRequest, onComposeHandled }) {
  const { user } = useQuantumChatAuth();
  const [friends, setFriends] = useState([]);
  const [discover, setDiscover] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [peer, setPeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const bottomRef = useRef(null);

  const loadLists = useCallback(async () => {
    setLoadingList(true);
    setListError("");
    try {
      const [friendRows, discoverRows] = await Promise.all([
        fetchFriends().catch(() => []),
        fetchDiscoverUsers().catch(() => []),
      ]);
      setFriends(Array.isArray(friendRows) ? friendRows : []);
      setDiscover(Array.isArray(discoverRows) ? discoverRows : []);
    } catch (err) {
      setListError(err.response?.data?.error || err.message || "Could not load contacts.");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  useEffect(() => {
    if (composeRequest > 0) {
      setPicking(true);
      setPeer(null);
      onComposeHandled?.();
    }
  }, [composeRequest, onComposeHandled]);

  const openPeer = useCallback(
    async (nextPeer) => {
      setPeer(nextPeer);
      setPicking(false);
      setMessages([]);
      try {
        const rows = await fetchConversation(nextPeer.id || nextPeer._id);
        const decrypted = (rows || []).map((row) => decryptMessage(row, user.id));
        setMessages(decrypted);
      } catch (err) {
        setListError(err.response?.data?.error || err.message || "Could not load chat.");
      }
    },
    [user.id],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, peer]);

  const contacts = useMemo(() => {
    const map = new Map();
    [...friends, ...discover].forEach((person) => {
      const id = String(person.id || person._id);
      if (!id || id === String(user.id)) return;
      if (!map.has(id)) map.set(id, { ...person, id });
    });
    const list = [...map.values()];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) =>
      `${p.username || ""} ${p.displayName || ""} ${p.email || ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [friends, discover, query, user.id]);

  const handleSend = async (event) => {
    event.preventDefault();
    if (!peer || !draft.trim() || sending) return;
    setSending(true);
    try {
      const raw = await sendDirectMessage({
        myUserId: user.id,
        peer,
        text: draft,
      });
      setDraft("");
      if (raw) {
        setMessages((prev) => [...prev, decryptMessage(raw, user.id)]);
      }
    } catch (err) {
      setListError(err.response?.data?.error || err.message || "Send failed.");
    } finally {
      setSending(false);
    }
  };

  if (peer && !picking) {
    return (
      <div className="qc-thread">
        <div className="qc-thread__bar">
          <button
            type="button"
            className="quantum-chat-dock__icon-btn"
            aria-label="Back to chats"
            onClick={() => setPeer(null)}
          >
            <ArrowLeft size={16} />
          </button>
          <span className="qc-thread__name">
            {peer.displayName || peer.username || "Chat"}
          </span>
        </div>
        <div className="qc-thread__messages">
          {messages.length === 0 && (
            <p className="qc-thread__empty">No messages yet. Say hello.</p>
          )}
          {messages.map((msg) => {
            const mine = String(msg.from) === String(user.id);
            return (
              <div
                key={msg.id}
                className={`qc-bubble ${mine ? "qc-bubble--mine" : "qc-bubble--theirs"}`}
              >
                {msg.text ?? (
                  <em className="qc-bubble__locked">Unable to decrypt</em>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <form className="qc-thread__composer" onSubmit={handleSend}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message…"
            disabled={sending}
          />
          <button type="submit" disabled={sending || !draft.trim()} aria-label="Send">
            <Send size={16} />
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="qc-chat-list">
      <div className="qc-chat-list__toolbar">
        <input
          className="qc-chat-list__search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people…"
        />
      </div>
      {listError && <p className="qc-auth-form__error">{listError}</p>}
      {loadingList ? (
        <p className="quantum-chat-loading">Loading contacts…</p>
      ) : contacts.length === 0 ? (
        <div className="quantum-chat-fallback">
          <p className="quantum-chat-fallback__title">No contacts yet</p>
          <p className="quantum-chat-fallback__text">
            Add friends in the full QuantumChat app, or search discoverable users above
            when available.
          </p>
        </div>
      ) : (
        <ul className="qc-chat-list__items">
          {contacts.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                className="qc-chat-list__item"
                onClick={() => openPeer(person)}
              >
                <span className="qc-chat-list__avatar" aria-hidden="true">
                  {getInitials(person.displayName || person.username)}
                </span>
                <span className="qc-chat-list__meta">
                  <strong>{person.displayName || person.username}</strong>
                  <small>@{person.username}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuantumChatWidgetInner() {
  const { user, hasLocalKeyring, logout } = useQuantumChatAuth();
  const headerRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [authMode, setAuthMode] = useState("signin");
  const [composeTick, setComposeTick] = useState(0);

  const chatUrl = resolveQuantumChatUrl();
  const initials = useMemo(
    () => getInitials(user?.displayName || user?.username || user?.email),
    [user],
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handlePointer = (event) => {
      if (!headerRef.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, [menuOpen]);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
    setMenuOpen(false);
  }, []);

  const handleOpenExternal = useCallback(() => {
    setMenuOpen(false);
    window.open(chatUrl, "quantumchat", "noopener,noreferrer");
  }, [chatUrl]);

  let body;
  if (!user) {
    body = <AuthPanel mode={authMode} onSwitchMode={setAuthMode} />;
  } else if (!hasLocalKeyring) {
    body = <KeyGatePanel />;
  } else {
    body = (
      <ChatReadyPanel
        composeRequest={composeTick}
        onComposeHandled={() => {}}
      />
    );
  }

  return (
    <section
      className={`quantum-chat-dock${isOpen ? " quantum-chat-dock--open" : ""}`}
      aria-label="QuantumChat"
    >
      <header
        ref={headerRef}
        className="quantum-chat-dock__header"
        onClick={toggleOpen}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleOpen();
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-controls="quantum-chat-dock-body"
      >
        <div className="quantum-chat-dock__identity">
          <span className="quantum-chat-dock__avatar" aria-hidden="true">
            <span className="quantum-chat-dock__avatar-text">{initials}</span>
            <span className="quantum-chat-dock__status" title="Online" />
          </span>
          <span className="quantum-chat-dock__title">QuantumChat</span>
        </div>

        <div className="quantum-chat-dock__actions">
          <div className="quantum-chat-dock__menu-wrap">
            <button
              type="button"
              className="quantum-chat-dock__icon-btn"
              aria-label="More QuantumChat options"
              title="More"
              aria-expanded={menuOpen}
              onClick={(event) => {
                event.stopPropagation();
                setMenuOpen((open) => !open);
              }}
            >
              <MoreHorizontal size={18} strokeWidth={2.2} />
            </button>
            {menuOpen && (
              <div className="quantum-chat-dock__menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="quantum-chat-dock__menu-item"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleOpenExternal();
                  }}
                >
                  Open full QuantumChat
                </button>
                {user && (
                  <button
                    type="button"
                    role="menuitem"
                    className="quantum-chat-dock__menu-item"
                    onClick={(event) => {
                      event.stopPropagation();
                      setMenuOpen(false);
                      logout();
                    }}
                  >
                    <LogOut size={14} style={{ marginRight: 6 }} />
                    Sign out of QuantumChat
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            className="quantum-chat-dock__icon-btn"
            aria-label="Compose new message"
            title="Compose"
            onClick={(event) => {
              event.stopPropagation();
              if (!isOpen) setIsOpen(true);
              if (user && hasLocalKeyring) setComposeTick((n) => n + 1);
            }}
          >
            <SquarePen size={17} strokeWidth={2.1} />
          </button>

          <button
            type="button"
            className="quantum-chat-dock__icon-btn"
            aria-label={isOpen ? "Collapse QuantumChat" : "Expand QuantumChat"}
            title={isOpen ? "Collapse" : "Expand"}
            onClick={(event) => {
              event.stopPropagation();
              toggleOpen();
            }}
          >
            {isOpen ? (
              <ChevronDown size={18} strokeWidth={2.2} />
            ) : (
              <ChevronUp size={18} strokeWidth={2.2} />
            )}
          </button>
        </div>
      </header>

      {isOpen && (
        <div id="quantum-chat-dock-body" className="quantum-chat-dock__body">
          {body}
        </div>
      )}
    </section>
  );
}

QuantumChatWidgetInner.displayName = "QuantumChatWidgetInner";

export default React.memo(QuantumChatWidgetInner);
