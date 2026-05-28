"use strict";

// Chrome MV3 service worker only — Firefox loads scripts via manifest background.scripts
if (typeof importScripts === "function") {
	importScripts("helper.js", "tabsInfo.js", "options.js", "urlUtils.js", "badge.js", "worker.js", "messageListener.js");
}

let initPromise = null;
let postStartupBurst = false;
const debouncedBatchClose = debounce(closeDuplicateTabs, 300, false);
const generateTabSessionId = () => `dtc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

// eslint-disable-next-line no-unused-vars
const ensureInitialized = () => {
	if (!initPromise) initPromise = initialize();
	return initPromise;
};

const initialize = async () => {
	await initializeOptions();
	setBadgeIcon();
	if (environment.isFirefox) await initializeTabSessionIds();
	await refreshGlobalDuplicateTabsInfo();
	postStartupBurst = true;
	setTimeout(() => { postStartupBurst = false; }, 3000);
};

const initializeTabSessionIds = async () => {
	const tabs = await getTabs({ windowType: "normal" });
	if (!tabs) return;
	await Promise.allSettled(tabs.map(async tab => {
		let id = await browser.sessions.getTabValue(tab.id, 'dtc-tab-id');
		if (!id) {
			id = generateTabSessionId();
			browser.sessions.setTabValue(tab.id, 'dtc-tab-id', id);
		}
		tabsInfo.registerSessionId(id);
	}));
};

const onCreatedTab = async (tab) => {
	// Register pending session check BEFORE any await to prevent race with webNavigation events
	if (typeof browser !== "undefined" && browser.sessions) {
		const checkPromise = (async () => {
			await ensureInitialized();
			if (!environment.isFirefox) return;
			const existingId = await browser.sessions.getTabValue(tab.id, 'dtc-tab-id');
			if (existingId !== undefined && tabsInfo.isKnownSessionId(existingId)) {
				tabsInfo.setIntentionalDuplicate(tab.id);
			}
			const newId = generateTabSessionId();
			tabsInfo.registerSessionId(newId);
			browser.sessions.setTabValue(tab.id, 'dtc-tab-id', newId);
		})();
		tabsInfo.setPendingCheck(tab.id, checkPromise);
	}
	await ensureInitialized();
	tabsInfo.setTab(tab.id, {});
	if (tab.status === "complete") {
		tabsInfo.setTab(tab.id, { url: tab.url, complete: true });
		if (options.autoCloseTab) {
			postStartupBurst ? debouncedBatchClose(tab.windowId) : searchForDuplicateTabsToClose(tab, true);
		} else {
			refreshDuplicateTabsInfo(tab.windowId);
		}
	}
};

const onBeforeNavigate = async (details) => {
	await ensureInitialized();
	if (options.autoCloseTab && !postStartupBurst && (details.frameId == 0) && (details.tabId !== -1) && !isBlankURL(details.url)) {
		if (tabsInfo.isClosingTab(details.tabId)) return;
		const tab = await getTab(details.tabId);
		if (tab) {
			tabsInfo.setTab(tab.id, { complete: false });
			searchForDuplicateTabsToClose(tab, true, details.url);
		}
	}
};

const onCompletedTab = async (details) => {
	await ensureInitialized();
	if ((details.frameId == 0) && (details.tabId !== -1)) {
		if (tabsInfo.isClosingTab(details.tabId)) return;
		const tab = await getTab(details.tabId);
		if (tab) {
			tabsInfo.setTab(tab.id, { url: tab.url, complete: true });
			if (options.autoCloseTab) {
				postStartupBurst ? debouncedBatchClose(tab.windowId) : searchForDuplicateTabsToClose(tab);
			} else {
				refreshDuplicateTabsInfo(tab.windowId);
			}
		}
	}
};

const onUpdatedTab = async (tabId, changeInfo, tab) => {
	await ensureInitialized();
	if (tabsInfo.isClosingTab(tabId)) return;
	if (Object.prototype.hasOwnProperty.call(changeInfo, "status") && changeInfo.status === "complete") {
		if (Object.prototype.hasOwnProperty.call(changeInfo, "url") && (changeInfo.url !== tab.url)) {
			if (isBlankURL(tab.url) || !tab.favIconUrl || !tabsInfo.hasUrlChanged(tab)) return;
			tabsInfo.setTab(tab.id, { url: tab.url, complete: true });
			if (options.autoCloseTab) {
				postStartupBurst ? debouncedBatchClose(tab.windowId) : searchForDuplicateTabsToClose(tab);
			} else {
				refreshDuplicateTabsInfo(tab.windowId);
			}
		}
		else if (isChromeURL(tab.url) || isBlankURL(tab.url)) {
			tabsInfo.setTab(tab.id, { url: tab.url, complete: true });
			if (options.autoCloseTab) {
				postStartupBurst ? debouncedBatchClose(tab.windowId) : searchForDuplicateTabsToClose(tab);
			} else {
				refreshDuplicateTabsInfo(tab.windowId);
			}
		}
	}
};

const onAttached = async (tabId) => {
	await ensureInitialized();
	const tab = await getTab(tabId);
	if (tab) {
		options.autoCloseTab ? searchForDuplicateTabsToClose(tab) : refreshDuplicateTabsInfo(tab.windowId);
	}
};

const onRemovedTab = async (removedTabId, removeInfo) => {
	await ensureInitialized();
	tabsInfo.removeTab(removedTabId);
	if (removeInfo.isWindowClosing) {
		if (options.searchInAllWindows && tabsInfo.hasDuplicateTabs(removeInfo.windowId)) refreshDuplicateTabsInfo();
		tabsInfo.clearDuplicateTabsInfo(removeInfo.windowId);
		refreshDuplicateTabsInfo.cleanup(removeInfo.windowId);
		handleRemainingTab.cleanup(removeInfo.windowId);
		debouncedBatchClose.cleanup(removeInfo.windowId);
	}
	else if (tabsInfo.hasDuplicateTabs(removeInfo.windowId)) {
		refreshDuplicateTabsInfo(removeInfo.windowId);
	}
};

const onDetachedTab = async (detachedTabId, detachInfo) => {
	await ensureInitialized();
	if (tabsInfo.hasDuplicateTabs(detachInfo.oldWindowId)) refreshDuplicateTabsInfo(detachInfo.oldWindowId);
};

const onActivatedTab = async (activeInfo) => {
	await ensureInitialized();
	if (environment.isFirefox) return;
	if (tabsInfo.isClosingTab(activeInfo.tabId)) return;
	setBadge(activeInfo.windowId, activeInfo.tabId);
};

const onReplacedTab = async (addedTabId, removedTabId) => {
	await ensureInitialized();
	tabsInfo.removeTab(removedTabId);
	const tab = await getTab(addedTabId);
	if (tab) await searchForDuplicateTabsToClose(tab);
};

const onCommand = async (command) => {
	await ensureInitialized();
	if (command == "close-duplicate-tabs") closeDuplicateTabs();
};

// MV3: event listeners must be registered synchronously at top level (no await before this point),
// so the service worker can receive events immediately on restart.
chrome.runtime.onStartup.addListener(() => ensureInitialized());
chrome.tabs.onCreated.addListener(onCreatedTab);
chrome.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
chrome.tabs.onAttached.addListener(onAttached);
chrome.tabs.onDetached.addListener(onDetachedTab);
chrome.tabs.onUpdated.addListener(onUpdatedTab);
chrome.webNavigation.onCompleted.addListener(onCompletedTab);
chrome.tabs.onRemoved.addListener(onRemovedTab);
chrome.tabs.onActivated.addListener(onActivatedTab);
chrome.tabs.onReplaced.addListener(onReplacedTab);
chrome.commands.onCommand.addListener(onCommand);

// Kick off initialization immediately when the service worker starts
ensureInitialized();
