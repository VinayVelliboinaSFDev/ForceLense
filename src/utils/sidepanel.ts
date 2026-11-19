/**
 * Unified side panel opener utility for ForceLens Chrome Extension.
 * Handles:
 *  1. Synchronous user-gesture invocation via chrome.sidePanel.open({ windowId }) or ({ tabId }).
 *  2. Message-passing delegation to the background service worker with windowId & tabId.
 *  3. Safe popup closing without terminating pending IPC calls.
 */

export function openSidePanel(
  targetWindowId?: number,
  targetTabId?: number,
  onComplete?: (success: boolean) => void
): void {
  if (typeof chrome === 'undefined') {
    onComplete?.(false);
    return;
  }

  const delegateToWorker = (wId?: number, tId?: number) => {
    if (chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage(
        { type: 'OPEN_SIDEPANEL', windowId: wId, tabId: tId },
        (res) => {
          if (chrome.runtime.lastError) {
            console.error('Error opening side panel via service worker:', chrome.runtime.lastError);
            onComplete?.(false);
          } else {
            onComplete?.(res?.success ?? true);
          }
          // Allow side panel animation/IPC to settle before closing popup
          setTimeout(() => {
            if (typeof window !== 'undefined' && window.close) {
              window.close();
            }
          }, 150);
        }
      );
    } else {
      onComplete?.(false);
      window.close();
    }
  };

  // 1. Synchronously execute in the user gesture event loop if chrome.sidePanel.open is available
  if (chrome.sidePanel?.open) {
    if (targetWindowId !== undefined) {
      chrome.sidePanel.open({ windowId: targetWindowId })
        .then(() => {
          onComplete?.(true);
          window.close();
        })
        .catch((err) => {
          console.warn('Direct chrome.sidePanel.open({ windowId }) failed:', err);
          if (targetTabId !== undefined) {
            chrome.sidePanel.open({ tabId: targetTabId })
              .then(() => {
                onComplete?.(true);
                window.close();
              })
              .catch((e) => {
                console.warn('Direct chrome.sidePanel.open({ tabId }) failed:', e);
                delegateToWorker(targetWindowId, targetTabId);
              });
          } else {
            delegateToWorker(targetWindowId, targetTabId);
          }
        });
      return;
    }

    if (targetTabId !== undefined) {
      chrome.sidePanel.open({ tabId: targetTabId })
        .then(() => {
          onComplete?.(true);
          window.close();
        })
        .catch((err) => {
          console.warn('Direct chrome.sidePanel.open({ tabId }) failed:', err);
          delegateToWorker(targetWindowId, targetTabId);
        });
      return;
    }

    // If windowId/tabId are not yet cached, query active tab immediately
    if (chrome.tabs?.query) {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        const tab = tabs?.[0];
        const wId = tab?.windowId;
        const tId = tab?.id;

        if (wId !== undefined) {
          chrome.sidePanel.open({ windowId: wId })
            .then(() => {
              onComplete?.(true);
              window.close();
            })
            .catch((err) => {
              console.warn('sidePanel.open with queried windowId failed:', err);
              delegateToWorker(wId, tId);
            });
        } else if (tId !== undefined) {
          chrome.sidePanel.open({ tabId: tId })
            .then(() => {
              onComplete?.(true);
              window.close();
            })
            .catch((err) => {
              console.warn('sidePanel.open with queried tabId failed:', err);
              delegateToWorker(wId, tId);
            });
        } else {
          delegateToWorker(wId, tId);
        }
      });
      return;
    }
  }

  // 2. Fallback to background worker
  delegateToWorker(targetWindowId, targetTabId);
}
