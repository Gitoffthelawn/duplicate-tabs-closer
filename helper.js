
"use strict";

// eslint-disable-next-line no-unused-vars
const getElement = (sel, ctx = document) => ctx.querySelector(sel);
// eslint-disable-next-line no-unused-vars
const getElements = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

// eslint-disable-next-line no-unused-vars
const wait = timeout => new Promise(resolve => setTimeout(resolve, timeout));

// eslint-disable-next-line no-unused-vars
const debounce = (func, delay, immediate = true) => {
    const storedArguments = new Map();
    const debouncedFn = (...args) => {
        const windowId = args[0] || 1;
        const later = () => {
            const laterArgs = storedArguments.get(windowId);
            if (laterArgs) {
                func(laterArgs);
                setTimeout(later, delay);
                storedArguments.set(windowId, null);
            }
            else {
                storedArguments.delete(windowId);
            }
        };

        if (immediate) {
            if (!storedArguments.has(windowId)) {
                func(args[1] || args[0]);
                setTimeout(later, delay);
                storedArguments.set(windowId, null);
            }
            else {
                storedArguments.set(windowId, args[1] || args[0] || 1);
            }
        }
        else {
            const alreadyQueued = storedArguments.has(windowId);
            storedArguments.set(windowId, args[1] || args[0] || 1);
            if (!alreadyQueued) setTimeout(later, delay);
        }
    };
    debouncedFn.cleanup = (windowId) => { storedArguments.delete(windowId); };
    return debouncedFn;
};

// eslint-disable-next-line no-unused-vars
const tabExists = async (tabId) => {
    const tab = await getTab(tabId, true);
    return tab !== null;
};

// eslint-disable-next-line no-unused-vars
const isTabComplete = tab => tab.status === "complete" || tab.status === "unloaded";

// eslint-disable-next-line no-unused-vars
const isTabLoading = tab => tab.status === "loading";

// eslint-disable-next-line no-unused-vars
const getTab = (tabId, silent = false) => new Promise((resolve) => {
    chrome.tabs.get(tabId, tab => {
        if (chrome.runtime.lastError && !silent) console.error("getTab error:", chrome.runtime.lastError.message);
        resolve(chrome.runtime.lastError ? null : tab);
    });
});

const getTabs = (queryInfo) => new Promise((resolve) => {
    queryInfo.windowType = "normal";
    chrome.tabs.query(queryInfo, tabs => {
        if (chrome.runtime.lastError) console.error("getTabs error:", chrome.runtime.lastError.message);
        resolve(chrome.runtime.lastError ? null : tabs);
    });
});

// eslint-disable-next-line no-unused-vars
const getWindows = () => new Promise((resolve) => {
    chrome.windows.getAll(null, windows => {
        if (chrome.runtime.lastError) console.error("getWindows error:", chrome.runtime.lastError.message);
        resolve(chrome.runtime.lastError ? null : windows);
    });
});

const updateWindow = (windowId, updateProperties) => new Promise((resolve, reject) => {
    chrome.windows.update(windowId, updateProperties, () => {
        if (chrome.runtime.lastError) {
            console.error("updateWindow error:", chrome.runtime.lastError.message);
            reject();
        }
        else resolve();
    });
});

const getActiveTab = async (windowId) => {
    const tabs = await getTabs({ windowId: windowId, active: true });
    return tabs ? tabs[0] : null;
};

// eslint-disable-next-line no-unused-vars
const getActiveTabId = async (windowId) => {
    const activeTab = await getActiveTab(windowId);
    return activeTab ? activeTab.id : null;
};

// eslint-disable-next-line no-unused-vars
const reloadTab = (tabId) => new Promise((resolve, reject) => {
    chrome.tabs.reload(tabId, () => {
        if (chrome.runtime.lastError) {
            console.error("reloadTab error:", chrome.runtime.lastError.message);
            reject();
        }
        else resolve();
    });
});

// eslint-disable-next-line no-unused-vars
const getActiveWindowId = () => new Promise((resolve) => {
    chrome.windows.getLastFocused(null, window => {
        if (chrome.runtime.lastError) console.error("getActiveWindowId error:", chrome.runtime.lastError.message);
        resolve(chrome.runtime.lastError ? null : window.id);
    });
});

