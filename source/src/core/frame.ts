/**
 * Boot-time cooperative yielding.
 * - `yieldToUi()` always yields; it waits for a paint (rAF) only when the page is visible and the
 *   loading bar has not been painted for a while, otherwise it uses a fast macrotask (MessageChannel).
 *   A hidden tab therefore keeps booting instead of freezing on a paused rAF.
 * - `yieldIfBusy()` only yields once the current slice has used its time budget, so tight bake loops
 *   do not waste ~16 ms per fixed-size chunk.
 */
const PAINT_EVERY_MS = 90;
let sliceStart = performance.now();
let lastPaint = 0;

const channel = typeof MessageChannel === 'function' ? new MessageChannel() : null;
const pending: (() => void)[] = [];
if (channel) {
  channel.port1.onmessage = () => {
    const fn = pending.shift();
    fn?.();
  };
}

function macrotask(): Promise<void> {
  return new Promise((resolve) => {
    if (channel) {
      pending.push(resolve);
      channel.port2.postMessage(0);
    } else setTimeout(resolve, 0);
  });
}

/** Yield to the browser so Safari can paint the loading bar and reset its script watchdog.
 *  `forcePaint` is for phase boundaries right before a long synchronous step. */
export async function yieldToUi(forcePaint = false): Promise<void> {
  const now = performance.now();
  if (document.visibilityState === 'visible' && (forcePaint || now - lastPaint >= PAINT_EVERY_MS)) {
    await new Promise<void>((resolve) => {
      setTimeout(() => requestAnimationFrame(() => resolve()), 0);
      // rAF is paused if the tab gets hidden mid-wait; don't hang the boot on it
      setTimeout(resolve, 120);
    });
    lastPaint = performance.now();
  } else {
    await macrotask();
  }
  sliceStart = performance.now();
}

/** Yield only when the current slice has run longer than `budgetMs`. */
export function yieldIfBusy(budgetMs = 10): Promise<void> | void {
  if (performance.now() - sliceStart < budgetMs) return;
  return yieldToUi();
}
