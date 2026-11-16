/** Discrete keyboard actions; Game maps them per mode (one keyboard pipeline for the whole app). */
export type InputAction = 'escape' | 'journal' | 'scooter' | 'quests' | 'party1' | 'party2' | 'party3' | 'partyNext';

const ACTION_KEYS: Record<string, InputAction> = {
  Escape: 'escape',
  KeyJ: 'journal',
  KeyM: 'scooter',
  KeyL: 'quests',
  Digit1: 'party1',
  Digit2: 'party2',
  Digit3: 'party3',
  KeyC: 'partyNext',
};

/**
 * Keyboard + canvas pointer input.
 * - Keyboard: held keys (WASD / arrows / Q,R / interact keys) are polled per frame; one-shot keys are
 *   emitted through `onAction`, and `onAnyKey` lets the UI dismiss transient hints.
 * - Canvas pointers: one finger / left mouse orbits, two fingers pinch-zoom.
 * - Movement on touch comes only from the DOM virtual stick (#vpad) via `setPad()`.
 */
export class Input {
  keys = new Set<string>();
  moveX = 0;
  moveZ = 0; // -1 = up / away from camera, +1 = down / toward camera
  wantLeft = false;
  wantRight = false;
  dragging = false;
  dragDx = 0;
  dragDy = 0;
  wheel = 0;
  pinch = 0;
  padActive = false;

