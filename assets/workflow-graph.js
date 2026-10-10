/* ==========================================================================
   ComfyUI 节点离线百科 — 工作流节点链路图 (site/assets/workflow-graph.js)
   负责人: lead
   作用: 把 workflows.html 里「节点链路」的文字列表原地升级为**可点击的链路图**：
         - 节点卡片按流程顺序连线，颜色区分 core / api / 自定义包 / 仅文档收录
         - 点击节点 → 右侧详情卡（官方用途 + 在本流程中的角色 + 输入/输出摘要 + 跳转节点百科）
         - 「依次讲解」按顺序高亮演示；「已完成 N/M」进度；支持键盘 ← → 移动与 Esc 关闭
         - 原有表格 / 来源 / 文字链路折叠为 <details>，页面默认以图为主
   事实来源: 节点名与角色文字直接取自本页现有内容；官方用途取自 window.COMFY_DATA（同一套已审计数据）
   离线要求: 无外部资源、无 fetch、无 HTML 注入式赋值（全部 createElement / textContent）
   ========================================================================== */
(function () {
  "use strict";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function mk(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined && text !== null) { n.textContent = String(text); }
    return n;
  }
  function norm(text) { return String(text || "").replace(/\s+/g, " ").trim(); }

  function cw() { return window.CW || null; }

  function packKind(id) {
    var C = cw();
    var node = C && C.findNodeById ? C.findNodeById(id) : null;
    if (!node) { return { kind: "doc", label: "未收录", installed: false, node: null }; }
    var installed = C.isInstalled ? C.isInstalled(node) : !!node.installed;
    var pack = C.packOf ? String(C.packOf(node) || "") : String(node.pack || "");
    var kind = "custom";
    if (pack === "core") { kind = "core"; }
    else if (pack === "api") { kind = "api"; }
    else if (pack === "docs-only" || !installed) { kind = "doc"; }
    return { kind: kind, label: pack || (installed ? "自定义包" : "doc-only"), installed: installed, node: node };
  }

  /* ---------- 解析一节里的链路（支持一节多条：8.1 / 8.2 / 9.1 …） ---------- */
  function parseItems(list) {
    var items = [];
    $$("li", list).forEach(function (li) {
      var chip = li.querySelector("a.node-chip, span.node-chip");
      if (!chip) { return; }
      var href = chip.getAttribute("href") || "";
      var id = href.indexOf("#") !== -1 ? decodeURIComponent(href.split("#")[1]) : norm(chip.textContent);
      var text = norm(li.textContent);
      var name = norm(chip.textContent);
      var note = text.replace(name, "");
      note = note.replace(/^[\s：:，,（(]*(界面显示名[^）)]*)[）)]?/, "");
      note = note.replace(/^[\s：:，,]+/, "").replace(/[。；;]$/, "");
      var mult = "";
      var mm = text.match(/×\s*(\d+)/);
      if (mm) { mult = "×" + mm[1]; note = note.replace(/×\s*\d+/g, "").trim(); }
      items.push({ id: id, name: name, note: note, mult: mult, official: norm(chip.getAttribute("title")) });
    });
    return items;
  }

  function collectChains(section) {
    var out = [];
    $$("ol.prose, ul.prose", section).forEach(function (list) {
      var items = parseItems(list);
      if (items.length < 2) { return; }
      var prev = list.previousElementSibling;
      var isHead = prev && /^H[2-5]$/.test(prev.tagName);
      var label = isHead ? norm(prev.textContent) : "";
      if (label.indexOf("节点链路") !== -1) { label = ""; }
      out.push({ list: list, head: isHead ? prev : null, label: label, items: items });
    });
    return out;
  }

  /* ---------- 详情浮层 ---------- */
  var pop = null, popBody = null, popTitle = null, lastFocus = null;
  function ensurePop() {
    if (pop) { return pop; }
    pop = mk("aside", "wf-pop");
    pop.setAttribute("hidden", "");
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-modal", "false");
    pop.setAttribute("aria-label", "节点说明");
    var head = mk("div", "wf-pop-head");
    popTitle = mk("h3", "wf-pop-title", "节点");
    head.appendChild(popTitle);
    var close = mk("button", "wf-icon-btn", "×");
    close.type = "button";
    close.setAttribute("aria-label", "关闭节点说明");
    close.addEventListener("click", hidePop);
    head.appendChild(close);
    pop.appendChild(head);
    popBody = mk("div", "wf-pop-body");
    pop.appendChild(popBody);
    document.body.appendChild(pop);
    document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") { hidePop(); } });
    document.addEventListener("mousedown", function (ev) {
      if (pop.hasAttribute("hidden")) { return; }
      if (pop.contains(ev.target)) { return; }
      if (ev.target.closest && ev.target.closest(".wf-node")) { return; }
      hidePop();
    });
    return pop;
  }
  function hidePop() {
    if (!pop) { return; }
    pop.setAttribute("hidden", "");
    $$(".wf-node-active").forEach(function (n) { n.classList.remove("wf-node-active"); });
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }
  function row(label, value, cls) {
    var d = mk("div", "wf-pop-row" + (cls ? " " + cls : ""));
    d.appendChild(mk("span", "wf-pop-label", label));
    d.appendChild(mk("span", "wf-pop-value", value));
    return d;
  }
  function showPop(data, btn) {
    ensurePop();
    lastFocus = btn || null;
    $$(".wf-node-active").forEach(function (n) { n.classList.remove("wf-node-active"); });
    if (btn) { btn.classList.add("wf-node-active"); }
    popTitle.textContent = data.name;
    popBody.textContent = "";

    var badges = mk("div", "tag-row");
    var pk = mk("span", "badge wf-badge-" + data.pack.kind, data.pack.kind === "core" ? "core 核心节点" : data.pack.kind === "api" ? "api 云节点" : data.pack.kind === "doc" ? "未安装（文档收录）" : "自定义包：" + data.pack.label);
    badges.appendChild(pk);
    badges.appendChild(mk("span", "badge " + (data.pack.installed ? "badge-zh" : "badge-warn"), data.pack.installed ? "已收录" : "未收录"));
    if (data.mult) { badges.appendChild(mk("span", "badge", "本流程使用 " + data.mult)); }
    popBody.appendChild(badges);

    if (data.note) { popBody.appendChild(row("在本流程中的角色", data.note)); }

    var official = "";
    if (data.pack.node) {
      var C = cw();
      official = (data.pack.node.summaryZh || "") || (data.pack.node.summaryEn || "");
      if (C && C.displayText) { official = C.displayText(official); }
    } else if (data.official) { official = data.official; }
    popBody.appendChild(row("官方用途", official || "官方文档未提供", "wf-pop-official"));

    if (data.pack.node) {
      var n = data.pack.node;
      var ins = (n.inputs && n.inputs.required ? n.inputs.required.length : 0) + (n.inputs && n.inputs.optional ? n.inputs.optional.length : 0);
      var outs = (n.outputs || []).length;
      popBody.appendChild(row("输入 / 输出", ins + " 个输入端口 · " + outs + " 个输出端口"));
      if (n.categoryPath && n.categoryPath.length) { popBody.appendChild(row("分类", n.categoryPath.join(" / "))); }
    }

    var links = mk("div", "wf-pop-actions");
    var open = mk("a", "btn btn-primary", "在节点百科中打开");
    open.setAttribute("href", "nodes.html#" + encodeURIComponent(data.id));
    links.appendChild(open);
    var copy = mk("button", "btn", "复制节点名");
    copy.type = "button";
    copy.addEventListener("click", function () {
      try { if (navigator.clipboard) { navigator.clipboard.writeText(data.id); } } catch (e) {}
      copy.textContent = "已复制：" + data.id;
    });
    links.appendChild(copy);
    popBody.appendChild(links);

    pop.removeAttribute("hidden");
  }

  /* ---------- 生成一条链路图 ---------- */
  function buildGraph(section, chain, index, chainLabel) {
    var wrap = mk("figure", "wf-graph");
    wrap.setAttribute("data-wf", (section.id || "wf") + "-" + index);

    var bar = mk("div", "wf-bar");
    var title = mk("p", "wf-bar-title", (chainLabel ? chainLabel + " · " : "") + "节点链路（点节点看说明）");
    bar.appendChild(title);
    var tools = mk("div", "wf-bar-tools");
    var tour = mk("button", "btn wf-tour", "▶ 依次讲解");
    tour.type = "button";
    tools.appendChild(tour);
    var toggle = mk("button", "btn wf-text-toggle", "文字版链路");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    tools.appendChild(toggle);
    bar.appendChild(tools);
    wrap.appendChild(bar);

    var caption = mk("p", "wf-caption", "");
    caption.setAttribute("role", "status");
    caption.setAttribute("aria-live", "polite");

    var scroller = mk("div", "wf-scroll");
    var chainEl = mk("div", "wf-chain");
    chainEl.setAttribute("role", "group");
    chainEl.setAttribute("aria-label", "节点链路（箭头表示数据流方向）");
    scroller.appendChild(chainEl);
    wrap.appendChild(scroller);
    wrap.appendChild(caption);

    var buttons = [];
    chain.items.forEach(function (item, i) {
      var pk = packKind(item.id);
      var btn = mk("button", "wf-node");
      btn.type = "button";
      btn.setAttribute("data-node-id", item.id);
      btn.setAttribute("data-pack", pk.kind);
      btn.setAttribute("data-idx", String(i));
      btn.setAttribute("aria-label", item.name + "，第 " + (i + 1) + " 步，点击查看说明");

      var top = mk("span", "wf-node-top");
      top.appendChild(mk("span", "wf-node-idx", String(i + 1)));
      top.appendChild(mk("span", "wf-node-name", item.name));
      if (item.mult) { top.appendChild(mk("span", "wf-node-mult", item.mult)); }
      btn.appendChild(top);
      btn.appendChild(mk("span", "wf-node-role", item.note || "（见官方文档）"));

      var meta = mk("span", "wf-node-meta");
      meta.appendChild(mk("span", "wf-dot wf-dot-" + pk.kind, pk.kind === "core" ? "core" : pk.kind === "api" ? "api" : pk.kind === "doc" ? "文档" : "自定义"));
      meta.appendChild(mk("span", "wf-node-step", "第 " + (i + 1) + " / " + chain.items.length + " 步"));
      btn.appendChild(meta);

      btn.addEventListener("click", function () {
        showPop({ id: item.id, name: item.name, note: item.note, mult: item.mult, official: item.official, pack: pk }, btn);
      });
      btn.addEventListener("keydown", function (ev) {
        if (ev.key === "ArrowRight" && buttons[i + 1]) { ev.preventDefault(); buttons[i + 1].focus(); }
        if (ev.key === "ArrowLeft" && buttons[i - 1]) { ev.preventDefault(); buttons[i - 1].focus(); }
      });
      buttons.push(btn);
      chainEl.appendChild(btn);
      if (i < chain.items.length - 1) {
        var link = mk("span", "wf-link");
        link.setAttribute("aria-hidden", "true");
        chainEl.appendChild(link);
      }
    });

    /* 文字版：保留原 ol，折叠 */
    var details = mk("details", "wf-text");
    details.appendChild(mk("summary", null, "文字版链路（原有序号列表）"));
    (chain.head || chain.list).parentNode.insertBefore(details, chain.head || chain.list);
    if (chain.head) { details.appendChild(chain.head); }
    details.appendChild(chain.list);
    toggle.addEventListener("click", function () {
      var open = !details.hasAttribute("open");
      if (open) { details.setAttribute("open", ""); } else { details.removeAttribute("open"); }
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.textContent = open ? "收起文字版" : "文字版链路";
    });

    /* 依次讲解 */
    var timer = null;
    function stopTour() {
      if (timer) { window.clearInterval(timer); timer = null; }
      tour.textContent = "▶ 依次讲解";
      $$(".wf-node-touring", wrap).forEach(function (n) { n.classList.remove("wf-node-touring"); });
    }
    tour.addEventListener("click", function () {
      if (timer) { stopTour(); caption.textContent = ""; return; }
      var i = 0;
      tour.textContent = "■ 停止讲解";
      timer = window.setInterval(function () {
        $$(".wf-node-touring", wrap).forEach(function (n) { n.classList.remove("wf-node-touring"); });
        if (i >= buttons.length) { stopTour(); caption.textContent = "讲解结束：共 " + buttons.length + " 步。"; return; }
        var b = buttons[i];
        b.classList.add("wf-node-touring");
        var item = chain.items[i];
        caption.textContent = "第 " + (i + 1) + " 步 · " + item.name + "：" + (item.note || item.official || "");
        try { b.scrollIntoView({ block: "nearest", inline: "center" }); } catch (e) {}
        i++;
      }, 1500);
    });

    return wrap;
  }

  /* ---------- 折叠页面上其余重文本块 ---------- */
  function foldBlock(headEl, title, section, open) {
    if (!headEl) { return; }
    var d = mk("details", "wf-fold" + (open ? " wf-fold-open" : ""));
    if (open) { d.setAttribute("open", ""); }
    var body = [];
    var n = headEl.nextElementSibling;
    while (n && n.tagName !== "H2" && n.tagName !== "H3" && !(n.classList && n.classList.contains("card-title"))) {
      body.push(n);
      n = n.nextElementSibling;
    }
    var sum = mk("summary", null, title);
    d.appendChild(sum);
    headEl.parentNode.insertBefore(d, headEl);
    d.appendChild(headEl);
    body.forEach(function (b) { d.appendChild(b); });
  }

  function enhanceSection(section, index) {
    var chains = collectChains(section);
    if (!chains.length) { return []; }
    var built = [];
    var multi = chains.length > 1;
    chains.forEach(function (chain, ci) {
      var label = multi ? (chain.label || "") : "";
      var graph = buildGraph(section, chain, index + "-" + ci, label);
      var anchor = chain.head || chain.list;
      anchor.parentNode.insertBefore(graph, anchor);
      built.push(graph);
    });
    var h3s = $$("h3", section);
    h3s.forEach(function (h) {
      var txt = norm(h.textContent);
      if (txt.indexOf("关键参数") !== -1) { foldBlock(h, "关键参数建议（点开）", section, false); }
    });
    var src = $(".sources", section);
    if (src) {
      var d2 = mk("details", "wf-fold wf-sources");
      d2.appendChild(mk("summary", null, "本节依据（来源清单）"));
      src.parentNode.insertBefore(d2, src);
      d2.appendChild(src);
    }
    return built;
  }

  function buildToolbar(sections) {
    var host = $(".wf-toolbar");
    if (!host) { return; }
    var expand = mk("button", "btn", "展开全部文字");
    expand.type = "button";
    expand.addEventListener("click", function () {
      $$("details.wf-fold, details.wf-text").forEach(function (d) { d.setAttribute("open", ""); });
      expand.textContent = "已展开全部文字";
      window.setTimeout(function () { expand.textContent = "展开全部文字"; }, 1600);
    });
    host.appendChild(expand);
    var collapse = mk("button", "btn", "只保留链路图");
    collapse.type = "button";
    collapse.addEventListener("click", function () {
      $$("details.wf-fold, details.wf-text").forEach(function (d) { d.removeAttribute("open"); });
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    host.appendChild(collapse);
    var count = mk("span", "muted", "共 " + sections.length + " 条工作流链路图");
    host.appendChild(count);
  }

  function boot() {
    var sections = $$("section.card[id]");
    var built = [];
    sections.forEach(function (s, i) {
      var gs = enhanceSection(s, i);
      if (gs && gs.length) { built = built.concat(gs); }
    });
    if (!built.length) { return; }
    buildToolbar(built);
    window.WF_GRAPH = { version: "1.0.0", chains: built.length };
  }

  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", boot); } else { boot(); }
})();
