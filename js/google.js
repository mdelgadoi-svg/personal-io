// Google Calendar and Google Drive connection.
// You sign in with Google in a pop-up; the app gets a short-lived pass
// (about one hour) that stays in this browser. Nothing goes through GitHub.
// The Client ID comes from your own Google Cloud project (Settings).
// Drive: only the app's own hidden folder (drive.appdata). It cannot see your other files.

const CLIENT_KEY = 'personal-io:google-client-id';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const CAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
// If your Google account blocks Drive for this app, the calendar still works on its own.
const NO_DRIVE_KEY = 'personal-io:calendar-only';
export function calendarOnly() { if (usingBridge()) return false; try { return localStorage.getItem(NO_DRIVE_KEY) === '1'; } catch { return false; } }

// ---------- Google bridge: a small script in your own Google account (bridge/Code.gs) ----------
// When it is set up, the calendar and your data go through it: no sign-in pop-up, no hourly reconnect.
const BRIDGE_KEY = 'personal-io:bridge';
export function getBridge() {
  try { const b = JSON.parse(localStorage.getItem(BRIDGE_KEY) || 'null'); return b && b.url && b.key ? b : null; } catch { return null; }
}
export function setBridge(b) {
  try { if (b) localStorage.setItem(BRIDGE_KEY, JSON.stringify(b)); else localStorage.removeItem(BRIDGE_KEY); } catch { /* storage blocked */ }
  cache.clear();
}
export function usingBridge() { return !!getBridge(); }
// Personal accounts: /macros/s/<id>/exec. Berkeley (Workspace): /a/macros/berkeley.edu/s/<id>/exec.
export function looksLikeBridge(url) { return /^https:\/\/script\.google\.com\/(a\/macros\/[^/]+|a\/[^/]+\/macros|macros)\/s\/[\w-]+\/exec$/.test(String(url || '').trim()); }

async function bridge(action, payload = {}) {
  const b = getBridge();
  if (!b) throw new Error('not-connected');
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 30000);
  let res;
  try {
    // Plain text body: the browser sends it without an extra permission check, which Apps Script needs.
    res = await fetch(b.url, { method: 'POST', body: JSON.stringify({ key: b.key, action, ...payload }), signal: stop.signal });
  } catch (err) {
    throw new Error(err.name === 'AbortError' ? 'Your Google bridge did not answer. Try again' : 'Could not reach your Google bridge. Check your internet');
  } finally {
    clearTimeout(timer);
  }
  let out;
  try { out = await res.json(); } catch { throw new Error('Your Google bridge did not answer correctly. Check the setup in Settings'); }
  if (out.error === 'key') throw new Error('The bridge key does not match. Set up the bridge again in Settings');
  if (out.error && /Calendar is not defined/.test(out.error)) throw new Error('Add the Google Calendar API service to your script (Services +)');
  if (out.error) throw new Error(out.error);
  return out;
}

// Checks the bridge answers and learns which account it runs as.
export async function pingBridge() {
  const out = await bridge('ping');
  const b = getBridge();
  setBridge({ ...b, account: out.account || '' });
  return out.account || '';
}
export function setCalendarOnly(on) { try { if (on) localStorage.setItem(NO_DRIVE_KEY, '1'); else localStorage.removeItem(NO_DRIVE_KEY); } catch { /* storage blocked */ } }
const scopes = () => (calendarOnly() ? CAL_SCOPE : `${CAL_SCOPE} ${DRIVE_SCOPE}`);
const CAL_KEY = 'personal-io:google-calendar-id';

