"use strict";

let activeWindowId = chrome.windows.WINDOW_ID_NONE;
let lastDuplicateTabs = {};
let panelInitialized = false;
let closePopup = false;
let environment = "";

const escapeHTML = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');

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
    $("#onRemainingTabGroup").toggleClass("hidden", state !== "A");
    if (resize) resizeDuplicateTabsPanel();
};

const updateIgnorePathPartDependents = (checked) => {
    $("#ignoreSearchPart").prop("disabled", checked);
    $("#ignoreHashPart").prop("disabled", checked);
};

const toggleShrunkMode = (checked) => {
    $(".list-group-form").toggleClass("shrunk", checked);
};

const toggleExpendOptions = (resize) => {
    $("#optionHeader").toggleClass("collapsed");
    if (resize) resizeDuplicateTabsPanel();
};

const toggleExpendGroup = (eventId, isTitleClickEvent, pinned, resize) => {
    if (isTitleClickEvent) {
        const groupId = eventId.replace("Title", "Group");
        $(`#${groupId}`).toggleClass("collapsed");
        resizeDuplicateTabsPanel();
    }
    else {
        const groupId = eventId.replace("Pinned", "Group");
        $(".pinned").last().removeClass("last-list-group");
        $(`#${groupId}`).toggleClass("collapsed", !pinned).toggleClass("pinned", pinned);
        if (resize) resizeDuplicateTabsPanel();
        $(".pinned").last().addClass("last-list-group");
    }
};

const setDuplicateTabsTable = (duplicateTabs) => {
    if (areSameArrays(duplicateTabs, lastDuplicateTabs)) return;
    const isUpdate = panelInitialized;
    panelInitialized = true;
    lastDuplicateTabs = duplicateTabs ? Array.from(duplicateTabs) : null;
    $("#duplicateTabsTableBody").empty();
    if (duplicateTabs) {
        let tableRows = "";
        duplicateTabs.forEach(duplicateTab => {
            const containerStyle = duplicateTab.containerColor ? `style='text-decoration:underline; text-decoration-color: ${escapeHTML(duplicateTab.containerColor)};'` : "";
            const title = (duplicateTab.windowId === activeWindowId) ? escapeHTML(duplicateTab.title) : `<em>${escapeHTML(duplicateTab.title)}</em>`;
            const tdTabIcon = `<td class='td-tab-icon'><img src='${escapeHTML(duplicateTab.icon)}' alt=''></td>`;
            const whitelistBadge = duplicateTab.whitelisted ? `<span class='whitelist-badge fa-solid fa-list-check' title='${chrome.i18n.getMessage("whitelistedTab")}'></span> ` : "";
            const tdTabTitle = `<td class='td-tab-title' ${containerStyle} title='${escapeHTML(duplicateTab.url)}'>${whitelistBadge}${title}</td>`;
            const tdCloseButton = "<td class='td-close-button'><button type='button' class='btn-tab-close' aria-label='Close'>&times;</button></td>";
            tableRows += `<tr tabId='${parseInt(duplicateTab.id, 10)}' windowId='${parseInt(duplicateTab.windowId, 10)}'>${tdTabIcon}${tdTabTitle}${tdCloseButton}</tr>`;
        });
        $("#duplicateTabsTableBody").append(tableRows);
        $("#closeDuplicateTabsBtn").removeClass("disabled").attr("aria-disabled", "false");
    }
    else {
        $("#duplicateTabsTableBody").append(`<tr><td class='td-tab-text' colspan='3'><em>${chrome.i18n.getMessage("noDuplicateTabs")}.</em></td></tr>`);
        $("#closeDuplicateTabsBtn").addClass("disabled").attr("aria-disabled", "true");
    }
    resizeDuplicateTabsPanel(isUpdate);
};

