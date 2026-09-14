import type { CellState } from './game';

// Metadata follows immutable board snapshots, so Undo restores the exact color order.
// Weak keys allow discarded animation frames and old history to be collected.
const orders = new WeakMap<CellState[], number[]>();
export function rememberCatOrder(board: CellState[], preferred: unknown = []) {
  if (orders.has(board)) return board;
  const order: number[] = [];
  if (Array.isArray(preferred))
    for (const index of preferred) {
      if (
        Number.isInteger(index) &&
        board[index] === 2 &&
        !order.includes(index)
      )
        order.push(index);
    }
  board.forEach((value, index) => {
    if (value === 2 && !order.includes(index)) order.push(index);
  });
  orders.set(board, order);
  return board;
}
export function getCatOrder(board: CellState[]): readonly number[] {
  rememberCatOrder(board);
  return orders.get(board)!;
}
