import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTask, promoteDueTasks, isStale, buildDay, applyReview,
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

test('buildDay packs flexible tasks into blocks and adds commute before a timed meeting', () => {
  const coffee = task({ id: 'coffee', place: 'commute', destination: 'SF', fixedTime: '14:00', minutes: 45 });
  const a = task({ id: 'a', minutes: 90, priority: 'both', deadline: '2026-10-27' });
  const b = task({ id: 'b', minutes: 60 });
  const day = buildDay([coffee, a, b], DEFAULT_SETTINGS);
  assert.equal(day.events[0].kind, 'commute');
  assert.equal(day.events[0].start, '13:30');
  assert.equal(day.blocks[0].start, '08:00');
  assert.deepEqual(day.blocks[0].taskIds, ['a', 'b']);
  assert.equal(day.blocks[0].color, 'blue');
});

test('a commuting task without a time is flagged', () => {
  const day = buildDay([task({ id: 'x', place: 'commute', destination: 'SF' })]);
  assert.deepEqual(day.needsTime, ['x']);
});

test('blocks stop before a fixed meeting', () => {
  const meeting = task({ id: 'm', fixedTime: '10:00', minutes: 30 });
  const big = task({ id: 'big', minutes: 180 });
  const small = task({ id: 's', minutes: 60 });
  const day = buildDay([meeting, big, small]);
  // 08:00 to 10:00 only has room for the 60 minute task; the big one waits for 14:30.
  assert.deepEqual(day.blocks[0].taskIds, ['s']);
  assert.equal(day.blocks[0].start, '08:00');
  assert.ok(day.blocks[0].minutes <= 120);
  assert.deepEqual(day.blocks[1].taskIds, ['big']);
  assert.equal(day.blocks[1].start, '14:30');
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

// ---------- calendar events, template steps, brain dump ----------
import { eventsOn, templateSteps, splitDump } from '../js/rules.js';

test('weekly events repeat on the same weekday', () => {
  const evs = [{ id: 'c', title: 'Class', date: '2026-10-20', start: '09:00', minutes: 90, repeat: 'weekly' }];
  assert.equal(eventsOn(evs, '2026-10-27').length, 1); // also a Tuesday
  assert.equal(eventsOn(evs, '2026-10-28').length, 0);
  assert.equal(eventsOn(evs, '2026-10-13').length, 0); // before it started
});

test('blocks avoid calendar events and the commute before them', () => {
  const t = task({ id: 't', minutes: 60 });
  const cls = { id: 'c', title: 'Class', date: '2026-10-27', start: '08:30', minutes: 90, commute: true };
  // Commute starts 08:00, class ends 10:00, so the block starts at 10:00.
  const day = buildDay([t], DEFAULT_SETTINGS, [cls]);
  assert.equal(day.blocks[0].start, '10:00');
});

test('template steps always give three steps', () => {
  const s = templateSteps('Write the essay', 'silent');
  assert.equal(s.length, 3);
  assert.ok(s[1].includes('Write the essay'));
});

test('brain dump splits sentences into task lines', () => {
  const lines = splitDump('Email the professor about the paper. Buy a suit for the wedding\nok\ncall the bank and then book flights');
  assert.deepEqual(lines, ['Email the professor about the paper', 'Buy a suit for the wedding', 'Call the bank', 'Book flights']);
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

test('buildDay can keep your own order', () => {
  const low = task({ id: 'low', priority: 'nice', minutes: 60 });
  const high = task({ id: 'high', priority: 'both', deadline: '2026-10-27', minutes: 60 });
  assert.deepEqual(buildDay([low, high]).blocks[0].taskIds, ['high', 'low']);
  assert.deepEqual(buildDay([low, high], DEFAULT_SETTINGS, [], { keepOrder: true }).blocks[0].taskIds, ['low', 'high']);
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
