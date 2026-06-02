"use strict";

let _dtcSeq = 0;
const _dtcLogBuffer = [];
const DTC_LOG_BUFFER_SIZE = 2000;

// eslint-disable-next-line no-unused-vars
const dtcLog = (component, event, payload = {}) => {
    _dtcSeq++;
    const { flow = null, tabId = null, windowId = null, url = null, ...rest } = payload;
    const entry = { ts: Date.now(), seq: _dtcSeq, flow, component, event, tabId, windowId, url, ...rest };
    _dtcLogBuffer.push(entry);
    if (_dtcLogBuffer.length > DTC_LOG_BUFFER_SIZE) _dtcLogBuffer.shift();
    console.log(`[dtc:${component}:${event}]`, entry);
};

// eslint-disable-next-line no-unused-vars
const getDtcLogs = (since = 0) => _dtcLogBuffer.filter(e => e.seq > since);

// eslint-disable-next-line no-unused-vars
const clearDtcLogs = () => { _dtcLogBuffer.length = 0; };
