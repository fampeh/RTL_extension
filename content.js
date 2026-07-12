let autoMode = true;
let currentMode = "rtl";
let observer = null;
let idleHandle = null;
let fallbackTimer = null;
let scheduledAt = 0;
const pendingRoots = new Set();
const fixedBlocks = new Set();
const fixedLists = new Set();
const mirroredQuotes = new Set();
let observedNodes = new WeakSet();

const RTL_FIX_STYLE_ID = "rtl-fix-style";
const RTL_FIX_BLOCK_CLASS = "rtl-fix-block";
const RTL_FIX_DIR_ATTR = "data-rtl-fix-dir";
const RTL_FIX_QUOTE_BORDER_CLASS = "rtl-fix-quote-border";
const RTL_FIX_QUOTE_PADDING_CLASS = "rtl-fix-quote-padding";

const INTRINSIC_LTR_SELECTORS = [
  "pre", "code", "kbd", "samp", "var", "math", ".hljs", ".highlight",
  ".prism-code", ".token", ".chroma", ".CodeMirror", ".monaco-editor",
  "[class*='language-']", "[class*='lang-']", "[data-no-rtl='1']"
];
const INTRINSIC_LTR_SELECTOR = INTRINSIC_LTR_SELECTORS.join(", ");
const INTRINSIC_LTR_DESCENDANT_SELECTOR = INTRINSIC_LTR_SELECTORS.map(s => `${s} *`).join(", ");

const EDITABLE_OR_FORM_SELECTOR = ["textarea", "input", "select", "option", "[contenteditable]:not([contenteditable='false'])"].join(", ");
const SKIPPED_TEXT_CONTAINER_SELECTOR = [EDITABLE_OR_FORM_SELECTOR, "script", "style", "noscript", "template", "svg", "canvas"].join(", ");

const PERSIAN_CHAR_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const PERSIAN_CHAR_REGEX_GLOBAL = new RegExp(PERSIAN_CHAR_REGEX.source, "g");
const ENGLISH_CHAR_REGEX = /[A-Za-z]/;
const ENGLISH_CHAR_REGEX_GLOBAL = /[A-Za-z]/g;
const LIST_PREFIX_REGEX = /^\s*(?:\d{1,3}\s*(?:[.)]|[-\u2013\u2014]))\s+/;

function containsPersian(text) {
  return PERSIAN_CHAR_REGEX.test(text || "");
}

function isEligibleTextContainer(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  if (!el.isConnected) return false;
  if (el.closest(SKIPPED_TEXT_CONTAINER_SELECTOR)) return false;
  return true;
}

function isIntrinsicLtrZone(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  return Boolean(el.closest(`${INTRINSIC_LTR_SELECTOR}, ${EDITABLE_OR_FORM_SELECTOR}`));
}

function isBlockElement(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  const display = window.getComputedStyle(el).display;
  return ["block", "flex", "grid", "list-item", "table", "table-row", "table-cell", "flow-root"].includes(display);
}

function findNearestBlockContainer(el) {
  while (el && el.nodeType === Node.ELEMENT_NODE && el !== document.body) {
    if (isBlockElement(el)) return el;
    el = el.parentElement || el.getRootNode()?.host || null;
  }
  return null;
}

function getLanguageCounts(text) {
  const compact = (text || "").replace(LIST_PREFIX_REGEX, "");
  const fa = (compact.match(PERSIAN_CHAR_REGEX_GLOBAL) || []).length;
  const en = (compact.match(ENGLISH_CHAR_REGEX_GLOBAL) || []).length;
  return { fa, en };
}

function isPersianDominantBlock(block) {
  if (!block) return false;
  const text = (block.innerText || block.textContent || "").trim();
  if (!text || !containsPersian(text)) return false;
  const { fa, en } = getLanguageCounts(text);
  return fa > 0 && fa > en;
}

function markBlockDirection(block) {
  if (!block) return;
  if (block.getAttribute(RTL_FIX_DIR_ATTR) === "rtl") return;
  block.setAttribute("dir", "rtl");
  block.setAttribute(RTL_FIX_DIR_ATTR, "rtl");
  block.classList.add(RTL_FIX_BLOCK_CLASS);
  fixedBlocks.add(block);
}

function isListMarkerElement(el) {
  return Boolean(el) && el.nodeType === Node.ELEMENT_NODE && (el.tagName === "UL" || el.tagName === "OL" || el.tagName === "LI");
}

function applyListDirectionForCurrentMode(listEl) {
  if (!listEl) return;
  const desiredDir = currentMode === "rtl" ? "rtl" : "ltr";
  if (listEl.getAttribute(RTL_FIX_DIR_ATTR) !== desiredDir) {
    listEl.setAttribute("dir", desiredDir);
    listEl.setAttribute(RTL_FIX_DIR_ATTR, desiredDir);
    listEl.classList.add(RTL_FIX_BLOCK_CLASS);
    fixedBlocks.add(listEl);
  }
  fixedLists.add(listEl);
}

