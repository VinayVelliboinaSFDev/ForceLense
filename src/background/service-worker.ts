import { SalesforceRecordContext } from '../types';
import { detectRecordFromUrl } from '../content/record-detector';
import { autoDetectSalesforceSession } from '../auth/salesforce-session';

const STORAGE_KEY_RECORD = 'forcelens_active_record_session';

async function setActiveRecord(context: SalesforceRecordContext | null) {
  if (chrome.storage?.session) {
    await chrome.storage.session.set({ [STORAGE_KEY_RECORD]: context });
  } else if (chrome.storage?.local) {
    await chrome.storage.local.set({ [STORAGE_KEY_RECORD]: context });
  }
}

async function getActiveRecord(): Promise<SalesforceRecordContext | null> {
  if (chrome.storage?.session) {
    const res = await chrome.storage.session.get([STORAGE_KEY_RECORD]);
    return res[STORAGE_KEY_RECORD] || null;
  } else if (chrome.storage?.local) {
    const res = await chrome.storage.local.get([STORAGE_KEY_RECORD]);
    return res[STORAGE_KEY_RECORD] || null;
  }
  return null;
}

// Check current active tab for Salesforce record context & session
async function checkActiveTabContext() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const detected = detectRecordFromUrl(tab.url);
      if (detected) {
        if (tab.title) {
          detected.recordName = tab.title.replace(/\s*\|\s*Salesforce.*$/i, '').trim();
        }
        await setActiveRecord(detected);
      }

      // If on Salesforce tab, automatically verify and prepare the session in background
      if (tab.url.includes('salesforce.com') || tab.url.includes('force.com')) {
        await autoDetectSalesforceSession(tab.url);
      }
    }
  } catch {
    // Tab query error
  }
}

// Tab switched or activated
chrome.tabs.onActivated.addListener(() => {
  checkActiveTabContext();
});

// Tab URL updated
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') {
    if (tab.url) {
      const detected = detectRecordFromUrl(tab.url);
      if (detected) {
        if (tab.title) {
          detected.recordName = tab.title.replace(/\s*\|\s*Salesforce.*$/i, '').trim();
        }
        setActiveRecord(detected);
      }

      if (tab.url.includes('salesforce.com') || tab.url.includes('force.com')) {
        autoDetectSalesforceSession(tab.url);
      }
    }
  }
});

// Message listener from content script or UI surfaces
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'RECORD_DETECTED') {
    setActiveRecord(message.payload).then(() => {
      sendResponse({ received: true });
    });
    return true;
  }

  if (message?.type === 'GET_RECORD_CONTEXT') {
    getActiveRecord().then((context) => {
      sendResponse({ context });
    });
    return true;
  }

  if (message?.type === 'AUTO_CONNECT_SESSION') {
    autoDetectSalesforceSession().then((result) => {
      sendResponse({ success: !!result, connection: result?.connection || null });
    }).catch(() => {
      sendResponse({ success: false, connection: null });
    });
    return true;
  }

  if (message?.type === 'OPEN_SIDEPANEL') {
    if (chrome.sidePanel?.open) {
      const windowId = sender.tab?.windowId;
      if (windowId !== undefined) {
        chrome.sidePanel.open({ windowId }).then(() => {
          sendResponse({ success: true });
        }).catch((err) => {
          sendResponse({ success: false, error: err.message });
        });
      } else {
        chrome.windows.getCurrent((win) => {
          if (win.id !== undefined) {
            chrome.sidePanel.open({ windowId: win.id }).then(() => {
              sendResponse({ success: true });
            });
          }
        });
      }
    }
    return true;
  }
});

// Side Panel behavior configuration
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && 'setPanelBehavior' in chrome.sidePanel) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }
});
