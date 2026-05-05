(function () {
  const EXCLUDED_TAGS = new Set(['CODE', 'PRE', 'KBD', 'SAMP', 'VAR', 'MATH', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'TEXT']);
  const EXCLUDED_CLASSES = ['hljs', 'highlight', 'prism-code', 'token', 'chroma', 'CodeMirror', 'monaco-editor'];
  const BLOCK_TAGS = new Set(['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'BLOCKQUOTE', 'ARTICLE', 'SECTION', 'FIGCAPTION']);
  
  const PERSIAN_REGEX = /[\u0600-\u06FF]/;
  const WORD_REGEX = /[\p{L}\p{N}]+/gu;

  let settings = {
    autoFix: true,
    mode: 'default' // 'default', 'rtl', 'ltr'
  };

  let observer = null;
  let pendingNodes = new Set();
  let isProcessing = false;

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
      }
    }
  }

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