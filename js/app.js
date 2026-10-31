// Personal IO: screens and interactions.
// The rules live in rules.js, saving in store.js, Claude in ai.js, Google in google.js.

import * as R from './rules.js';
import { load, save, newId, exportBackup, readBackup } from './store.js';
import * as AI from './ai.js';
import * as G from './google.js';

let state = load();
const ui = { planDay: null, goalFilter: null, showDone: false, open: { both: true, urgent: true, important: false, nice: false } };
let afterRender = [];

const view = document.getElementById('view');
const modal = document.getElementById('modal');
const toasts = document.getElementById('toasts');

// ---------- small helpers ----------

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayKey = () => R.toDateKey(new Date());
const tomorrowKey = () => R.addDays(todayKey(), 1);
const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const fmtDay = (key, opts = { weekday: 'short', month: 'short', day: 'numeric' }) =>
  new Intl.DateTimeFormat('en-US', opts).format(R.parseDateKey(key));
const longDay = (key) => fmtDay(key, { weekday: 'long', month: 'long', day: 'numeric' });
const S = () => state.settings;

function persist(messages = []) {
  if (!save(state)) toast('Could not save on this device. Download a backup from Settings.');
  render();
  messages.forEach(toast);
}

function toast(text, button = null) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  if (button) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'toast-btn';
    b.textContent = button.label;
    Object.entries(button.data || {}).forEach(([k, v]) => { b.dataset[k] = v; });
    b.addEventListener('click', () => el.remove());
    el.appendChild(b);
  }
  toasts.appendChild(el);
  while (toasts.children.length > 2) toasts.firstElementChild.remove();
  setTimeout(() => el.remove(), button ? 8000 : 4000);
}

function goal(id) { return state.goals.find((g) => g.id === id); }
function task(id) { return state.tasks.find((t) => t.id === id); }
function stepsOf(t) { return t.firstSteps && t.firstSteps.length ? t.firstSteps : (t.firstStep ? [t.firstStep] : []); }

function getDay(key) {
  if (!state.days[key]) {
    state.days[key] = { intention: '', taskIds: [], slots: S().daySlots, plan: null, planStale: false, set: false, reviewed: {}, googleIds: [] };
  }
  return state.days[key];
}

function markHTML(priority) {
  switch (priority) {
    case 'both': return '<span class="mark" aria-label="Important and urgent"><span class="s">★</span><span class="b">!</span></span>';
    case 'important': return '<span class="mark" aria-label="Important"><span class="s">★</span></span>';
    case 'urgent': return '<span class="mark" aria-label="Urgent"><span class="b">!</span></span>';
    default: return '<span class="mark" aria-label="Tasks for later">🤔</span>';
  }
}

// Where it happens, in plain words (no label for "everywhere").
function placeChip(t) {
  if (t.place === 'commute') return `<span class="tag-plain">Commute +${S().commuteMinutes} min</span>`;
  if (t.place === 'silent') return '<span class="tag-plain">Silent space</span>';
  return '';
}

function goalLabel(t) {
  const g = goal(t.goalId);
  return g ? `<span class="goal-label">Goal: ${esc(g.title)}</span>` : '';
}

