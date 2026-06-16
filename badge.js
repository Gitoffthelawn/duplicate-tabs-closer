"use strict";

const PAUSED_BADGE_TEXT = "⏸";
const PAUSED_BADGE_COLOR = "#888888";

// eslint-disable-next-line no-unused-vars
const setBadgeIcon = () => {
	chrome.action.setIcon({ path: options.autoCloseTab ? "images/auto_close_16.png" : "images/manual_close_16.png" });
	if (environment.isFirefox) browser.action.setBadgeTextColor({ color: "white" });
};

const setBadge = async (windowId, activeTabId) => {
	if (monitoringPaused) {
		if (!environment.isFirefox && activeTabId != null) {
			setTabBadgeText(activeTabId, PAUSED_BADGE_TEXT);
			setTabBadgeBackgroundColor(activeTabId, PAUSED_BADGE_COLOR);
		}
		return;
	}
	const nbCount = tabsInfo.getNbDuplicateTabs(windowId);
	const badgeText = (nbCount === 0 && !options.showBadgeIfNoDuplicateTabs) ? "" : String(nbCount);
	const backgroundColor = (nbCount !== 0) ? options.badgeColorDuplicateTabs : options.badgeColorNoDuplicateTabs;
	if (environment.isFirefox) {
		setWindowBadgeText(windowId, badgeText);
		setWindowBadgeBackgroundColor(windowId, backgroundColor);
	}
	else {
		if (activeTabId != null) {
			setTabBadgeText(activeTabId, badgeText);
			setTabBadgeBackgroundColor(activeTabId, backgroundColor);
		} else {
			const tabs = await getTabs({ windowId: windowId });
			if (tabs) tabs.forEach(tab => {
				setTabBadgeText(tab.id, badgeText);
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
	if (tabsInfo.hasNbDuplicateTabs(windowId) && tabsInfo.getNbDuplicateTabs(windowId) === nbDuplicateTabs) return;
	const prevCount = tabsInfo.hasNbDuplicateTabs(windowId) ? tabsInfo.getNbDuplicateTabs(windowId) : 0;
	tabsInfo.setNbDuplicateTabs(windowId, nbDuplicateTabs);
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
		if (!windows) return;
		windows.forEach(window => updateBadgeValue(nbDuplicateTabs, window.id));
	}
	else {
		updateBadgeValue(nbDuplicateTabs, windowId);
	}
};

// eslint-disable-next-line no-unused-vars
const updateBadgeStyle = async () => {
	const windows = await getWindows();
	if (!windows) return;
	await Promise.all(windows.map(async w => {
		const activeTabId = await getActiveTabId(w.id);
		setBadge(w.id, activeTabId);
	}));
};

// eslint-disable-next-line no-unused-vars
const setPausedBadge = async () => {
	if (environment.isFirefox) {
		const windows = await getWindows();
		if (windows) windows.forEach(w => {
			setWindowBadgeText(w.id, PAUSED_BADGE_TEXT);
			setWindowBadgeBackgroundColor(w.id, PAUSED_BADGE_COLOR);
		});
	} else {
		const tabs = await getTabs({});
		if (tabs) tabs.forEach(tab => {
			setTabBadgeText(tab.id, PAUSED_BADGE_TEXT);
			setTabBadgeBackgroundColor(tab.id, PAUSED_BADGE_COLOR);
		});
	}
};