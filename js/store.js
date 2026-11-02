// Personal IO storage.
// Saved in this browser right away. When Google is connected, one copy also lives in
// your Google Drive (a hidden app folder), so the computer and the phone see the same data.

import { DEFAULT_SETTINGS } from './rules.js';

const KEY = 'personal-io:v1';
const SYNC_KEY = 'personal-io:sync';         // { base, fileId, at }: the last version both sides had
const OTHER_KEY = 'personal-io:other-copy';  // the copy you did not pick when both sides changed
const BROKEN_KEY = 'personal-io:v1-unreadable';

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function emptyState() {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    goals: [
      { id: 'life', title: 'Keep life running', why: 'Errands and admin that keep everything else possible.', createdAt: new Date().toISOString() },
    ],
    tasks: [],
    events: [], // your own calendar: classes, meetings, appointments
    days: {},  // 'YYYY-MM-DD' -> { intention, taskIds, slots, plan: { blocks, events, needsTime, didNotFit }, reviewed: {} }
    log: [],   // record of what was done or not, and why
    journal: [], // notes you said or typed (welcome back and Talk it out)
    returns: [], // each time you came back after a day or more away
    lastOpenDate: null,
    savedAt: null, // when you last changed something (not housekeeping)
  };
}

// Fills in anything missing, so older data keeps working.
export function normalize(data) {
  return { ...emptyState(), ...data, settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) } };
}

export function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    return normalize(JSON.parse(raw));
  } catch {
    // Keep what could not be read instead of saving over it.
    try { if (raw) localStorage.setItem(BROKEN_KEY, raw); } catch { /* storage blocked */ }
    return emptyState();
  }
}

let onChange = null;
export function onSave(fn) { onChange = fn; }

// quiet: housekeeping the app does by itself (dates, rebuilt times). It does not count as a change
// to send to Drive, so opening the app on another device never looks like an edit.
export function save(state, { quiet = false } = {}) {
  if (!quiet) {
    // Always later than the last change, even if two happen in the same moment.
    const last = Date.parse(state.savedAt || '') || 0;
    state.savedAt = new Date(Math.max(Date.now(), last + 1)).toISOString();
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    return false;
  }
  if (!quiet && onChange) onChange();
  return true;
}

export function getSync() {
  try { return JSON.parse(localStorage.getItem(SYNC_KEY) || 'null') || {}; } catch { return {}; }
}
export function setSync(meta) {
  try { localStorage.setItem(SYNC_KEY, JSON.stringify(meta)); } catch { /* storage blocked */ }
}
export function keepOtherCopy(data) {
  try { localStorage.setItem(OTHER_KEY, typeof data === 'string' ? data : JSON.stringify(data)); } catch { /* too big or blocked */ }
}

export function exportBackup(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `personal-io-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function readBackup(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.goals) || !Array.isArray(data.tasks)) {
    throw new Error('That file is not a Personal IO backup.');
  }
  return normalize(data);
}
