"use strict";

let activeWindowId = chrome.windows.WINDOW_ID_NONE;
let lastDuplicateTabs = {};
let panelInitialized = false;
let closePopup = false;
let environment = "";

const applyTheme = (value) => {
    const darkThemes = ["ocean", "charcoal", "purple", "teal", "oled"];
    const lightThemes = ["sage", "rose", "amber", "slate", "violet"];
    const isDark = darkThemes.includes(value);
    document.documentElement.setAttribute("data-bs-theme", isDark ? "dark" : "light");
    document.documentElement.classList.remove(...[...darkThemes, ...lightThemes].map(t => `theme-${t}`));
    if (value !== "light") document.documentElement.classList.add(`theme-${value}`);
};

/* Show/Hide the AutoClose option */
const changeAutoCloseOptionState = (state, resize) => {
    document.getElementById("onRemainingTabGroup").classList.toggle("hidden", state !== "A");
    if (resize) resizeDuplicateTabsPanel();
};

const updateIgnorePathPartDependents = (checked) => {
    document.getElementById("ignoreSearchPart").disabled = checked;
    document.getElementById("ignoreHashPart").disabled = checked;
};

const toggleShrunkMode = (checked) => {
    getElements(".list-group-form").forEach(el => el.classList.toggle("shrunk", checked));
};

const toggleExpendOptions = (resize) => {
    document.getElementById("optionHeader").classList.toggle("collapsed");
    if (resize) resizeDuplicateTabsPanel();
};

const toggleExpendGroup = (eventId, isTitleClickEvent, pinned, resize) => {
    if (isTitleClickEvent) {
        const groupId = eventId.replace("Title", "Group");
        document.getElementById(groupId).classList.toggle("collapsed");
        resizeDuplicateTabsPanel();
    }
    else {
        const groupId = eventId.replace("Pinned", "Group");
        const pinnedEls = getElements(".pinned");
        if (pinnedEls.length) pinnedEls.at(-1).classList.remove("last-list-group");
        const group = document.getElementById(groupId);
        group.classList.toggle("collapsed", !pinned);
        group.classList.toggle("pinned", pinned);
        if (resize) resizeDuplicateTabsPanel();
        const pinnedElsAfter = getElements(".pinned");
        if (pinnedElsAfter.length) pinnedElsAfter.at(-1).classList.add("last-list-group");
    }
};

const setDuplicateTabsTable = (duplicateTabs) => {
    if (areSameArrays(duplicateTabs, lastDuplicateTabs)) return;
    const isUpdate = panelInitialized;
    panelInitialized = true;
    lastDuplicateTabs = duplicateTabs ? Array.from(duplicateTabs) : null;
    const tbody = document.getElementById("duplicateTabsTableBody");
    tbody.replaceChildren();
    const closeBtn = document.getElementById("closeDuplicateTabsBtn");
    if (duplicateTabs) {
        tbody.appendChild(buildDuplicateTabRows(duplicateTabs, activeWindowId));
        closeBtn.classList.remove("disabled");
        closeBtn.setAttribute("aria-disabled", "false");
    }
    else {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.className = "td-tab-text";
        td.colSpan = 3;
        const em = document.createElement("em");
        em.textContent = chrome.i18n.getMessage("noDuplicateTabs") + ".";
        td.appendChild(em);
        tr.appendChild(td);
        tbody.appendChild(tr);
        closeBtn.classList.add("disabled");
        closeBtn.setAttribute("aria-disabled", "true");
    }
    resizeDuplicateTabsPanel(isUpdate);
};

const resizeDuplicateTabsPanel = (refresh) => {
    const maxOptionsCardHeight = 432;
    const rowHeight = 26;
    const minRow = 2;
    const nbRows = lastDuplicateTabs ? lastDuplicateTabs.length : 1;
    const maxRows = Math.min(nbRows, Math.floor((maxOptionsCardHeight - document.getElementById("optionsCard").offsetHeight + (minRow * rowHeight)) / rowHeight));
    const container = document.getElementById("duplicateTabsTableContainer");
    container.classList.toggle("table-scrollable-overflow", nbRows > maxRows);
    if (refresh && (nbRows > maxRows)) highlightBottomScrollShadow();
    if (maxRows > 0) container.style.height = `${maxRows * rowHeight}px`;
    else container.style.height = "";
};

