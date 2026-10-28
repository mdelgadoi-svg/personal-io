// Personal IO: screens and interactions.
// The rules live in rules.js, saving in store.js, Claude in ai.js, Google in google.js.

import * as R from './rules.js';
import { load, save, newId, exportBackup, readBackup } from './store.js';
import * as AI from './ai.js';
import * as G from './google.js';

let state = load();
const ui = { planDay: null, goalFilter: null, showDone: false, open: { important: false, nice: false, cal: false } };
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

function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  toasts.appendChild(el);
  while (toasts.children.length > 2) toasts.firstElementChild.remove();
  setTimeout(() => el.remove(), 4000);
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
    default: return '<span class="mark" aria-label="Nice to have">🤔</span>';
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
  return state.tasks.find((t) => t.eventRef && t.eventRef.src === src && t.eventRef.id === id && t.eventRef.date === date) || null;
}

function calendarItems(key) {
  const own = R.eventsOn(state.events, key).map((e) => ({ src: 'own', id: e.id, date: key, title: e.title, start: e.start, minutes: e.minutes, commute: !!e.commute }));
  const google = ((ui.gAhead && ui.gAhead.list) || []).filter((e) => e.date === key)
    .map((e) => ({ src: 'google', id: e.id, date: key, title: e.title, start: e.start, minutes: e.minutes, commute: false }));
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
    .then((list) => { ui.gAhead = { at: Date.now(), list }; })
    .catch(() => {})
    .finally(() => {
      ui.gLoading = false;
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
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
  state.tasks = tasks;
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
    <span>${markHTML('nice')} Nice to have <span class="muted">· no limit</span></span>
  </section>`;
}

// ----- calendar drawing (shared) -----

// items: [{ start: minutes, minutes, title, sub, cls, lane: 'plan' | 'google', action, id }]
function hoursHTML({ startHour = 7, endHour = 23, px = 56 } = {}) {
  const height = (endHour - startHour) * px;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => `<span style="top:${i * px}px">${hourLabel(startHour + i)}</span>`).join('');
  return `<div class="hours" aria-hidden="true" style="height:${height}px">${hours}</div>`;
}

function gridHTML(items, { startHour = 7, endHour = 23, px = 56, nowLine = false, lanes = false } = {}) {
  const top = (m) => ((m - startHour * 60) / 60) * px;
  const height = (endHour - startHour) * px;
  const boxes = items
    .filter((it) => it.start + it.minutes > startHour * 60 && it.start < endHour * 60)
    .map((it) => {
      const lane = !lanes ? 'left:0; right:0' : it.lane === 'google' ? 'left:52%; right:0' : 'left:0; right:50%';
      const h = Math.max((it.minutes / 60) * px - 2, 18);
      const style = `top:${Math.max(top(it.start), 0)}px; height:${h}px; ${lane}`;
      const inner = `${esc(it.title)}${it.sub ? `<span class="sub">${esc(it.sub)}</span>` : ''}`;
      return it.action
        ? `<button type="button" class="ev ${it.cls}" style="${style}" data-action="${it.action}" data-id="${esc(it.id)}">${inner}</button>`
        : `<div class="ev ${it.cls}" style="${style}">${inner}</div>`;
    }).join('');
  const now = nowMinutes();
  const line = nowLine && now >= startHour * 60 && now <= endHour * 60 ? `<div class="now-line" style="top:${top(now)}px" aria-label="Now"></div>` : '';
  return `<div class="grid" style="height:${height}px; background-image: repeating-linear-gradient(to bottom, var(--line-2) 0, var(--line-2) 1px, transparent 1px, transparent ${px}px)">${boxes}${line}</div>`;
}

function timelineHTML(items, opts = {}) {
  const laneHead = opts.lanes ? '<div class="lane-head"><span>Personal IO</span><span>Google Calendar</span></div>' : '';
  return `${laneHead}<div class="timeline-wrap">${hoursHTML(opts)}${gridHTML(items, opts)}</div>`;
}

// Your own events for a day, plus the commute before in-person ones.
function eventItems(key, clickable = false) {
  const items = [];
  R.eventsOn(state.events, key).forEach((e) => {
    const start = R.toMinutes(e.start);
    if (e.commute) {
      items.push({ start: start - S().commuteMinutes, minutes: S().commuteMinutes, lane: 'plan', cls: 'ev-commute', title: `Commute · ${S().commuteMinutes} min` });
    }
    items.push({
      start, minutes: e.minutes, lane: 'plan', cls: 'ev-fixed',
      title: `${t12(e.start)} ${e.title}`,
      sub: e.mode === 'online' ? 'online' : e.commute ? 'in person · commute' : 'in person',
      action: clickable ? 'edit-event' : null, id: e.id,
    });
  });
  return items;
}

function planItems(key, clickable = false) {
  const day = state.days[key];
  const fromEvents = eventItems(key, clickable);
  if (!day || !day.plan) return fromEvents;
  const items = day.plan.blocks.map((b) => ({
    start: R.toMinutes(b.start), minutes: b.minutes, lane: 'plan', cls: `ev-${b.color}`,
    title: `Deep work · ${b.taskIds.length} task${b.taskIds.length === 1 ? '' : 's'}`,
    sub: `${t12(b.start)} - ${t12m(R.toMinutes(b.start) + b.minutes)}`,
  }));
  day.plan.events.forEach((e) => {
    const t = task(e.taskId);
    items.push({
      start: R.toMinutes(e.start), minutes: e.minutes, lane: 'plan',
      cls: e.kind === 'commute' ? 'ev-commute' : `ev-${R.colorForTasks(t ? [t] : [])}`,
      title: `${t12(e.start)} ${e.title}`,
    });
  });
  return [...fromEvents, ...items];
}

// Fills an element with the day's calendar: the app's plan plus Google events.
function calendarBlockHTML(id, key, opts = {}) {
  afterRender.push(() => fillCalendar(id, key, opts));
  return `<div id="${id}" class="cal-slot">${timelineHTML(planItems(key), opts)}</div>`;
}

async function fillCalendar(id, key, opts = {}) {
  const el = document.getElementById(id);
  if (!el) return;
  const plan = planItems(key, opts.clickable);
  if (!G.isConfigured()) {
    // Google is optional. Your own events and the plan are shown.
    el.innerHTML = timelineHTML(plan, opts);
    return;
  }
  if (!G.isConnected()) {
    el.innerHTML = `<div class="note note-info" style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap">
      <span>See your Google Calendar here.</span><button class="btn btn-small" data-action="connect-google">Connect Google</button></div>${timelineHTML(plan, opts)}`;
    return;
  }
  try {
    const events = await G.eventsForDay(key);
    const allDay = events.filter((e) => e.allDay).map((e) => esc(e.title));
    const items = [];
    events.filter((e) => !e.allDay && !e.fromApp).forEach((e) => {
      const linked = linkedTask('google', e.id, key);
      if (linked && linked.place === 'commute') {
        items.push({ start: R.toMinutes(e.start) - S().commuteMinutes, minutes: S().commuteMinutes, lane: 'plan', cls: 'ev-commute', title: `Commute · ${S().commuteMinutes} min` });
      }
      items.push({ start: R.toMinutes(e.start), minutes: e.minutes, lane: 'google', cls: 'ev-google', title: `${t12(e.start)} ${e.title}`, sub: e.online ? 'online' : '' });
    });
    const still = document.getElementById(id);
    if (!still) return;
    still.innerHTML = `${allDay.length ? `<div class="hint" style="margin-bottom:6px">All day: ${allDay.join(', ')}</div>` : ''}${timelineHTML([...plan, ...items], { ...opts, lanes: true })}`;
  } catch (err) {
    const still = document.getElementById(id);
    if (still) still.innerHTML = `<div class="note note-warn">${err.message === 'not-connected' ? 'Google sign-in expired.' : esc(err.message)} <button class="btn-link" data-action="connect-google">Connect again</button></div>${timelineHTML(plan, opts)}`;
  }
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
  ${goalsStripHTML()}
  <div class="cols plan-cols">
    <section class="col col-backlog" aria-label="Backlog">
      <div class="col-head"><h2>Backlog</h2>
        <button class="btn btn-dark btn-small" data-action="new-task">+ Task</button>
      </div>
      ${ui.goalFilter ? `<div class="hint">Goal: ${esc(goal(ui.goalFilter)?.title || '')} (plus urgent) · <button class="btn-link" data-action="clear-filter">Show all</button></div>` : ''}
      ${backlogGroupsHTML({ addTo: dayKey, goalFilter: ui.goalFilter })}
    </section>
    <section class="col col-day" aria-label="Day plan">
      ${dayColumnHTML(dayKey)}
    </section>
    <section class="col col-cal card card-pad" aria-label="Calendar">
      <div class="col-head" style="margin-bottom:6px"><h2>Calendar</h2><span class="meta">${esc(fmtDay(dayKey))}</span></div>
      ${calendarBlockHTML('cal-plan', dayKey, { px: 34, startHour: 7, endHour: 22 })}
    </section>
  </div>`;
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

const PREVIEW = 3; // collapsed groups show this many items

const CAL_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M16 3v4M8 3v4M3 11h18"></path></svg>';

function foldButtonHTML(name, isOpen, total) {
  return `<div class="item fold-row"><button type="button" class="fold" data-action="toggle-group" data-group-name="${name}" aria-expanded="${isOpen}">
    <span>${isOpen ? 'Show fewer' : `Show all ${total}`}</span>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${isOpen ? '<path d="m18 15-6-6-6 6"></path>' : '<path d="m6 9 6 6 6-6"></path>'}</svg>
  </button></div>`;
}

// Things already on your calendar in the next week that aren't tasks yet.
function scheduledHTML() {
  const items = [];
  for (let i = 0; i < 8; i++) calendarItems(R.addDays(todayKey(), i)).filter((c) => !c.task).forEach((c) => items.push(c));
  if (!items.length) return '';
  const isOpen = !!ui.open.cal;
  const shown = isOpen ? items : items.slice(0, PREVIEW);
  const rows = shown.map((c) => `
    <div class="item">
      <div class="item-main">
        <span class="item-title">${esc(c.title)}</span>
        <div class="item-meta"><span>${esc(fmtDay(c.date))} · ${t12(c.start)}</span><span>${R.formatMinutes(c.minutes)}</span>${c.commute ? '<span class="tag-plain">Commute</span>' : ''}</div>
      </div>
      <div class="item-actions"><button class="btn btn-small" data-action="event-to-task" data-src="${c.src}" data-id="${esc(c.id)}" data-date="${c.date}">Make task</button></div>
    </div>`).join('');
  return `<div class="card list group-cal">
    <div class="group-head"><span class="group-name">${CAL_ICON} On your calendar</span><span class="count">${items.length} · next 7 days</span></div>
    ${rows}${items.length > PREVIEW ? foldButtonHTML('cal', isOpen, items.length) : ''}
  </div>`;
}

function backlogGroupsHTML({ addTo = null, goalFilter = null, full = false } = {}) {
  const scheduled = scheduledHTML();
  if (R.openTasks(state.tasks).length === 0) {
    return `${scheduled}<div class="card empty">Your backlog is empty.<br><button class="btn" style="margin-top: 12px" data-action="new-task">+ Add your first task</button></div>`;
  }
  const tKey = todayKey();
  const counts = R.countByPriority(state.tasks);
  let open = R.openTasks(state.tasks);
  if (goalFilter) open = open.filter((t) => t.goalId === goalFilter || t.priority === 'both' || t.priority === 'urgent');
  const day = addTo ? getDay(addTo) : null;

  return scheduled + R.PRIORITY_ORDER.map((p) => {
    const info = R.PRIORITIES[p];
    const list = R.sortForPlanning(open.filter((t) => t.priority === p));
    const capText = info.cap === Infinity ? `${list.length}` : `${counts[p]}/${info.cap}${counts[p] >= info.cap ? ' full' : ''}`;
    // ★! and ! always show everything. ★ and 🤔 fold, with an arrow to open.
    const foldable = p === 'important' || p === 'nice';
    const isOpen = !foldable || ui.open[p];
    const shown = isOpen ? list : list.slice(0, PREVIEW);
    const rows = shown.map((t) => taskRowHTML(t, { addTo, day, tKey, full })).join('')
      || '<div class="item"><span class="hint">Nothing here.</span></div>';
    return `<div class="card list group-${p}">
      <div class="group-head"><span class="group-name">${markHTML(p)} ${info.label}</span><span class="count">${capText}</span></div>
      ${rows}
      ${foldable && list.length > PREVIEW ? foldButtonHTML(p, isOpen, list.length) : ''}
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
      <button class="btn btn-small" data-action="complete-task" data-id="${t.id}">Done</button>
      <button class="btn btn-small" data-action="edit-task" data-id="${t.id}">Edit</button>`;
  }
  const when = t.eventRef ? `<span>${CAL_ICON} ${esc(fmtDay(t.eventRef.date))} · ${t12(t.fixedTime)}</span>` : deadlineHTML(t);
  return `
  <div class="item" style="${stale ? 'background:#FFFBF2' : ''}">
    <div class="item-main">
      <button class="task-name" data-action="edit-task" data-id="${t.id}">${esc(t.title)}</button>
      <div class="item-meta">${goalLabel(t)}<span>${R.formatMinutes(t.minutes || 0)}</span>${when}${placeChip(t)}</div>
      ${t.progress ? `<div class="left-off">Left off: ${esc(t.progress)}</div>` : ''}
      ${t.pushCount ? `<div class="item-meta"><span class="due-soon">Pushed ${t.pushCount}x${t.lastReason ? ' · ' + esc(t.lastReason.toLowerCase()) : ''}</span></div>` : ''}
      ${t.promotionBlocked ? '<div class="item-meta"><span class="chip chip-warn">Due soon, but ★! is full</span></div>' : ''}
      ${stale ? `<div class="item-meta" style="color:#6B4E00">Untouched ${S().staleDays}+ days. Still important?
          <button class="btn btn-small" data-action="keep-task" data-id="${t.id}">Keep</button>
          <button class="btn btn-small" data-action="demote-task" data-id="${t.id}">Move to 🤔</button></div>` : ''}
    </div>
    <div class="item-actions">${actions}</div>
  </div>`;
}

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
      <button type="button" class="icon-x" data-action="remove-from-day" data-id="${t.id}" data-day="${dayKey}" aria-label="Remove ${esc(t.title)} from ${word}">${X_ICON}</button>
    </div>
  </article>`;
}

function calRowHTML(c) {
  return `
  <div class="item">
    <span class="mono time-col">${t12(c.start)}</span>
    <div class="item-main">
      <span class="item-title">${esc(c.title)}</span>
      ${c.task ? `<div class="item-meta">${markHTML(c.task.priority)}${goalLabel(c.task)}</div>` : ''}
      ${c.commute ? `<div class="item-meta"><span class="tag-plain">Commute +${S().commuteMinutes} min before</span></div>` : ''}
    </div>
    ${c.task ? '' : `<button class="btn btn-small" data-action="event-to-task" data-src="${c.src}" data-id="${esc(c.id)}" data-date="${c.date}">Make task</button>`}
  </div>`;
}

function dayColumnHTML(dayKey) {
  const day = getDay(dayKey);
  const isToday = dayKey === todayKey();
  const word = isToday ? 'today' : 'tomorrow';
  const tasks = day.taskIds.map(task).filter(Boolean);
  const need = R.dayTimeNeeded(tasks.filter((t) => t.status === 'open'), S());
  const cal = calendarItems(dayKey);

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
    <span class="meta">${tasks.length}/${day.slots} · ${R.formatMinutes(need.total)}</span></div>
  <label class="visually-hidden" for="intention">Intention for the day</label>
  <input class="input" id="intention" type="text" placeholder="Intention: what would make this day a win?" value="${esc(day.intention)}" data-change="intention" data-day="${dayKey}">
  ${cal.length ? `<div class="card list"><div class="group-head"><span class="group-name">${CAL_ICON} On your calendar</span><span class="count">${cal.length}</span></div>${cal.map(calRowHTML).join('')}</div>` : ''}
  <div class="slots" data-day="${dayKey}">${tasks.map((t) => slotHTML(t, dayKey, word)).join('')}</div>
  ${empties}
  ${day.slots < S().daySlotsMax ? `<button class="btn-link" data-action="open-slot" data-day="${dayKey}">+ Slot (${day.slots + 1}/${S().daySlotsMax})</button>` : ''}
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
    ${rows.map((r) => `<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; font-size:14px">${r.html}</div>`).join('')}
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

function renderToday() {
  const key = todayKey();
  const day = state.days[key];
  const head = `
  <section class="page-head">
    <div><div class="date-line">${esc(longDay(key))}</div><h1>Today</h1>
    ${day && day.intention ? `<div class="sub">Intention: ${esc(day.intention)}</div>` : ''}</div>
  </section>`;

  if (!day || !day.plan) {
    return `${head}
    <div class="cols">
      <section class="col" style="flex: 1 1 340px">
        <div class="card empty">No plan for today yet.<br><button class="btn btn-dark" style="margin-top:12px" data-action="go-plan-today">Plan today</button></div>
      </section>
      <section class="col card card-pad" style="flex: 1.3 1 420px" aria-label="Calendar">
        <div class="col-head" style="margin-bottom: 8px"><h2>Calendar</h2></div>
        ${calendarBlockHTML('cal-today', key, { nowLine: true, px: 48 })}
      </section>
    </div>`;
  }

  const tasks = day.taskIds.map(task).filter(Boolean);
  const done = tasks.filter((t) => t.status === 'done').length;
  const goalsToday = [...new Set(tasks.map((t) => t.goalId))].map(goal).filter(Boolean);
  const need = R.dayTimeNeeded(tasks, S());
  const { current, next } = currentAndNext();

  const goalCards = goalsToday.map((g) => {
    const mine = tasks.filter((t) => t.goalId === g.id);
    const d = mine.filter((t) => t.status === 'done').length;
    return `<div class="goal-today">
      <div style="display:flex; justify-content:space-between; gap:8px"><strong>${esc(g.title)}</strong><span class="hint">${d} of ${mine.length} done</span></div>
      ${g.why ? `<div class="why">${esc(g.why)}</div>` : ''}
      <div class="bar"><div class="w" style="width:${mine.length ? Math.round((d / mine.length) * 100) : 0}%; background: var(--green)"></div></div>
    </div>`;
  }).join('');

  const taskRows = tasks.map((t) => {
    const st = todayStatus(t, key);
    return `<div class="item">
      <div class="item-main">
        <div style="display:flex; gap:8px; align-items:center">${markHTML(t.priority)} <span class="item-title" style="${t.status === 'done' ? 'text-decoration: line-through; color: var(--muted)' : ''}">${esc(t.title)}</span></div>
        <div class="item-meta">${goalLabel(t)}<span>${R.formatMinutes(t.minutes || 0)}</span>${st.reason ? `<span>· ${esc(st.reason)}</span>` : ''}</div>
        ${t.progress && t.status !== 'done' ? `<div class="left-off">Left off: ${esc(t.progress)}</div>` : ''}
      </div>
      <div class="item-actions">
        <span class="chip ${st.cls}">${st.word}</span>
        ${t.status !== 'done' ? `<button class="btn btn-small" data-action="complete-task" data-id="${t.id}">Done</button>` : ''}
      </div>
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
  <div class="cols">
    <section class="col" style="flex: 1 1 360px">
      <div class="col-head"><h2>Goals I'm moving today</h2></div>
      <div class="card card-pad" style="display:flex; flex-direction:column; gap:14px">${goalCards || '<span class="hint">No tasks planned.</span>'}</div>
      <div class="col-head"><h2>Tasks</h2><span class="meta">did I do it?</span></div>
      <div class="card list">${taskRows}</div>
      ${(() => { const cal = calendarItems(key).filter((c) => !c.task); return cal.length ? `<div class="col-head"><h2>On your calendar</h2></div><div class="card list">${cal.map(calRowHTML).join('')}</div>` : ''; })()}
      ${day.plan.blocks.length ? `<div class="col-head"><h2>Blocks</h2></div><div class="card list">${blockButtons}</div>` : ''}
    </section>
    <section class="col card card-pad" style="flex: 1.3 1 420px" aria-label="Calendar">
      <div class="col-head" style="margin-bottom: 8px"><h2>Calendar</h2>
        <span class="meta legend">
          <span><span class="sw" style="background:var(--blue)"></span>do now</span>
          <span><span class="sw" style="background:var(--green)"></span>should do</span>
          <span><span class="sw" style="background:var(--yellow)"></span>might help</span>
          <span><span class="sw" style="background:var(--purple)"></span>commute</span>
        </span></div>
      ${calendarBlockHTML('cal-today', key, { nowLine: true, px: 48, clickable: true })}
    </section>
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
    actions = `<button class="btn btn-outline" data-action="review" data-block="${current.index}">End block</button>`;
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

// ----- calendar -----

function weekStart(key) {
  const dow = (R.parseDateKey(key).getDay() + 6) % 7; // Monday = 0
  return R.addDays(key, -dow);
}

function renderCalendar() {
  const phone = window.matchMedia('(max-width: 760px)').matches;
  const anchor = ui.calDay || todayKey();
  const days = phone ? [anchor] : Array.from({ length: 7 }, (_, i) => R.addDays(weekStart(anchor), i));
  const opts = { startHour: 7, endHour: 23, px: phone ? 48 : 44 };
  const tKey = todayKey();
  const cols = days.map((key) => `
    <div class="cal-col">
      <div class="cal-day ${key === tKey ? 'is-today' : ''}"><span>${esc(fmtDay(key, { weekday: 'short' }))}</span><strong>${R.parseDateKey(key).getDate()}</strong></div>
      <div id="calcol-${key}">${gridHTML(planItems(key, true), { ...opts, nowLine: key === tKey })}</div>
    </div>`).join('');
  // Once Google is connected, its events are added to each day.
  if (G.isConnected()) {
    afterRender.push(() => days.forEach(async (key) => {
      try {
        const google = (await G.eventsForDay(key)).filter((e) => !e.allDay && !e.fromApp).map((e) => ({
          start: R.toMinutes(e.start), minutes: e.minutes, cls: 'ev-google', title: `${t12(e.start)} ${e.title}`, sub: e.online ? 'online' : '',
        }));
        const el = document.getElementById(`calcol-${key}`);
        if (el) el.innerHTML = gridHTML([...planItems(key, true), ...google], { ...opts, nowLine: key === tKey });
      } catch { /* sign-in expired; the button below reconnects */ }
    }));
  }
  const googleBar = !G.isConfigured() ? ''
    : G.isConnected() ? `<span class="chip chip-done">Connected${G.connectedName() ? ': ' + esc(G.connectedName()) : ''}</span>`
    : '<button class="btn" data-action="connect-google">Connect Google</button>';
  const range = phone ? longDay(anchor) : `${fmtDay(days[0], { month: 'short', day: 'numeric' })} to ${fmtDay(days[6], { month: 'short', day: 'numeric' })}`;
  return `
  <section class="page-head">
    <div><div class="date-line">${esc(range)}</div><h1>Calendar</h1>
      <div class="sub">Your fixed events (classes, meetings) plus the blocks Personal IO plans around them.</div></div>
    <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center">
      ${googleBar}
      <button class="btn" data-action="cal-move" data-step="${phone ? -1 : -7}" aria-label="Previous">‹</button>
      <button class="btn" data-action="cal-today">Today</button>
      <button class="btn" data-action="cal-move" data-step="${phone ? 1 : 7}" aria-label="Next">›</button>
      <button class="btn btn-dark" data-action="new-event">+ Event</button>
    </div>
  </section>
  <div class="card card-pad">
    <div class="legend" style="margin-bottom:10px">
      <span><span class="sw" style="background:#5B6572"></span>your events</span>
      ${G.isConfigured() ? '<span><span class="sw" style="background:#9AA3AF"></span>Google Calendar</span>' : ''}
      <span><span class="sw" style="background:var(--purple)"></span>commute</span>
      <span><span class="sw" style="background:var(--blue)"></span>do now</span>
      <span><span class="sw" style="background:var(--green)"></span>should do</span>
      <span><span class="sw" style="background:var(--yellow)"></span>might help</span>
    </div>
    <div class="cal-week">
      <div class="cal-hours"><div class="cal-day spacer"></div>${hoursHTML(opts)}</div>
      ${cols}
    </div>
  </div>
  ${state.events.length === 0 ? '<div class="note note-info" style="margin-top:14px">Add your classes and meetings with <strong>+ Event</strong>. Use "repeats weekly" for classes. When you build a day, deep work blocks go around them.</div>' : ''}`;
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
      ${e ? '<button type="button" class="btn" data-action="delete-event" style="margin-right:auto; color: var(--bang)">Delete</button>' : ''}
      <button type="button" class="btn" data-action="close-modal">Cancel</button>
      <button type="submit" class="btn btn-dark">Save event</button>
    </div>
  </form>`;
}

// ----- brain dump -----

const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null;

function dumpHTML() {
  return `
  <div class="modal" data-form="dump">
    <div class="modal-head"><h2 id="modal-title">Brain dump</h2>
      <button type="button" class="btn btn-ghost icon-btn" data-action="close-modal" aria-label="Close">✕</button></div>
    <div class="dump-warning" role="note">
      <div class="big">A brain dump can bury what matters.</div>
      <div>Everything you dump goes in as <strong>🤔 Nice to have: not important yet.</strong> Promote only what truly matters.</div>
    </div>
    <div class="field">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap">
        <label for="dump-text" class="field-label">Say or type everything on your mind</label>
        ${SpeechRec ? `<div style="display:flex; gap:6px; align-items:center">
          <label class="visually-hidden" for="dump-lang">Language</label>
          <select class="input" id="dump-lang" style="min-height:40px; width:auto; padding:6px 10px"><option value="en-US">English</option><option value="es-PE">Español</option></select>
          <button type="button" class="btn btn-small mic" data-action="mic" aria-pressed="false">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"></rect><path d="M5 10a7 7 0 0 0 14 0M12 17v5"></path></svg>
            <span>Start talking</span></button></div>` : '<span class="hint">Voice works in Chrome. Typing works everywhere.</span>'}
      </div>
      <textarea class="input" id="dump-text" style="min-height:160px" placeholder="Email the professor about the paper. Buy a suit. Call the bank and then book flights..."></textarea>
    </div>
    <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; align-items:center">
      <span class="hint dump-status">${AI.hasKey() ? 'Claude will split it into tasks and match each one to a goal.' : 'Each sentence becomes a task under "Keep life running". With a Claude key, they get matched to your goals.'}</span>
      <button type="button" class="btn btn-dark" data-action="dump-split">Turn into tasks</button>
    </div>
    <div class="dump-preview"></div>
  </div>`;
}

let dumpDraft = [];

function dumpPreviewHTML() {
  if (!dumpDraft.length) return '';
  return `
  <div class="card list">
    ${dumpDraft.map((t, i) => `<div class="item">
      <div class="item-main"><span class="item-title">${esc(t.title)}</span>
      <div class="item-meta"><span class="goal-label">Goal: ${esc(goal(t.goalId)?.title || 'Keep life running')}</span><span>${R.formatMinutes(t.minutes)}</span>${markHTML('nice')}</div></div>
      <button type="button" class="btn btn-small" data-action="dump-remove" data-index="${i}" aria-label="Remove">Remove</button>
    </div>`).join('')}
  </div>
  <div class="modal-foot">
    <button type="button" class="btn btn-dark" data-action="dump-add">Add all ${dumpDraft.length} to backlog as 🤔</button>
  </div>`;
}

function stopMic() {
  if (recognizer) { recognizer.onend = null; recognizer.stop(); recognizer = null; }
  const btn = modal.querySelector('[data-action="mic"]');
  if (btn) { btn.setAttribute('aria-pressed', 'false'); btn.querySelector('span').textContent = 'Start talking'; }
}

function toggleMic() {
  if (recognizer) { stopMic(); return; }
  const box = modal.querySelector('#dump-text');
  const btn = modal.querySelector('[data-action="mic"]');
  let committed = box.value ? box.value.trim() + ' ' : '';
  recognizer = new SpeechRec();
  recognizer.lang = modal.querySelector('#dump-lang').value;
  recognizer.continuous = true;
  recognizer.interimResults = true;
  recognizer.onresult = (ev) => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const piece = ev.results[i][0].transcript;
      if (ev.results[i].isFinal) committed += piece.trim() + '. ';
      else interim += piece;
    }
    box.value = committed + interim;
  };
  recognizer.onerror = (ev) => { toast(ev.error === 'not-allowed' ? 'Microphone permission was blocked.' : 'Voice stopped. You can keep typing.'); stopMic(); };
  recognizer.onend = () => stopMic();
  recognizer.start();
  btn.setAttribute('aria-pressed', 'true');
  btn.querySelector('span').textContent = 'Stop';
}

async function splitDumpText() {
  const text = modal.querySelector('#dump-text').value.trim();
  const status = modal.querySelector('.dump-status');
  if (!text) { status.textContent = 'Say or type something first.'; return; }
  stopMic();
  if (AI.hasKey()) {
    status.textContent = 'Claude is sorting it...';
    try {
      dumpDraft = await AI.tasksFromDump(text, state.goals);
    } catch (err) {
      status.textContent = `${err.message} Using a simple split instead.`;
      dumpDraft = R.splitDump(text).map((title) => ({ title, goalId: 'life', minutes: 30 }));
    }
  } else {
    dumpDraft = R.splitDump(text).map((title) => ({ title, goalId: 'life', minutes: 30 }));
  }
  if (!dumpDraft.length) status.textContent = 'No tasks found. Try short sentences, one thing each.';
  else if (!status.textContent.includes('simple split')) status.textContent = `${dumpDraft.length} tasks found. Remove any you don't want, then add them all at once.`;
  modal.querySelector('.dump-preview').innerHTML = dumpPreviewHTML();
}

function addDump() {
  const nowIso = new Date().toISOString();
  const deadline = '';
  const before = dumpDraft.length;
  const seen = [];
  dumpDraft = dumpDraft.filter((t) => {
    if (R.sameTitle(t.title, R.openTasks(state.tasks)) || R.sameTitle(t.title, seen)) return false;
    seen.push(t);
    return true;
  });
  const skipped = before - dumpDraft.length;
  dumpDraft.forEach((t) => state.tasks.push({
    id: newId(), status: 'open', createdAt: nowIso, lastTouchedAt: nowIso, pushCount: 0,
    title: t.title, goalId: goal(t.goalId) ? t.goalId : 'life', priority: 'nice', deadline,
    minutes: t.minutes, firstSteps: [], firstStep: '', stepsBy: 'me', place: 'everywhere',
    destination: '', fixedDate: '', fixedTime: null, needs: [], source: 'brain-dump',
  }));
  const n = dumpDraft.length;
  dumpDraft = [];
  closeModal();
  persist([`${n} tasks added as 🤔 Nice to have.${skipped ? ` ${skipped} skipped: already in your backlog.` : ''}`]);
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
  const log = [...state.log].reverse().slice(0, 30);
  const resultWord = { done: 'Done', working: 'Still working', not_started: 'Not started' };
  return `
  <section class="page-head">
    <div><h1>Backlog</h1><div class="sub">Everything you haven't finished yet, grouped by priority.</div></div>
  </section>
  ${keyHTML()}
  <div class="cols">
    <section class="col" style="flex: 1.4 1 420px">
      <div class="col-head"><h2>Task backlog</h2><button class="btn btn-dark btn-small" data-action="new-task">+ Task</button></div>
      ${backlogGroupsHTML({ full: true })}
    </section>
    <section class="col" style="flex: 1 1 320px">
      <div class="col-head"><h2>Record</h2><span class="meta">What you did and didn't, and why</span></div>
      <div class="card table-scroll">
        ${log.length ? `<table class="record"><thead><tr><th>When</th><th>Task</th><th>Result</th></tr></thead><tbody>
          ${log.map((l) => `<tr><td class="mono">${esc(l.date ? fmtDay(l.date) : l.at.slice(0, 10))}</td><td>${esc(l.title)}</td><td>${resultWord[l.result]}${l.reason ? `<div class="hint">${esc(l.reason)}</div>` : ''}${l.leftOff ? `<div class="hint">Left off: ${esc(l.leftOff)}</div>` : ''}</td></tr>`).join('')}
        </tbody></table>` : '<div class="empty">Your block reviews will show up here.</div>'}
      </div>
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
  const mode = draft.stepsBy || (AI.hasKey() && !t ? 'claude' : 'me');
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
          <button type="button" data-value="nice" ${pressed('nice', draft.priority)} aria-label="Nice to have">${markHTML('nice')}</button>
        </div></div>
    </div>
    <div class="row">
      <div class="field"><label for="f-deadline">Deadline</label>
        <input class="input" type="date" id="f-deadline" name="deadline" value="${esc(draft.deadline || '')}"></div>
      <div class="field"><label for="f-minutes">How long will it take? (minutes)</label>
        <input class="input" type="number" min="5" step="5" id="f-minutes" name="minutes" value="${esc(draft.minutes || '')}"></div>
    </div>

    ${draft.progress ? `<div class="note note-info"><strong>Last time you left off:</strong> ${esc(draft.progress)}</div>` : ''}
    <section class="card card-pad" aria-label="First minute" style="display:flex; flex-direction:column; gap:10px">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap">
        <strong>First minute: 3 tiny steps to start</strong>
        <div class="pills" data-group="stepsBy">
          <button type="button" data-value="me" ${pressed('me', mode)}>I'll write them</button>
          <button type="button" data-value="claude" ${pressed('claude', mode)}>Let Claude suggest</button>
        </div>
      </div>
      <div class="claude-row" ${mode === 'claude' ? '' : 'hidden'}>
        <button type="button" class="btn btn-small" data-action="ask-claude">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"></path></svg>
          ${steps.length ? 'Suggest again' : 'Suggest steps'}</button>
        <span class="hint claude-status">${AI.hasKey() ? 'Claude Sonnet 5.5 reads the task name and its goal, and fills the steps and what it needs.' : 'No Claude key yet, so this fills a simple template you can edit.'}</span>
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
        <tr><th scope="row">Fixed time?</th><td>
          <div class="row" style="gap:8px">
            <div class="field" style="flex: 1 1 140px"><label for="f-date">Day</label>
              <input class="input" type="date" id="f-date" name="fixedDate" value="${esc(draft.fixedDate || '')}" data-change="form-cal-day"></div>
            <div class="field" style="flex: 1 1 200px"><span class="field-label">Time</span>
              ${timePickerHTML('fixedTime', draft.fixedTime, { id: 'f-time', optional: true })}</div>
          </div>
          <span class="hint">Only for meetings or appointments. Check the calendar on the right for a free spot. Leave empty and it goes into a deep work block.</span>
        </td></tr>
        <tr><th scope="row">To get it done</th><td>
          <div class="field"><label class="visually-hidden" for="f-needs">To get it done</label>
          <textarea class="input" id="f-needs" name="needs" placeholder="One per line. Claude can fill this from the task and its goal.">${esc((draft.needs || []).map((n) => n.text).join('\n'))}</textarea></div>
        </td></tr>
      </tbody></table>
    </section>
    </div>
    <aside class="modal-side" aria-label="Calendar for the day">
      <div class="col-head"><strong id="side-cal-title">${esc(fmtDay(calDay, { weekday: 'long', month: 'short', day: 'numeric' }))}</strong><span class="hint">Your calendar</span></div>
      <div id="side-cal" data-day="${calDay}"></div>
    </aside>
    </div>
    <div class="modal-foot">
      ${t ? '<button type="button" class="btn" data-action="delete-task" style="margin-right:auto; color: var(--bang)">Delete</button>' : ''}
      <button type="button" class="btn" data-action="close-modal">Cancel</button>
      <button type="submit" class="btn btn-dark">${opts.dayKey ? 'Save and add to day' : 'Save to backlog'}</button>
    </div>
  </form>`;
}

function refreshSideCalendar() {
  const el = modal.querySelector('#side-cal');
  if (!el) return;
  const key = el.dataset.day;
  el.innerHTML = timelineHTML(planItems(key), { px: 30, startHour: 7, endHour: 22 });
  el.id = 'side-cal';
  fillCalendar('side-cal', key, { px: 30, startHour: 7, endHour: 22 });
}

async function askClaude() {
  const form = modal.querySelector('form[data-form="task"]');
  const status = form.querySelector('.claude-status');
  const title = form.querySelector('#f-title').value.trim();
  if (!title) { status.textContent = 'Write the task name first.'; return; }
  const g = goal(form.querySelector('#f-goal').value);
  const place = pressedValue(form, 'place');
  if (!AI.hasKey()) {
    // No Claude key: fill a simple template so there is always a way to start.
    R.templateSteps(title, place).forEach((s, i) => { form.querySelector(`#f-step${i}`).value = s; });
    const needs = form.querySelector('#f-needs');
    if (!needs.value.trim()) needs.value = AI.FALLBACK_NEEDS;
    status.textContent = 'Simple template filled in. Edit it to fit. (With a Claude key in Settings, these get smarter.)';
    return;
  }
  status.textContent = 'Asking Claude...';
  const btn = form.querySelector('[data-action="ask-claude"]');
  btn.disabled = true;
  try {
    const out = await AI.suggestForTask({
      title, goal: g?.title, why: g?.why,
      minutes: Number(form.querySelector('#f-minutes').value) || null,
      place: R.PLACES[place] || null,
    });
    out.firstSteps.forEach((s, i) => { const inp = form.querySelector(`#f-step${i}`); if (inp) inp.value = s; });
    const needs = form.querySelector('#f-needs');
    if (!needs.value.trim()) needs.value = out.toGetItDone.join('\n');
    status.textContent = 'Done. Edit anything that does not fit.';
  } catch (err) {
    status.textContent = err.message;
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
      ${g && g.id !== 'life' ? '<button type="button" class="btn" data-action="delete-goal" style="margin-right:auto; color: var(--bang)">Delete</button>' : ''}
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
      <strong>Claude (first-step suggestions)</strong>
      <span class="hint">Your own Claude API key. Saved only in this browser, never on GitHub. Only the task name, its goal and the goal's why are sent.</span>
      <div class="field"><label for="s-key">Claude API key</label>
        <input class="input" type="password" id="s-key" name="claudeKey" value="${esc(AI.getKey())}" placeholder="sk-ant-..." autocomplete="off"></div>
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
        const fresh = (await G.eventsForDay(key, { fresh: true })).filter((e) => !e.allDay && !e.fromApp).map((e) => ({ ...e, date: key }));
        const others = ((ui.gAhead && ui.gAhead.list) || []).filter((e) => e.date !== key);
        ui.gAhead = { at: Date.now(), list: [...others, ...fresh] };
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
  'demote-task': (el) => { Object.assign(task(el.dataset.id), { priority: 'nice', lastTouchedAt: new Date().toISOString() }); persist(['Moved to nice to have.']); },
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
  'open-dump': () => { dumpDraft = []; openModal(dumpHTML(), false); },
  'mic': () => toggleMic(),
  'dump-split': () => splitDumpText(),
  'dump-remove': (el) => { dumpDraft.splice(Number(el.dataset.index), 1); modal.querySelector('.dump-preview').innerHTML = dumpPreviewHTML(); },
  'dump-add': () => addDump(),
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
    if (name === 'place') {
      modal.querySelectorAll('.commute-fields').forEach((n) => { n.hidden = pick.dataset.value !== 'commute'; });
    }
    if (name === 'stepsBy') {
      const row = modal.querySelector('.claude-row');
      row.hidden = pick.dataset.value !== 'claude';
      const empty = [0, 1, 2].every((i) => !modal.querySelector(`#f-step${i}`).value.trim());
      if (pick.dataset.value === 'claude' && empty && modal.querySelector('#f-title').value.trim()) askClaude();
    }
    if (name.startsWith('result-')) {
      const reason = group.closest('.review-task').querySelector('.reason');
      reason.hidden = pick.dataset.value === 'done';
    }
    return;
  }
  const el = e.target.closest('[data-action]');
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
    const side = modal.querySelector('#side-cal');
    if (side && el.value) {
      side.dataset.day = el.value;
      modal.querySelector('#side-cal-title').textContent = fmtDay(el.value, { weekday: 'long', month: 'short', day: 'numeric' });
      refreshSideCalendar();
    }
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

modal.addEventListener('close', () => { stopMic(); modal.innerHTML = ''; modal.classList.remove('wide'); });

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

// ---------- start ----------

window.addEventListener('hashchange', () => { render(); view.focus({ preventScroll: true }); window.scrollTo(0, 0); });

const startupMessages = dailyCheck();
render();
startupMessages.forEach(toast);

// Keep the "now" line and current block fresh, without disturbing typing.
setInterval(() => {
  const busy = view.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (!busy && !modal.open) {
    const msgs = dailyCheck();
    render();
    msgs.forEach(toast);
  }
}, 60000);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
