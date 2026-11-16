/**
 * Sound settings panel (0.1.4): the ♪ button in the top-right HUD opens two sliders (音樂 / 音效) with an
 * on/off toggle each. Changes apply at once and are saved (src/systems/audio/engine.ts). Works with touch.
 */
import { audio, type AudioSettings } from './engine';
import { sfxBlip, sfxBlipReset } from './sfx';

const CSS = `
#audio-panel{position:fixed;z-index:60;right:10px;top:56px;width:min(280px,calc(100vw - 20px));background:#fffaf0;color:#3b2a1c;
 border:1.5px solid #6b4a2b;border-radius:12px;padding:10px 12px 12px;box-shadow:0 6px 18px rgba(40,25,10,.25);font:500 calc(14px * var(--ts,1)) var(--serif,serif)}
#audio-panel[hidden]{display:none}
#audio-panel .ap-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-weight:700}
#audio-panel .ap-x{border:0;background:none;font:inherit;font-size:18px;line-height:1;padding:6px 8px;color:inherit;cursor:pointer}
#audio-panel .ap-row{display:grid;grid-template-columns:3em 1fr 3.4em;gap:8px;align-items:center;margin:8px 0}
#audio-panel input[type=range]{width:100%;height:28px;accent-color:#a0522d;touch-action:none}
#audio-panel .ap-tg{font:inherit;padding:6px 0;border-radius:8px;border:1px solid #b89c6e;background:#fff;cursor:pointer;min-height:32px}
#audio-panel .ap-tg[aria-pressed=false]{background:#e9e1d2;color:#7d6a55}
`;

type Ch = 'music' | 'sfx';
const ON_KEY: Record<Ch, 'musicOn' | 'sfxOn'> = { music: 'musicOn', sfx: 'sfxOn' };

/** Two rows (音樂 / 音效 slider + 開／關), bound to the shared audio settings. Unique `idPrefix` avoids colliding with the HUD panel. */
export function soundControls(idPrefix: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'sound-rows';
  wrap.innerHTML = `
    <div class="ap-row"><label for="${idPrefix}-music">音樂</label><input id="${idPrefix}-music" type="range" min="0" max="100" step="5"><button type="button" class="ap-tg" data-ch="music"></button></div>
    <div class="ap-row"><label for="${idPrefix}-sfx">音效</label><input id="${idPrefix}-sfx" type="range" min="0" max="100" step="5"><button type="button" class="ap-tg" data-ch="sfx"></button></div>`;
  const slider = (ch: Ch): HTMLInputElement => wrap.querySelector(`#${idPrefix}-${ch}`) as HTMLInputElement;
  const toggle = (ch: Ch): HTMLButtonElement => wrap.querySelector(`.ap-tg[data-ch=${ch}]`) as HTMLButtonElement;
  const render = (): void => {
    // the notebook rebuilds this page each time; a page that is gone stops listening
    if (wrap.dataset.live === '1' && !wrap.isConnected) { audio.offChange(render); return; }
    const s = audio.settings;
    for (const ch of ['music', 'sfx'] as Ch[]) {
      const on = s[ON_KEY[ch]];
      slider(ch).value = String(Math.round(s[ch] * 100));
      slider(ch).setAttribute('aria-valuetext', `${Math.round(s[ch] * 100)}%`);
      toggle(ch).textContent = on ? '開' : '關';
      toggle(ch).setAttribute('aria-pressed', String(on));
      toggle(ch).setAttribute('aria-label', `${ch === 'music' ? '音樂' : '音效'}：${on ? '開' : '關'}`);
    }
  };
  for (const ch of ['music', 'sfx'] as Ch[]) {
    slider(ch).addEventListener('input', () => {
      const v = Number(slider(ch).value) / 100;
      const patch: Partial<AudioSettings> = { [ch]: v, [ON_KEY[ch]]: v > 0 };
      audio.set(patch);
    });
    slider(ch).addEventListener('change', () => {
      if (ch === 'sfx') {
        sfxBlipReset();
        sfxBlip('嘟');
      }
    });
    toggle(ch).addEventListener('click', () => {
      const on = !audio.settings[ON_KEY[ch]];
      const patch: Partial<AudioSettings> = { [ON_KEY[ch]]: on };
      if (on && audio.settings[ch] === 0) patch[ch] = ch === 'music' ? 0.35 : 0.5;
      audio.set(patch);
    });
  }
  audio.onChange(render);
  render();
  wrap.dataset.live = '1';
  return wrap;
}