const saveActiveWindowId = async () => {
    activeWindowId = await getActiveWindowId();
};

const requestCloseDuplicateTabs = () => sendMessage("closeDuplicateTabs", { "windowId": activeWindowId });

const saveOption = (name, value, refresh) => sendMessage("setStoredOption", { "name": name, "value": value, "refresh": refresh });

const requestGetDuplicateTabs = () => sendMessage("getDuplicateTabs", { "windowId": activeWindowId });

const setPanelOptions = async () => {
    const { storedOptions, lockedKeys } = await getStoredOptions();
    let collapseOptions = true;
    for (const storedOption in storedOptions) {
        const value = storedOptions[storedOption].value;
        const isLockedKey = lockedKeys.includes(storedOption);
        if (storedOption === "environment") {
            environment = value;
            if (value === "chrome") getElements(".containerItem").forEach(el => el.classList.toggle("hidden", true));
        }
        else {
            const el = document.getElementById(storedOption);
            // checkbox
            if (typeof (value) === "boolean") {
                if (el) el.checked = value;
                if (storedOption.endsWith("Pinned") && storedOption !== "customizationPinned") {
                    toggleExpendGroup(storedOption, false, value, false);
                    // eslint-disable-next-line max-depth
                    if (value) collapseOptions = false;
                }
                else if (storedOption === "shrunkMode") toggleShrunkMode(value);
                else if (storedOption === "closePopup") closePopup = value;
                else if (storedOption === "compareWithTitle") {
                    const thresh = document.getElementById("titleSimilarityThreshold");
                    if (thresh) thresh.disabled = !value;
                }
            }
            // number input
            else if (typeof (value) === "number") {
                if (el) el.value = value;
            }
            // textarea (pattern rules and whitelist — whiteList not shown in popup, el will be null)
            else if (storedOption === "urlRegexRules" || storedOption === "titleRegexRules" || storedOption === "whiteList") {
                if (el) el.value = value;
            }
            // combobox
            else {
                const opt = getElement(`#${storedOption} option[value='${value}']`);
                if (opt) opt.selected = true;
                if (storedOption === "onDuplicateTabDetected") changeAutoCloseOptionState(value, false);
                else if (storedOption === "theme") applyTheme(value);
            }
            if (isLockedKey && el) el.disabled = true;
        }
    }
    if (collapseOptions) toggleExpendOptions(false);
    applyPopupRuleVisibility(storedOptions);
    updateIgnorePathPartDependents(storedOptions.ignorePathPart ? storedOptions.ignorePathPart.value : false);
    const sessionData = await chrome.storage.session.get('autoOpenedPopup');
    if (sessionData.autoOpenedPopup) {
        chrome.storage.session.remove('autoOpenedPopup');
        document.getElementById("optionHeader").classList.add("collapsed");
        resizeDuplicateTabsPanel();
    }
};

const applyPopupRuleVisibility = (storedOptions) => {
    const rules = ["caseInsensitive", "ignore3w", "ignoreHashPart", "ignoreSearchPart",
        "ignorePathPart", "compareWithTitle", "urlRegexRules", "titleRegexRules"];
    rules.forEach(rule => {
        const visible = storedOptions[rule + "_popup"] ? storedOptions[rule + "_popup"].value : true;
        const el = document.getElementById(rule);
        if (el) el.closest(".checkboxes").classList.toggle("hidden", !visible);
    });
    const compareTitleVisible = (storedOptions["compareWithTitle_popup"]
        ? storedOptions["compareWithTitle_popup"].value : true)
        && (storedOptions["compareWithTitle"]
        ? storedOptions["compareWithTitle"].value : true);
    const thresh = document.getElementById("titleSimilarityThreshold");
    if (thresh) thresh.closest(".checkboxes").classList.toggle("hidden", !compareTitleVisible);
};

