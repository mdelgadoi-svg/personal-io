// Personal IO storage.
// For now everything is saved in this browser on this device.
// When Google is connected, goals and tasks will live in Google Tasks
// and blocks in Google Calendar, so phone and computer share them.

import { DEFAULT_SETTINGS } from './rules.js';

const KEY = 'personal-io:v1';

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
    days: {},  // 'YYYY-MM-DD' -> { intention, taskIds, slots, plan: { blocks, events, needsTime, didNotFit }, reviewed: {} }
    log: [],   // record of what was done or not, and why
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const data = JSON.parse(raw);
    return { ...emptyState(), ...data, settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) } };
  } catch {
    return emptyState();
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
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
  return { ...emptyState(), ...data, settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) } };
}