function applyListAncestorAlignment(block) {
  let node = block.parentElement || block.getRootNode()?.host || null;
  let hops = 0;
  while (node && node !== document.body && hops < 20) {
    if (isListMarkerElement(node)) {
      applyListDirectionForCurrentMode(node);
    }
    node = node.parentElement || node.getRootNode()?.host || null;
    hops += 1;
  }
}

function isBlockquoteElement(el) {
  return Boolean(el) && el.nodeType === Node.ELEMENT_NODE && el.tagName === "BLOCKQUOTE";
}

function mirrorBlockquoteIndentForRtl(blockquote) {
  if (!blockquote || blockquote.classList.contains(RTL_FIX_QUOTE_BORDER_CLASS)) return;
  const style = window.getComputedStyle(blockquote);

  const leftBorderWidth = parseFloat(style.borderLeftWidth) || 0;
  const rightBorderWidth = parseFloat(style.borderRightWidth) || 0;
  const hasOneSidedLeftBorder = leftBorderWidth > 0 && style.borderLeftStyle !== "none" &&
    (rightBorderWidth === 0 || style.borderRightStyle === "none");
  if (!hasOneSidedLeftBorder) return;

  blockquote.style.setProperty("--rtl-fix-quote-border-width", style.borderLeftWidth);
  blockquote.style.setProperty("--rtl-fix-quote-border-style", style.borderLeftStyle);
  blockquote.style.setProperty("--rtl-fix-quote-border-color", style.borderLeftColor);
  blockquote.classList.add(RTL_FIX_QUOTE_BORDER_CLASS);

  const leftPadding = parseFloat(style.paddingLeft) || 0;
  const rightPadding = parseFloat(style.paddingRight) || 0;
  if (leftPadding > rightPadding) {
    blockquote.style.setProperty("--rtl-fix-quote-padding", style.paddingLeft);
    blockquote.classList.add(RTL_FIX_QUOTE_PADDING_CLASS);
  }

  mirroredQuotes.add(blockquote);
}

function restoreBlockquoteIndent(blockquote) {
  blockquote.classList.remove(RTL_FIX_QUOTE_BORDER_CLASS, RTL_FIX_QUOTE_PADDING_CLASS);
  blockquote.style.removeProperty("--rtl-fix-quote-border-width");
  blockquote.style.removeProperty("--rtl-fix-quote-border-style");
  blockquote.style.removeProperty("--rtl-fix-quote-border-color");
  blockquote.style.removeProperty("--rtl-fix-quote-padding");
}

function applyBlockquoteAncestorMirror(block) {
  let node = block.parentElement || block.getRootNode()?.host || null;
  let hops = 0;
  while (node && node !== document.body && hops < 20) {
    if (isBlockquoteElement(node)) {
      mirrorBlockquoteIndentForRtl(node);
    }
    node = node.parentElement || node.getRootNode()?.host || null;
    hops += 1;
  }
}

function resyncFixedListsForMode() {
  fixedLists.forEach(listEl => {
    if (!listEl.isConnected) {
      fixedLists.delete(listEl);
      return;
    }
    applyListDirectionForCurrentMode(listEl);
  });
}

const HEADING_TAG_REGEX = /^H[1-6]$/i;
const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6, [role='heading']";

function normalizeWhitespace(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function isFullyBoldParagraph(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE || !el.querySelectorAll) return false;
  const text = normalizeWhitespace(el.textContent);
  if (!text) return false;
  const boldEls = el.querySelectorAll("strong, b");
  for (const bold of boldEls) {
    if (normalizeWhitespace(bold.textContent) === text) return true;
  }
  return false;
}

function isHeadingElement(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  if (HEADING_TAG_REGEX.test(el.tagName)) return true;
  const role = el.getAttribute && el.getAttribute("role");
  if (role && role.toLowerCase() === "heading") return true;
  return isFullyBoldParagraph(el);
}

function findAdjacentHeading(block, direction, maxAncestorLevels = 3, maxSiblingsPerLevel = 3) {
  const siblingProp = direction === "next" ? "nextElementSibling" : "previousElementSibling";
  let node = block;
  let level = 0;
  while (node && node !== document.body && level < maxAncestorLevels) {
    let sibling = node[siblingProp];
    let siblingCount = 0;
    while (sibling && siblingCount < maxSiblingsPerLevel) {
      if (isHeadingElement(sibling)) return sibling;
      if (sibling.querySelectorAll) {
        const headings = sibling.querySelectorAll(HEADING_SELECTOR);
        if (headings.length > 0) {
          return direction === "next" ? headings[0] : headings[headings.length - 1];
        }
      }
      sibling = sibling[siblingProp];
      siblingCount += 1;
    }
    node = node.parentElement;
    level += 1;
  }
  return null;
}

