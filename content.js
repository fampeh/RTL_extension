let fixedNodes = [];
let fixedBlocks = [];
let autoMode = true;
let currentMode = "default";
let observer = null;
let mutationTimer = null;
const RTL_FIX_STYLE_ID = "rtl-fix-intrinsic-zones-style";
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
  block.dataset.rtlFixOriginalTextAlign = block.style.textAlign || "";
  block.dataset.rtlFixOriginalDirection = block.style.direction || "";
  block.dataset.rtlFixOriginalUnicodeBidi = block.style.unicodeBidi || "";
  block.style.textAlign = "right";
  block.style.direction = preferredDirection;
  block.style.unicodeBidi = "isolate";
  applyListAncestorAlignment(block);
}

function restoreBlockAlignment(block) {
  if (!block || block.dataset.rtlFixBlock !== "1") return;
  block.style.textAlign = block.dataset.rtlFixOriginalTextAlign || "";
  block.style.direction = block.dataset.rtlFixOriginalDirection || "";
  block.style.unicodeBidi = block.dataset.rtlFixOriginalUnicodeBidi || "";
  delete block.dataset.rtlFixBlock;
  delete block.dataset.rtlFixOriginalTextAlign;
  delete block.dataset.rtlFixOriginalDirection;
  delete block.dataset.rtlFixOriginalUnicodeBidi;
}

function applyListAncestorAlignment(block) {
  let node = block;
  while (node && node !== document.body) {
    if (node.tagName === "UL" || node.tagName === "OL") {
      if (node.dataset.rtlFixBlock !== "1") {
        node.dataset.rtlFixBlock = "1";
        node.dataset.rtlFixOriginalTextAlign = node.style.textAlign || "";
        node.dataset.rtlFixOriginalDirection = node.style.direction || "";
        node.dataset.rtlFixOriginalUnicodeBidi = node.style.unicodeBidi || "";
        node.style.textAlign = "right";
        node.style.direction = "rtl";
        node.style.unicodeBidi = "isolate";
        fixedBlocks.push(node);
      }
      break;
    }
    node = node.parentElement;
  }
}

function wrapTextFragment(text, isPersian) {
  const wrapper = document.createElement("span");
  wrapper.setAttribute("data-rtl-fix", "1");
  wrapper.style.unicodeBidi = "isolate";

  if (isPersian) {
    wrapper.style.direction = "rtl";
  } else {
    wrapper.style.direction = "ltr";
  }

  wrapper.textContent = text;
  fixedNodes.push(wrapper);
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

function fixIntrinsicZonesAlignment() {
  const intrinsicZones = document.querySelectorAll(INTRINSIC_LTR_SELECTOR);

  intrinsicZones.forEach(zone => {
    const block = findNearestBlockContainer(zone) || zone;
    if (!fixedBlocks.includes(block)) {
      applyBlockAlignment(block, "ltr");
      fixedBlocks.push(block);
    }
  });
}

function fixPersianText() {
  resetFix();
  fixIntrinsicZonesAlignment();

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.nodeValue || !containsPersian(node.nodeValue)) {
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

  matched.forEach(node => {
    const block = findNearestBlockContainer(node.parentElement);
    if (block && !fixedBlocks.includes(block)) {
      applyBlockAlignment(block);
      fixedBlocks.push(block);
    }
    wrapPersianTextNode(node);
  });
}

function resetFix() {
  fixedNodes.forEach(wrapper => {
    const parent = wrapper.parentNode;
    if (!parent) return;

    while (wrapper.firstChild) {
      parent.insertBefore(wrapper.firstChild, wrapper);
    }

    parent.removeChild(wrapper);
  });

  fixedNodes = [];
  fixedBlocks.forEach(restoreBlockAlignment);
  fixedBlocks = [];
}

function processPage() {
  ensureIntrinsicLtrStyles();
  const bodyText = document.body.textContent || "";
  const hasPersian = /[\u0600-\u06FF]/.test(bodyText);
  if (hasPersian) {
    fixPersianText();
  } else {
    resetFix();
  }
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
}

function stopAutoFixObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (mutationTimer) {
    clearTimeout(mutationTimer);
    mutationTimer = null;
  }
}

function startAutoFixObserver() {
  if (!document.body) return;
  stopAutoFixObserver();
  observer = new MutationObserver(() => {
    if (mutationTimer) clearTimeout(mutationTimer);
    mutationTimer = setTimeout(processPage, 250);
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
  processPage();
}

function applyMode(mode) {
  currentMode = mode;

  if (mode === "rtl") {
    fixPersianText();
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