export function mountAudioPanel(): void {
  const host = document.querySelector('.hud-right');
  if (!host || document.getElementById('btn-bgm')) return;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'icon-btn bgm-btn';
  btn.id = 'btn-bgm';
  btn.setAttribute('aria-label', '聲音設定');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'audio-panel');
  btn.title = '聲音設定';
  host.insertBefore(btn, host.querySelector('#btn-help'));

  const panel = document.createElement('div');
  panel.id = 'audio-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '聲音設定');
  panel.innerHTML = `
    <div class="ap-head"><span>聲音設定</span><button type="button" class="ap-x" aria-label="關閉">✕</button></div>
    <div class="ap-row"><label for="ap-music">音樂</label><input id="ap-music" type="range" min="0" max="100" step="5"><button type="button" class="ap-tg" data-ch="music"></button></div>
    <div class="ap-row"><label for="ap-sfx">音效</label><input id="ap-sfx" type="range" min="0" max="100" step="5"><button type="button" class="ap-tg" data-ch="sfx"></button></div>`;
  document.body.append(panel);
  // keep taps / drags / keys inside the panel away from the game (camera drag, interact keys)
  for (const ev of ['pointerdown', 'pointermove', 'touchstart', 'touchmove', 'wheel', 'keydown'] as const) panel.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });

  const slider = (ch: Ch): HTMLInputElement => panel.querySelector(`#ap-${ch}`) as HTMLInputElement;
  const toggle = (ch: Ch): HTMLButtonElement => panel.querySelector(`.ap-tg[data-ch=${ch}]`) as HTMLButtonElement;

  const render = (): void => {
    const s = audio.settings;
    for (const ch of ['music', 'sfx'] as Ch[]) {
      const on = s[ON_KEY[ch]];
      slider(ch).value = String(Math.round(s[ch] * 100));
      slider(ch).setAttribute('aria-valuetext', `${Math.round(s[ch] * 100)}%`);
      toggle(ch).textContent = on ? '開' : '關';
      toggle(ch).setAttribute('aria-pressed', String(on));
      toggle(ch).setAttribute('aria-label', `${ch === 'music' ? '音樂' : '音效'}：${on ? '開' : '關'}`);
    }
    const allOff = audio.musicGain() === 0 && audio.sfxGain() === 0;
    btn.textContent = allOff ? '♪̸' : '♪';
    btn.style.opacity = allOff ? '0.55' : '';
  };

  for (const ch of ['music', 'sfx'] as Ch[]) {
    slider(ch).addEventListener('input', () => {
      const v = Number(slider(ch).value) / 100;
      const patch: Partial<AudioSettings> = { [ch]: v, [ON_KEY[ch]]: v > 0 };
      audio.set(patch);
    });
    slider(ch).addEventListener('change', () => {
      if (ch === 'sfx') {
        sfxBlipReset();
        sfxBlip('嘟'); // preview
      }
    });
    toggle(ch).addEventListener('click', () => {
      const on = !audio.settings[ON_KEY[ch]];
      const patch: Partial<AudioSettings> = { [ON_KEY[ch]]: on };
      if (on && audio.settings[ch] === 0) patch[ch] = ch === 'music' ? 0.35 : 0.5;
      audio.set(patch);
    });
  }

  const open = (v: boolean): void => {
    panel.hidden = !v;
    btn.setAttribute('aria-expanded', String(v));
    if (v) {
      const r = btn.getBoundingClientRect();
      panel.style.top = `${Math.round(r.bottom + 8)}px`;
      render();
    }
  };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    open(panel.hidden);
  });
  (panel.querySelector('.ap-x') as HTMLButtonElement).addEventListener('click', () => open(false));
  // capture: the game canvas may stop pointer events from bubbling
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (!panel.hidden && !panel.contains(e.target as Node) && e.target !== btn) open(false);
    },
    true,
  );
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) open(false);
  });
  audio.onChange(render);
  render();
}
