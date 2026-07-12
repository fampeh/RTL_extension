const ICONS = {
  rtl: { 16: "icons/rtl-16.png", 32: "icons/rtl-32.png", 48: "icons/rtl-48.png", 128: "icons/rtl-128.png" },
  ltr: { 16: "icons/ltr-16.png", 32: "icons/ltr-32.png", 48: "icons/ltr-48.png", 128: "icons/ltr-128.png" },
  default: { 16: "icons/default-16.png", 32: "icons/default-32.png", 48: "icons/default-48.png", 128: "icons/default-128.png" }
};

const CONTENT_SCRIPT_MATCHES = [
  "*://chat.openai.com/*",
  "*://chatgpt.com/*",
  "*://gemini.google.com/*",
  "*://notebooklm.google.com/*",
  "*://copilot.microsoft.com/*",
  "*://claude.ai/*",
  "*://chat.deepseek.com/*",
  "*://poe.com/*"
];

function setActionIcon(mode) {
  chrome.action.setIcon({ path: ICONS[mode] || ICONS.default });
}

function syncIconFromStorage() {
  chrome.storage.local.get({ mode: "rtl" }, ({ mode }) => {
    setActionIcon(mode);
  });
}

async function injectContentScriptIntoExistingTabs() {
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ url: CONTENT_SCRIPT_MATCHES });
  } catch (err) {
    return;
  }

  for (const tab of tabs) {
    if (!tab.id) continue;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
    } catch (err) {
    }
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.local.set({ autoMode: true, mode: "rtl" }, () => {
      syncIconFromStorage();
      injectContentScriptIntoExistingTabs();
    });
  } else {
    syncIconFromStorage();
    injectContentScriptIntoExistingTabs();
  }
});

chrome.runtime.onStartup.addListener(syncIconFromStorage);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (changes.mode) setActionIcon(changes.mode.newValue);
});