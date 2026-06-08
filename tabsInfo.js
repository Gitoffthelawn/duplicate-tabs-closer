"use strict";

class TabsInfo {

    constructor() {
        this.storedTabs = new Map();
        this.nbDuplicateTabs = new Map();
        this.knownSessionIds = new Set();
        this.intentionalDuplicates = new Set();
        this.pendingChecks = new Map();
        this.initialize();
    }

    async initialize() {
        const openedTabs = await getTabs({ windowType: "normal" });
        if (!openedTabs) return;
        for (const openedTab of openedTabs) {
            const lastComplete = openedTab.lastAccessed ?? openedTab.index;
            dtcLog("tabsInfo", "seed", { tabId: openedTab.id, index: openedTab.index, lastAccessed: openedTab.lastAccessed ?? null, lastComplete });
            this.setTab(openedTab.id, { url: openedTab.url, complete: true, lastComplete: lastComplete });
        }
        const result = await chrome.storage.session.get('intentionalDuplicates');
        const ids = result.intentionalDuplicates || [];
        ids.forEach(id => this.intentionalDuplicates.add(id));
        dtcLog("tabsInfo", "init-done", { tabCount: openedTabs.length });
    }

    setTab(tabId, details) {
        const storedTab = this.storedTabs.get(tabId)
            || { url: null, lastComplete: null, closing: false };
        const urlChanged = Object.prototype.hasOwnProperty.call(details, "url") && details.url !== storedTab.url;
        const completeChanged = Object.prototype.hasOwnProperty.call(details, "complete");
        if (Object.prototype.hasOwnProperty.call(details, "url"))
            storedTab.url = details.url;
        if (completeChanged)
            storedTab.lastComplete = details.complete ? (details.lastComplete ?? Date.now()) : null;
        if (Object.prototype.hasOwnProperty.call(details, "closing"))
            storedTab.closing = details.closing;
        this.storedTabs.set(tabId, storedTab);
        if (urlChanged || completeChanged) {
            const payload = { tabId };
            if (urlChanged) payload.url = details.url;
            if (completeChanged) payload.complete = details.complete;
            dtcLog("tabsInfo", "tab-set", payload);
        }
    }

    setClosingTab(tabId, state) {
        this.setTab(tabId, { closing: state });
        if (state) dtcLog("tabsInfo", "tab-closing", { tabId });
    }

    isClosingTab(tabId) {
        const storedTab = this.storedTabs.get(tabId);
        return !storedTab || storedTab.closing;
    }

    getLastComplete(tabId) {
        const storedTab = this.storedTabs.get(tabId);
        return storedTab ? storedTab.lastComplete : null;
    }

    hasUrlChanged(openedTab) {
        const storedTab = this.storedTabs.get(openedTab.id);
        return storedTab ? storedTab.url !== openedTab.url : true;
    }

    removeTab(tabId) {
        this.storedTabs.delete(tabId);
        if (this.intentionalDuplicates.has(tabId)) {
            this.intentionalDuplicates.delete(tabId);
            this._persistIntentionalDuplicates();
        }
        this.pendingChecks.delete(tabId);
        dtcLog("tabsInfo", "tab-removed", { tabId });
    }

    hasTab(tabId) {
        return this.storedTabs.has(tabId);
    }

    hasDuplicateTabs(windowId) {
        // Even nothing set, return true so it will force the refresh and set the badge.
        return this.nbDuplicateTabs.get(windowId) !== "0";
    }

    getNbDuplicateTabs(windowId) {
        return this.nbDuplicateTabs.get(windowId) || "0";
    }

    hasNbDuplicateTabs(windowId) {
        return this.nbDuplicateTabs.has(windowId);
    }

    setNbDuplicateTabs(windowId, nbDuplicateTabs) {
        this.nbDuplicateTabs.set(windowId, nbDuplicateTabs.toString());
        dtcLog("tabsInfo", "dup-count-set", { windowId, count: nbDuplicateTabs });
    }

    clearDuplicateTabsInfo(windowId) {
        if (this.nbDuplicateTabs.has(windowId)) this.nbDuplicateTabs.delete(windowId);
    }

    registerSessionId(sessionId) {
        this.knownSessionIds.add(sessionId);
    }

    isKnownSessionId(sessionId) {
        return this.knownSessionIds.has(sessionId);
    }

    setIntentionalDuplicate(tabId) {
        this.intentionalDuplicates.add(tabId);
        this._persistIntentionalDuplicates();
        dtcLog("tabsInfo", "intentional-dup", { tabId });
    }

    _persistIntentionalDuplicates() {
        chrome.storage.session.set({ intentionalDuplicates: Array.from(this.intentionalDuplicates) });
    }

    isIntentionalDuplicate(tabId) {
        return this.intentionalDuplicates.has(tabId);
    }

    setPendingCheck(tabId, promise) {
        this.pendingChecks.set(tabId, promise);
        promise.finally(() => this.pendingChecks.delete(tabId));
    }

    awaitPendingCheck(tabId) {
        const p = this.pendingChecks.get(tabId);
        return p ? p.catch(() => {}) : Promise.resolve();
    }

}

// eslint-disable-next-line no-unused-vars
const tabsInfo = new TabsInfo();