const updateTab = (tabId, updateProperties) => new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, updateProperties, () => {
        if (chrome.runtime.lastError) {
            console.error("updateTab error:", tabId, updateProperties, chrome.runtime.lastError.message);
            reject();
        }
        else resolve();
    });
});

const activateWindow = (windowId) => updateWindow(windowId, { focused: true });

const activateTab = (tabId) => updateTab(tabId, { active: true });

// eslint-disable-next-line no-unused-vars
const focusTab = (tabId, windowId) => Promise.all([activateTab(tabId), activateWindow(windowId)]);

// eslint-disable-next-line no-unused-vars
const moveTab = (tabId, moveProperties) => new Promise((resolve, reject) => {
    chrome.tabs.move(tabId, moveProperties, () => {
        if (chrome.runtime.lastError) {
            console.error("moveTab error:", chrome.runtime.lastError.message);
            reject();
        }
        else resolve();
    });
});

// eslint-disable-next-line no-unused-vars
const removeTab = (tabId) => new Promise((resolve, reject) => {
    chrome.tabs.remove(tabId, () => {
        if (chrome.runtime.lastError) {
            console.error("removeTab error:", chrome.runtime.lastError.message);
            reject();
        }
        else resolve();
    });
});

// eslint-disable-next-line no-unused-vars
const setIcon = (details) => new Promise((resolve) => {
    chrome.action.setIcon(details, () => {
        if (chrome.runtime.lastError) console.error("setIcon error:", chrome.runtime.lastError.message);
        resolve();
    });
});

// eslint-disable-next-line no-unused-vars
const getTabBadgeText = (tabId) => new Promise((resolve) => {
    chrome.action.getBadgeText({ tabId: tabId }, badgeText => {
        if (chrome.runtime.lastError) console.error("getTabBadgeText error:", chrome.runtime.lastError.message);
        resolve(badgeText);
    });
});

// eslint-disable-next-line no-unused-vars
const getWindowBadgeText = (windowId) => browser.action.getBadgeText({ windowId: windowId });

// eslint-disable-next-line no-unused-vars
const setTabBadgeText = (tabId, text) => new Promise((resolve) => {
    if (!tabId || tabId < 0) {
        console.error("setTabBadgeText error: no tabId");
        resolve();
        return;
    }
    chrome.action.setBadgeText({ tabId: tabId, text: text }, () => {
        if (chrome.runtime.lastError && !chrome.runtime.lastError.message.includes("No tab with id")) console.error("setTabBadgeText error:", chrome.runtime.lastError.message);
        resolve();
    });
});

// eslint-disable-next-line no-unused-vars
const setWindowBadgeText = (windowId, text) => browser.action.setBadgeText({ windowId: windowId, text: text }).catch(() => {});

// eslint-disable-next-line no-unused-vars
const setTabBadgeBackgroundColor = (tabId, color) => new Promise((resolve) => {
    if (!tabId || tabId < 0) { resolve(); return; }
    chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: color }, () => {
        if (chrome.runtime.lastError && !chrome.runtime.lastError.message.includes("No tab with id")) console.error("setTabBadgeBackgroundColor error:", chrome.runtime.lastError.message);
        resolve();
    });
});

// eslint-disable-next-line no-unused-vars
const setWindowBadgeBackgroundColor = (windowId, color) => browser.action.setBadgeBackgroundColor({ windowId: windowId, color: color }).catch(() => {});

