"use strict";

let activeWindowId = chrome.windows.WINDOW_ID_NONE;
let lastDuplicateTabs = {};
let panelInitialized = false;

const applyTheme = (value) => {
  const darkThemes = ["ocean", "charcoal", "purple", "teal", "oled"];
  const lightThemes = ["sage", "rose", "amber", "slate", "violet"];
  const isDark = darkThemes.includes(value);
  document.documentElement.setAttribute("data-bs-theme", isDark ? "dark" : "light");
  document.documentElement.classList.remove(...[...darkThemes, ...lightThemes].map(t => `theme-${t}`));
  if (value !== "light") document.documentElement.classList.add(`theme-${value}`);
};

const initialize = async () => {
  await Promise.all([setPanelOptions(), saveActiveWindowId()]);
  requestGetDuplicateTabs();
  localizePopup(document.documentElement);
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
const loadPopupEvents = () => {

  /* Save checkbox settings */
  $(".list-group input[type='checkbox']").on("change", function () {
    if (this.id.endsWith("_popup")) {
      saveOption(this.id, this.checked, false);
      return;
    }
    if (this.id === "compareWithTitle") $("#titleSimilarityThreshold").prop("disabled", !this.checked);
    else if (this.id === "ignorePathPart") updateIgnorePathPartDependents(this.checked);
    const refresh = this.className.includes("checkbox-filter");
    saveOption(this.id, this.checked, refresh);
  });

  /* Save combobox settings */
  $(".list-group select").on("change", function (event) {
    event.stopPropagation();
    const refresh = this.id === "scope";
    saveOption(this.id, this.value, refresh);
    if (this.id === "onDuplicateTabDetected") changeAutoCloseOptionState(this.value, true);
    else if (this.id === "theme") applyTheme(this.value);
  });

  /* Save badge color settings */
  $(".list-group input[type='color']").on("change", function () {
    saveOption(this.id, this.value);
  });

  /* Save title similarity threshold */
  $(".list-group #titleSimilarityThreshold").on("change", function () {
    const val = Math.min(100, Math.max(1, parseInt(this.value) || 100));
    this.value = val;
    saveOption("titleSimilarityThreshold", val, true);
  });

  /* Save whiteList settings */
  $("#whiteList").on("change", function () {
    let whiteList = $(this).val();
    whiteList = cleanUpWhiteList(whiteList);
    setWhiteList(whiteList);
    saveOption(this.id, whiteList, false);
  });

  /* Save URL/title pattern rules */
  $("#urlRegexRules, #titleRegexRules").on("change", function () {
    const cleaned = cleanUpWhiteList($(this).val());
    $(`#${this.id}`).val(cleaned);
    saveOption(this.id, cleaned, true);
  });

  /* Current line highlight for pattern rule textareas */
  const applyLineHighlight = (textarea) => {
    const { top, bottom } = getHighlightBounds(textarea);
    const s = textarea.scrollTop;
    textarea.style.backgroundImage = `linear-gradient(transparent ${top - s}px, rgba(0, 0, 0, 0.075) ${top - s}px, rgba(0, 0, 0, 0.075) ${bottom - s}px, transparent ${bottom - s}px)`;
  };
  $("#urlRegexRules, #titleRegexRules, #whiteList").on("keyup click select focus scroll", function () {
    applyLineHighlight(this);
  }).on("blur", function () {
    this.style.backgroundImage = "";
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
  });

};

const setWhiteList = (whiteList) => {
  $("#whiteList").val(whiteList);
};

const cleanUpWhiteList = (whiteList) => {
  const whiteListCleaned = new Set();
  const whiteListLines = whiteList.split("\n");
  for (let whiteListLine of whiteListLines) {
    whiteListLine = whiteListLine.trim();
    if (whiteListLine.length !== 0) whiteListCleaned.add(whiteListLine);
  }
  return Array.from(whiteListCleaned).join("\n");
};

/* Show/Hide the AutoClose option */
const changeAutoCloseOptionState = (state, resize) => {
  $("#onRemainingTabGroup").toggleClass("hidden", state !== "A");
  $("#whiteListGroup").toggleClass("hidden", state !== "A");
  if (resize) resizeDuplicateTabsPanel();
};

const updateIgnorePathPartDependents = (checked) => {
  $("#ignoreSearchPart").prop("disabled", checked);
  $("#ignoreHashPart").prop("disabled", checked);
};

const setDuplicateTabsTable = (duplicateTabs) => {
  if (areSameArrays(duplicateTabs, lastDuplicateTabs)) return;
  const isUpdate = panelInitialized;
  panelInitialized = true;
  lastDuplicateTabs = duplicateTabs ? Array.from(duplicateTabs) : null;
  $("#duplicateTabsTableBody").empty();
  if (duplicateTabs) {
    $("#duplicateTabsTableBody").append(buildDuplicateTabRows(duplicateTabs, activeWindowId));
    $("#closeDuplicateTabsBtn").toggleClass("disabled", false).attr("aria-disabled", "false");
  }
  else {
    $("#duplicateTabsTableBody").append(`<tr><td class='td-tab-text' colspan='3'><em>${chrome.i18n.getMessage("noDuplicateTabs")}.</em></td></tr>`);
    $("#closeDuplicateTabsBtn").toggleClass("disabled", true).attr("aria-disabled", "true");
  }
  resizeDuplicateTabsPanel(isUpdate);
};

const resizeDuplicateTabsPanel = (refresh) => {
  const maxOptionsCardHeight = 720.5;
  const minRow = 3;
  const rowHeight = 26;
  const nbRows = lastDuplicateTabs ? lastDuplicateTabs.length : 1;
  const maxRows = Math.min(nbRows, Math.floor((maxOptionsCardHeight - $("#optionsCard").height() + (minRow * rowHeight)) / rowHeight));
  $("#duplicateTabsTableContainer").toggleClass("table-scrollable-overflow", nbRows > maxRows);

  $("#duplicateTabsTableContainer").css("height", maxRows * rowHeight);
};

const saveActiveWindowId = async () => {
  activeWindowId = await getActiveWindowId();
};

const requestCloseDuplicateTabs = () => sendMessage("closeDuplicateTabs", { "windowId": activeWindowId });

const saveOption = (name, value, refresh) => sendMessage("setStoredOption", { "name": name, "value": value, "refresh": refresh });

const requestGetDuplicateTabs = () => sendMessage("getDuplicateTabs", { "windowId": activeWindowId });

const setPanelOption = (details) => {
  const storedOption = details.storedOption;
  const value = details.value;
  const resize = details.resize || false;
  const isLockedKey = details.isLockedKey || false;
  if (storedOption === "environment" && value === "chrome") {
    $(".containerItem").toggleClass("hidden", true);
  }
  else if (storedOption === "whiteList") {
    $("#whiteList").val(value);
    if (isLockedKey) $("#whiteList").prop("disabled", true);
  }
  else if (storedOption === "urlRegexRules" || storedOption === "titleRegexRules") {
    $(`#${storedOption}`).val(value);
    if (isLockedKey) $(`#${storedOption}`).prop("disabled", true);
  }
  else {
    if (typeof (value) === "boolean") {
      $(`#${storedOption}`).prop("checked", value);
      if (storedOption === "compareWithTitle") $("#titleSimilarityThreshold").prop("disabled", !value);
      else if (storedOption === "ignorePathPart") updateIgnorePathPartDependents(value);
    }
    else if (typeof (value) === "number") {
      $(`#${storedOption}`).val(value);
    }
    else if (value.startsWith("#")) {
      // badge color value
      $(`#${storedOption}`).prop("value", value);
    }
    else {
      $(`#${storedOption} option[value='${value}']`).prop("selected", true);
      if (storedOption === "onDuplicateTabDetected") changeAutoCloseOptionState(value, resize);
      else if (storedOption === "theme") applyTheme(value);
    }
    if (isLockedKey) $(`#${storedOption}`).prop("disabled", true);
  }
};

const setPanelOptions = async () => {
  const response = await sendMessage("getStoredOptions");
  const storedOptions = response.data.storedOptions;
  const lockedKeys = response.data.lockedKeys;
  for (const storedOption in storedOptions) {
    setPanelOption({ storedOption: storedOption, value: storedOptions[storedOption].value, isLockedKey: lockedKeys.includes(storedOption) });
  }
  updateIgnorePathPartDependents(storedOptions.ignorePathPart ? storedOptions.ignorePathPart.value : false);
};

const handleMessage = (message) => {
  if (message.action === "updateDuplicateTabsTable") setDuplicateTabsTable(message.data.duplicateTabs);
  if (message.action === "setStoredOption") setPanelOption({ storedOption: message.data.name, value: message.data.value, resize: true });
};

chrome.runtime.onMessage.addListener(handleMessage);

const handleDOMContentLoaded = () => {
  initialize();
  loadPopupEvents();
};

document.addEventListener("DOMContentLoaded", handleDOMContentLoaded);

const localizePopup = (node) => {
  const attribute = "i18n-content";
  const elements = node.querySelectorAll(`[${attribute}]`);
  elements.forEach(element => {
    const value = element.getAttribute(attribute);
    element.textContent = chrome.i18n.getMessage(value);
  });
};

let highlightBottomScrollShadowTimer = null;
const highlightBottomScrollShadow = () => {
  clearTimeout(highlightBottomScrollShadowTimer);
  $("#duplicateTabsTableContainer").toggleClass("highlight-scroll-bottom", true);
  highlightBottomScrollShadowTimer = setTimeout(() => $("#duplicateTabsTableContainer").toggleClass("highlight-scroll-bottom", false), 400);
};