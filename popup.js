const fixBtn = document.getElementById("fixBtn");
const resetBtn = document.getElementById("resetBtn");
const autoCheck = document.getElementById("autoCheck");

function setActionIcon(isFixed) {
  chrome.action.setIcon({
    path: {
      16: isFixed ? "icons/rtl-16.png" : "icons/ltr-16.png",
      32: isFixed ? "icons/rtl-32.png" : "icons/ltr-32.png",
      48: isFixed ? "icons/rtl-48.png" : "icons/ltr-48.png",
      128: isFixed ? "icons/rtl-128.png" : "icons/ltr-128.png"
    }
  });
}

function setDefaultIcon() {
  chrome.action.setIcon({
    path: {
      16: "icons/default-16.png",
      32: "icons/default-32.png",
      48: "icons/default-48.png",
      128: "icons/default-128.png"
    }
  });
}

function setActiveState(isFixed) {
  setActionIcon(isFixed);

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
