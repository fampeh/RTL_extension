const fixBtn = document.getElementById("fixBtn");
const resetBtn = document.getElementById("resetBtn");
const autoCheck = document.getElementById("autoCheck");

function setActionIcon() {
  chrome.action.setIcon({
    path: {
      16: "icon.png",
      32: "icon.png",
      48: "icon.png",
      128: "icon.png"
    }
  });
}

function setDefaultIcon() {
  chrome.action.setIcon({
    path: {
      16: "icon.png",
      32: "icon.png",
      48: "icon.png",
      128: "icon.png"
    }
  });
}

function setActiveState(isFixed) {
  setActionIcon();

  if (isFixed) {
    fixBtn.classList.add("active");
    resetBtn.classList.remove("active");
  } else {
    resetBtn.classList.add("active");
    fixBtn.classList.remove("active");
  }
}

function setAutoCheckbox(enabled) {
  autoCheck.checked = enabled;
}

function setAutoMode(enabled, notify = true) {
  chrome.storage.local.set({ autoMode: enabled }, () => {
    setAutoCheckbox(enabled);
    if (notify) {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!tab?.id) return;
        chrome.tabs.sendMessage(tab.id, { action: "setAuto", auto: enabled });
      });
    }
  });
}

async function queryState() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab?.id) {
    setDefaultIcon();
    return;
  }

  chrome.tabs.sendMessage(tab.id, { action: "state" }, response => {
    if (chrome.runtime.lastError || !response) {
      setDefaultIcon();
      return;
    }
    setActiveState(response.fixed);
    if (typeof response.auto === "boolean") {
      setAutoCheckbox(response.auto);
    }
  });
}

async function sendAction(action) {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab?.id) return;

  chrome.tabs.sendMessage(tab.id, { action }, response => {
    if (chrome.runtime.lastError || !response) return;
    setActiveState(response.fixed);
  });
}

fixBtn.addEventListener("click", () => {
  sendAction("fix");
});

resetBtn.addEventListener("click", () => {
  sendAction("reset");
});

autoCheck.addEventListener("change", () => {
  setAutoMode(autoCheck.checked);
});

chrome.storage.local.get({ autoMode: true }, ({ autoMode }) => {
  setAutoCheckbox(autoMode);
  setAutoMode(autoMode, false);
  queryState();
});
