import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTask, isStale, applyReview,
  dayTimeNeeded, colorForTasks, daysUntil, DEFAULT_SETTINGS,
} from '../js/rules.js';

const today = '2026-10-26';

function task(overrides) {
  return {
    id: Math.random().toString(36).slice(2),
    title: 'A task', goalId: 'g1', priority: 'important', deadline: '2026-11-05',
    minutes: 30, place: 'everywhere', status: 'open', createdAt: '2026-10-20T10:00:00Z',
    ...overrides,
  };
}

test('daysUntil counts calendar days', () => {
  assert.equal(daysUntil('2026-10-27', today), 1);
  assert.equal(daysUntil('2026-10-26', today), 0);
});

test('two open tasks cannot share a name (ignoring case and spaces)', () => {
  const existing = [task({ title: 'Write the essay' })];
  const problems = validateTask(task({ title: '  write  the ESSAY ' }), existing, today);
  assert.ok(problems.some((p) => p.includes('already in your list')));
  // A finished task with the same name is fine.
  assert.deepEqual(validateTask(task({ title: 'Write the essay' }), [task({ title: 'Write the essay', status: 'done' })], today), []);
});

test('important tasks untouched for 21 days are stale', () => {
  assert.equal(isStale(task({ createdAt: '2026-10-01T09:00:00Z' }), today), true);
  assert.equal(isStale(task({ createdAt: '2026-10-20T09:00:00Z' }), today), false);
  assert.equal(isStale(task({ priority: 'nice', createdAt: '2026-01-01T09:00:00Z' }), today), false);
});

test('commuting adds 30 minutes to the day', () => {
  const t = dayTimeNeeded([task({ minutes: 45, place: 'commute' }), task({ minutes: 30 })]);
  assert.deepEqual(t, { work: 75, commute: 30, total: 105 });
});

test('block color follows the most pressing task', () => {
  assert.equal(colorForTasks([task({ priority: 'nice' }), task({ priority: 'both' })]), 'blue');
  assert.equal(colorForTasks([task({ priority: 'important' })]), 'green');
  assert.equal(colorForTasks([task({ priority: 'nice' })]), 'yellow');
});

test('review: done closes the task, not started counts a push and keeps the reason', () => {
  const tasks = [task({ id: 'a' }), task({ id: 'b' })];
  const { tasks: out, log } = applyReview(tasks, {
    a: { result: 'done' },
    b: { result: 'not_started', reason: 'Unclear next step' },
  }, '2026-10-27T11:00:00Z');
  assert.equal(out[0].status, 'done');
  assert.equal(out[1].status, 'open');
  assert.equal(out[1].pushCount, 1);
  assert.equal(out[1].lastReason, 'Unclear next step');
  assert.equal(log.length, 2);
});

// ---------- calendar events, template steps ----------
import { eventsOn, templateSteps } from '../js/rules.js';

test('weekly events repeat on the same weekday', () => {
  const evs = [{ id: 'c', title: 'Class', date: '2026-10-20', start: '09:00', minutes: 90, repeat: 'weekly' }];
  assert.equal(eventsOn(evs, '2026-10-27').length, 1); // also a Tuesday
  assert.equal(eventsOn(evs, '2026-10-28').length, 0);
  assert.equal(eventsOn(evs, '2026-10-13').length, 0); // before it started
});

test('template steps always give three steps', () => {
  const s = templateSteps('Write the essay', 'silent');
  assert.equal(s.length, 3);
  assert.ok(s[1].includes('Write the essay'));
});

import { to12h, from12h, parseTime } from '../js/rules.js';

test('12-hour time converts both ways', () => {
  assert.equal(to12h('14:30'), '2:30 PM');
  assert.equal(to12h('00:05'), '12:05 AM');
  assert.equal(to12h('12:00'), '12:00 PM');
  assert.equal(from12h(12, 0, 'AM'), '00:00');
  assert.equal(from12h(2, 30, 'PM'), '14:30');
  assert.equal(parseTime('2:30 pm'), '14:30');
  assert.equal(parseTime('8:00'), '08:00');
  assert.equal(parseTime('13 PM'), null);
});

import { lastActiveDay, daySummary } from '../js/rules.js';