  private canvas: HTMLCanvasElement;
  private pointers = new Map<number, { x: number; y: number }>();
  /** 0.1.6: a short tap on the island (no drag, no pinch): screen point → Game.tapAt */
  onTap: ((x: number, y: number) => void) | null = null;
  private tapStart: { id: number; x: number; y: number; t: number; moved: boolean } | null = null;
  private pinchBase = 0;
  private orbitId: number | null = null;
  private lastX = 0;
  private lastY = 0;
  private interactHeld = false;
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onPointerDown: (e: PointerEvent) => void;
  private onPointerMove: (e: PointerEvent) => void;
  private onPointerUp: (e: PointerEvent) => void;
  private onWheel: (e: WheelEvent) => void;
  private onContext: (e: Event) => void;
  private onBlur: () => void;
  private onVisibility: () => void;
  /** extra reset hooks (e.g. Game camera buttons) run when the window loses focus */
  onReset: (() => void) | null = null;
  /** one-shot actions (Escape / J / M) */
  onAction: ((a: InputAction) => void) | null = null;
  /** any key press outside text fields (the first-entry help hint closes on it) */
  onAnyKey: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.onKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      this.onAnyKey?.();
      const action = ACTION_KEYS[e.code];
      if (action) {
        if (action !== 'escape') e.preventDefault();
        this.onAction?.(action);
      }
      // a focused button already fires its own click on Enter/Space; don't also treat it as "interact"
      if ((e.code === 'Enter' || e.code === 'Space') && target?.closest?.('button, a, [role="button"], select')) return;
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    };
    this.onKeyUp = (e: KeyboardEvent): void => {
      this.keys.delete(e.code);
    };
    this.onPointerDown = (e: PointerEvent): void => {
      if (this.blocked(e.target)) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size >= 2) {
        // two-finger pinch: cancel the orbit and track scale
        this.dragging = false;
        this.orbitId = null;
        this.pinchBase = this.pinchDistance();
        this.tapStart = null;
        return;
      }
      this.tapStart = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
      this.orbitId = e.pointerId;
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      try { this.canvas.setPointerCapture?.(e.pointerId); } catch { /* synthetic or already-released pointer */ }
    };
    this.onPointerMove = (e: PointerEvent): void => {
      const rec = this.pointers.get(e.pointerId);
      if (rec) {
        rec.x = e.clientX;
        rec.y = e.clientY;
      }
      if (this.pointers.size >= 2) {
        const dist = this.pinchDistance();
        if (this.pinchBase > 0) {
          const ratio = dist / this.pinchBase;
          this.pinch += Math.log(Math.max(0.2, ratio));
          this.pinchBase = dist;
        } else this.pinchBase = dist;
        return;
      }
      if (this.tapStart?.id === e.pointerId && Math.hypot(e.clientX - this.tapStart.x, e.clientY - this.tapStart.y) >= 10) this.tapStart.moved = true;
      if (!this.dragging || this.orbitId !== e.pointerId) return;
      this.dragDx += e.clientX - this.lastX;
      this.dragDy += e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    };
    this.onPointerUp = (e: PointerEvent): void => {
      const ts = this.tapStart;
      if (ts && ts.id === e.pointerId) {
        this.tapStart = null;
        if (e.type === 'pointerup' && !ts.moved && performance.now() - ts.t < 450 && Math.hypot(e.clientX - ts.x, e.clientY - ts.y) < 10) this.onTap?.(e.clientX, e.clientY);
      }
      this.pointers.delete(e.pointerId);
      if (this.orbitId === e.pointerId) {
        this.dragging = false;
        this.orbitId = null;
      }
      if (this.pointers.size < 2) this.pinchBase = 0;
      if (this.pointers.size === 1) {
        const [id, p] = [...this.pointers.entries()][0];
        // leftover finger after a pinch becomes orbit, not a sudden jump
        this.orbitId = id;
        this.dragging = true;
        this.lastX = p.x;
        this.lastY = p.y;
      }
    };
    this.onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      this.wheel += e.deltaY;
    };
    this.onContext = (e: Event): void => {
      e.preventDefault();
    };
    this.onBlur = (): void => this.resetHeld();
    this.onVisibility = (): void => {
      if (document.visibilityState !== 'visible') this.resetHeld();
    };
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', this.onContext);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('contextmenu', this.onContext);
  }

  /** Virtual stick (#vpad) state: x right, z down, both in [-1, 1]. */
  setPad(x: number, z: number, active: boolean): void {
    this.padActive = active;
    this.moveX = x;
    this.moveZ = z;
  }

  /** Drop every held key / pointer so nothing keeps moving after Alt-Tab, an app switch or a system dialog. */
  resetHeld(): void {
    this.keys.clear();
    this.interactHeld = false;
    this.padActive = false;
    this.moveX = 0;
    this.moveZ = 0;
    this.wantLeft = false;
    this.wantRight = false;
    this.dragging = false;
    this.dragDx = 0;
    this.dragDy = 0;
    this.pinch = 0;
    this.pinchBase = 0;
    this.pointers.clear();
    this.orbitId = null;
    this.onReset?.();
  }

  private pinchDistance(): number {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  private blocked(el: EventTarget | null): boolean {
    const node = el as HTMLElement | null;
    if (!node) return false;
    return Boolean(node.closest?.('button, input, textarea, .journal, .dialogue, .minigame, .origin-card, .overlay-screen, .vpad, .cam-btns, .chipbar, .minimap, .travel-sheet, .hud-top, .interact-prompt, .help-toast, .help-sheet-wrap, .help-sheet'));
  }

  beginFrame(): void {
    const l = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const r = this.keys.has('KeyD') || this.keys.has('ArrowRight');
    const u = this.keys.has('KeyW') || this.keys.has('ArrowUp');
    const d = this.keys.has('KeyS') || this.keys.has('ArrowDown');
    const x = (r ? 1 : 0) - (l ? 1 : 0);
    const z = (d ? 1 : 0) - (u ? 1 : 0);
    if (!this.padActive) {
      this.moveX = x;
      this.moveZ = z;
    }
    this.wantLeft = this.keys.has('KeyQ');
    this.wantRight = this.keys.has('KeyR');
  }

  /** One-frame interact edge (E / F / Space / Enter). */
  consumeInteract(): boolean {
    const pressed =
      this.keys.has('KeyF') ||
      this.keys.has('Space') ||
      this.keys.has('Enter') ||
      this.keys.has('KeyE');
    if (pressed && !this.interactHeld) {
      this.interactHeld = true;
      return true;
    }
    if (!pressed) this.interactHeld = false;
    return false;
  }

  consumeDrag(): { dx: number; dy: number } {
    const out = { dx: this.dragDx, dy: this.dragDy };
    this.dragDx = 0;
    this.dragDy = 0;
    return out;
  }

  consumeWheel(): number {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  consumePinch(): number {
    const p = this.pinch;
    this.pinch = 0;
    return p;
  }
}
