// The Procrastination section: chess against the computer, and Sudoku.
// The Follower (rules.js) decides how each game plays: a strong opponent and a quick grid when
// something is close, an easy opponent and a full grid when he is free. He never picks a level.
// After every game the next task is on the screen. Nothing blocks.

import * as R from './rules.js';
import { Chess } from './vendor/chess.js';
import { botMove, sudokuNew, sudokuConflicts, sudokuSolved, SUDOKU } from './games.js';

const KEY = 'personal-io:game'; // the game in progress, on this device only
let host = null;                // what app.js lends: state, saving, the next task, the start screen
let game = null;
let chess = null;               // the rules object for the chess game in progress
let worker = null;
let thinkId = 0;
let showing = false;           // true while a game is on the screen (not the section's first screen)

const PIECE = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const LEVEL_WORD = { easy: 'An easy opponent', even: 'An even opponent', strong: 'A strong opponent' };

export function init(h) {
  host = h;
  try { game = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { game = null; }
  if (game && game.kind === 'chess') rebuildChess();
}

function keep() {
  try {
    if (game) localStorage.setItem(KEY, JSON.stringify({ ...game, sel: null, targets: [], thinking: false }));
    else localStorage.removeItem(KEY);
  } catch { /* the game still lives in this tab */ }
}

function rebuildChess() {
  chess = new Chess();
  try { (game.moves || []).forEach((san) => chess.move(san)); } catch { chess = new Chess(); game.moves = []; }
}

// ----- the Follower's part -----

const moment = () => (game && game.momentId ? host.momentById(game.momentId) : null);

// A game being played has one open "play" record. Leaving the section closes it (the board stays),
// coming back opens a new one, so the minutes are only the minutes really spent here.
function openMoment() {
  if (!game || game.over || moment()) return;
  const m = host.addMoment({ kind: 'play', game: game.kind, level: game.level || null, mode: game.mode });
  game.momentId = m.id;
  host.save();
  keep();
}

function closeMoment(result) {
  const m = moment();
  if (!m || m.endAt) return;
  m.endAt = new Date().toISOString();
  m.result = result;
  if (game.kind === 'chess') m.moves = (game.moves || []).length;
  host.touch(m);
  host.save();
}

// Called by app.js when he leaves the section (home: true) or the app goes to the background.
// Coming back to the section shows its first screen: the next task, then "Back to your game".
export function leave({ home = false } = {}) {
  if (game && !game.over) { closeMoment('left'); game.momentId = null; keep(); }
  if (home) showing = false;
}

function modeNow() { return R.playMode(host.playInput()).mode; }

function newChess() {
  leave();
  const mode = modeNow();
  const level = R.chessLevel(mode, R.playResults(host.state().moments, host.todayKey(), 'chess'));
  game = { kind: 'chess', mode, level, moves: [], sel: null, targets: [], last: null, over: null, thinking: false, momentId: null };
  chess = new Chess();
  openMoment();
  keep();
}

function newSudoku() {
  leave();
  const mode = modeNow();
  const size = R.sudokuSize(mode);
  const { puzzle, solution } = sudokuNew(size);
  game = { kind: 'sudoku', mode, size, puzzle, solution, grid: [...puzzle], sel: null, over: null, momentId: null };
  chess = null;
  openMoment();
  keep();
}

function finish(result, text) {
  closeMoment(result);
  const played = R.playMinutes(host.state().moments, host.todayKey());
  const said = (host.state().moments || []).filter((m) => m.kind === 'nudge' && R.toDateKey(new Date(m.at)) === host.todayKey()).map((m) => m.which);
  const line = R.playLine(played, said);
  let nudgeId = null;
  if (line && host.nextTask()) { nudgeId = host.addMoment({ kind: 'nudge', which: line, did: null }).id; host.save(); }
  game.over = { result, text, line: nudgeId ? line : null, nudgeId };
  game.sel = null; game.targets = [];
  keep();
}

function answer(did) {
  const m = game && game.over && game.over.nudgeId ? host.momentById(game.over.nudgeId) : null;
  if (m && !m.did) { m.did = did; host.touch(m); host.save(); }
}

// ----- chess -----

function chessOverCheck() {
  if (!chess.isGameOver()) return false;
  if (chess.isCheckmate()) {
    const won = chess.turn() === 'b'; // he plays White
    finish(won ? 'win' : 'loss', won ? 'You won.' : 'The computer won.');
  } else finish('draw', 'A draw.');
  return true;
}

function think() {
  game.thinking = true;
  const id = (thinkId += 1);
  const fen = chess.fen();
  const started = Date.now();
  const play = (move) => {
    if (id !== thinkId || !game || game.kind !== 'chess' || game.over || chess.fen() !== fen) return; // a newer game or move
    const wait = Math.max(0, 450 - (Date.now() - started)); // never instant: a short breath between moves
    setTimeout(() => {
      if (id !== thinkId || !game || game.kind !== 'chess' || chess.fen() !== fen) return;
      const done = move ? chess.move(move) : null;
      game.thinking = false;
      if (done) { game.moves.push(done.san); game.last = { from: done.from, to: done.to }; }
      chessOverCheck();
      keep();
      host.render();
    }, wait);
  };
  try {
    if (!worker) worker = new Worker(new URL('./bot-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => play(e.data.move);
    worker.onerror = () => { worker = null; play(botMove(new Chess(fen), game.level)); };
    worker.postMessage({ fen, level: game.level });
  } catch {
    setTimeout(() => play(botMove(new Chess(fen), game.level)), 30);
  }
}

function tapSquare(sq) {
  if (!game || game.kind !== 'chess' || game.over || game.thinking || chess.turn() !== 'w') return;
  openMoment();
  const piece = chess.get(sq);
  if (game.sel && game.targets.includes(sq)) {
    const done = chess.move({ from: game.sel, to: sq, promotion: 'q' });
    game.moves.push(done.san);
    game.last = { from: done.from, to: done.to };
    game.sel = null; game.targets = [];
    if (!chessOverCheck()) think();
  } else if (piece && piece.color === 'w') {
    game.sel = sq;
    game.targets = chess.moves({ square: sq, verbose: true }).map((m) => m.to);
  } else {
    game.sel = null; game.targets = [];
  }
  keep();
}

function boardHTML() {
  const rows = chess.board();
  let king = null;
  if (chess.isCheck()) rows.forEach((row) => row.forEach((p) => { if (p && p.type === 'k' && p.color === chess.turn()) king = p.square; }));
  const cells = [];
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const sq = 'abcdefgh'[c] + (8 - r);
      const p = rows[r][c];
      const cls = ['sq', (r + c) % 2 ? 'dark' : 'light',
        game.sel === sq ? 'is-sel' : '', game.targets.includes(sq) ? 'is-target' : '',
        game.last && (game.last.from === sq || game.last.to === sq) ? 'is-last' : '', king === sq ? 'is-check' : ''].filter(Boolean).join(' ');
      const name = p ? `${p.color === 'w' ? 'white' : 'black'} ${PIECE[p.type]}` : 'empty';
      cells.push(`<button type="button" class="${cls}" data-action="chess-sq" data-sq="${sq}" aria-label="${sq}, ${name}"${p ? ` data-piece="${p.color}${p.type}"` : ''}>${p
        ? `<svg viewBox="0 0 40 40" aria-hidden="true"><use href="icons/chess-pieces.svg#${p.color}${p.type}"></use></svg>` : ''}</button>`);
    }
  }
  return `<div class="board${game.thinking ? ' is-thinking' : ''}" role="group" aria-label="Chess board">${cells.join('')}</div>`;
}

function chessHTML() {
  const status = game.over ? '' : game.thinking ? 'The computer is thinking' : chess.isCheck() ? 'Check. Your move' : 'Your move';
  return `<div class="play">
    <div class="play-head"><h1 class="play-title">Chess</h1><span class="play-level">${LEVEL_WORD[game.level]}</span></div>
    ${boardHTML()}
    ${game.over ? afterHTML() : `<div class="play-foot"><span class="play-status" aria-live="polite">${status}</span>
      <span class="play-links"><button type="button" class="play-link" data-action="play-end">End game</button><button type="button" class="play-link" data-action="play-home">Leave it for later</button></span></div>`}
  </div>`;
}

// ----- sudoku -----

function tapCell(i) {
  if (!game || game.kind !== 'sudoku' || game.over) return;
  openMoment();
  game.sel = game.puzzle[i] ? null : i;
  keep();
}

function tapDigit(d) {
  if (!game || game.kind !== 'sudoku' || game.over || game.sel === null) return;
  game.grid[game.sel] = game.grid[game.sel] === d ? 0 : d;
  if (sudokuSolved(game.grid, game.size)) finish('solved', 'Solved.');
  keep();
}

function sudokuHTML() {
  const { size } = game;
  const { boxR, boxC } = SUDOKU[size];
  const bad = sudokuConflicts(game.grid, size);
  const cells = game.grid.map((d, i) => {
    const r = Math.floor(i / size);
    const c = i % size;
    const cls = ['cell', game.puzzle[i] ? 'is-given' : '', game.sel === i ? 'is-sel' : '', bad.has(i) && !game.puzzle[i] ? 'is-bad' : '',
      c % boxC === 0 && c ? 'edge-l' : '', r % boxR === 0 && r ? 'edge-t' : ''].filter(Boolean).join(' ');
    return `<button type="button" class="${cls}" data-action="sudoku-cell" data-i="${i}" aria-label="Row ${r + 1}, column ${c + 1}, ${d || 'empty'}"${game.puzzle[i] ? ' disabled' : ''}>${d || ''}</button>`;
  }).join('');
  const pad = Array.from({ length: size }, (_, k) => `<button type="button" class="digit" data-action="sudoku-digit" data-d="${k + 1}"${game.sel === null ? ' disabled' : ''}>${k + 1}</button>`).join('');
  return `<div class="play">
    <div class="play-head"><h1 class="play-title">Sudoku</h1><span class="play-level">${size === 9 ? 'A full grid' : 'A quick one'}</span></div>
    <div class="sudoku size-${size}" style="--n:${size}" role="group" aria-label="Sudoku grid">${cells}</div>
    ${game.over ? afterHTML() : `<div class="digits" role="group" aria-label="Numbers">${pad}<button type="button" class="digit digit-clear" data-action="sudoku-digit" data-d="0"${game.sel === null ? ' disabled' : ''} aria-label="Clear the cell">Clear</button></div>
    <div class="play-foot"><span class="play-status">${game.sel === null ? 'Tap a cell, then a number' : ''}</span>
      <span class="play-links"><button type="button" class="play-link" data-action="play-end">End game</button><button type="button" class="play-link" data-action="play-home">Leave it for later</button></span></div>`}
  </div>`;
}

// ----- after a game: the next task is right there -----

function nextHTML(t, { primary = true } = {}) {
  if (!t) return '';
  return `<div class="play-next"><span class="play-next-text"><span class="play-next-name">${host.esc(t.title)}</span><span class="play-next-step">${host.esc(host.firstMinute(t))}</span></span>
    <button type="button" class="btn ${primary ? 'btn-dark' : ''}" data-action="play-start" data-id="${t.id}">Start 1 minute</button></div>`;
}

function afterHTML() {
  const t = host.nextTask();
  const again = `<button type="button" class="btn" data-action="play-again">Play again</button>`;
  if (game.over.line && t) {
    // Only when it is a lot (25 and 45 minutes of play in a day), in his words.
    return `<div class="play-after" aria-live="polite">
      <h2 class="play-result">${game.over.text}</h2>
      <p class="play-line">Good game, happy you are having a good time. Remember that <strong>${host.esc(t.title)}</strong> matters today. Want to plan when to play?</p>
      <div class="play-actions"><button type="button" class="btn btn-dark" data-action="play-start" data-id="${t.id}">Start 1 minute</button>
        <button type="button" class="btn" data-action="play-plan">Plan my play</button>
        <button type="button" class="btn" data-action="play-again" data-keep="1">Keep playing</button></div>
    </div>`;
  }
  return `<div class="play-after" aria-live="polite">
    <h2 class="play-result">${game.over.text}</h2>
    ${t ? nextHTML(t) : '<p class="play-line">Nothing is waiting. Enjoy the free time.</p>'}
    <div class="play-actions">${again}<button type="button" class="btn" data-action="play-home">Something else</button></div>
  </div>`;
}

// ----- the section's first screen -----

const CHESS_ICON = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="6" r="2.6"></circle><path d="M9.6 8.6h4.8M10.4 8.6c.2 3.2-.6 5.6-2 7.6h7.2c-1.4-2-2.2-4.4-2-7.6M7 16.2h10M6 20h12l-1-3.8H7z"></path></svg>';
const SUDOKU_ICON = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="2"></rect><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17"></path></svg>';

function homeHTML() {
  const t = host.nextTask();
  const going = game && !game.over;
  return `<div class="play">
    <h1 class="plan-title">Procrastination</h1>
    ${t ? nextHTML(t, { primary: false }) : ''}
    ${going ? `<p class="play-resume"><button type="button" class="btn btn-dark" data-action="play-resume">Back to your ${game.kind === 'chess' ? 'chess game' : 'Sudoku'}</button></p>` : ''}
    <div class="play-games">
      <button type="button" class="play-game" data-action="play-chess">${CHESS_ICON}<span class="play-game-name">Chess</span><span class="play-game-sub">Against the computer</span></button>
      <button type="button" class="play-game" data-action="play-sudoku">${SUDOKU_ICON}<span class="play-game-name">Sudoku</span><span class="play-game-sub">One grid</span></button>
    </div>
  </div>`;
}

export function render() {
  if (!game || !showing) return homeHTML();
  if (!game.over) openMoment();
  return game.kind === 'chess' ? chessHTML() : sudokuHTML();
}

export const actions = {
  'play-chess': () => { newChess(); showing = true; host.render(); },
  'play-sudoku': () => { newSudoku(); showing = true; host.render(); },
  'play-resume': () => { showing = true; host.render(); },
  'play-home': () => { leave(); if (game && game.over) { game = null; keep(); } showing = false; host.render(); },
  'play-again': (el) => {
    if (el && el.dataset.keep) answer('keep');
    if (game.kind === 'chess') newChess(); else newSudoku();
    host.render();
  },
  'play-end': () => { if (game && !game.over) { finish(game.kind === 'chess' ? 'left' : 'left', game.kind === 'chess' ? 'Game ended.' : 'Grid closed.'); host.render(); } },
  'play-start': (el) => {
    answer('start');
    leave();
    if (game && game.over) { game = null; keep(); }
    showing = false;
    host.start(el.dataset.id);
  },
  'play-plan': () => { answer('plan'); host.planPlay(); },
  'chess-sq': (el) => { tapSquare(el.dataset.sq); host.render(); },
  'sudoku-cell': (el) => { tapCell(Number(el.dataset.i)); host.render(); },
  'sudoku-digit': (el) => { tapDigit(Number(el.dataset.d)); host.render(); },
};
