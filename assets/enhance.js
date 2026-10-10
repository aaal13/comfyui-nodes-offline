/* ==========================================================================
   ComfyUI 节点离线百科 — 交互增强层 (site/assets/enhance.js)
   负责人: lead（网页美化 + 可互动 UI）
   依赖: assets/app.js 暴露的 window.CW（可选；缺失时自动降级）
   离线要求: 无外部资源、无 fetch/XHR、无 HTML 注入式赋值（全部 textContent / createElement）
   ========================================================================== */
(function () {
  "use strict";

  var VERSION = "1.0.0";
  var FAV_KEY = "cw-favorites";
  var VIEW_KEY = "cw-view";
  var reduced = false;
  try { reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { reduced = false; }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  /* classList.toggle(name, force) 在部分 DOM 实现（如 linkedom）不支持第二参数，统一用显式增删 */
  function setClass(node, name, on) {
    if (!node || !node.classList) { return; }
    if (on) { node.classList.add(name); } else { node.classList.remove(name); }
  }
  function mk(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined && text !== null) { n.textContent = String(text); }
    return n;
  }
  function svgIcon(name, size) {
    var ns = "http://www.w3.org/2000/svg";
    var s = document.createElementNS(ns, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("width", String(size || 18));
    s.setAttribute("height", String(size || 18));
    s.setAttribute("fill", "none");
    s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", "1.8");
    s.setAttribute("stroke-linecap", "round");
    s.setAttribute("stroke-linejoin", "round");
    s.setAttribute("aria-hidden", "true");
    s.setAttribute("focusable", "false");
    var paths = {
      search: ["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z", "M20 20l-4.2-4.2"],
      star: ["M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.6 9.7l5.8-.8z"],
      copy: ["M9 9h9v11H9z", "M6 15H5V5h9v1"],
      up: ["M12 19V5", "M6 11l6-6 6 6"],
      grid: ["M4 4h7v7H4z", "M13 4h7v7h-7z", "M4 13h7v7H4z", "M13 13h7v7h-7z"],
      list: ["M4 6h16", "M4 12h16", "M4 18h16"],
      palette: ["M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 0-4H13a1.5 1.5 0 0 1 0-3h3.5A4.5 4.5 0 0 0 21 9.5C21 5.9 16.9 3 12 3z", "M7.5 9.5h.01", "M11 7h.01", "M15 8.5h.01"],
      help: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M9.6 9.3a2.5 2.5 0 1 1 3.6 2.3c-.7.4-1.2 1-1.2 1.9v.3", "M12 17.2h.01"],
      close: ["M6 6l12 12", "M18 6L6 18"],
      spark: ["M12 3v4", "M12 17v4", "M3 12h4", "M17 12h4", "M6.3 6.3l2.8 2.8", "M14.9 14.9l2.8 2.8", "M17.7 6.3l-2.8 2.8", "M9.1 14.9l-2.8 2.8"],
      chevron: ["M9 6l6 6-6 6"],
      check: ["M20 6L9 17l-5-5"]
    };
    var list = paths[name] || paths.spark;
    for (var i = 0; i < list.length; i++) {
      var p = document.createElementNS(ns, "path");
      p.setAttribute("d", list[i]);
      s.appendChild(p);
    }
    return s;
  }

  /* ---------- 存储（file:// 下 localStorage 可能不可用） ---------- */
  var store = {
    get: function (key, fallback) {
      try {
        var raw = window.localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { window.localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
    }
  };

  /* ---------- Toast ---------- */
  var toastHost = null;
  function toast(message, kind) {
    if (!toastHost) {
      toastHost = mk("div", "cw-toasts");
      toastHost.setAttribute("role", "status");
      toastHost.setAttribute("aria-live", "polite");
      document.body.appendChild(toastHost);
    }
    var t = mk("div", "cw-toast cw-toast-" + (kind || "info"));
    var icon = svgIcon(kind === "ok" ? "check" : "spark", 16);
    t.appendChild(icon);
    t.appendChild(mk("span", null, message));
    toastHost.appendChild(t);
    if (!reduced) {
      requestAnimationFrame(function () { t.classList.add("cw-in"); });
    } else { t.classList.add("cw-in"); }
    window.setTimeout(function () {
      t.classList.remove("cw-in");
      window.setTimeout(function () { if (t.parentNode) { t.parentNode.removeChild(t); } }, 260);
    }, 2600);
  }

  /* ---------- 剪贴板（file:// 下 clipboard API 常不可用，走兜底） ---------- */
  function copyText(text, label) {
    function done(ok) {
      if (ok) { toast((label || "已复制") + "：" + text, "ok"); }
      else { toast("当前环境不支持自动复制，请手动选择：" + text, "warn"); }
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallback()); });
        return;
      }
    } catch (e) { /* ignore */ }
    done(fallback());
    function fallback() {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "readonly");
        ta.className = "cw-copy-holder";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand && document.execCommand("copy");
        document.body.removeChild(ta);
        return !!ok;
      } catch (e) { return false; }
    }
  }

  /* ---------- 滚动进度 + 返回顶部 ---------- */
  function initScrollUI() {
    var bar = mk("div", "cw-progress");
    bar.setAttribute("aria-hidden", "true");
    var inner = mk("span", "cw-progress-bar");
    bar.appendChild(inner);
    document.body.appendChild(bar);

    var top = mk("button", "cw-top");
    top.type = "button";
    top.setAttribute("aria-label", "返回顶部");
    top.setAttribute("title", "返回顶部");
    top.appendChild(svgIcon("up", 18));
    document.body.appendChild(top);

    var ticking = false;
    function update() {
      ticking = false;
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var pct = h > 0 ? Math.min(100, Math.max(0, (window.pageYOffset / h) * 100)) : 0;
      inner.style.width = pct.toFixed(2) + "%";
      if (window.pageYOffset > 420) { top.classList.add("cw-show"); } else { top.classList.remove("cw-show"); }
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    top.addEventListener("click", function () {
      try { window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" }); } catch (e) { window.scrollTo(0, 0); }
    });
    update();
  }

  /* ---------- 进入视口渐显 ---------- */
  function initReveal() {
    var targets = $$(".card, .panel, .stats, .prose > h2, section.card");
    if (!targets.length || reduced || !("IntersectionObserver" in window)) { return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("cw-revealed");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    targets.forEach(function (t, i) {
      t.classList.add("cw-reveal");
      t.style.transitionDelay = Math.min(i % 8, 6) * 35 + "ms";
      io.observe(t);
    });
  }

  /* ---------- 数字滚动（仅在真实浏览器且进入视口时执行；无 rAF / 无 IO 的实现直接保持原值） ---------- */
  function animateNumbers(root) {
    var values = $$(".stat-value", root || document);
    if (reduced || typeof window.requestAnimationFrame !== "function" || !("IntersectionObserver" in window)) { return; }
    values.forEach(function (node) {
      var raw = String(node.textContent || "").replace(/,/g, "");
      var target = parseInt(raw, 10);
      if (!isFinite(target) || target < 8) { return; }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) { return; }
          io.disconnect();
          var start = null;
          function step(ts) {
            if (start === null) { start = ts; }
            var p = Math.min(1, (ts - start) / 900);
            var eased = 1 - Math.pow(1 - p, 3);
            node.textContent = Math.round(target * eased).toLocaleString("en-US");
            if (p < 1) { window.requestAnimationFrame(step); }
            else { node.textContent = target.toLocaleString("en-US"); }
          }
          window.requestAnimationFrame(step);
        });
      }, { threshold: 0.2 });
      io.observe(node);
    });
  }

  /* ---------- 主题：平滑过渡 ---------- */
  function initTheme() {
    document.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest("[data-theme-toggle]") : null;
      if (!btn) { return; }
      var root = document.documentElement;
      root.classList.add("cw-theme-anim");
      window.setTimeout(function () { root.classList.remove("cw-theme-anim"); }, 420);
    }, true);
  }

  /* ---------- 收藏 ---------- */
  var favorites = null;
  function favList() { if (favorites === null) { favorites = store.get(FAV_KEY, []) || []; if (!Array.isArray(favorites)) { favorites = []; } } return favorites; }
  function isFav(id) { return favList().indexOf(id) !== -1; }
  function toggleFav(id, btn) {
    var list = favList();
    var i = list.indexOf(id);
    if (i === -1) { list.push(id); toast("已收藏节点：" + id, "ok"); }
    else { list.splice(i, 1); toast("已取消收藏：" + id, "info"); }
    store.set(FAV_KEY, list);
    syncFavButtons();
    syncFavCards();
    if (btn) { btn.setAttribute("aria-pressed", i === -1 ? "true" : "false"); }
    var counter = $("#cw-fav-filter .cw-fav-count");
    if (counter) { counter.textContent = String(list.length); }
    if (window.CW && window.CW.announce) { window.CW.announce(i === -1 ? "已收藏 " + id : "已取消收藏 " + id); }
  }
  function syncFavCards() {
    $$(".node-card").forEach(function (card) {
      var id = card.getAttribute("data-node-id");
      setClass(card, "cw-fav", !!id && isFav(id));
    });
  }
  function syncFavButtons() {
    $$("[data-cw-fav]").forEach(function (btn) {
      var id = btn.getAttribute("data-cw-fav");
      var on = isFav(id);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      setClass(btn, "cw-on", on);
      btn.setAttribute("title", on ? "取消收藏 " + id : "收藏 " + id);
    });
  }
  function starButton(id, extraClass, asText) {
    var b = mk("button", (asText ? "cw-text-btn cw-star" : "cw-icon-btn cw-star") + (extraClass ? " " + extraClass : ""));
    b.type = "button";
    b.setAttribute("data-cw-fav", id);
    b.setAttribute("aria-pressed", isFav(id) ? "true" : "false");
    b.setAttribute("aria-label", (isFav(id) ? "取消收藏 " : "收藏 ") + id);
    b.setAttribute("title", (isFav(id) ? "取消收藏 " : "收藏 ") + id);
    if (isFav(id)) { b.classList.add("cw-on"); }
    b.appendChild(asText ? mk("span", "cw-star-glyph", "★") : svgIcon("star", 15));
    b.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      toggleFav(id, b);
    });
    return b;
  }

  /* ---------- 节点百科页增强 ---------- */
  function initNodesPage() {
    var cards = $("#node-cards");
    if (!cards || !window.CW || !window.CW.getNodes) { return; }

    /* 1) 卡片星级 + 视图切换 + 收藏过滤按钮 */
    var toolbar = $(".toolbar");
    if (toolbar) {
      var actions = mk("div", "cw-toolbar-extra");

      var favBtn = mk("button", "btn cw-fav-filter");
      favBtn.type = "button";
      favBtn.id = "cw-fav-filter";
      favBtn.setAttribute("aria-pressed", "false");
      var icon = svgIcon("star", 15);
      favBtn.appendChild(icon);
      favBtn.appendChild(mk("span", null, "只看收藏"));
      var count = mk("span", "cw-fav-count", String(favList().length));
      favBtn.appendChild(count);
      favBtn.addEventListener("click", function () {
        var on = favBtn.getAttribute("aria-pressed") !== "true";
        favBtn.setAttribute("aria-pressed", on ? "true" : "false");
        setClass(favBtn, "cw-on", on);
        setClass(cards, "cw-fav-only", on);
        applyFavFilter(on);
        toast(on ? "只显示收藏的 " + favList().length + " 个节点" : "已显示全部节点", "info");
      });
      actions.appendChild(favBtn);

      var viewWrap = mk("div", "cw-view-toggle");
      viewWrap.setAttribute("role", "group");
      viewWrap.setAttribute("aria-label", "列表视图");
      var modes = [
        { id: "cards", label: "卡片视图", icon: "grid" },
        { id: "compact", label: "紧凑列表", icon: "list" }
      ];
      modes.forEach(function (m) {
        var b = mk("button", "cw-icon-btn");
        b.type = "button";
        b.setAttribute("data-cw-view", m.id);
        b.setAttribute("aria-label", m.label);
        b.setAttribute("title", m.label);
        b.setAttribute("aria-pressed", "false");
        b.appendChild(svgIcon(m.icon, 16));
        b.addEventListener("click", function () { setView(m.id); });
        viewWrap.appendChild(b);
      });
      actions.appendChild(viewWrap);

      var helpBtn = mk("button", "btn cw-ghost");
      helpBtn.type = "button";
      helpBtn.appendChild(svgIcon("help", 15));
      helpBtn.appendChild(mk("span", null, "快捷键"));
      helpBtn.addEventListener("click", function () { openHelp(); });
      actions.appendChild(helpBtn);

      toolbar.appendChild(actions);
    }

    function applyFavFilter(on) {
      var list = favList();
      $$(".node-card", cards).forEach(function (card) {
        var id = card.getAttribute("data-node-id");
        var show = !on || list.indexOf(id) !== -1;
        setClass(card, "cw-hidden", !show);
      });
    }

    function setView(mode) {
      var compact = mode === "compact";
      setClass(cards, "cw-compact", compact);
      store.set(VIEW_KEY, mode);
      $$("[data-cw-view]").forEach(function (b) {
        b.setAttribute("aria-pressed", b.getAttribute("data-cw-view") === mode ? "true" : "false");
      });
      toast(compact ? "已切换为紧凑列表" : "已切换为卡片视图", "info");
    }
    setView(store.get(VIEW_KEY, "cards") === "compact" ? "compact" : "cards");

    /* 2) 卡片增强：星级按钮（跟随 app.js 的渲染） */
    function decorateCards() {
      $$(".node-card", cards).forEach(function (card) {
        var id = card.getAttribute("data-node-id");
        if (!id || $("[data-cw-fav]", card)) { return; }
        var star = starButton(id, "cw-card-star");
        card.appendChild(star);
      });
      syncFavCards();
      if ($("#cw-fav-filter") && $("#cw-fav-filter").getAttribute("aria-pressed") === "true") { applyFavFilter(true); }
    }
    decorateCards();
    /* 渲染后补装饰：用 pending 标志合并突发的 DOM 变更，避免在部分 DOM 实现（如 linkedom）下
       因同步回调产生递归/风暴；并对调用次数设上限，异常时自动断开观察。 */
    var decoratePending = false;
    var decorateRuns = 0;
    var mo = new MutationObserver(function () {
      if (decoratePending) { return; }
      decoratePending = true;
      window.setTimeout(function () {
        decoratePending = false;
        decorateRuns++;
        try { decorateCards(); } catch (e) { /* 忽略单次装饰失败 */ }
        if (decorateRuns > 500 && mo) { try { mo.disconnect(); } catch (e) {} mo = null; }
      }, 0);
    });
    mo.observe(cards, { childList: true, subtree: false });

    /* 3) 详情面板增强：复制 / 收藏（跟随 app.js 的渲染） */
    var detail = $("#node-detail");
    if (detail) {
      var tryDecorateDetail = function () {
        if ($(".cw-detail-actions", detail)) { return; }
        var head = $(".detail-head", detail);
        if (!head) { return; } /* 未渲染节点详情（提示态）时不注入 */
        var id = null;
        var active = $(".node-card[aria-current='true']", cards) || $(".card-active", cards);
        if (active) { id = active.getAttribute("data-node-id"); }
        if (!id) {
          var raw = decodeURIComponent(String(location.hash || "").replace(/^#/, ""));
          if (raw && window.CW && window.CW.findNodeById && window.CW.findNodeById(raw)) { id = raw; }
        }
        if (!id) { return; }
        var bar = mk("div", "cw-detail-actions");
        bar.appendChild(starButton(id, null, true));
        var copy = mk("button", "cw-text-btn cw-copy-btn");
        copy.type = "button";
        copy.setAttribute("aria-label", "复制节点名 " + id);
        copy.setAttribute("title", "复制节点名 " + id);
        copy.appendChild(mk("span", null, "复制节点名"));
        copy.addEventListener("click", function () { copyText(id, "节点名"); });
        bar.appendChild(copy);
        head.appendChild(bar);
      };
      tryDecorateDetail();
      var detailMo = new MutationObserver(function () { tryDecorateDetail(); });
      detailMo.observe(detail, { childList: true, subtree: true });
      window.addEventListener("hashchange", function () { window.setTimeout(tryDecorateDetail, 60); });
      window.setTimeout(tryDecorateDetail, 500);
    }
  }

  /* ---------- 命令面板 ---------- */
  var palette = null;
  function buildPalette() {
    if (palette) { return palette; }
    var wrap = mk("div", "cw-palette");
    wrap.setAttribute("hidden", "");
    var dialog = mk("div", "cw-palette-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "快速跳转与命令");

    var head = mk("div", "cw-palette-head");
    head.appendChild(svgIcon("search", 16));
    var input = mk("input", "cw-palette-input");
    input.type = "text";
    input.setAttribute("placeholder", "搜索节点名 / 中文关键词，或输入命令（如 主题、工作流）");
    input.setAttribute("aria-label", "搜索节点或命令");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("spellcheck", "false");
    head.appendChild(input);
    var hint = mk("kbd", "cw-kbd", "Esc");
    head.appendChild(hint);
    dialog.appendChild(head);

    var list = mk("ul", "cw-palette-list");
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "结果");
    dialog.appendChild(list);

    var foot = mk("div", "cw-palette-foot");
    foot.appendChild(mk("span", null, "↑↓ 选择 · Enter 打开 · Esc 关闭"));
    var footRight = mk("span", "cw-palette-brand", "ComfyUI 节点离线百科");
    foot.appendChild(footRight);
    dialog.appendChild(foot);

    wrap.appendChild(dialog);
    document.body.appendChild(wrap);
    palette = { wrap: wrap, input: input, list: list, dialog: dialog, index: 0, items: [] };
    wrap.addEventListener("mousedown", function (ev) { if (ev.target === wrap) { closePalette(); } });
    input.addEventListener("input", function () { renderPalette(input.value); });
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowDown") { ev.preventDefault(); move(1); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); move(-1); }
      else if (ev.key === "Enter") { ev.preventDefault(); choose(palette.index); }
      else if (ev.key === "Escape") { ev.preventDefault(); closePalette(); }
    });
    return palette;
  }
  function staticCommands() {
    return [
      { kind: "cmd", id: "theme", label: "切换深色 / 浅色模式", hint: "外观", run: function () { var b = $("[data-theme-toggle]"); if (b) { b.click(); } } },
      { kind: "cmd", id: "help", label: "查看快捷键与使用技巧", hint: "帮助", run: function () { openHelp(); } },
      { kind: "page", label: "节点百科（全部 " + ((window.CW && window.CW.getNodes) ? window.CW.getNodes().length : 0) + " 个节点）", hint: "页面", href: "nodes.html" },
      { kind: "page", label: "常用工作流拆解", hint: "页面", href: "workflows.html" },
      { kind: "page", label: "术语表与排错", hint: "页面", href: "faq.html" },
      { kind: "page", label: "数据来源与合规", hint: "页面", href: "sources.html" },
      { kind: "page", label: "首页", hint: "页面", href: "index.html" }
    ];
  }
  function scoreNode(node, q) {
    var id = (node.id || "").toLowerCase();
    var name = (node.displayName || "").toLowerCase();
    var zh = (node.summaryZh || "").toLowerCase();
    if (id === q || name === q) { return 100; }
    if (id.indexOf(q) === 0 || name.indexOf(q) === 0) { return 80; }
    if (id.indexOf(q) !== -1) { return 60; }
    if (name.indexOf(q) !== -1) { return 50; }
    if ((node.categoryPath || []).join(" ").toLowerCase().indexOf(q) !== -1) { return 30; }
    if (zh.indexOf(q) !== -1) { return 24; }
    if (window.CW && window.CW.nodeSearchText) {
      var text = window.CW.nodeSearchText(node);
      if (text && text.indexOf(q) !== -1) { return 14; }
    }
    return -1;
  }
  function renderPalette(query) {
    var p = buildPalette();
    var q = (query || "").trim().toLowerCase();
    var items = [];
    if (!q) {
      items = staticCommands().slice(0, 4).concat([{ kind: "info", label: "输入关键词搜索 " + ((window.CW && window.CW.getNodes) ? window.CW.getNodes().length : 0) + " 个节点" }]);
    } else {
      staticCommands().forEach(function (c) {
        if ((c.label + " " + (c.hint || "")).toLowerCase().indexOf(q) !== -1) { items.push(c); }
      });
      var nodes = (window.CW && window.CW.getNodes) ? window.CW.getNodes() : [];
      var scored = [];
      for (var i = 0; i < nodes.length; i++) {
        var s = scoreNode(nodes[i], q);
        if (s > 0) { scored.push({ node: nodes[i], score: s }); }
      }
      scored.sort(function (a, b) {
        if (b.score !== a.score) { return b.score - a.score; }
        return String(a.node.id).localeCompare(String(b.node.id));
      });
      scored.slice(0, 40).forEach(function (entry) {
        var n = entry.node;
        items.push({
          kind: "node",
          id: n.id,
          label: n.id,
          hint: (window.CW.isInstalled && window.CW.isInstalled(n) ? "已收录" : "仅文档收录") + " · " + ((n.categoryPath || []).join(" / ") || "未分类"),
          desc: (window.CW.displayText ? window.CW.displayText(n.summaryZh || n.summaryEn) : (n.summaryZh || n.summaryEn)) || "",
          node: n
        });
      });
    }
    p.items = items;
    p.index = 0;
    p.list.textContent = "";
    if (!items.length) {
      var empty = mk("li", "cw-palette-empty", "没有匹配结果");
      p.list.appendChild(empty);
      return;
    }
    items.forEach(function (item, i) {
      var li = mk("li", "cw-palette-item" + (i === 0 ? " cw-active" : ""));
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", i === 0 ? "true" : "false");
      var badge = mk("span", "cw-palette-kind", item.kind === "node" ? "节点" : item.kind === "page" ? "页面" : item.kind === "cmd" ? "命令" : "");
      li.appendChild(badge);
      var body = mk("span", "cw-palette-body");
      body.appendChild(mk("span", "cw-palette-label", item.label));
      if (item.desc) { body.appendChild(mk("span", "cw-palette-desc", String(item.desc).slice(0, 90))); }
      li.appendChild(body);
      if (item.hint) { li.appendChild(mk("span", "cw-palette-hint", item.hint)); }
      li.addEventListener("mousedown", function (ev) { ev.preventDefault(); choose(i); });
      p.list.appendChild(li);
    });
  }
  function move(delta) {
    var p = palette;
    if (!p || !p.items.length) { return; }
    p.index = (p.index + delta + p.items.length) % p.items.length;
    $$(".cw-palette-item", p.list).forEach(function (li, i) {
      setClass(li, "cw-active", i === p.index);
      li.setAttribute("aria-selected", i === p.index ? "true" : "false");
      if (i === p.index && li.scrollIntoView) { li.scrollIntoView({ block: "nearest" }); }
    });
  }
  function choose(i) {
    var p = palette;
    if (!p) { return; }
    var item = p.items[i];
    if (!item) { return; }
    if (item.kind === "node") {
      closePalette();
      var onNodes = /nodes\.html$/.test(location.pathname) || /nodes\.html/.test(location.href);
      if (onNodes) {
        location.hash = "#" + encodeURIComponent(item.id);
        toast("已定位节点：" + item.id, "ok");
      } else {
        location.href = "nodes.html#" + encodeURIComponent(item.id);
      }
      return;
    }
    if (item.kind === "page") { closePalette(); location.href = item.href; return; }
    if (item.kind === "cmd") { closePalette(); item.run(); return; }
  }
  function openPalette() {
    var p = buildPalette();
    p.wrap.removeAttribute("hidden");
    document.body.classList.add("cw-palette-open");
    renderPalette("");
    window.setTimeout(function () { try { p.input.focus(); p.input.select(); } catch (e) {} }, 20);
  }
  function closePalette() {
    if (!palette) { return; }
    palette.wrap.setAttribute("hidden", "");
    document.body.classList.remove("cw-palette-open");
  }

  /* ---------- 快捷键帮助 ---------- */
  var helpBox = null;
  function openHelp() {
    if (!helpBox) {
      helpBox = mk("div", "cw-help");
      helpBox.setAttribute("hidden", "");
      var card = mk("div", "cw-help-card");
      card.setAttribute("role", "dialog");
      card.setAttribute("aria-modal", "true");
      card.setAttribute("aria-label", "快捷键与使用技巧");
      var head = mk("div", "cw-help-head");
      head.appendChild(mk("h2", null, "快捷键与使用技巧"));
      var close = mk("button", "cw-icon-btn");
      close.type = "button";
      close.setAttribute("aria-label", "关闭");
      close.appendChild(svgIcon("close", 16));
      close.addEventListener("click", function () { helpBox.setAttribute("hidden", ""); });
      head.appendChild(close);
      card.appendChild(head);
      var rows = [
        ["Ctrl / ⌘ + K", "打开命令面板，搜索任意节点并直接跳转"],
        ["/", "在节点百科页聚焦搜索框"],
        ["↑ ↓ / Enter", "命令面板中上下选择、回车打开"],
        ["Shift + 点击节点名", "复制该节点的真实节点名"],
        ["Esc", "关闭命令面板 / 帮助 / 清空搜索"],
        ["?", "打开本帮助"],
        ["⭐ 按钮", "收藏节点；工具栏「只看收藏」按收藏过滤（保存在数据集浏览器）"]
      ];
      var table = mk("table", "table cw-help-table");
      var tb = mk("tbody");
      rows.forEach(function (r) {
        var tr = mk("tr");
        var th = mk("th");
        th.appendChild(mk("kbd", "cw-kbd", r[0]));
        tr.appendChild(th);
        tr.appendChild(mk("td", null, r[1]));
        tb.appendChild(tr);
      });
      table.appendChild(tb);
      card.appendChild(table);
      card.appendChild(mk("p", "muted", "本页完全离线运行：数据来自公开节点数据集与 ComfyUI 官方文档，不加载任何外部资源。"));
      helpBox.appendChild(card);
      document.body.appendChild(helpBox);
      helpBox.addEventListener("mousedown", function (ev) { if (ev.target === helpBox) { helpBox.setAttribute("hidden", ""); } });
    }
    helpBox.removeAttribute("hidden");
  }

  /* ---------- 全局键盘与复制 ---------- */
  function initGlobalKeys() {
    document.addEventListener("keydown", function (ev) {
      var tag = (ev.target && ev.target.tagName) || "";
      var typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (ev.target && ev.target.isContentEditable);
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === "k" || ev.key === "K")) {
        ev.preventDefault();
        openPalette();
        return;
      }
      if (ev.key === "Escape") {
        closePalette();
        if (helpBox) { helpBox.setAttribute("hidden", ""); }
        return;
      }
      if (typing) { return; }
      if (ev.key === "?" || (ev.shiftKey && ev.key === "/")) { ev.preventDefault(); openHelp(); }
      if (ev.key === "g" || ev.key === "G") { /* 预留 */ }
    });
  }
  function initChipCopy() {
    document.addEventListener("click", function (ev) {
      var chip = ev.target && ev.target.closest ? ev.target.closest("a.node-chip, span.node-chip") : null;
      if (!chip || !ev.shiftKey) { return; }
      var href = chip.getAttribute("href") || "";
      var id = href.indexOf("#") !== -1 ? decodeURIComponent(href.split("#")[1]) : (chip.textContent || "").trim();
      if (!id) { return; }
      ev.preventDefault();
      copyText(id, "节点名");
    });
    $$("a.node-chip").forEach(function (chip) {
      if (!chip.getAttribute("title")) { chip.setAttribute("title", "点击跳转到节点详情；Shift + 点击复制节点名"); }
    });
  }

  /* ---------- 工作流页：目录 + 折叠 + 复制清单 ---------- */
  function initWorkflows() {
    var sections = $$("section.card[id]");
    if (!sections.length) { return; }
    sections.forEach(function (sec) {
      var title = sec.querySelector(".card-title") || sec.querySelector("h2");
      if (!title) { return; }
      var bar = mk("div", "cw-section-actions");
      var chips = $$("a.node-chip, span.node-chip", sec);
      if (chips.length) {
        var copyBtn = mk("button", "cw-icon-btn cw-small");
        copyBtn.type = "button";
        copyBtn.setAttribute("title", "复制本节 " + chips.length + " 个节点名");
        copyBtn.setAttribute("aria-label", "复制本节节点名清单");
        copyBtn.appendChild(svgIcon("copy", 14));
        copyBtn.addEventListener("click", function () {
          var ids = chips.map(function (c) { return (c.textContent || "").trim(); });
          var uniq = ids.filter(function (v, i) { return v && ids.indexOf(v) === i; });
          copyText(uniq.join("\n"), "本节节点名（" + uniq.length + " 个）");
        });
        bar.appendChild(copyBtn);
      }
      var fold = mk("button", "cw-icon-btn cw-small cw-fold");
      fold.type = "button";
      fold.setAttribute("aria-expanded", "true");
      fold.setAttribute("aria-label", "折叠本节");
      fold.setAttribute("title", "折叠 / 展开本节");
      fold.appendChild(svgIcon("chevron", 14));
      fold.addEventListener("click", function () {
        sec.classList.toggle("cw-collapsed");
        var collapsed = sec.classList.contains("cw-collapsed");
        fold.setAttribute("aria-expanded", collapsed ? "false" : "true");
      });
      bar.appendChild(fold);
      title.appendChild(bar);
    });
  }

  /* ---------- 初始化 ---------- */
  function boot() {
    try { initScrollUI(); } catch (e) {}
    try { initTheme(); } catch (e) {}
    try { initGlobalKeys(); } catch (e) {}
    try { initChipCopy(); } catch (e) {}
    try { initReveal(); } catch (e) {}
    try { initWorkflows(); } catch (e) {}
    try { if ($("#node-cards")) { initNodesPage(); } } catch (e) {}
    try { if ($("#home-stats")) { animateNumbers($("#home-stats")); } } catch (e) {}
    window.CW_ENHANCE = { version: VERSION, toast: toast, copy: copyText, openPalette: openPalette, openHelp: openHelp, favorites: favList };
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", boot); } else { boot(); }
  window.addEventListener("load", function () {
    try { if ($("#home-stats")) { animateNumbers($("#home-stats")); } } catch (e) {}
  });
})();