test('last active day looks at opens, plans and logs before today', () => {
  const days = { '2026-10-24': { taskIds: ['a'] }, '2026-10-31': { taskIds: ['b'] } };
  const log = [{ date: '2026-10-25', result: 'done', title: 'X' }];
  assert.equal(lastActiveDay('2026-10-30', { lastOpen: '2026-10-22', days, log }), '2026-10-22');
  assert.equal(lastActiveDay('2026-10-30', { days, log }), '2026-10-25');
  assert.equal(lastActiveDay('2026-10-30', {}), null);
});

test('day summary lists wins and counts what is still open', () => {
  const tasks = [{ id: 'a', status: 'done', title: 'A' }, { id: 'b', status: 'open', title: 'B' }];
  const days = { '2026-10-25': { taskIds: ['a', 'b'] } };
  const log = [{ date: '2026-10-25', result: 'done', title: 'A' }, { date: '2026-10-25', result: 'done', title: 'Logged win' }];
  assert.deepEqual(daySummary('2026-10-25', { days, log, tasks }), { planned: 2, done: ['A', 'Logged win'], open: 1 });
});

import { explicitTasks, defaultDeadline } from '../js/rules.js';

test('only the word "task" turns talk into tasks', () => {
  assert.deepEqual(explicitTasks('So tired today. Task: email the professor about the paper. I hate mondays.'), ['Email the professor about the paper']);
  assert.deepEqual(explicitTasks('task buy a suit and task call mom'), ['Buy a suit', 'Call mom']);
  assert.deepEqual(explicitTasks('I have many tasks today and my task list is long'), []);
  assert.deepEqual(explicitTasks('Tarea: llamar al banco'), ['Llamar al banco']);
  assert.deepEqual(explicitTasks('ok, task. Pay rent. Also task renew the visa photos'), ['Pay rent', 'Renew the visa photos']);
  assert.deepEqual(explicitTasks('Just venting, everything is a lot right now.'), []);
});

test('tasks from talking get a starting deadline by priority', () => {
  assert.equal(defaultDeadline('both', '2026-10-30'), '2026-10-31');
  assert.equal(defaultDeadline('urgent', '2026-10-30'), '2026-10-31');
  assert.equal(defaultDeadline('important', '2026-10-30'), '2026-11-06');
  assert.equal(defaultDeadline('nice', '2026-10-30'), '');
});

import { nextPartTitle, busyMinutes } from '../js/rules.js';

test('copies are named Part 2, Part 3...', () => {
  assert.equal(nextPartTitle('Write the essay'), 'Part 2 of Write the essay');
  assert.equal(nextPartTitle('Part 2 of Write the essay'), 'Part 3 of Write the essay');
  assert.equal(nextPartTitle('Write the essay', [task({ title: 'Part 2 of Write the essay' })]), 'Part 3 of Write the essay');
});

test('busy time counts overlaps once and only from 8 AM to 10 PM', () => {
  const items = [
    { start: '07:00', minutes: 120 },  // counts 8 to 9
    { start: '08:30', minutes: 60 },   // overlaps, adds 9 to 9:30
    { start: '21:00', minutes: 180 },  // counts 21 to 22
  ];
  assert.equal(busyMinutes(items), 150);
});

test('steps differ for computer and non-computer tasks', () => {
  assert.ok(templateSteps('Email Ana', 'everywhere', true)[0].includes('Close all windows'));
  assert.ok(!templateSteps('Buy a suit', 'everywhere', false)[0].includes('windows'));
});

import { cleanListLine } from '../js/rules.js';

test('pasted lines lose bullets, not real words', () => {
  assert.equal(cleanListLine('- Reply to Andre'), 'Reply to Andre');
  assert.equal(cleanListLine('2. Book flights'), 'Book flights');
  assert.equal(cleanListLine('- [x] Pay rent'), 'Pay rent');
  assert.equal(cleanListLine('Xerox the forms'), 'Xerox the forms');
  assert.equal(cleanListLine('2027 budget review'), '2027 budget review');
  assert.equal(cleanListLine('10 min call with Andrew'), '10 min call with Andrew');
});

test('markers without a space are removed too, minus signs in numbers are not', () => {
  assert.equal(cleanListLine('•Call mom'), 'Call mom');
  assert.equal(cleanListLine('-Book flights'), 'Book flights');
  assert.equal(cleanListLine('-5 degrees plan'), '-5 degrees plan');
});

import { layoutLanes, findFreeSlot } from '../js/rules.js';

