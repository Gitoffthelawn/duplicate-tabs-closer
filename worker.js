"use strict";

const isUrlWhiteListed = (url) => options.whiteList.some(pattern => pattern.test(url));

const matchByUrlPattern = (url1, url2) => {
    for (const { source, regex } of options.urlRegexRules) {
        if (regex.test(url1) && regex.test(url2)) return source;
    }
    return null;
};

const matchByTitlePattern = (title1, title2) => {
    for (const { source, regex } of options.titleRegexRules) {
        if (regex.test(title1) && regex.test(title2)) return source;
    }
    return null;
};

const matchTitle = (tab1, tab2) => {
    if (options.compareWithTitle) {
        if (isTabComplete(tab1) && isTabComplete(tab2)) {
            if (options.titleSimilarityThreshold >= 100)
                return tab1.title.toLowerCase() === tab2.title.toLowerCase();
            const t = options.titleSimilarityThreshold;
            const maxLen = Math.max(tab1.title.length, tab2.title.length);
            if (maxLen > 0 && Math.abs(tab1.title.length - tab2.title.length) > maxLen * (1 - t / 100)) return false;
            return titleSimilarity(tab1.title, tab2.title) >= t;
        }
    }
    return false;
};

const getHttpsTabId = (observedTab, observedTabUrl, openedTab) => {
    if (options.keepTabWithHttps) {
        const match1 = isHttps(observedTabUrl);
        const match2 = isHttps(openedTab.url);
        if (match1) {
            return match2 ? null : observedTab.id;
        } else {
            return match2 ? openedTab.id : null;
        }
    }
    return null;
};

const getPinnedTabId = (tab1, tab2) => {
    if (options.keepPinnedTab) {
        if (tab1.pinned) {
            return tab2.pinned ? null : tab1.id;
        } else {
            return tab2.pinned ? tab2.id : null;
        }
    }
    return null;
};

const getLastUpdatedTabId = (observedTab, openedTab) => {
    const observedTabLastUpdate = tabsInfo.getLastComplete(observedTab.id);
    const openedTabLastUpdate = tabsInfo.getLastComplete(openedTab.id);
    if (options.keepNewerTab) {
        if (observedTabLastUpdate === null) return openedTab.id;
        if (openedTabLastUpdate === null) return observedTab.id;
        return (observedTabLastUpdate > openedTabLastUpdate) ? observedTab.id : openedTab.id;
    } else {
        if (observedTabLastUpdate === null) return openedTab.id;
        if (openedTabLastUpdate === null) return observedTab.id;
        return (observedTabLastUpdate < openedTabLastUpdate) ? observedTab.id : openedTab.id;
    }
};

const getFocusedTab = (observedTab, openedTab, activeWindowId, retainedTabId) => {
    if (retainedTabId === observedTab.id) {
        return ((openedTab.windowId === activeWindowId) && (openedTab.active || (observedTab.windowId !== activeWindowId)) ? openedTab.id : observedTab.id);
    }
    else {
        return ((observedTab.windowId === activeWindowId) && (observedTab.active || (openedTab.windowId !== activeWindowId)) ? observedTab.id : openedTab.id);
    }
};


const getCloseInfo = (details) => {
    const observedTab = details.observedTab;
    const observedTabUrl = details.observedTabUrl || observedTab.url;
    const openedTab = details.openedTab;
    const activeWindowId = details.activeWindowId;
    let retainedTabId = getPinnedTabId(observedTab, openedTab);
    if (!retainedTabId) {
        retainedTabId = getHttpsTabId(observedTab, observedTabUrl, openedTab);
        if (!retainedTabId) {
            retainedTabId = getLastUpdatedTabId(observedTab, openedTab);
            if (activeWindowId) {
                retainedTabId = getFocusedTab(observedTab, openedTab, activeWindowId, retainedTabId);
            }
        }
    }
    if (retainedTabId == observedTab.id) {
        const keepInfo = {
            observedTabClosed: false,
            active: openedTab.active,
            tabIndex: openedTab.index,
            tabId: observedTab.id,
            windowId: observedTab.windowId,
            reloadTab: false
        };
        return [openedTab.id, keepInfo];
    } else {
        const keepInfo = {
            observedTabClosed: true,
            active: observedTab.active,
            tabIndex: observedTab.index,
            tabId: openedTab.id,
            windowId: openedTab.windowId,
            reloadTab: !!options.keepReloadOlderTab
        };
        return [observedTab.id, keepInfo];
    }
};

