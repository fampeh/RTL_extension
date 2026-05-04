const autoCheck = document.getElementById("autoCheck");
const modeGroup = document.getElementById("modeGroup");
const versionText = document.getElementById("versionText");

const ICONS = {
  rtl: {
    16: "icons/rtl-16.png",
    32: "icons/rtl-32.png",
    48: "icons/rtl-48.png",
    128: "icons/rtl-128.png"
  },
  ltr: {
    16: "icons/ltr-16.png",
    32: "icons/ltr-32.png",
    48: "icons/ltr-48.png",
    128: "icons/ltr-128.png"
  },
  default: {
    16: "icons/default-16.png",
    32: "icons/default-32.png",
    48: "icons/default-48.png",
    128: "icons/default-128.png"
  }
};

function setActionIcon(mode) {
  chrome.action.setIcon({ path: ICONS[mode] || ICONS.default });
}

function setSelectedMode(mode) {
  const radios = modeGroup.querySelectorAll('input[name="mode"]');
  radios.forEach(radio => {
    radio.checked = radio.value === mode;
    radio.closest(".mode-option")?.classList.toggle("active", radio.value === mode);
  });
}

async function withActiveTab(callback) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  callback(tab.id);
}

function setMode(mode, notify = true) {
  chrome.storage.local.set({ mode }, () => {
    setSelectedMode(mode);
    setActionIcon(mode);

    if (!notify) return;
    withActiveTab(tabId => {
      chrome.tabs.sendMessage(tabId, { action: "setMode", mode });
    });
  });
}

function setAutoMode(enabled, notify = true) {
  chrome.storage.local.set({ autoMode: enabled }, () => {
    autoCheck.checked = enabled;
    if (!notify) return;
    withActiveTab(tabId => {
      chrome.tabs.sendMessage(tabId, { action: "setAuto", auto: enabled });
    });
  });
}

function queryStateAndSync() {
  withActiveTab(tabId => {
    chrome.tabs.sendMessage(tabId, { action: "state" }, response => {
      if (chrome.runtime.lastError || !response) return;
      if (response.mode) {
        setSelectedMode(response.mode);
        setActionIcon(response.mode);
      }
      if (typeof response.auto === "boolean") {
        autoCheck.checked = response.auto;
      }
    });
  });
}

modeGroup.addEventListener("change", event => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.name !== "mode") return;
  setMode(target.value);
});

autoCheck.addEventListener("change", () => {
  setAutoMode(autoCheck.checked);
});

const manifest = chrome.runtime.getManifest();
versionText.textContent = `Version: ${manifest.version}`;

chrome.storage.local.get({ autoMode: true, mode: "default" }, ({ autoMode, mode }) => {
  autoCheck.checked = autoMode;
  setAutoMode(autoMode, false);
  setMode(mode, false);
  queryStateAndSync();
});