test('overlapping events sit side by side', () => {
  const out = layoutLanes([{ start: 720, minutes: 90 }, { start: 750, minutes: 120 }, { start: 840, minutes: 60 }, { start: 1200, minutes: 60 }]);
  assert.deepEqual(out.map((o) => [o.lane, o.of]), [[0, 2], [1, 2], [0, 2], [0, 1]]);
});

test('a task goes in the first free time that fits', () => {
  const busy = [{ start: '08:00', minutes: 60 }, { start: '09:30', minutes: 60 }];
  assert.equal(findFreeSlot(30, busy, 8 * 60), '09:00');
  assert.equal(findFreeSlot(60, busy, 8 * 60), '10:30');
  assert.equal(findFreeSlot(60, busy, 21 * 60 + 30), null);
  // commuting needs 30 minutes before as well
  assert.equal(findFreeSlot(30, busy, 8 * 60, 22 * 60, 30), '11:00');
});

import { defaultPlanDay, hasContent, syncDecision, mergeData } from '../js/rules.js';

test('the Plan page opens on the day that has a plan', () => {
  assert.equal(defaultPlanDay(10, 0, 0), 'today');
  assert.equal(defaultPlanDay(10, 2, 0), 'today');
  assert.equal(defaultPlanDay(19, 0, 3), 'tomorrow'); // set tomorrow's plan at 7 PM, reopened: still there
  assert.equal(defaultPlanDay(21, 3, 0), 'tomorrow');
});

test('hasContent ignores a brand new, empty app', () => {
  assert.equal(hasContent({ goals: [{ id: 'life' }], tasks: [], days: {} }), false);
  assert.equal(hasContent({ goals: [{ id: 'life' }], tasks: [{ id: 'a' }] }), true);
  assert.equal(hasContent({ goals: [{ id: 'life' }], tasks: [], days: { '2026-11-02': { taskIds: ['a'] } } }), true);
  assert.equal(hasContent(null), false);
});

test('sync: first device sends its data, a new device takes the Drive copy', () => {
  assert.equal(syncDecision({ remoteSavedAt: null, base: null, localChanged: true, localHasContent: true }), 'push');
  assert.equal(syncDecision({ remoteSavedAt: null, base: null }), 'none');
  assert.equal(syncDecision({ remoteSavedAt: 'r1', base: null, localChanged: false, remoteHasContent: true }), 'pull');
});

test('sync: only one side changed', () => {
  assert.equal(syncDecision({ remoteSavedAt: 'r1', base: 'r1', localChanged: true }), 'push');
  assert.equal(syncDecision({ remoteSavedAt: 'r1', base: 'r1', localChanged: false }), 'none');
  assert.equal(syncDecision({ remoteSavedAt: 'r2', base: 'r1', localChanged: false }), 'pull');
});

test('sync: both changed merges, unless one side is empty', () => {
  assert.equal(syncDecision({ remoteSavedAt: 'r2', base: 'r1', localChanged: true, localHasContent: true, remoteHasContent: true }), 'merge');
  assert.equal(syncDecision({ remoteSavedAt: 'r2', base: 'r1', localChanged: true, localHasContent: true, remoteHasContent: false }), 'push');
  assert.equal(syncDecision({ remoteSavedAt: 'r2', base: null, localChanged: true, localHasContent: false, remoteHasContent: true }), 'pull');
});

const T = (id, extra = {}) => ({ id, title: id, status: 'open', ...extra });

test('merge keeps the plan from one device and a small edit from the other', () => {
  const base = { savedAt: '1', tasks: [T('a')], days: {}, returns: [] };
  const computer = { savedAt: '2', tasks: [T('a')], days: { '2026-11-02': { taskIds: ['a'], set: true } }, returns: [] };
  const phone = { savedAt: '3', tasks: [T('a')], days: {}, returns: [{ date: '2026-11-02' }] };
  const m = mergeData(base, phone, computer);
  assert.deepEqual(m.days['2026-11-02'].taskIds, ['a']);
  assert.equal(m.returns.length, 1);
});

