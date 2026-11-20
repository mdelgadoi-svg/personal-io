// The chess computer player thinks here, off the main thread, so the screen never freezes.
import { Chess } from './vendor/chess.js';
import { botMove } from './games.js';

self.onmessage = (e) => {
  const { fen, level, id } = e.data;
  self.postMessage({ id, move: botMove(new Chess(fen), level) }); // the id says which question this answers
};