const t12 = (hhmm) => R.to12h(hhmm);
const t12m = (minutes) => R.to12h(R.toHHMM(minutes));
const hourLabel = (h) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 || h === 24 ? 'AM' : 'PM'}`;

// Hour, minute and AM/PM pickers. Stored as 24-hour 'HH:MM' behind the scenes.
function timePickerHTML(name, value, { id = name, optional = false, change = '', dataId = '' } = {}) {
  let h12 = '';
  let min = '00';
  let ap = 'AM';
  if (value) {
    const [h, m] = value.split(':').map(Number);
    ap = h >= 12 ? 'PM' : 'AM';
    h12 = String(h % 12 === 0 ? 12 : h % 12);
    min = String(m).padStart(2, '0');
  }
  const extra = change ? `data-change="${change}" data-id="${esc(dataId)}"` : '';
  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1));
  const mins = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
  if (!mins.includes(min)) mins.push(min);
  return `<div class="time-pick">
    <label class="visually-hidden" for="${id}">Hour</label>
    <select class="input" id="${id}" name="${name}_h" ${extra}>${optional ? '<option value="">--</option>' : ''}${hours.map((h) => `<option ${h === h12 ? 'selected' : ''}>${h}</option>`).join('')}</select>
    <span aria-hidden="true">:</span>
    <label class="visually-hidden" for="${id}-m">Minutes</label>
    <select class="input" id="${id}-m" name="${name}_m" ${extra}>${mins.map((m) => `<option ${m === min ? 'selected' : ''}>${m}</option>`).join('')}</select>
    <label class="visually-hidden" for="${id}-ap">AM or PM</label>
    <select class="input" id="${id}-ap" name="${name}_ap" ${extra}><option ${ap === 'AM' ? 'selected' : ''}>AM</option><option ${ap === 'PM' ? 'selected' : ''}>PM</option></select>
  </div>`;
}

function readTime(root, name) {
  const h = root.querySelector(`[name="${name}_h"]`)?.value;
  if (!h) return null;
  return R.from12h(h, root.querySelector(`[name="${name}_m"]`).value, root.querySelector(`[name="${name}_ap"]`).value);
}

// ---------- calendar items: your own events plus Google ----------

function linkedTask(src, id, date) {
  return state.tasks.find((t) => t.status !== 'trashed' && t.eventRef && t.eventRef.src === src && t.eventRef.id === id && t.eventRef.date === date) || null;
}

function calendarItems(key) {
  const own = R.eventsOn(state.events, key).map((e) => ({ src: 'own', id: e.id, date: key, title: e.title, start: e.start, minutes: e.minutes, commute: !!e.commute }));
  const google = ((G.isConnected() && G.cachedDay(key)) || []).filter((e) => !e.allDay && !e.fromApp)
    .map((e) => ({ src: 'google', id: e.id, date: key, title: e.title, start: e.start, minutes: e.minutes, commute: false, color: e.color }));
  return [...own, ...google].map((c) => {
    const t = linkedTask(c.src, c.id, c.date);
    return { ...c, task: t, commute: c.commute || !!(t && t.place === 'commute') };
  }).sort((a, b) => a.start.localeCompare(b.start));
}

// Keeps the next week of Google events ready for the backlog and the plan.
function loadGoogleAhead(force = false) {
  if (!G.isConnected() || ui.gLoading) return;
  if (!force && ui.gAhead && Date.now() - ui.gAhead.at < 5 * 60000) return;
  ui.gLoading = true;
  G.eventsAhead(todayKey(), 8)
    .then(() => { ui.gAhead = { at: Date.now() }; })
    .catch(() => {})
    .finally(() => {
      ui.gLoading = false;
      const typing = !!recognizer || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
      if (ui.gAhead && !modal.open && !typing) render();
    });
}

function deadlineHTML(t) {
  if (!t.deadline) return '';
  const soon = R.isUrgentByDate(t, todayKey(), S());
  return `<span class="${soon ? 'due-soon' : ''}">due ${esc(fmtDay(t.deadline))}</span>`;
}

function openCount(goalId) {
  return state.tasks.filter((t) => t.goalId === goalId && t.status === 'open').length;
}

function stepsHTML(steps, cls = 'steps') {
  if (!steps.length) return '';
  return `<ol class="${cls}">${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`;
}

// ---------- daily housekeeping ----------

function dailyCheck() {
  const key = todayKey();
  if (state.lastDailyCheck === key) return [];
  const { tasks, messages } = R.promoteDueTasks(state.tasks, key, S());
  const cutoff = Date.now() - 30 * 86400000;
  state.tasks = tasks.filter((t) => t.status !== 'trashed' || !t.trashedAt || Date.parse(t.trashedAt) > cutoff);
  state.lastDailyCheck = key;
  save(state);
  return messages;
}

// ---------- what is happening now ----------

function dayItems(key) {
  const day = state.days[key];
  if (!day || !day.plan) return [];
  const items = [];
  day.plan.blocks.forEach((b, i) => items.push({ type: 'block', index: i, start: R.toMinutes(b.start), minutes: b.minutes, block: b }));
  day.plan.events.forEach((e) => items.push({ type: e.kind, start: R.toMinutes(e.start), minutes: e.minutes, event: e }));
  return items.sort((a, b) => a.start - b.start);
}

function currentAndNext() {
  const now = nowMinutes();
  const items = dayItems(todayKey());
  const current = items.find((i) => now >= i.start && now < i.start + i.minutes) || null;
  const next = items.find((i) => i.start > now) || null;
  return { current, next };
}

function blockGoalNames(block) {
  const names = [...new Set(block.taskIds.map(task).filter(Boolean).map((t) => goal(t.goalId)?.title).filter(Boolean))];
  return names.join(', ');
}

function itemTitle(item) {
  if (item.type === 'block') {
    const names = blockGoalNames(item.block);
    return `Deep work${names ? ' · ' + names : ''}`;
  }
  return item.event.title;
}

// ---------- rendering ----------

function currentTab() {
  const hash = location.hash.slice(1);
  if (hash) return hash;
  const day = state.days[todayKey()];
  return day && day.set ? 'today' : 'start';
}

function render() {
  const tab = currentTab();
  document.querySelectorAll('[data-tab]').forEach((a) => {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  renderNowPill();
  if (tab !== 'goals') loadGoogleAhead();
  afterRender = [];
  if (tab === 'today') view.innerHTML = renderToday();
  else if (tab === 'calendar') view.innerHTML = renderCalendar();
  else if (tab === 'goals') view.innerHTML = renderGoals();
  else if (tab === 'backlog') view.innerHTML = renderBacklog();
  else view.innerHTML = renderStart();
  afterRender.forEach((fn) => fn());
}

function renderNowPill() {
  const pill = document.getElementById('now-pill');
  const { current } = currentAndNext();
  if (!current) { pill.innerHTML = ''; return; }
  const end = t12m(current.start + current.minutes);
  pill.innerHTML = `<a class="now-pill" href="#today"><span class="dot"></span><span><strong>Now</strong><span class="long">: ${esc(itemTitle(current))}</span> · until ${end}</span></a>`;
}

function keyHTML() {
  const c = R.countByPriority(state.tasks);
  const cap = (p) => R.PRIORITIES[p].cap;
  return `
  <section class="card key" aria-label="Priority key">
    <strong>Key</strong>
    <span>${markHTML('both')} Important + urgent <span class="muted">· ${c.both} of ${cap('both')} · due today or tomorrow</span></span>
    <span>${markHTML('important')} Important <span class="muted">· ${c.important} of ${cap('important')}</span></span>
    <span>${markHTML('urgent')} Urgent <span class="muted">· ${c.urgent} of ${cap('urgent')}</span></span>
    <span>${markHTML('nice')} Tasks for later <span class="muted">· no limit</span></span>
  </section>`;
}

// ----- calendar drawing (shared) -----
// One simple calendar everywhere. Google events keep their own Google color.
// Everything made in Personal IO (your events, deep work blocks, fixed-time tasks) is outlined blue.

const GOOGLE_COLORS = {
  1: '#7986CB', 2: '#33B679', 3: '#8E24AA', 4: '#E67C73', 5: '#F6BF26', 6: '#F4511E',
  7: '#039BE5', 8: '#616161', 9: '#3F51B5', 10: '#0B8043', 11: '#D50000',
};
const googleColor = (id) => GOOGLE_COLORS[id] || GOOGLE_COLORS[7];

// Picks navy or white text, whichever reads better on the background.
function inkOn(hex) {
  const lum = (h) => {
    const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const bg = lum(hex);
  const navy = (bg + 0.05) / (lum('#18243B') + 0.05);
  const white = 1.05 / (bg + 0.05);
  return navy >= white ? '#18243B' : '#FFFFFF';
}

function hoursHTML({ startHour = 7, endHour = 23, px = 56 } = {}) {
  const height = (endHour - startHour) * px;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => `<span style="top:${i * px}px">${hourLabel(startHour + i)}</span>`).join('');
  return `<div class="hours" aria-hidden="true" style="height:${height}px">${hours}</div>`;
}

// items: [{ start: minutes, minutes, title, sub, cls, style, action, src, id, date, done }]
function gridHTML(items, { startHour = 7, endHour = 23, px = 56, nowLine = false } = {}) {
  const top = (m) => ((m - startHour * 60) / 60) * px;
  const height = (endHour - startHour) * px;
  const boxes = items
    .filter((it) => it.start + it.minutes > startHour * 60 && it.start < endHour * 60)
    .map((it) => {
      const h = Math.max((it.minutes / 60) * px - 2, 16);
      const style = `top:${Math.max(top(it.start), 0)}px; height:${h}px; ${it.style || ''}`;
      const inner = `${esc(it.title)}${it.sub ? `<span class="sub">${esc(it.sub)}</span>` : ''}`;
      const cls = `ev ${it.cls}${it.done ? ' is-done' : ''}`;
      return it.action
        ? `<button type="button" class="${cls}" style="${style}" data-action="${it.action}" data-src="${esc(it.src || '')}" data-id="${esc(it.id || '')}" data-date="${esc(it.date || '')}" aria-label="${esc(it.title)}, ${esc(it.sub || '')}">${inner}</button>`
        : `<div class="${cls}" style="${style}">${inner}</div>`;
    }).join('');
  const now = nowMinutes();
  const line = nowLine && now >= startHour * 60 && now <= endHour * 60 ? `<div class="now-line" style="top:${top(now)}px" aria-label="Now"></div>` : '';
  return `<div class="grid" style="height:${height}px; background-image: repeating-linear-gradient(to bottom, var(--line-2) 0, var(--line-2) 1px, transparent 1px, transparent ${px}px)">${boxes}${line}</div>`;
}

function timelineHTML(items, opts = {}) {
  return `<div class="timeline-wrap">${hoursHTML(opts)}${gridHTML(items, opts)}</div>`;
}

function calendarLegendHTML() {
  return `<div class="legend">
    ${G.isConfigured() ? '<span><span class="sw sw-google"></span>Google Calendar</span>' : ''}
    <span><span class="sw sw-io"></span>Personal IO</span>
    <span><span class="sw sw-commute"></span>Commute</span>
  </div>`;
}

const commuteItem = (start) => ({ start, minutes: S().commuteMinutes, cls: 'ev-commute', title: `Commute ${S().commuteMinutes} min` });
const markText = (t) => (t ? `${R.PRIORITIES[t.priority].mark} ` : '');

// Things made in Personal IO for one day.
function ioItems(key) {
  const items = [];
  R.eventsOn(state.events, key).forEach((e) => {
    const start = R.toMinutes(e.start);
    const t = linkedTask('own', e.id, key);
    if (e.commute || (t && t.place === 'commute')) items.push(commuteItem(start - S().commuteMinutes));
    items.push({
      start, minutes: e.minutes, cls: 'ev-io', title: `${markText(t)}${e.title}`, sub: t12(e.start),
      action: 'cal-item', src: 'own', id: e.id, date: key, done: t && t.status === 'done',
    });
  });
  const day = state.days[key];
  if (day && day.plan) {
    day.plan.blocks.forEach((b) => items.push({
      start: R.toMinutes(b.start), minutes: b.minutes, cls: 'ev-io',
      title: `Deep work · ${b.taskIds.length} task${b.taskIds.length === 1 ? '' : 's'}`,
      sub: `${t12(b.start)} - ${t12m(R.toMinutes(b.start) + b.minutes)}`,
    }));
    day.plan.events.forEach((e) => items.push(e.kind === 'commute'
      ? { start: R.toMinutes(e.start), minutes: e.minutes, cls: 'ev-commute', title: 'Commute' }
      : { start: R.toMinutes(e.start), minutes: e.minutes, cls: 'ev-io', title: `${markText(task(e.taskId))}${e.title}`, sub: t12(e.start) }));
  }
  return items;
}

// Google events for one day, in their own colors.
function googleItems(key, list) {
  const items = [];
  list.filter((e) => !e.allDay && !e.fromApp).forEach((e) => {
    const start = R.toMinutes(e.start);
    const t = linkedTask('google', e.id, key);
    if (t && t.place === 'commute') items.push(commuteItem(start - S().commuteMinutes));
    const bg = googleColor(e.color);
    items.push({
      start, minutes: e.minutes, cls: 'ev-google', style: `background:${bg}; color:${inkOn(bg)};`,
      title: `${markText(t)}${e.title}`, sub: `${t12(e.start)}${e.online ? ' · online' : ''}`,
      action: 'cal-item', src: 'google', id: e.id, date: key, done: t && t.status === 'done',
    });
  });
  return items;
}

// Draws a day's calendar now, then adds Google events once they arrive.
function calendarBlockHTML(id, key, opts = {}) {
  afterRender.push(() => fillCalendar(id, key, opts));
  const cached = G.isConnected() ? G.cachedDay(key) : null;
  return `<div id="${id}" class="cal-slot">${calendarLegendHTML()}${timelineHTML([...ioItems(key), ...(cached ? googleItems(key, cached) : [])], opts)}</div>`;
}

async function fillCalendar(id, key, opts = {}) {
  const el = document.getElementById(id);
  if (!el) return;
  el.dataset.want = key;
  const io = [...ioItems(key), ...(opts.extra || [])];
  if (!G.isConfigured()) { el.innerHTML = calendarLegendHTML() + timelineHTML(io, opts); return; }
  if (!G.isConnected()) {
    el.innerHTML = `<div class="note note-info" style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap">
      <span>Show your Google Calendar here.</span><button class="btn btn-small" data-action="connect-google">Connect Google</button></div>${calendarLegendHTML()}${timelineHTML(io, opts)}`;
    return;
  }
  try {
    const events = await G.eventsForDay(key);
    const allDay = events.filter((e) => e.allDay).map((e) => esc(e.title));
    const still = document.getElementById(id);
    if (!still || still.dataset.want !== key) return; // you moved to another day meanwhile
    still.innerHTML = `${allDay.length ? `<div class="hint" style="margin-bottom:6px">All day: ${allDay.join(', ')}</div>` : ''}${calendarLegendHTML()}${timelineHTML([...io, ...googleItems(key, events)], opts)}`;
  } catch (err) {
    const still = document.getElementById(id);
    if (still && still.dataset.want === key) still.innerHTML = `<div class="note note-warn">${err.message === 'not-connected' ? 'Google sign-in expired.' : esc(err.message)} <button class="btn-link" data-action="connect-google">Connect again</button></div>${calendarLegendHTML()}${timelineHTML(io, opts)}`;
  }
}

// ----- calendar event popup: keep it in mind, or mark it done -----

function calItemHTML(c) {
  const when = `${fmtDay(c.date, { weekday: 'long', month: 'short', day: 'numeric' })} · ${t12(c.start)} to ${t12m(R.toMinutes(c.start) + c.minutes)}`;
  const source = c.src === 'google' ? 'From Google Calendar' : 'Made in Personal IO';
  const head = `
    <div class="modal-head"><div><div class="date-line">${esc(when)}</div><h2 id="modal-title">${esc(c.title)}</h2><div class="hint">${source}</div></div>
      <button type="button" class="btn btn-ghost icon-btn" data-action="close-modal" aria-label="Close">✕</button></div>`;
  const editOwn = c.src === 'own' ? '<button type="button" class="btn-link" data-action="cal-edit-own">Edit event</button>' : '';
  const t = c.task;
  if (t) {
    return `
    <div class="modal" data-form="calitem" data-src="${esc(c.src)}" data-id="${esc(c.id)}" data-date="${esc(c.date)}">
      ${head}
      <div class="note ${t.status === 'done' ? 'note-ok' : 'note-info'}">
        ${t.status === 'done' ? '<strong>Done.</strong> ' : ''}In your list as ${markHTML(t.priority)} <strong>${esc(R.PRIORITIES[t.priority].label)}</strong>${goal(t.goalId) ? ` · Goal: ${esc(goal(t.goalId).title)}` : ''}
      </div>
      <div class="modal-foot" style="justify-content:space-between">
        <div style="display:flex; gap:12px; flex-wrap:wrap">${editOwn}<button type="button" class="btn-link" data-action="cal-untrack" data-id="${t.id}">Remove from my list</button></div>
        <div style="display:flex; gap:8px; flex-wrap:wrap">
          <button type="button" class="btn" data-action="edit-task" data-id="${t.id}">Open task</button>
          ${t.status === 'open' ? `<button type="button" class="btn btn-success" data-action="complete-task" data-id="${t.id}">✓ Mark done</button>` : ''}
        </div>
      </div>
    </div>`;
  }
  const lastGoal = goal(ui.lastGoal) ? ui.lastGoal : 'life';
  return `
  <div class="modal" data-form="calitem" data-src="${esc(c.src)}" data-id="${esc(c.id)}" data-date="${esc(c.date)}">
    ${head}
    <div class="errors" hidden></div>
    <div class="field"><span class="field-label">Turn it into a task:</span>
      <div class="prio-grid">
        <button type="button" class="prio-btn prio-both" data-action="cal-prioritize" data-priority="both">${markHTML('both')}<span>Important + urgent</span></button>
        <button type="button" class="prio-btn prio-urgent" data-action="cal-prioritize" data-priority="urgent">${markHTML('urgent')}<span>Urgent</span></button>
        <button type="button" class="prio-btn prio-important" data-action="cal-prioritize" data-priority="important">${markHTML('important')}<span>Important</span></button>
        <button type="button" class="prio-btn prio-nice" data-action="cal-prioritize" data-priority="nice">${markHTML('nice')}<span>For later</span></button>
      </div>
    </div>
    <div class="field"><label for="ci-goal">For which goal?</label>
      <select class="input" id="ci-goal">${state.goals.map((g) => `<option value="${g.id}" ${g.id === lastGoal ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}</select></div>
    <div class="or-line">or</div>
    <button type="button" class="btn btn-success" data-action="cal-done">✓ Already done</button>
    <div class="modal-foot" style="justify-content:space-between">
      ${editOwn || '<span></span>'}
      <button type="button" class="btn-link" data-action="cal-details">Create task with more details</button>
    </div>
  </div>`;
}

function calFromModal() {
  const root = modal.querySelector('[data-form="calitem"]');
  if (!root) return { root: null, c: null };
  const c = calendarItems(root.dataset.date).find((x) => x.src === root.dataset.src && x.id === root.dataset.id) || null;
  return { root, c };
}

// Puts a calendar-linked task on that day's plan (it already has its time).
function addCalendarTaskToDay(t, dayKey) {
  const day = getDay(dayKey);
  if (day.taskIds.includes(t.id)) return true;
  if (day.taskIds.length >= day.slots) {
    if (day.slots >= S().daySlotsMax) return false;
    day.slots = day.taskIds.length + 1;
  }
  const rank = (x) => (x ? R.PRIORITY_ORDER.indexOf(x.priority) : 99);
  const at = day.taskIds.findIndex((id) => rank(task(id)) > rank(t));
  if (at === -1) day.taskIds.push(t.id); else day.taskIds.splice(at, 0, t.id);
  return true;
}

function taskFromCalendar(c, overrides) {
  const nowIso = new Date().toISOString();
  const taken = R.sameTitle(c.title, R.openTasks(state.tasks));
  return {
    id: newId(), status: 'open', createdAt: nowIso, lastTouchedAt: nowIso, pushCount: 0,
    title: taken ? `${c.title} (${fmtDay(c.date)})` : c.title,
    goalId: 'life', priority: 'important', deadline: c.date, minutes: c.minutes,
    firstSteps: [], firstStep: '', stepsBy: 'me', place: c.commute ? 'commute' : 'everywhere',
    destination: '', fixedDate: c.date, fixedTime: c.start, needs: [],
    eventRef: { src: c.src, id: c.id, date: c.date }, source: 'calendar', promotionBlocked: false,
    ...overrides,
  };
}

// ----- "What's on your mind?" capture panel -----

function captureHTML() {
  const empty = state.tasks.length === 0;
  return `
  <section class="capture" aria-labelledby="cap-h">
    ${empty ? '<span class="start-here">Start here</span>' : ''}
    <div class="capture-head"><h2 id="cap-h">What's on your mind?</h2><span class="hint">Add one thing. You can organize it later.</span></div>
    <div class="capture-row">
      <div class="field" style="flex: 1 1 280px">
        <label for="cap-text">Task, or something you already did</label>
        <div class="cap-input-row">
          <input class="input" id="cap-text" type="text" placeholder="e.g., Send my application" autocomplete="off" aria-describedby="cap-hint">
          ${SpeechRec ? `<button type="button" class="btn mic mic-icon" data-action="mic" data-target="cap-text" data-single="1" aria-pressed="false" aria-label="Say the task">${MIC_ICON}<span class="visually-hidden">Start talking</span></button>` : ''}
        </div>
        <span class="hint" id="cap-hint">Type or tap the mic and say it. Press Enter to add it to 🤔 Tasks for later. · <button type="button" class="btn-link" data-action="open-email">Find tasks in my email</button></span>
      </div>
      <div class="capture-actions">
        <button type="button" class="btn btn-dark" data-action="quick-add">Add task</button>
        <button type="button" class="btn btn-success" data-action="quick-done">✓ I already did it</button>
      </div>
    </div>
  </section>`;
}

// ----- start page (plan) -----

function renderStart() {
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const tKey = todayKey();
  const todaySet = !!(state.days[tKey] && state.days[tKey].set);
  if (!ui.planDay) ui.planDay = (hour >= 15 || todaySet) ? 'tomorrow' : 'today';
  const dayKey = ui.planDay === 'today' ? tKey : tomorrowKey();

  return `
  <section class="page-head">
    <div>
      <div class="date-line">${esc(longDay(tKey))}</div>
      <h1>${greet}. What's the plan?</h1>
    </div>
    <div class="seg" role="group" aria-label="Which day to plan" style="max-width: 360px">
      <button type="button" data-action="plan-day" data-day="today" aria-pressed="${ui.planDay === 'today'}">Plan today</button>
      <button type="button" data-action="plan-day" data-day="tomorrow" aria-pressed="${ui.planDay === 'tomorrow'}">Plan tomorrow</button>
    </div>
  </section>
  ${captureHTML()}
  ${goalsStripHTML()}
  ${busyDayHTML(dayKey)}
  <div class="cols plan-cols">
    <section class="col col-backlog" aria-label="Tasks and their priorities">
      <div class="col-head"><h2>Tasks and their priorities</h2>
        <button class="btn btn-small" data-action="new-task">+ Task with details</button>
      </div>
      ${ui.goalFilter ? `<div class="hint">Goal: ${esc(goal(ui.goalFilter)?.title || '')} (plus urgent) · <button class="btn-link" data-action="clear-filter">Show all</button></div>` : ''}
      ${backlogGroupsHTML({ addTo: dayKey, goalFilter: ui.goalFilter })}
    </section>
    <section class="col col-day" aria-label="Day plan">
      ${dayColumnHTML(dayKey)}
    </section>
    <section class="col col-cal card card-pad" aria-label="Calendar">
      <div class="col-head"><h2>Calendar</h2><span class="meta">${esc(fmtDay(dayKey))}</span></div>
      <span class="hint">Click an event to turn it into a task, or mark it done.</span>
      ${calendarBlockHTML('cal-plan', dayKey, { px: 28, startHour: 7, endHour: 22, nowLine: dayKey === tKey })}
    </section>
  </div>`;
}

// When the calendar already holds more than 10 hours between 8 AM and 10 PM,
// ask which of those things really matter. Being busy is not the same as doing what matters.
function busyDayHTML(dayKey) {
  const day = getDay(dayKey);
  if (day.busyOk) return '';
  const items = calendarItems(dayKey);
  const busy = R.busyMinutes(items.map((c) => ({ ...c, commuteMinutes: S().commuteMinutes })));
  if (busy <= 600) return '';
  const free = items.filter((c) => !c.task);
  const rows = free.slice(0, 12).map((c) => `
    <div class="busy-row">
      <span><span class="mono">${t12(c.start)}</span> ${esc(c.title)} <span class="hint">${R.formatMinutes(c.minutes)}</span></span>
      <span class="busy-btns">
        <button type="button" class="btn btn-small" data-action="busy-prio" data-priority="both" data-src="${esc(c.src)}" data-id="${esc(c.id)}" data-date="${dayKey}" aria-label="${esc(c.title)} is important and urgent">${markHTML('both')}</button>
        <button type="button" class="btn btn-small" data-action="busy-prio" data-priority="urgent" data-src="${esc(c.src)}" data-id="${esc(c.id)}" data-date="${dayKey}" aria-label="${esc(c.title)} is urgent">${markHTML('urgent')}</button>
        <button type="button" class="btn btn-small" data-action="busy-prio" data-priority="important" data-src="${esc(c.src)}" data-id="${esc(c.id)}" data-date="${dayKey}" aria-label="${esc(c.title)} is important">${markHTML('important')}</button>
      </span>
    </div>`).join('');
  return `
  <section class="busy-card" aria-label="Busy day check">
    <div><strong>${esc(fmtDay(dayKey, { weekday: 'long' }))} already has ${R.formatMinutes(busy)} on your calendar between 8 AM and 10 PM.</strong>
    <div>Being busy is not the same as doing what matters. Are all of these important or urgent? Mark the ones that are, and they go to your task list.</div></div>
    ${rows ? `<div class="busy-list">${rows}</div>` : '<div class="hint">Everything here is already in your task list.</div>'}
    <div><button type="button" class="btn-link" data-action="busy-ok" data-day="${dayKey}">They're fine as they are</button></div>
  </section>`;
}

function goalsStripHTML() {
  return `
  <section class="goal-strip" aria-label="Goals">
    <span class="strip-label">Goals ${state.goals.length}/${S().maxGoals}</span>
    ${state.goals.map((g) => `<button type="button" class="goal-pill" data-action="filter-goal" data-id="${g.id}" aria-pressed="${ui.goalFilter === g.id}" title="${esc(g.why || '')}">${esc(g.title)} <span class="n">${openCount(g.id)}</span></button>`).join('')}
    ${state.goals.length < S().maxGoals ? '<button type="button" class="btn-link" data-action="new-goal">+ Goal</button>' : ''}
  </section>`;
}

function goalsListHTML(selectable) {
  const items = state.goals.map((g) => `
    <button type="button" class="goal-item" ${selectable ? `data-action="filter-goal" data-id="${g.id}" aria-pressed="${ui.goalFilter === g.id}"` : `data-action="edit-goal" data-id="${g.id}"`}>
      <span class="top"><span>${esc(g.title)}</span><span class="n">${openCount(g.id)} open</span></span>
      ${g.why ? `<span class="why">Why: ${esc(g.why)}</span>` : ''}
    </button>`).join('');
  return `<div class="card list">${items}</div>`;
}

const CAL_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 11h18"></path></svg>';
const CHEVRON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>';

// The four priority lists as dropdowns, each with its count.
function backlogGroupsHTML({ addTo = null, goalFilter = null, full = false } = {}) {
  const tKey = todayKey();
  const counts = R.countByPriority(state.tasks);
  let open = R.openTasks(state.tasks);
  if (goalFilter) open = open.filter((t) => t.goalId === goalFilter || t.priority === 'both' || t.priority === 'urgent');
  const day = addTo ? getDay(addTo) : null;

  return R.PRIORITY_ORDER.map((p) => {
    const info = R.PRIORITIES[p];
    const list = R.sortForPlanning(open.filter((t) => t.priority === p));
    const isOpen = !!ui.open[p];
    const count = info.cap === Infinity ? `${list.length}` : `${counts[p]} of ${info.cap}${counts[p] >= info.cap ? ' · full' : ''}`;
    const rows = list.map((t) => taskRowHTML(t, { addTo, day, tKey, full })).join('')
      || '<div class="item"><span class="hint">Nothing here.</span></div>';
    return `<div class="card group group-${p}">
      <button type="button" class="group-toggle" data-action="toggle-group" data-group-name="${p}" aria-expanded="${isOpen}">
        <span class="group-name">${markHTML(p)} ${info.label}</span>
        <span class="count">${count}</span>${CHEVRON}
      </button>
      ${isOpen ? rows : ''}
    </div>`;
  }).join('');
}

function taskRowHTML(t, { addTo, day, tKey, full }) {
  const stale = R.isStale(t, tKey, S());
  const inDay = day && day.taskIds.includes(t.id);
  let actions = '';
  if (addTo && t.eventRef && t.eventRef.date === addTo) {
    actions = '<span class="chip chip-done">On calendar</span>';
  } else if (addTo) {
    actions = inDay
      ? '<span class="chip chip-done">In plan</span>'
      : `<button class="btn btn-small" data-action="add-to-day" data-id="${t.id}" data-day="${addTo}">+ ${addTo === tKey ? 'Today' : 'Tomorrow'}</button>`;
  } else if (full) {
    actions = `
      <button class="btn btn-small" data-action="complete-task" data-id="${t.id}">✓ Done</button>
      <button class="btn btn-small" data-action="edit-task" data-id="${t.id}">Edit</button>`;
  }
  const when = t.eventRef ? `<span>${CAL_ICON} ${esc(fmtDay(t.eventRef.date))} · ${t12(t.fixedTime)}</span>` : deadlineHTML(t);
  const canDrag = addTo && !inDay && !(t.eventRef && t.eventRef.date === addTo);
  return `
  <div class="item ${canDrag ? 'draggable-task' : ''}" ${canDrag ? `draggable="true" data-task-drag="${t.id}" title="Drag into ${addTo === tKey ? 'today' : 'tomorrow'}"` : ''} style="${stale ? 'background: var(--gold-soft)' : ''}">
    <div class="item-main">
      <button class="task-name" data-action="edit-task" data-id="${t.id}">${esc(t.title)}</button>
      <div class="item-meta">${goalLabel(t)}<span>${R.formatMinutes(t.minutes || 0)}</span>${when}${placeChip(t)}</div>
      ${t.progress ? `<div class="left-off">Left off: ${esc(t.progress)}</div>` : ''}
      ${t.pushCount ? `<div class="item-meta"><span class="due-soon">Pushed ${t.pushCount}x${t.lastReason ? ' · ' + esc(t.lastReason.toLowerCase()) : ''}</span></div>` : ''}
      ${t.promotionBlocked ? '<div class="item-meta"><span class="chip chip-warn">Due soon, but ★! is full</span></div>' : ''}
      ${stale ? `<div class="item-meta" style="color: var(--ink)">Untouched ${S().staleDays}+ days. Still important?
          <button class="btn btn-small" data-action="keep-task" data-id="${t.id}">Keep</button>
          <button class="btn btn-small" data-action="demote-task" data-id="${t.id}">Move to 🤔</button></div>` : ''}
    </div>
    <div class="item-actions">${actions}<button type="button" class="icon-x icon-trash" data-action="trash-task" data-id="${t.id}" aria-label="Trash ${esc(t.title)}: no longer a task" title="No longer a task">${TRASH_ICON}</button></div>
  </div>`;
}

const TRASH_ICON = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"></path></svg>';
const DRAG_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"></circle><circle cx="15" cy="6" r="1.6"></circle><circle cx="9" cy="12" r="1.6"></circle><circle cx="15" cy="12" r="1.6"></circle><circle cx="9" cy="18" r="1.6"></circle><circle cx="15" cy="18" r="1.6"></circle></svg>';
const X_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg>';

function slotHTML(t, dayKey, word) {
  const done = t.status === 'done';
  const pressing = t.priority === 'both' || t.priority === 'urgent';
  return `
  <article class="slot ${pressing ? 'pressing' : ''}" data-id="${t.id}" style="${done ? 'opacity:.6' : ''}">
    <div class="slot-row">
      <button type="button" class="drag" data-drag="${t.id}" aria-label="Drag to reorder ${esc(t.title)} (or use arrow keys)">${DRAG_ICON}</button>
      <div class="slot-body">
        <div class="slot-title-row">${markHTML(t.priority)}<span class="slot-title" style="${done ? 'text-decoration: line-through' : ''}">${esc(t.title)}</span></div>
        <div class="item-meta">${goalLabel(t)}<span>${R.formatMinutes(t.minutes || 0)}</span>${t.eventRef ? `<span>${CAL_ICON} ${t12(t.fixedTime)}</span>` : ''}${placeChip(t)}</div>
        ${t.progress ? `<div class="left-off">Left off: ${esc(t.progress)}</div>` : ''}
        ${stepsOf(t).length ? `<div class="first-min"><strong>First minute</strong>${stepsHTML(stepsOf(t))}</div>` : ''}
        ${t.place === 'commute' && !t.eventRef ? `<div class="field"><span class="field-label">Meeting time</span>
          ${timePickerHTML(`slottime-${t.id}`, t.fixedTime, { id: `time-${t.id}`, optional: true, change: 'set-time', dataId: t.id })}</div>` : ''}
      </div>
      ${done ? '' : `<button type="button" class="btn btn-small slot-start" data-action="start-task" data-id="${t.id}" aria-label="Start ${esc(t.title)}">▶ Start</button>`}
      <button type="button" class="icon-x" data-action="remove-from-day" data-id="${t.id}" data-day="${dayKey}" aria-label="Remove ${esc(t.title)} from ${word}">${X_ICON}</button>
    </div>
  </article>`;
}

function dayColumnHTML(dayKey) {
  const day = getDay(dayKey);
  const isToday = dayKey === todayKey();
  const word = isToday ? 'today' : 'tomorrow';
  const tasks = day.taskIds.map(task).filter(Boolean);
  const need = R.dayTimeNeeded(tasks.filter((t) => t.status === 'open'), S());

  const empties = Array.from({ length: Math.max(0, day.slots - tasks.length) }, () => `
    <div class="slot-empty"><span>Empty slot</span><button class="btn-link" data-action="new-task" data-day="${dayKey}">+ New task</button></div>`).join('');
  const missingTime = tasks.filter((t) => t.status === 'open' && t.place === 'commute' && !t.fixedTime);

  let footer;
  if (!day.plan || day.planStale) {
    footer = `<button class="btn btn-dark" style="width:100%" data-action="build-day" data-day="${dayKey}" ${tasks.length ? '' : 'disabled'}>${day.plan ? 'Rebuild blocks' : 'Build my blocks'}</button>`;
  } else if (!day.set) {
    footer = `${planSummaryHTML(day)}
      <div style="display:flex; gap:8px">
        <button class="btn" data-action="build-day" data-day="${dayKey}">Rebuild</button>
        <button class="btn btn-dark" style="flex:1" data-action="set-plan" data-day="${dayKey}">Set plan for ${word}</button>
      </div>`;
  } else {
    footer = `${planSummaryHTML(day)}
      <div class="note note-ok" style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap">
        <span><strong>Plan set</strong>${day.googleIds && day.googleIds.length ? ' · in Google Calendar' : ''}</span>
        ${isToday ? '<a class="btn btn-small" href="#today">Go to Today</a>' : ''}
      </div>`;
  }

  return `
  <div class="col-head"><h2>${isToday ? 'Today' : 'Tomorrow'} · ${esc(fmtDay(dayKey, { weekday: 'long' }))}</h2>
    <span class="meta">${tasks.length} of ${day.slots} · ${R.formatMinutes(need.total)}</span></div>
  <div class="field">
    <label for="intention">Intention for the day (optional)</label>
    <input class="input" id="intention" type="text" placeholder="e.g., Move the thesis forward before noon" value="${esc(day.intention)}" data-change="intention" data-day="${dayKey}">
  </div>
  <div class="slots" data-day="${dayKey}">${tasks.map((t) => slotHTML(t, dayKey, word)).join('')}</div>
  ${empties}
  ${day.slots < S().daySlotsMax ? `<button class="btn-link" data-action="open-slot" data-day="${dayKey}">+ Slot (${day.slots + 1} of ${S().daySlotsMax})</button>` : ''}
  ${missingTime.length ? `<div class="note note-warn">Set a meeting time for: ${missingTime.map((t) => esc(t.title)).join(', ')}</div>` : ''}
  ${day.planStale ? '<div class="note note-warn">Plan changed. Rebuild the blocks.</div>' : ''}
  ${footer}`;
}

function planSummaryHTML(day) {
  const rows = [
    ...day.plan.events.map((e) => ({ start: e.start, html: `<span class="mono time-col">${t12(e.start)}</span> ${e.kind === 'commute' ? 'Commute' : esc(e.title)} · ${R.formatMinutes(e.minutes)}` })),
    ...day.plan.blocks.map((b) => ({ start: b.start, html: `<span class="mono time-col">${t12(b.start)}</span> <span class="tag tag-${b.color}">Deep work</span> ${R.formatMinutes(b.minutes)}` })),
  ].sort((a, b) => a.start.localeCompare(b.start));
  const left = [...day.plan.didNotFit, ...day.plan.needsTime].map(task).filter(Boolean);
  return `
  <div class="card card-pad" style="display:flex; flex-direction:column; gap:8px">
    <strong>Your blocks</strong>
    ${rows.map((r) => `<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; font-size:15px">${r.html}</div>`).join('')}
    ${left.length ? `<div class="note note-warn">Didn't fit: ${left.map((t) => esc(t.title)).join(', ')}</div>` : ''}
  </div>`;
}

// ----- today -----

function todayStatus(t, key) {
  if (t.status === 'done') return { word: 'Done', cls: 'chip-done' };
  const last = [...state.log].reverse().find((l) => l.taskId === t.id && l.date === key);
  if (last && last.result === 'not_started') return { word: 'Not done', cls: 'chip-miss', reason: last.reason };
  if (last && last.result === 'working') return { word: 'Still working', cls: 'chip-goal', reason: last.reason };
  return { word: 'To do', cls: 'chip-todo' };
}

// Things finished today that were not in the plan (logged wins, calendar events marked done).
function extraDoneToday(key, planned) {
  return state.tasks.filter((t) => t.status === 'done' && t.doneAt && R.toDateKey(new Date(t.doneAt)) === key && !planned.includes(t.id));
}

function todayTaskRowHTML(t, key) {
  const st = todayStatus(t, key);
  return `<div class="item">
    <div class="item-main">
      <div style="display:flex; gap:8px; align-items:center">${markHTML(t.priority)} <span class="item-title" style="${t.status === 'done' ? 'text-decoration: line-through; color: var(--ink-2)' : ''}">${esc(t.title)}</span></div>
      <div class="item-meta">${goalLabel(t)}<span>${R.formatMinutes(t.minutes || 0)}</span>${st.reason ? `<span>· ${esc(st.reason)}</span>` : ''}</div>
      ${t.progress && t.status !== 'done' ? `<div class="left-off">Left off: ${esc(t.progress)}</div>` : ''}
    </div>
    <div class="item-actions">
      <span class="chip ${st.cls}">${st.word}</span>
      ${t.status !== 'done' ? `<button class="btn btn-small" data-action="start-task" data-id="${t.id}">▶ Start</button>
      <button class="btn btn-small" data-action="complete-task" data-id="${t.id}">✓ Done</button>` : ''}
    </div>
  </div>`;
}

function renderToday() {
  const key = todayKey();
  const day = state.days[key];
  const planned = day ? day.taskIds : [];
  const extras = extraDoneToday(key, planned);
  const head = `
  <section class="page-head">
    <div><div class="date-line">${esc(longDay(key))}</div><h1>Today</h1>
    ${day && day.intention ? `<div class="sub">Intention: ${esc(day.intention)}</div>` : ''}</div>
  </section>`;
  const calendar = `
    <section class="col card card-pad" style="flex: 1 1 340px" aria-label="Calendar">
      <div class="col-head"><h2>Calendar</h2><span class="hint">Click an event to turn it into a task</span></div>
      ${calendarBlockHTML('cal-today', key, { nowLine: true, px: 40 })}
    </section>`;
  const extraHTML = extras.length ? `
      <div class="col-head"><h2>Also done today</h2></div>
      <div class="card list">${extras.map((t) => todayTaskRowHTML(t, key)).join('')}</div>` : '';

  if (!day || !day.plan) {
    return `${head}
    ${captureHTML()}
    <div class="cols">
      <section class="col" style="flex: 1.2 1 380px">
        <div class="card empty">No plan for today yet.<br><button class="btn btn-dark" style="margin-top:12px" data-action="go-plan-today">Plan today</button></div>
        ${extraHTML}
      </section>
      ${calendar}
    </div>`;
  }

  const tasks = planned.map(task).filter(Boolean);
  const done = tasks.filter((t) => t.status === 'done').length + extras.length;
  const goalsToday = [...new Set(tasks.map((t) => t.goalId))].map(goal).filter(Boolean);
  const need = R.dayTimeNeeded(tasks, S());
  const { current, next } = currentAndNext();

  const goalCards = goalsToday.map((g) => {
    const mine = tasks.filter((t) => t.goalId === g.id);
    const d = mine.filter((t) => t.status === 'done').length;
    return `<div class="goal-today">
      <div style="display:flex; justify-content:space-between; gap:8px"><strong>${esc(g.title)}</strong><span class="hint">${d} of ${mine.length} done</span></div>
      ${g.why ? `<div class="why">${esc(g.why)}</div>` : ''}
      <div class="bar"><div class="w" style="width:${mine.length ? Math.round((d / mine.length) * 100) : 0}%; background: var(--success)"></div></div>
    </div>`;
  }).join('');

  const blockButtons = day.plan.blocks.map((b, i) => {
    const started = nowMinutes() >= R.toMinutes(b.start);
    const reviewed = day.reviewed && day.reviewed[i];
    return `<div class="item">
      <div class="item-main"><span><span class="tag tag-${b.color}">Deep work</span> <span class="mono">${t12(b.start)} - ${t12m(R.toMinutes(b.start) + b.minutes)}</span></span>
      <span class="hint">${esc(blockGoalNames(b))}</span></div>
      ${reviewed ? '<span class="chip chip-done">Reviewed</span>' : started ? `<button class="btn btn-small" data-action="review" data-block="${i}">End block</button>` : '<span class="hint">Later</span>'}
    </div>`;
  }).join('');

  return `${head}
  <div class="summary-line">
    <span><strong>${tasks.length}</strong> tasks</span>
    <span><strong>${goalsToday.length}</strong> goal${goalsToday.length === 1 ? '' : 's'}</span>
    <span><strong>${done}</strong> done</span>
    <span><strong>${R.formatMinutes(need.total)}</strong> planned</span>
    ${!day.set ? '<span class="chip chip-warn">Plan not set yet · <a href="#start">set it</a></span>' : ''}
  </div>
  ${nowCardHTML(current, next)}
  ${captureHTML()}
  <div class="cols">
    <section class="col" style="flex: 1.2 1 380px">
      <div class="col-head"><h2>Goals I'm moving today</h2></div>
      <div class="card card-pad" style="display:flex; flex-direction:column; gap:14px">${goalCards || '<span class="hint">No tasks planned.</span>'}</div>
      <div class="col-head"><h2>Tasks</h2><span class="meta">Did I do it?</span></div>
      <div class="card list">${tasks.map((t) => todayTaskRowHTML(t, key)).join('') || '<div class="item"><span class="hint">No tasks planned.</span></div>'}</div>
      ${extraHTML}
      ${day.plan.blocks.length ? `<div class="col-head"><h2>Blocks</h2></div><div class="card list">${blockButtons}</div>` : ''}
    </section>
    ${calendar}
  </div>`;
}

function nowCardHTML(current, next) {
  if (!current) {
    if (!next) return '<div class="note note-info" style="margin-bottom:20px">Nothing else scheduled in your plan today.</div>';
    return `<div class="note note-info" style="margin-bottom:20px">Next at <strong>${t12m(next.start)}</strong>: ${esc(itemTitle(next))}.</div>`;
  }
  const end = current.start + current.minutes;
  const done = nowMinutes() - current.start;
  const pct = Math.max(0, Math.min(100, Math.round((done / current.minutes) * 100)));
  let title = itemTitle(current);
  let steps = [];
  let goalLine = '';
  let actions = '';
  if (current.type === 'block') {
    const openTask = current.block.taskIds.map(task).find((t) => t && t.status === 'open');
    if (openTask) {
      title = openTask.title;
      steps = stepsOf(openTask);
      const g = goal(openTask.goalId);
      if (g) goalLine = `For your goal: ${g.title}`;
    }
    actions = `${openTask ? `<button class="btn btn-outline" data-action="start-task" data-id="${openTask.id}">▶ Start</button>` : ''}<button class="btn btn-outline" data-action="review" data-block="${current.index}">End block</button>`;
  }
  return `
  <section class="now-card" aria-label="Now">
    <div class="left">
      <div class="label"><span class="dot"></span>Now · until ${t12m(end)}</div>
      <div class="title">${esc(title)}</div>
      ${goalLine ? `<div class="goal-line">${esc(goalLine)}</div>` : ''}
      ${steps.length ? `<div class="first"><strong>First minute:</strong>${stepsHTML(steps)}</div>` : ''}
    </div>
    <div class="right">
      <div class="times"><span>${R.formatMinutes(Math.max(done, 0))} done</span><span>${R.formatMinutes(Math.max(end - nowMinutes(), 0))} left</span></div>
      <div class="prog"><div style="width:${pct}%"></div></div>
      <div style="display:flex; gap:8px; margin-top:6px">${actions}</div>
    </div>
  </section>`;
}

// ----- welcome back: a short fresh start after time away -----

function welcomeInfo() {
  const today = todayKey();
  const last = R.lastActiveDay(today, { lastOpen: state.lastOpenDate, days: state.days, log: state.log });
  if (!last) return null;
  const open = R.openTasks(state.tasks);
  // Things you may have done without marking them: what was planned that day, then ★! and !.
  const planned = (state.days[last]?.taskIds || []).map(task).filter((t) => t && t.status === 'open');
  const pressing = R.sortForPlanning(open.filter((t) => t.priority === 'both' || t.priority === 'urgent'));
  const check = [...new Set([...planned, ...pressing])].slice(0, 6);
  // Skip calendar events that already happened.
  const next = R.sortForPlanning(open.filter((t) => t.priority !== 'nice' && !(t.eventRef && t.eventRef.date < today) && !check.includes(t)))[0]
    || R.sortForPlanning(open.filter((t) => t.priority !== 'nice' && !(t.eventRef && t.eventRef.date < today)))[0] || null;
  return { last, gap: R.daysUntil(today, last), sum: R.daySummary(last, state), check, next };
}

// Shown once, on the first open of each day.
function maybeWelcome() {
  const today = todayKey();
  if (state.lastOpenDate === today) return;
  const info = welcomeInfo();
  state.lastOpenDate = today;
  save(state);
  if (!info) return;
  ui.welcome = info;
  openModal(welcomeHTML(info));
}

function welcomeHTML({ last, gap, sum, check, next }) {
  const when = gap <= 1 ? 'yesterday' : esc(fmtDay(last, { weekday: 'long', month: 'long', day: 'numeric' }));
  const c = R.countByPriority(state.tasks);
  const stand = ['both', 'urgent', 'important', 'nice']
    .map((p) => `<span class="stand-chip">${markHTML(p)} <strong>${c[p]}</strong> <span class="muted">${R.PRIORITIES[p].short || R.PRIORITIES[p].label}</span></span>`).join('');
  return `
  <div class="modal welcome" data-form="welcome">
    <div class="modal-head"><div><div class="date-line">${esc(longDay(todayKey()))}</div><div class="big" id="modal-title">${gap <= 1 ? 'Good morning' : 'Welcome back'}</div></div>
      <button type="button" class="btn btn-ghost icon-btn" data-action="welcome-close" aria-label="Close">✕</button></div>
    <div style="font-size:16px">Last time you were here was ${when}.${gap > 1 ? ' It is okay to start again.' : ''}${sum.done.length ? ` You marked ${sum.done.length} thing${sum.done.length === 1 ? '' : 's'} done that day.` : ''}</div>
    ${check.length ? `<fieldset class="welcome-box welcome-check"><legend>Did you already do any of these? Tick them and I'll mark them done.</legend>
      ${check.map((t) => `<label class="check-row"><input type="checkbox" name="wb-done" value="${t.id}"> ${markHTML(t.priority)} <span>${esc(t.title)}</span></label>`).join('')}
    </fieldset>` : ''}
    <div class="welcome-box welcome-open"><strong>Where things stand right now</strong><div class="stand">${stand}</div></div>
    ${next ? `<div class="welcome-box welcome-next"><span class="eyebrow">One small place to start</span>
      <strong>${markHTML(next.priority)} ${esc(next.title)}</strong>
      ${stepsOf(next)[0] ? `<span>First minute: ${esc(stepsOf(next)[0])}</span>` : ''}</div>` : ''}
    ${talkFieldHTML('wb', 'Anything on your mind? (optional)', 'Typing is fine too...', 90)}
    <div class="modal-foot">
      <button type="button" class="btn-link" data-action="welcome-close">Close</button>
      <button type="button" class="btn btn-dark" data-action="welcome-start">Start fresh</button>
    </div>
  </div>`;
}

// Marks ticked tasks done, saves the note, and records the return so patterns can be looked at later.
function finishWelcome() {
  const info = ui.welcome;
  const text = (modal.querySelector('#wb-text')?.value || '').trim();
  const ticked = [...modal.querySelectorAll('input[name="wb-done"]:checked')].map((i) => task(i.value)).filter(Boolean);
  stopMic();
  const at = new Date().toISOString();
  ticked.forEach((t) => {
    Object.assign(t, { status: 'done', doneAt: at, lastTouchedAt: at });
    state.log.push({ at, date: info ? info.last : todayKey(), taskId: t.id, title: t.title, result: 'done', reason: null, late: true });
  });
  if (info) {
    state.returns = state.returns || [];
    state.returns.push({ date: todayKey(), lastActive: info.last, gapDays: info.gap, noted: !!text, ticked: ticked.length, plannedAfter: false });
  }
  ui.welcome = null;
  save(state);
  return { text, ticked: ticked.length, about: info ? info.last : null };
}

async function closeWelcome(goPlan) {
  const btn = modal.querySelector('[data-action="welcome-start"]');
  const { text, ticked, about } = finishWelcome();
  const done = ticked ? `${ticked} marked done. ` : '';
  const after = () => {
    if (!goPlan) return;
    ui.planDay = 'today';
    if (location.hash === '#start') render(); else location.hash = '#start';
  };
  if (!text) {
    closeModal();
    after();
    render();
    toast(goPlan ? `${done}Fresh start: pick a few things for today.` : (done || 'See you around.').trim());
    return;
  }
  await handleTalk(text, { about, source: 'welcome', button: btn, prefix: done, after });
}

// ----- calendar -----

function weekStart(key) {
  const dow = (R.parseDateKey(key).getDay() + 6) % 7; // Monday = 0
  return R.addDays(key, -dow);
}

function renderCalendar() {
  const phone = window.matchMedia('(max-width: 760px)').matches;
  const anchor = ui.calDay || todayKey();
  const days = phone ? [anchor] : Array.from({ length: 7 }, (_, i) => R.addDays(weekStart(anchor), i));
  const opts = { startHour: 7, endHour: 23, px: phone ? 44 : 40 };
  const tKey = todayKey();
  const dayItemsFor = (key) => {
    const cached = G.isConnected() ? G.cachedDay(key) : null;
    return [...ioItems(key), ...(cached ? googleItems(key, cached) : [])];
  };
  const cols = days.map((key) => `
    <div class="cal-col">
      <div class="cal-day ${key === tKey ? 'is-today' : ''}"><span>${esc(fmtDay(key, { weekday: 'short' }))}</span><strong>${R.parseDateKey(key).getDate()}</strong></div>
      <div id="calcol-${key}">${gridHTML(dayItemsFor(key), { ...opts, nowLine: key === tKey })}</div>
    </div>`).join('');
  // Once Google is connected, its events are added to each day in their own colors.
  if (G.isConnected()) {
    afterRender.push(() => days.forEach(async (key) => {
      try {
        const list = await G.eventsForDay(key);
        const el = document.getElementById(`calcol-${key}`);
        if (el) el.innerHTML = gridHTML([...ioItems(key), ...googleItems(key, list)], { ...opts, nowLine: key === tKey });
      } catch { /* sign-in expired; the button above reconnects */ }
    }));
  }
  const googleBar = !G.isConfigured() ? ''
    : G.isConnected() ? `<span class="chip chip-done">Connected${G.connectedName() ? ': ' + esc(G.connectedName()) : ''}</span>`
    : '<button class="btn" data-action="connect-google">Connect Google</button>';
  const range = phone ? longDay(anchor) : `${fmtDay(days[0], { month: 'short', day: 'numeric' })} to ${fmtDay(days[6], { month: 'short', day: 'numeric' })}`;
  return `
  <section class="page-head">
    <div><div class="date-line">${esc(range)}</div><h1>Calendar</h1>
      <div class="sub">Click any event to keep it in mind (★!, !, ★) or mark it done.</div></div>
    <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center">
      ${googleBar}
      <button class="btn" data-action="cal-move" data-step="${phone ? -1 : -7}" aria-label="Previous">‹</button>
      <button class="btn" data-action="cal-today">Today</button>
      <button class="btn" data-action="cal-move" data-step="${phone ? 1 : 7}" aria-label="Next">›</button>
      <button class="btn btn-dark" data-action="new-event">+ Event</button>
    </div>
  </section>
  <div class="card card-pad">
    ${calendarLegendHTML()}
    <div class="cal-week">
      <div class="cal-hours"><div class="cal-day spacer"></div>${hoursHTML(opts)}</div>
      ${cols}
    </div>
  </div>
  ${state.events.length === 0 && !G.isConfigured() ? '<div class="note note-info" style="margin-top:14px">Add your classes and meetings with <strong>+ Event</strong>, or connect Google Calendar in Settings.</div>' : ''}`;
}

function eventFormHTML(e, dateKey) {
  const draft = e || { date: dateKey || todayKey(), start: '09:00', minutes: 60, mode: 'in_person', commute: false, repeat: 'none' };
  const end = R.toHHMM(R.toMinutes(draft.start) + draft.minutes);
  const where = draft.mode === 'online' ? 'online' : draft.commute ? 'commute' : 'nearby';
  const pressed = (v) => `aria-pressed="${v === where}"`;
  return `
  <form class="modal" data-form="event" data-id="${e ? e.id : ''}" novalidate>
    <div class="modal-head"><h2 id="modal-title">${e ? 'Edit event' : 'New event'}</h2>
      <button type="button" class="btn btn-ghost icon-btn" data-action="close-modal" aria-label="Close">✕</button></div>
    <div class="errors" hidden></div>
    <div class="field"><label for="e-title">What is it?</label>
      <input class="input" id="e-title" name="title" value="${esc(draft.title || '')}" placeholder="Meeting with professor"></div>
    <div class="row">
      <div class="field"><label for="e-date">Day</label><input class="input" type="date" id="e-date" name="date" value="${esc(draft.date)}"></div>
      <div class="field"><span class="field-label">Starts</span>${timePickerHTML('start', draft.start, { id: 'e-start' })}</div>
      <div class="field"><span class="field-label">Ends</span>${timePickerHTML('end', end, { id: 'e-end' })}</div>
    </div>
    <div class="field"><span class="field-label">Where</span>
      <div class="pills" data-group="where">
        <button type="button" data-value="online" ${pressed('online')}>Online</button>
        <button type="button" data-value="nearby" ${pressed('nearby')}>In person, nearby</button>
        <button type="button" data-value="commute" ${pressed('commute')}>Requires commuting (+${S().commuteMinutes} min before)</button>
      </div></div>
    <label style="display:flex; gap:10px; align-items:center; font-size:14px; min-height:44px">
      <input type="checkbox" name="repeat" ${draft.repeat === 'weekly' ? 'checked' : ''} style="width:20px; height:20px"> Repeats every week (for classes)
    </label>
    <div class="modal-foot">
      ${e ? '<button type="button" class="btn" data-action="delete-event" style="margin-right:auto; color: var(--error)">Delete</button>' : ''}
      <button type="button" class="btn" data-action="close-modal">Cancel</button>
      <button type="submit" class="btn btn-dark">Save event</button>
    </div>
  </form>`;
}

// ----- talking: say anything, it is kept as a note -----
// Talk never turns into tasks on its own. Say "task" before something to add it,
// and with a Claude key you may also get up to 3 suggestions, unticked.

const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null;
let talkDraft = null; // { note, named: [...], suggested: [...], after, prefix }

const MIC_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"></rect><path d="M5 10a7 7 0 0 0 14 0M12 17v5"></path></svg>';

function talkFieldHTML(prefix, label, placeholder, height = 140) {
  return `
    <div class="field">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap">
        <label for="${prefix}-text" class="field-label">${label}</label>
        ${SpeechRec ? `<div style="display:flex; gap:6px; align-items:center">
          <label class="visually-hidden" for="${prefix}-lang">Language</label>
          <select class="input" id="${prefix}-lang" style="min-height:40px; width:auto; padding:6px 10px"><option value="en-US">English</option><option value="es-PE" ${voiceLang() === 'es-PE' ? 'selected' : ''}>Español</option></select>
          <button type="button" class="btn btn-small mic" data-action="mic" data-target="${prefix}-text" data-lang="${prefix}-lang" aria-pressed="false">${MIC_ICON}<span>Start talking</span></button></div>` : ''}
      </div>
      <textarea class="input" id="${prefix}-text" style="min-height:${height}px" placeholder="${placeholder}"></textarea>
      <span class="hint">Saved as a note, nothing else. Want a task? Say <strong>"task"</strong> and then the task, for example: <em>task: email the professor</em>.${AI.hasKey() ? ' Claude may also suggest up to 3, and you choose.' : ''}</span>
    </div>`;
}

function talkHTML() {
  return `
  <div class="modal" data-form="talk">
    <div class="modal-head"><h2 id="modal-title">Talk it out</h2>
      <button type="button" class="btn btn-ghost icon-btn" data-action="close-modal" aria-label="Close">✕</button></div>
    ${talkFieldHTML('talk', 'Say or type whatever is on your mind', 'Letting off steam is fine. Task: book the dentist...', 160)}
    <div class="modal-foot">
      <span class="hint talk-status" style="margin-right:auto"></span>
      <button type="button" class="btn btn-dark" data-action="talk-save">Save</button>
    </div>
  </div>`;
}

const LANG_KEY = 'personal-io:voice-lang';
function voiceLang() { try { return localStorage.getItem(LANG_KEY) || 'en-US'; } catch { return 'en-US'; } }
function setVoiceLang(v) { try { localStorage.setItem(LANG_KEY, v); } catch { /* storage blocked */ } }

function stopMic() {
  if (recognizer) { recognizer.onend = null; recognizer.stop(); recognizer = null; }
  document.querySelectorAll('[data-action="mic"][aria-pressed="true"]').forEach((btn) => {
    btn.setAttribute('aria-pressed', 'false');
    const label = btn.querySelector('span');
    if (label) label.textContent = 'Start talking';
  });
}

function toggleMic(btn) {
  if (recognizer) { stopMic(); return; }
  const box = document.getElementById(btn.dataset.target);
  if (!box) return;
  const single = btn.dataset.single === '1'; // one short line, like a task name
  const langSel = btn.dataset.lang ? document.getElementById(btn.dataset.lang) : null;
  const lang = langSel ? langSel.value : voiceLang();
  if (langSel) setVoiceLang(lang);
  let committed = box.value ? box.value.trim() + ' ' : '';
  recognizer = new SpeechRec();
  recognizer.lang = lang;
  recognizer.continuous = !single;
  recognizer.interimResults = true;
  recognizer.onresult = (ev) => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const piece = ev.results[i][0].transcript;
      if (ev.results[i].isFinal) committed += piece.trim() + (single ? ' ' : '. ');
      else interim += piece;
    }
    box.value = (committed + interim).replace(/\s+$/, single ? '' : ' ');
  };
  recognizer.onerror = (ev) => { toast(ev.error === 'not-allowed' ? 'Microphone permission was blocked.' : 'Voice stopped. You can keep typing.'); stopMic(); };
  recognizer.onend = () => {
    stopMic();
    if (single && box.value.trim()) {
      box.value = box.value.trim().replace(/[.]$/, '');
      box.focus();
      toast('Check it, then press Enter or Add task.');
    }
  };
  recognizer.start();
  btn.setAttribute('aria-pressed', 'true');
  const label = btn.querySelector('span');
  if (label) label.textContent = 'Stop';
}

// Saves the note, finds tasks you named, asks Claude for (at most 3) suggestions, then shows a short review.
// Opens the review, unless you moved on to something else while waiting: then a toast offers it.
function showTalkReview(origin) {
  if (origin && !origin.isConnected && modal.open) {
    toast('Your note had possible tasks.', { label: 'Review', data: { action: 'talk-review-open' } });
    return;
  }
  openModal(talkReviewHTML());
}

async function handleTalk(text, { about = null, source = 'talk', button = null, prefix = '', after = () => {} } = {}) {
  const origin = modal.querySelector('.modal');
  stopMic();
  state.journal = state.journal || [];
  state.journal.push({ id: newId(), date: todayKey(), about, text, source, at: new Date().toISOString() });
  save(state);
  const open = R.openTasks(state.tasks);
  const fallbackGoal = goal(ui.lastGoal) ? ui.lastGoal : 'life';
  let named = R.explicitTasks(text).map((title) => ({ title, goalId: fallbackGoal, priority: 'nice', minutes: 30, pick: true }));
  let suggested = [];
  let aiNote = '';
  if (AI.hasKey()) {
    if (button) { button.disabled = true; button.textContent = 'Reading your note...'; }
    try {
      const out = await AI.talkSuggestions(text, state.goals, open.map((t) => t.title), named.map((n) => n.title));
      named = named.map((n) => ({ ...n, goalId: out.namedGoals[n.title.toLowerCase()] || n.goalId }));
      suggested = out.suggestions
        .filter((s) => !R.sameTitle(s.title, open) && !named.some((n) => R.normalTitle(n.title) === R.normalTitle(s.title)))
        .map((s) => ({ ...s, priority: 'nice', pick: false }));
    } catch (err) { aiNote = err.message; }
  }
  named.forEach((n) => { n.taken = !!R.sameTitle(n.title, open); if (n.taken) n.pick = false; });
  if (!named.length && !suggested.length) {
    if (!origin || origin.isConnected) closeModal();
    after();
    render();
    toast(`${prefix}Note saved.${aiNote ? ` (${aiNote})` : ''}`);
    return;
  }
  talkDraft = { named, suggested, after, prefix };
  showTalkReview(origin);
}

function talkRowHTML(t, i, kind) {
  const goalSel = `<select class="input" data-talk="goal" aria-label="Goal">${state.goals.map((g) => `<option value="${g.id}" ${g.id === t.goalId ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}</select>`;
  const prioSel = `<select class="input" data-talk="priority" aria-label="Priority">${['nice', 'important', 'urgent', 'both'].map((p) => `<option value="${p}" ${p === t.priority ? 'selected' : ''}>${R.PRIORITIES[p].mark || ''} ${R.PRIORITIES[p].label}</option>`).join('')}</select>`;
  return `<div class="talk-row" data-kind="${kind}" data-index="${i}">
    <label class="check-row"><input type="checkbox" data-talk="pick" ${t.pick ? 'checked' : ''} ${t.taken ? 'disabled' : ''}> <span class="item-title">${esc(t.title)}</span></label>
    ${t.from ? `<span class="hint">From the email: ${esc(t.from)}</span>` : ''}
    ${t.taken ? '<span class="hint">Already in your backlog.</span>' : `<div class="talk-pickers">${prioSel}${goalSel}</div>`}
  </div>`;
}

function talkReviewHTML() {
  const { named, suggested } = talkDraft;
  return `
  <div class="modal" data-form="talk-review">
    <div class="modal-head"><h2 id="modal-title">${esc(talkDraft.heading || 'Your note is saved')}</h2>
      <button type="button" class="btn btn-ghost icon-btn" data-action="talk-skip" aria-label="Close">✕</button></div>
    ${named.length ? `<div class="talk-group"><strong>Tasks you named</strong>${named.map((t, i) => talkRowHTML(t, i, 'named')).join('')}</div>` : ''}
    ${suggested.length ? `<div class="talk-group"><strong>${esc(talkDraft.suggestLabel || 'Claude noticed these. Tick only what matters.')}</strong>${suggested.map((t, i) => talkRowHTML(t, i, 'suggested')).join('')}</div>` : ''}
    <div class="form-errors" role="alert" hidden></div>
    <div class="modal-foot">
      <button type="button" class="btn-link" data-action="talk-skip">${talkDraft.heading ? 'Add none' : 'Just keep the note'}</button>
      <button type="button" class="btn btn-dark" data-action="talk-add">Add selected</button>
    </div>
  </div>`;
}

function readTalkReview() {
  modal.querySelectorAll('.talk-row').forEach((row) => {
    const t = talkDraft[row.dataset.kind][Number(row.dataset.index)];
    t.pick = !!row.querySelector('[data-talk="pick"]')?.checked;
    t.priority = row.querySelector('[data-talk="priority"]')?.value || t.priority;
    t.goalId = row.querySelector('[data-talk="goal"]')?.value || t.goalId;
  });
  return [...talkDraft.named, ...talkDraft.suggested].filter((t) => t.pick && !t.taken);
}

function addTalkTasks() {
  const picks = readTalkReview();
  const box = modal.querySelector('.form-errors');
  if (!picks.length) { box.hidden = false; box.textContent = `Nothing ticked. Tick a task, or choose "${talkDraft.heading ? 'Add none' : 'Just keep the note'}".`; return; }
  const nowIso = new Date().toISOString();
  const fresh = [];
  const problems = [];
  picks.forEach((p) => {
    const t = {
      id: newId(), status: 'open', createdAt: nowIso, lastTouchedAt: nowIso, pushCount: 0,
      title: p.title, goalId: p.goalId, priority: p.priority, deadline: R.defaultDeadline(p.priority, todayKey()),
      minutes: p.minutes || 30, firstSteps: R.templateSteps(p.title, 'everywhere'), firstStep: '', stepsBy: 'template', place: 'everywhere',
      destination: '', fixedDate: '', fixedTime: null, needs: [], source: p.source || 'talk', computer: true,
    };
    R.validateTask(t, [...state.tasks, ...fresh], todayKey(), S()).forEach((msg) => problems.push(`${p.title}: ${msg}`));
    fresh.push(t);
  });
  if (problems.length) { box.hidden = false; box.innerHTML = problems.map(esc).join('<br>'); return; }
  state.tasks.push(...fresh);
  ui.lastGoal = fresh[fresh.length - 1].goalId;
  const { after, prefix, heading } = talkDraft;
  talkDraft = null;
  closeModal();
  after();
  persist([`${prefix}${heading ? '' : 'Note saved. '}${fresh.length} task${fresh.length === 1 ? '' : 's'} added.`]);
}

// ----- start screen: one step at a time, one minute each -----
// A cat with big eyes waits for you. It looks sad until you start, and cheers up step by step.

let starter = null; // { taskId, steps, i, left, timer }

function catSVG(mood) {
  const mouth = {
    sad: 'M86 140 q14 -12 28 0',
    meh: 'M88 136 h24',
    ok: 'M86 132 q14 10 28 0',
    happy: 'M84 130 q8 12 16 0 q8 12 16 0',
  }[mood];
  const brows = mood === 'sad'
    ? '<path d="M54 64 l26 -8 M146 64 l-26 -8" stroke="#18243B" stroke-width="4" stroke-linecap="round"/>'
    : mood === 'meh' ? '<path d="M56 60 h24 M120 60 h24" stroke="#18243B" stroke-width="4" stroke-linecap="round"/>' : '';
  const tear = mood === 'sad' ? '<path d="M58 124 q-6 10 0 15 q6 -5 0 -15z" fill="#7FB3FF"/>' : '';
  const blush = mood === 'happy' || mood === 'ok' ? '<ellipse cx="52" cy="122" rx="10" ry="6" fill="#F4A9B8" opacity=".7"/><ellipse cx="148" cy="122" rx="10" ry="6" fill="#F4A9B8" opacity=".7"/>' : '';
  const eye = (cx) => `<ellipse cx="${cx}" cy="96" rx="21" ry="25" fill="#18243B"/><circle cx="${cx + 7}" cy="85" r="8" fill="#fff"/><circle cx="${cx - 7}" cy="106" r="4" fill="#fff"/>`;
  const label = { sad: 'A sad cat with big eyes, waiting for you to start', meh: 'The cat looks a little less sad', ok: 'The cat is starting to smile', happy: 'The cat is happy' }[mood];
  return `<svg class="cat" viewBox="0 0 200 180" width="170" height="153" role="img" aria-label="${label}">
    <path d="M42 74 L50 16 L86 50 Z" fill="#C3CCDD" stroke="#18243B" stroke-width="4" stroke-linejoin="round"/>
    <path d="M158 74 L150 16 L114 50 Z" fill="#C3CCDD" stroke="#18243B" stroke-width="4" stroke-linejoin="round"/>
    <path d="M52 56 L54 30 L72 48 Z M148 56 L146 30 L128 48 Z" fill="#F4A9B8"/>
    <ellipse cx="100" cy="104" rx="72" ry="62" fill="#C3CCDD" stroke="#18243B" stroke-width="4"/>
    ${brows}${eye(70)}${eye(130)}${tear}${blush}
    <path d="M94 120 l6 6 l6 -6 z" fill="#E58FA0" stroke="#18243B" stroke-width="2" stroke-linejoin="round"/>
    <path d="${mouth}" fill="none" stroke="#18243B" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M30 118 l30 4 M28 132 l32 -2 M170 118 l-30 4 M172 132 l-32 -2" stroke="#18243B" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`;
}

// The tasks in the same deep work block, so the last screen can show the whole plan.
function blockPlanFor(t) {
  const day = state.days[todayKey()];
  const block = day && day.plan ? day.plan.blocks.find((b) => b.taskIds.includes(t.id)) : null;
  return block ? { block, tasks: block.taskIds.map(task).filter(Boolean) } : null;
}

function starterHTML() {
  const t = task(starter.taskId);
  const n = starter.steps.length;
  if (starter.i >= n) {
    const plan = blockPlanFor(t);
    const rows = plan
      ? plan.tasks.map((x) => `<li class="${x.status === 'done' ? 'is-done' : ''}">${markHTML(x.priority)} ${esc(x.title)} <span class="hint">${R.formatMinutes(x.minutes || 0)}</span></li>`).join('')
      : (t.needs || []).map((x) => `<li>${esc(x.text)}</li>`).join('');
    return `
    <div class="modal starter" data-form="starter">
      ${catSVG('happy')}
      <div class="starter-step">You started. That was the hard part.</div>
      <div class="starter-title">${esc(t.title)}</div>
      ${rows ? `<div class="starter-plan"><strong>${plan ? `The plan until ${t12m(R.toMinutes(plan.block.start) + plan.block.minutes)}` : 'To get it done'}</strong><ul>${rows}</ul></div>` : ''}
      <div class="modal-foot" style="justify-content:center"><button type="button" class="btn btn-dark" data-action="starter-close">Keep going</button></div>
    </div>`;
  }
  const mood = ['sad', 'meh', 'ok'][Math.min(starter.i, 2)];
  const pct = Math.round(((60 - starter.left) / 60) * 100);
  return `
  <div class="modal starter" data-form="starter">
    <div class="modal-head" style="justify-content:flex-end"><button type="button" class="btn btn-ghost icon-btn" data-action="starter-close" aria-label="Close">✕</button></div>
    ${catSVG(mood)}
    <div class="starter-step">Step ${starter.i + 1} of ${n} · 1 min</div>
    <div class="starter-text" id="modal-title">${esc(starter.steps[starter.i])}</div>
    <div class="starter-task">${esc(t.title)}</div>
    <div class="starter-timer" role="timer" aria-live="off"><div class="prog"><div style="width:${pct}%"></div></div><span class="starter-left">${starter.left ? `${starter.left}s` : 'Time. Ready for the next one?'}</span></div>
    <div class="modal-foot" style="justify-content:center">
      <button type="button" class="btn btn-dark btn-big" data-action="starter-next">${starter.i + 1 < n ? 'Done, next step' : 'Done, I started'}</button>
    </div>
  </div>`;
}

function stopStarterTimer() { if (starter && starter.timer) { clearInterval(starter.timer); starter.timer = null; } }

function showStarterStep() {
  stopStarterTimer();
  starter.left = 60;
  openModal(starterHTML());
  if (starter.i >= starter.steps.length) return;
  starter.timer = setInterval(() => {
    if (!starter || !modal.querySelector('[data-form="starter"]')) { stopStarterTimer(); return; }
    starter.left = Math.max(0, starter.left - 1);
    const left = modal.querySelector('.starter-left');
    const bar = modal.querySelector('.starter-timer .prog > div');
    if (left) left.textContent = starter.left ? `${starter.left}s` : 'Time. Ready for the next one?';
    if (bar) bar.style.width = `${Math.round(((60 - starter.left) / 60) * 100)}%`;
    if (!starter.left) stopStarterTimer();
  }, 1000);
}

function openStarter(t) {
  if (!t) return;
  const steps = stepsOf(t).length ? stepsOf(t) : R.templateSteps(t.title, t.place, t.computer !== false);
  stopStarterTimer();
  starter = { taskId: t.id, steps, i: 0, left: 60, timer: null };
  showStarterStep();
}

// When a deep work block begins, the start screen opens by itself (once per block).
function maybeAutoStart() {
  const { current } = currentAndNext();
  if (!current || current.type !== 'block' || nowMinutes() - current.start > 10) return;
  const day = getDay(todayKey());
  day.startShown = day.startShown || {};
  const blockKey = current.block.start;
  if (day.startShown[blockKey]) return;
  const t = current.block.taskIds.map(task).find((x) => x && x.status === 'open');
  if (!t) return;
  const first = (stepsOf(t)[0] || R.templateSteps(t.title, t.place, t.computer !== false)[0]);
  let shown = false;
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try { new Notification('First step (1 min)', { body: `${first}\nFor: ${t.title}`, tag: 'personal-io-start' }); shown = true; } catch { /* not allowed here */ }
  }
  if (!modal.open) { openStarter(t); shown = true; }
  if (!shown) return; // something else is open; try again next minute
  day.startShown[blockKey] = true;
  save(state);
}

// ----- tasks from your email (or a pasted list) -----

function emailHTML() {
  const ready = G.isConfigured() && AI.hasKey();
  return `
  <div class="modal" data-form="email">
    <div class="modal-head"><h2 id="modal-title">Find tasks in my email</h2>
      <button type="button" class="btn btn-ghost icon-btn" data-action="close-modal" aria-label="Close">✕</button></div>
    <div class="card card-pad" style="display:flex; flex-direction:column; gap:8px">
      <strong>Read my last 2 weeks</strong>
      <span>Looks at the subject, sender and the short preview of up to 40 emails (skipping promotions and social). Claude, with your key, picks out what you promised or were asked to do. You tick what to add. Nothing else is saved.</span>
      ${ready ? '' : `<div class="note note-warn">${!G.isConfigured() ? 'Set up Google in Settings first (step 1). ' : ''}${!AI.hasKey() ? 'Add your Claude key in Settings first.' : ''}</div>`}
      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap">
        <button type="button" class="btn btn-dark" data-action="email-scan" ${ready ? '' : 'disabled'}>Read my last 2 weeks</button>
        <span class="hint email-status">Google asks you to pick the account and allow read-only access.</span>
      </div>
    </div>
    <div class="card card-pad" style="display:flex; flex-direction:column; gap:8px">
      <strong>Or paste a list</strong>
      <span class="hint">For example, the tasks your Claude project found. One task per line.</span>
      <label class="visually-hidden" for="paste-text">Tasks, one per line</label>
      <textarea class="input" id="paste-text" style="min-height:110px" placeholder="Reply to Julia about the deck&#10;Send the TIPC draft to André"></textarea>
      <div><button type="button" class="btn" data-action="email-paste">Review these</button> <span class="hint paste-status"></span></div>
    </div>
  </div>`;
}

async function scanEmail(btn) {
  const origin = modal.querySelector('[data-form="email"]');
  const status = modal.querySelector('.email-status');
  btn.disabled = true;
  try {
    if (!G.gmailConnected()) { status.textContent = 'Waiting for Google...'; await G.connectGmail(); }
    status.textContent = 'Reading subjects and previews...';
    const emails = await G.recentEmails(14, 40);
    if (!emails.length) { if (origin.isConnected) status.textContent = 'No emails found in the last 2 weeks.'; return; }
    status.textContent = `Claude is reading ${emails.length} emails...`;
    const open = R.openTasks(state.tasks);
    const found = (await AI.tasksFromEmails(emails, state.goals, open.map((t) => t.title)))
      .filter((t) => !R.sameTitle(t.title, open))
      .map((t) => ({ ...t, priority: 'nice', pick: false, source: 'email' }));
    if (!found.length) { if (origin.isConnected) status.textContent = 'No clear tasks found. That is good news.'; else toast('No clear tasks found in your email.'); return; }
    talkDraft = { named: [], suggested: found, after: () => {}, prefix: '', heading: 'Tasks found in your email', suggestLabel: 'Tick the ones that are real tasks for you.' };
    showTalkReview(origin);
  } catch (err) {
    if (!origin.isConnected) { toast(`Email check stopped: ${err.message === 'not-connected' ? 'Google sign-in expired.' : err.message}`); return; }
    status.textContent = err.message === 'not-connected' ? 'Google sign-in expired. Try again.' : err.message;
  } finally {
    if (btn.isConnected) btn.disabled = false;
  }
}

function reviewPasted() {
  const text = modal.querySelector('#paste-text').value;
  const open = R.openTasks(state.tasks);
  const fallbackGoal = goal(ui.lastGoal) ? ui.lastGoal : 'life';
  const seen = [];
  const named = text.split('\n')
    .map(R.cleanListLine)
    .filter((l) => l.length > 1)
    .filter((l) => { if (seen.some((x) => R.normalTitle(x) === R.normalTitle(l))) return false; seen.push(l); return true; })
    .slice(0, 20)
    .map((title) => {
      const taken = !!R.sameTitle(title, open);
      return { title: title.charAt(0).toUpperCase() + title.slice(1), goalId: fallbackGoal, priority: 'nice', minutes: 30, pick: !taken, taken, source: 'paste' };
    });
  if (!named.length) { modal.querySelector('.paste-status').textContent = 'Paste at least one task, one per line.'; return; }
  talkDraft = { named, suggested: [], after: () => {}, prefix: '', heading: 'Add these tasks?' };
  openModal(talkReviewHTML());
}

// ----- goals -----

function renderGoals() {
  const cards = state.goals.map((g) => {
    const open = state.tasks.filter((t) => t.goalId === g.id && t.status === 'open');
    const done = state.tasks.filter((t) => t.goalId === g.id && t.status === 'done').length;
    return `
    <article class="card card-pad" style="display:flex; flex-direction:column; gap:8px">
      <div style="display:flex; justify-content:space-between; gap:8px; align-items:center">
        <h2 style="font-size:18px">${esc(g.title)}</h2>
        <button class="btn btn-small" data-action="edit-goal" data-id="${g.id}">Edit</button>
      </div>
      ${g.why ? `<div style="color: var(--ink-2)">Why: ${esc(g.why)}</div>` : ''}
      <div class="item-meta"><span>${open.length} open</span><span>${done} done</span></div>
      ${open.slice(0, 4).map((t) => `<div style="display:flex; gap:8px; align-items:center; font-size:14px">${markHTML(t.priority)} ${esc(t.title)}</div>`).join('')}
      <div><button class="btn-link" data-action="new-task" data-goal="${g.id}">+ Task for this goal</button></div>
    </article>`;
  }).join('');
  return `
  <section class="page-head">
    <div><h1>Goals</h1><div class="sub">The big outcomes. Every task serves one of them. Up to ${S().maxGoals}.</div></div>
    ${state.goals.length < S().maxGoals ? '<button class="btn btn-dark" data-action="new-goal">+ New goal</button>' : ''}
  </section>
  <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px">${cards}</div>`;
}

// ----- backlog -----

function renderBacklog() {
  const done = state.tasks.filter((t) => t.status === 'done').sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
  const trashed = state.tasks.filter((t) => t.status === 'trashed').sort((a, b) => (b.trashedAt || '').localeCompare(a.trashedAt || ''));
  const log = [...state.log].reverse().slice(0, 30);
  const resultWord = { done: 'Done', working: 'Still working', not_started: 'Not started' };
  return `
  <section class="page-head">
    <div><h1>Backlog</h1><div class="sub">Everything you haven't finished yet, grouped by priority.</div></div>
  </section>
  <div class="cols">
    <section class="col" style="flex: 1.4 1 420px">
      <div class="col-head"><h2>Tasks and their priorities</h2><button class="btn btn-small" data-action="new-task">+ Task with details</button></div>
      ${backlogGroupsHTML({ full: true })}
    </section>
    <section class="col" style="flex: 1 1 320px">
      <div class="col-head"><h2>Record</h2><span class="meta">What you did and didn't, and why</span></div>
      <div class="card table-scroll">
        ${log.length ? `<table class="record"><thead><tr><th>When</th><th>Task</th><th>Result</th></tr></thead><tbody>
          ${log.map((l) => `<tr><td class="mono">${esc(l.date ? fmtDay(l.date) : l.at.slice(0, 10))}</td><td>${esc(l.title)}</td><td>${resultWord[l.result]}${l.reason ? `<div class="hint">${esc(l.reason)}</div>` : ''}${l.leftOff ? `<div class="hint">Left off: ${esc(l.leftOff)}</div>` : ''}</td></tr>`).join('')}
        </tbody></table>` : '<div class="empty">Your block reviews will show up here.</div>'}
      </div>
      ${(state.journal || []).length ? `<div class="col-head"><h2>Day notes</h2></div>
      <div class="card list">${[...state.journal].reverse().slice(0, 10).map((j) => `<div class="item"><div class="item-main"><span class="mono">${esc(fmtDay(j.date))}</span><span>${esc(j.text)}</span></div></div>`).join('')}</div>` : ''}
      ${trashed.length ? `<div class="col-head"><h2>Trash</h2><span class="meta">Emptied after 30 days</span></div>
      <div class="card list">${trashed.slice(0, 10).map((t) => `<div class="item"><div class="item-main"><span class="item-title" style="color: var(--ink-2)">${esc(t.title)}</span></div>
        <button class="btn btn-small" data-action="untrash-task" data-id="${t.id}">Restore</button></div>`).join('')}</div>` : ''}
      <div class="col-head"><h2>Done</h2><span class="meta">${done.length} tasks</span></div>
      <div class="card list">${done.slice(0, ui.showDone ? 200 : 5).map((t) => `
        <div class="item"><div class="item-main"><span class="item-title" style="text-decoration: line-through; color: var(--muted)">${esc(t.title)}</span>
        <div class="item-meta">${esc(goal(t.goalId)?.title || '')}</div></div>
        <button class="btn btn-small" data-action="reopen-task" data-id="${t.id}">Reopen</button></div>`).join('') || '<div class="item"><span class="hint">Nothing finished yet.</span></div>'}
      ${done.length > 5 ? `<div class="item"><button class="btn-link" data-action="toggle-done">${ui.showDone ? 'Show less' : 'Show all'}</button></div>` : ''}
      </div>
    </section>
  </div>`;
}

// ---------- modals ----------

function openModal(html, wide = false) {
  modal.classList.toggle('wide', wide);
  modal.innerHTML = html;
  if (!modal.open) modal.showModal();
  const first = modal.querySelector('input, select, textarea');
  if (first) first.focus();
}
function closeModal() { modal.close(); modal.innerHTML = ''; }

function taskFormHTML(t, opts) {
  const draft = t || { priority: 'important', place: 'everywhere', goalId: opts.goalId || state.goals[0]?.id, minutes: 30, ...(opts.prefill || {}) };
  const pressed = (v, cur) => `aria-pressed="${v === cur}"`;
  const steps = stepsOf(draft);
  const mode = draft.stepsBy === 'me' ? 'me' : 'suggest';
  const computer = draft.computer !== undefined ? !!draft.computer : draft.place !== 'commute';
  const calDay = draft.fixedDate || opts.dayKey || draft.deadline || todayKey();
  return `
  <form class="modal" data-form="task" data-id="${t ? t.id : ''}" data-day="${esc(opts.dayKey || '')}" data-event-ref="${esc(draft.eventRef && !t ? JSON.stringify(draft.eventRef) : '')}" novalidate>
    <div class="modal-head"><h2 id="modal-title">${t ? 'Edit task' : 'New task'}</h2>
      <button type="button" class="btn btn-ghost icon-btn" data-action="close-modal" aria-label="Close">✕</button></div>
    <div class="errors" hidden></div>
    <div class="modal-cols">
    <div class="modal-main">
    <div class="field"><label for="f-title">What is the task?</label>
      <input class="input" id="f-title" name="title" value="${esc(draft.title || '')}" placeholder="Find emails for 3 climate investors" style="font-weight:600"></div>
    <div class="row">
      <div class="field"><label for="f-goal">Which goal does it serve?</label>
        <select class="input" id="f-goal" name="goalId">${state.goals.map((g) => `<option value="${g.id}" ${g.id === draft.goalId ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}</select></div>
      <div class="field"><span class="field-label" id="f-prio-l">Priority</span>
        <div class="seg priority" role="group" aria-labelledby="f-prio-l" data-group="priority">
          <button type="button" data-value="both" ${pressed('both', draft.priority)} aria-label="Important and urgent">${markHTML('both')}</button>
          <button type="button" data-value="important" ${pressed('important', draft.priority)} aria-label="Important">${markHTML('important')}</button>
          <button type="button" data-value="urgent" ${pressed('urgent', draft.priority)} aria-label="Urgent">${markHTML('urgent')}</button>
          <button type="button" data-value="nice" ${pressed('nice', draft.priority)} aria-label="Tasks for later">${markHTML('nice')}</button>
        </div></div>
    </div>
    <div class="row">
      <div class="field"><label for="f-deadline">Deadline</label>
        <input class="input" type="date" id="f-deadline" name="deadline" value="${esc(draft.deadline || '')}" data-change="form-deadline"></div>
      <div class="field"><label for="f-minutes">How long will it take? (minutes)</label>
        <input class="input" type="number" min="5" step="5" id="f-minutes" name="minutes" value="${esc(draft.minutes || '')}" data-change="form-cal-redraw">
        <span class="hint">Your best guess is enough. The plan finds the time.</span></div>
    </div>

    ${draft.progress ? `<div class="note note-info"><strong>Last time you left off:</strong> ${esc(draft.progress)}</div>` : ''}
    <section class="card card-pad" aria-label="First minute" style="display:flex; flex-direction:column; gap:10px">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap">
        <strong>First minute: 3 tiny steps to start</strong>
        <div class="pills" data-group="stepsBy">
          <button type="button" data-value="me" ${pressed('me', mode)}>I'll write them</button>
          <button type="button" data-value="suggest" ${pressed('suggest', mode)}>Suggest it</button>
        </div>
      </div>
      <div class="field"><span class="field-label" id="f-comp-l">Is it done on a computer?</span>
        <div class="pills" role="group" aria-labelledby="f-comp-l" data-group="computer">
          <button type="button" data-value="yes" ${pressed(true, computer)}>On a computer</button>
          <button type="button" data-value="no" ${pressed(false, computer)}>Away from the computer</button>
        </div></div>
      <div class="claude-row" ${mode === 'suggest' ? '' : 'hidden'}>
        <button type="button" class="btn btn-small" data-action="ask-claude">Suggest again</button>
        <span class="hint claude-status">${AI.hasKey() ? 'Steps fill in as you type the name. Claude makes them fit the task.' : 'Steps fill in as you type the name. For smarter ones, add a Claude key in Settings.'}</span>
      </div>
      ${[0, 1, 2].map((i) => `
        <div class="step-input"><span class="step-n">${i + 1}</span>
          <label class="visually-hidden" for="f-step${i}">Step ${i + 1}</label>
          <input class="input" id="f-step${i}" name="step${i}" value="${esc(steps[i] || '')}" placeholder="${['Close other windows and put the phone face down', 'Open the document or site you need', 'Do the very first action, like typing the heading'][i]}"></div>`).join('')}
    </section>

    <section aria-label="What this task needs" style="display:flex; flex-direction:column; gap:8px">
      <strong>What this task needs</strong>
      <table class="needs-table"><tbody>
        <tr><th scope="row">Where can I do it?</th><td>
          <div class="pills" data-group="place">
            <button type="button" data-value="everywhere" ${pressed('everywhere', draft.place)}>Everywhere</button>
            <button type="button" data-value="silent" ${pressed('silent', draft.place)}>Requires silent space</button>
            <button type="button" data-value="commute" ${pressed('commute', draft.place)}>Requires commuting</button>
          </div>
          <div class="row commute-fields" style="margin-top:10px" ${draft.place === 'commute' ? '' : 'hidden'}>
            <div class="field"><label for="f-dest">Where to</label><input class="input" id="f-dest" name="destination" value="${esc(draft.destination || '')}" placeholder="Ferry Building, SF"></div>
          </div>
          <div class="hint commute-fields" ${draft.place === 'commute' ? '' : 'hidden'}>Adds ${S().commuteMinutes} min of commute before it on your calendar.</div>
        </td></tr>
        <tr><th scope="row">Fixed time? (optional)</th><td>
          <div class="row" style="gap:8px">
            <div class="field" style="flex: 1 1 140px"><label for="f-date">Day</label>
              <input class="input" type="date" id="f-date" name="fixedDate" value="${esc(draft.fixedDate || '')}" data-change="form-cal-day"></div>
            <div class="field" style="flex: 1 1 200px"><span class="field-label">Time</span>
              ${timePickerHTML('fixedTime', draft.fixedTime, { id: 'f-time', optional: true })}</div>
          </div>
          <span class="hint">Only if it must happen at a set time, like a meeting. Drag on the calendar to pick the time and length. Leave it empty and the plan puts it in a deep work block.</span>
          <button type="button" class="btn-link" data-action="clear-fixed">Clear the fixed time</button>
        </td></tr>
        <tr><th scope="row">To get it done</th><td>
          <div class="field"><label class="visually-hidden" for="f-needs">To get it done</label>
          <textarea class="input" id="f-needs" name="needs" placeholder="One per line. Claude can fill this from the task and its goal.">${esc((draft.needs || []).map((n) => n.text).join('\n'))}</textarea></div>
        </td></tr>
      </tbody></table>
    </section>
    </div>
    <aside class="modal-side" aria-label="Calendar for the day">
      <div class="side-cal-head">
        <button type="button" class="btn btn-ghost icon-btn" data-action="side-cal-move" data-step="-1" aria-label="Previous day">‹</button>
        <strong id="side-cal-title">${esc(fmtDay(calDay, { weekday: 'long', month: 'short', day: 'numeric' }))}</strong>
        <button type="button" class="btn btn-ghost icon-btn" data-action="side-cal-move" data-step="1" aria-label="Next day">›</button>
      </div>
      <span class="hint side-hint">Press and drag down to set the time and length.</span>
      <div class="side-note" hidden></div>
      <div id="side-cal" data-day="${calDay}"></div>
    </aside>
    </div>
    <div class="modal-foot">
      ${t ? '<button type="button" class="btn" data-action="delete-task" style="color: var(--error)">Delete</button>' : ''}
      <button type="button" class="btn" data-action="copy-task" style="margin-right:auto" title="Save, then start a copy named Part 2">Save and copy as Part 2</button>
      <button type="button" class="btn" data-action="close-modal">Cancel</button>
      <button type="submit" class="btn btn-dark">${opts.dayKey ? 'Save and add to day' : 'Save to backlog'}</button>
    </div>
  </form>`;
}

const SIDE = { px: 28, startHour: 7, endHour: 22 };

// The task you are editing, drawn on the side calendar once it has a fixed day and time.
function draftCalendarItem(key) {
  const form = modal.querySelector('form[data-form="task"]');
  if (!form) return [];
  const date = form.querySelector('#f-date').value;
  const time = readTime(form, 'fixedTime');
  if (date !== key || !time) return [];
  const minutes = Number(form.querySelector('#f-minutes').value) || 30;
  return [{ start: R.toMinutes(time), minutes, cls: 'ev-draft', title: form.querySelector('#f-title').value.trim() || 'This task', sub: `${t12(time)} - ${t12m(R.toMinutes(time) + minutes)}` }];
}

function setSideDay(key) {
  const side = modal.querySelector('#side-cal');
  if (!side || !key) return;
  side.dataset.day = key;
  modal.querySelector('#side-cal-title').textContent = fmtDay(key, { weekday: 'long', month: 'short', day: 'numeric' });
  refreshSideCalendar();
}

function refreshSideCalendar() {
  const el = modal.querySelector('#side-cal');
  if (!el) return;
  const key = el.dataset.day;
  const extra = draftCalendarItem(key);
  const note = modal.querySelector('.side-note');
  const fixedDate = modal.querySelector('#f-date')?.value;
  const fixedTime = modal.querySelector('form[data-form="task"]') ? readTime(modal.querySelector('form[data-form="task"]'), 'fixedTime') : null;
  if (note) {
    const away = fixedDate && fixedTime && fixedDate !== key;
    note.hidden = !away;
    note.innerHTML = away ? `This task is set for ${esc(fmtDay(fixedDate))} at ${t12(fixedTime)}. <button type="button" class="btn-link" data-action="side-cal-fixed">Show that day</button>` : '';
  }
  const cached = G.isConnected() ? G.cachedDay(key) : null;
  el.innerHTML = timelineHTML([...ioItems(key), ...extra, ...(cached ? googleItems(key, cached) : [])], SIDE);
  fillCalendar('side-cal', key, { ...SIDE, extra });
}

// Fills the 3 steps from the template, unless you already wrote your own.
function autoSteps(form, { force = false } = {}) {
  if (pressedValue(form, 'stepsBy') === 'me') return;
  const title = form.querySelector('#f-title').value.trim();
  if (!title) return;
  const inputs = [0, 1, 2].map((i) => form.querySelector(`#f-step${i}`));
  const untouched = inputs.every((inp) => !inp.value.trim() || inp.dataset.auto === inp.value);
  if (!untouched && !force) return;
  const steps = R.templateSteps(title, pressedValue(form, 'place'), pressedValue(form, 'computer') !== 'no');
  inputs.forEach((inp, i) => { inp.value = steps[i]; inp.dataset.auto = steps[i]; });
}

// A second part of the same task, for buffer time: same goal, length and steps, no fixed time.
function openCopyOf(t) {
  const prefill = {
    title: R.nextPartTitle(t.title, state.tasks), goalId: t.goalId, priority: t.priority, deadline: t.deadline,
    minutes: t.minutes, place: t.place, destination: t.destination, computer: t.computer,
    firstSteps: [...(t.firstSteps || [])], stepsBy: t.stepsBy, needs: (t.needs || []).map((n) => ({ ...n, done: false })),
  };
  openModal(taskFormHTML(null, { prefill }), true);
  refreshSideCalendar();
  toast(`Saved. Now the copy: ${prefill.title}.`);
}

async function askClaude() {
  const form = modal.querySelector('form[data-form="task"]');
  const status = form.querySelector('.claude-status');
  const title = form.querySelector('#f-title').value.trim();
  if (!title) { status.textContent = 'Write the task name first.'; return; }
  const g = goal(form.querySelector('#f-goal').value);
  const place = pressedValue(form, 'place');
  const computer = pressedValue(form, 'computer') !== 'no';
  if (!AI.hasKey()) {
    // No Claude key: fill a simple template so there is always a way to start.
    autoSteps(form, { force: true });
    const needs = form.querySelector('#f-needs');
    if (!needs.value.trim()) needs.value = AI.FALLBACK_NEEDS;
    status.textContent = 'Simple steps filled in. Edit them to fit. For smarter ones, add a Claude key in Settings.';
    return;
  }
  status.textContent = 'Asking Claude...';
  const btn = form.querySelector('[data-action="ask-claude"]');
  btn.disabled = true;
  const inputs = [0, 1, 2].map((i) => form.querySelector(`#f-step${i}`));
  const before = inputs.map((inp) => inp.value);
  try {
    const out = await AI.suggestForTask({
      title, goal: g?.title, why: g?.why,
      minutes: Number(form.querySelector('#f-minutes').value) || null,
      place: R.PLACES[place] || null,
      computer,
    });
    if (!form.isConnected || form.querySelector('#f-title').value.trim() !== title) return; // the name changed; a newer answer will come
    let kept = 0;
    out.firstSteps.forEach((s, i) => {
      const inp = inputs[i];
      if (!inp) return;
      if (inp.value !== before[i]) { kept += 1; return; } // you typed here while Claude was thinking
      inp.value = s; inp.dataset.auto = s;
    });
    if (kept) { status.textContent = 'Done. Your own steps were kept.'; return; }
    const needs = form.querySelector('#f-needs');
    if (!needs.value.trim()) needs.value = out.toGetItDone.join('\n');
    status.textContent = 'Done. Edit anything that does not fit.';
  } catch (err) {
    if (form.isConnected) status.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

function goalFormHTML(g) {
  return `
  <form class="modal" data-form="goal" data-id="${g ? g.id : ''}" novalidate>
    <div class="modal-head"><h2 id="modal-title">${g ? 'Edit goal' : 'New goal'}</h2>
      <button type="button" class="btn btn-ghost icon-btn" data-action="close-modal" aria-label="Close">✕</button></div>
    <div class="errors" hidden></div>
    <div class="field"><label for="g-title">The outcome you want</label>
      <input class="input" id="g-title" name="title" value="${esc(g?.title || '')}" placeholder="Get a VC job"></div>
    <div class="field"><label for="g-why">Why it matters (one or two sentences)</label>
      <textarea class="input" id="g-why" name="why" maxlength="240" placeholder="It's the path to my own Latin America climate fund.">${esc(g?.why || '')}</textarea></div>
    <div class="modal-foot">
      ${g && g.id !== 'life' ? '<button type="button" class="btn" data-action="delete-goal" style="margin-right:auto; color: var(--error)">Delete</button>' : ''}
      <button type="button" class="btn" data-action="close-modal">Cancel</button>
      <button type="submit" class="btn btn-dark">Save goal</button>
    </div>
  </form>`;
}

function reviewHTML(blockIndex) {
  const day = getDay(todayKey());
  const block = day.plan.blocks[blockIndex];
  const tasks = block.taskIds.map(task).filter((t) => t && t.status === 'open');
  const end = t12m(R.toMinutes(block.start) + block.minutes);
  const rows = tasks.map((t) => `
    <div class="review-task" data-task="${t.id}">
      <div style="display:flex; gap:8px; align-items:center">${markHTML(t.priority)} <strong>${esc(t.title)}</strong></div>
      <div class="pills result" data-group="result-${t.id}">
        <button type="button" data-value="done" aria-pressed="false">Done</button>
        <button type="button" data-value="working" aria-pressed="false">Still working</button>
        <button type="button" data-value="not_started" aria-pressed="false">Not started</button>
      </div>
      <div class="reason" hidden>
        <div class="field-label" style="margin-bottom:6px">What got in the way?</div>
        <div class="pills" data-group="reason-${t.id}">${R.REASONS.map((r) => `<button type="button" data-value="${esc(r)}" aria-pressed="false">${esc(r)}</button>`).join('')}</div>
        <div class="field" style="margin-top:10px"><label for="left-${t.id}">Where did you leave off?</label>
          <input class="input" id="left-${t.id}" placeholder="Drafted the intro, stuck on the market size" value="${esc(t.progress || '')}"></div>
      </div>
    </div>`).join('');
  return `
  <form class="modal" data-form="review" data-block="${blockIndex}" novalidate>
    <div class="modal-head"><div><div class="date-line">Block ${t12(block.start)} - ${end}</div><h2 id="modal-title">How did it go?</h2></div>
      <button type="button" class="btn btn-ghost icon-btn" data-action="close-modal" aria-label="Close">✕</button></div>
    <div class="hint">Anything not done goes back to your backlog.</div>
    <div class="errors" hidden></div>
    ${rows || '<div class="empty">Everything in this block is already done.</div>'}
    <div class="modal-foot">
      <button type="button" class="btn" data-action="close-modal">Cancel</button>
      <button type="submit" class="btn btn-dark">Save</button>
    </div>
  </form>`;
}

function settingsHTML() {
  const gState = !G.isConfigured() ? 'Not set up yet.' : G.isConnected() ? 'Connected.' : 'Set up. Click Connect to sign in.';
  return `
  <form class="modal" data-form="settings" novalidate>
    <div class="modal-head"><h2 id="modal-title">Settings</h2>
      <button type="button" class="btn btn-ghost icon-btn" data-action="close-modal" aria-label="Close">✕</button></div>
    <div class="errors" hidden></div>
    <div class="row">
      <div class="field"><label for="s-commute">Commute time before a task (minutes)</label>
        <input class="input" type="number" min="0" step="5" id="s-commute" name="commuteMinutes" value="${S().commuteMinutes}"></div>
      <div class="field"><label for="s-starts">Deep work blocks start at</label>
        <input class="input" id="s-starts" name="blockStarts" value="${esc(S().blockStarts.map(t12).join(', '))}">
        <span class="hint">Separate with commas, like 8:00 AM, 2:30 PM</span></div>
    </div>
    <div class="field"><label for="s-stale">Ask "still important?" after (days)</label>
      <input class="input" type="number" min="3" id="s-stale" name="staleDays" value="${S().staleDays}" style="max-width:160px"></div>

    <div class="card card-pad" style="display:flex; flex-direction:column; gap:10px">
      <strong>Google Calendar</strong>
      <div class="step-box" style="align-items:flex-start">
        <span class="step-n">1</span>
        <div style="flex:1; display:flex; flex-direction:column; gap:6px">
          <strong>Register the app</strong>
          <span class="hint">The Client ID from your Google Cloud project. It's only the app's name tag; it does not open any calendar.</span>
          <label class="visually-hidden" for="s-gid">Google Client ID</label>
          <input class="input" id="s-gid" name="googleClientId" value="${esc(G.getClientId())}" placeholder="1234...apps.googleusercontent.com" autocomplete="off">
          ${G.isConfigured() ? '<span class="chip chip-done" style="align-self:flex-start">Registered</span>' : ''}
        </div>
      </div>
      <div class="step-box" style="align-items:flex-start">
        <span class="step-n">2</span>
        <div style="flex:1; display:flex; flex-direction:column; gap:6px">
          <strong>Connect your calendar</strong>
          <span class="hint">Click Connect and pick the account whose calendar you want, for example your @berkeley.edu.</span>
          ${G.isConnected()
            ? `<span class="chip chip-done" style="align-self:flex-start">Connected${G.connectedName() ? ' to ' + esc(G.connectedName()) : ''}</span>
               <button type="button" class="btn btn-small" style="align-self:flex-start" data-action="connect-google">Switch account</button>`
            : G.isConfigured()
              ? '<button type="button" class="btn btn-dark btn-small" style="align-self:flex-start" data-action="connect-google">Connect Google Calendar</button>'
              : '<span class="hint">Do step 1 and save first.</span>'}
        </div>
      </div>
      <details>
        <summary class="hint" style="cursor:pointer">Plan B: use a calendar shared with you</summary>
        <div class="field" style="margin-top:8px"><label for="s-calid">Which calendar</label>
          <input class="input" id="s-calid" name="googleCalendarId" value="${esc(G.getCalendarId())}" placeholder="Leave empty for the connected account's own calendar" autocomplete="off">
          <span class="hint">Only if Berkeley blocks step 2: share your Berkeley calendar with your personal Gmail, connect with the personal one, and write your Berkeley email here.</span></div>
      </details>
    </div>

    <div class="card card-pad" style="display:flex; flex-direction:column; gap:10px">
      <strong>Claude (steps, notes and email)</strong>
      <span class="hint">An API key from <strong>console.anthropic.com</strong> (API keys), not your Claude chat subscription. It starts with <span class="mono">sk-ant-</span> and needs a little credit under Billing. Saved only in this browser profile, never on GitHub.</span>
      <div class="field"><label for="s-key">Claude API key</label>
        <input class="input" type="password" id="s-key" name="claudeKey" value="${esc(AI.getKey())}" placeholder="sk-ant-api03-..." autocomplete="off"></div>
      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap">
        <button type="button" class="btn btn-small" data-action="test-key">Check the key</button>
        <span class="hint key-status">${AI.hasKey() ? (AI.looksLikeKey(AI.getKey()) ? 'A key is saved.' : 'The saved key does not look like a Claude API key.') : 'No key saved yet.'}</span>
      </div>
    </div>

    <div class="card card-pad" style="display:flex; flex-direction:column; gap:10px">
      <strong>Backup</strong>
      <span class="hint">Your goals and tasks are saved in this browser. Download a backup now and then.</span>
      <div style="display:flex; gap:8px; flex-wrap:wrap">
        <button type="button" class="btn" data-action="export">Download backup</button>
        <label class="btn" for="s-import" style="cursor:pointer">Restore from backup</label>
        <input type="file" id="s-import" accept="application/json" class="visually-hidden" data-change="import">
      </div>
    </div>
    <div class="modal-foot">
      <button type="button" class="btn" data-action="close-modal">Cancel</button>
      <button type="submit" class="btn btn-dark">Save settings</button>
    </div>
  </form>`;
}

// ---------- actions ----------

function addToDay(taskId, dayKey) {
  const day = getDay(dayKey);
  if (day.taskIds.includes(taskId)) return;
  if (day.taskIds.length >= day.slots) {
    toast(day.slots < S().daySlotsMax ? 'All slots are full. Open another slot first.' : `${S().daySlotsMax} tasks is the most for one day.`);
    return;
  }
  const rank = (t) => (t ? R.PRIORITY_ORDER.indexOf(t.priority) : 99);
  const mine = rank(task(taskId));
  const at = day.taskIds.findIndex((id) => rank(task(id)) > mine);
  if (at === -1) day.taskIds.push(taskId); else day.taskIds.splice(at, 0, taskId);
  if (day.plan) day.planStale = true;
  persist();
}

// "What's on your mind?" One line becomes a 🤔 task, or a logged win.
function quickCapture(alreadyDone) {
  const input = document.getElementById('cap-text');
  if (!input) return;
  const title = input.value.trim().replace(/\s+/g, ' ');
  if (!title) {
    input.setAttribute('aria-invalid', 'true');
    input.focus();
    toast(alreadyDone ? 'Write what you did first.' : 'Write the task first.');
    return;
  }
  const nowIso = new Date().toISOString();
  const existing = R.sameTitle(title, R.openTasks(state.tasks));
  if (alreadyDone) {
    let t = existing;
    if (t) Object.assign(t, { status: 'done', doneAt: nowIso, lastTouchedAt: nowIso, progress: '' });
    else {
      t = { id: newId(), status: 'done', createdAt: nowIso, doneAt: nowIso, lastTouchedAt: nowIso, pushCount: 0, title, goalId: 'life', priority: 'nice', deadline: '', minutes: 30, firstSteps: [], firstStep: '', stepsBy: 'me', place: 'everywhere', destination: '', fixedDate: '', fixedTime: null, needs: [], source: 'logged' };
      state.tasks.push(t);
    }
    state.log.push({ at: nowIso, date: todayKey(), taskId: t.id, title: t.title, result: 'done', reason: null });
    persist([existing ? `Marked done: ${t.title}` : `Logged as done: ${t.title}`]);
  } else {
    if (existing) { input.setAttribute('aria-invalid', 'true'); toast(`"${existing.title}" is already in your list.`); return; }
    state.tasks.push({ id: newId(), status: 'open', createdAt: nowIso, lastTouchedAt: nowIso, pushCount: 0, title, goalId: 'life', priority: 'nice', deadline: '', minutes: 30, firstSteps: [], firstStep: '', stepsBy: 'me', place: 'everywhere', destination: '', fixedDate: '', fixedTime: null, needs: [], promotionBlocked: false, source: 'capture' });
    ui.open.nice = true;
    persist([`Added to 🤔 Tasks for later: ${title}. Give it a priority when you are ready.`]);
  }
  document.getElementById('cap-text')?.focus();
}

// A changed event may overlap blocks already built; flag those days to rebuild.
function markPlansStale(e) {
  if (!e) return;
  const from = todayKey();
  Object.entries(state.days).forEach(([key, day]) => {
    if (key < from || !day.plan) return;
    if (R.eventsOn([e], key).length) day.planStale = true;
  });
}

function googleItemsFor(day) {
  const items = day.plan.blocks.map((b) => {
    const tasks = b.taskIds.map(task).filter(Boolean);
    return {
      title: `Deep work · ${blockGoalNames(b) || 'Personal IO'}`,
      start: b.start, minutes: b.minutes, color: b.color,
      description: tasks.map((t) => `${R.PRIORITIES[t.priority].mark} ${t.title}${stepsOf(t).length ? '\n   First minute: ' + stepsOf(t).join(' / ') : ''}`).join('\n'),
    };
  });
  day.plan.events.forEach((e) => {
    const t = task(e.taskId);
    items.push({ title: e.title, start: e.start, minutes: e.minutes, color: e.kind === 'commute' ? 'commute' : R.colorForTasks(t ? [t] : []) });
  });
  return items;
}

async function setPlan(dayKey) {
  const day = getDay(dayKey);
  if ('Notification' in window && Notification.permission === 'default') {
    try { Notification.requestPermission(); } catch { /* not supported */ }
  }
  const msgs = [];
  if (G.isConfigured()) {
    try {
      if (!G.isConnected()) await G.connect();
      day.googleIds = await G.writeDay(dayKey, googleItemsFor(day), day.googleIds || []);
      msgs.push('Blocks added to your Google Calendar.');
    } catch (err) {
      msgs.push(`Plan set, but Google Calendar was not updated: ${err.message === 'not-connected' ? 'sign-in needed' : err.message}`);
    }
  }
  day.set = true;
  day.setAt = new Date().toISOString();
  const lastReturn = (state.returns || []).slice(-1)[0];
  if (lastReturn && lastReturn.date === todayKey()) lastReturn.plannedAfter = true;
  save(state);
  if (dayKey === todayKey()) {
    location.hash = '#today';
    msgs.unshift('Plan set. Here is your day.');
  } else {
    msgs.unshift("Tomorrow's plan is set.");
    render();
  }
  msgs.forEach(toast);
}

const actions = {
  'plan-day': (el) => { ui.planDay = el.dataset.day; render(); },
  'go-plan-today': () => { ui.planDay = 'today'; location.hash = '#start'; },
  'filter-goal': (el) => { ui.goalFilter = ui.goalFilter === el.dataset.id ? null : el.dataset.id; render(); },
  'clear-filter': () => { ui.goalFilter = null; render(); },
  'toggle-group': (el) => { const g = el.dataset.groupName; ui.open[g] = !ui.open[g]; render(); },
  'toggle-done': () => { ui.showDone = !ui.showDone; render(); },
  'add-to-day': (el) => addToDay(el.dataset.id, el.dataset.day),
  'remove-from-day': (el) => {
    const day = getDay(el.dataset.day);
    day.taskIds = day.taskIds.filter((id) => id !== el.dataset.id);
    if (day.plan) day.planStale = true;
    persist();
  },
  'open-slot': (el) => {
    const day = getDay(el.dataset.day);
    if (day.slots < S().daySlotsMax) day.slots += 1;
    persist();
  },
  'build-day': async (el) => {
    const key = el.dataset.day;
    const day = getDay(key);
    // Tasks that are calendar events already have their time; blocks are for the rest, in your order.
    const tasks = day.taskIds.map(task).filter((t) => t && t.status === 'open' && !t.eventRef);
    let googleNote = '';
    if (G.isConnected()) {
      // Refresh Google events for this day so blocks go around the latest ones.
      try {
        const fresh = (await G.eventsForDay(key, { fresh: true })).filter((e) => !e.allDay && !e.fromApp);
        googleNote = ` Planned around ${fresh.length} Google event${fresh.length === 1 ? '' : 's'}.`;
      } catch { googleNote = ' (Google sign-in expired, so Google events were not checked.)'; }
    }
    const busy = calendarItems(key).map((c) => ({ start: c.start, minutes: c.minutes, commute: c.commute }));
    day.plan = R.buildDay(tasks, S(), busy, { keepOrder: true });
    day.planStale = false;
    day.set = false;
    day.reviewed = {};
    const msgs = [`Built ${day.plan.blocks.length} deep work block${day.plan.blocks.length === 1 ? '' : 's'}.${googleNote} Check them, then set the plan.`];
    if (day.plan.didNotFit.length) msgs.push(`${day.plan.didNotFit.length} task(s) didn't fit. Add another block time in Settings or move them.`);
    persist(msgs);
  },
  'set-plan': (el) => setPlan(el.dataset.day),
  'cal-item': (el) => {
    const c = calendarItems(el.dataset.date).find((x) => x.src === el.dataset.src && x.id === el.dataset.id);
    if (!c) { toast('That event is no longer on your calendar.'); return; }
    openModal(calItemHTML(c));
  },
  'cal-prioritize': (el) => {
    const { root, c } = calFromModal();
    if (!c) { closeModal(); return; }
    const goalId = root.querySelector('#ci-goal').value;
    const draft = taskFromCalendar(c, { priority: el.dataset.priority, goalId });
    const problems = R.validateTask(draft, state.tasks, todayKey(), S());
    if (problems.length) { showErrors(root, problems); return; }
    state.tasks.push(draft);
    ui.lastGoal = goalId;
    const placed = addCalendarTaskToDay(draft, c.date);
    closeModal();
    persist([`${R.PRIORITIES[draft.priority].mark} ${draft.title} is in your ${R.PRIORITIES[draft.priority].label} list.${placed ? '' : ' (That day already has 7 tasks.)'}`]);
  },
  'cal-done': () => {
    const { root, c } = calFromModal();
    if (!c) { closeModal(); return; }
    const nowIso = new Date().toISOString();
    const t = taskFromCalendar(c, { priority: 'nice', deadline: '', goalId: root.querySelector('#ci-goal').value, status: 'done', doneAt: nowIso });
    state.tasks.push(t);
    state.log.push({ at: nowIso, date: todayKey(), taskId: t.id, title: t.title, result: 'done', reason: null });
    closeModal();
    persist([`Logged as done: ${t.title}`]);
  },
  'cal-details': () => {
    const { root } = calFromModal();
    if (root) actions['event-to-task']({ dataset: { ...root.dataset } });
  },
  'cal-edit-own': () => {
    const { root } = calFromModal();
    const e = root && state.events.find((x) => x.id === root.dataset.id);
    if (e) openModal(eventFormHTML(e));
  },
  'cal-untrack': (el) => {
    const id = el.dataset.id;
    state.tasks = state.tasks.filter((t) => t.id !== id);
    Object.values(state.days).forEach((d) => { d.taskIds = d.taskIds.filter((x) => x !== id); });
    closeModal();
    persist(['Removed from your list. The calendar event stays.']);
  },
  'trash-task': (el) => {
    const t = task(el.dataset.id);
    if (!t) return;
    const from = [];
    Object.entries(state.days).forEach(([key, d]) => {
      if (!d.taskIds.includes(t.id)) return;
      from.push(key);
      d.taskIds = d.taskIds.filter((x) => x !== t.id);
      if (d.plan) d.planStale = true;
    });
    Object.assign(t, { status: 'trashed', trashedAt: new Date().toISOString(), trashedFrom: from });
    persist();
    toast(`Trashed: ${t.title}`, { label: 'Undo', data: { action: 'untrash-task', id: t.id } });
  },
  'untrash-task': (el) => {
    const t = task(el.dataset.id);
    if (!t || t.status !== 'trashed') return;
    const check = (priority) => R.validateTask({ ...t, priority, status: 'open' }, state.tasks, todayKey(), S());
    let note = '';
    if (check(t.priority).length) {
      if (check('nice').length) { toast(check(t.priority)[0]); return; }
      note = ` ${R.PRIORITIES[t.priority].mark} is full now, so it came back as 🤔 Tasks for later.`;
      t.priority = 'nice';
    }
    t.status = 'open';
    (t.trashedFrom || []).forEach((key) => { const d = state.days[key]; if (d && !d.taskIds.includes(t.id) && d.taskIds.length < d.slots) { d.taskIds.push(t.id); if (d.plan) d.planStale = true; } });
    delete t.trashedFrom;
    persist([`Back in your list: ${t.title}.${note}`]);
  },
  'busy-prio': (el) => {
    const c = calendarItems(el.dataset.date).find((x) => x.src === el.dataset.src && x.id === el.dataset.id);
    if (!c) return;
    const draft = taskFromCalendar(c, { priority: el.dataset.priority, goalId: goal(ui.lastGoal) ? ui.lastGoal : 'life' });
    const problems = R.validateTask(draft, state.tasks, todayKey(), S());
    if (problems.length) { toast(problems[0]); return; }
    state.tasks.push(draft);
    addCalendarTaskToDay(draft, c.date);
    persist([`${R.PRIORITIES[draft.priority].mark} ${draft.title} is in your task list. Click it to change the goal.`]);
  },
  'busy-ok': (el) => { getDay(el.dataset.day).busyOk = true; persist(); },
  'start-task': (el) => openStarter(task(el.dataset.id)),
  'starter-next': () => { if (!starter) return; starter.i += 1; showStarterStep(); },
  'starter-close': () => { stopStarterTimer(); starter = null; closeModal(); },
  'copy-task': () => {
    const form = modal.querySelector('form[data-form="task"]');
    if (!form) return;
    form.dataset.thenCopy = '1';
    form.requestSubmit();
  },
  'side-cal-move': (el) => {
    const side = modal.querySelector('#side-cal');
    if (side) setSideDay(R.addDays(side.dataset.day, Number(el.dataset.step)));
  },
  'clear-fixed': () => {
    const form = modal.querySelector('form[data-form="task"]');
    form.querySelector('[name="fixedTime_h"]').value = '';
    form.querySelector('#f-date').value = '';
    refreshSideCalendar();
  },
  'test-key': async () => {
    const input = modal.querySelector('#s-key');
    const status = modal.querySelector('.key-status');
    const key = input.value.trim();
    if (!AI.looksLikeKey(key)) { status.textContent = 'That is not a Claude API key. It starts with sk-ant- and comes from console.anthropic.com > API keys.'; return; }
    status.textContent = 'Checking...';
    try {
      await AI.testKey(key);
      AI.setKey(key);
      status.textContent = 'It works. Claude is connected in this browser profile.';
    } catch (err) { status.textContent = err.message; }
  },
  'open-email': () => openModal(emailHTML()),
  'talk-review-open': () => { if (talkDraft) openModal(talkReviewHTML()); },
  'side-cal-fixed': () => setSideDay(modal.querySelector('#f-date').value),
  'email-scan': (el) => scanEmail(el),
  'email-paste': () => reviewPasted(),
  'quick-add': () => quickCapture(false),
  'quick-done': () => quickCapture(true),
  'welcome-start': () => closeWelcome(true),
  'welcome-close': () => closeWelcome(false),
  'event-to-task': (el) => {
    const c = calendarItems(el.dataset.date).find((x) => x.src === el.dataset.src && x.id === el.dataset.id);
    if (!c) { toast('That event is no longer on your calendar.'); return; }
    if (state.goals.length === 0) { openModal(goalFormHTML(null)); return; }
    const taken = R.sameTitle(c.title, R.openTasks(state.tasks));
    const prefill = {
      title: taken ? `${c.title} (${fmtDay(c.date)})` : c.title,
      fixedDate: c.date, fixedTime: c.start, minutes: c.minutes, deadline: c.date,
      priority: R.isUrgentByDate({ deadline: c.date }, todayKey(), S()) ? 'both' : 'important',
      place: c.commute ? 'commute' : 'everywhere',
      eventRef: { src: c.src, id: c.id, date: c.date },
    };
    openModal(taskFormHTML(null, { prefill }), true);
    refreshSideCalendar();
  },
  'connect-google': async () => {
    try {
      await G.connect();
      toast(G.connectedName() ? `Connected to ${G.connectedName()}.` : 'Google Calendar connected.');
      if (modal.querySelector('form[data-form="settings"]')) openModal(settingsHTML());
      render(); refreshSideCalendar();
    } catch (err) { toast(err.message); }
  },
  'new-task': (el) => {
    if (state.goals.length === 0) { openModal(goalFormHTML(null)); return; }
    openModal(taskFormHTML(null, { dayKey: el.dataset.day, goalId: el.dataset.goal }), true);
    refreshSideCalendar();
  },
  'edit-task': (el) => { openModal(taskFormHTML(task(el.dataset.id), {}), true); refreshSideCalendar(); },
  'ask-claude': () => askClaude(),
  'complete-task': (el) => {
    const t = task(el.dataset.id);
    Object.assign(t, { status: 'done', doneAt: new Date().toISOString(), lastTouchedAt: new Date().toISOString() });
    state.log.push({ at: new Date().toISOString(), date: todayKey(), taskId: t.id, title: t.title, result: 'done', reason: null });
    persist([`Done: ${t.title}`]);
  },
  'reopen-task': (el) => { Object.assign(task(el.dataset.id), { status: 'open', doneAt: null }); persist(); },
  'keep-task': (el) => { task(el.dataset.id).lastTouchedAt = new Date().toISOString(); persist(['Kept. It stays important.']); },
  'demote-task': (el) => { Object.assign(task(el.dataset.id), { priority: 'nice', lastTouchedAt: new Date().toISOString() }); persist(['Moved to tasks for later.']); },
  'delete-task': () => {
    const id = modal.querySelector('form').dataset.id;
    if (!confirm('Delete this task for good?')) return;
    state.tasks = state.tasks.filter((t) => t.id !== id);
    Object.values(state.days).forEach((d) => { d.taskIds = d.taskIds.filter((x) => x !== id); });
    closeModal();
    persist(['Task deleted.']);
  },
  'new-goal': () => openModal(goalFormHTML(null)),
  'edit-goal': (el) => openModal(goalFormHTML(goal(el.dataset.id))),
  'delete-goal': () => {
    const id = modal.querySelector('form').dataset.id;
    if (openCount(id) > 0) { toast('This goal still has open tasks. Finish or move them first.'); return; }
    if (!confirm('Delete this goal?')) return;
    state.goals = state.goals.filter((g) => g.id !== id);
    closeModal();
    persist(['Goal deleted.']);
  },
  'cal-move': (el) => { ui.calDay = R.addDays(ui.calDay || todayKey(), Number(el.dataset.step)); render(); },
  'cal-today': () => { ui.calDay = todayKey(); render(); },
  'new-event': () => openModal(eventFormHTML(null, ui.calDay)),
  'edit-event': (el) => { const e = state.events.find((x) => x.id === el.dataset.id); if (e) openModal(eventFormHTML(e)); },
  'delete-event': () => {
    const id = modal.querySelector('form').dataset.id;
    const e = state.events.find((x) => x.id === id);
    if (!confirm(e && e.repeat === 'weekly' ? 'Delete this event and all its weekly repeats?' : 'Delete this event?')) return;
    state.events = state.events.filter((x) => x.id !== id);
    markPlansStale(e);
    closeModal();
    persist(['Event deleted.']);
  },
  'open-dump': () => openModal(talkHTML(), false),
  'mic': (el) => toggleMic(el),
  'talk-save': (el) => {
    const text = (modal.querySelector('#talk-text')?.value || '').trim();
    if (!text) { modal.querySelector('.talk-status').textContent = 'Say or type something first.'; return; }
    handleTalk(text, { button: el });
  },
  'talk-add': () => addTalkTasks(),
  'talk-skip': () => {
    const after = talkDraft ? talkDraft.after : () => {};
    const prefix = talkDraft ? talkDraft.prefix : '';
    const wasNote = !(talkDraft && talkDraft.heading);
    talkDraft = null; closeModal(); after(); render(); toast(wasNote ? `${prefix}Note saved.` : 'Nothing added.');
  },
  'review': (el) => openModal(reviewHTML(Number(el.dataset.block))),
  'open-settings': () => openModal(settingsHTML()),
  'export': () => exportBackup(state),
  'close-modal': () => closeModal(),
};

document.addEventListener('click', (e) => {
  // Toggle buttons inside a group (priority, place, results, reasons, who writes steps).
  const pick = e.target.closest('[data-group] > button');
  if (pick) {
    const group = pick.parentElement;
    group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === pick)));
    const name = group.dataset.group;
    const taskForm = modal.querySelector('form[data-form="task"]');
    if (name === 'place') {
      modal.querySelectorAll('.commute-fields').forEach((n) => { n.hidden = pick.dataset.value !== 'commute'; });
      if (taskForm) autoSteps(taskForm);
    }
    if (name === 'computer' && taskForm) autoSteps(taskForm);
    if (name === 'stepsBy') {
      modal.querySelector('.claude-row').hidden = pick.dataset.value !== 'suggest';
      if (pick.dataset.value === 'suggest' && modal.querySelector('#f-title').value.trim()) askClaude();
    }
    if (name.startsWith('result-')) {
      const reason = group.closest('.review-task').querySelector('.reason');
      reason.hidden = pick.dataset.value === 'done';
    }
    return;
  }
  const el = e.target.closest('[data-action]');
  if (el && el.dataset.action === 'cal-item' && el.closest('#side-cal')) return;
  if (el && actions[el.dataset.action]) {
    e.preventDefault();
    actions[el.dataset.action](el);
  }
});

document.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.dataset.change === 'intention') {
    getDay(el.dataset.day).intention = el.value.trim();
    save(state);
  } else if (el.dataset.change === 'set-time') {
    const t = task(el.dataset.id);
    t.fixedTime = readTime(el.closest('.time-pick'), `slottime-${t.id}`);
    const day = Object.values(state.days).find((d) => d.taskIds.includes(t.id) && d.plan);
    if (day) day.planStale = true;
    persist();
  } else if (el.dataset.change === 'form-cal-day') {
    if (el.value) setSideDay(el.value); else refreshSideCalendar();
  } else if (el.dataset.change === 'form-deadline') {
    if (el.value && !modal.querySelector('#f-date').value) setSideDay(el.value);
  } else if (el.dataset.change === 'form-cal-redraw' || (el.name && el.name.startsWith('fixedTime_') && el.closest('form[data-form="task"]'))) {
    refreshSideCalendar();
  } else if (el.id === 'f-title' && AI.hasKey()) {
    // With a Claude key, smarter steps arrive once you finish typing the name (unless you wrote your own).
    const form = el.closest('form');
    const inputs = [0, 1, 2].map((i) => form.querySelector(`#f-step${i}`));
    const untouched = inputs.every((inp) => !inp.value.trim() || inp.dataset.auto === inp.value);
    if (pressedValue(form, 'stepsBy') !== 'me' && untouched && el.value.trim()) askClaude();
  } else if (el.dataset.change === 'import') {
    try {
      state = await readBackup(el.files[0]);
      save(state);
      closeModal();
      render();
      toast('Backup restored.');
    } catch (err) {
      toast(err.message);
    }
  }
});

