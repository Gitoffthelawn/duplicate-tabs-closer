"use strict";

const TST_ID = "treestyletab@piro.sakura.ne.jp";
let _tstAvailable = false;

const _tstSend = (message) => browser.runtime.sendMessage(TST_ID, message).catch(() => null);

const registerWithTST = async () => {
    const result = await _tstSend({
        type: "register-self",
        name: "Duplicate Tabs Closer"
    });
    _tstAvailable = Boolean(result);
};

// Returns "handled" if TST closed the tab atomically (caller must NOT call browser.tabs.remove()),
// true if safe to proceed with browser.tabs.remove(), or false if expansion failed
// and the close must be aborted. TST not present → always true.
const expandTSTTabIfCollapsed = async (tabId) => {
    if (!_tstAvailable) return true;
    // Try the atomic API (TST 4.4.0+). Old TST returns undefined; _tstSend returns null on error.
    const atomicResult = await _tstSend({ type: "remove-tab-keeping-children", tab: tabId, method: "promote-first" });
    if (atomicResult === true) return "handled";
    // Fallback for TST < 4.4.0: expand collapsed children before the caller removes the tab.
    const tree = await _tstSend({ type: "get-tree", tab: tabId });
    if (!tree) return true;
    if (tree.children && tree.children.length > 0 &&
        tree.states && tree.states.includes("subtree-collapsed")) {
        const result = await _tstSend({ type: "expand-tree", tab: tabId });
        if (!result) {
            return false;
        }
    }
    return true;
};