let fixedElements = [];

function containsPersian(text) {
  return /[\u0600-\u06FF]/.test(text);
}

function fixPersianText() {
  resetFix();

  const elements = document.querySelectorAll("*");

  elements.forEach(el => {
    if (
      el.children.length === 0 &&
      containsPersian(el.innerText)
    ) {
      fixedElements.push({
        element: el,
        originalDirection: el.style.direction,
        originalAlign: el.style.textAlign,
        originalUnicode: el.style.unicodeBidi
      });

      el.style.direction = "rtl";
      el.style.unicodeBidi = "plaintext";

      if (
        getComputedStyle(el).textAlign === "left"
      ) {
        el.style.textAlign = "right";
      }
    }
  });
}

function resetFix() {
  fixedElements.forEach(item => {
    item.element.style.direction =
      item.originalDirection;

    item.element.style.textAlign =
      item.originalAlign;

    item.element.style.unicodeBidi =
      item.originalUnicode;
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