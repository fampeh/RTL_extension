const fixBtn = document.getElementById("fixBtn");
const resetBtn = document.getElementById("resetBtn");
const status = document.getElementById("status");

async function sendAction(action) {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  chrome.tabs.sendMessage(tab.id, { action });

  status.textContent =
    action === "fix"
      ? "Persian text fixed"
      : "Reset to original";
}

fixBtn.addEventListener("click", () => {
  fixBtn.classList.add("active");
  resetBtn.classList.remove("active");
  sendAction("fix");
});

resetBtn.addEventListener("click", () => {
  resetBtn.classList.add("active");
  fixBtn.classList.remove("active");
  sendAction("reset");
});