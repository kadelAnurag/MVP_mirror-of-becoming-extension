// Minimal overlay UI injected into the page on demand.
// No storage. Removed automatically after duration or on close.

(function () {
    console.log("[MOB] content.js loaded on", location.href); // <— LOG #1
  
    let overlayEl = null;
    let hideTimer = null;
  
    function prefersReducedMotion() {
      return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
  
    function makeOverlay({ archetype, prompt, durationMs, count } = {}) {
      console.log("[MOB] SHOW_OVERLAY received", { archetype, prompt, durationMs, count }); // <— LOG #2
  
      // If tab is currently hidden (e.g., during a fast switch), wait until visible
      if (document.hidden) {
        console.log("[MOB] Tab hidden, delaying overlay until visible");
        const onVisible = () => {
          if (!document.hidden) {
            document.removeEventListener("visibilitychange", onVisible);
            makeOverlay({ archetype, prompt, durationMs, count });
          }
        };
        document.addEventListener("visibilitychange", onVisible);
        return;
      }
  
      // If exists, reuse (update text + restart timer)
      if (!overlayEl) {
        overlayEl = document.createElement("div");
        overlayEl.id = "mob-overlay";
        overlayEl.setAttribute("role", "dialog");
        overlayEl.setAttribute("aria-modal", "true");
        overlayEl.style.position = "fixed";
        overlayEl.style.inset = "0";
        overlayEl.style.background = "rgba(0,0,0,0.45)";
        overlayEl.style.backdropFilter = "blur(2px)";
        overlayEl.style.display = "flex";
        overlayEl.style.alignItems = "center";
        overlayEl.style.justifyContent = "center";
        overlayEl.style.zIndex = "2147483647";
        overlayEl.style.pointerEvents = "auto"; // block clicks behind during pause
  
        const card = document.createElement("div");
        card.id = "mob-card";
        card.style.width = "min(92vw, 420px)";
        card.style.background = "white";
        card.style.borderRadius = "18px";
        card.style.boxShadow = "0 10px 30px rgba(0,0,0,0.25)";
        card.style.padding = "20px 18px 16px";
        card.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
        card.style.color = "#111";
  
        const title = document.createElement("div");
        title.id = "mob-title";
        title.style.fontSize = "14px";
        title.style.fontWeight = "700";
        title.style.letterSpacing = "0.06em";
        title.style.textTransform = "uppercase";
        title.style.opacity = "0.7";
        title.style.marginBottom = "8px";
  
        const text = document.createElement("div");
        text.id = "mob-text";
        text.style.fontSize = "18px";
        text.style.lineHeight = "1.4";
        text.style.marginBottom = "16px";
  
        const breath = document.createElement("div");
        breath.id = "mob-breath";
        breath.style.width = "12px";
        breath.style.height = "12px";
        breath.style.margin = "8px auto 16px";
        breath.style.borderRadius = "999px";
        breath.style.background = "#111";
  
        // Breathing animation (disabled if prefers-reduced-motion)
        if (!prefersReducedMotion()) {
          breath.style.animation = "mob-breathe 4s ease-in-out infinite";
        }
  
        const btnRow = document.createElement("div");
        btnRow.style.display = "flex";
        btnRow.style.justifyContent = "flex-end";
        btnRow.style.gap = "8px";
  
        const closeBtn = document.createElement("button");
        closeBtn.textContent = "Close";
        closeBtn.style.padding = "8px 12px";
        closeBtn.style.border = "1px solid rgba(0,0,0,0.1)";
        closeBtn.style.borderRadius = "10px";
        closeBtn.style.background = "#f7f7f7";
        closeBtn.style.cursor = "pointer";
        closeBtn.addEventListener("click", removeOverlay);
  
        btnRow.appendChild(closeBtn);
  
        // Key handler: Esc to close
        overlayEl.addEventListener("keydown", (e) => {
          if (e.key === "Escape") removeOverlay();
        });
  
        card.appendChild(title);
        card.appendChild(text);
        card.appendChild(breath);
        card.appendChild(btnRow);
        overlayEl.appendChild(card);
  
        // Prefer body; fall back to documentElement
        const mountTarget = document.body || document.documentElement;
        mountTarget.appendChild(overlayEl);
  
        // Add keyframes once
        const style = document.createElement("style");
        style.textContent = `
          @keyframes mob-breathe {
            0% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(2.8); opacity: 1; }
            100% { transform: scale(1); opacity: 0.8; }
          }
        `;
        (document.head || document.documentElement).appendChild(style);
      }
  
      // Update content
      overlayEl.querySelector("#mob-title").textContent =
        typeof count === "number" ? `${archetype} (${count})` : String(archetype || "");
      overlayEl.querySelector("#mob-text").textContent = String(prompt || "");
  
      // Focus for accessibility
      overlayEl.tabIndex = -1;
      overlayEl.focus();
  
      // Auto-hide after duration
      clearTimeout(hideTimer);
      hideTimer = setTimeout(removeOverlay, Math.max(5000, durationMs || 20000));
    }
  
    function removeOverlay() {
      if (overlayEl && overlayEl.parentNode) {
        overlayEl.parentNode.removeChild(overlayEl);
      }
      overlayEl = null;
      clearTimeout(hideTimer);
      hideTimer = null;
      console.log("[MOB] overlay removed");
    }
  
    // Cleanup on navigation visibility change (avoid zombie overlays)
    // Add a small grace to prevent removal during brief hidden states while switching
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        setTimeout(() => {
          if (document.hidden) removeOverlay();
        }, 500);
      }
    });
  
// Listen for background triggers
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[MOB] runtime message", msg); // <— LOG #3

  if (msg && msg.type === "PING") {
    // Reply immediately so background knows we're alive
    sendResponse({ alive: true });
    return; // stop further handling
  }

  if (msg && msg.type === "SHOW_OVERLAY" && msg.payload) {
    makeOverlay(msg.payload);
  }
});
  
    // --- TEST HOOK: trigger overlay manually from DevTools ---
    // On any normal page console, run: window.mobTestOverlay()
    window.mobTestOverlay = function () {
      makeOverlay({
        archetype: "Trickster",
        prompt: "Manual test: overlay should show now.",
        durationMs: 5000,
        count: 3
      });
    };
  })();