// eslint-disable-next-line no-unused-vars
const searchForDuplicateTabsToClose = async (observedTab, queryComplete, loadingUrl) => {
    const observedTabUrl = loadingUrl || observedTab.url;
    const observedWindowsId = observedTab.windowId;
    await tabsInfo.awaitPendingCheck(observedTab.id);
    if (tabsInfo.isIntentionalDuplicate(observedTab.id)) return;
    if (isUrlWhiteListed(observedTabUrl)) {
        if (isTabComplete(observedTab)) refreshDuplicateTabsInfo(observedWindowsId);
        return;
    }
    const queryInfo = {};
    if (isValidURL(observedTabUrl) && options.urlRegexRules.length === 0 && options.titleRegexRules.length === 0) { const matchPattern = getMatchPatternURL(observedTabUrl); if (matchPattern) queryInfo.url = matchPattern; }
    queryInfo.windowId = options.searchInAllWindows ? null : observedWindowsId;
    if (environment.isFirefox) queryInfo.cookieStoreId = options.searchPerContainer ? observedTab.cookieStoreId : null;
    const openedTabs = await getTabs(queryInfo);
    if (!openedTabs || openedTabs.length <= 1) return;
    const matchingObservedTabUrl = getMatchingURL(observedTabUrl);
    let match = false;
    for (const openedTab of openedTabs) {
        if ((openedTab.id === observedTab.id) || tabsInfo.isClosingTab(openedTab.id)) continue;
        if (isBlankURL(openedTab.url) && !isTabComplete(openedTab)) continue;
        if (queryComplete && !isTabComplete(openedTab)) continue;
        if ((getMatchingURL(openedTab.url) === matchingObservedTabUrl)
            || matchTitle(openedTab, observedTab)
            || matchByUrlPattern(openedTab.url, observedTabUrl)
            || (isTabComplete(openedTab) && isTabComplete(observedTab) && matchByTitlePattern(openedTab.title, observedTab.title))) {
            match = true;
            const [tabToCloseId, remainingTabInfo] = getCloseInfo({ observedTab: observedTab, observedTabUrl: observedTabUrl, openedTab: openedTab });
            closeDuplicateTab(tabToCloseId, remainingTabInfo);
            if (remainingTabInfo.observedTabClosed) break;
        }
    }
    if (!match) {
        if (loadingUrl) {
            if (tabsInfo.hasDuplicateTabs(observedWindowsId)) refreshDuplicateTabsInfo(observedWindowsId);
            else if (environment.isChrome && observedTab.active) setBadge(observedTab.windowId, observedTab.id);
        } else {
            refreshDuplicateTabsInfo(observedWindowsId);
        }
    }
};

const closeDuplicateTab = async (tabToCloseId, remainingTabInfo) => {
    try {
        tabsInfo.setClosingTab(tabToCloseId, true);
        await removeTab(tabToCloseId);
    }
    catch (ex) {
        tabsInfo.setClosingTab(tabToCloseId, false);
        return;
    }
    if (await tabExists(tabToCloseId)) {
        tabsInfo.setClosingTab(tabToCloseId, false);
        refreshDuplicateTabsInfo(remainingTabInfo.windowId);
        return;
    }
    handleRemainingTab(remainingTabInfo.windowId, remainingTabInfo);
};

const _handleRemainingTab = async (details) => {
    if (!tabsInfo.hasTab(details.tabId)) return;
    if (options.defaultTabBehavior && details.observedTabClosed) {
        if (details.tabIndex > 0) moveTab(details.tabId, { index: details.tabIndex });
        if (details.active) activateTab(details.tabId);
    } else if (options.activateKeptTab) {
        focusTab(details.tabId, details.windowId);
    }
    if (details.reloadTab) {
        tabsInfo.setClosingTab(details.tabId, true);
        await reloadTab(details.tabId);
        tabsInfo.setClosingTab(details.tabId, false);
    }
    refreshDuplicateTabsInfo(details.windowId);
    if (environment.isChrome) setBadge(details.windowId, details.tabId);
};

const handleRemainingTab = debounce(_handleRemainingTab, 500);

const invalidateRetainedURLKey = (retainedTab, currentMatchingKey, retainedTabs) => {
    const urlKey = getMatchingURL(retainedTab.url) + (options.searchPerContainer ? retainedTab.cookieStoreId : "");
    if (urlKey !== currentMatchingKey && retainedTabs.get(urlKey) === retainedTab) {
        retainedTabs.delete(urlKey);
    }
};