test('merge: new tasks from both sides, edits and trash from each side', () => {
  const base = { savedAt: '1', tasks: [T('a'), T('b'), T('c')], days: {} };
  const local = { savedAt: '2', tasks: [T('a', { status: 'done' }), T('b'), T('c'), T('l')], days: {} };
  const remote = { savedAt: '3', tasks: [T('a'), T('b', { title: 'B2' }), T('r')], days: {} }; // c removed there
  const m = mergeData(base, local, remote);
  const byId = Object.fromEntries(m.tasks.map((t) => [t.id, t]));
  assert.equal(byId.a.status, 'done');
  assert.equal(byId.b.title, 'B2');
  assert.equal(byId.c, undefined);
  assert.ok(byId.l && byId.r);
});

test('merge: both edited the same task, the newer copy wins; no base keeps both sides', () => {
  const base = { savedAt: '1', tasks: [T('a')] };
  const m = mergeData(base, { savedAt: '5', tasks: [T('a', { title: 'local' })] }, { savedAt: '3', tasks: [T('a', { title: 'remote' })] });
  assert.equal(m.tasks[0].title, 'local');
  const u = mergeData(null, { savedAt: '2', tasks: [T('x')], days: { d1: { taskIds: ['x'] } } }, { savedAt: '3', tasks: [T('y')], days: { d2: { taskIds: ['y'] } } });
  assert.deepEqual(u.tasks.map((t) => t.id).sort(), ['x', 'y']);
  assert.deepEqual(Object.keys(u.days).sort(), ['d1', 'd2']);
});

test('merge: plans for the same day from both devices are joined, removals respected', () => {
  const D = '2026-11-02';
  const base = { savedAt: '1', tasks: [], days: { [D]: { taskIds: ['a'], times: { a: '09:00' }, set: true } } };
  const phone = { savedAt: '2', tasks: [], days: { [D]: { taskIds: ['a', 'rent'], times: { a: '09:00', rent: '10:00' }, set: true } } };
  const computer = { savedAt: '3', tasks: [], days: { [D]: { taskIds: ['a', 'email'], times: { a: '09:00', email: '11:00' }, set: true } } };
  const m = mergeData(base, phone, computer);
  assert.deepEqual(m.days[D].taskIds.sort(), ['a', 'email', 'rent']);
  assert.equal(m.days[D].times.rent, '10:00');
  assert.equal(m.days[D].planStale, true);
  const removed = mergeData(base, { savedAt: '2', days: { [D]: { taskIds: [], set: true, times: {} } } }, { savedAt: '3', days: { [D]: { taskIds: ['a', 'email'], set: true } } });
  assert.deepEqual(removed.days[D].taskIds, ['email']);
});

test('merge: an empty day opened on one device never wipes a plan made on the other', () => {
  const D = '2026-11-03';
  const base = { savedAt: '1', tasks: [], days: {} };
  const phone = { savedAt: '2', tasks: [], days: { [D]: { taskIds: ['a', 'b'], times: { a: '09:00' }, set: true, googleIds: ['g1'] } } };
  const computer = { savedAt: '3', tasks: [], days: { [D]: { taskIds: [], times: {}, slots: 3, set: false, googleIds: [] } } };
  const m = mergeData(base, computer, phone);
  assert.deepEqual(m.days[D].taskIds, ['a', 'b']);
  assert.equal(m.days[D].set, true);
  assert.deepEqual(m.days[D].googleIds, ['g1']);
});

test('merge without a base: done or trashed wins over open; returns are not doubled', () => {
  const m = mergeData(null,
    { savedAt: '2', tasks: [T('a', { status: 'done' })], returns: [{ date: 'd', lastActive: 'c', plannedAfter: false }] },
    { savedAt: '3', tasks: [T('a')], returns: [{ date: 'd', lastActive: 'c', plannedAfter: true }] });
  assert.equal(m.tasks[0].status, 'done');
  assert.equal(m.returns.length, 1);
  assert.equal(m.returns[0].plannedAfter, true);
});

import { levelOf, levelFields, rankTasks, proposeDay, parseDeadline } from '../js/rules.js';

test('only a name is needed; nothing blocks on level, deadline, goal or length', () => {
  assert.deepEqual(validateTask({ title: '' }, [], today), ['Give the task a name.']);
  const many = [1, 2, 3, 4].map((n) => task({ id: `b${n}`, title: `B${n}`, priority: 'both', deadline: '2026-10-27' }));
  assert.deepEqual(validateTask({ title: 'Anything', priority: 'both', deadline: '2026-12-30' }, many, today), []);
});

