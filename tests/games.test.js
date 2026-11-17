import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from '../js/vendor/chess.js';
import { sudokuNew, sudokuCount, sudokuConflicts, sudokuSolved, botMove, squareName, SUDOKU, CHESS_LEVELS } from '../js/games.js';

// A small repeatable random source, so the tests always see the same puzzles.
function seeded(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

test('Sudoku: every size gives a full solution and a puzzle with exactly one answer', () => {
  for (const size of [4, 6, 9]) {
    const { solution, puzzle } = sudokuNew(size, seeded(size));
    assert.equal(solution.length, size * size);
    assert.equal(sudokuSolved(solution, size), true);
    assert.equal(puzzle.filter((d) => d === 0).length, SUDOKU[size].holes, `holes for ${size}`);
    assert.equal(sudokuCount(puzzle, size, 2), 1, `one answer for ${size}`);
    puzzle.forEach((d, i) => { if (d) assert.equal(d, solution[i]); });
  }
});

test('Sudoku: a repeated number is marked, an unfinished grid is not solved', () => {
  const { solution } = sudokuNew(4, seeded(7));
  const grid = [...solution];
  assert.equal(sudokuConflicts(grid, 4).size, 0);
  grid[1] = grid[0];
  assert.ok(sudokuConflicts(grid, 4).has(0) && sudokuConflicts(grid, 4).has(1));
  assert.equal(sudokuSolved(grid, 4), false);
  const open = [...solution]; open[5] = 0;
  assert.equal(sudokuSolved(open, 4), false);
});

test('Chess: squares are named like on a board', () => {
  assert.equal(squareName(0), 'a8');
  assert.equal(squareName(96), 'a2');
  assert.equal(squareName(119), 'h1');
});

test('Chess: every level answers with a legal move and leaves the board as it was', () => {
  for (const level of Object.keys(CHESS_LEVELS)) {
    const c = new Chess();
    c.move('e4');
    const before = c.fen();
    const m = botMove(c, level, { rand: seeded(3) });
    assert.equal(c.fen(), before);
    assert.ok(c.move(m), `${level} played ${JSON.stringify(m)}`);
  }
});

test('Chess: no level misses a mate in one', () => {
  // Black to move: Qh4 is mate (the fool's mate position).
  for (const level of Object.keys(CHESS_LEVELS)) {
    const c = new Chess('rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2');
    const m = botMove(c, level, { rand: seeded(1) });
    c.move(m);
    assert.equal(c.isCheckmate(), true, `${level} played ${JSON.stringify(m)}`);
  }
});

test('Chess: the strong player takes a queen left hanging and does not hang its own', () => {
  const c = new Chess('rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3'); // Nxh4 wins the queen
  assert.deepEqual(botMove(c, 'strong', { rand: seeded(1) }), { from: 'f3', to: 'h4' });
  const d = new Chess('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2');
  const m = botMove(d, 'strong', { rand: seeded(2) });
  d.move(m);
  const reply = botMove(d, 'strong', { rand: seeded(2) });
  const taken = d.move(reply);
  assert.notEqual(taken.captured, 'q', `black hung the queen with ${JSON.stringify(m)}`);
});

test('Chess: no move when the game is over', () => {
  const c = new Chess('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'); // White is mated
  assert.equal(botMove(c, 'even'), null);
});

test('Chess: the strong player beats the easy one', () => {
  const c = new Chess();
  const rand = seeded(11);
  let ticks = 0;
  const clock = () => (ticks += 90); // the strong player looks at about 7 000 positions per move
  let plies = 0;
  while (!c.isGameOver() && plies < 160) {
    const level = c.turn() === 'w' ? 'strong' : 'easy';
    c.move(botMove(c, level, { rand, now: clock })); // a steady clock instead of the real one, so the test is the same on any machine
    plies += 1;
  }
  assert.equal(c.isCheckmate() && c.turn() === 'b', true, `after ${plies} half moves: ${c.fen()}`);
});