const handleObservedTab = (details) => {
    const observedTab = details.tab;
    const retainedTabs = details.retainedTabs;
    const duplicateTabsGroups = details.duplicateTabsGroups;
    let matchingTabURL = getMatchingURL(observedTab.url);
    let matchingTabTitle = options.compareWithTitle && isTabComplete(observedTab) ? `title=${observedTab.title}` : null;
    if (options.searchPerContainer) {
        matchingTabURL += observedTab.cookieStoreId;
        if (matchingTabTitle) matchingTabTitle += observedTab.cookieStoreId;
    }
    let matchingKey = matchingTabURL;
    let retainedTab = retainedTabs.get(matchingKey);
    if (!retainedTab) {
        if (isTabComplete(observedTab) || tabsInfo.getLastComplete(observedTab.id) !== null) retainedTabs.set(matchingKey, observedTab);
        if (matchingTabTitle) {
            matchingKey = findFuzzyTitleKey(observedTab.title, retainedTabs) || matchingTabTitle;
            retainedTab = retainedTabs.get(matchingKey);
            if (!retainedTab) {
                retainedTabs.set(matchingTabTitle, observedTab);
            }
        }
        if (!retainedTab && options.urlRegexRules.length > 0) {
            let urlPatSource = null;
            for (const { source, regex } of options.urlRegexRules) {
                if (regex.test(observedTab.url)) { urlPatSource = source; break; }
            }
            if (urlPatSource) {
                matchingKey = `urlpattern=${urlPatSource}`;
                retainedTab = retainedTabs.get(matchingKey);
                if (!retainedTab) retainedTabs.set(matchingKey, observedTab);
            }
        }
        if (!retainedTab && isTabComplete(observedTab) && options.titleRegexRules.length > 0) {
            let titlePatSource = null;
            for (const { source, regex } of options.titleRegexRules) {
                if (regex.test(observedTab.title)) { titlePatSource = source; break; }
            }
            if (titlePatSource) {
                matchingKey = `titlepattern=${titlePatSource}`;
                retainedTab = retainedTabs.get(matchingKey);
                if (!retainedTab) retainedTabs.set(matchingKey, observedTab);
            }
        }
    }
    if (retainedTab) {
        if (details.closeTab) {
            const [tabToCloseId] = getCloseInfo({ observedTab: observedTab, openedTab: retainedTab, activeWindowId: details.activeWindowId });
            if (tabToCloseId === observedTab.id) {
                details.tabsToClose.add(observedTab.id);
            }
            else {
                details.tabsToClose.add(retainedTab.id);
                invalidateRetainedURLKey(retainedTab, matchingKey, retainedTabs);
                retainedTabs.set(matchingKey, observedTab);
            }
        } else {
            const [tabToCloseId] = getCloseInfo({ observedTab: observedTab, openedTab: retainedTab, activeWindowId: details.activeWindowId });
            if (tabToCloseId === retainedTab.id) {
                invalidateRetainedURLKey(retainedTab, matchingKey, retainedTabs);
                retainedTabs.set(matchingKey, observedTab);
            }
            const tabs = duplicateTabsGroups.get(matchingKey) || new Set([retainedTab]);
            tabs.add(observedTab);
            duplicateTabsGroups.set(matchingKey, tabs);
        }
    }
};

const findFuzzyTitleKey = (title, retainedTabs) => {
    if (options.titleSimilarityThreshold >= 100) return null;
    const t = options.titleSimilarityThreshold;
    const titleLen = title.length;
    for (const [key] of retainedTabs) {
        if (!key.startsWith("title=")) continue;
        const candidate = key.slice(6);
        const maxLen = Math.max(titleLen, candidate.length);
        if (maxLen > 0 && Math.abs(titleLen - candidate.length) > maxLen * (1 - t / 100)) continue;
        if (titleSimilarity(title, candidate) >= t) return key;
    }
    return null;
};

// eslint-disable-next-line no-unused-vars
const searchForDuplicateTabs = async (windowId, closeTabs, skipWhitelisted) => {
    const queryInfo = { windowType: "normal" };
    if (!options.searchInAllWindows) queryInfo.windowId = windowId;
    const [activeWindowId, openedTabs] = await Promise.all([getActiveWindowId(), getTabs(queryInfo)]);
    if (!openedTabs) return;
    const duplicateTabsGroups = new Map();
    const retainedTabs = new Map();
    const tabsToClose = new Set();
    for (const openedTab of openedTabs) {
        if ((isBlankURL(openedTab.url) && !isTabComplete(openedTab)) || tabsInfo.isClosingTab(openedTab.id)) continue;
        if (tabsInfo.isIntentionalDuplicate(openedTab.id)) continue;
        if (closeTabs && skipWhitelisted && isUrlWhiteListed(openedTab.url)) continue;
        const details = {
            tab: openedTab,
            retainedTabs: retainedTabs,
            activeWindowId: activeWindowId,
            closeTab: closeTabs,
            duplicateTabsGroups: duplicateTabsGroups,
            tabsToClose: tabsToClose
        };
        handleObservedTab(details);
    }
    if (closeTabs) {
        if (tabsToClose.size > 0) {
            tabsToClose.forEach(tabId => tabsInfo.setClosingTab(tabId, true));
            chrome.tabs.remove(Array.from(tabsToClose)).catch(() => {
                tabsToClose.forEach(tabId => tabsInfo.setClosingTab(tabId, false));
            });
        }
        return;
    }
    return {
        duplicateTabsGroups: duplicateTabsGroups,
        retainedTabs: retainedTabs,
        activeWindowId: activeWindowId
    };
};