test('important plus the deadline decide the level', () => {
  assert.equal(levelOf({ important: true, deadline: '2026-10-27' }, today), 'both');
  assert.equal(levelOf({ important: true, deadline: '2026-11-20' }, today), 'important');
  assert.equal(levelOf({ important: false, deadline: '2026-10-26' }, today), 'urgent');
  assert.equal(levelOf({ important: false, deadline: '2026-10-20' }, today), 'urgent'); // overdue
  assert.equal(levelOf({ important: false }, today), 'nice');
});

test('tasks from before v2.0 keep what they meant', () => {
  assert.deepEqual(levelFields({ priority: 'important', deadline: '2026-10-27' }, today), { important: true, priority: 'both', promotionBlocked: false });
  assert.deepEqual(levelFields({ priority: 'urgent', deadline: '2026-11-30' }, today), { important: false, priority: 'nice', promotionBlocked: false });
  assert.equal(levelFields({ priority: 'nice', important: true }, today).priority, 'important');
});

test('ranking: level, then deadline, then goal order, then oldest', () => {
  const goals = [{ id: 'life' }, { id: 'job' }, { id: 'school' }];
  const list = [
    { id: 'late-later', priority: 'nice' },
    { id: 'school', priority: 'important', deadline: '2026-11-10', goalId: 'school' },
    { id: 'job', priority: 'important', deadline: '2026-11-10', goalId: 'job' },
    { id: 'life', priority: 'important', deadline: '2026-11-10', goalId: 'life' },
    { id: 'soon', priority: 'important', deadline: '2026-11-01', goalId: 'school' },
    { id: 'top', priority: 'both', deadline: '2026-10-27' },
  ];
  assert.deepEqual(rankTasks(list, goals).map((t) => t.id), ['top', 'soon', 'job', 'school', 'life', 'late-later']);
});

test('the day proposal: 2 focus from the important ones, then what is due soon', () => {
  const D = '2026-10-26';
  const t = (id, priority, extra = {}) => ({ id, title: id, status: 'open', priority, important: priority === 'both' || priority === 'important', ...extra });
  const tasks = [
    t('i1', 'both', { deadline: '2026-10-26' }), t('i2', 'important', { deadline: '2026-11-01' }), t('i3', 'important', { deadline: '2026-11-05' }),
    t('u1', 'urgent', { deadline: '2026-10-27' }), t('later', 'nice'),
    t('meet', 'both', { deadline: D, eventRef: { src: 'google', id: 'g', date: D } }),
    t('other-day', 'both', { deadline: '2026-10-27', eventRef: { src: 'google', id: 'h', date: '2026-10-27' } }),
  ];
  const p = proposeDay({ tasks, dayKey: D, slots: 3 });
  assert.deepEqual(p.focus, ['i1', 'i2']);
  assert.deepEqual(p.also, ['u1']);
  assert.deepEqual(p.calendar, ['meet']);
  assert.deepEqual(p.why.i1, { important: true, days: 0 });
  const none = proposeDay({ tasks: [t('u1', 'urgent', { deadline: D }), t('u2', 'urgent', { deadline: '2026-10-27' }), t('later', 'nice')], dayKey: D });
  assert.deepEqual(none.focus, ['u1', 'u2']);
  assert.deepEqual(none.also, []);
});

test('a deadline said at the start or end of the title is read and removed', () => {
  const T = '2026-11-04'; // a Wednesday
  assert.deepEqual(parseDeadline('Send CV to Ana tomorrow', T), { title: 'Send CV to Ana', deadline: '2026-11-05' });
  assert.deepEqual(parseDeadline('Call mom on Friday', T), { title: 'Call mom', deadline: '2026-11-06' });
  assert.deepEqual(parseDeadline('Pay rent by Nov 10', T), { title: 'Pay rent', deadline: '2026-11-10' });
  assert.deepEqual(parseDeadline('Mañana llamar a Pancho', T), { title: 'Llamar a Pancho', deadline: '2026-11-05' });
  assert.deepEqual(parseDeadline('Entregar ensayo 15 de noviembre', T), { title: 'Entregar ensayo', deadline: '2026-11-15' });
  assert.deepEqual(parseDeadline('Send report Jan 5', T), { title: 'Send report', deadline: '2027-01-05' });
  assert.deepEqual(parseDeadline('Fix the Monday report', T), { title: 'Fix the Monday report', deadline: '' });
  assert.deepEqual(parseDeadline('Buy milk', T), { title: 'Buy milk', deadline: '' });
});