// Which calendar to use: blank means the signed-in account's main calendar.
// Set it to another address (like a Berkeley calendar shared with you) to use that one.
export function getCalendarId() {
  try { return localStorage.getItem(CAL_KEY) || ''; } catch { return ''; }
}
export function setCalendarId(id) {
  try { if (id) localStorage.setItem(CAL_KEY, id.trim()); else localStorage.removeItem(CAL_KEY); } catch { /* storage blocked */ }
  cache.clear();
  stored = {};
  keepStored();
}
function apiBase() {
  return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(getCalendarId() || 'primary')}/events`;
}

// The sign-in lasts about an hour; keep it for that hour so a reload does not ask again.
const TOKEN_KEY = 'personal-io:google-session';
let token = null;
let tokenExpires = 0;
let driveOk = null; // true, false (not allowed at sign-in) or null (not known yet)
try {
  const saved = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
  if (saved && saved.exp > Date.now()) { token = saved.token; tokenExpires = saved.exp; driveOk = saved.drive ?? null; }
} catch { /* nothing saved */ }
function keepToken() {
  try { localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, exp: tokenExpires, as: connectedAs, drive: driveOk })); } catch { /* storage blocked */ }
}
const listeners = [];
export function onConnect(fn) { listeners.push(fn); }
let tokenClient = null;
let connectedAs = (() => { try { return JSON.parse(localStorage.getItem('personal-io:google-session') || 'null')?.as || ''; } catch { return ''; } })();
let gisLoading = null;
const cache = new Map(); // dateKey -> events fetched since this page opened

// The last events seen for each day, kept so the calendar still shows them after the hour is up.
const STORED_KEY = 'personal-io:google-events';
let stored = (() => { try { return JSON.parse(localStorage.getItem(STORED_KEY) || '{}') || {}; } catch { return {}; } })();
function keepStored() {
  const from = new Date(Date.now() - 2 * 86400000);
  const cut = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
  Object.keys(stored).forEach((k) => { if (k < cut) delete stored[k]; });
  try { localStorage.setItem(STORED_KEY, JSON.stringify(stored)); } catch { /* too big or blocked */ }
}

export function getClientId() {
  try { return localStorage.getItem(CLIENT_KEY) || ''; } catch { return ''; }
}
export function setClientId(id) {
  try {
    if (id) localStorage.setItem(CLIENT_KEY, id.trim()); else localStorage.removeItem(CLIENT_KEY);
  } catch { /* storage blocked */ }
  tokenClient = null;
}
export function isConfigured() { return usingBridge() || getClientId().endsWith('.apps.googleusercontent.com'); }
export function isConnected() { return usingBridge() || (!!token && Date.now() < tokenExpires); }
export function connectedName() { return usingBridge() ? getBridge().account || '' : isConnected() ? connectedAs : ''; }
export function lastAccount() { return usingBridge() ? getBridge().account || '' : connectedAs; }
export function driveAllowed() { return usingBridge() || (driveOk !== false && !calendarOnly()); }

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
// quick: reconnect the same account without the account picker (after the hour is up).
export async function connect({ quick = false } = {}) {
  if (usingBridge()) { await pingBridge(); listeners.forEach((fn) => fn()); return; }
  if (!isConfigured()) throw new Error('Add your Google Client ID in Settings first.');
  await loadGis();
  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: getClientId(),
      scope: scopes(),
      callback: (resp) => {
        if (resp.error) { reject(new Error('Google sign-in was not completed.')); return; }
        token = resp.access_token;
        tokenExpires = Date.now() + (Number(resp.expires_in) - 60) * 1000;
        const oauth = window.google.accounts.oauth2;
        driveOk = calendarOnly() ? false : typeof oauth.hasGrantedAllScopes === 'function' ? !!oauth.hasGrantedAllScopes(resp, DRIVE_SCOPE) : null;
        keepToken();
        cache.clear();
        // Ask which calendar this is, so the app can show "Connected to: ...".
        fetch(`${apiBase()}?maxResults=1`, { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => { connectedAs = d && d.summary ? d.summary : ''; })
          .catch(() => { connectedAs = ''; })
          .finally(() => { keepToken(); resolve(); listeners.forEach((fn) => fn()); });
      },
      error_callback: () => reject(new Error('Google sign-in was closed.')),
    });
    // The first time, pick the account (Berkeley or personal). After that, one tap reconnects the same one.
    // (With a shared calendar, the name shown is that calendar's, not the account, so no hint then.)
    const hint = quick && connectedAs.includes('@') && !getCalendarId() ? { login_hint: connectedAs } : {};
    tokenClient.requestAccessToken(quick && connectedAs ? { prompt: '', ...hint } : { prompt: 'select_account' });
  });
}

async function call(url, options = {}) {
  if (!isConnected()) throw new Error('not-connected');
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (res.status === 401) { token = null; try { localStorage.removeItem(TOKEN_KEY); } catch { /* fine */ } throw new Error('not-connected'); }
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
  let items;
  if (usingBridge()) {
    items = (await bridge('events', { timeMin: start.toISOString(), timeMax: end.toISOString(), calendarId: getCalendarId() || undefined })).items;
  } else {
    const params = new URLSearchParams({
      timeMin: start.toISOString(), timeMax: end.toISOString(),
      singleEvents: 'true', orderBy: 'startTime', maxResults: '100',
    });
    items = (await call(`${apiBase()}?${params}`)).items;
  }
  return keepDay(dateKey, mapDay(items || [], start, end));
}

function keepDay(dateKey, events) {
  cache.set(dateKey, events);
  stored[dateKey] = events;
  keepStored();
  return events;
}

// Google's events for one day, in the app's shape.
function mapDay(items, start, end) {
  return items.filter((e) => e.status !== 'cancelled').filter((e) => {
    // Only what touches this day (the bridge can send several days at once).
    const s = e.start?.dateTime ? new Date(e.start.dateTime) : new Date(`${e.start?.date}T00:00:00`);
    const f = e.end?.dateTime ? new Date(e.end.dateTime) : new Date(`${e.end?.date}T00:00:00`);
    return s < end && f > start;
  }).map((e) => {
    if (e.start?.date) return { id: e.id, title: e.summary || '(no title)', allDay: true };
    const s = new Date(e.start.dateTime);
    const f = new Date(e.end.dateTime);
    // A day or longer (like a multi-day deadline window): show it as all-day, like Google does.
    if (f - s >= 24 * 3600000) return { id: e.id, title: e.summary || '(no title)', allDay: true };
    // Wall-clock minutes, so days when the clock changes still line up.
    const startMin = s < start ? 0 : s.getHours() * 60 + s.getMinutes();
    const endMin = f >= end ? 24 * 60 : f.getHours() * 60 + f.getMinutes();
    const hasVideo = !!(e.hangoutLink || (e.location || '').includes('zoom') || (e.description || '').includes('zoom.us'));
    return {
      id: e.id,
      title: e.summary || '(no title)',
      start: `${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(Math.round(startMin % 60)).padStart(2, '0')}`,
      minutes: Math.max(15, Math.round(endMin - startMin)),
      allDay: false,
      online: hasVideo,
      color: e.colorId || null,
      fromApp: e.extendedProperties?.private?.personalIo === '1',
    };
  });
}

// What was last seen for a day, without asking Google again (null if never fetched).
// After the sign-in hour this is the copy kept from the last time.
export function cachedDay(dateKey) { return cache.get(dateKey) || stored[dateKey] || null; }
// Only what was fetched since this page opened.
export function freshDay(dateKey) { return cache.get(dateKey) || null; }

// Timed events for several days, each with its date: [{ date, id, title, start, minutes, ... }].
// Skips all-day items and the blocks this app wrote.
export async function eventsAhead(startKey, days) {
  const keys = Array.from({ length: days }, (_, i) => {
    const [y, m, d] = startKey.split('-').map(Number);
    const dt = new Date(y, m - 1, d + i);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  });
  let lists;
  if (usingBridge()) {
    // One call for the whole range: the bridge is slower per call than Google itself.
    const first = dayRange(keys[0]).start;
    const last = dayRange(keys[keys.length - 1]).end;
    const items = (await bridge('events', { timeMin: first.toISOString(), timeMax: last.toISOString(), calendarId: getCalendarId() || undefined })).items || [];
    lists = keys.map((k) => { const { start, end } = dayRange(k); return keepDay(k, mapDay(items, start, end)); });
  } else {
    lists = await Promise.all(keys.map((k) => eventsForDay(k)));
  }
  return lists.flatMap((list, i) => list.filter((e) => !e.allDay && !e.fromApp).map((e) => ({ ...e, date: keys[i] })));
}

// Google Calendar colors: 9 Blueberry, 10 Basil, 5 Banana, 3 Grape.
const COLOR_ID = { blue: '9', green: '10', yellow: '5', commute: '3' };

function toIso(dateKey, hhmm, addMinutes = 0) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [h, min] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, h, min + addMinutes).toISOString();
}

function eventBody(dateKey, it) {
  return {
    summary: it.title,
    description: it.description || '',
    start: { dateTime: toIso(dateKey, it.start) },
    end: { dateTime: toIso(dateKey, it.start, it.minutes) },
    colorId: COLOR_ID[it.color] || COLOR_ID.green,
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] },
    extendedProperties: { private: { personalIo: '1' } },
  };
}

// Writes the day's plan to Google Calendar, replacing what the app wrote before.
// items: [{ title, start, minutes, color, description }]
export async function writeDay(dateKey, items, previousIds = []) {
  if (usingBridge()) {
    const out = await bridge('writeDay', { calendarId: getCalendarId() || undefined, deleteIds: previousIds, bodies: items.map((it) => eventBody(dateKey, it)) });
    cache.delete(dateKey);
    return out.ids || [];
  }
  for (const id of previousIds) {
    try { await call(`${apiBase()}/${encodeURIComponent(id)}`, { method: 'DELETE' }); } catch { /* already gone */ }
  }
  const ids = [];
  for (const it of items) {
    const created = await call(apiBase(), { method: 'POST', body: JSON.stringify(eventBody(dateKey, it)) });
    ids.push(created.id);
  }
  cache.delete(dateKey);
  return ids;
}

// ---------- Google Drive: one copy of your data ----------
// A single file in the app's hidden Drive folder. Same sign-in as the calendar.

const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FILE_NAME = 'personal-io-data.json';

async function drive(url, options = {}) {
  if (!isConnected()) throw new Error('not-connected');
  // Never wait forever (a phone can pause the page mid-request).
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 20000);
  let res;
  try {
    res = await fetch(url, { ...options, signal: stop.signal, headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
  } catch (err) {
    throw new Error(err.name === 'AbortError' ? 'drive-slow' : 'Check your internet');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401) { token = null; try { localStorage.removeItem(TOKEN_KEY); } catch { /* fine */ } throw new Error('not-connected'); }
  if (res.status === 403) {
    let msg = '';
    try { msg = (await res.json())?.error?.message || ''; } catch { /* ignore */ }
    if (/has not been used|is disabled/i.test(msg)) throw new Error('drive-off');
    if (/rate|quota|limit/i.test(msg)) throw new Error('Google Drive is busy. Try again in a minute');
    driveOk = false;
    keepToken();
    throw new Error('drive-not-allowed');
  }
  if (res.status === 404) throw new Error('drive-missing');
  if (!res.ok) throw new Error(`Google Drive said no (${res.status}).`);
  return res;
}

// The Drive copy's id and when it was saved, or null if there is none yet.
export async function driveInfo() {
  if (usingBridge()) {
    const out = await bridge('info');
    return out.savedAt ? { id: 'bridge', savedAt: out.savedAt } : null;
  }
  const q = encodeURIComponent(`name='${FILE_NAME}'`);
  const res = await drive(`${DRIVE}?spaces=appDataFolder&q=${q}&orderBy=modifiedTime%20desc&fields=files(id,modifiedTime,appProperties)`);
  const f = ((await res.json()).files || [])[0];
  driveOk = true;
  return f ? { id: f.id, savedAt: f.appProperties?.savedAt || f.modifiedTime } : null;
}

export async function driveRead(id) {
  if (usingBridge()) {
    const out = await bridge('read');
    return out.text ? JSON.parse(out.text) : null;
  }
  const res = await drive(`${DRIVE}/${encodeURIComponent(id)}?alt=media`);
  return JSON.parse(await res.text());
}

// Saves the text as the Drive copy. Returns the file id.
// expect: when the Drive copy was saved as this device last saw it; the bridge refuses if it changed since.
export async function driveWrite(id, text, savedAt, expect = null) {
  if (usingBridge()) {
    const out = await bridge('write', { text, savedAt, expect });
    if (out.conflict) throw new Error('conflict');
    return 'bridge';
  }
  const b = `pio${Math.random().toString(36).slice(2)}`;
  const meta = id ? { appProperties: { savedAt } } : { name: FILE_NAME, parents: ['appDataFolder'], appProperties: { savedAt } };
  const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${text}\r\n--${b}--`;
  const url = id ? `${UPLOAD}/${encodeURIComponent(id)}?uploadType=multipart&fields=id` : `${UPLOAD}?uploadType=multipart&fields=id`;
  try {
    const res = await drive(url, { method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${b}` }, body });
    return (await res.json()).id;
  } catch (err) {
    if (err.message === 'drive-missing' && id) return driveWrite(null, text, savedAt); // the file was removed; make a new one
    throw err;
  }
}

// ---------- Gmail (read only, on request) ----------
// Separate from the calendar sign-in, and only when you click "Read my last 2 weeks".
// Reads subject, sender, date and Google's short preview. Never full emails, never attachments.

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
let gmailToken = null;
let gmailExpires = 0;

export function gmailConnected() { return !!gmailToken && Date.now() < gmailExpires; }

export function gmailReady() { return getClientId().endsWith('.apps.googleusercontent.com'); }
export async function connectGmail() {
  if (!gmailReady()) throw new Error('Reading email needs the Client ID (Settings > Google > Other way).');
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: getClientId(),
      scope: GMAIL_SCOPE,
      callback: (resp) => {
        if (resp.error) { reject(new Error('Gmail sign-in was not completed.')); return; }
        gmailToken = resp.access_token;
        gmailExpires = Date.now() + (Number(resp.expires_in) - 60) * 1000;
        resolve();
      },
      error_callback: () => reject(new Error('Gmail sign-in was closed.')),
    });
    client.requestAccessToken({ prompt: 'select_account' });
  });
}

async function gmail(path) {
  if (!gmailConnected()) throw new Error('not-connected');
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { headers: { Authorization: `Bearer ${gmailToken}` } });
  if (res.status === 401) { gmailToken = null; throw new Error('not-connected'); }
  if (res.status === 403) {
    let msg = '';
    try { msg = (await res.json())?.error?.message || ''; } catch { /* ignore */ }
    if (/has not been used|is disabled/i.test(msg)) throw new Error('The Gmail API is off in your Google Cloud project. Turn it on: APIs & Services > Library > Gmail API > Enable.');
    throw new Error('Google did not allow reading this mailbox. Your school account may block it; try your personal Gmail.');
  }
  if (!res.ok) throw new Error(`Gmail said no (${res.status}).`);
  return res.json();
}

// The last `days` days of mail you received or sent (no promotions or social), newest first.
export async function recentEmails(days = 14, max = 40) {
  const q = encodeURIComponent(`newer_than:${days}d -category:promotions -category:social -category:forums`);
  const list = await gmail(`messages?maxResults=${max}&q=${q}`);
  const ids = (list.messages || []).map((m) => m.id);
  const out = [];
  for (let i = 0; i < ids.length; i += 10) {
    const batch = await Promise.all(ids.slice(i, i + 10).map((id) =>
      gmail(`messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`).catch(() => null)));
    batch.filter(Boolean).forEach((m) => {
      const h = (name) => (m.payload?.headers || []).find((x) => x.name.toLowerCase() === name)?.value || '';
      out.push({
        subject: h('subject') || '(no subject)',
        from: h('from').replace(/<.*>/, '').trim(),
        date: h('date').slice(0, 16),
        snippet: (m.snippet || '').slice(0, 220),
        sent: (m.labelIds || []).includes('SENT'),
      });
    });
  }
  return out;
}
