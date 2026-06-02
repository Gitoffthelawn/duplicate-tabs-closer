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
  const sessionData = await chrome.storage.session.get('monitoringPaused');
  applyPausedState(sessionData.monitoringPaused || false);
};

const applyPausedState = (paused) => {
  const sel = document.getElementById("onDuplicateTabDetected");
  if (sel) sel.disabled = paused;
  const btn = document.getElementById("pauseMonitorBtn");
  if (!btn) return;
  const icon = btn.querySelector("span");
  if (paused) {
    icon.className = "fa-solid fa-play fa-lg";
    btn.setAttribute("aria-label", chrome.i18n.getMessage("resumeMonitoring"));
  } else {
    icon.className = "fa-solid fa-pause fa-lg";
    btn.setAttribute("aria-label", chrome.i18n.getMessage("pauseMonitoring"));
  }
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
  getElements(".list-group input[type='checkbox']").forEach(el => el.addEventListener("change", function () {
    if (this.id.endsWith("_popup")) {
      saveOption(this.id, this.checked, false);
      return;
    }
    if (this.id === "compareWithTitle") {
      const thresh = document.getElementById("titleSimilarityThreshold");
      if (thresh) thresh.disabled = !this.checked;
    }
    else if (this.id === "ignorePathPart") updateIgnorePathPartDependents(this.checked);
    const refresh = this.className.includes("checkbox-filter");
    saveOption(this.id, this.checked, refresh);
  }));

  /* Save combobox settings */
  getElements(".list-group select").forEach(el => el.addEventListener("change", function (event) {
    event.stopPropagation();
    const refresh = this.id === "scope";
    saveOption(this.id, this.value, refresh);
    if (this.id === "onDuplicateTabDetected") changeAutoCloseOptionState(this.value, true);
    else if (this.id === "theme") applyTheme(this.value);
  }));

  /* Save badge color settings */
  getElements(".list-group input[type='color']").forEach(el => el.addEventListener("change", function () {
    saveOption(this.id, this.value);
  }));

  /* Save title similarity threshold */
  const threshEl = getElement(".list-group #titleSimilarityThreshold");
  if (threshEl) threshEl.addEventListener("change", function () {
    const val = Math.min(100, Math.max(1, parseInt(this.value) || 100));
    this.value = val;
    saveOption("titleSimilarityThreshold", val, true);
  });

  /* Save whiteList settings */
  const whiteListEl = document.getElementById("whiteList");
  if (whiteListEl) whiteListEl.addEventListener("change", function () {
    const whiteList = cleanUpWhiteList(this.value);
    setWhiteList(whiteList);
    saveOption(this.id, whiteList, false);
  });

  /* Save URL/title pattern rules */
  const applyLineHighlight = (textarea) => {
    const { top, bottom } = getHighlightBounds(textarea);
    const s = textarea.scrollTop;
    textarea.style.backgroundImage = `linear-gradient(transparent ${top - s}px, rgba(0, 0, 0, 0.075) ${top - s}px, rgba(0, 0, 0, 0.075) ${bottom - s}px, transparent ${bottom - s}px)`;
  };

  ["urlRegexRules", "titleRegexRules"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", function () {
      const cleaned = cleanUpWhiteList(this.value);
      this.value = cleaned;
      saveOption(this.id, cleaned, true);
    });
    ["keyup", "click", "select", "focus", "scroll"].forEach(ev =>
      el.addEventListener(ev, function () { applyLineHighlight(this); })
    );
    el.addEventListener("blur", function () { this.style.backgroundImage = ""; });
  });

  if (whiteListEl) {
    ["keyup", "click", "select", "focus", "scroll"].forEach(ev =>
      whiteListEl.addEventListener(ev, function () { applyLineHighlight(this); })
    );
    whiteListEl.addEventListener("blur", function () { this.style.backgroundImage = ""; });
  }

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

  /* Pause/resume monitoring */
  const pauseBtn = document.getElementById("pauseMonitorBtn");
  if (pauseBtn) pauseBtn.addEventListener("click", () => {
    sendMessage("toggleMonitorPause").then(resp => {
      if (resp) applyPausedState(resp.paused);
    });
  });

  /* Close all */
  const closeBtn = document.getElementById("closeDuplicateTabsBtn");
  if (closeBtn) closeBtn.addEventListener("click", function () {
    if (!this.classList.contains("disabled")) requestCloseDuplicateTabs();
  });

};

