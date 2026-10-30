// Personal IO planning rules.
// Everything here is plain logic with no screens and no storage,
// so it can be tested on its own (see tests/rules.test.js).

export const PRIORITIES = {
  both:      { label: 'Important + urgent', mark: '★!', cap: 3 },
  important: { label: 'Important',          mark: '★',  cap: 4 },
  urgent:    { label: 'Urgent',             mark: '!',  cap: 3 },
  nice:      { label: 'Nice to have',       mark: '🤔', cap: Infinity },
};

export const PRIORITY_ORDER = ['both', 'urgent', 'important', 'nice'];

export const PLACES = {
  everywhere: 'Everywhere',
  silent: 'Requires silent space',
  commute: 'Requires commuting',
};

export const REASONS = [
  'Unclear next step',
  'Low energy',
  'Urgent thing came up',
  'Took longer',
  'Other',
];

export const DEFAULT_SETTINGS = {
  commuteMinutes: 30,          // added before every task that requires commuting
  blockStarts: ['08:00', '14:30'], // when deep work blocks start
  maxBlockMinutes: 240,        // a block is at most 4 hours
  minBlockMinutes: 120,        // and ideally at least 2 hours
  daySlots: 3,                 // task slots shown for a new day
  daySlotsMax: 7,              // the most a day can hold
  maxGoals: 10,
  urgentWindowDays: 2,         // "urgent" = deadline in less than 2 days
  staleDays: 21,               // ask "still important?" after this long untouched
};

// ---------- dates ----------

