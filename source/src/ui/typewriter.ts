/**
 * Dialogue typewriter (0.1.4): reveals a line a character at a time with a soft blip (src/systems/audio/sfx.ts).
 * The full text is in the element from the start (the unrevealed part is only transparent), so layout never
 * jumps and anything reading textContent sees the whole line. A tap / key while typing shows the rest at once.
 */
import { sfxBlip, sfxBlipReset } from '../systems/audio/sfx';

const MS_PER_CHAR = 32;

export class Typewriter {
  private timer = 0;
  private jobs: { el: HTMLElement; text: string; shown: Text; rest: HTMLSpanElement }[] = [];
  private i = 0;
  private n = 0;

  get typing(): boolean {
    return this.timer !== 0;
  }

  /** start revealing these elements (in order); each keeps its current textContent */
  start(els: HTMLElement[]): void {
    this.finish();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.jobs = [];
    for (const el of els) {
      const text = el.textContent ?? '';
      if (!text) continue;
      const shown = document.createTextNode('');
      const rest = document.createElement('span');
      rest.style.color = 'transparent';
      rest.textContent = text;
      el.replaceChildren(shown, rest);
      this.jobs.push({ el, text, shown, rest });
    }
    this.n = this.jobs.reduce((a, j) => a + [...j.text].length, 0);
    this.i = 0;
    sfxBlipReset();
    if (reduce || !this.n) {
      this.finish();
      return;
    }
    this.timer = window.setInterval(() => this.step(), MS_PER_CHAR);
  }

  private step(): void {
    this.i++;
    let k = this.i;
    for (const j of this.jobs) {
      const chars = [...j.text];
      if (k <= chars.length) {
        j.shown.data = chars.slice(0, k).join('');
        j.rest.textContent = chars.slice(k).join('');
        sfxBlip(chars[k - 1]);
        break;
      }
      k -= chars.length;
    }
    if (this.i >= this.n) this.finish();
  }

  /** show everything now; true if it was still typing (so the tap was used up) */
  finish(): boolean {
    const was = this.timer !== 0;
    if (this.timer) clearInterval(this.timer);
    this.timer = 0;
    for (const j of this.jobs) if (j.el.isConnected) j.el.textContent = j.text;
    this.jobs = [];
    return was;
  }
}
