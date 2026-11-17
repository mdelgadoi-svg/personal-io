// The chess computer player thinks here, off the main thread, so the screen never freezes.
import { Chess } from './vendor/chess.js';
import { botMove } from './games.js';

self.onmessage = (e) => {
  const { fen, level } = e.data;
  self.postMessage({ move: botMove(new Chess(fen), level) });
};