function findAssociatedHeadings(block, maxAncestorLevels = 3, maxSiblingsPerLevel = 3) {
  const headings = [];
  const before = findAdjacentHeading(block, "previous", maxAncestorLevels, maxSiblingsPerLevel);
  if (before) headings.push(before);
  const after = findAdjacentHeading(block, "next", maxAncestorLevels, maxSiblingsPerLevel);
  if (after) headings.push(after);
  return headings;
}

function restoreBlockDirection(block) {
  if (!block || !block.hasAttribute(RTL_FIX_DIR_ATTR)) return;
  block.removeAttribute("dir");
  block.removeAttribute(RTL_FIX_DIR_ATTR);
  block.classList.remove(RTL_FIX_BLOCK_CLASS);
}

function collectTextNodes(node, textNodes) {
  if (!node) return;
  if (node.nodeType === Node.TEXT_NODE) {
    if (node.nodeValue && node.nodeValue.length >= 2 && containsPersian(node.nodeValue)) {
      textNodes.push(node);
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    if (!isEligibleTextContainer(node)) return;
    if (isIntrinsicLtrZone(node)) return;
    if (node.hasAttribute && node.hasAttribute(RTL_FIX_DIR_ATTR)) return;

    if (node.shadowRoot) {
      collectTextNodes(node.shadowRoot, textNodes);
    }
    for (const child of node.childNodes) {
      collectTextNodes(child, textNodes);
    }
  } else if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    for (const child of node.childNodes) {
      collectTextNodes(child, textNodes);
    }
  }
}

function processRoot(root = document.body) {
  if (currentMode === "default") return;
  if (!root || !root.isConnected) return;
  if (root.nodeType === Node.TEXT_NODE) root = root.parentElement;
  if (!root || (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE)) return;

  const textNodes = [];
  collectTextNodes(root, textNodes);

  const blocksToCheck = new Set();
  textNodes.forEach(node => {
    const block = findNearestBlockContainer(node.parentElement);
    if (block) blocksToCheck.add(block);
  });

  blocksToCheck.forEach(block => {
    if (isPersianDominantBlock(block)) {
      if (isListMarkerElement(block)) {
        applyListDirectionForCurrentMode(block);
      } else {
        markBlockDirection(block);
      }
      applyListAncestorAlignment(block);
      applyBlockquoteAncestorMirror(block);

      findAssociatedHeadings(block).forEach(heading => {
        if (!isIntrinsicLtrZone(heading) && !isPersianDominantBlock(heading)) {
          markBlockDirection(heading);
        }
      });
    }
  });
}

function resetFix() {
  Array.from(fixedBlocks).forEach(restoreBlockDirection);
  fixedBlocks.clear();
  fixedLists.clear();
  Array.from(mirroredQuotes).forEach(restoreBlockquoteIndent);
  mirroredQuotes.clear();
}

function getCurrentState() {
  return {
    fixed: fixedBlocks.size > 0,
    auto: autoMode,
    mode: currentMode
  };
}

function runScheduledProcess() {
  idleHandle = null;
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
  const start = performance.now();
  while (pendingRoots.size > 0 && performance.now() - start < 8) {
    const iterator = pendingRoots.values().next();
    if (iterator.done) break;
    const root = iterator.value;
    pendingRoots.delete(root);
    processRoot(root);
  }
  if (pendingRoots.size > 0) scheduleProcess(true);
}

function scheduleProcess(force = false) {
  if (!force) {
    const now = Date.now();
    if (now - scheduledAt < 16 && (idleHandle !== null || fallbackTimer !== null)) return;
    scheduledAt = now;
  }
  if (idleHandle !== null || fallbackTimer !== null) return;
  if (typeof requestAnimationFrame === "function") {
    idleHandle = requestAnimationFrame(runScheduledProcess);
  } else {
    fallbackTimer = setTimeout(runScheduledProcess, 16);
  }
}