// eslint-disable-next-line no-unused-vars
const getStoredOptions = () => Promise.all([
    new Promise((resolve) => {
        chrome.storage.local.get(null, localOptions => {
            if (chrome.runtime.lastError) console.error("getStoredOptions error on getting local storage:", chrome.runtime.lastError.message);
            resolve(localOptions);
        });
    }),
    // chrome.storage.managed is supported on Firefox 57 and later.
    // On Windows Enterprise, the GP check can block for 5-10s on Chrome startup.
    // Race against a 500ms timeout so the extension initializes quickly.
    !chrome.storage.managed ? null : Promise.race([
        new Promise((resolve) => {
            chrome.storage.managed.get(null, managedOptions => {
                if (chrome.runtime.lastError) {
                    if (chrome.runtime.lastError.message !== "Managed storage manifest not found") {
                        console.error("getStoredOptions error on getting managed storage:", chrome.runtime.lastError.message);
                    }
                }
                resolve(managedOptions);
            });
        }),
        new Promise(resolve => setTimeout(() => resolve(null), 100))
    ])
]).then(results => {
    const [localOptions, managedOptions] = results;
    return {
        storedOptions: Object.assign({}, localOptions || {}, managedOptions || {}),
        lockedKeys: Object.keys(managedOptions || {})
    };
});

const clearStoredOptions = () => new Promise((resolve) => {
    chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) console.error("clearStoredOptions error:", chrome.runtime.lastError.message);
        resolve();
    });
});

// eslint-disable-next-line no-unused-vars
const removeStoredOptions = (keys) => new Promise((resolve) => {
    chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) console.error("removeStoredOptions error:", chrome.runtime.lastError.message);
        resolve();
    });
});

// eslint-disable-next-line no-unused-vars
const saveStoredOptions = async (options) => {
    return new Promise((resolve) => {
        chrome.storage.local.set(options, () => {
            if (chrome.runtime.lastError) console.error("saveStoredOptions error:", chrome.runtime.lastError.message);
            resolve(Object.assign({}, options));
        });
    });
};

const _sendMessageOnce = (action, data) => new Promise((resolve, reject) => {
    const CHROME_SEND_MESSAGE_CALLBACK_NO_RESPONSE_MESSAGE = "The message port closed before a response was received.";
    chrome.runtime.sendMessage({ action: action, data: data }, response => {
        if (chrome.runtime.lastError) {
            if (chrome.runtime.lastError.message === CHROME_SEND_MESSAGE_CALLBACK_NO_RESPONSE_MESSAGE) {
                resolve(undefined);
            } else {
                reject(chrome.runtime.lastError);
            }
        }
        else {
            resolve(response);
        }
    });
});

// eslint-disable-next-line no-unused-vars
const sendMessage = async (action, data, retries = 3, retryDelay = 300) => {
    for (let i = 0; i < retries; i++) {
        const response = await _sendMessageOnce(action, data);
        if (response !== undefined) return response;
        if (i < retries - 1) await wait(retryDelay);
    }
    return undefined;
};

// eslint-disable-next-line no-unused-vars
const titleSimilarity = (a, b) => {
    const s1 = a.toLowerCase(), s2 = b.toLowerCase();
    const m = s1.length, n = s2.length;
    if (m === 0 && n === 0) return 100;
    if (m === 0 || n === 0) return 0;
    const prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
        const curr = [i];
        for (let j = 1; j <= n; j++) {
            curr[j] = s1[i-1] === s2[j-1] ? prev[j-1] : 1 + Math.min(prev[j], curr[j-1], prev[j-1]);
        }
        prev.splice(0, prev.length, ...curr);
    }
    return Math.round((1 - prev[n] / Math.max(m, n)) * 100);
};

// eslint-disable-next-line no-unused-vars
const areSameArrays = (array1, array2) => {
    if (!array1 && !array2) {
        return true;
    }
    if (!array1 || !array2) {
        return false;
    }
    return JSON.stringify(array1) === JSON.stringify(array2);
};

// eslint-disable-next-line no-unused-vars
const escapeHTML = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');

