// Google Calendar connection.
// You sign in with Google in a pop-up; the app gets a short-lived pass
// (about one hour) that stays in this browser tab. Nothing goes through GitHub.
// The Client ID comes from your own Google Cloud project (Settings).

const CLIENT_KEY = 'personal-io:google-client-id';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';
const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

let token = null;
let tokenExpires = 0;
let tokenClient = null;
let gisLoading = null;
const cache = new Map(); // dateKey -> events

export function getClientId() {
  try { return localStorage.getItem(CLIENT_KEY) || ''; } catch { return ''; }
}
export function setClientId(id) {
  try {
    if (id) localStorage.setItem(CLIENT_KEY, id.trim()); else localStorage.removeItem(CLIENT_KEY);
  } catch { /* storage blocked */ }
  tokenClient = null;
}
export function isConfigured() { return getClientId().endsWith('.apps.googleusercontent.com'); }
export function isConnected() { return !!token && Date.now() < tokenExpires; }

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoading) return gisLoading;
  gisLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { gisLoading = null; reject(new Error('Could not reach Google. Check your internet.')); };
    document.head.appendChild(s);
  });
  return gisLoading;
}

// Opens the Google pop-up. Must be called from a click.
export async function connect() {
  if (!isConfigured()) throw new Error('Add your Google Client ID in Settings first.');
  await loadGis();
  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: getClientId(),
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error) { reject(new Error('Google sign-in was not completed.')); return; }
        token = resp.access_token;
        tokenExpires = Date.now() + (Number(resp.expires_in) - 60) * 1000;
        cache.clear();
        resolve();
      },
      error_callback: () => reject(new Error('Google sign-in was closed.')),
    });
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

async function call(url, options = {}) {
  if (!isConnected()) throw new Error('not-connected');
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (res.status === 401) { token = null; throw new Error('not-connected'); }
  if (!res.ok) throw new Error(`Google Calendar said no (${res.status}).`);
  return res.status === 204 ? null : res.json();
}

function dayRange(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0);
  return { start, end };
}

// Events for one day, as { title, start: 'HH:MM', minutes, allDay, link, fromApp }.
export async function eventsForDay(dateKey, { fresh = false } = {}) {
  if (!fresh && cache.has(dateKey)) return cache.get(dateKey);
  const { start, end } = dayRange(dateKey);
  const params = new URLSearchParams({
    timeMin: start.toISOString(), timeMax: end.toISOString(),
    singleEvents: 'true', orderBy: 'startTime', maxResults: '100',
  });
  const data = await call(`${API}?${params}`);
  const events = (data.items || []).filter((e) => e.status !== 'cancelled').map((e) => {
    if (e.start?.date) return { id: e.id, title: e.summary || '(no title)', allDay: true };
    const s = new Date(e.start.dateTime);
    const f = new Date(e.end.dateTime);
    const startMin = Math.max(0, (s - start) / 60000);
    const endMin = Math.min(24 * 60, (f - start) / 60000);
    const hasVideo = !!(e.hangoutLink || (e.location || '').includes('zoom') || (e.description || '').includes('zoom.us'));
    return {
      id: e.id,
      title: e.summary || '(no title)',
      start: `${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(Math.round(startMin % 60)).padStart(2, '0')}`,
      minutes: Math.max(15, Math.round(endMin - startMin)),
      allDay: false,
      online: hasVideo,
      fromApp: e.extendedProperties?.private?.personalIo === '1',
    };
  });
  cache.set(dateKey, events);
  return events;
}

// Google Calendar colors: 9 Blueberry, 10 Basil, 5 Banana, 3 Grape.
const COLOR_ID = { blue: '9', green: '10', yellow: '5', commute: '3' };

function toIso(dateKey, hhmm, addMinutes = 0) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [h, min] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, h, min + addMinutes).toISOString();
}

// Writes the day's plan to Google Calendar, replacing what the app wrote before.
// items: [{ title, start, minutes, color, description }]
export async function writeDay(dateKey, items, previousIds = []) {
  for (const id of previousIds) {
    try { await call(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE' }); } catch { /* already gone */ }
  }
  const ids = [];
  for (const it of items) {
    const body = {
      summary: it.title,
      description: it.description || '',
      start: { dateTime: toIso(dateKey, it.start) },
      end: { dateTime: toIso(dateKey, it.start, it.minutes) },
      colorId: COLOR_ID[it.color] || COLOR_ID.green,
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] },
      extendedProperties: { private: { personalIo: '1' } },
    };
    const created = await call(API, { method: 'POST', body: JSON.stringify(body) });
    ids.push(created.id);
  }
  cache.delete(dateKey);
  return ids;
}
