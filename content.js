let fixedElements = [];

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

function fixPersianText() {
  resetFix();

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

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const touched = new Set();

  while (walker.nextNode()) {
    const el = walker.currentNode.parentElement;
    if (!el || touched.has(el)) continue;

    touched.add(el);

    fixedElements.push({
      element: el,
      originalDirection: el.style.direction,
      originalUnicode: el.style.unicodeBidi
    });

    el.style.direction = "rtl";
    el.style.unicodeBidi = "plaintext";
  }
}

function resetFix() {
  fixedElements.forEach(item => {
    item.element.style.direction = item.originalDirection;
    item.element.style.unicodeBidi = item.originalUnicode;
  });

  fixedElements = [];
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "fix") {
    fixPersianText();
  }

  if (msg.action === "reset") {
    resetFix();
  }
});