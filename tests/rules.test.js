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
  const problems = validateTask({ priority: 'nice' }, [], today);
  assert.equal(problems.length, 4);
});

test('★! is limited to 2 open tasks', () => {
  const existing = [task({ priority: 'both', deadline: '2026-10-27' }), task({ priority: 'both', deadline: '2026-10-26' })];
  const problems = validateTask(task({ priority: 'both', deadline: '2026-10-27' }), existing, today);
  assert.ok(problems.some((p) => p.includes('full')));
});

test('done tasks do not count toward the limit', () => {
  const existing = [task({ priority: 'both', deadline: '2026-10-27', status: 'done' }), task({ priority: 'both', deadline: '2026-10-27' })];
  assert.deepEqual(validateTask(task({ priority: 'both', deadline: '2026-10-27' }), existing, today), []);
});

test('★ is limited to 4 and ! to 3', () => {
  const four = [1, 2, 3, 4].map(() => task({ priority: 'important' }));
  assert.ok(validateTask(task({ priority: 'important' }), four, today).length > 0);
  const three = [1, 2, 3].map(() => task({ priority: 'urgent' }));
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
    task({ priority: 'important', deadline: '2026-10-27' }),
  ];
  const { tasks: out } = promoteDueTasks(tasks, today);
  assert.equal(out[2].priority, 'important');
  assert.equal(out[2].promotionBlocked, true);
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
