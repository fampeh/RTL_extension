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

function containsPersian(text) {
  return /[\u0600-\u06FF]/.test(text);
}

function isEligibleTextContainer(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;

  const tag = el.tagName;
  if (["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "BUTTON", "SELECT"].includes(tag)) {
    return false;
  }

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

function applyBlockAlignment(block, preferredDirection = "rtl") {
  if (!block || block.dataset.rtlFixBlock === "1") return;
  block.dataset.rtlFixBlock = "1";
  block.dataset.rtlFixPreferredDirection = preferredDirection;
  block.classList.add(RTL_FIX_BLOCK_CLASS);
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
    if (node.tagName === "UL" || node.tagName === "OL") {
      if (node.dataset.rtlFixBlock !== "1") {
        node.dataset.rtlFixBlock = "1";
        node.dataset.rtlFixPreferredDirection = "rtl";
        node.classList.add(RTL_FIX_BLOCK_CLASS);
        fixedBlocks.add(node);
      }
      break;
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

function wrapPersianTextNode(textNode) {
  const text = textNode.nodeValue;
  const parts = text.split(/([\u0600-\u06FF]+)/);
  const fragment = document.createDocumentFragment();

  parts.forEach(part => {
    if (!part) return;
    const isPersian = containsPersian(part);
    fragment.appendChild(wrapTextFragment(part, isPersian));
  });

  textNode.parentNode.insertBefore(fragment, textNode);
  textNode.remove();
}

function fixIntrinsicZonesAlignment(root = document.body) {
  if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
  const intrinsicZones = root.matches?.(INTRINSIC_LTR_SELECTOR)
    ? [root, ...root.querySelectorAll(INTRINSIC_LTR_SELECTOR)]
    : root.querySelectorAll(INTRINSIC_LTR_SELECTOR);
  intrinsicZones.forEach(zone => {
    const block = findNearestBlockContainer(zone) || zone;
    if (!fixedBlocks.has(block)) {
      applyBlockAlignment(block, "ltr");
      fixedBlocks.add(block);
    }
  });
}

function processRoot(root = document.body) {
  if (!root || !root.isConnected) return;
  if (root.nodeType === Node.TEXT_NODE) {
    root = root.parentElement;
  }
  if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
  fixIntrinsicZonesAlignment(root);
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.nodeValue || node.nodeValue.length < 2 || !containsPersian(node.nodeValue)) {
          return NodeFilter.FILTER_REJECT;
        }

        if (!isEligibleTextContainer(node.parentElement)) {
          return NodeFilter.FILTER_REJECT;
        }

        if (isIntrinsicLtrZone(node.parentElement)) {
          return NodeFilter.FILTER_REJECT;
        }

        if (node.parentElement?.closest("[data-rtl-fix='1']")) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const matched = [];
  while (walker.nextNode()) {
    matched.push(walker.currentNode);
  }

  for (const node of matched) {
    if (!node.isConnected || !node.parentElement) continue;
    const block = findNearestBlockContainer(node.parentElement);
    if (block && !fixedBlocks.has(block)) {
      applyBlockAlignment(block);
      fixedBlocks.add(block);
    }
    wrapPersianTextNode(node);
  }
}

function resetFix() {
  for (const wrapper of fixedNodes) {
    const parent = wrapper.parentNode;
    if (!parent) continue;

    while (wrapper.firstChild) {
      parent.insertBefore(wrapper.firstChild, wrapper);
    }

    parent.removeChild(wrapper);
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
    if (pendingRoots.size > 0) {
      scheduleProcess(true);
    }
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
    return;
  }
  fallbackTimer = setTimeout(() => invoke(), 60);
}

function ensureIntrinsicLtrStyles() {
  if (document.getElementById(RTL_FIX_STYLE_ID)) return;
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
      text-align: right;
      direction: ltr;
      unicode-bidi: isolate;
    }
  `;
  document.documentElement.appendChild(dynamicStyle);
}

function stopAutoFixObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
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
        if (parent && !parent.closest("[data-rtl-fix='1']")) {
          pendingRoots.add(parent);
        }
      }
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
            const root = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
            if (root && !root.closest?.("[data-rtl-fix='1']")) {
              pendingRoots.add(root);
            }
          }
        });
      }
    }
    scheduleProcess();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
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
  } else {
    stopAutoFixObserver();
    applyMode(currentMode);
  }
}

function initSettings() {
  chrome.storage.local.get({ autoMode: true, mode: "default" }, ({ autoMode, mode }) => {
    currentMode = mode;
    setAutoMode(autoMode);
    if (!autoMode) {
      applyMode(mode);
    }
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
    sendResponse({ fixed: fixedNodes.length > 0, auto: autoMode, mode: currentMode });
    return true;
  }

  if (msg.action === "state") {
    sendResponse({ fixed: fixedNodes.length > 0, auto: autoMode, mode: currentMode });
    return true;
  }

  if (msg.action === "setAuto") {
    setAutoMode(Boolean(msg.auto));
    sendResponse({ fixed: fixedNodes.length > 0, auto: autoMode, mode: currentMode });
    return true;
  }
});
