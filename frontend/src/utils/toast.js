// Global App-Native Toast and Login Prompt Utility

export function showToast(message, type = "info", duration = 3200) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("showAppToast", {
        detail: { message, type, duration }
      })
    );
  }
}

export function promptLogin(action = "continue") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("openLoginPrompt", {
        detail: { action }
      })
    );
  }
}

export async function copyToClipboard(text, successMsg = "Copied to clipboard!") {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      showToast(successMsg, "success");
      return true;
    }
  } catch (e) {}

  // Fallback for non-HTTPS or older browsers
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
    showToast(successMsg, "success");
    return true;
  } catch (err) {
    showToast("Failed to copy link", "error");
    return false;
  }
}