// eslint-disable-next-line no-unused-vars
const buildTabRow = (duplicateTab, activeWindowId) => {
    const tr = document.createElement("tr");
    tr.setAttribute("tabId", parseInt(duplicateTab.id, 10));
    tr.setAttribute("windowId", parseInt(duplicateTab.windowId, 10));
    if (!duplicateTab.isRetained) tr.classList.add("tab-row-duplicate");
    if (duplicateTab.whitelisted) tr.setAttribute("data-whitelisted", "true");

    const tdIcon = document.createElement("td");
    tdIcon.className = "td-tab-icon";
    const img = document.createElement("img");
    img.src = duplicateTab.icon || "../images/default-favicon.png";
    img.alt = "";
    tdIcon.appendChild(img);

    const tdTitle = document.createElement("td");
    tdTitle.className = "td-tab-title";
    tdTitle.title = duplicateTab.url;
    if (duplicateTab.containerColor) {
        tdTitle.style.textDecorationColor = duplicateTab.containerColor;
    }
    if (duplicateTab.whitelisted) {
        const badge = document.createElement("span");
        badge.className = "whitelist-badge fa-solid fa-list-check";
        badge.title = chrome.i18n.getMessage("whitelistedTab");
        tdTitle.appendChild(badge);
        tdTitle.appendChild(document.createTextNode(" "));
    }
    if (duplicateTab.windowId === activeWindowId) {
        tdTitle.appendChild(document.createTextNode(duplicateTab.title));
    } else {
        const em = document.createElement("em");
        em.textContent = duplicateTab.title;
        tdTitle.appendChild(em);
    }

    const tdClose = document.createElement("td");
    tdClose.className = "td-close-button";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-tab-close";
    btn.setAttribute("aria-label", "Close");
    btn.textContent = "×";
    tdClose.appendChild(btn);

    tr.appendChild(tdIcon);
    tr.appendChild(tdTitle);
    tr.appendChild(tdClose);
    return tr;
};

// eslint-disable-next-line no-unused-vars
const buildDuplicateTabRows = (duplicateTabs, activeWindowId) => {
    const fragment = document.createDocumentFragment();
    duplicateTabs.forEach(tab => fragment.appendChild(buildTabRow(tab, activeWindowId)));
    return fragment;
};

// eslint-disable-next-line no-unused-vars
const buildGroupedDuplicateTabRows = (duplicateTabs, activeWindowId) => {
    const fragment = document.createDocumentFragment();
    const groups = new Map();
    duplicateTabs.forEach(tab => {
        if (!groups.has(tab.groupIndex)) groups.set(tab.groupIndex, []);
        groups.get(tab.groupIndex).push(tab);
    });
    groups.forEach((tabs) => {
        const headerTr = document.createElement("tr");
        headerTr.className = "tr-group-header collapsed";
        headerTr.dataset.groupTabIds = tabs.map(t => t.id).join(",");
        if (tabs.every(tab => tab.whitelisted)) headerTr.setAttribute("data-whitelisted", "true");

        const tdHeader = document.createElement("td");
        tdHeader.className = "td-group-header-cell";
        tdHeader.colSpan = 2;

        const chevron = document.createElement("span");
        chevron.className = "fa-solid fa-chevron-right fa-xs";
        chevron.setAttribute("aria-hidden", "true");

        const img = document.createElement("img");
        img.src = tabs[0].icon || "../images/default-favicon.png";
        img.alt = "";
        img.className = "group-favicon";

        const titleSpan = document.createElement("span");
        titleSpan.className = "group-header-title";
        titleSpan.title = tabs[0].url;
        titleSpan.textContent = tabs[0].title;

        const badge = document.createElement("span");
        badge.className = "group-count-badge";
        badge.textContent = chrome.i18n.getMessage("tabsCount", [String(tabs.length)]);

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "btn-tab-close btn-group-close";
        closeBtn.setAttribute("aria-label", chrome.i18n.getMessage("closeGroup"));
        closeBtn.textContent = "×";

        const innerDiv = document.createElement("div");
        innerDiv.className = "group-header-inner";
        innerDiv.append(chevron, img, titleSpan, badge);
        tdHeader.appendChild(innerDiv);

        const tdClose = document.createElement("td");
        tdClose.className = "td-close-button";
        tdClose.appendChild(closeBtn);

        headerTr.append(tdHeader, tdClose);
        fragment.appendChild(headerTr);

        tabs.forEach(tab => {
            const row = buildTabRow(tab, activeWindowId);
            row.classList.add("group-row", "group-collapsed");
            fragment.appendChild(row);
        });
    });
    return fragment;
};