const resizeDuplicateTabsPanel = (refresh) => {
    const maxOptionsCardHeight = 432;
    const rowHeight = 26;
    const minRow = 2;
    const nbRows = lastDuplicateTabs ? lastDuplicateTabs.length : 1;
    const maxRows = Math.min(nbRows, Math.floor((maxOptionsCardHeight - $("#optionsCard").height() + (minRow * rowHeight)) / rowHeight));
    $("#duplicateTabsTableContainer").toggleClass("table-scrollable-overflow", nbRows > maxRows);
    if (refresh && (nbRows > maxRows)) highlightBottomScrollShadow();
    $("#duplicateTabsTableContainer").css("height", maxRows * rowHeight);
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
            if (value === "chrome") $(".containerItem").toggleClass("hidden", true);
        }
        else {
            // checkbox
            if (typeof (value) === "boolean") {
                $(`#${storedOption}`).prop("checked", value);
                if (storedOption.endsWith("Pinned") && storedOption !== "customizationPinned") {
                    toggleExpendGroup(storedOption, false, value, false);
                    // eslint-disable-next-line max-depth
                    if (value) collapseOptions = false;
                }
                else if (storedOption === "shrunkMode") toggleShrunkMode(value);
                else if (storedOption === "closePopup") closePopup = value;
                else if (storedOption === "compareWithTitle") $("#titleSimilarityThreshold").prop("disabled", !value);
            }
            // number input
            else if (typeof (value) === "number") {
                $(`#${storedOption}`).val(value);
            }
            // textarea (pattern rules)
            else if (storedOption === "urlRegexRules" || storedOption === "titleRegexRules") {
                $(`#${storedOption}`).val(value);
            }
            // combobox
            else {
                $(`#${storedOption} option[value='${value}']`).prop("selected", true);
                if (storedOption === "onDuplicateTabDetected") changeAutoCloseOptionState(value, false);
                else if (storedOption === "theme") applyTheme(value);
            }
            if (isLockedKey) $(`#${storedOption}`).prop("disabled", true);
        }
    }
    if (collapseOptions) toggleExpendOptions(false);
    applyPopupRuleVisibility(storedOptions);
    updateIgnorePathPartDependents(storedOptions.ignorePathPart ? storedOptions.ignorePathPart.value : false);
    const sessionData = await chrome.storage.session.get('autoOpenedPopup');
    if (sessionData.autoOpenedPopup) {
        chrome.storage.session.remove('autoOpenedPopup');
        $("#optionHeader").addClass("collapsed");
        resizeDuplicateTabsPanel();
    }
};

const applyPopupRuleVisibility = (storedOptions) => {
    const rules = ["caseInsensitive", "ignore3w", "ignoreHashPart", "ignoreSearchPart",
        "ignorePathPart", "compareWithTitle", "urlRegexRules", "titleRegexRules"];
    rules.forEach(rule => {
        const visible = storedOptions[rule + "_popup"] ? storedOptions[rule + "_popup"].value : true;
        $(`#${rule}`).closest(".checkboxes").toggleClass("hidden", !visible);
    });
    const compareTitleVisible = (storedOptions["compareWithTitle_popup"]
        ? storedOptions["compareWithTitle_popup"].value : true)
        && (storedOptions["compareWithTitle"]
        ? storedOptions["compareWithTitle"].value : true);
    $("#titleSimilarityThreshold").closest(".checkboxes").toggleClass("hidden", !compareTitleVisible);
};

const handleMessage = (message) => {
    if (message.action === "updateDuplicateTabsTable") setDuplicateTabsTable(message.data.duplicateTabs);
    if (message.action === "setStoredOption" && message.data.name.endsWith("_popup")) {
        const rule = message.data.name.replace("_popup", "");
        const visible = message.data.value;
        $(`#${rule}`).closest(".checkboxes").toggleClass("hidden", !visible);
        if (rule === "compareWithTitle") {
            const thresholdVisible = visible && $("#compareWithTitle").prop("checked");
            $("#titleSimilarityThreshold").closest(".checkboxes").toggleClass("hidden", !thresholdVisible);
        }
        resizeDuplicateTabsPanel();
    }
};

chrome.runtime.onMessage.addListener(handleMessage);

