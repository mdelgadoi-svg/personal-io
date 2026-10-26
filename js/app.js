// Personal IO: screens and interactions.
// The rules live in rules.js; saving lives in store.js.

import * as R from './rules.js';
import { load, save, newId, exportBackup, readBackup } from './store.js';

let state = load();
const ui = { planDay: null, goalFilter: null, showDone: false };

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
const S = () => state.settings;

function persist(messages = []) {
  if (!save(state)) toast('Could not save on this device. Export a backup from Settings.');
  render();
  messages.forEach(toast);
}

function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  toasts.appendChild(el);
  // Show at most two at a time so they never pile up.
  while (toasts.children.length > 2) toasts.firstElementChild.remove();
  setTimeout(() => el.remove(), 4000);
}

function goal(id) { return state.goals.find((g) => g.id === id); }
function task(id) { return state.tasks.find((t) => t.id === id); }

function getDay(key) {
  if (!state.days[key]) {
    state.days[key] = { intention: '', taskIds: [], slots: S().daySlots, plan: null, planStale: false, reviewed: {} };
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

function placeChip(t) {
  if (t.place === 'commute') return `<span class="chip chip-commute">Requires commuting · +${S().commuteMinutes} min before</span>`;
  if (t.place === 'silent') return '<span class="chip chip-silent">Requires silent space</span>';
  return '<span class="chip chip-everywhere">Everywhere</span>';
}

function deadlineHTML(t) {
  if (!t.deadline) return '';
  const soon = R.isUrgentByDate(t, todayKey(), S());
  return `<span class="${soon ? 'due-soon' : ''}">due ${esc(fmtDay(t.deadline))}</span>`;
}

function openCount(goalId) {
  return state.tasks.filter((t) => t.goalId === goalId && t.status === 'open').length;
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

function itemTitle(item) {
  if (item.type === 'block') {
    const first = item.block.taskIds.map(task).filter(Boolean)[0];
    const g = first && goal(first.goalId);
    return `Deep work${g ? ' · ' + g.title : ''}`;
  }
  return item.event.title;
}

// ---------- rendering ----------

function render() {
  const tab = (location.hash || '#start').slice(1);
  document.querySelectorAll('[data-tab]').forEach((a) => {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  renderNowPill();
  if (tab === 'today') view.innerHTML = renderToday();
  else if (tab === 'goals') view.innerHTML = renderGoals();
  else if (tab === 'backlog') view.innerHTML = renderBacklog();
  else view.innerHTML = renderStart();
}

function renderNowPill() {
  const pill = document.getElementById('now-pill');
  const { current } = currentAndNext();
  if (!current) { pill.innerHTML = ''; return; }
  const end = R.toHHMM(current.start + current.minutes);
  pill.innerHTML = `<a class="now-pill" href="#today"><span class="dot"></span><span><strong>Now</strong><span class="long">: ${esc(itemTitle(current))}</span> · until ${end}</span></a>`;
}

function keyHTML() {
  const c = R.countByPriority(state.tasks);
  return `
  <section class="card key" aria-label="Priority key">
    <strong>Key</strong>
    <span>${markHTML('both')} Important + urgent <span class="muted">· ${c.both} of 2 · due today or tomorrow</span></span>
    <span>${markHTML('important')} Important <span class="muted">· ${c.important} of 4</span></span>
    <span>${markHTML('urgent')} Urgent <span class="muted">· ${c.urgent} of 3</span></span>
    <span>${markHTML('nice')} Nice to have <span class="muted">· no limit</span></span>
  </section>`;
}

// ----- start page (plan) -----

function renderStart() {
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const tKey = todayKey();
  const hasToday = !!(state.days[tKey] && state.days[tKey].plan);
  if (!ui.planDay) ui.planDay = (hour >= 15 || hasToday) ? 'tomorrow' : 'today';
  const dayKey = ui.planDay === 'today' ? tKey : tomorrowKey();
  const sub = hasToday ? 'Today already has a plan. Review it, or start shaping tomorrow.' : 'Pick what matters, then let the blocks build themselves.';

  return `
  <section class="page-head">
    <div>
      <div class="date-line">${esc(fmtDay(tKey, { weekday: 'long', month: 'long', day: 'numeric' }))}</div>
      <h1>${greet}. What's the plan?</h1>
      <div class="sub">${sub}</div>
    </div>
    <div class="seg" role="group" aria-label="Which day to plan" style="max-width: 360px">
      <button type="button" data-action="plan-day" data-day="today" aria-pressed="${ui.planDay === 'today'}">Plan today</button>
      <button type="button" data-action="plan-day" data-day="tomorrow" aria-pressed="${ui.planDay === 'tomorrow'}">Plan tomorrow</button>
    </div>
  </section>
  ${keyHTML()}
  <div class="cols">
    <section class="col col-goals" aria-label="Goals">
      <div class="col-head"><h2>Goals</h2><span class="meta">${state.goals.length} of ${S().maxGoals}</span></div>
      ${goalsListHTML(true)}
    </section>
    <section class="col col-backlog" aria-label="Task backlog">
      <div class="col-head"><h2>Task backlog</h2>
        <span class="meta">${ui.goalFilter ? 'Showing: ' + esc(goal(ui.goalFilter)?.title || '') + ' · <button class="btn-link" data-action="clear-filter">Show all</button>' : 'Tap a goal to filter'}</span>
      </div>
      ${backlogGroupsHTML({ addTo: dayKey, goalFilter: ui.goalFilter })}
    </section>
    <section class="col col-day" aria-label="Day plan">
      ${dayColumnHTML(dayKey)}
    </section>
  </div>`;
}

function goalsListHTML(selectable) {
  const items = state.goals.map((g) => `
    <button type="button" class="goal-item" ${selectable ? `data-action="filter-goal" data-id="${g.id}" aria-pressed="${ui.goalFilter === g.id}"` : `data-action="edit-goal" data-id="${g.id}"`}>
      <span class="top"><span>${esc(g.title)}</span><span class="n">${openCount(g.id)} open</span></span>
      ${g.why ? `<span class="why">Why: ${esc(g.why)}</span>` : ''}
    </button>`).join('');
  const add = state.goals.length < S().maxGoals
    ? '<div style="padding: 6px 14px; border-top: 1px solid var(--line-2)"><button class="btn-link" data-action="new-goal">+ New goal</button></div>'
    : '<div class="hint" style="padding: 10px 14px; border-top: 1px solid var(--line-2)">10 goals is the limit. Finish or remove one to add another.</div>';
  return `<div class="card list">${items}${add}</div>`;
}

function backlogGroupsHTML({ addTo = null, goalFilter = null, full = false } = {}) {
  const tKey = todayKey();
  const counts = R.countByPriority(state.tasks);
  let open = R.openTasks(state.tasks);
  if (goalFilter) open = open.filter((t) => t.goalId === goalFilter || t.priority === 'both' || t.priority === 'urgent');
  const day = addTo ? getDay(addTo) : null;

  const groups = R.PRIORITY_ORDER.map((p) => {
    const info = R.PRIORITIES[p];
    const list = R.sortForPlanning(open.filter((t) => t.priority === p));
    const capText = info.cap === Infinity ? `${list.length} tasks` : `${counts[p]} of ${info.cap}${counts[p] >= info.cap ? ' · full' : ''}`;
    if (p === 'nice' && !full && list.length > 0 && !ui.showNice) {
      return `<div class="card card-pad" style="display:flex; justify-content:space-between; align-items:center">
        <span>${markHTML('nice')} <strong>Nice to have</strong> · ${list.length} tasks</span>
        <button class="btn-link" data-action="toggle-nice">Show</button></div>`;
    }
    const rows = list.map((t) => taskRowHTML(t, { addTo, day, tKey, full })).join('')
      || `<div class="item"><span class="hint">Nothing here.</span></div>`;
    return `<div class="card list group-${p}">
      <div class="group-head"><span>${markHTML(p)} ${info.label}</span><span class="count">${capText}</span></div>
      ${rows}</div>`;
  });
  if (R.openTasks(state.tasks).length === 0) {
    return `<div class="card empty">Your backlog is empty.<br><button class="btn" style="margin-top: 12px" data-action="new-task">+ Add your first task</button></div>`;
  }
  return groups.join('');
}

function taskRowHTML(t, { addTo, day, tKey, full }) {
  const g = goal(t.goalId);
  const stale = R.isStale(t, tKey, S());
  const inDay = day && day.taskIds.includes(t.id);
  let actions = '';
  if (addTo) {
    actions = inDay
      ? '<span class="chip chip-done">In plan</span>'
      : `<button class="btn btn-small" data-action="add-to-day" data-id="${t.id}" data-day="${addTo}">+ ${addTo === tKey ? 'Today' : 'Tomorrow'}</button>`;
  } else if (full) {
    actions = `
      <button class="btn btn-small" data-action="complete-task" data-id="${t.id}" aria-label="Mark done">Done</button>
      <button class="btn btn-small" data-action="edit-task" data-id="${t.id}">Edit</button>`;
  }
  return `
  <div class="item" style="${stale ? 'background:#FFFBF2' : ''}">
    <div class="item-main">
      <button class="btn-link" style="text-align:left; color: var(--ink); padding: 0; min-height: 0; font-size: 15px" data-action="edit-task" data-id="${t.id}">${esc(t.title)}</button>
      <div class="item-meta">
        ${g ? `<span class="chip chip-goal">${esc(g.title)}</span>` : ''}
        <span>${R.formatMinutes(t.minutes || 0)}</span>
        ${deadlineHTML(t)}
        ${placeChip(t)}
      </div>
      ${t.pushCount ? `<div class="item-meta"><span class="due-soon">Pushed ${t.pushCount}x${t.lastReason ? ' · ' + esc(t.lastReason.toLowerCase()) : ''}</span></div>` : ''}
      ${t.promotionBlocked ? '<div class="item-meta"><span class="chip chip-warn">Due soon, but ★! is full. Decide what moves down.</span></div>' : ''}
      ${stale ? `<div class="item-meta" style="color:#6B4E00">Waiting ${S().staleDays}+ days without a step. Still important?
          <button class="btn btn-small" data-action="keep-task" data-id="${t.id}">Keep</button>
          <button class="btn btn-small" data-action="demote-task" data-id="${t.id}">Move to nice to have</button></div>` : ''}
    </div>
    <div class="item-actions">${actions}</div>
  </div>`;
}

function dayColumnHTML(dayKey) {
  const day = getDay(dayKey);
  const isToday = dayKey === todayKey();
  const tasks = day.taskIds.map(task).filter(Boolean);
  const need = R.dayTimeNeeded(tasks.filter((t) => t.status === 'open'), S());
  const workPct = need.total ? Math.round((need.work / need.total) * 100) : 100;

  const slots = tasks.map((t) => {
    const g = goal(t.goalId);
    const pressing = t.priority === 'both' || t.priority === 'urgent';
    const done = t.status === 'done';
    return `
    <article class="slot ${pressing ? 'pressing' : ''} ${t.place === 'commute' ? 'commute' : ''}" style="${done ? 'opacity:.6' : ''}">
      <div class="slot-top"><span>${esc(g?.title || '')}</span>${markHTML(t.priority)}</div>
      <span class="slot-title" style="${done ? 'text-decoration: line-through' : ''}">${esc(t.title)}</span>
      ${t.firstStep ? `<span class="first-min"><strong>First minute:</strong> ${esc(t.firstStep)}</span>` : ''}
      <div class="item-meta"><span class="mono">${R.formatMinutes(t.minutes || 0)}</span>${placeChip(t)}</div>
      ${t.place === 'commute' ? `
        <div class="field" style="max-width: 220px">
          <label for="time-${t.id}">Meeting time</label>
          <input class="input" type="time" id="time-${t.id}" value="${esc(t.fixedTime || '')}" data-change="set-time" data-id="${t.id}">
        </div>` : ''}
      <div><button class="btn-link" data-action="remove-from-day" data-id="${t.id}" data-day="${dayKey}">Remove from ${isToday ? 'today' : 'tomorrow'}</button></div>
    </article>`;
  }).join('');

  const empties = Array.from({ length: Math.max(0, day.slots - tasks.length) }, (_, i) => `
    <div class="slot-empty">Slot ${tasks.length + i + 1} is open. Add a task from the backlog,
      or <button class="btn-link" data-action="new-task" data-day="${dayKey}">create a new one</button>.</div>`).join('');

  const missingTime = tasks.filter((t) => t.status === 'open' && t.place === 'commute' && !t.fixedTime);
  const planHTML = day.plan ? planSummaryHTML(day, dayKey) : '';

  return `
  <div class="col-head"><h2>${isToday ? 'Today' : 'Tomorrow'} · ${esc(fmtDay(dayKey, { weekday: 'long' }))}</h2>
    <span class="meta">${tasks.length} of ${day.slots} slots · up to ${S().daySlotsMax}</span></div>
  <div class="field">
    <label for="intention">Intention for the day</label>
    <input class="input" id="intention" type="text" placeholder="One sentence. What would make this day a win?" value="${esc(day.intention)}" data-change="intention" data-day="${dayKey}">
  </div>
  <div class="card card-pad">
    <div class="field-label" style="text-transform: uppercase; font-size: 12px; letter-spacing: .4px; color: var(--muted)">Time needed</div>
    <div class="time-total">${R.formatMinutes(need.total)} ${need.commute ? `<span>of which ${R.formatMinutes(need.commute)} is commute</span>` : ''}</div>
    <div class="bar"><div class="w" style="width:${workPct}%"></div><div class="c" style="width:${100 - workPct}%"></div></div>
  </div>
  ${slots}${empties}
  ${day.slots < S().daySlotsMax ? `<button class="btn-link" data-action="open-slot" data-day="${dayKey}">+ Open another slot (${day.slots + 1} of ${S().daySlotsMax})</button>` : ''}
  ${missingTime.length ? `<div class="note note-warn">Add a meeting time for: ${missingTime.map((t) => esc(t.title)).join(', ')}. I'll put ${S().commuteMinutes} minutes of commute before it.</div>` : ''}
  ${tasks.some((t) => t.place === 'commute') ? '<div class="note note-commute">Tasks that require commuting go outside your deep work blocks.</div>' : ''}
  ${day.planStale ? '<div class="note note-warn">The plan changed. Build the blocks again to update them.</div>' : ''}
  <div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px">
    <span class="hint">Groups tasks into 2 to 4 hour deep work blocks starting at ${S().blockStarts.join(' and ')}.</span>
    <button class="btn btn-dark" data-action="build-day" data-day="${dayKey}" ${tasks.length ? '' : 'disabled'}>${day.plan ? 'Rebuild my blocks' : 'Build my blocks'}</button>
  </div>
  ${planHTML}`;
}

function planSummaryHTML(day, dayKey) {
  const rows = [
    ...day.plan.events.map((e) => ({ start: e.start, html: `<span class="mono">${e.start}</span> ${e.kind === 'commute' ? '<span class="chip chip-commute">Commute</span>' : ''} ${esc(e.title)} · ${R.formatMinutes(e.minutes)}` })),
    ...day.plan.blocks.map((b) => ({ start: b.start, html: `<span class="mono">${b.start}</span> <span class="tag tag-${b.color}">Deep work</span> ${b.taskIds.length} tasks · ${R.formatMinutes(b.minutes)}` })),
  ].sort((a, b) => a.start.localeCompare(b.start));
  const left = [...day.plan.didNotFit, ...day.plan.needsTime].map(task).filter(Boolean);
  return `
  <div class="card card-pad" style="display:flex; flex-direction:column; gap:8px">
    <strong>Your blocks</strong>
    ${rows.map((r) => `<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; font-size:14px">${r.html}</div>`).join('')}
    ${left.length ? `<div class="note note-warn">Didn't fit: ${left.map((t) => esc(t.title)).join(', ')}.</div>` : ''}
    ${dayKey === todayKey() ? '<a class="btn" href="#today">Open today</a>' : ''}
  </div>`;
}

// ----- today -----

function renderToday() {
  const key = todayKey();
  const day = state.days[key];
  if (!day || !day.plan) {
    return `
    <section class="page-head"><div><div class="date-line">${esc(fmtDay(key, { weekday: 'long', month: 'long', day: 'numeric' }))}</div><h1>Today</h1></div></section>
    <div class="card empty">No plan for today yet.<br><button class="btn btn-dark" style="margin-top:12px" data-action="go-plan-today">Plan today</button></div>`;
  }
  const { current, next } = currentAndNext();
  return `
  <section class="page-head">
    <div><div class="date-line">${esc(fmtDay(key, { weekday: 'long', month: 'long', day: 'numeric' }))}</div><h1>Today</h1>
    ${day.intention ? `<div class="sub">Intention: ${esc(day.intention)}</div>` : ''}</div>
  </section>
  ${nowCardHTML(current, next)}
  <div class="cols">
    <section class="col" style="flex: 1 1 340px" aria-label="Blocks">
      <div class="col-head"><h2>Blocks</h2><span class="meta">${day.plan.blocks.length} deep work blocks</span></div>
      ${blocksHTML(day)}
    </section>
    <section class="col card card-pad" style="flex: 1.3 1 420px" aria-label="Calendar">
      <div class="col-head" style="margin-bottom: 8px"><h2>Calendar</h2>
        <span class="meta" style="display:flex; gap:10px; flex-wrap:wrap">
          <span><span class="tag tag-blue">Blue</span> do now</span>
          <span><span class="tag tag-green">Green</span> should do</span>
          <span><span class="tag tag-yellow">Yellow</span> might help</span>
        </span></div>
      ${timelineHTML(day)}
    </section>
  </div>`;
}

function nowCardHTML(current, next) {
  if (!current) {
    if (!next) return '<div class="note note-info" style="margin-bottom:20px">Nothing else scheduled today.</div>';
    return `<div class="note note-info" style="margin-bottom:20px">Next at <strong>${R.toHHMM(next.start)}</strong>: ${esc(itemTitle(next))}.</div>`;
  }
  const end = current.start + current.minutes;
  const done = nowMinutes() - current.start;
  const pct = Math.max(0, Math.min(100, Math.round((done / current.minutes) * 100)));
  let title = itemTitle(current);
  let first = '';
  let actions = '';
  if (current.type === 'block') {
    const openTask = current.block.taskIds.map(task).find((t) => t && t.status === 'open');
    if (openTask) {
      title = openTask.title;
      first = openTask.firstStep ? `First minute: ${openTask.firstStep}` : '';
    }
    actions = `<button class="btn btn-outline" data-action="review" data-block="${current.index}">End block</button>`;
  }
  return `
  <section class="now-card" aria-label="Now">
    <div class="left">
      <div class="label"><span class="dot"></span>Now · until ${R.toHHMM(end)}</div>
      <div class="title">${esc(title)}</div>
      ${first ? `<div class="first">${esc(first)}</div>` : ''}
    </div>
    <div class="right">
      <div class="times"><span>${R.formatMinutes(Math.max(done, 0))} done</span><span>${R.formatMinutes(Math.max(end - nowMinutes(), 0))} left</span></div>
      <div class="prog"><div style="width:${pct}%"></div></div>
      <div style="display:flex; gap:8px; margin-top:6px">${actions}</div>
    </div>
  </section>`;
}

function blocksHTML(day) {
  const now = nowMinutes();
  return day.plan.blocks.map((b, i) => {
    const tasks = b.taskIds.map(task).filter(Boolean);
    const started = now >= R.toMinutes(b.start);
    const reviewed = day.reviewed && day.reviewed[i];
    const colorWord = { blue: 'BLUE · DO NOW', green: 'GREEN · SHOULD DO', yellow: 'YELLOW · MIGHT HELP' }[b.color];
    return `
    <article class="card block-card" style="${b.color === 'blue' ? 'border: 2px solid var(--blue)' : ''}">
      <div class="block-head">
        <span><span class="tag tag-${b.color}">${colorWord}</span> <span class="mono">${b.start} - ${R.toHHMM(R.toMinutes(b.start) + b.minutes)}</span></span>
        ${reviewed ? '<span class="chip chip-done">Reviewed</span>' : started ? `<button class="btn btn-small" data-action="review" data-block="${i}">End block</button>` : ''}
      </div>
      ${tasks.map((t) => `
        <div class="task-line ${t.status === 'done' ? 'done' : ''}">
          ${markHTML(t.priority)}
          <div style="display:flex; flex-direction:column; gap:2px">
            <span class="t" style="font-weight:600">${esc(t.title)}</span>
            ${t.firstStep && t.status !== 'done' ? `<span class="first-min"><strong>First minute:</strong> ${esc(t.firstStep)}</span>` : ''}
          </div>
        </div>`).join('')}
    </article>`;
  }).join('') || '<div class="card empty">No deep work blocks today.</div>';
}

function timelineHTML(day) {
  const startHour = 7;
  const endHour = 23;
  const px = 56;
  const top = (m) => ((m - startHour * 60) / 60) * px;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => `<span style="top:${i * px}px">${startHour + i}:00</span>`).join('');
  const blocks = day.plan.blocks.map((b) => {
    const tasks = b.taskIds.map(task).filter(Boolean);
    const s = R.toMinutes(b.start);
    return `<div class="ev ev-${b.color}" style="top:${top(s)}px; height:${(b.minutes / 60) * px - 2}px">Deep work · ${tasks.length} tasks<span class="sub">${b.start} - ${R.toHHMM(s + b.minutes)}</span></div>`;
  });
  const events = day.plan.events.map((e) => {
    const s = R.toMinutes(e.start);
    const t = task(e.taskId);
    const cls = e.kind === 'commute' ? 'ev-commute' : `ev-${R.colorForTasks(t ? [t] : [])}`;
    return `<div class="ev ${cls}" style="top:${top(s)}px; height:${Math.max((e.minutes / 60) * px - 2, 22)}px">${e.start} ${esc(e.title)}</div>`;
  });
  const now = nowMinutes();
  const nowLine = now >= startHour * 60 && now <= endHour * 60 ? `<div class="now-line" style="top:${top(now)}px" aria-label="Now"></div>` : '';
  const height = (endHour - startHour) * px;
  return `<div class="timeline-wrap"><div class="hours" aria-hidden="true" style="height:${height}px">${hours}</div>
    <div class="grid" style="height:${height}px">${blocks.join('')}${events.join('')}${nowLine}</div></div>`;
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
    <button class="btn btn-dark" data-action="new-task">+ New task</button>
  </section>
  ${keyHTML()}
  <div class="cols">
    <section class="col" style="flex: 1.4 1 420px">${backlogGroupsHTML({ full: true })}</section>
    <section class="col" style="flex: 1 1 320px">
      <div class="col-head"><h2>Record</h2><span class="meta">What you did and didn't, and why</span></div>
      <div class="card table-scroll">
        ${log.length ? `<table class="record"><thead><tr><th>When</th><th>Task</th><th>Result</th></tr></thead><tbody>
          ${log.map((l) => `<tr><td class="mono">${esc(l.date ? fmtDay(l.date) : l.at.slice(0, 10))}</td><td>${esc(l.title)}</td><td>${resultWord[l.result]}${l.reason ? `<div class="hint">${esc(l.reason)}</div>` : ''}</td></tr>`).join('')}
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

function openModal(html) {
  modal.innerHTML = html;
  if (!modal.open) modal.showModal();
  const first = modal.querySelector('input, select, textarea');
  if (first) first.focus();
}
function closeModal() { modal.close(); modal.innerHTML = ''; }

function taskFormHTML(t, opts) {
  const draft = t || { priority: 'important', place: 'everywhere', goalId: opts.goalId || state.goals[0]?.id, minutes: 30 };
  const pressed = (v, cur) => `aria-pressed="${v === cur}"`;
  return `
  <form class="modal" data-form="task" data-id="${t ? t.id : ''}" data-day="${esc(opts.dayKey || '')}" novalidate>
    <div class="modal-head"><h2 id="modal-title">${t ? 'Edit task' : 'New task'}</h2>
      <button type="button" class="btn btn-ghost icon-btn" data-action="close-modal" aria-label="Close">✕</button></div>
    <div class="errors" hidden></div>
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
    <div class="field"><label for="f-first">First minute: the tiniest way to start</label>
      <input class="input" id="f-first" name="firstStep" value="${esc(draft.firstStep || '')}" placeholder="Open a blank note and write the 3 fund names"></div>
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
          <div class="field"><label class="visually-hidden" for="f-time">Fixed time</label>
          <input class="input" type="time" id="f-time" name="fixedTime" value="${esc(draft.fixedTime || '')}" style="max-width:180px">
          <span class="hint">Only for meetings or appointments. Leave empty and it goes into a deep work block.</span></div>
        </td></tr>
        <tr><th scope="row">To get it done</th><td>
          <div class="field"><label class="visually-hidden" for="f-needs">To get it done</label>
          <textarea class="input" id="f-needs" name="needs" placeholder="One per line: questions to prepare, documents to bring...">${esc((draft.needs || []).map((n) => n.text).join('\n'))}</textarea></div>
        </td></tr>
      </tbody></table>
    </section>
    <div class="modal-foot">
      ${t ? '<button type="button" class="btn" data-action="delete-task" style="margin-right:auto; color: var(--bang)">Delete</button>' : ''}
      <button type="button" class="btn" data-action="close-modal">Cancel</button>
      <button type="submit" class="btn btn-dark">${opts.dayKey ? 'Save and add to day' : 'Save to backlog'}</button>
    </div>
  </form>`;
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
  const end = R.toHHMM(R.toMinutes(block.start) + block.minutes);
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
      </div>
    </div>`).join('');
  return `
  <form class="modal" data-form="review" data-block="${blockIndex}" novalidate>
    <div class="modal-head"><div><div class="date-line">Block ${block.start} - ${end}</div><h2 id="modal-title">How did it go?</h2></div>
      <button type="button" class="btn btn-ghost icon-btn" data-action="close-modal" aria-label="Close">✕</button></div>
    <div class="hint">One answer per task. Anything not done goes back to your backlog with the reason.</div>
    <div class="errors" hidden></div>
    ${rows || '<div class="empty">Everything in this block is already done.</div>'}
    <div class="modal-foot">
      <button type="button" class="btn" data-action="close-modal">Cancel</button>
      <button type="submit" class="btn btn-dark">Save</button>
    </div>
  </form>`;
}

function settingsHTML() {
  return `
  <form class="modal" data-form="settings" novalidate>
    <div class="modal-head"><h2 id="modal-title">Settings</h2>
      <button type="button" class="btn btn-ghost icon-btn" data-action="close-modal" aria-label="Close">✕</button></div>
    <div class="row">
      <div class="field"><label for="s-commute">Commute time before a task (minutes)</label>
        <input class="input" type="number" min="0" step="5" id="s-commute" name="commuteMinutes" value="${S().commuteMinutes}"></div>
      <div class="field"><label for="s-starts">Deep work blocks start at</label>
        <input class="input" id="s-starts" name="blockStarts" value="${esc(S().blockStarts.join(', '))}">
        <span class="hint">Separate times with commas, like 08:00, 14:30</span></div>
    </div>
    <div class="field"><label for="s-stale">Ask "still important?" after (days)</label>
      <input class="input" type="number" min="3" id="s-stale" name="staleDays" value="${S().staleDays}" style="max-width:160px"></div>
    <div class="card card-pad" style="display:flex; flex-direction:column; gap:10px">
      <strong>Backup</strong>
      <span class="hint">Right now your data is saved only in this browser. Download a backup now and then.</span>
      <div style="display:flex; gap:8px; flex-wrap:wrap">
        <button type="button" class="btn" data-action="export">Download backup</button>
        <label class="btn" for="s-import" style="cursor:pointer">Restore from backup</label>
        <input type="file" id="s-import" accept="application/json" class="visually-hidden" data-change="import">
      </div>
    </div>
    <div class="note note-info"><strong>Google Calendar and Tasks:</strong> not connected yet. That's the next step, so your phone and computer share the same plan.</div>
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
  day.taskIds.push(taskId);
  if (day.plan) day.planStale = true;
  persist();
}

const actions = {
  'plan-day': (el) => { ui.planDay = el.dataset.day; render(); },
  'go-plan-today': () => { ui.planDay = 'today'; location.hash = '#start'; },
  'filter-goal': (el) => { ui.goalFilter = ui.goalFilter === el.dataset.id ? null : el.dataset.id; render(); },
  'clear-filter': () => { ui.goalFilter = null; render(); },
  'toggle-nice': () => { ui.showNice = !ui.showNice; render(); },
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
  'build-day': (el) => {
    const key = el.dataset.day;
    const day = getDay(key);
    const tasks = day.taskIds.map(task).filter((t) => t && t.status === 'open');
    day.plan = R.buildDay(tasks, S());
    day.planStale = false;
    day.reviewed = {};
    const msgs = [`Built ${day.plan.blocks.length} deep work block${day.plan.blocks.length === 1 ? '' : 's'}.`];
    if (day.plan.didNotFit.length) msgs.push(`${day.plan.didNotFit.length} task(s) didn't fit. Open another block time in Settings or move them.`);
    persist(msgs);
  },
  'new-task': (el) => {
    if (state.goals.length === 0) { openModal(goalFormHTML(null)); return; }
    openModal(taskFormHTML(null, { dayKey: el.dataset.day, goalId: el.dataset.goal }));
  },
  'edit-task': (el) => openModal(taskFormHTML(task(el.dataset.id), {})),
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
  'review': (el) => openModal(reviewHTML(Number(el.dataset.block))),
  'open-settings': () => openModal(settingsHTML()),
  'export': () => exportBackup(state),
  'close-modal': () => closeModal(),
};

document.addEventListener('click', (e) => {
  // Toggle buttons inside a group (priority, place, results, reasons).
  const pick = e.target.closest('[data-group] > button');
  if (pick) {
    const group = pick.parentElement;
    group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === pick)));
    const name = group.dataset.group;
    if (name === 'place') {
      modal.querySelectorAll('.commute-fields').forEach((n) => { n.hidden = pick.dataset.value !== 'commute'; });
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
    t.fixedTime = el.value || null;
    const day = Object.values(state.days).find((d) => d.taskIds.includes(t.id) && d.plan);
    if (day) day.planStale = true;
    persist();
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

function pressedValue(form, group) {
  return form.querySelector(`[data-group="${group}"] [aria-pressed="true"]`)?.dataset.value || null;
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
    const draft = {
      ...(existing || { id: newId(), status: 'open', createdAt: nowIso, pushCount: 0 }),
      title: data.get('title').trim(),
      goalId: data.get('goalId'),
      priority: pressedValue(form, 'priority') || 'important',
      deadline: data.get('deadline') || '',
      minutes: Number(data.get('minutes')) || 0,
      firstStep: data.get('firstStep').trim(),
      place: pressedValue(form, 'place') || 'everywhere',
      destination: (data.get('destination') || '').trim(),
      fixedTime: data.get('fixedTime') || null,
      needs: data.get('needs').split('\n').map((s) => s.trim()).filter(Boolean).map((text) => ({ text, done: false })),
      lastTouchedAt: nowIso,
      promotionBlocked: false,
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
      outcomes[id] = { result, reason };
    });
    if (problems.length) { showErrors(form, problems); return; }
    const nowIso = new Date().toISOString();
    const { tasks, log } = R.applyReview(state.tasks, outcomes, nowIso);
    state.tasks = tasks;
    state.log.push(...log.map((l) => ({ ...l, date: todayKey() })));
    const day = getDay(todayKey());
    day.reviewed = { ...(day.reviewed || {}), [index]: true };
    const back = Object.values(outcomes).filter((o) => o.result !== 'done').length;
    closeModal();
    persist([back ? `Saved. ${back} task${back === 1 ? '' : 's'} back in your backlog.` : 'Saved. Everything done.']);
  }

  if (kind === 'settings') {
    const starts = String(data.get('blockStarts')).split(',').map((s) => s.trim()).filter((s) => /^\d{1,2}:\d{2}$/.test(s))
      .map((s) => s.padStart(5, '0')).sort();
    const problems = [];
    if (starts.length === 0) problems.push('Add at least one block start time, like 08:00.');
    if (problems.length) { showErrors(form, problems); return; }
    state.settings = {
      ...S(),
      commuteMinutes: Math.max(0, Number(data.get('commuteMinutes')) || 0),
      blockStarts: starts,
      staleDays: Math.max(3, Number(data.get('staleDays')) || 21),
    };
    closeModal();
    persist(['Settings saved.']);
  }
});

modal.addEventListener('close', () => { modal.innerHTML = ''; });

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