// eslint-disable-next-line no-unused-vars
const closeDuplicateTabs = (windowId, skipWhitelisted) => searchForDuplicateTabs(windowId, true, skipWhitelisted);

const setDuplicateTabPanel = async (duplicateTab, duplicateTabs, groupIndex, retainedTabId) => {
    let containerColor = "";
    if (environment.isFirefox && (!duplicateTab.incognito && duplicateTab.cookieStoreId !== "firefox-default")) {
        try {
            const getContext = await browser.contextualIdentities.get(duplicateTab.cookieStoreId);
            if (getContext) containerColor = getContext.color;
        } catch { /* container deleted or unavailable */ }
    }
    duplicateTabs.add({
        id: duplicateTab.id,
        url: duplicateTab.url,
        title: duplicateTab.title || duplicateTab.url,
        windowId: duplicateTab.windowId,
        containerColor: containerColor,
        icon: (duplicateTab.favIconUrl && !isChromeURL(duplicateTab.favIconUrl)) ? duplicateTab.favIconUrl : "../images/default-favicon.png",
        whitelisted: isUrlWhiteListed(duplicateTab.url),
        groupIndex: groupIndex,
        isRetained: duplicateTab.id === retainedTabId
    });
};

const getDuplicateTabsForPanel = async (duplicateTabsGroups, retainedTabs) => {
    if (duplicateTabsGroups.size === 0) return null;
    const duplicateTabsPanel = new Set();
    let groupIndex = 0;
    for (const [key, duplicateTabs] of duplicateTabsGroups) {
        const retainedTab = retainedTabs ? retainedTabs.get(key) : null;
        const retainedTabId = retainedTab ? retainedTab.id : null;
        await Promise.all(Array.from(duplicateTabs, duplicateTab => setDuplicateTabPanel(duplicateTab, duplicateTabsPanel, groupIndex, retainedTabId)));
        groupIndex++;
    }
    return Array.from(duplicateTabsPanel);
};

// eslint-disable-next-line no-unused-vars
const requestDuplicateTabsFromPanel = async (windowId) => {
    const searchResult = await searchForDuplicateTabs(windowId, false);
    sendDuplicateTabs(searchResult.duplicateTabsGroups, searchResult.retainedTabs);
};

const sendDuplicateTabs = async (duplicateTabsGroups, retainedTabs) => {
    const duplicateTabs = await getDuplicateTabsForPanel(duplicateTabsGroups, retainedTabs);
    chrome.runtime.sendMessage({
        action: "updateDuplicateTabsTable",
        data: { "duplicateTabs": duplicateTabs }
    }).catch(() => {});
};

const _refreshDuplicateTabsInfo = async (windowId) => {
    if (monitoringPaused) return;
    const searchResult = await searchForDuplicateTabs(windowId, false);
    updateBadgesValue(searchResult.duplicateTabsGroups, windowId);
    if ((await isPanelOptionOpen()) && (options.searchInAllWindows || (windowId === searchResult.activeWindowId))) {
        sendDuplicateTabs(searchResult.duplicateTabsGroups, searchResult.retainedTabs);
    }
};

const refreshDuplicateTabsInfo = debounce(_refreshDuplicateTabsInfo, 300, false);

// eslint-disable-next-line no-unused-vars
let postStartupBurst = false;

// eslint-disable-next-line no-unused-vars
const debouncedBatchClose = debounce(closeDuplicateTabs, 300, false);

// Dispatch the appropriate action after a tab completes or navigates.
// alreadyComplete: onUpdatedTab already stamped this completion — skip search in autoClose mode
//                 but still refresh in manual mode (reload detected via onCompletedTab).
// queryComplete:  require matched tabs to be complete before matching (pre-navigation scan).
// eslint-disable-next-line no-unused-vars
const dispatchTabCompletion = (tab, activeTabId, { queryComplete = false, alreadyComplete = false } = {}) => {
    if (options.autoCloseTab) {
        if (!alreadyComplete) {
            postStartupBurst ? debouncedBatchClose(tab.windowId) : searchForDuplicateTabsToClose(tab, queryComplete);
        }
        if (environment.isChrome) setBadge(tab.windowId, activeTabId || null);
    } else {
        refreshDuplicateTabsInfo(tab.windowId);
        if (environment.isChrome) setBadge(tab.windowId, activeTabId || null);
    }
};

// eslint-disable-next-line no-unused-vars
const refreshGlobalDuplicateTabsInfo = async () => {
    if (options.searchInAllWindows) {
        refreshDuplicateTabsInfo();
    } else {
        const windows = await getWindows();
        if (windows) windows.forEach(window => refreshDuplicateTabsInfo(window.id));
    }
};