// The Procrastination section: chess against the computer, and Sudoku.
// The Follower (rules.js) decides how each game plays: a strong opponent and a quick grid when
// something is close, an easy opponent and a full grid when he is free. He never picks a level.
// After every game the next task is on the screen. Nothing blocks.

import * as R from './rules.js';
import { Chess } from './vendor/chess.js';
import { botMove, sudokuNew, sudokuConflicts, sudokuSolved, SUDOKU } from './games.js';

const KEY = 'personal-io:game'; // the games in progress, on this device only
const IDLE_MS = 5 * 60000;      // no tap for this long: he is not playing, the minutes stop
let host = null;                // what app.js lends: state, saving, the next task, the start screen
const games = { chess: null, sudoku: null }; // one game of each kind can wait for him
let cur = null;                 // the kind on screen or last played
let chess = null;               // the rules object of the chess game in progress
let worker = null;
let thinkId = 0;
let showing = false;            // true while a game is on the screen (not the section's first screen)
let lastTap = 0;

const game = () => (cur ? games[cur] : null);
const PIECE = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const LEVEL_WORD = { easy: 'An easy opponent', even: 'An even opponent', strong: 'A strong opponent' };

export function init(h) {
  host = h;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && saved.games) { games.chess = saved.games.chess || null; games.sudoku = saved.games.sudoku || null; cur = saved.cur || null; }
    else if (saved && saved.kind) { games[saved.kind] = saved; cur = saved.kind; } // the first v2.4 kept one game only
  } catch { /* start clean */ }
  // A record left open by a closed tab is never continued: the minutes stop where they were.
  Object.values(games).forEach((g) => { if (g) { g.momentId = null; g.thinking = false; g.sel = null; g.targets = []; } });
  if (games.chess) rebuildChess();
  // No game is running when the app loads: a record still open (the tab was closed mid-game) ends one minute in.
  const stale = (host.state().moments || []).filter((m) => m.kind === 'play' && !m.endAt);
  stale.forEach((m) => { m.endAt = new Date(Date.parse(m.at) + 60000).toISOString(); m.result = 'left'; host.touch(m); });
  if (stale.length) host.saveQuiet();
}

function keep() {
  try {
    const clean = (g) => (g ? { ...g, sel: null, targets: [], thinking: false } : null);
    if (games.chess || games.sudoku) localStorage.setItem(KEY, JSON.stringify({ cur, games: { chess: clean(games.chess), sudoku: clean(games.sudoku) } }));
    else localStorage.removeItem(KEY);
  } catch { /* the game still lives in this tab */ }
}

function rebuildChess() {
  chess = new Chess();
  try { (games.chess.moves || []).forEach((san) => chess.move(san)); } catch { chess = new Chess(); games.chess.moves = []; }
}

// ----- the Follower's part -----

const moment = (g = game()) => (g && g.momentId ? host.momentById(g.momentId) : null);
const onScreen = () => document.visibilityState === 'visible';

// A game being played has one open "play" record. Leaving the section, hiding the app or five idle
// minutes close it (the board stays); the next tap opens a new one. So the minutes are real minutes.
function openMoment() {
  const g = game();
  lastTap = Date.now();
  const open = moment();
  if (!g || g.over || (open && !open.endAt) || !onScreen()) return;
  const m = host.addMoment({ kind: 'play', game: g.kind, level: g.level || null, mode: g.mode });
  g.momentId = m.id;
  host.save();
  keep();
}

function closeMoment(result, endMs = Date.now()) {
  const g = game();
  const m = moment();
  if (!m || m.endAt) { if (g) g.momentId = null; return; }
  m.endAt = new Date(Math.max(endMs, Date.parse(m.at))).toISOString();
  m.result = result;
  if (g.kind === 'chess') m.moves = (g.moves || []).length;
  host.touch(m);
  host.save();
  g.momentId = null;
}

// Called by app.js when he leaves the section (home: true), the app goes to the background,
// or a start screen opens. 'left' only means "paused": it is not a result.
export function leave({ home = false } = {}) {
  const g = game();
  if (g && !g.over) { closeMoment('left'); keep(); }
  if (home) showing = false;
}

// Called by the Follower's clock: with no tap for five minutes the minutes stop at the last tap.
export function tick() {
  const g = game();
  const m = moment();
  if (g && !g.over && m && !m.endAt && Date.now() - lastTap > IDLE_MS) { closeMoment('left', lastTap + 60000); keep(); }
}

