const autoCheck = document.getElementById("autoCheck");
const modeGroup = document.getElementById("modeGroup");

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

modeGroup.addEventListener("click", (event) => {
  const option = event.target.closest(".mode-option");
  if (!(option instanceof HTMLElement)) return;
  const mode = option.dataset.mode;
  if (!mode) return;

  chrome.storage.local.set({ autoMode: false, mode: mode }, () => {
    autoCheck.checked = false;
    setSelectedMode(mode);
    withActiveTab((tabId) => {
      safeSendMessage(tabId, { action: "setAuto", auto: false });
      safeSendMessage(tabId, { action: "setMode", mode: mode });
    });
  });
});

autoCheck.addEventListener("change", () => {
  const isEnabled = autoCheck.checked;
  if (isEnabled) {
    chrome.storage.local.set({ autoMode: true, mode: "rtl" }, () => {
      setSelectedMode("rtl");
      withActiveTab((tabId) => {
        safeSendMessage(tabId, { action: "setMode", mode: "rtl" });
        safeSendMessage(tabId, { action: "setAuto", auto: true });
      });
    });
  } else {
    chrome.storage.local.set({ autoMode: false }, () => {
      withActiveTab((tabId) => {
        safeSendMessage(tabId, { action: "setAuto", auto: false });
      });
    });
  }
});

chrome.storage.local.get({ autoMode: true, mode: "rtl" }, ({ autoMode, mode }) => {
  autoCheck.checked = autoMode;
  setSelectedMode(mode);
});