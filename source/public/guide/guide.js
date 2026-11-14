/* Interactive guide for 《Pongso no Tao｜蘭嶼文化島》 */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const taoRe = /\b([A-Z][A-Za-z’']+|akokey|tatala|alibangbang|soli|pongso|oyod|rahet)\b/g;

  function decorateTao(text) {
    if (!text) return "";
    const esc = String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return esc.replace(taoRe, '<span class="tao">$1</span>');
  }

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function portraitBox(src, alt, seal) {
    if (src) {
      return `<div class="portrait"><img src="${src}" alt="${alt}" width="230" height="307"></div>`;
    }
    return `<div class="portrait seal-wrap" aria-hidden="true"><span class="seal">${seal || "·"}</span></div>`;
  }

  function renderPeople(data) {
    const party = $("#party-grid");
    const travel = $("#travel-grid");
    const npc = $("#npc-grid");
    if (!party) return;

    party.innerHTML = data.party
      .map(
        (p) => `
      <article class="person">
        ${portraitBox("./guide/portraits/" + p.portrait + ".webp", p.role, p.seal)}
        <h3>${p.role}</h3>
        ${p.nameNote ? `<p class="meta">${p.nameNote}</p>` : ""}
        <p class="bio">${decorateTao(p.bio)}</p>
      </article>`
      )
      .join("");

    travel.innerHTML = data.travellers
      .map(
        (p) => `
      <article class="person compact">
        ${portraitBox("./guide/portraits/" + p.portrait + ".webp", p.role, p.seal)}
        <h3>${p.role}</h3>
        <p class="bio">${decorateTao(p.bio)}</p>
      </article>`
      )
      .join("");

    npc.innerHTML = data.npcs
      .map((p) => {
        const src = p.portrait ? "./guide/portraits/" + p.portrait + ".webp" : "";
        return `
      <article class="person npc">
        ${portraitBox(src, p.role, p.seal)}
        <div class="text">
          <h3>${p.role}</h3>
          <p class="meta">${decorateTao(p.place || "")}</p>
          <p class="bio">${decorateTao(p.bio)}</p>
        </div>
      </article>`;
      })
      .join("");
  }

  function renderPlaces(data) {
    const grid = $("#place-grid");
    if (!grid) return;
    grid.innerHTML = data.villages
      .map(
        (v) => `
      <article class="place-card">
        <h3>${v.zh}</h3>
        <span class="tao">${v.tao}</span>
        <p>${v.blurb}</p>
      </article>`
      )
      .join("");
  }

  function questButton(q) {
    return `<button type="button" class="q-node" data-qid="${q.id}" aria-expanded="false">
      <span class="qid">${q.id}</span>
      <span class="qname">${decorateTao(q.name)}</span>
    </button>`;
  }

  function questDetail(q) {
    const coop = q.coop
      ? `<dt>同行</dt><dd>${decorateTao(q.coop)}</dd>`
      : "";
    return `<div class="q-detail" data-for="${q.id}" hidden>
      <dl>
        <dt>要做的事</dt><dd>${decorateTao(q.goal)}</dd>
        <dt>誰去</dt><dd>${decorateTao(q.who)}</dd>
        <dt>時節</dt><dd>${decorateTao(q.season)}</dd>
        ${coop}
      </dl>
    </div>`;
  }

  function renderLines(lines, mount) {
    mount.innerHTML = lines
      .map((line) => {
        const nodes = line.quests.map(questButton).join("");
        const details = line.quests.map(questDetail).join("");
        return `<article class="line" data-line="${line.id}">
          <header>
            <h3>${line.title}</h3>
            <p>${decorateTao(line.lead)}</p>
          </header>
          <div class="flow">${nodes}</div>
          ${details}
        </article>`;
      })
      .join("");

    mount.addEventListener("click", (ev) => {
      const btn = ev.target.closest(".q-node");
      if (!btn || !mount.contains(btn)) return;
      const id = btn.dataset.qid;
      const article = btn.closest(".line");
      const detail = article.querySelector(`.q-detail[data-for="${id}"]`);
      const open = btn.getAttribute("aria-expanded") === "true";
      article.querySelectorAll(".q-node").forEach((b) => b.setAttribute("aria-expanded", "false"));
      article.querySelectorAll(".q-detail").forEach((d) => {
        d.hidden = true;
        d.classList.remove("is-open");
      });
      if (!open && detail) {
        btn.setAttribute("aria-expanded", "true");
        detail.hidden = false;
        detail.classList.add("is-open");
      }
    });
  }

  function setupTabs(root) {
    const tabs = $$(".tab", root);
    const panels = $$(".panel", root);
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const id = tab.dataset.panel;
        tabs.forEach((t) => t.setAttribute("aria-selected", t === tab ? "true" : "false"));
        panels.forEach((p) => p.classList.toggle("is-on", p.id === id));
      });
    });
  }

  function setupSpoiler(node, onOpen) {
    const openBtn = $("[data-open]", node);
    const closeBtn = $("[data-close]", node);
    const open = () => {
      node.classList.add("is-open");
      node.setAttribute("data-state", "open");
      if (typeof onOpen === "function") {
        requestAnimationFrame(() => onOpen());
      }
      closeBtn?.focus();
    };
    const close = () => {
      node.classList.remove("is-open");
      node.setAttribute("data-state", "closed");
      openBtn?.focus();
    };
    openBtn?.addEventListener("click", open);
    closeBtn?.addEventListener("click", close);
  }

  function renderHints(data) {
    const box = $("#hint-list");
    if (!box) return;
    box.innerHTML = data.hints
      .map(
        (h) => `
      <button type="button" class="hint-card" data-hint="${h.id}" data-step="0" aria-expanded="false">
        <p class="teaser">${decorateTao(h.teaser)}</p>
        <p class="nudge">再點一次，才看得到後面那句。</p>
        <p class="body">${decorateTao(h.body)}</p>
      </button>`
      )
      .join("");

    box.addEventListener("click", (ev) => {
      const card = ev.target.closest(".hint-card");
      if (!card) return;
      const step = Number(card.dataset.step || 0);
      if (step === 0) {
        card.dataset.step = "1";
        card.classList.add("is-armed");
        card.classList.remove("is-open");
        card.setAttribute("aria-expanded", "false");
      } else if (step === 1) {
        card.dataset.step = "2";
        card.classList.remove("is-armed");
        card.classList.add("is-open");
        card.setAttribute("aria-expanded", "true");
      } else {
        card.dataset.step = "0";
        card.classList.remove("is-armed", "is-open");
        card.setAttribute("aria-expanded", "false");
      }
    });
  }

  function setupMap(data) {
    const viewport = $("#map-viewport");
    const world = $("#map-world");
    const pop = $("#map-pop");
    if (!viewport || !world || !pop) return;
    const map = data.map;

    const img = world.querySelector("img");
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.maxWidth = "none";
    const marks = document.createElement("div");
    marks.className = "map-marks";
    marks.style.position = "absolute";
    marks.style.inset = "0";
    world.style.position = "absolute";
    world.style.left = "0";
    world.style.top = "0";
    world.appendChild(marks);

    const all = [
      ...map.villages,
      ...map.npcs,
      ...map.photos,
    ];

    function markerClass(m) {
      if (m.kind === "village") return "marker marker-village";
      if (m.kind === "npc") return "marker marker-npc" + (m.roaming ? " roaming" : "");
      let c = "marker marker-photo";
      if (m.sacred) c += " sacred";
      if (m.distant) c += " distant";
      if (m.consent) c += " consent";
      return c;
    }

    marks.innerHTML =
      all
        .map((m) => {
          const label = m.tao ? `${m.name} ${m.tao}` : m.name;
          return `<button type="button" class="${markerClass(m)}"
            style="left:${m.x}%;top:${m.y}%;"
            data-id="${m.id}" data-kind="${m.kind}"
            aria-label="${label}"></button>`;
        })
        .join("") +
      (map.labels || [])
        .map(
          (l) =>
            `<span class="geo-label" style="left:${l.x}%;top:${l.y}%;">${l.name}</span>`
        )
        .join("");

    function showPop(m) {
      $$(".marker", marks).forEach((b) => b.classList.toggle("is-on", b.dataset.id === m.id));
      const tags = [];
      if (m.kind === "village") tags.push("部落");
      if (m.kind === "npc") tags.push("人物");
      if (m.kind === "photo") tags.push("拍照");
      if (m.group) tags.push(m.group);
      if (m.sacred) tags.push("只在外面遠拍");
      if (m.distant) tags.push("只從遠處拍");
      if (m.consent) tags.push("先問再拍");
      if (m.roaming) tags.push("會移動");
      const title = m.tao ? `${m.name} <span class="tao">${m.tao}</span>` : m.name;
      pop.innerHTML = `<h3>${title}</h3>
        ${tags.map((t) => `<span class="tag">${t}</span>`).join("")}
        <p>${decorateTao(m.note || "")}</p>`;
    }

    marks.addEventListener("click", (ev) => {
      const btn = ev.target.closest(".marker");
      if (!btn) return;
      ev.stopPropagation();
      const m = all.find((x) => x.id === btn.dataset.id);
      if (m) showPop(m);
    });

    const filters = $$("[data-filter]", document);
    function applyFilter(kind) {
      filters.forEach((b) => b.setAttribute("aria-pressed", b.dataset.filter === kind ? "true" : "false"));
      $$(".marker", marks).forEach((b) => {
        const show = kind === "all" || b.dataset.kind === kind;
        b.hidden = !show;
      });
    }
    filters.forEach((b) => b.addEventListener("click", () => applyFilter(b.dataset.filter)));
    applyFilter("all");

    // pan / zoom — at scale 1 the whole island fits in the viewport
    const state = { scale: 1, x: 0, y: 0, min: 1, max: 3.4, baseW: 0, baseH: 0 };
    const pointers = new Map();
    let lastDist = 0;

    function measure() {
      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;
      const iw = img.naturalWidth || 1000;
      const ih = img.naturalHeight || 1020;
      const fit = Math.min(vw / iw, vh / ih);
      state.baseW = iw * fit;
      state.baseH = ih * fit;
      world.style.width = state.baseW + "px";
      world.style.height = state.baseH + "px";
    }

    function clamp() {
      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;
      const sw = state.baseW * state.scale;
      const sh = state.baseH * state.scale;
      if (sw <= vw) state.x = (vw - sw) / 2;
      else state.x = Math.min(0, Math.max(vw - sw, state.x));
      if (sh <= vh) state.y = (vh - sh) / 2;
      else state.y = Math.min(0, Math.max(vh - sh, state.y));
    }

    function apply() {
      clamp();
      world.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
      const inv = 1 / state.scale;
      marks.style.setProperty("--inv", String(inv));
      $$(".marker", marks).forEach((b) => {
        let extra = "";
        if (b.classList.contains("marker-npc") && !b.classList.contains("roaming")) extra = " rotate(45deg)";
        b.style.transform = `translate(-50%, -50%) scale(${inv})` + extra;
      });
      $$(".geo-label", marks).forEach((b) => {
        b.style.transform = `translate(-50%, 0) scale(${inv})`;
      });
    }

    function resetView() {
      state.scale = 1;
      measure();
      state.x = 0;
      state.y = 0;
      apply();
    }

    function zoomAt(cx, cy, next) {
      const s = Math.min(state.max, Math.max(state.min, next));
      const ratio = s / state.scale;
      state.x = cx - (cx - state.x) * ratio;
      state.y = cy - (cy - state.y) * ratio;
      state.scale = s;
      apply();
    }

    $("#zoom-in")?.addEventListener("click", () => {
      const r = viewport.getBoundingClientRect();
      zoomAt(r.width / 2, r.height / 2, state.scale * 1.25);
    });
    $("#zoom-out")?.addEventListener("click", () => {
      const r = viewport.getBoundingClientRect();
      zoomAt(r.width / 2, r.height / 2, state.scale / 1.25);
    });
    $("#zoom-reset")?.addEventListener("click", resetView);

    viewport.addEventListener(
      "wheel",
      (ev) => {
        ev.preventDefault();
        const r = viewport.getBoundingClientRect();
        zoomAt(ev.clientX - r.left, ev.clientY - r.top, state.scale * (ev.deltaY < 0 ? 1.12 : 1 / 1.12));
      },
      { passive: false }
    );

    viewport.addEventListener("pointerdown", (ev) => {
      if (ev.target.closest(".marker")) return;
      viewport.setPointerCapture(ev.pointerId);
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pointers.size === 1) viewport.classList.add("is-dragging");
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        lastDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });

    viewport.addEventListener("pointermove", (ev) => {
      if (!pointers.has(ev.pointerId)) return;
      const prev = pointers.get(ev.pointerId);
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pointers.size === 1) {
        state.x += ev.clientX - prev.x;
        state.y += ev.clientY - prev.y;
        apply();
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (lastDist > 0) {
          const r = viewport.getBoundingClientRect();
          const cx = (a.x + b.x) / 2 - r.left;
          const cy = (a.y + b.y) / 2 - r.top;
          zoomAt(cx, cy, state.scale * (dist / lastDist));
        }
        lastDist = dist;
      }
    });

    const endPointer = (ev) => {
      pointers.delete(ev.pointerId);
      if (pointers.size < 2) lastDist = 0;
      if (pointers.size === 0) viewport.classList.remove("is-dragging");
    };
    viewport.addEventListener("pointerup", endPointer);
    viewport.addEventListener("pointercancel", endPointer);

    const relayout = () => {
      if (viewport.clientWidth < 8 || viewport.clientHeight < 8) return;
      const s = state.scale || 1;
      measure();
      state.scale = s;
      apply();
    };
    if (img.complete && img.naturalWidth) relayout();
    else img.addEventListener("load", relayout, { once: true });
    window.addEventListener("resize", relayout);
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(relayout).observe(viewport);
    }
    return { relayout };
  }

  function setupToc() {
    const links = $$(".toc a");
    if (!links.length || !("IntersectionObserver" in window)) return;
    const map = new Map(links.map((a) => [a.getAttribute("href")?.slice(1), a]));
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!vis) return;
        links.forEach((l) => l.classList.toggle("is-here", l === map.get(vis.target.id)));
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.2, 0.6] }
    );
    $$("section.block, section.spoiler-section").forEach((s) => s.id && io.observe(s));
  }

  async function main() {
    const res = await fetch("./guide/data.json");
    if (!res.ok) throw new Error("無法載入手札資料");
    const data = await res.json();
    renderPeople(data);
    renderPlaces(data);
    renderLines(data.mainLines, $("#panel-main"));
    renderLines(data.sideLines, $("#panel-side"));
    renderLines(data.photoSets, $("#panel-photo"));
    setupTabs($("#quest-tabs"));
    setupSpoiler($("#quest-spoiler"));
    const mapApi = setupMap(data);
    setupSpoiler($("#map-spoiler"), () => mapApi && mapApi.relayout());
    renderHints(data);
    setupToc();
    document.documentElement.dataset.guideReady = "1";
  }

  main().catch((err) => {
    console.error(err);
    const fail = $("#guide-error");
    if (fail) {
      fail.hidden = false;
      fail.textContent = "手札暫時打不開，請重新整理再試一次。";
    }
  });
})();