function start(kind) {
  leave();
  const mode = R.playMode(host.playInput()).mode;
  if (kind === 'chess') {
    const level = R.chessLevel(mode, R.playResults(host.state().moments, host.todayKey(), 'chess'));
    games.chess = { kind: 'chess', mode, level, moves: [], sel: null, targets: [], last: null, over: null, thinking: false, momentId: null };
    chess = new Chess();
    thinkId += 1; // an answer still on its way belongs to the old game
  } else {
    const size = R.sudokuSize(mode);
    const { puzzle, solution } = sudokuNew(size);
    games.sudoku = { kind: 'sudoku', mode, size, puzzle, solution, grid: [...puzzle], sel: null, over: null, momentId: null };
  }
  cur = kind;
  showing = true;
  openMoment();
  keep();
}

// The tile of a game: back to the one in progress, or a new one.
function open(kind) {
  if (games[kind] && !games[kind].over) {
    leave();
    cur = kind;
    showing = true;
    openMoment();
    if (kind === 'chess') wake();
    keep();
  } else start(kind);
}

function finish(result, text) {
  const g = game();
  closeMoment(result);
  const played = R.playMinutes(host.state().moments, host.todayKey());
  const said = (host.state().moments || []).filter((m) => m.kind === 'nudge' && R.toDateKey(new Date(m.at)) === host.todayKey()).map((m) => m.which);
  const line = R.playLine(played, said);
  let nudgeId = null;
  if (line && host.nextTask()) { nudgeId = host.addMoment({ kind: 'nudge', which: line, did: null }).id; host.save(); }
  g.over = { result, text, line: nudgeId ? line : null, nudgeId };
  g.sel = null; g.targets = []; g.thinking = false;
  keep();
}

function answer(did) {
  const g = game();
  const m = g && g.over && g.over.nudgeId ? host.momentById(g.over.nudgeId) : null;
  if (m && !m.did) { m.did = did; host.touch(m); host.save(); }
}

// ----- chess -----

function chessOverCheck() {
  if (!chess.isGameOver()) return false;
  if (chess.isCheckmate()) {
    const won = chess.turn() === 'b'; // he plays White
    finish(won ? 'win' : 'loss', won ? 'You won.' : 'The computer won.');
  } else finish('draw', chess.isStalemate() ? 'A draw: no move left.' : 'A draw.');
  return true;
}

function think() {
  const g = games.chess;
  g.thinking = true;
  const id = (thinkId += 1);
  const fen = chess.fen();
  const started = Date.now();
  const live = () => id === thinkId && games.chess === g && !g.over && chess.fen() === fen;
  const play = (move) => {
    if (!live()) return; // a newer game or move
    const wait = Math.max(0, 450 - (Date.now() - started)); // never instant: a short breath between moves
    setTimeout(() => {
      if (!live()) return;
      const done = move ? chess.move(move) : null;
      g.thinking = false;
      if (done) { g.moves.push(done.san); g.last = { from: done.from, to: done.to }; g.said = done.san; }
      if (cur === 'chess' && showing) chessOverCheck(); else if (chess.isGameOver()) g.pendingOver = true; // he will see the result when he comes back
      keep();
      host.render();
    }, wait);
  };
  try {
    if (!worker) worker = new Worker(new URL('./bot-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => { if (e.data.id === id) play(e.data.move); };
    worker.onerror = () => { worker = null; play(botMove(new Chess(fen), g.level)); };
    worker.postMessage({ fen, level: g.level, id });
  } catch {
    setTimeout(() => play(botMove(new Chess(fen), g.level)), 30);
  }
}

// If it is the computer's turn and nobody is thinking (a reload in the middle of its move), it thinks now.
function wake() {
  const g = games.chess;
  if (!g || g.over) return;
  if (g.pendingOver) { g.pendingOver = false; chessOverCheck(); return; }
  if (chess.turn() === 'b' && !g.thinking) think();
}

function tapSquare(sq) {
  const g = games.chess;
  if (!g || cur !== 'chess' || g.over || g.thinking || chess.turn() !== 'w') return;
  openMoment();
  const piece = chess.get(sq);
  if (g.sel && g.targets.includes(sq)) {
    const done = chess.move({ from: g.sel, to: sq, promotion: 'q' });
    g.moves.push(done.san);
    g.last = { from: done.from, to: done.to };
    g.sel = null; g.targets = []; g.said = null;
    if (!chessOverCheck()) think();
  } else if (piece && piece.color === 'w') {
    g.sel = sq;
    g.targets = chess.moves({ square: sq, verbose: true }).map((m) => m.to);
  } else {
    g.sel = null; g.targets = [];
  }
  keep();
}

function boardHTML(g) {
  const rows = chess.board();
  let king = null;
  if (chess.isCheck()) rows.forEach((row) => row.forEach((p) => { if (p && p.type === 'k' && p.color === chess.turn()) king = p.square; }));
  const cells = [];
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const sq = 'abcdefgh'[c] + (8 - r);
      const p = rows[r][c];
      const cls = ['sq', (r + c) % 2 ? 'dark' : 'light',
        g.sel === sq ? 'is-sel' : '', g.targets.includes(sq) ? 'is-target' : '',
        g.last && (g.last.from === sq || g.last.to === sq) ? 'is-last' : '', king === sq ? 'is-check' : ''].filter(Boolean).join(' ');
      const name = p ? `${p.color === 'w' ? 'white' : 'black'} ${PIECE[p.type]}` : 'empty';
      cells.push(`<button type="button" class="${cls}" data-action="chess-sq" data-sq="${sq}" aria-label="${sq}, ${name}"${p ? ` data-piece="${p.color}${p.type}"` : ''}>${p
        ? `<svg viewBox="0 0 40 40" aria-hidden="true"><use href="icons/chess-pieces.svg#${p.color}${p.type}"></use></svg>` : ''}</button>`);
    }
  }
  return `<div class="board${g.thinking ? ' is-thinking' : ''}" role="group" aria-label="Chess board">${cells.join('')}</div>`;
}

