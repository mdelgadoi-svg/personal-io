import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTask, promoteDueTasks, isStale, applyReview,
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

test('a task needs a name, goal, deadline and time', () => {
  const problems = validateTask({ priority: 'important' }, [], today);
  assert.equal(problems.length, 4);
});

test('nice to have can skip the deadline', () => {
  assert.deepEqual(validateTask(task({ priority: 'nice', deadline: '' }), [], today), []);
});

test('two open tasks cannot share a name (ignoring case and spaces)', () => {
  const existing = [task({ title: 'Write the essay' })];
  const problems = validateTask(task({ title: '  write  the ESSAY ' }), existing, today);
  assert.ok(problems.some((p) => p.includes('already in your backlog')));
  // A finished task with the same name is fine.
  assert.deepEqual(validateTask(task({ title: 'Write the essay' }), [task({ title: 'Write the essay', status: 'done' })], today), []);
});

test('★! is limited to 2 open tasks', () => {
  const existing = [1, 2].map((i) => task({ title: `T${i}`, priority: 'both', deadline: '2026-10-27' }));
  const problems = validateTask(task({ priority: 'both', deadline: '2026-10-27' }), existing, today);
  assert.ok(problems.some((p) => p.includes('full')));
});

test('done tasks do not count toward the limit', () => {
  const existing = [task({ title: 'A', priority: 'both', deadline: '2026-10-27', status: 'done' }), task({ title: 'B', priority: 'both', deadline: '2026-10-27' })];
  assert.deepEqual(validateTask(task({ priority: 'both', deadline: '2026-10-27' }), existing, today), []);
});

test('★ is limited to 3 and ! to 3', () => {
  const full = [1, 2, 3].map((i) => task({ title: `I${i}`, priority: 'important' }));
  assert.ok(validateTask(task({ priority: 'important' }), full, today).length > 0);
  const three = [1, 2, 3].map((i) => task({ title: `U${i}`, priority: 'urgent' }));
  assert.ok(validateTask(task({ priority: 'urgent' }), three, today).length > 0);
});

test('★! needs a deadline today or tomorrow', () => {
  const problems = validateTask(task({ priority: 'both', deadline: '2026-11-10' }), [], today);
  assert.ok(problems.some((p) => p.includes('today or tomorrow')));
});

test('commuting tasks need a destination', () => {
  const problems = validateTask(task({ place: 'commute', destination: '' }), [], today);
  assert.ok(problems.some((p) => p.includes('where you need to go')));
});

test('important tasks due soon move up to ★! while there is room', () => {
  const tasks = [task({ priority: 'important', deadline: '2026-10-27' })];
  const { tasks: out, messages } = promoteDueTasks(tasks, today);
  assert.equal(out[0].priority, 'both');
  assert.equal(messages.length, 1);
});

test('promotion is blocked when ★! is full', () => {
  const tasks = [
    task({ priority: 'both', deadline: '2026-10-26' }),
    task({ priority: 'both', deadline: '2026-10-27' }),
    task({ priority: 'both', deadline: '2026-10-27' }),
    task({ priority: 'important', deadline: '2026-10-27' }),
  ];
  const { tasks: out } = promoteDueTasks(tasks, today);
  assert.equal(out[3].priority, 'important');
  assert.equal(out[3].promotionBlocked, true);
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

test('a task already at a full level can still be edited', () => {
  const old = [1, 2, 3].map((i) => task({ id: `b${i}`, title: `B${i}`, priority: 'both', deadline: '2026-10-27' }));
  assert.deepEqual(validateTask({ ...old[2], title: 'B3 fixed' }, old, today), []);
  // moving another task up to a full level is still blocked
  assert.ok(validateTask(task({ id: 'x', priority: 'both', deadline: '2026-10-27' }), old, today).length > 0);
});

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

test('! also needs a deadline today or tomorrow', () => {
  assert.ok(validateTask(task({ priority: 'urgent', deadline: '2026-11-10' }), [], today).some((p) => p.includes('today or tomorrow')));
  assert.deepEqual(validateTask(task({ priority: 'urgent', deadline: '2026-10-27' }), [], today), []);
});

test('an old ! task with a far deadline can still be renamed, but not newly made', () => {
  const old = task({ id: 'u', priority: 'urgent', deadline: '2026-11-10' });
  assert.deepEqual(validateTask({ ...old, title: 'Renamed' }, [old], today), []);
  assert.ok(validateTask({ ...old, deadline: '2026-11-12' }, [old], today).length > 0);
});

import { defaultPlanDay, hasContent, syncDecision } from '../js/rules.js';

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

test('sync: both changed asks, unless one side is empty', () => {
  assert.equal(syncDecision({ remoteSavedAt: 'r2', base: 'r1', localChanged: true, localHasContent: true, remoteHasContent: true }), 'ask');
  assert.equal(syncDecision({ remoteSavedAt: 'r2', base: 'r1', localChanged: true, localHasContent: true, remoteHasContent: false }), 'push');
  assert.equal(syncDecision({ remoteSavedAt: 'r2', base: null, localChanged: true, localHasContent: false, remoteHasContent: true }), 'pull');
});
