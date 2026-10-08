/** Fisher–Yates shuffle of 0..count-1. If `first` is given it is placed first. */
export function shuffledOrder(count: number, first?: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i).filter((i) => i !== first);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return first === undefined ? order : [first, ...order];
}

export function sequentialOrder(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i);
}

/** New shuffled round that never starts with the image that was just shown. */
export function nextShuffleRound(count: number, previous: number): number[] {
  const order = shuffledOrder(count);
  if (count > 1 && order[0] === previous) {
    [order[0], order[order.length - 1]] = [order[order.length - 1], order[0]];
  }
  return order;
}
