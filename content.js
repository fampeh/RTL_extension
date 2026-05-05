const fixedNodes = new Set();
const fixedBlocks = new Set();
let autoMode = true;
let currentMode = "default";
let observer = null;
let idleHandle = null;
let fallbackTimer = null;
let scheduledAt = 0;
const pendingRoots = new Set();
const RTL_FIX_STYLE_ID = "rtl-fix-intrinsic-zones-style";
const RTL_FIX_DYNAMIC_STYLE_ID = "rtl-fix-dynamic-style";
const RTL_FIX_WRAPPER_CLASS = "rtl-fix-fragment";
const RTL_FIX_BLOCK_CLASS = "rtl-fix-block";

const INTRINSIC_LTR_SELECTOR = [
  "pre",
  "code",
  "kbd",
  "samp",
  "var",
  "math",
  ".hljs",
  ".highlight",
  ".prism-code",
  ".token",
  ".chroma",
  ".CodeMirror",
  ".monaco-editor",
  "[class*='language-']",
  "[class*='lang-']",
  "[data-no-rtl='1']"
].join(", ");

const PERSIAN_CHAR_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const ENGLISH_CHAR_REGEX = /[A-Za-z]/;
const LIST_PREFIX_REGEX = /^\s*(?:\d{1,3}\s*(?:[.)]|[-–—]))\s+/;

function containsPersian(text) {
  return PERSIAN_CHAR_REGEX.test(text || "");
}

function isCleanPersianText(text) {
  if (!text || !containsPersian(text)) return false;
  const stripped = text.trim();
  if (!stripped) return false;
  return /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s\u200c\u200f\u061f\u060c\u061b.,!?:;()\[\]{}«»"'\-–—\d]+$/.test(stripped);
}

function isEligibleTextContainer(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  if (!el.isConnected || !el.closest("body")) return false;
  return true;
}

function isIntrinsicLtrZone(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  return Boolean(el.closest(`${INTRINSIC_LTR_SELECTOR}, textarea, input, [contenteditable='true']`));
}

function isBlockElement(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  const display = window.getComputedStyle(el).display;
  return ["block", "flex", "grid", "list-item", "table", "table-row", "table-cell", "flow-root"].includes(display);
}

function findNearestBlockContainer(el) {
  while (el && el !== document.body) {
    if (isBlockElement(el)) return el;
    el = el.parentElement;
  }
  return null;
}

function getLanguageCounts(text) {
  const compact = (text || "").replace(LIST_PREFIX_REGEX, "");
  let fa = 0;
  let en = 0;
  for (const part of compact.match(/[\p{L}\p{N}_-]+/gu) || []) {
    if (containsPersian(part)) fa += 1;
    else if (ENGLISH_CHAR_REGEX.test(part)) en += 1;
  }
  return { fa, en };
}

function isPersianDominantBlock(block) {
  if (!block) return false;
  const text = (block.innerText || block.textContent || "").trim();
  if (!text || !containsPersian(text)) return false;
  const { fa, en } = getLanguageCounts(text);
  return fa > 0 && fa >= en;
}

function hasListStyleNumericPrefix(text) {
  return LIST_PREFIX_REGEX.test(text || "");
}

function applyBlockAlignment(block, preferredDirection = "rtl") {
  if (!block) return;
  block.dataset.rtlFixBlock = "1";
  block.dataset.rtlFixPreferredDirection = preferredDirection;
  block.classList.add(RTL_FIX_BLOCK_CLASS);
  fixedBlocks.add(block);
  applyListAncestorAlignment(block);
}

function restoreBlockAlignment(block) {
  if (!block || block.dataset.rtlFixBlock !== "1") return;
  block.classList.remove(RTL_FIX_BLOCK_CLASS);
  delete block.dataset.rtlFixBlock;
  delete block.dataset.rtlFixPreferredDirection;
}

function applyListAncestorAlignment(block) {
  let node = block;
  while (node && node !== document.body) {
    if (node.tagName === "UL" || node.tagName === "OL" || node.tagName === "LI") {
      if (node.dataset.rtlFixBlock !== "1") {
        node.dataset.rtlFixBlock = "1";
        node.dataset.rtlFixPreferredDirection = "rtl";
        node.classList.add(RTL_FIX_BLOCK_CLASS);
        fixedBlocks.add(node);
      }
    }
    node = node.parentElement;
  }
}

