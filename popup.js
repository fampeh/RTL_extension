const autoCheck = document.getElementById("autoCheck");
const modeGroup = document.getElementById("modeGroup");

const ICONS = {
  rtl: { 16: "icons/rtl-16.png", 32: "icons/rtl-32.png", 48: "icons/rtl-48.png", 128: "icons/rtl-128.png" },
  ltr: { 16: "icons/ltr-16.png", 32: "icons/ltr-32.png", 48: "icons/ltr-48.png", 128: "icons/ltr-128.png" },
  default: { 16: "icons/default-16.png", 32: "icons/default-32.png", 48: "icons/default-48.png", 128: "icons/default-128.png" }
};

function setActionIcon(mode) {
  chrome.action.setIcon({ path: ICONS[mode] || ICONS.default });
}

function getEffectiveIconMode(mode, autoMode) {
  return autoMode ? "rtl" : mode;
}

function setSelectedMode(mode) {
  modeGroup.querySelectorAll(".mode-option").forEach((option) => {
    option.classList.toggle("active", option.dataset.mode === mode);
  });
}

async function withActiveTab(callback) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) callback(tab.id);
}

function safeSendMessage(tabId, payload, onResponse) {
  chrome.tabs.sendMessage(tabId, payload, (response) => {
    if (chrome.runtime.lastError) return;
    if (typeof onResponse === "function") onResponse(response);
  });
}

function setMode(mode, notify = true) {
  chrome.storage.local.get({ autoMode: true }, ({ autoMode }) => {
    chrome.storage.local.set({ mode }, () => {
      setSelectedMode(mode);
      setActionIcon(getEffectiveIconMode(mode, autoMode));

      if (!notify) return;
      withActiveTab((tabId) => safeSendMessage(tabId, { action: "setMode", mode }));
    });
  });
}

function setAutoMode(enabled, notify = true) {
  chrome.storage.local.set({ autoMode: enabled }, () => {
    autoCheck.checked = enabled;
    chrome.storage.local.get({ mode: "default" }, ({ mode }) => {
      setActionIcon(getEffectiveIconMode(mode, enabled));
    });

    if (!notify) return;
    withActiveTab((tabId) => safeSendMessage(tabId, { action: "setAuto", auto: enabled }));
  });
}

function queryStateAndSync() {
  withActiveTab((tabId) => {
    safeSendMessage(tabId, { action: "state" }, (response) => {
      if (!response) return;
      if (response.mode) setSelectedMode(response.mode);
      if (typeof response.auto === "boolean") autoCheck.checked = response.auto;
      setActionIcon(getEffectiveIconMode(response.mode || "default", Boolean(response.auto)));
    });
  });
}

modeGroup.addEventListener("click", (event) => {
  const option = event.target.closest(".mode-option");
  if (!(option instanceof HTMLElement)) return;

  const mode = option.dataset.mode;
  if (!mode) return;

  if (autoCheck.checked) setAutoMode(false);
  setMode(mode);
});

autoCheck.addEventListener("change", () => {
  setAutoMode(autoCheck.checked);
});

chrome.storage.local.get({ autoMode: true, mode: "default" }, ({ autoMode, mode }) => {
  autoCheck.checked = autoMode;
  setAutoMode(autoMode, false);
  setMode(mode, false);
  queryStateAndSync();
});