const setWhiteList = (whiteList) => {
  const el = document.getElementById("whiteList");
  if (el) el.value = whiteList;
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
  document.getElementById("onRemainingTabGroup").classList.toggle("hidden", state !== "A");
  document.getElementById("whiteListGroup").classList.toggle("hidden", state !== "A");
  if (resize) resizeDuplicateTabsPanel();
};

const updateIgnorePathPartDependents = (checked) => {
  document.getElementById("ignoreSearchPart").disabled = checked;
  document.getElementById("ignoreHashPart").disabled = checked;
};

const setDuplicateTabsTable = (duplicateTabs) => {
  if (duplicateTabs !== null && areSameArrays(duplicateTabs, lastDuplicateTabs)) return;
  const isUpdate = panelInitialized;
  panelInitialized = true;
  lastDuplicateTabs = duplicateTabs ? Array.from(duplicateTabs) : null;
  const tbody = document.getElementById("duplicateTabsTableBody");
  tbody.replaceChildren();
  const closeBtn = document.getElementById("closeDuplicateTabsBtn");
  if (duplicateTabs) {
    tbody.appendChild(buildDuplicateTabRows(duplicateTabs, activeWindowId));
    closeBtn.classList.toggle("disabled", false);
    closeBtn.setAttribute("aria-disabled", "false");
  }
  else {
    chrome.storage.session.get('monitoringPaused').then(data => {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.className = "td-tab-text";
      td.colSpan = 3;
      const em = document.createElement("em");
      em.textContent = data.monitoringPaused
        ? chrome.i18n.getMessage("monitoringPaused")
        : chrome.i18n.getMessage("noDuplicateTabs") + ".";
      td.appendChild(em);
      tr.appendChild(td);
      tbody.appendChild(tr);
      resizeDuplicateTabsPanel(isUpdate);
    });
    closeBtn.classList.toggle("disabled", true);
    closeBtn.setAttribute("aria-disabled", "true");
  }
  if (duplicateTabs) resizeDuplicateTabsPanel(isUpdate);
};

const resizeDuplicateTabsPanel = (refresh) => {
  const maxOptionsCardHeight = 720.5;
  const minRow = 3;
  const rowHeight = 26;
  const nbRows = lastDuplicateTabs ? lastDuplicateTabs.length : 1;
  const maxRows = Math.min(nbRows, Math.floor((maxOptionsCardHeight - document.getElementById("optionsCard").offsetHeight + (minRow * rowHeight)) / rowHeight));
  const container = document.getElementById("duplicateTabsTableContainer");
  container.classList.toggle("table-scrollable-overflow", nbRows > maxRows);
  if (maxRows > 0) container.style.height = `${maxRows * rowHeight}px`;
  else container.style.height = "";
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
    getElements(".containerItem").forEach(el => el.classList.toggle("hidden", true));
  }
  else if (storedOption === "whiteList") {
    const el = document.getElementById("whiteList");
    if (el) { el.value = value; if (isLockedKey) el.disabled = true; }
  }
  else if (storedOption === "urlRegexRules" || storedOption === "titleRegexRules") {
    const el = document.getElementById(storedOption);
    if (el) { el.value = value; if (isLockedKey) el.disabled = true; }
  }
  else {
    const el = document.getElementById(storedOption);
    if (typeof (value) === "boolean") {
      if (el) el.checked = value;
      if (storedOption === "compareWithTitle") {
        const thresh = document.getElementById("titleSimilarityThreshold");
        if (thresh) thresh.disabled = !value;
      }
      else if (storedOption === "ignorePathPart") updateIgnorePathPartDependents(value);
    }
    else if (typeof (value) === "number") {
      if (el) el.value = value;
    }
    else if (typeof value === "string" && value.startsWith("#")) {
      if (el) el.value = value;
    }
    else {
      const opt = getElement(`#${storedOption} option[value='${value}']`);
      if (opt) opt.selected = true;
      if (storedOption === "onDuplicateTabDetected") changeAutoCloseOptionState(value, resize);
      else if (storedOption === "theme") applyTheme(value);
    }
    if (isLockedKey && el) el.disabled = true;
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
  const container = document.getElementById("duplicateTabsTableContainer");
  container.classList.toggle("highlight-scroll-bottom", true);
  highlightBottomScrollShadowTimer = setTimeout(() => container.classList.toggle("highlight-scroll-bottom", false), 400);
};