function pressedValue(root, group) {
  return root.querySelector(`[data-group="${group}"] [aria-pressed="true"]`)?.dataset.value || null;
}

function showErrors(form, problems) {
  const box = form.querySelector('.errors');
  box.hidden = problems.length === 0;
  box.innerHTML = problems.length ? `<strong>Almost there:</strong><ul>${problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '';
  if (problems.length) box.scrollIntoView({ block: 'nearest' });
}

modal.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const data = new FormData(form);
  const kind = form.dataset.form;

  if (kind === 'task') {
    const thenCopy = form.dataset.thenCopy === '1';
    delete form.dataset.thenCopy;
    const existing = form.dataset.id ? task(form.dataset.id) : null;
    const nowIso = new Date().toISOString();
    const firstSteps = [0, 1, 2].map((i) => (data.get(`step${i}`) || '').trim()).filter(Boolean);
    const draft = {
      ...(existing || { id: newId(), status: 'open', createdAt: nowIso, pushCount: 0 }),
      title: data.get('title').trim(),
      goalId: data.get('goalId'),
      priority: pressedValue(form, 'priority') || 'important',
      deadline: data.get('deadline') || '',
      minutes: Number(data.get('minutes')) || 0,
      firstSteps,
      firstStep: firstSteps[0] || '',
      stepsBy: pressedValue(form, 'stepsBy') || 'me',
      computer: pressedValue(form, 'computer') !== 'no',
      place: pressedValue(form, 'place') || 'everywhere',
      destination: (data.get('destination') || '').trim(),
      fixedDate: data.get('fixedDate') || '',
      fixedTime: readTime(form, 'fixedTime'),
      needs: data.get('needs').split('\n').map((s) => s.trim()).filter(Boolean).map((text) => ({ text, done: false })),
      lastTouchedAt: nowIso,
      promotionBlocked: false,
      eventRef: (existing && existing.eventRef) || (form.dataset.eventRef ? JSON.parse(form.dataset.eventRef) : null),
    };
    const problems = R.validateTask(draft, state.tasks, todayKey(), S());
    if (problems.length) { showErrors(form, problems); return; }
    if (existing) Object.assign(existing, draft); else state.tasks.push(draft);
    closeModal();
    if (form.dataset.day) addToDay(draft.id, form.dataset.day);
    persist([existing ? 'Task updated.' : 'Task saved to your backlog.']);
    if (thenCopy) openCopyOf(draft);
  }

  if (kind === 'goal') {
    const title = data.get('title').trim();
    const why = data.get('why').trim();
    const problems = [];
    if (!title) problems.push('Name the outcome you want.');
    if (!why) problems.push('Write why it matters, in a sentence or two.');
    if (!form.dataset.id && state.goals.length >= S().maxGoals) problems.push('10 goals is the limit.');
    if (problems.length) { showErrors(form, problems); return; }
    if (form.dataset.id) Object.assign(goal(form.dataset.id), { title, why });
    else state.goals.push({ id: newId(), title, why, createdAt: new Date().toISOString() });
    closeModal();
    persist(['Goal saved.']);
  }

  if (kind === 'review') {
    const index = Number(form.dataset.block);
    const outcomes = {};
    const problems = [];
    form.querySelectorAll('.review-task').forEach((row) => {
      const id = row.dataset.task;
      const result = pressedValue(row, `result-${id}`);
      if (!result) { problems.push(`Pick an answer for "${task(id).title}".`); return; }
      const reason = result === 'done' ? null : pressedValue(row, `reason-${id}`);
      const leftOff = result === 'done' ? '' : (row.querySelector(`#left-${id}`)?.value || '').trim();
      outcomes[id] = { result, reason, leftOff };
    });
    if (problems.length) { showErrors(form, problems); return; }
    const nowIso = new Date().toISOString();
    const { tasks, log } = R.applyReview(state.tasks, outcomes, nowIso);
    state.tasks = tasks.map((t) => {
      const o = outcomes[t.id];
      if (!o) return t;
      if (o.result === 'done') return { ...t, progress: '' };
      return o.leftOff ? { ...t, progress: o.leftOff, progressAt: nowIso } : t;
    });
    state.log.push(...log.map((l) => ({ ...l, date: todayKey(), leftOff: outcomes[l.taskId]?.leftOff || '' })));
    const day = getDay(todayKey());
    day.reviewed = { ...(day.reviewed || {}), [index]: true };
    const back = Object.values(outcomes).filter((o) => o.result !== 'done').length;
    closeModal();
    persist([back ? `Saved. ${back} task${back === 1 ? '' : 's'} back in your backlog.` : 'Saved. Everything done.']);
  }

  if (kind === 'event') {
    const title = String(data.get('title') || '').trim();
    const date = data.get('date');
    const start = readTime(form, 'start');
    const end = readTime(form, 'end');
    const where = pressedValue(form, 'where') || 'nearby';
    const problems = [];
    if (!title) problems.push('Name the event.');
    if (!date) problems.push('Pick the day.');
    if (!start || !end) problems.push('Add when it starts and ends.');
    const minutes = start && end ? R.toMinutes(end) - R.toMinutes(start) : 0;
    if (start && end && minutes <= 0) problems.push('The end time must be after the start.');
    if (problems.length) { showErrors(form, problems); return; }
    const before = form.dataset.id ? { ...state.events.find((x) => x.id === form.dataset.id) } : null;
    const draft = {
      id: form.dataset.id || newId(), title, date, start, minutes,
      mode: where === 'online' ? 'online' : 'in_person',
      commute: where === 'commute',
      repeat: data.get('repeat') ? 'weekly' : 'none',
    };
    if (before) Object.assign(state.events.find((x) => x.id === draft.id), draft); else state.events.push(draft);
    markPlansStale(before);
    markPlansStale(draft);
    closeModal();
    persist(['Event saved.']);
  }

  if (kind === 'settings') {
    const starts = [...new Set(String(data.get('blockStarts')).split(',').map(R.parseTime).filter(Boolean))].sort();
    const gid = String(data.get('googleClientId') || '').trim();
    const problems = [];
    if (starts.length === 0) problems.push('Add at least one block start time, like 8:00 AM.');
    if (gid && !gid.endsWith('.apps.googleusercontent.com')) problems.push('The Google Client ID ends with .apps.googleusercontent.com. Copy the whole thing.');
    const key = String(data.get('claudeKey') || '').trim();
    if (key && !AI.looksLikeKey(key)) problems.push('That is not a Claude API key. It starts with sk-ant- and comes from console.anthropic.com > API keys.');
    if (problems.length) { showErrors(form, problems); return; }
    state.settings = {
      ...S(),
      commuteMinutes: Math.max(0, Number(data.get('commuteMinutes')) || 0),
      blockStarts: starts,
      staleDays: Math.max(3, Number(data.get('staleDays')) || 21),
    };
    if (gid !== G.getClientId()) G.setClientId(gid);
    const calId = String(data.get('googleCalendarId') || '').trim();
    if (calId !== G.getCalendarId()) G.setCalendarId(calId);
    AI.setKey(String(data.get('claudeKey') || ''));
    closeModal();
    persist(['Settings saved.']);
  }
});