const handleMessage = (message) => {
    if (message.action === "updateDuplicateTabsTable") setDuplicateTabsTable(message.data.duplicateTabs);
    if (message.action === "setStoredOption" && message.data.name.endsWith("_popup")) {
        const rule = message.data.name.replace("_popup", "");
        const visible = message.data.value;
        const el = document.getElementById(rule);
        if (el) el.closest(".checkboxes").classList.toggle("hidden", !visible);
        if (rule === "compareWithTitle") {
            const compareWithTitleEl = document.getElementById("compareWithTitle");
            const thresholdVisible = visible && compareWithTitleEl && compareWithTitleEl.checked;
            const thresh = document.getElementById("titleSimilarityThreshold");
            if (thresh) thresh.closest(".checkboxes").classList.toggle("hidden", !thresholdVisible);
        }
        resizeDuplicateTabsPanel();
    }
};

chrome.runtime.onMessage.addListener(handleMessage);

let highlightBottomScrollShadowTimer = null;
const highlightBottomScrollShadow = () => {
    clearTimeout(highlightBottomScrollShadowTimer);
    const container = document.getElementById("duplicateTabsTableContainer");
    container.classList.toggle("highlight-scroll-bottom", true);
    highlightBottomScrollShadowTimer = setTimeout(() => container.classList.toggle("highlight-scroll-bottom", false), 400);
};

const getHighlightBounds = (textarea) => {
    const cs = window.getComputedStyle(textarea);
    const pt = parseFloat(cs.paddingTop);
    const text = textarea.value;
    const pos = textarea.selectionStart;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    const lineEndRaw = text.indexOf('\n', pos);
    const lineEnd = lineEndRaw === -1 ? text.length : lineEndRaw;
    let m = textarea._mirror;
    if (!m) {
        m = document.createElement('div');
        m.setAttribute('aria-hidden', 'true');
        m.style.cssText = 'position:fixed;top:-9999px;visibility:hidden;white-space:pre-wrap;overflow-wrap:break-word;padding:0;margin:0;border:0;box-sizing:content-box;';
        document.body.appendChild(m);
        textarea._mirror = m;
    }
    m.style.width = (textarea.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) + 'px';
    m.style.font = cs.font;
    m.style.lineHeight = cs.lineHeight;
    let topOffset = 0;
    if (lineStart > 0) {
        m.textContent = text.substring(0, lineStart);
        topOffset = m.scrollHeight;
    }
    m.textContent = text.substring(lineStart, lineEnd) || ' ';
    return { top: pt + topOffset, bottom: pt + topOffset + m.scrollHeight };
};

