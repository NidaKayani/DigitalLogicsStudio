import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, MoreHorizontal, SquarePen } from "lucide-react";
import { useAuth } from "../../../auth/context/AuthContext";
import {
  isQuantumChatEmbedEnabled,
  resolveQuantumChatUrl,
} from "../../config/apiConfig";
import "./QuantumChatWidget.css";

const IFRAME_LOAD_TIMEOUT_MS = 3000;

function getInitials(name) {
  const trimmed = name?.trim();
  if (!trimmed) return "U";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function QuantumChatWidgetInner() {
  const { user } = useAuth();
  const headerRef = useRef(null);
  const loadTimerRef = useRef(null);
  const embedEnabled = isQuantumChatEmbedEnabled();

  const [isOpen, setIsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const [embedFailed, setEmbedFailed] = useState(!embedEnabled);

  const chatUrl = resolveQuantumChatUrl();
  const initials = useMemo(() => getInitials(user?.name), [user?.name]);

  const clearLoadTimer = useCallback(() => {
    if (loadTimerRef.current) {
      clearTimeout(loadTimerRef.current);
      loadTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearLoadTimer(), [clearLoadTimer]);

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
      if (!headerRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, [menuOpen]);

  const startEmbedLoad = useCallback(() => {
    if (!embedEnabled || embedFailed) return;
    setHasLoadedOnce(true);
    setIframeReady(false);
    clearLoadTimer();
    loadTimerRef.current = setTimeout(() => {
      setEmbedFailed(true);
    }, IFRAME_LOAD_TIMEOUT_MS);
  }, [embedEnabled, embedFailed, clearLoadTimer]);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setMenuOpen(false);
        startEmbedLoad();
      }
      return next;
    });
  }, [startEmbedLoad]);

  const handleIframeLoad = useCallback(() => {
    clearLoadTimer();
    setIframeReady(true);
    setEmbedFailed(false);
  }, [clearLoadTimer]);

  const handleOpenExternal = useCallback(() => {
    setMenuOpen(false);
    const width = Math.min(1100, window.screen.availWidth - 40);
    const height = Math.min(760, window.screen.availHeight - 40);
    const left = Math.max(0, Math.round((window.screen.availWidth - width) / 2));
    const top = Math.max(0, Math.round((window.screen.availHeight - height) / 2));
    window.open(
      chatUrl,
      "quantumchat",
      `noopener,noreferrer,width=${width},height=${height},left=${left},top=${top}`,
    );
  }, [chatUrl]);

  const handleCompose = useCallback(
    (event) => {
      event.stopPropagation();
      handleOpenExternal();
    },
    [handleOpenExternal],
  );

  const handleRetryEmbed = useCallback(() => {
    if (!embedEnabled) {
      handleOpenExternal();
      return;
    }
    setEmbedFailed(false);
    setIframeReady(false);
    setHasLoadedOnce(false);
    requestAnimationFrame(() => {
      setHasLoadedOnce(true);
      clearLoadTimer();
      loadTimerRef.current = setTimeout(() => {
        setEmbedFailed(true);
      }, IFRAME_LOAD_TIMEOUT_MS);
    });
  }, [embedEnabled, clearLoadTimer, handleOpenExternal]);

  const showFallback = !embedEnabled || embedFailed;

  return (
    <section
      className={`quantum-chat-dock${isOpen ? " quantum-chat-dock--open" : ""}`}
      aria-label="Messaging"
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
          <span className="quantum-chat-dock__title">Messaging</span>
        </div>

        <div className="quantum-chat-dock__actions">
          <div className="quantum-chat-dock__menu-wrap">
            <button
              type="button"
              className="quantum-chat-dock__icon-btn"
              aria-label="More messaging options"
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
                  Open QuantumChat
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="quantum-chat-dock__icon-btn"
            aria-label="Compose new message"
            title="Compose"
            onClick={handleCompose}
          >
            <SquarePen size={17} strokeWidth={2.1} />
          </button>

          <button
            type="button"
            className="quantum-chat-dock__icon-btn"
            aria-label={isOpen ? "Collapse messaging" : "Expand messaging"}
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
        <div
          id="quantum-chat-dock-body"
          className="quantum-chat-dock__body"
          aria-hidden={!isOpen}
        >
          {showFallback ? (
            <div className="quantum-chat-fallback">
              <p className="quantum-chat-fallback__title">QuantumChat</p>
              <p className="quantum-chat-fallback__text">
                {embedEnabled
                  ? "Messaging could not be loaded inside this panel. Open QuantumChat in a window instead."
                  : "Open QuantumChat for your secured conversations. Sign in there to message your team."}
              </p>
              <div className="quantum-chat-fallback__actions">
                <button
                  type="button"
                  className="quantum-chat-fallback__btn quantum-chat-fallback__btn--primary"
                  onClick={handleOpenExternal}
                >
                  Open QuantumChat
                </button>
                {embedEnabled && (
                  <button
                    type="button"
                    className="quantum-chat-fallback__btn"
                    onClick={handleRetryEmbed}
                  >
                    Try embed again
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {!iframeReady && (
                <div className="quantum-chat-loading" aria-live="polite">
                  Loading messages…
                </div>
              )}
              {hasLoadedOnce && (
                <iframe
                  key={chatUrl}
                  title="QuantumChat"
                  src={chatUrl}
                  className={`quantum-chat-iframe${iframeReady ? " quantum-chat-iframe--ready" : ""}`}
                  onLoad={handleIframeLoad}
                  allow="clipboard-read; clipboard-write"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

QuantumChatWidgetInner.displayName = "QuantumChatWidgetInner";

export default React.memo(QuantumChatWidgetInner);
