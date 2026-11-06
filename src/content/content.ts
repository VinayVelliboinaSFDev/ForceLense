import { detectRecordFromUrl, extractRecordNameFromDom } from './record-detector';
import { SalesforceRecordContext } from '../types';

let lastReportedUrl = '';
let lastReportedRecordId = '';

function checkAndNotifyContext() {
  const currentUrl = window.location.href;
  const detected = detectRecordFromUrl(currentUrl);

  if (detected) {
    const recordName = extractRecordNameFromDom();
    const context: SalesforceRecordContext = {
      ...detected,
      recordName,
    };

    if (currentUrl !== lastReportedUrl || detected.recordId !== lastReportedRecordId) {
      lastReportedUrl = currentUrl;
      lastReportedRecordId = detected.recordId;

      try {
        chrome.runtime.sendMessage({
          type: 'RECORD_DETECTED',
          payload: context,
        });
      } catch {
        // Extension context might be invalid if updated/reloaded
      }
    }
  }
}

// Initial detection
checkAndNotifyContext();

// Listen to popstate and pushState/replaceState
window.addEventListener('popstate', () => {
  setTimeout(checkAndNotifyContext, 200);
});

// Monkey patch history.pushState and replaceState for Lightning SPA navigation
const originalPushState = history.pushState;
history.pushState = function (...args) {
  const res = originalPushState.apply(this, args);
  setTimeout(checkAndNotifyContext, 200);
  return res;
};

const originalReplaceState = history.replaceState;
history.replaceState = function (...args) {
  const res = originalReplaceState.apply(this, args);
  setTimeout(checkAndNotifyContext, 200);
  return res;
};

// Debounced DOM observer for dynamic title updates
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const observer = new MutationObserver(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    checkAndNotifyContext();
  }, 500);
});

if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
}

// Respond to direct requests from popup or sidepanel
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GET_RECORD_CONTEXT') {
    const detected = detectRecordFromUrl(window.location.href);
    if (detected) {
      detected.recordName = extractRecordNameFromDom();
      sendResponse({ success: true, context: detected });
    } else {
      sendResponse({ success: false, context: null });
    }
    return true;
  }
});
