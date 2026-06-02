"use strict";

const handleMessage = (message, sender, response) => {
    if (!message || !message.action) return;
    // Skip log-retrieval actions to avoid polluting the log buffer with polling noise
    if (message.action !== "getLogs" && message.action !== "getDuplicateCount") {
        dtcLog("msg", "received", { action: message.action });
    }
    switch (message.action) {
        case "setStoredOption": {
            if (!message.data || !(message.data.name in defaultOptions)) return response({});
            setStoredOption(message.data.name, message.data.value, message.data.refresh)
                .then(() => response({})).catch(() => response({}));
            return true;
        }
        case "getStoredOptions": {
            getStoredOptions().then(storedOptions => response({ data: storedOptions })).catch(() => response({}));
            return true;
        }
        case "getDuplicateTabs": {
            if (!message.data) return response({});
            if (monitoringPaused) {
                chrome.runtime.sendMessage({ action: "updateDuplicateTabsTable", data: { duplicateTabs: null } }).catch(() => {});
            } else {
                requestDuplicateTabsFromPanel(message.data.windowId);
            }
            response({});
            break;
        }
        // The following cases are used by the dtc-test companion extension for automated testing
        case "getDuplicateCount": {
            const windowId = message.data ? message.data.windowId : null;
            const count = tabsInfo.getNbDuplicateTabs(windowId);
            response({ count });
            return true;
        }
        case "getAutoClose": {
            response({ autoClose: options.autoCloseTab });
            return true;
        }
        case "closeDuplicateTabs": {
            if (!message.data) return response({});
            closeDuplicateTabs(message.data.windowId);
            response({});
            break;
        }
        case "toggleMonitorPause": {
            toggleMonitorPause().then(() => response({ paused: monitoringPaused })).catch(() => response({}));
            return true;
        }
        case "getMonitorPauseState": {
            response({ paused: monitoringPaused });
            return true;
        }
        case "getLogs": {
            const since = message.data ? message.data.since : 0;
            response({ logs: getDtcLogs(since) });
            return true;
        }
        case "clearLogs": {
            clearDtcLogs();
            response({});
            break;
        }
    }
};

chrome.runtime.onMessage.addListener(handleMessage);
if (chrome.runtime.onMessageExternal) {
    chrome.runtime.onMessageExternal.addListener(handleMessage);
}