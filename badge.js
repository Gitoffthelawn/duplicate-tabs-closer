"use strict";

// eslint-disable-next-line no-unused-vars
const setBadgeIcon = () => {
	dtcLog("badge", "icon-set", { autoClose: options.autoCloseTab });
	chrome.action.setIcon({ path: options.autoCloseTab ? "images/auto_close_16.png" : "images/manual_close_16.png" });
	if (environment.isFirefox) browser.action.setBadgeTextColor({ color: "white" });
};

const setBadge = async (windowId, activeTabId) => {
	if (monitoringPaused) return;
	let nbDuplicateTabs = tabsInfo.getNbDuplicateTabs(windowId);
	if (nbDuplicateTabs === "0" && !options.showBadgeIfNoDuplicateTabs) nbDuplicateTabs = "";
	const backgroundColor = (nbDuplicateTabs !== "0") ? options.badgeColorDuplicateTabs : options.badgeColorNoDuplicateTabs;
	dtcLog("badge", "badge-set", { windowId, tabId: activeTabId || null, count: nbDuplicateTabs });
	if (environment.isFirefox) {
		setWindowBadgeText(windowId, nbDuplicateTabs);
		setWindowBadgeBackgroundColor(windowId, backgroundColor);
	}
	else {
		if (activeTabId) {
			setTabBadgeText(activeTabId, nbDuplicateTabs);
			setTabBadgeBackgroundColor(activeTabId, backgroundColor);
		} else {
			const tabs = await getTabs({ windowId: windowId });
			if (tabs) tabs.forEach(tab => {
				setTabBadgeText(tab.id, nbDuplicateTabs);
				setTabBadgeBackgroundColor(tab.id, backgroundColor);
			});
		}
	}
};

const getNbDuplicateTabs = (duplicateTabsGroups) => {
	let nbDuplicateTabs = 0;
	if (duplicateTabsGroups.size !== 0) {
		duplicateTabsGroups.forEach(duplicateTabs => (nbDuplicateTabs += duplicateTabs.size - 1));
	}
	return nbDuplicateTabs;
};

const updateBadgeValue = async (nbDuplicateTabs, windowId) => {
	if (tabsInfo.hasNbDuplicateTabs(windowId) && tabsInfo.getNbDuplicateTabs(windowId) === nbDuplicateTabs.toString()) return;
	const prevCount = tabsInfo.hasNbDuplicateTabs(windowId) ? parseInt(tabsInfo.getNbDuplicateTabs(windowId)) : 0;
	tabsInfo.setNbDuplicateTabs(windowId, nbDuplicateTabs);
	dtcLog("badge", "badge-updated", { windowId, prev: prevCount, count: nbDuplicateTabs });
	setBadge(windowId);
	if (options.openPopupOnDuplicateDetected && nbDuplicateTabs > prevCount && !(await isPopupOpen())) {
		chrome.storage.session.set({ autoOpenedPopup: true }).then(() => {
			chrome.action.openPopup().catch(() => {});
		});
	}
};

// eslint-disable-next-line no-unused-vars
const updateBadgesValue = async (duplicateTabsGroups, windowId) => {
	const nbDuplicateTabs = getNbDuplicateTabs(duplicateTabsGroups);
	if (options.searchInAllWindows) {
		const windows = await getWindows();
		windows.forEach(window => updateBadgeValue(nbDuplicateTabs, window.id));
	}
	else {
		updateBadgeValue(nbDuplicateTabs, windowId);
	}
};

// eslint-disable-next-line no-unused-vars
const updateBadgeStyle = async () => {
	const windows = await getWindows();
	windows.forEach(window => setBadge(window.id));
};

// eslint-disable-next-line no-unused-vars
const setPausedBadge = async () => {
	dtcLog("badge", "badge-paused");
	const PAUSED_COLOR = "#888888";
	const PAUSED_TEXT = "⏸";
	if (environment.isFirefox) {
		const windows = await getWindows();
		if (windows) windows.forEach(w => {
			setWindowBadgeText(w.id, PAUSED_TEXT);
			setWindowBadgeBackgroundColor(w.id, PAUSED_COLOR);
		});
	} else {
		const tabs = await getTabs({});
		if (tabs) tabs.forEach(tab => {
			setTabBadgeText(tab.id, PAUSED_TEXT);
			setTabBadgeBackgroundColor(tab.id, PAUSED_COLOR);
		});
	}
};