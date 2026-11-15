/**
 * 0.1.4 start-menu sound: 音樂 / 音效 on-off toggles on the title, party and arrival screens (the same saved
 * settings as the in-game ♪ panel, src/systems/audio/panel.ts), and classic RPG menu sounds for every menu:
 * move on a new highlighted option (keyboard focus or mouse hover), confirm on select, cancel on back / close.
 * Sounds come from the audio worker's API (docs/audio-menu-api.md) through this one small wrapper.
 */
import { audio } from '../systems/audio/engine';
import { sfx, type MenuSfxId } from '../systems/audio/sfx';

export function menuSfx(id: MenuSfxId): void {
  try {
    sfx.play(id);
  } catch {
    /* audio not available: menus work silently */
  }
}

const CSS = `
.menu-sound{position:absolute;top:calc(10px + var(--safe-t, 0px));right:calc(10px + var(--safe-r, 0px));z-index:5;display:flex;gap:6px}
.menu-sound button{appearance:none;font:600 calc(12.5px * var(--ts,1)) var(--serif,serif);letter-spacing:.04em;color:#3b2a1c;background:rgba(255,250,240,.88);
 border:1px solid #b89c6e;border-radius:999px;padding:6px 11px;min-height:34px;cursor:pointer;touch-action:manipulation;box-shadow:0 1px 3px rgba(40,25,10,.18)}
.menu-sound button[aria-pressed=false]{background:rgba(233,225,210,.9);color:#7d6a55}
.menu-sound button:focus-visible{outline:2px solid #1f6f70;outline-offset:2px}
`;

const SCREENS = ['#title-screen', '#origin-screen', '#arrival-screen'];

/** the 音樂 / 音效 toggles on each start screen */
export function mountMenuSound(): void {
  if (document.querySelector('.menu-sound')) return;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  const bars: HTMLElement[] = [];
  for (const sel of SCREENS) {
    const host = document.querySelector(sel) as HTMLElement | null;
    if (!host) continue;
    const bar = document.createElement('div');
    bar.className = 'menu-sound';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', '聲音');
    bar.innerHTML = `<button type="button" data-ch="music" class="ms-music"></button><button type="button" data-ch="sfx" class="ms-sfx"></button>`;
    // these taps must not also leave the title screen / skip anything behind them
    for (const ev of ['pointerdown', 'pointerup', 'click', 'keydown'] as const) bar.addEventListener(ev, (e) => e.stopPropagation());
    for (const b of bar.querySelectorAll('button')) {
      b.addEventListener('click', () => {
        const ch = b.dataset.ch as 'music' | 'sfx';
        const key = ch === 'music' ? 'musicOn' : 'sfxOn';
        const on = !audio.settings[key];
        const patch: Record<string, number | boolean> = { [key]: on };
        if (on && audio.settings[ch] === 0) patch[ch] = ch === 'music' ? 0.35 : 0.5;
        audio.set(patch);
        menuSfx('menu_toggle');
      });
    }
    host.append(bar);
    bars.push(bar);
  }
  const render = (): void => {
    const s = audio.settings;
    for (const bar of bars) {
      const m = bar.querySelector('.ms-music') as HTMLButtonElement;
      const f = bar.querySelector('.ms-sfx') as HTMLButtonElement;
      m.textContent = `♪ 音樂：${s.musicOn ? '開' : '關'}`;
      f.textContent = `音效：${s.sfxOn ? '開' : '關'}`;
      m.setAttribute('aria-pressed', String(s.musicOn));
      f.setAttribute('aria-pressed', String(s.sfxOn));
    }
  };
  audio.onChange(render);
  render();
}

/** buttons that go back or close: the cancel sound */
const CANCEL = '#btn-arrive-back, .ap-x, [data-sfx=cancel], [aria-label="關閉"], .sheet-close, .journal-close, .btn-close';
/** never a menu sound: movement / camera controls and the start-menu sound toggles (they play their own) */
const SKIP = '#vpad, #cam-btns, #minimap, .menu-sound, #game-canvas, #dlg-next, #btn-act';
/** where menu sounds apply */
const MENU = '.overlay-screen, #journal-backdrop, #dialogue, #travel-sheet, #help-sheet, #audio-panel, #hud, #minigame, .arrival-intro';

/**
 * Delegated menu sounds for every menu (start screens, 手札, dialogue choices, travel, help, the ♪ panel).
 * Move: a new option gets keyboard focus, or the mouse enters a new enabled option (not on touch).
 */
export function installMenuSounds(): void {
  let lastKey = 0;
  let lastMove: Element | null = null;
  const option = (t: EventTarget | null): HTMLElement | null => {
    const el = (t as HTMLElement | null)?.closest?.('button, [role=button], [role=tab], a[href], .chip, input[type=range]') as HTMLElement | null;
    if (!el || el.closest(SKIP) || !el.closest(MENU)) return null;
    if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return null;
    return el;
  };
  window.addEventListener('keydown', () => { lastKey = performance.now(); }, { capture: true, passive: true });
  document.addEventListener('focusin', (e) => {
    const el = option(e.target);
    if (!el || el === lastMove || performance.now() - lastKey > 400) return;
    lastMove = el;
    menuSfx('menu_move');
  });
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = option(e.target);
    if (!el || el === lastMove) return;
    lastMove = el;
    menuSfx('menu_move');
  });
  // touch: buttons act on pointerup (UI.bindActivate) and the screen may change before the click arrives, so the
  // sound is played on the tap itself; the click that follows is then not sounded twice
  let downEl: HTMLElement | null = null;
  let tapped: { el: HTMLElement | null; at: number } = { el: null, at: 0 };
  document.addEventListener('pointerdown', (e) => {
    downEl = e.pointerType === 'mouse' ? null : option(e.target);
  }, true);
  document.addEventListener('pointerup', (e) => {
    const el = e.pointerType === 'mouse' ? null : option(e.target);
    const was = downEl;
    downEl = null;
    if (!el || el !== was || el.matches('input[type=range]')) return;
    tapped = { el, at: performance.now() };
    sound(el);
  }, true);
  const sound = (el: HTMLElement): void => {
    lastMove = el;
    if (el.matches(CANCEL)) menuSfx('menu_cancel');
    else if (el.getAttribute('aria-pressed') !== null || el.getAttribute('role') === 'tab' || el.classList.contains('chip')) menuSfx('menu_toggle');
    else menuSfx('menu_confirm');
  };
  document.addEventListener('click', (e) => {
    const el = option(e.target);
    if (!el || el.matches('input[type=range]')) return;
    if (performance.now() - tapped.at < 700) return; // already sounded on the tap (or a ghost click after it)
    lastMove = el;
    if (el.matches(CANCEL)) menuSfx('menu_cancel');
    else if (el.getAttribute('aria-pressed') !== null || el.getAttribute('role') === 'tab' || el.classList.contains('chip')) menuSfx('menu_toggle');
    else menuSfx('menu_confirm');
  }, true);
}