const footLinks = '<span class="play-links"><button type="button" class="play-link" data-action="play-home">Leave it for later</button><button type="button" class="play-link" data-action="play-end">End game</button></span>';

function chessHTML(g) {
  const turn = chess.isCheck() ? 'Check. Your move' : 'Your move';
  const status = g.thinking ? 'The computer is thinking' : g.said ? `The computer played ${g.said}. ${turn}` : turn;
  return `<div class="play">
    <div class="play-head"><h1 class="play-title">Chess</h1><span class="play-level">${LEVEL_WORD[g.level]}</span></div>
    ${boardHTML(g)}
    ${g.over ? afterHTML(g) : `<div class="play-foot"><span class="play-status" aria-live="polite">${status}</span>${footLinks}</div>`}
  </div>`;
}

// ----- sudoku -----

function tapCell(i) {
  const g = games.sudoku;
  if (!g || cur !== 'sudoku' || g.over) return;
  openMoment();
  g.sel = g.puzzle[i] ? null : i;
  keep();
}

function tapDigit(d) {
  const g = games.sudoku;
  if (!g || cur !== 'sudoku' || g.over || g.sel === null) return;
  openMoment();
  g.grid[g.sel] = g.grid[g.sel] === d ? 0 : d;
  if (sudokuSolved(g.grid, g.size)) finish('solved', 'Solved.');
  keep();
}

function sudokuHTML(g) {
  const { size } = g;
  const { boxR, boxC } = SUDOKU[size];
  const bad = sudokuConflicts(g.grid, size);
  const cells = g.grid.map((d, i) => {
    const r = Math.floor(i / size);
    const c = i % size;
    const cls = ['cell', g.puzzle[i] ? 'is-given' : '', g.sel === i ? 'is-sel' : '', bad.has(i) && !g.puzzle[i] ? 'is-bad' : '',
      c % boxC === 0 && c ? 'edge-l' : '', r % boxR === 0 && r ? 'edge-t' : ''].filter(Boolean).join(' ');
    return `<button type="button" class="${cls}" data-action="sudoku-cell" data-i="${i}" aria-label="Row ${r + 1}, column ${c + 1}, ${d || 'empty'}"${g.puzzle[i] ? ' disabled' : ''}>${d || ''}</button>`;
  }).join('');
  const off = g.sel === null ? ' disabled' : '';
  const pad = Array.from({ length: size }, (_, k) => `<button type="button" class="digit" data-action="sudoku-digit" data-d="${k + 1}"${off}>${k + 1}</button>`).join('');
  return `<div class="play">
    <div class="play-head"><h1 class="play-title">Sudoku</h1><span class="play-level">${size === 9 ? 'A full grid' : 'A quick one'}</span></div>
    <div class="sudoku size-${size}" style="--n:${size}" role="group" aria-label="Sudoku grid">${cells}</div>
    ${g.over ? afterHTML(g) : `<div class="digits" role="group" aria-label="Numbers">${pad}<button type="button" class="digit digit-clear" data-action="sudoku-digit" data-d="0"${off} aria-label="Clear the cell">Clear</button></div>
    <div class="play-foot"><span class="play-status">${g.sel === null ? 'Tap a cell, then a number' : ''}</span>${footLinks}</div>`}
  </div>`;
}

// ----- after a game: the next task is right there -----

