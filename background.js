// --- Config knobs ---
const W_MS = 20_000;        // time window (20s)
const N_SWITCHES = 2;       // trigger after 2 switches
const COOLDOWN_MS = 10_000; // 10s cooldown

// --- State (in-memory only) ---
let timestamps = []; // recent tab-switch times (ms)
let cooling = false;

console.log("[MOB] Background loaded");

// Helper: prune timestamps older than now - W_MS
function prune(now) {
  const cutoff = now - W_MS;
  timestamps = timestamps.filter(t => t >= cutoff);
  console.log("[MOB] prune -> count:", timestamps.length);
}

// Ensure content.js is present in the target tab
async function ensureContentInjected(tabId) {
  try {
    // If a listener exists in that tab, this won't throw
    await chrome.tabs.sendMessage(tabId, { type: "PING" });
    return true;
  } catch (_) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
      await new Promise(r => setTimeout(r, 120)); // tiny settle time
      console.log("[MOB] Injected content.js via scripting");
      return true;
    } catch (e) {
      console.warn("[MOB] Inject failed:", e?.message);
      return false;
    }
  }
}

async function triggerOverlay(tabId) {
  // Skip restricted/unsupported URLs
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (e) {
    console.warn("[MOB] Could not get tab:", e?.message);
    return;
  }
  if (!tab?.url || !/^https?:/i.test(tab.url)) {
    console.warn("[MOB] Skip trigger: restricted or unsupported URL:", tab?.url);
    return;
  }

  const payload = {
    archetype: "Trickster",
    prompt: "Are you exploring—or escaping?",
    durationMs: 20000,        // 20s overlay
    count: timestamps.length  // number of recent switches
  };

  console.log("[MOB] Threshold reached. Preparing to show on", tab.url);

  // Make sure content script is alive in this tab
  const ok = await ensureContentInjected(tabId);
  if (ok) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: "SHOW_OVERLAY", payload });
      console.log("[MOB] SHOW_OVERLAY sent to", tab.url);
    } catch (err) {
      console.warn("[MOB] sendMessage failed after inject:", err?.message);
    }
  }

  // Enter cooldown and reset
  cooling = true;
  timestamps = [];
  setTimeout(() => {
    cooling = false;
    console.log("[MOB] Cooldown ended");
  }, COOLDOWN_MS);
}

// Listen for tab activation (user switches to another tab)
chrome.tabs.onActivated.addListener(({ tabId }) => {
  if (cooling) return console.log("[MOB] Cooling; ignore switch");

  const now = Date.now();
  timestamps.push(now);
  console.log("[MOB] Switch @", new Date(now).toLocaleTimeString(), "queue pre-prune:", timestamps.length);
  prune(now);

  if (timestamps.length >= N_SWITCHES) {
    triggerOverlay(tabId);
  } else {
    console.log("[MOB] Count:", timestamps.length, "Threshold:", N_SWITCHES);
  }
});

// Also count creating a new tab as a switch
chrome.tabs.onCreated.addListener(() => {
  if (cooling) return console.log("[MOB] Cooling; ignore new tab");
  const now = Date.now();
  timestamps.push(now);
  prune(now);
  console.log("[MOB] New tab created; count:", timestamps.length);
  if (timestamps.length >= N_SWITCHES) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) triggerOverlay(tabs[0].id);
    });
  }
});

// Also count focus returning to the window (feels like a switch)
chrome.windows.onFocusChanged.addListener(winId => {
  if (cooling) return console.log("[MOB] Cooling; ignore focus change");
  if (winId === chrome.windows.WINDOW_ID_NONE) return;

  const now = Date.now();
  timestamps.push(now);
  console.log("[MOB] Window focus change; queue pre-prune:", timestamps.length);
  prune(now);
});