let highlightBottomScrollShadowTimer = null;
const highlightBottomScrollShadow = () => {
    clearTimeout(highlightBottomScrollShadowTimer);
    $("#duplicateTabsTableContainer").toggleClass("highlight-scroll-bottom", true);
    highlightBottomScrollShadowTimer = setTimeout(() => $("#duplicateTabsTableContainer").toggleClass("highlight-scroll-bottom", false), 400);
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
    $("input[type='checkbox']").on("change", function () {
        if (this.id.endsWith("Pinned")) toggleExpendGroup(this.id, false, this.checked, true);
        else if (this.id === "shrunkMode") toggleShrunkMode(this.checked);
        else if (this.id === "compareWithTitle") {
            $("#titleSimilarityThreshold").prop("disabled", !this.checked);
            $("#titleSimilarityThreshold").closest(".checkboxes").toggleClass("hidden", !this.checked);
        }
        else if (this.id === "ignorePathPart") {
            updateIgnorePathPartDependents(this.checked);
        }
        const refresh = this.className.includes("checkbox-filter");
        saveOption(this.id, this.checked, refresh);
    });

    /* Save combobox settings */
    $(".list-group select").on("change", function (event) {
        event.stopPropagation();
        const refresh = this.id === "scope";
        saveOption(this.id, this.value, refresh);
        if (this.id === "onDuplicateTabDetected") changeAutoCloseOptionState(this.value, true);
    });

    /* Save title similarity threshold */
    $("#titleSimilarityThreshold").on("change", function () {
        const val = Math.min(100, Math.max(1, parseInt(this.value) || 100));
        this.value = val;
        saveOption("titleSimilarityThreshold", val, true);
    });

    /* Save URL/title pattern rules */
    $("#urlRegexRules, #titleRegexRules").on("change", function () {
        const cleaned = this.value.split("\n").map(l => l.trim()).filter(l => l.length > 0).join("\n");
        this.value = cleaned;
        saveOption(this.id, cleaned, true);
    });

    /* Current line highlight for pattern rule textareas */
    const applyLineHighlight = (textarea) => {
        const { top, bottom } = getHighlightBounds(textarea);
        const s = textarea.scrollTop;
        textarea.style.backgroundImage = `linear-gradient(transparent ${top - s}px, rgba(0, 0, 0, 0.075) ${top - s}px, rgba(0, 0, 0, 0.075) ${bottom - s}px, transparent ${bottom - s}px)`;
    };
    $("#urlRegexRules, #titleRegexRules").on("keyup click select focus scroll", function () {
        applyLineHighlight(this);
    }).on("blur", function () {
        this.style.backgroundImage = "";
    });

    /* Open Option tab */
    $(".fa-gear").on("click", (event) => {
        event.stopPropagation();
        chrome.runtime.openOptionsPage();
        window.close();
    });

    /* Active selected tab */
    $("#duplicateTabsTable").on("click", ".td-tab-title", function () {
        const tabId = parseInt($(this).parent().attr("tabId"), 10);
        const windowId = parseInt($(this).parent().attr("windowId"), 10);
        focusTab(tabId, windowId);
    });

    /* Close selected tab */
    $("#duplicateTabsTable").on("click", ".td-close-button", function () {
        const tabId = parseInt($(this).parent().attr("tabId"), 10);
        removeTab(tabId);
    });

    /* Close all */
    $("#closeDuplicateTabsBtn").on("click", function () {
        if (!$(this).hasClass("disabled")) requestCloseDuplicateTabs();
        if (closePopup) window.close();
    });

    /* Toggle options panel */
    $("#optionsTitle").on("click", () => {
        toggleExpendOptions(true);
    });

    /* Toggle subitem panels */
    $(".list-group-item-title").on("click", function () {
        toggleExpendGroup(this.id, true);
    });

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
                const overflow = entry.contentRect.bottom + 1 >= parseFloat($("#optionsBody").css("max-height"));
                $("#optionsBody").toggleClass(overflowClass, overflow);
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