// The close event arrives a moment later; if a new window already opened (like the copy), leave it alone.
modal.addEventListener('close', () => {
  if (modal.open) return;
  stopMic(); stopStarterTimer(); modal.innerHTML = ''; modal.classList.remove('wide');
});

// ---------- drag to reorder the day's tasks ----------

let drag = null;

function saveSlotOrder(list) {
  const day = getDay(list.dataset.day);
  const ids = [...list.querySelectorAll('.slot')].map((el) => el.dataset.id);
  if (ids.join() === day.taskIds.join()) return false;
  day.taskIds = ids;
  if (day.plan) day.planStale = true;
  persist();
  return true;
}

document.addEventListener('pointerdown', (e) => {
  const handle = e.target.closest('[data-drag]');
  if (!handle) return;
  e.preventDefault();
  const slot = handle.closest('.slot');
  drag = { slot, list: slot.parentElement };
  slot.classList.add('dragging');
  handle.setPointerCapture(e.pointerId);
});

document.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const over = [...drag.list.querySelectorAll('.slot')].find((el) => {
    if (el === drag.slot) return false;
    const r = el.getBoundingClientRect();
    return e.clientY > r.top && e.clientY < r.bottom;
  });
  if (!over) return;
  const r = over.getBoundingClientRect();
  drag.list.insertBefore(drag.slot, e.clientY < r.top + r.height / 2 ? over : over.nextSibling);
});