export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, days) {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function daysUntil(deadlineKey, todayKey) {
  const ms = parseDateKey(deadlineKey) - parseDateKey(todayKey);
  return Math.round(ms / 86400000);
}

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function toHHMM(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ---------- priorities and limits ----------

export function openTasks(tasks) {
  return tasks.filter((t) => t.status === 'open');
}

export function countByPriority(tasks) {
  const counts = { both: 0, important: 0, urgent: 0, nice: 0 };
  for (const t of openTasks(tasks)) counts[t.priority] += 1;
  return counts;
}

export function normalTitle(title) {
  return String(title || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function sameTitle(title, tasks) {
  const n = normalTitle(title);
  if (!n) return null;
  return tasks.find((t) => normalTitle(t.title) === n) || null;
}

export function isUrgentByDate(task, todayKey, settings = DEFAULT_SETTINGS) {
  if (!task.deadline) return false;
  return daysUntil(task.deadline, todayKey) < settings.urgentWindowDays;
}

// Returns a list of problems. An empty list means the task can be saved.
export function validateTask(task, allTasks, todayKey, settings = DEFAULT_SETTINGS) {
  const problems = [];
  if (!task.title || !task.title.trim()) problems.push('Give the task a name.');
  if (!task.goalId) problems.push('Every task belongs to a goal. Pick one.');
  if (!task.deadline && task.priority !== 'nice') problems.push('This task needs a deadline. (Only 🤔 nice-to-have can skip it.)');
  if (!task.minutes || task.minutes <= 0) problems.push('Say how long it will take.');
  if (task.place === 'commute' && !(task.destination || '').trim()) {
    problems.push('Say where you need to go.');
  }
  if (task.priority === 'both' && task.deadline && !isUrgentByDate(task, todayKey, settings)) {
    problems.push('★! means the deadline is today or tomorrow. Use ★ for later deadlines.');
  }
  const others = allTasks.filter((t) => t.id !== task.id);
  const sameName = sameTitle(task.title, others.filter((t) => t.status === 'open'));
  if (sameName) problems.push(`"${sameName.title}" is already in your backlog. Use a different name, or open that one.`);
  const counts = countByPriority(others);
  const info = PRIORITIES[task.priority];
  if (info && counts[task.priority] >= info.cap) {
    problems.push(`${info.mark} ${info.label} is full (${info.cap} of ${info.cap}). Finish one or move one down a level first.`);
  }
  return problems;
}

// Important tasks whose deadline is now close become important + urgent,
// as long as there is room. Returns the changed tasks and messages.
export function promoteDueTasks(tasks, todayKey, settings = DEFAULT_SETTINGS) {
  const messages = [];
  let bothCount = countByPriority(tasks).both;
  const updated = tasks.map((t) => {
    if (t.status !== 'open' || t.priority !== 'important') return t;
    if (!isUrgentByDate(t, todayKey, settings)) return t;
    if (bothCount < PRIORITIES.both.cap) {
      bothCount += 1;
      messages.push(`"${t.title}" is due soon, so it moved up to ★!.`);
      return { ...t, priority: 'both', promotionBlocked: false };
    }
    if (!t.promotionBlocked) {
      messages.push(`"${t.title}" is due soon, but ★! is full. Decide what moves down.`);
    }
    return { ...t, promotionBlocked: true };
  });
  return { tasks: updated, messages };
}

export function isStale(task, todayKey, settings = DEFAULT_SETTINGS) {
  if (task.status !== 'open') return false;
  if (task.priority !== 'important' && task.priority !== 'both') return false;
  const since = task.lastTouchedAt || task.createdAt;
  if (!since) return false;
  return daysUntil(todayKey, since.slice(0, 10)) >= settings.staleDays;
}

export function sortForPlanning(tasks) {
  return [...tasks].sort((a, b) => {
    const p = PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
    if (p !== 0) return p;
    return (a.deadline || '9999').localeCompare(b.deadline || '9999');
  });
}

// ---------- time needed for a day ----------

export function taskTotalMinutes(task, settings = DEFAULT_SETTINGS) {
  const commute = task.place === 'commute' ? settings.commuteMinutes : 0;
  return (task.minutes || 0) + commute;
}

export function dayTimeNeeded(tasks, settings = DEFAULT_SETTINGS) {
  let work = 0;
  let commute = 0;
  for (const t of tasks) {
    work += t.minutes || 0;
    if (t.place === 'commute') commute += settings.commuteMinutes;
  }
  return { work, commute, total: work + commute };
}

// ---------- calendar colors ----------

// Blue = do it now / really important. Green = should do, flexible.
// Yellow = might be useful.
export function colorForTasks(tasks) {
  if (tasks.some((t) => t.priority === 'both' || t.priority === 'urgent')) return 'blue';
  if (tasks.some((t) => t.priority === 'important')) return 'green';
  return 'yellow';
}

// ---------- your own calendar events ----------

// event: { id, title, date: 'YYYY-MM-DD', start: 'HH:MM', minutes, mode: 'online' | 'in_person',
//          commute: boolean, repeat: 'none' | 'weekly' }
export function eventsOn(events, dateKey) {
  const weekday = parseDateKey(dateKey).getDay();
  return (events || []).filter((e) => {
    if (e.date === dateKey) return true;
    if (e.repeat !== 'weekly' || e.date > dateKey) return false;
    if (e.until && dateKey > e.until) return false;
    return parseDateKey(e.date).getDay() === weekday;
  }).sort((a, b) => a.start.localeCompare(b.start));
}

// Time taken by calendar events, including the commute before in-person ones.
export function busyFromEvents(events, settings = DEFAULT_SETTINGS) {
  return events.map((e) => {
    const start = toMinutes(e.start) - (e.commute ? settings.commuteMinutes : 0);
    return [start, toMinutes(e.start) + e.minutes];
  });
}

// ---------- building the day ----------

// Tasks with a fixed time (and every commuting task) become their own events.
// Everything else is packed into deep work blocks of 2 to 4 hours,
// avoiding anything already on the calendar (calendarEvents).
export function buildDay(tasks, settings = DEFAULT_SETTINGS, calendarEvents = [], { keepOrder = false } = {}) {
  const events = [];
  const needsTime = [];
  const flexible = [];

  for (const t of tasks) {
    if (t.fixedTime) {
      const start = toMinutes(t.fixedTime);
      if (t.place === 'commute') {
        events.push({
          kind: 'commute', taskId: t.id,
          start: toHHMM(start - settings.commuteMinutes), minutes: settings.commuteMinutes,
          title: `Commute to ${t.destination || 'the meeting'}`,
        });
      }
      events.push({ kind: 'task', taskId: t.id, start: t.fixedTime, minutes: t.minutes, title: t.title });
    } else if (t.place === 'commute') {
      needsTime.push(t.id);
    } else {
      flexible.push(t);
    }
  }

  const busy = [
    ...events.map((e) => [toMinutes(e.start), toMinutes(e.start) + e.minutes]),
    ...busyFromEvents(calendarEvents, settings),
  ].sort((a, b) => a[0] - b[0]);
  const blocks = [];
  const didNotFit = [];
  // Your own order (dragged in the plan) wins; otherwise most pressing first.
  const queue = keepOrder ? [...flexible] : sortForPlanning(flexible);

  for (const startText of settings.blockStarts) {
    if (queue.length === 0) break;
    let start = toMinutes(startText);
    // Skip past anything already scheduled at the block's start (repeat for back-to-back events).
    let moved = true;
    while (moved) {
      moved = false;
      for (const [a, b] of busy) if (start >= a && start < b) { start = b; moved = true; }
    }
    // The block can run until the next fixed event, or the maximum length.
    let limit = start + settings.maxBlockMinutes;
    for (const [a] of busy) if (a > start && a < limit) limit = a;
    const room = limit - start;

    // Take tasks in priority order, skipping any that don't fit in what's left.
    const inBlock = [];
    let used = 0;
    for (let i = 0; i < queue.length; ) {
      if (used + queue[i].minutes <= room) {
        const [t] = queue.splice(i, 1);
        inBlock.push(t);
        used += t.minutes;
      } else {
        i += 1;
      }
    }
    if (inBlock.length > 0) {
      const minutes = Math.min(room, Math.max(used, Math.min(settings.minBlockMinutes, room)));
      blocks.push({
        start: toHHMM(start), minutes,
        taskIds: inBlock.map((t) => t.id),
        color: colorForTasks(inBlock),
      });
    }
  }
  for (const t of queue) didNotFit.push(t.id);
  return { blocks, events, needsTime, didNotFit };
}

// ---------- end of block review ----------

// outcomes: { [taskId]: { result: 'done' | 'working' | 'not_started', reason } }
export function applyReview(tasks, outcomes, nowIso) {
  const log = [];
  const updated = tasks.map((t) => {
    const o = outcomes[t.id];
    if (!o) return t;
    log.push({ at: nowIso, taskId: t.id, title: t.title, result: o.result, reason: o.reason || null });
    if (o.result === 'done') {
      return { ...t, status: 'done', doneAt: nowIso, lastTouchedAt: nowIso };
    }
    if (o.result === 'working') {
      return { ...t, lastTouchedAt: nowIso, lastReason: o.reason || null };
    }
    return {
      ...t,
      pushCount: (t.pushCount || 0) + 1,
      lastReason: o.reason || null,
    };
  });
  return { tasks: updated, log };
}

// ---------- first steps without AI ----------

// A plain template so "first minute" always has something, even without Claude.
export function templateSteps(title, place) {
  const setup = {
    silent: 'Find a quiet spot and put your phone face down',
    commute: `Check the route and when you need to leave`,
    everywhere: 'Close other windows and tabs',
  }[place] || 'Close other windows and tabs';
  const name = (title || 'the task').trim();
  return [setup, `Open what you need for: ${name}`, 'Do the first small piece for 60 seconds'];
}

// ---------- brain dump without AI ----------

// Splits free text into short task-like lines (one per sentence or line).
export function splitDump(text) {
  return String(text || '')
    .split(/\n|(?<=[.!?;])\s+|\s+(?:and then|also|then)\s+/i)
    .map((s) => s.replace(/^[\s\-*•\d.)]+/, '').replace(/[.;]+$/, '').trim())
    .filter((s) => s.split(/\s+/).length >= 2)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .slice(0, 25);
}

// ---------- 12-hour time ----------

// '14:30' -> '2:30 PM'
export function to12h(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}

// (2, 30, 'PM') -> '14:30'
export function from12h(h12, minute, ap) {
  let h = Number(h12) % 12;
  if (ap === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${String(Number(minute)).padStart(2, '0')}`;
}

// Reads '2:30 PM', '2 pm', '14:30' or '8:00' -> '14:30' / '08:00'. Returns null if unclear.
export function parseTime(text) {
  const t = String(text || '').trim().toUpperCase();
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] || 0);
  if (min > 59) return null;
  if (m[3]) return h >= 1 && h <= 12 ? from12h(h, min, m[3]) : null;
  return h <= 23 ? `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` : null;
}

// ---------- small helpers for words ----------

export function formatMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ---------- coming back after time away ----------

// The last day before today you actually used the app. Falls back to the latest day
// with a log entry or plan when the app has not recorded opens yet.
export function lastActiveDay(todayKey, { lastOpen = null, days = {}, log = [] } = {}) {
  if (lastOpen && lastOpen < todayKey) return lastOpen;
  const seen = [];
  Object.entries(days).forEach(([key, day]) => {
    if (key < todayKey && day && (day.taskIds || []).length) seen.push(key);
  });
  log.forEach((l) => { if (l.date && l.date < todayKey) seen.push(l.date); });
  return seen.sort().pop() || null;
}

// What happened on one day: what got done (wins first) and how much is still open.
export function daySummary(dateKey, { days = {}, log = [], tasks = [] } = {}) {
  const planned = ((days[dateKey] && days[dateKey].taskIds) || []).map((id) => tasks.find((t) => t.id === id)).filter(Boolean);
  const done = [...new Set(log.filter((l) => l.date === dateKey && l.result === 'done').map((l) => l.title))];
  const open = planned.filter((t) => t.status === 'open').length;
  return { planned: planned.length, done, open };
}
