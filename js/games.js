// The games of the Procrastination section: pure logic, no DOM. Tested in tests/games.test.js.
// Sudoku: our own small generator. Chess: a small computer player on top of js/vendor/chess.js
// (chess.js by Jeff Hlywa, BSD 2-Clause, see js/vendor/LICENSES.md), which knows the rules.

// ---------- Sudoku ----------

// Three sizes: 9 (boxes 3 by 3), 6 (boxes 2 rows by 3 columns), 4 (boxes 2 by 2).
export const SUDOKU = {
  9: { boxR: 3, boxC: 3, holes: 40 },
  6: { boxR: 2, boxC: 3, holes: 18 },
  4: { boxR: 2, boxC: 2, holes: 8 },
};

function shuffled(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// The cells that share a row, a column or a box with cell i.
function peersOf(size) {
  const { boxR, boxC } = SUDOKU[size];
  return Array.from({ length: size * size }, (_, i) => {
    const r = Math.floor(i / size);
    const c = i % size;
    const br = Math.floor(r / boxR) * boxR;
    const bc = Math.floor(c / boxC) * boxC;
    const set = new Set();
    for (let k = 0; k < size; k += 1) { set.add(r * size + k); set.add(k * size + c); }
    for (let y = 0; y < boxR; y += 1) for (let x = 0; x < boxC; x += 1) set.add((br + y) * size + bc + x);
    set.delete(i);
    return [...set];
  });
}
const PEERS = {};
const peers = (size) => (PEERS[size] = PEERS[size] || peersOf(size));

function candidates(grid, i, size) {
  const used = new Set(peers(size)[i].map((p) => grid[p]));
  const out = [];
  for (let d = 1; d <= size; d += 1) if (!used.has(d)) out.push(d);
  return out;
}

// Counts the solutions of a grid, stopping at `limit` (2 is enough to know if it is unique).
export function sudokuCount(grid, size = 9, limit = 2) {
  const g = [...grid];
  let found = 0;
  const step = () => {
    let best = -1;
    let bestC = null;
    for (let i = 0; i < g.length; i += 1) {
      if (g[i]) continue;
      const c = candidates(g, i, size);
      if (!c.length) return;
      if (!bestC || c.length < bestC.length) { best = i; bestC = c; if (c.length === 1) break; }
    }
    if (best < 0) { found += 1; return; }
    for (const d of bestC) {
      g[best] = d;
      step();
      if (found >= limit) return;
    }
    g[best] = 0;
  };
  step();
  return found;
}

function fillSolved(size, rand) {
  const g = new Array(size * size).fill(0);
  const step = (i) => {
    if (i === g.length) return true;
    for (const d of shuffled(candidates(g, i, size), rand)) {
      g[i] = d;
      if (step(i + 1)) return true;
    }
    g[i] = 0;
    return false;
  };
  step(0);
  return g;
}

// A new puzzle with exactly one solution. puzzle uses 0 for an empty cell.
export function sudokuNew(size = 9, rand = Math.random) {
  const { holes } = SUDOKU[size];
  const solution = fillSolved(size, rand);
  const puzzle = [...solution];
  let made = 0;
  for (const i of shuffled(puzzle.map((_, k) => k), rand)) {
    if (made >= holes) break;
    const keep = puzzle[i];
    puzzle[i] = 0;
    if (sudokuCount(puzzle, size, 2) === 1) made += 1; else puzzle[i] = keep;
  }
  return { size, solution, puzzle };
}

// The cells whose number repeats in their row, column or box.
export function sudokuConflicts(grid, size = 9) {
  const bad = new Set();
  grid.forEach((d, i) => {
    if (d && peers(size)[i].some((p) => grid[p] === d)) bad.add(i);
  });
  return bad;
}

export function sudokuSolved(grid, size = 9) {
  return grid.every((d) => d >= 1 && d <= size) && sudokuConflicts(grid, size).size === 0;
}

// ---------- Chess: the computer player ----------
// It looks a few moves ahead and counts material and good squares. Three strengths:
// easy (looks one move ahead and often plays something else), even (two moves ahead),
// strong (as deep as it can in its thinking time). The Follower picks the strength, not the person.

export const CHESS_LEVELS = {
  easy: { depth: 1, slip: 0.45, ms: 150 },
  even: { depth: 2, slip: 0.12, ms: 400 },
  strong: { depth: 6, slip: 0, ms: 1300 },
};

const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
// Good squares, seen from White's side, a8 first. Black reads them mirrored.
const PST = {
  p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
};
const MATE = 100000;

// chess.js keeps the board as 128 squares (0x88). These turn its squares into ours.
const sq64 = (sq) => (sq >> 4) * 8 + (sq & 15);
export const squareName = (sq) => 'abcdefgh'[sq & 15] + (8 - (sq >> 4));

// The position's worth for the side to move, in hundredths of a pawn.
function evaluate(chess) {
  let score = 0;
  const board = chess._board;
  for (let sq = 0; sq < 128; sq += 1) {
    if (sq & 0x88) { sq += 7; continue; }
    const p = board[sq];
    if (!p) continue;
    const i = sq64(sq);
    const v = VALUE[p.type] + PST[p.type][p.color === 'w' ? i : 63 - i];
    score += p.color === 'w' ? v : -v;
  }
  return chess.turn() === 'w' ? score : -score;
}

// Captures first, the most valuable victim taken by the cheapest piece.
function ordered(moves) {
  const key = (m) => (m.captured ? 10 * VALUE[m.captured] - VALUE[m.piece] : 0) + (m.promotion ? 800 : 0);
  return moves.sort((a, b) => key(b) - key(a));
}

function quiet(chess, alpha, beta, depth, ctx) {
  const stand = evaluate(chess);
  if (depth === 0 || stand >= beta) return stand;
  let a = Math.max(alpha, stand);
  for (const m of ordered(chess._moves({ legal: true }).filter((x) => x.captured))) {
    chess._makeMove(m);
    const score = -quiet(chess, -beta, -a, depth - 1, ctx);
    chess._undoMove();
    if (score >= beta) return score;
    if (score > a) a = score;
  }
  return a;
}

function search(chess, depth, alpha, beta, ply, ctx) {
  if (ctx.deadline && (ctx.nodes += 1) % 512 === 0 && ctx.now() > ctx.deadline) { ctx.stop = true; }
  if (ctx.stop) return 0;
  const moves = chess._moves({ legal: true });
  if (!moves.length) return chess.isCheck() ? -MATE + ply : 0;
  if (depth === 0) return quiet(chess, alpha, beta, 3, ctx);
  let a = alpha;
  for (const m of ordered(moves)) {
    chess._makeMove(m);
    const score = -search(chess, depth - 1, -beta, -a, ply + 1, ctx);
    chess._undoMove();
    if (ctx.stop) return 0;
    if (score >= beta) return score;
    if (score > a) a = score;
  }
  return a;
}

// The computer's move for this position: { from, to, promotion } in the form chess.move() takes,
// or null when the game is over. `chess` is a Chess object; it is left as it was.
export function botMove(chess, level = 'even', { rand = Math.random, now = () => Date.now() } = {}) {
  const cfg = CHESS_LEVELS[level] || CHESS_LEVELS.even;
  const root = ordered(chess._moves({ legal: true }));
  if (!root.length) return null;
  const pack = (m) => ({ from: squareName(m.from), to: squareName(m.to), ...(m.promotion ? { promotion: m.promotion } : {}) });
  // The easy and even players sometimes play another move on purpose. They never miss a mate in one.
  const ctx = { deadline: now() + cfg.ms, nodes: 0, stop: false, now };
  let scored = root.map((m) => ({ m, score: 0 }));
  for (let depth = 1; depth <= cfg.depth; depth += 1) {
    const round = [];
    let alpha = -MATE * 2;
    for (const { m } of scored) {
      chess._makeMove(m);
      const score = -search(chess, depth - 1, -MATE * 2, -alpha, 1, ctx);
      chess._undoMove();
      if (ctx.stop) break;
      round.push({ m, score });
      // keep exact scores at the top level so the slip below can choose among real values
    }
    if (ctx.stop && depth > 1) break;
    if (round.length === scored.length) scored = round.sort((x, y) => y.score - x.score);
    if (scored[0].score > MATE - 100) break; // a forced mate is found: play it
  }
  const best = scored[0];
  if (cfg.slip && best.score < MATE - 100 && rand() < cfg.slip && scored.length > 1) {
    // a slip: any move that does not lose more than about a piece compared with the best one
    const pool = scored.slice(1).filter((x) => best.score - x.score < (level === 'easy' ? 450 : 120));
    if (pool.length) return pack(pool[Math.floor(rand() * pool.length)].m);
  }
  const top = scored.filter((x) => x.score >= best.score - 8);
  return pack(top[Math.floor(rand() * top.length)].m);
}
