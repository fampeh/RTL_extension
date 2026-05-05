<<<<<<< HEAD
(function () {
  const EXCLUDED_TAGS = new Set(['CODE', 'PRE', 'KBD', 'SAMP', 'VAR', 'MATH', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'TEXT']);
  const EXCLUDED_CLASSES = ['hljs', 'highlight', 'prism-code', 'token', 'chroma', 'CodeMirror', 'monaco-editor'];
  const BLOCK_TAGS = new Set(['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'BLOCKQUOTE', 'ARTICLE', 'SECTION', 'FIGCAPTION']);
  
  const PERSIAN_REGEX = /[\u0600-\u06FF]/;
  const WORD_REGEX = /[\p{L}\p{N}]+/gu;
=======
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
>>>>>>> bd93a760e54a80ecb41020cd22c18cf7c7786729

  let settings = {
    autoFix: true,
    mode: 'default' // 'default', 'rtl', 'ltr'
  };

<<<<<<< HEAD
  let observer = null;
  let pendingNodes = new Set();
  let isProcessing = false;
=======
function isCleanPersianText(text) {
  if (!text || !containsPersian(text)) return false;
  const stripped = text.trim();
  if (!stripped) return false;
  return /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s\u200c\u200f\u061f\u060c\u061b.,!?:;()\[\]{}«»"'\-–—]+$/.test(stripped);
}

function isEligibleTextContainer(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
>>>>>>> bd93a760e54a80ecb41020cd22c18cf7c7786729

  const styleId = 'persian-text-fixer-style';

  function injectStyles() {
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .ptf-rtl-block {
        direction: rtl !important;
        text-align: right !important;
        unicode-bidi: plaintext !important;
      }
      .ptf-ltr-block {
        direction: ltr !important;
        text-align: left !important;
        unicode-bidi: plaintext !important;
      }
    `;
    document.head.appendChild(style);
  }

  function isExcluded(node) {
    let curr = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    while (curr && curr !== document.body) {
      if (EXCLUDED_TAGS.has(curr.tagName) || curr.isContentEditable) return true;
      if (curr.classList) {
        for (let cls of EXCLUDED_CLASSES) {
          if (curr.classList.contains(cls)) return true;
        }
      }
      curr = curr.parentElement;
    }
    return false;
  }

<<<<<<< HEAD
  function getDominantLanguage(text) {
    if (!PERSIAN_REGEX.test(text)) return 'en';
    const words = text.match(WORD_REGEX);
    if (!words) return 'en';
    
    let faCount = 0;
    let enCount = 0;
    
    for (const word of words) {
      if (PERSIAN_REGEX.test(word)) faCount++;
      else if (/[a-zA-Z]/.test(word)) enCount++;
    }
    
    return faCount > 0 && faCount >= enCount ? 'fa' : 'en';
  }

  function getNearestBlockParent(node) {
    let curr = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    while (curr && curr !== document.body) {
      if (BLOCK_TAGS.has(curr.tagName)) return curr;
      const display = window.getComputedStyle(curr).display;
      if (display === 'block' || display === 'flex' || display === 'grid' || display === 'list-item') {
        return curr;
      }
      curr = curr.parentElement;
    }
    return curr;
  }
=======
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
>>>>>>> bd93a760e54a80ecb41020cd22c18cf7c7786729

  function processNode(node) {
    if (settings.mode === 'ltr') {
      clearFixes(node);
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (!text || isExcluded(node)) return;

      const blockParent = getNearestBlockParent(node);
      if (!blockParent || blockParent.hasAttribute('data-ptf-processed')) return;

<<<<<<< HEAD
      const blockText = blockParent.innerText || blockParent.textContent;
      const lang = getDominantLanguage(blockText);

      if (lang === 'fa' || settings.mode === 'rtl') {
        blockParent.classList.add('ptf-rtl-block');
        blockParent.classList.remove('ptf-ltr-block');
      } else if (settings.mode === 'default') {
        blockParent.classList.remove('ptf-rtl-block');
      }
      blockParent.setAttribute('data-ptf-processed', 'true');
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (isExcluded(node)) return;
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null, false);
      let textNode;
      while ((textNode = walker.nextNode())) {
        processNode(textNode);
=======
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
  if (fixedNodes.size > 0 && root === document.body) return;
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
>>>>>>> bd93a760e54a80ecb41020cd22c18cf7c7786729
      }
    }
  }

<<<<<<< HEAD
  function clearFixes(root) {
    const elements = root.nodeType === Node.ELEMENT_NODE ? root.querySelectorAll('.ptf-rtl-block') : [];
    if (root.nodeType === Node.ELEMENT_NODE && root.classList && root.classList.contains('ptf-rtl-block')) {
      root.classList.remove('ptf-rtl-block');
      root.removeAttribute('data-ptf-processed');
    }
    elements.forEach(el => {
      el.classList.remove('ptf-rtl-block');
      el.removeAttribute('data-ptf-processed');
    });
  }

  function runIdleQueue() {
    const nodesToProcess = Array.from(pendingNodes);
    pendingNodes.clear();
    isProcessing = false;

    nodesToProcess.forEach(node => {
      if (document.body.contains(node)) {
        processNode(node);
      }
    });
  }

  function queueNode(node) {
    pendingNodes.add(node);
    if (!isProcessing) {
      isProcessing = true;
      if ('requestIdleCallback' in window) {
        requestIdleCallback(runIdleQueue, { timeout: 1000 });
      } else {
        setTimeout(runIdleQueue, 50);
      }
    }
  }

  function initObserver() {
    if (observer) observer.disconnect();
    if (!settings.autoFix) return;

    observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => queueNode(node));
        } else if (mutation.type === 'characterData') {
          queueNode(mutation.target);
        }
      });
    });
=======
  for (const node of matched) {
    if (!node.isConnected || !node.parentElement) continue;
    const block = findNearestBlockContainer(node.parentElement);
    if (block && !fixedBlocks.has(block)) {
      applyBlockAlignment(block);
      fixedBlocks.add(block);
    }

    if (isCleanPersianText(node.nodeValue)) {
      continue;
    }

    wrapPersianTextNode(node);
  }
}

function resetFix() {
  for (const wrapper of fixedNodes) {
    const parent = wrapper.parentNode;
    if (!parent) continue;
>>>>>>> bd93a760e54a80ecb41020cd22c18cf7c7786729

    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  function applyFullPage() {
    clearFixes(document.body);
    if (settings.mode !== 'ltr') {
      processNode(document.body);
    }
  }

<<<<<<< HEAD
  function loadSettings(callback) {
    chrome.storage.local.get(['autoFix', 'mode'], (res) => {
      if (res.autoFix !== undefined) settings.autoFix = res.autoFix;
      if (res.mode !== undefined) settings.mode = res.mode;
      callback();
    });
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateSettings') {
      settings.autoFix = request.settings.autoFix;
      settings.mode = request.settings.mode;
      
      if (!settings.autoFix) {
        if (observer) observer.disconnect();
      } else {
        initObserver();
      }
      
      applyFullPage();
      sendResponse({ success: true });
    }
  });

  loadSettings(() => {
    injectStyles();
    if (settings.autoFix || settings.mode !== 'default') {
      applyFullPage();
    }
    initObserver();
  });
})();
=======
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
>>>>>>> bd93a760e54a80ecb41020cd22c18cf7c7786729
