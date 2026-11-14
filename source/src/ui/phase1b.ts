/**
 * Phase 1 batch 1b UI pieces kept out of dom.ts: the underwater moment overlay, the activity-song card,
 * and the 手札 pages「相簿與水下」and「存檔」(export / import).
 */
import { diveImageIds, diveUrl, loadImage, type DiveKind } from './dive';
import { songBlock } from './dom';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

export interface DiveOpts {
  kind: DiveKind;
  title: string;
  caption: string;
}

/**
 * Full-screen image popup (dives, album). Tap anywhere or ✕ to close; resolves when closed.
 * `ids` = illustration ids; several (U3) show as a 3×2 set.
 */
/** closes an open image popup as if tapped (closeAll / fast travel); its promise resolves */
let closePopup: (() => void) | null = null;
export function closeImagePopup(): void {
  closePopup?.();
}

export async function showImagePopup(ids: string[], title: string, caption: string, keepLabel = '收進相簿'): Promise<void> {
  document.getElementById('dive-scene')?.remove();
  const wrap = el('div', `dive-scene${ids.length > 1 ? ' multi' : ''}`);
  wrap.id = 'dive-scene';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('aria-label', title);
  const stage = el('div', 'dive-stage');
  // a missing image shows a placeholder; the popup (and the quest step after it) still completes
  const imgs = await Promise.all(ids.map((id) => loadImage(diveUrl(id)).then((i) => (i.naturalWidth ? i : null), () => null)));
  for (const img of imgs) {
    if (!img) {
      stage.append(el('div', 'dive-img dive-missing', '（圖片暫時無法顯示）'));
      continue;
    }
    img.className = 'dive-img';
    img.alt = title;
    img.draggable = false;
    stage.append(img);
  }
  const cap = el('div', 'dive-caption');
  cap.append(el('div', 'dc-title', title), el('div', 'dc-sub', caption));
  const btn = el('button', 'dive-keep', `${keepLabel} ✕`);
  btn.type = 'button';
  btn.id = 'dive-keep';
  btn.setAttribute('aria-label', `${keepLabel}並關閉`);
  wrap.append(stage, cap, btn);
  document.body.append(wrap);
  wrap.classList.add('in');
  btn.focus({ preventScroll: true });
  await new Promise<void>((res) => {
    const done = (): void => {
      closePopup = null;
      wrap.removeEventListener('click', done);
      document.removeEventListener('keydown', key);
      res();
    };
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') done();
    };
    closePopup = done;
    wrap.addEventListener('click', done); // tap anywhere (the ✕ button included)
    document.addEventListener('keydown', key);
  });
  wrap.remove();
}

/** dive at U1 / U2 / U3: the illustration for the controlled member pops up */
export function showDive(o: DiveOpts): Promise<void> {
  return showImagePopup(diveImageIds(o.kind), o.title, o.caption);
}

export interface SongVM {
  id: string;
  title: string;
  tao: string;
  zh: string;
  source: string;
  activity: string;
}

/** small card after an activity: the song's first line (text only) */
export function showSongCard(sg: SongVM): void {
  document.getElementById('song-card')?.remove();
  const card = el('div', 'song-card');
  card.id = 'song-card';
  const x = el('button', 'close-x', '×');
  x.type = 'button';
  x.setAttribute('aria-label', '關閉');
  x.addEventListener('click', () => card.remove());
  card.append(x, el('div', 'sc-kicker', `活動歌謠｜${sg.activity}`), songBlock(sg));
  document.body.append(card);
  setTimeout(() => card.remove(), 12000);
}

export interface AlbumVM {
  photos: { id: string; name: string }[];
  photoTotal: number;
  uw: { kind: 'A' | 'B'; title: string; have: boolean }[];
  pov: boolean;
  povVisible: boolean;
  songs: (SongVM & { have: boolean })[];
}