function nextHTML(t, { primary = true } = {}) {
  if (!t) return '';
  return `<div class="play-next"><span class="play-next-text"><span class="play-next-name">${host.esc(t.title)}</span><span class="play-next-step">${host.esc(host.firstMinute(t))}</span></span>
    <button type="button" class="btn ${primary ? 'btn-dark' : ''}" data-action="play-start" data-id="${t.id}">Start 1 minute</button></div>`;
}

function afterHTML(g) {
  const t = host.nextTask();
  if (g.over.line && t) {
    // Only when it is a lot (25 and 45 minutes of play in a day), in his words.
    return `<div class="play-after" aria-live="polite">
      <h2 class="play-result">${g.over.text}</h2>
      <p class="play-line">Good game, happy you are having a good time. Remember that <strong>${host.esc(t.title)}</strong> matters today. Want to plan when to play?</p>
      <div class="play-actions"><button type="button" class="btn btn-dark" data-action="play-start" data-id="${t.id}">Start 1 minute</button>
        <button type="button" class="btn" data-action="play-plan">Plan my play</button>
        <button type="button" class="btn" data-action="play-again" data-keep="1">Keep playing</button></div>
    </div>`;
  }
  return `<div class="play-after" aria-live="polite">
    <h2 class="play-result">${g.over.text}</h2>
    ${t ? nextHTML(t) : '<p class="play-line">Nothing is waiting. Enjoy the free time.</p>'}
    <div class="play-actions"><button type="button" class="btn" data-action="play-again">Play again</button><button type="button" class="btn" data-action="play-home">Something else</button></div>
  </div>`;
}

// ----- the section's first screen -----

const CHESS_ICON = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="6" r="2.6"></circle><path d="M9.6 8.6h4.8M10.4 8.6c.2 3.2-.6 5.6-2 7.6h7.2c-1.4-2-2.2-4.4-2-7.6M7 16.2h10M6 20h12l-1-3.8H7z"></path></svg>';
const SUDOKU_ICON = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="2"></rect><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17"></path></svg>';

function homeHTML() {
  const t = host.nextTask();
  const going = (kind) => games[kind] && !games[kind].over;
  const tile = (kind, icon, name, sub) => `<button type="button" class="play-game${going(kind) ? ' is-going' : ''}" data-action="play-${kind}">${icon}<span class="play-game-name">${name}</span><span class="play-game-sub">${going(kind) ? 'Back to your game' : sub}</span></button>`;
  return `<div class="play">
    <h1 class="plan-title">Procrastination</h1>
    ${t ? nextHTML(t, { primary: false }) : ''}
    <div class="play-games">
      ${tile('chess', CHESS_ICON, 'Chess', 'Against the computer')}
      ${tile('sudoku', SUDOKU_ICON, 'Sudoku', 'One grid')}
    </div>
  </div>`;
}

export function render() {
  const g = game();
  if (!g || !showing) return homeHTML();
  return g.kind === 'chess' ? chessHTML(g) : sudokuHTML(g);
}

// After a redraw the keyboard focus goes back to the square, cell or number he was on.
function refocus(selector) {
  host.render();
  document.querySelector(selector)?.focus({ preventScroll: true });
}

export const actions = {
  'play-chess': () => { open('chess'); host.render(); },
  'play-sudoku': () => { open('sudoku'); host.render(); },
  'play-home': () => {
    leave({ home: true });
    if (game() && game().over) { games[cur] = null; keep(); }
    host.render();
  },
  'play-again': (el) => {
    if (el && el.dataset.keep) answer('keep');
    start(cur);
    host.render();
  },
  // Ending a game is his choice, not a pause: it counts as a finished game (and ends a winning streak).
  'play-end': () => { const g = game(); if (g && !g.over) { finish('ended', g.kind === 'chess' ? 'Game ended.' : 'Grid closed.'); host.render(); } },
  'play-start': (el) => {
    answer('start');
    leave({ home: true });
    if (game() && game().over) { games[cur] = null; keep(); }
    host.start(el.dataset.id);
  },
  'play-plan': () => {
    answer('plan');
    const g = game();
    if (g && g.over) { g.over.line = null; keep(); } // said once: the plain screen stays behind the break window
    host.planPlay();
  },
  'chess-sq': (el) => { tapSquare(el.dataset.sq); refocus(`.sq[data-sq="${el.dataset.sq}"]`); },
  'sudoku-cell': (el) => { tapCell(Number(el.dataset.i)); refocus(`.cell[data-i="${el.dataset.i}"]`); },
  'sudoku-digit': (el) => { tapDigit(Number(el.dataset.d)); refocus(`.digit[data-d="${el.dataset.d}"]`); },
};