function ensureIntrinsicLtrStyles() {
  document.body.setAttribute("data-rtl-fix-mode", currentMode);

  if (document.getElementById(RTL_FIX_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = RTL_FIX_STYLE_ID;
  style.textContent = `
    ${INTRINSIC_LTR_SELECTOR},
    ${INTRINSIC_LTR_DESCENDANT_SELECTOR} {
      direction: ltr !important;
      text-align: left !important;
      unicode-bidi: isolate;
    }

    .${RTL_FIX_BLOCK_CLASS}[dir="rtl"] {
      unicode-bidi: isolate;
    }

    .${RTL_FIX_BLOCK_CLASS}[dir="rtl"] *:not(${INTRINSIC_LTR_SELECTOR}):not(${INTRINSIC_LTR_DESCENDANT_SELECTOR}):not(${SKIPPED_TEXT_CONTAINER_SELECTOR}) {
      direction: rtl !important;
    }

    body[data-rtl-fix-mode="rtl"] .${RTL_FIX_BLOCK_CLASS}[dir="rtl"] {
      text-align: right !important;
    }

    body[data-rtl-fix-mode="ltr"] .${RTL_FIX_BLOCK_CLASS}[dir="rtl"] {
      text-align: left !important;
    }

    body[data-rtl-fix-mode="rtl"] .${RTL_FIX_QUOTE_BORDER_CLASS} {
      border-left: none !important;
      border-right: var(--rtl-fix-quote-border-width) var(--rtl-fix-quote-border-style) var(--rtl-fix-quote-border-color) !important;
    }

    body[data-rtl-fix-mode="rtl"] .${RTL_FIX_QUOTE_PADDING_CLASS} {
      padding-left: 0 !important;
      padding-right: var(--rtl-fix-quote-padding) !important;
    }
  `;
  document.documentElement.appendChild(style);
}

function observeNode(node) {
  if (!node || observedNodes.has(node)) return;

  if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    observedNodes.add(node);
    observer.observe(node, { childList: true, subtree: true, characterData: true });
  }

  if (node.shadowRoot) {
    observeNode(node.shadowRoot);
  }

  if (node.querySelectorAll) {
    const elements = node.querySelectorAll('*');
    for (const el of elements) {
      if (el.shadowRoot) observeNode(el.shadowRoot);
    }
  }
}

function stopAutoFixObserver() {
  if (observer) observer.disconnect();
  observer = null;
  if (idleHandle !== null && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(idleHandle);
    idleHandle = null;
  }
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
  pendingRoots.clear();
  observedNodes = new WeakSet();
}

function startAutoFixObserver() {
  if (!document.body) return;
  stopAutoFixObserver();
  observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData" && mutation.target?.parentElement) {
        pendingRoots.add(mutation.target.parentElement);
      }
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            observeNode(node);
            pendingRoots.add(node);
          } else if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
            pendingRoots.add(node.parentElement);
          }
        });
      }
    }
    scheduleProcess();
  });
  observeNode(document.body);
  pendingRoots.add(document.body);
  scheduleProcess(true);
}

function captureScrollState() {
  const state = [];
  const seen = new Set();

  function record(el) {
    if (!el || seen.has(el)) return;
    seen.add(el);
    state.push({ el, top: el.scrollTop, left: el.scrollLeft });
  }

  record(document.scrollingElement || document.documentElement);

  const candidates = document.body ? document.body.querySelectorAll("*") : [];
  for (const el of candidates) {
    if (el.scrollHeight - el.clientHeight > 4) {
      const style = window.getComputedStyle(el);
      if (style.overflowY === "auto" || style.overflowY === "scroll") {
        record(el);
      }
    }
  }

  return state;
}

function restoreScrollState(state) {
  for (const { el, top, left } of state) {
    if (!el.isConnected) continue;
    if (el.scrollTop !== top) el.scrollTop = top;
    if (el.scrollLeft !== left) el.scrollLeft = left;
  }
}

function applyMode(mode) {
  currentMode = mode;
  document.body.setAttribute("data-rtl-fix-mode", currentMode);
  ensureIntrinsicLtrStyles();

  const scrollState = captureScrollState();

  if (mode === "default") {
    resetFix();
  } else {
    processRoot(document.body);
    resyncFixedListsForMode();
  }

  restoreScrollState(scrollState);
  requestAnimationFrame(() => restoreScrollState(scrollState));
}

function setAutoMode(enabled) {
  autoMode = enabled;
  if (autoMode) {
    startAutoFixObserver();
    scheduleProcess(true);
  } else {
    stopAutoFixObserver();
  }
}

function initSettings() {
  chrome.storage.local.get({ autoMode: true, mode: "rtl" }, ({ autoMode: storedAuto, mode }) => {
    currentMode = mode;
    ensureIntrinsicLtrStyles();
    applyMode(mode);
    setAutoMode(storedAuto);
  });
}

if (document.readyState === "complete" || document.readyState === "interactive") {
  initSettings();
} else {
  document.addEventListener("DOMContentLoaded", initSettings);
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (changes.mode) {
    applyMode(changes.mode.newValue);
  }
  if (changes.autoMode) {
    setAutoMode(changes.autoMode.newValue);
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "setMode") {
    const mode = ["rtl", "ltr", "default"].includes(msg.mode) ? msg.mode : "default";
    applyMode(mode);
    sendResponse(getCurrentState());
    return true;
  }
  if (msg.action === "state") {
    sendResponse(getCurrentState());
    return true;
  }
  if (msg.action === "setAuto") {
    setAutoMode(Boolean(msg.auto));
    sendResponse(getCurrentState());
    return true;
  }
});