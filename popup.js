document.addEventListener('DOMContentLoaded', () => {
  const autoFixToggle = document.getElementById('autoFixToggle');
  const modeRadios = document.getElementsByName('mode');
  const applyBtn = document.getElementById('applyBtn');

  // Load saved settings
  chrome.storage.local.get({
    autoFix: true,
    mode: 'default'
  }, (items) => {
    autoFixToggle.checked = items.autoFix;
    for (let radio of modeRadios) {
      if (radio.value === items.mode) {
        radio.checked = true;
        break;
      }
    }
  });

  function getSettings() {
    let selectedMode = 'default';
    for (let radio of modeRadios) {
      if (radio.checked) {
        selectedMode = radio.value;
        break;
      }
    }
    return {
      autoFix: autoFixToggle.checked,
      mode: selectedMode
    };
  }

  function saveAndApply() {
    const settings = getSettings();
    chrome.storage.local.set(settings, () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'updateSettings',
            settings: settings
          }, (response) => {
            if (chrome.runtime.lastError) {
              // Content script might not be injected yet
              console.warn("Could not contact content script.");
            }
          });
        }
      });
    });
  }

  // Event listeners
  autoFixToggle.addEventListener('change', saveAndApply);
  for (let radio of modeRadios) {
    radio.addEventListener('change', saveAndApply);
  }
  applyBtn.addEventListener('click', saveAndApply);
});