function wrapTextFragment(text, isPersian) {
  const wrapper = document.createElement("span");
  wrapper.setAttribute("data-rtl-fix", "1");
  wrapper.className = `${RTL_FIX_WRAPPER_CLASS} ${isPersian ? "rtl-fix-rtl" : "rtl-fix-ltr"}`;
  wrapper.textContent = text;
  fixedNodes.add(wrapper);
  return wrapper;
}

function wrapPersianTextNode(node) {
  const value = node.nodeValue;
  if (!value || !containsPersian(value)) return;
  const parent = node.parentNode;
  if (!parent) return;

  const frag = document.createDocumentFragment();
  const tokens = value.split(/([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u200c\u200f\s\d.,!?:;()\[\]{}«»"'\-–—]+)/g);
  for (const token of tokens) {
    if (!token) continue;
    if (containsPersian(token)) frag.appendChild(wrapTextFragment(token, true));
    else frag.appendChild(document.createTextNode(token));
  }
  parent.replaceChild(frag, node);
}

function fixIntrinsicZonesAlignment(root = document.body) {
  if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
  const intrinsicZones = root.matches?.(INTRINSIC_LTR_SELECTOR)
    ? [root, ...root.querySelectorAll(INTRINSIC_LTR_SELECTOR)]
    : root.querySelectorAll(INTRINSIC_LTR_SELECTOR);
  intrinsicZones.forEach(zone => {
    const block = findNearestBlockContainer(zone) || zone;
    applyBlockAlignment(block, "ltr");
  });
}

function processRoot(root = document.body) {
  if (!root || !root.isConnected) return;
  if (root.nodeType === Node.TEXT_NODE) root = root.parentElement;
  if (!root || root.nodeType !== Node.ELEMENT_NODE) return;

  fixIntrinsicZonesAlignment(root);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || node.nodeValue.length < 2 || !containsPersian(node.nodeValue)) return NodeFilter.FILTER_REJECT;
      if (!isEligibleTextContainer(node.parentElement)) return NodeFilter.FILTER_REJECT;
      if (isIntrinsicLtrZone(node.parentElement)) return NodeFilter.FILTER_REJECT;
      if (node.parentElement?.closest("[data-rtl-fix='1']")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const matched = [];
  while (walker.nextNode()) matched.push(walker.currentNode);

  for (const node of matched) {
    if (!node.isConnected || !node.parentElement) continue;
    const block = findNearestBlockContainer(node.parentElement);

    if (block && isPersianDominantBlock(block)) {
      applyBlockAlignment(block, "rtl");
      if (hasListStyleNumericPrefix((block.innerText || block.textContent || ""))) {
        applyListAncestorAlignment(block);
      }
    }

    if (isCleanPersianText(node.nodeValue)) continue;
    wrapPersianTextNode(node);
  }
}

function resetFix() {
  for (const wrapper of fixedNodes) {
    const parent = wrapper.parentNode;
    if (!parent) continue;
    parent.replaceWith(parent.textContent);
  }
  fixedNodes.clear();
  fixedBlocks.forEach(restoreBlockAlignment);
  fixedBlocks.clear();
}

function processPage() {
  if (pendingRoots.size === 0) {
    processRoot(document.body);
    return;
  }
  const roots = Array.from(pendingRoots);
  pendingRoots.clear();
  roots.forEach(root => processRoot(root));
}

function runScheduledProcess(deadline) {
  idleHandle = null;
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
  if (deadline && typeof deadline.timeRemaining === "function") {
    while (pendingRoots.size > 0 && deadline.timeRemaining() > 4) {
      const iterator = pendingRoots.values().next();
      if (iterator.done) break;
      const root = iterator.value;
      pendingRoots.delete(root);
      processRoot(root);
    }
    if (pendingRoots.size > 0) scheduleProcess(true);
    return;
  }
  processPage();
}

function scheduleProcess(force = false) {
  if (!force) {
    const now = Date.now();
    if (now - scheduledAt < 50 && (idleHandle !== null || fallbackTimer !== null)) return;
    scheduledAt = now;
  }
  if (idleHandle !== null || fallbackTimer !== null) return;
  const invoke = (deadline) => runScheduledProcess(deadline);
  if (typeof requestIdleCallback === "function") {
    idleHandle = requestIdleCallback(invoke, { timeout: 200 });
  } else {
    fallbackTimer = setTimeout(() => invoke(), 60);
  }
}

function ensureIntrinsicLtrStyles() {
  if (!document.getElementById(RTL_FIX_STYLE_ID)) {
    const style = document.createElement("style");
    style.id = RTL_FIX_STYLE_ID;
    style.textContent = `
      ${INTRINSIC_LTR_SELECTOR},
      ${INTRINSIC_LTR_SELECTOR} * {
        direction: ltr !important;
        text-align: left !important;
        unicode-bidi: plaintext;
      }
    `;
    document.documentElement.appendChild(style);
  }

  if (!document.getElementById(RTL_FIX_DYNAMIC_STYLE_ID)) {
    const dynamicStyle = document.createElement("style");
    dynamicStyle.id = RTL_FIX_DYNAMIC_STYLE_ID;
    dynamicStyle.textContent = `
      .${RTL_FIX_WRAPPER_CLASS} { unicode-bidi: isolate; }
      .${RTL_FIX_WRAPPER_CLASS}.rtl-fix-rtl { direction: rtl; }
      .${RTL_FIX_WRAPPER_CLASS}.rtl-fix-ltr { direction: ltr; }
      .${RTL_FIX_BLOCK_CLASS}[data-rtl-fix-preferred-direction="rtl"] {
        text-align: right;
        direction: rtl;
        unicode-bidi: isolate;
      }
      .${RTL_FIX_BLOCK_CLASS}[data-rtl-fix-preferred-direction="ltr"] {
        text-align: left;
        direction: ltr;
        unicode-bidi: isolate;
      }
    `;
    document.documentElement.appendChild(dynamicStyle);
  }
}

function stopAutoFixObserver() {
  if (observer) observer.disconnect();
  observer = null;
  if (idleHandle !== null && typeof cancelIdleCallback === "function") {
    cancelIdleCallback(idleHandle);
    idleHandle = null;
  }
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
  pendingRoots.clear();
}

function startAutoFixObserver() {
  if (!document.body) return;
  stopAutoFixObserver();
  observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData" && mutation.target?.parentElement) {
        const parent = mutation.target.parentElement;
        if (parent && !parent.closest("[data-rtl-fix='1']")) pendingRoots.add(parent);
      }
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
            const root = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
            if (root && !root.closest?.("[data-rtl-fix='1']")) pendingRoots.add(root);
          }
        });
      }
    }
    scheduleProcess();
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  pendingRoots.add(document.body);
  scheduleProcess(true);
}

