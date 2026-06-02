"use strict";

// Chrome MV3 service worker only — Firefox loads scripts via manifest background.scripts
if (typeof importScripts === "function") {
	importScripts("helper.js", "tabsInfo.js", "options.js", "urlUtils.js", "badge.js", "worker.js", "messageListener.js");
}

let initPromise = null;
let postStartupBurst = false;
let monitoringPaused = false;
const debouncedBatchClose = debounce(closeDuplicateTabs, 300, false);
const generateTabSessionId = () => `dtc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

// eslint-disable-next-line no-unused-vars
const ensureInitialized = () => {
	if (!initPromise) initPromise = initialize();
	return initPromise;
};

const initialize = async () => {
	await initializeOptions();
	const sessionData = await chrome.storage.session.get('monitoringPaused');
	monitoringPaused = sessionData.monitoringPaused || false;
	setBadgeIcon();
	if (monitoringPaused) setPausedBadge();
	if (environment.isFirefox) await initializeTabSessionIds();
	if (!monitoringPaused) await refreshGlobalDuplicateTabsInfo();
	postStartupBurst = true;
	setTimeout(() => { postStartupBurst = false; }, 3000);
};

// eslint-disable-next-line no-unused-vars
const toggleMonitorPause = async () => {
	monitoringPaused = !monitoringPaused;
	await chrome.storage.session.set({ monitoringPaused });
	if (monitoringPaused) {
		await setStoredOption("onDuplicateTabDetected", "N", false);
		chrome.runtime.sendMessage({ action: "setStoredOption", data: { name: "onDuplicateTabDetected", value: "N" } }).catch(() => {});
		setPausedBadge();
		chrome.runtime.sendMessage({ action: "updateDuplicateTabsTable", data: { duplicateTabs: null } }).catch(() => {});
	} else {
		await tabsInfo.initialize();
		setBadgeIcon();
		updateBadgeStyle();
		refreshGlobalDuplicateTabsInfo();
	}
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
	await ensureInitialized();
	if (monitoringPaused) return;
	if (typeof browser !== "undefined" && browser.sessions) {
		// Register pending session check synchronously (no await before this block)
		// to prevent race with webNavigation events
		const checkPromise = (async () => {
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
	tabsInfo.setTab(tab.id, {});
	if (tab.status === "complete") {
		tabsInfo.setTab(tab.id, { url: tab.url, complete: true });
		if (options.autoCloseTab && tab.url !== "about:blank") {
			postStartupBurst ? debouncedBatchClose(tab.windowId) : searchForDuplicateTabsToClose(tab, true);
		} else {
			refreshDuplicateTabsInfo(tab.windowId);
		}
	}
};

const onBeforeNavigate = async (details) => {
	await ensureInitialized();
	if (monitoringPaused) return;
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
	if (monitoringPaused) return;
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
			if (environment.isChrome) setBadge(tab.windowId, tab.id);
		}
	}
};

const onUpdatedTab = async (tabId, changeInfo, tab) => {
	await ensureInitialized();
	if (monitoringPaused) return;
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
			if (environment.isChrome) setBadge(tab.windowId, tab.id);
		}
		else if (isChromeURL(tab.url) || isBlankURL(tab.url)) {
			tabsInfo.setTab(tab.id, { url: tab.url, complete: true });
			if (options.autoCloseTab && isChromeURL(tab.url)) {
				postStartupBurst ? debouncedBatchClose(tab.windowId) : searchForDuplicateTabsToClose(tab);
			} else {
				refreshDuplicateTabsInfo(tab.windowId);
			}
			if (environment.isChrome) setBadge(tab.windowId, tab.id);
		}
	}
};

const onAttached = async (tabId) => {
	await ensureInitialized();
	if (monitoringPaused) return;
	const tab = await getTab(tabId);
	if (tab) {
		options.autoCloseTab ? searchForDuplicateTabsToClose(tab) : refreshDuplicateTabsInfo(tab.windowId);
	}
};

const onRemovedTab = async (removedTabId, removeInfo) => {
	await ensureInitialized();
	tabsInfo.removeTab(removedTabId);
	if (monitoringPaused) return;
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
	if (monitoringPaused) return;
	if (tabsInfo.hasDuplicateTabs(detachInfo.oldWindowId)) refreshDuplicateTabsInfo(detachInfo.oldWindowId);
};

const onActivatedTab = async (activeInfo) => {
	await ensureInitialized();
	if (environment.isFirefox) return;
	setBadge(activeInfo.windowId, activeInfo.tabId);
};

const onReplacedTab = async (addedTabId, removedTabId) => {
	await ensureInitialized();
	if (monitoringPaused) return;
	tabsInfo.removeTab(removedTabId);
	const tab = await getTab(addedTabId);
	if (tab) await searchForDuplicateTabsToClose(tab);
};

const onCommand = async (command) => {
	await ensureInitialized();
	if (command == "close-duplicate-tabs") closeDuplicateTabs();
	else if (command == "toggle-close-mode") setStoredOption("onDuplicateTabDetected", options.autoCloseTab ? "N" : "A", false);
	else if (command == "toggle-monitor-pause") toggleMonitorPause();
};

// MV3: event listeners must be registered synchronously at top level (no await before this point),
// so the service worker can receive events immediately on restart.
chrome.runtime.onStartup.addListener(() => ensureInitialized());
// Sync in-memory options when storage is written externally (e.g. from the dtc-test
// companion extension, or when multiple option pages are open simultaneously)
chrome.storage.onChanged.addListener((changes, area) => {
	if (area !== "local") return;
	if (monitoringPaused) return;
	let hasOptionChange = false;
	for (const key of Object.keys(changes)) {
		if (key in defaultOptions) { hasOptionChange = true; break; }
	}
	if (!hasOptionChange) return;
	getStoredOptions().then(current => {
		setOptions(current.storedOptions);
		refreshGlobalDuplicateTabsInfo();
	});
});
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