function endDrag() {
  if (!drag) return;
  const { slot, list } = drag;
  drag = null;
  slot.classList.remove('dragging');
  saveSlotOrder(list);
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

document.addEventListener('keydown', (e) => {
  const handle = e.target.closest && e.target.closest('[data-drag]');
  if (!handle || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
  e.preventDefault();
  const slot = handle.closest('.slot');
  const list = slot.parentElement;
  const sibling = e.key === 'ArrowUp' ? slot.previousElementSibling : slot.nextElementSibling;
  if (!sibling) return;
  list.insertBefore(slot, e.key === 'ArrowUp' ? sibling : sibling.nextSibling);
  const id = slot.dataset.id;
  if (saveSlotOrder(list)) document.querySelector(`[data-drag="${id}"]`)?.focus();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target && e.target.id === 'cap-text' && !e.isComposing) {
    e.preventDefault();
    quickCapture(false);
  }
});
document.addEventListener('input', (e) => {
  if (e.target && e.target.id === 'cap-text') e.target.removeAttribute('aria-invalid');
  if (e.target && e.target.id === 'f-title') autoSteps(e.target.closest('form'));
});

// ---------- drag a task from the list into today or tomorrow ----------

document.addEventListener('dragstart', (e) => {
  const row = e.target.closest && e.target.closest('[data-task-drag]');
  if (!row) return;
  e.dataTransfer.setData('text/plain', row.dataset.taskDrag);
  e.dataTransfer.effectAllowed = 'copy';
  document.body.classList.add('dragging-task');
});
document.addEventListener('dragend', () => {
  document.body.classList.remove('dragging-task');
  document.querySelectorAll('.drop-over').forEach((z) => z.classList.remove('drop-over'));
});
document.addEventListener('dragover', (e) => {
  const zone = e.target.closest && e.target.closest('.col-day');
  if (!zone || !document.body.classList.contains('dragging-task')) return;
  e.preventDefault();
  zone.classList.add('drop-over');
});
document.addEventListener('dragleave', (e) => {
  const zone = e.target.closest && e.target.closest('.col-day');
  if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove('drop-over');
});
document.addEventListener('drop', (e) => {
  const zone = e.target.closest && e.target.closest('.col-day');
  if (!zone) return;
  e.preventDefault();
  zone.classList.remove('drop-over');
  document.body.classList.remove('dragging-task');
  const id = e.dataTransfer.getData('text/plain');
  const key = zone.querySelector('.slots')?.dataset.day;
  if (id && key && task(id)) addToDay(id, key);
});

// ---------- pick a time by dragging on the task form's calendar ----------

let timePick = null;

function pickMinute(y) {
  const m = SIDE.startHour * 60 + ((y - timePick.rect.top) / SIDE.px) * 60;
  return Math.max(SIDE.startHour * 60, Math.min(SIDE.endHour * 60, Math.round(m / 15) * 15));
}

function drawPick() {
  const a = Math.min(timePick.from, timePick.to);
  const b = Math.max(timePick.from, timePick.to);
  const len = b > a ? b - a : (Number(modal.querySelector('#f-minutes')?.value) || 30);
  timePick.sel.style.top = `${((a - SIDE.startHour * 60) / 60) * SIDE.px}px`;
  timePick.sel.style.height = `${Math.max((len / 60) * SIDE.px, 14)}px`;
  timePick.sel.textContent = `${t12m(a)} - ${t12m(a + len)}`;
}

document.addEventListener('pointerdown', (e) => {
  const grid = e.target.closest && e.target.closest('#side-cal .grid');
  if (!grid || e.button > 0) return;
  if (e.pointerType === 'mouse') e.preventDefault();
  const sel = document.createElement('div');
  sel.className = 'pick-sel';
  grid.appendChild(sel);
  timePick = { grid, sel, rect: grid.getBoundingClientRect(), moved: false };
  timePick.from = pickMinute(e.clientY);
  timePick.to = timePick.from;
  drawPick();
});
document.addEventListener('pointermove', (e) => {
  if (!timePick) return;
  const to = pickMinute(e.clientY);
  if (to !== timePick.to) { timePick.to = to; timePick.moved = true; drawPick(); }
});
document.addEventListener('pointercancel', () => { if (timePick) { timePick.sel.remove(); timePick = null; } });
document.addEventListener('pointerup', () => {
  if (!timePick) return;
  const { from, to, moved, sel } = timePick;
  timePick = null;
  sel.remove();
  const form = modal.querySelector('form[data-form="task"]');
  if (!form) return;
  if (!moved || Math.abs(to - from) < 15) {
    const hint = modal.querySelector('.side-hint');
    if (hint) hint.textContent = 'Press and drag down over the time you want (a click does nothing).';
    return;
  }
  const start = Math.min(from, to);
  const hhmm = R.toHHMM(start);
  const [h, m] = hhmm.split(':').map(Number);
  form.querySelector('[name="fixedTime_h"]').value = String(h % 12 === 0 ? 12 : h % 12);
  form.querySelector('[name="fixedTime_m"]').value = String(m).padStart(2, '0');
  form.querySelector('[name="fixedTime_ap"]').value = h >= 12 ? 'PM' : 'AM';
  const day = modal.querySelector('#side-cal').dataset.day;
  form.querySelector('#f-date').value = day;
  form.querySelector('#f-minutes').value = Math.abs(to - from);
  const deadline = form.querySelector('#f-deadline');
  if (!deadline.value && pressedValue(form, 'priority') !== 'nice') deadline.value = day;
  const end = start + Math.abs(to - from);
  const clash = calendarItems(day).find((c) => R.toMinutes(c.start) < end && R.toMinutes(c.start) + c.minutes > start);
  if (clash) toast(`Heads up: this overlaps "${clash.title}" at ${t12(clash.start)}.`);
  refreshSideCalendar();
});

// ---------- start ----------

window.addEventListener('hashchange', () => { render(); view.focus({ preventScroll: true }); window.scrollTo(0, 0); });

const startupMessages = dailyCheck();
render();
startupMessages.forEach(toast);
maybeWelcome();
maybeAutoStart();

// Keep the "now" line and current block fresh, without disturbing typing.
setInterval(() => {
  const busy = !!recognizer || (view.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName));
  if (!busy && !modal.open) {
    const msgs = dailyCheck();
    render();
    msgs.forEach(toast);
    maybeWelcome();
  }
  maybeAutoStart();
}, 60000);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