export function renderAlbum(pages: HTMLElement, vm: AlbumVM): void {
  const root = el('div', 'album');
  // underwater: illustration thumbnails, tap for the full image
  const thumb = (id: string, label: string, have: boolean, title: string): HTMLElement => {
    const fig = el('figure', `album-item ${have ? '' : 'missing'}`);
    if (have) {
      const b = el('button', 'album-open');
      b.type = 'button';
      b.setAttribute('aria-label', `看大圖：${label}`);
      const img = el('img', 'album-thumb');
      img.src = diveUrl(id, true);
      img.alt = label;
      img.loading = 'lazy';
      img.decoding = 'async';
      b.append(img);
      b.addEventListener('click', () => void showImagePopup([id], title, label, '關閉'));
      fig.append(b);
    } else fig.append(el('div', 'album-blank', '？'));
    fig.append(el('figcaption', '', label));
    return fig;
  };
  {
    const sec = el('section', 'album-sec');
    sec.append(el('h3', '', `水下美景（${vm.uw.filter((u) => u.have).length}/${vm.uw.length}）`));
    const grid = el('div', 'album-grid');
    for (const u of vm.uw) grid.append(thumb(diveImageIds(u.kind)[0], u.title.replace(/^水下美景 [AB]｜/, ''), u.have, u.title));
    sec.append(grid);
    root.append(sec);
  }
  if (vm.povVisible) {
    const sec = el('section', 'album-sec');
    sec.append(el('h3', '', `旅人的水下視角（${vm.pov ? 3 : 0}/3）`));
    const grid = el('div', 'album-grid');
    diveImageIds('POV').forEach((id, i) => grid.append(thumb(id, `照片 ${i + 1}`, vm.pov, '旅人的水下視角')));
    sec.append(grid);
    root.append(sec);
  }
  // land photos
  const ph = el('section', 'album-sec');
  ph.append(el('h3', '', `旅人相簿（${vm.photos.length}/${vm.photoTotal}）`));
  const list = el('ul', 'album-list');
  for (const p of vm.photos) list.append(el('li', '', `${p.id}｜${p.name}`));
  if (!vm.photos.length) list.append(el('li', 'muted', '還沒有拍過照片。旅人走到景點附近就能拍。'));
  ph.append(list);
  root.append(ph);
  // songs
  const so = el('section', 'album-sec');
  so.append(el('h3', '', `活動歌謠（${vm.songs.filter((s) => s.have).length}/${vm.songs.length}）`));
  so.append(el('p', 'muted', '每個活動只放第一句文字，音檔之後再加。點 ⓘ 看來源。'));
  for (const s of vm.songs) {
    if (s.have) so.append(songBlock(s));
    else so.append(el('div', 'song-block locked', `♪ ？？？（${s.activity}）`));
  }
  root.append(so);
  pages.replaceChildren(root);
}

export interface SaveTabHooks {
  code: () => string;
  download: () => void;
  importText: (text: string) => { ok: boolean; msg: string };
}

export function renderSaveTab(pages: HTMLElement, h: SaveTabHooks): void {
  const root = el('div', 'save-tab');
  const warn = el('div', 'save-warn');
  warn.append(
    el('strong', '', '注意：'),
    document.createTextNode('遊戲進度只存在這個瀏覽器裡。清除瀏覽器資料（Cookie 與網站資料）、使用無痕視窗或換手機，存檔就會消失。重要的進度請先匯出備份。'),
  );
  root.append(warn);

  const ex = el('section', 'save-sec');
  ex.append(el('h3', '', '匯出存檔'));
  const dl = el('button', 'btn-primary', '下載存檔檔案（.json）');
  dl.type = 'button';
  dl.id = 'save-download';
  dl.addEventListener('click', () => h.download());
  const codeBox = el('textarea', 'save-code');
  codeBox.id = 'save-code-out';
  codeBox.readOnly = true;
  codeBox.rows = 3;
  codeBox.value = h.code();
  const cp = el('button', 'btn-ghost', '複製存檔碼');
  cp.type = 'button';
  cp.id = 'save-copy';
  const cpMsg = el('span', 'save-msg');
  cp.addEventListener('click', async () => {
    codeBox.value = h.code();
    codeBox.select();
    let ok = false;
    try {
      await navigator.clipboard.writeText(codeBox.value);
      ok = true;
    } catch {
      ok = document.execCommand?.('copy') ?? false;
    }
    cpMsg.textContent = ok ? '已複製。可以貼到記事本或傳給自己。' : '請長按上面的文字框，自己全選複製。';
  });
  ex.append(dl, el('p', 'muted', '或用存檔碼（一段文字，可以貼到記事本或傳給自己）：'), codeBox, cp, cpMsg);
  root.append(ex);

  const im = el('section', 'save-sec');
  im.append(el('h3', '', '匯入存檔'));
  im.append(el('p', 'muted', '匯入會取代目前的進度。'));
  const file = el('input');
  file.type = 'file';
  file.accept = '.json,application/json,text/plain';
  file.id = 'save-file';
  const inBox = el('textarea', 'save-code');
  inBox.id = 'save-code-in';
  inBox.rows = 3;
  inBox.placeholder = '把存檔碼貼在這裡';
  const go = el('button', 'btn-primary', '匯入存檔碼');
  go.type = 'button';
  go.id = 'save-import';
  const msg = el('div', 'save-msg');
  msg.id = 'save-import-msg';
  const run = (text: string): void => {
    const r = h.importText(text);
    msg.textContent = r.msg;
    msg.classList.toggle('bad', !r.ok);
  };
  go.addEventListener('click', () => run(inBox.value));
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (f) run(await f.text());
    file.value = '';
  });
  const fl = el('label', 'save-file-label', '從檔案匯入：');
  fl.append(file);
  im.append(fl, inBox, go, msg);
  root.append(im);
  pages.replaceChildren(root);
}
