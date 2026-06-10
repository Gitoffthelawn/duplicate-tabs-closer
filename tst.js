"use strict";

const TST_ID = "treestyletab@piro.sakura.ne.jp";
let _tstAvailable = false;

const _tstSend = (message) =>
    browser.runtime.sendMessage(TST_ID, message).catch(() => null);

// eslint-disable-next-line no-unused-vars
const registerWithTST = async () => {
    const result = await _tstSend({
        type: "register-self",
        name: "Duplicate Tabs Closer",
    });
    _tstAvailable = !!result;
};

// Returns true if it is safe to close the tab (TST not present, tab has no collapsed
// children, or children were successfully expanded). Returns false if expansion was
// needed but failed — caller must NOT close the tab in that case.
// eslint-disable-next-line no-unused-vars
const expandTSTTabIfCollapsed = async (tabId) => {
    if (!_tstAvailable) return true;
    const tree = await _tstSend({ type: "get-tree", tab: tabId });
    if (!tree) return true;
    if (tree.children && tree.children.length > 0 &&
        tree.states && tree.states.includes("subtree-collapsed")) {
        const result = await _tstSend({ type: "expand-tree", tab: tabId });
        if (!result) return false;
    }
    return true;
};
