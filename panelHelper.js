"use strict";

// eslint-disable-next-line no-unused-vars
const applyTheme = (value) => {
    const darkThemes = ["ocean", "charcoal", "purple", "teal", "oled"];
    const lightThemes = ["sage", "rose", "amber", "slate", "violet"];
    const isDark = darkThemes.includes(value);
    document.documentElement.setAttribute("data-bs-theme", isDark ? "dark" : "light");
    document.documentElement.classList.remove(...[...darkThemes, ...lightThemes].map(t => `theme-${t}`));
    if (value !== "light") document.documentElement.classList.add(`theme-${value}`);
};

// eslint-disable-next-line no-unused-vars
const updateIgnorePathPartDependents = (checked) => {
    document.getElementById("ignoreSearchPart").disabled = checked;
    document.getElementById("ignoreHashPart").disabled = checked;
};

// eslint-disable-next-line no-unused-vars
const updateGroupButton = (grouped) => {
    const btn = document.getElementById("groupDuplicateTabsBtn");
    if (!btn) return;
    btn.classList.toggle("active", grouped);
    btn.setAttribute("aria-pressed", String(grouped));
};

let highlightBottomScrollShadowTimer = null;
// eslint-disable-next-line no-unused-vars
const highlightBottomScrollShadow = () => {
    clearTimeout(highlightBottomScrollShadowTimer);
    const container = document.getElementById("duplicateTabsTableContainer");
    if (!container.classList.contains("table-scrollable-overflow")) return;
    container.classList.toggle("highlight-scroll-bottom", true);
    highlightBottomScrollShadowTimer = setTimeout(() => container.classList.toggle("highlight-scroll-bottom", false), 400);
};

// eslint-disable-next-line no-unused-vars
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

// eslint-disable-next-line no-unused-vars
const saveActiveWindowId = async () => {
    activeWindowId = await getActiveWindowId();
};

// eslint-disable-next-line no-unused-vars
const requestCloseDuplicateTabs = () => sendMessage("closeDuplicateTabs", { "windowId": activeWindowId });

// eslint-disable-next-line no-unused-vars
const saveOption = (name, value, refresh) => sendMessage("setStoredOption", { "name": name, "value": value, "refresh": refresh });

// eslint-disable-next-line no-unused-vars
const requestGetDuplicateTabs = () => sendMessage("getDuplicateTabs", { "windowId": activeWindowId });