// eslint-disable-next-line max-lines-per-function
const loadListenerEvents = () => {

    /* Save checkbox settings */
    getElements("input[type='checkbox']").forEach(el => el.addEventListener("change", function () {
        if (this.id.endsWith("Pinned")) toggleExpendGroup(this.id, false, this.checked, true);
        else if (this.id === "shrunkMode") toggleShrunkMode(this.checked);
        else if (this.id === "compareWithTitle") {
            const thresh = document.getElementById("titleSimilarityThreshold");
            thresh.disabled = !this.checked;
            thresh.closest(".checkboxes").classList.toggle("hidden", !this.checked);
        }
        else if (this.id === "ignorePathPart") {
            updateIgnorePathPartDependents(this.checked);
        }
        const refresh = this.className.includes("checkbox-filter");
        saveOption(this.id, this.checked, refresh);
    }));

    /* Save combobox settings */
    getElements(".list-group select").forEach(el => el.addEventListener("change", function (event) {
        event.stopPropagation();
        const refresh = this.id === "scope";
        saveOption(this.id, this.value, refresh);
        if (this.id === "onDuplicateTabDetected") changeAutoCloseOptionState(this.value, true);
    }));

    /* Save title similarity threshold */
    const threshEl = document.getElementById("titleSimilarityThreshold");
    if (threshEl) threshEl.addEventListener("change", function () {
        const val = Math.min(100, Math.max(1, parseInt(this.value) || 100));
        this.value = val;
        saveOption("titleSimilarityThreshold", val, true);
    });

    /* Save URL/title pattern rules */
    ["urlRegexRules", "titleRegexRules"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("change", function () {
            const cleaned = this.value.split("\n").map(l => l.trim()).filter(l => l.length > 0).join("\n");
            this.value = cleaned;
            saveOption(this.id, cleaned, true);
        });
        const applyLineHighlight = (textarea) => {
            const { top, bottom } = getHighlightBounds(textarea);
            const s = textarea.scrollTop;
            textarea.style.backgroundImage = `linear-gradient(transparent ${top - s}px, rgba(0, 0, 0, 0.075) ${top - s}px, rgba(0, 0, 0, 0.075) ${bottom - s}px, transparent ${bottom - s}px)`;
        };
        ["keyup", "click", "select", "focus", "scroll"].forEach(ev =>
            el.addEventListener(ev, function () { applyLineHighlight(this); })
        );
        el.addEventListener("blur", function () { this.style.backgroundImage = ""; });
    });

    /* Open Option tab */
    const gearBtn = getElement(".fa-gear");
    if (gearBtn) gearBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        chrome.runtime.openOptionsPage();
        window.close();
    });

    /* Active selected tab (delegated) */
    const table = document.getElementById("duplicateTabsTable");
    if (table) {
        table.addEventListener("click", function (e) {
            const titleCell = e.target.closest(".td-tab-title");
            if (titleCell) {
                const row = titleCell.parentElement;
                const tabId = parseInt(row.getAttribute("tabId"), 10);
                const windowId = parseInt(row.getAttribute("windowId"), 10);
                focusTab(tabId, windowId);
            }
            const closeCell = e.target.closest(".td-close-button");
            if (closeCell) {
                const row = closeCell.parentElement;
                const tabId = parseInt(row.getAttribute("tabId"), 10);
                removeTab(tabId);
            }
        });
    }

    /* Close all */
    const closeBtn = document.getElementById("closeDuplicateTabsBtn");
    if (closeBtn) closeBtn.addEventListener("click", function () {
        if (!this.classList.contains("disabled")) requestCloseDuplicateTabs();
        if (closePopup) window.close();
    });

    /* Toggle options panel */
    const optionsTitle = document.getElementById("optionsTitle");
    if (optionsTitle) optionsTitle.addEventListener("click", () => {
        toggleExpendOptions(true);
    });

    /* Toggle subitem panels */
    getElements(".list-group-item-title").forEach(el => el.addEventListener("click", function () {
        toggleExpendGroup(this.id, true);
    }));

};

const localizePopup = () => {
    const node = document.documentElement;
    const attribute = "i18n-content";
    const elements = node.querySelectorAll(`[${attribute}]`);
    elements.forEach(element => {
        const value = element.getAttribute(attribute);
        element.textContent = chrome.i18n.getMessage(value);
    });

    const tooltipAttribute = "Title";
    const tooltipElements = node.querySelectorAll(`[${tooltipAttribute}]`);
    tooltipElements.forEach(tooltipElement => {
        const value = tooltipElement.getAttribute(tooltipAttribute);
        tooltipElement.setAttribute(tooltipAttribute, chrome.i18n.getMessage(value));
    });
};

const startObserver = () => {
    const firefoxOverflowClass = "list-group-item-overflow-firefox";
    const chromeOverflowClass = "list-group-item-overflow-chrome";
    const overflowClass = environment == "firefox" ? firefoxOverflowClass : chromeOverflowClass;
    const observer = new ResizeObserver(entries => {
        for (const entry of entries) {
            const optionsBody = document.getElementById("optionsBody");
            const overflow = entry.contentRect.bottom + 1 >= parseFloat(getComputedStyle(optionsBody).maxHeight);
            optionsBody.classList.toggle(overflowClass, overflow);
        }
    });
    const optionsBody = document.querySelector("#optionsBody");
    if (optionsBody) observer.observe(optionsBody);
};


const initialize = async () => {
    await Promise.all([setPanelOptions(), saveActiveWindowId()]);
    requestGetDuplicateTabs();
    localizePopup();
    startObserver();
    loadListenerEvents();
};


document.addEventListener("DOMContentLoaded", initialize);
