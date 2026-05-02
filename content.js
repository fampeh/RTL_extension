let fixedNodes = [];

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

function wrapPersianTextNode(textNode) {
  const wrapper = document.createElement("span");
  wrapper.setAttribute("data-rtl-fix", "1");
  wrapper.style.direction = "rtl";
  wrapper.style.unicodeBidi = "isolate";

  textNode.parentNode.insertBefore(wrapper, textNode);
  wrapper.appendChild(textNode);

  fixedNodes.push(wrapper);
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

  matched.forEach(wrapPersianTextNode);
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
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "fix") {
    fixPersianText();
  }

  if (msg.action === "reset") {
    resetFix();
  }
});