function applyMode(mode) {
  currentMode = mode;
  ensureIntrinsicLtrStyles();
  if (mode === "rtl") {
    processRoot(document.body);
    return;
  }
  resetFix();
}

function setAutoMode(enabled) {
  autoMode = enabled;
  if (autoMode) {
    startAutoFixObserver();
    pendingRoots.add(document.body);
    scheduleProcess(true);
  } else {
    stopAutoFixObserver();
    applyMode(currentMode);
  }
}

function initSettings() {
  chrome.storage.local.get({ autoMode: true, mode: "default" }, ({ autoMode: storedAuto, mode }) => {
    currentMode = mode;
    applyMode(mode);
    setAutoMode(storedAuto);
  });
}

if (document.readyState === "complete" || document.readyState === "interactive") {
  initSettings();
} else {
  document.addEventListener("DOMContentLoaded", initSettings);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "setMode") {
    const mode = ["rtl", "ltr", "default"].includes(msg.mode) ? msg.mode : "default";
    applyMode(mode);
    sendResponse({ fixed: fixedNodes.size > 0, auto: autoMode, mode: currentMode });
    return true;
  }
  if (msg.action === "state") {
    sendResponse({ fixed: fixedNodes.size > 0, auto: autoMode, mode: currentMode });
    return true;
  }
  if (msg.action === "setAuto") {
    setAutoMode(Boolean(msg.auto));
    sendResponse({ fixed: fixedNodes.size > 0, auto: autoMode, mode: currentMode });
    return true;
  }
});
