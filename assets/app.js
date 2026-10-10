/* ==========================================================================
 * ComfyUI 节点离线百科 — 全站共享脚本  site/assets/app.js
 * 负责人: page-builder (T2)
 *
 * 设计约束（SPEC 第 4/5 节）:
 *  - 完全离线: 不使用 fetch/XHR/import，不加载任何外部资源
 *  - 不使用 HTML 字符串注入式赋值（一律 createElement + textContent）
 *  - 数据缺失（site/assets/nodes-data.js 不存在或未生成）时必须优雅降级
 *  - 导出全局 window.CW（esc / 主题 / 导航高亮 / 渲染工具）
 * ========================================================================== */
(function () {
  "use strict";

  var VERSION = "1.0.0";
  var THEME_KEY = "cw-theme";
  var DOC_HOST = "docs.comfy.org";

  /* ------------------------------------------------------------------ *
   * 1. 基础工具
   * ------------------------------------------------------------------ */

  /** HTML 转义（导出给其它页面拼字符串时使用；内部一律使用 textContent） */
  function esc(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function clear(node) {
    if (!node) return node;
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function append(parent, children) {
    if (children === null || children === undefined || children === false) return parent;
    if (Array.isArray(children)) {
      for (var i = 0; i < children.length; i++) append(parent, children[i]);
      return parent;
    }
    if (children instanceof Node) { parent.appendChild(children); return parent; }
    parent.appendChild(document.createTextNode(String(children)));
    return parent;
  }

  /**
   * 安全创建元素。
   * el("div", { class: "card", text: value, dataset: {id: x}, onclick: fn }, [child])
   * 说明: 只有 text 会写入文本，任何字段都不会作为 HTML 解析。
   */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var key in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, key)) continue;
        var value = attrs[key];
        if (value === null || value === undefined || value === false) continue;
        if (key === "text") node.textContent = String(value);
        else if (key === "class") node.className = String(value);
        else if (key === "dataset") {
          for (var dk in value) {
            if (Object.prototype.hasOwnProperty.call(value, dk)) node.dataset[dk] = String(value[dk]);
          }
        } else if (key === "style") {
          for (var sk in value) {
            if (Object.prototype.hasOwnProperty.call(value, sk)) node.style.setProperty(sk, String(value[sk]));
          }
        } else if (key.indexOf("on") === 0 && typeof value === "function") {
          node.addEventListener(key.slice(2), value);
        } else if (value === true) {
          node.setAttribute(key, "");
        } else {
          node.setAttribute(key, String(value));
        }
      }
    }
    append(node, children);
    return node;
  }

  function str(value) {
    if (value === null || value === undefined) return "";
    return String(value);
  }

  /** 统一的搜索归一化：小写、去首尾空白、压缩空白 */
  function norm(value) {
    return str(value).toLowerCase().replace(/\s+/g, " ").trim();
  }

  function fmtInt(n) {
    var v = Number(n);
    if (!isFinite(v)) return "—";
    return v.toLocaleString("zh-CN");
  }

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments, self = this;
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { timer = null; fn.apply(self, args); }, wait || 150);
    };
  }

  /**
   * 文本规范化（载入后一次性执行，见 normalizeCatalog）。
   *
   * 数据来源分流的唯一判据是 node.docPage：
   *  - docPage 非空 → 文本来自 ComfyUI 官方文档，尖括号占位标记（bbox / Video k / task_id 等）
   *    属官方原文，必须逐字保留（SPEC §5.1），只把 br 标记转成换行；
   *  - docPage 为空 → 文本来自节点数据集 的富文本 description（多为自定义节点），
   *    需剥掉全部 HTML 标签并压缩空白。
   * 无论哪种情况，写入 DOM 一律走 textContent，不存在注入风险。
   */
  // 标签判定（与 catalog-builder 规格一致）：必须紧跟字母开头的标签名，避免误伤 "< 3" 这类正文
  var HTML_TAG_RE = /<\/?[A-Za-z][A-Za-z0-9]*(?:\s[^<>]*)?\/?>/g;

  function normalizeOfficialText(value) {
    return str(value).replace(/\r\n?/g, "\n").replace(/<br\s*\/?>/gi, "\n").trim();
  }

  function normalizeRichText(value) {
    return str(value)
      .replace(/\r\n?/g, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(HTML_TAG_RE, " ")
      .replace(/[ \t\u00a0]+/g, " ")
      .replace(/ ?\n ?/g, "\n")
      .replace(/\n{2,}/g, "\n")
      .trim();
  }

  function normalizeTextValue(value, keepOfficialMarkup) {
    return keepOfficialMarkup ? normalizeOfficialText(value) : normalizeRichText(value);
  }

  /** 渲染前的最后一道显示层处理（规范化之后通常只剩 trim 与压缩多余空行） */
  function displayText(value) {
    return str(value).replace(/<br\s*\/?>/gi, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function normalizePortArray(list, keepOfficialMarkup) {
    if (!Array.isArray(list)) return;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p || typeof p !== "object") continue;
      if (typeof p.desc === "string") p.desc = normalizeTextValue(p.desc, keepOfficialMarkup);
      if (typeof p.tooltip === "string") p.tooltip = normalizeTextValue(p.tooltip, keepOfficialMarkup);
      if (typeof p.description === "string") p.description = normalizeTextValue(p.description, keepOfficialMarkup);
    }
  }

  var catalogNormalized = false;

  /**
   * 载入后一次性规范化（不是每次渲染才处理）：
   * 直接在内存中的节点对象上就地规范化文本字段，并失效已建的搜索字段缓存，
   * 使后续渲染与搜索索引都基于干净文本。磁盘上的 nodes-data.js 完全不动。
   */
  function normalizeCatalog() {
    if (catalogNormalized) return;
    catalogNormalized = true;
    var d = getData();
    if (!d || !Array.isArray(d.nodes)) return;
    for (var i = 0; i < d.nodes.length; i++) {
      var n = d.nodes[i];
      if (!n || typeof n !== "object") continue;
      var keep = !!str(n.docPage); // 官方文档节点保留尖括号占位符
      n.summaryZh = normalizeTextValue(n.summaryZh, keep);
      n.descZh = normalizeTextValue(n.descZh, keep);
      n.summaryEn = normalizeTextValue(n.summaryEn, keep);
      n.descEn = normalizeTextValue(n.descEn, keep);
      if (n.inputs) {
        normalizePortArray(n.inputs.required, keep);
        normalizePortArray(n.inputs.optional, keep);
      }
      if (n.localInputs) {
        normalizePortArray(n.localInputs.required, keep);
        normalizePortArray(n.localInputs.optional, keep);
      }
      normalizePortArray(n.outputs, keep);
      normalizePortArray(n.localOutputs, keep);
      try { delete n.__cwFields; } catch (e) { /* ignore */ }
    }
  }

  function truncate(text, max) {
    var s = str(text);
    if (s.length <= max) return s;
    return s.slice(0, Math.max(0, max - 1)) + "…";
  }

  /** 屏幕阅读器播报（aria-live） */
  var liveRegion = null;
  function announce(message) {
    if (!liveRegion) {
      liveRegion = el("p", { class: "visually-hidden sr-status", role: "status", "aria-live": "polite" });
      document.body.appendChild(liveRegion);
    }
    liveRegion.textContent = "";
    window.setTimeout(function () { liveRegion.textContent = str(message); }, 30);
  }

  /* ------------------------------------------------------------------ *
   * 2. 主题（浅色 / 深色 / 跟随系统）
   * ------------------------------------------------------------------ */
  var memPref = null; // localStorage 不可用时（部分浏览器的 file:// 场景）的兜底

  function systemPrefersDark() {
    try {
      return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    } catch (e) { return false; }
  }

  var theme = {
    read: function () {
      try {
        var v = window.localStorage.getItem(THEME_KEY);
        if (v === "light" || v === "dark") return v;
      } catch (e) { /* file:// 下 localStorage 可能被禁用 */ }
      return memPref || "auto";
    },
    resolved: function () {
      var pref = theme.read();
      if (pref !== "auto") return pref;
      return systemPrefersDark() ? "dark" : "light";
    },
    apply: function (pref) {
      var root = document.documentElement;
      var value = (pref === "light" || pref === "dark") ? pref : theme.read();
      if (value === "auto") root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", value);
      // 按钮状态与实际生效主题保持一致（不二次读取存储，避免 file:// 下读写不一致）
      var isDark = (value === "auto" ? (systemPrefersDark() ? "dark" : "light") : value) === "dark";
      qsa("[data-theme-toggle]").forEach(function (btn) {
        btn.setAttribute("aria-pressed", isDark ? "true" : "false");
        btn.textContent = isDark ? "浅色模式" : "深色模式";
        btn.setAttribute("title", isDark ? "切换到浅色模式" : "切换到深色模式");
      });
      return isDark;
    },
    set: function (pref) {
      memPref = (pref === "light" || pref === "dark") ? pref : null;
      try { window.localStorage.setItem(THEME_KEY, pref); } catch (e) { /* ignore */ }
      return theme.apply(pref);
    },
    toggle: function () {
      return theme.set(theme.resolved() === "dark" ? "light" : "dark");
    },
    init: function () {
      theme.apply(theme.read());
      qsa("[data-theme-toggle]").forEach(function (btn) {
        btn.addEventListener("click", function () { theme.toggle(); });
      });
      try {
        if (window.matchMedia) {
          var mq = window.matchMedia("(prefers-color-scheme: dark)");
          var onChange = function () { if (theme.read() === "auto") theme.apply("auto"); };
          if (mq.addEventListener) mq.addEventListener("change", onChange);
          else if (mq.addListener) mq.addListener(onChange);
        }
      } catch (e) { /* ignore */ }
    }
  };

  /* ------------------------------------------------------------------ *
   * 3. 导航高亮
   * ------------------------------------------------------------------ */
  function currentFile() {
    var path = window.location.pathname || "";
    var parts = path.split("/");
    var file = parts[parts.length - 1];
    if (!file) file = "index.html";
    return file.toLowerCase();
  }

  function initNav() {
    var file = currentFile();
    qsa(".site-nav a[href]").forEach(function (a) {
      var href = str(a.getAttribute("href")).split("#")[0].split("?")[0].toLowerCase();
      if (!href) return;
      if (href === file || (file === "index.html" && href === "index.html")) {
        a.setAttribute("aria-current", "page");
      } else {
        a.removeAttribute("aria-current");
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * 4. 数据访问（防御 COMFY_DATA 缺失 / 半成品）
   * ------------------------------------------------------------------ */
  function getData() {
    var d = window.COMFY_DATA;
    return (d && typeof d === "object") ? d : null;
  }
  function getMeta() {
    var d = getData();
    var m = d && d.meta && typeof d.meta === "object" ? d.meta : {};
    return m;
  }
  function getNodes() {
    var d = getData();
    if (!d || !Array.isArray(d.nodes)) return [];
    normalizeCatalog(); // 载入后一次性文本规范化（幂等）
    return d.nodes.filter(function (n) { return n && typeof n === "object"; });
  }
  function dataAvailable() {
    return getNodes().length > 0;
  }

  function nodeId(node) {
    if (!node) return "";
    return str(node.id || node.nodeClass || node.name || "");
  }
  function nodeDisplayName(node) {
    if (!node) return "";
    return str(node.displayName || node.id || node.nodeClass || "");
  }
  function categoryPath(node) {
    if (!node) return [];
    if (Array.isArray(node.categoryPath)) return node.categoryPath.map(str).filter(Boolean);
    if (Array.isArray(node.categoryIds)) return node.categoryIds.map(str).filter(Boolean);
    return [];
  }
  function isInstalled(node) { return !!(node && node.installed === true); }
  function isDocNode(node) {
    if (!node) return false;
    if (node.docPage) return true;
    var urls = Array.isArray(node.sourceUrls) ? node.sourceUrls : [];
    for (var i = 0; i < urls.length; i++) {
      if (str(urls[i]).indexOf(DOC_HOST) !== -1) return true;
    }
    return false;
  }
  function packOf(node) {
    if (!node) return "";
    return str(node.pack || "");
  }
  // 约定（catalog-builder）：titleZh 恒为空；判定"是否有官方中文"只看中文正文
  // summaryZh/descZh 是否为空字符串。lang === "zh" 仅表示存在可用的中文页面。
  function hasZh(node) {
    if (!node) return false;
    return !!(str(node.summaryZh) || str(node.descZh));
  }

  function collectPortText(group, out) {
    if (!Array.isArray(group)) return;
    for (var i = 0; i < group.length; i++) {
      var p = group[i];
      if (!p || typeof p !== "object") continue;
      out.push(str(p.name), str(p.type), str(p.desc || p.tooltip || p.description));
      if (Array.isArray(p.options)) out.push(p.options.slice(0, 40).join(" "));
    }
  }

  /**
   * 搜索字段分组（按匹配优先级从高到低）：
   *   name 节点名/显示名 > keys 关键词与别名与分类 > text 官方说明 > io 输入输出参数
   * 惰性构建并按节点缓存，避免首屏开销。
   */
  function nodeFields(node) {
    if (node.__cwFields) return node.__cwFields;
    var ioParts = [];
    if (node.localInputs) {
      collectPortText(node.localInputs.required, ioParts);
      collectPortText(node.localInputs.optional, ioParts);
    }
    if (node.inputs && node.inputs !== null) {
      collectPortText(node.inputs.required, ioParts);
      collectPortText(node.inputs.optional, ioParts);
    }
    collectPortText(node.localOutputs, ioParts);
    collectPortText(node.outputs, ioParts);
    var fields = {
      name: norm([nodeId(node), nodeDisplayName(node), node.titleZh, node.titleEn, node.docPage, node.nodeClass].join(" ")),
      keys: norm([
        Array.isArray(node.searchKeys) ? node.searchKeys.join(" ") : "",
        Array.isArray(node.searchAliases) ? node.searchAliases.join(" ") : "",
        packOf(node), node.pythonModule, node.python_module,
        categoryPath(node).join(" ")
      ].join(" ")),
      text: norm([node.summaryZh, node.descZh, node.summaryEn, node.descEn].join(" ")),
      io: norm(ioParts.join(" "))
    };
    try { Object.defineProperty(node, "__cwFields", { value: fields, enumerable: false }); }
    catch (e) { /* ignore */ }
    return fields;
  }

  function nodeSearchText(node) {
    var f = nodeFields(node);
    return f.name + " " + f.keys + " " + f.text + " " + f.io;
  }

  /**
   * 全部关键词都命中才返回分数（越小越相关）；未命中返回 null。
   * 节点名完全相等 -100、名称前缀 -50，再按 名称 > 关键词 > 说明 > 输入输出参数 加权。
   * 注意：不能用负数当"未命中"哨兵，否则会与"强相关"分数冲突。
   */
  function searchScore(node, tokens) {
    var f = nodeFields(node);
    var idLower = nodeId(node).toLowerCase();
    var nameLower = nodeDisplayName(node).toLowerCase();
    var total = 0;
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (!t) continue;
      if (idLower === t || nameLower === t) total -= 100;
      else if (idLower.indexOf(t) === 0 || nameLower.indexOf(t) === 0) total -= 50;
      else if (f.name.indexOf(t) !== -1) total += 0;
      else if (f.keys.indexOf(t) !== -1) total += 1;
      else if (f.text.indexOf(t) !== -1) total += 2;
      else if (f.io.indexOf(t) !== -1) total += 3;
      else return null;
    }
    return total;
  }

  /** 非搜索状态下的排序方式（搜索时作为同分次序）；mode 由调用方传入，避免依赖页面局部状态 */
  function compareNodes(a, b, mode) {
    if (mode === "core") {
      var ac = packOf(a) === "core" ? 0 : 1;
      var bc = packOf(b) === "core" ? 0 : 1;
      if (ac !== bc) return ac - bc;
    } else if (mode === "installed") {
      var ai = isInstalled(a) ? 0 : 1;
      var bi = isInstalled(b) ? 0 : 1;
      if (ai !== bi) return ai - bi;
    }
    return nodeId(a).localeCompare(nodeId(b));
  }

  function findNodeById(id) {
    var key = str(id);
    if (!key) return null;
    var nodes = getNodes();
    for (var i = 0; i < nodes.length; i++) {
      if (nodeId(nodes[i]) === key || str(nodes[i].nodeClass) === key) return nodes[i];
    }
    var lower = key.toLowerCase();
    for (var j = 0; j < nodes.length; j++) {
      var n = nodes[j];
      if (nodeId(n).toLowerCase() === lower || nodeDisplayName(n).toLowerCase() === lower) return n;
    }
    return null;
  }

  /* ------------------------------------------------------------------ *
   * 5. 通用渲染片段
   * ------------------------------------------------------------------ */

  var PACK_LABELS = {
    core: "core 核心节点",
    api: "api 云节点",
    "docs-only": "仅官方文档收录",
    "doc-only": "仅官方文档收录"
  };

  function packBadge(node) {
    var pack = packOf(node);
    if (!pack) {
      return el("span", { class: "badge", text: isInstalled(node) ? "数据集节点" : "官方文档" });
    }
    var label = PACK_LABELS[pack] || pack;
    return el("span", { class: "badge", text: label, title: "来源包：" + pack });
  }

  function flagsBadges(node) {
    var badges = [];
    var flags = node && node.flags && typeof node.flags === "object" ? node.flags : {};
    if (flags.experimental) badges.push(el("span", { class: "badge badge-warn", text: "实验性" }));
    if (flags.deprecated) badges.push(el("span", { class: "badge badge-warn", text: "已弃用" }));
    if (flags.api) badges.push(el("span", { class: "badge", text: "API 节点" }));
    if (flags.outputNode || node.isOutputNode === true || node.output_node === true) {
      badges.push(el("span", { class: "badge", text: "输出节点" }));
    }
    if (hasZh(node)) badges.push(el("span", { class: "badge badge-zh", text: "官方中文" }));
    else badges.push(el("span", { class: "badge badge-en", text: "官方暂无中文" }));
    return badges;
  }

  function installBadge(node) {
    if (isInstalled(node)) {
      return el("span", { class: "badge badge-zh", text: "已收录", title: "出现在公开节点数据集 节点数据集 导出中" });
    }
    if (isDocNode(node)) {
      return el("span", { class: "badge badge-warn", text: "未收录（文档库）", title: "官方文档收录，但节点数据集 中没有该节点" });
    }
    return el("span", { class: "badge", text: "来源未知" });
  }

  function externalLink(url, label, extraText) {
    var link = el("a", {
      href: str(url),
      target: "_blank",
      rel: "noopener noreferrer",
      text: label || str(url)
    });
    var frag = document.createDocumentFragment();
    frag.appendChild(link);
    if (extraText) frag.appendChild(el("span", { class: "badge badge-warn", text: extraText }));
    return frag;
  }

  function notProvided() {
    return el("span", { class: "muted", text: "官方文档未提供" });
  }

  function summaryOf(node) {
    var zh = displayText(node.summaryZh || node.descZh);
    if (zh) return zh;
    var en = displayText(node.summaryEn || node.descEn);
    if (en) return en;
    return "";
  }

  /* ------------------------------------------------------------------ *
   * 6. 首页：统计
   * ------------------------------------------------------------------ */
  function initHome() {
    var box = qs("#home-stats");
    if (!box) return;
    clear(box);

    if (!dataAvailable()) {
      box.appendChild(el("div", { class: "callout callout-warn" }, [
        el("p", { text: "尚未检测到节点数据（site/assets/nodes-data.js）。" }),
        el("p", {
          class: "muted",
          text: "请先运行构建脚本 scripts/build_catalog.py 生成数据文件，然后重新打开本页面。"
        })
      ]));
      return;
    }

    var nodes = getNodes();
    var meta = getMeta();
    var local = meta.localEnv && typeof meta.localEnv === "object" ? meta.localEnv : {};
    var installed = nodes.filter(isInstalled).length;
    var docCount = nodes.filter(isDocNode).length;
    var zhCount = nodes.filter(hasZh).length;
    var packs = {};
    nodes.forEach(function (n) {
      if (!isInstalled(n)) return;
      var p = packOf(n) || "unknown";
      if (p === "core" || p === "api") return;
      packs[p] = (packs[p] || 0) + 1;
    });
    var customPackCount = Object.keys(packs).length;

    var stats = [
      { value: Number(local.nodeCount) || installed || nodes.length, label: "节点总数（S6 节点数据集）" },
      { value: customPackCount, label: "第三方节点包数量" },
      { value: docCount, label: "官方文档收录节点数（S1/S2/S3）" },
      { value: nodes.length, label: "本站词条总数（S6 ∪ 官方文档）" },
      { value: zhCount, label: "含官方中文说明的词条数" }
    ];
    stats.forEach(function (s) {
      box.appendChild(el("div", { class: "stat-item" }, [
        el("div", { class: "stat-value", text: fmtInt(s.value) }),
        el("div", { class: "stat-label", text: s.label })
      ]));
    });

    var metaLine = qs("#home-meta");
    if (metaLine) {
      clear(metaLine);
      var captured = local.capturedAt ? str(local.capturedAt) : "未知";
      append(metaLine, "数据生成时间：" + str(meta.generatedAt || "未知") +
        "；数据集生成时间：" + captured + "。");
    }

    var packList = qs("#home-packs");
    if (packList) {
      clear(packList);
      var names = Object.keys(packs).sort(function (a, b) { return packs[b] - packs[a] || a.localeCompare(b); });
      if (!names.length) {
        packList.appendChild(el("p", { class: "muted", text: "未检测到自定义节点包。" }));
      } else {
        packList.appendChild(el("p", { class: "muted", text: "按节点数排序（最多列出 12 个）：" }));
        var row = el("div", { class: "tag-row" });
        names.slice(0, 12).forEach(function (name) {
          row.appendChild(el("span", { class: "badge", text: name + " (" + packs[name] + ")" }));
        });
        packList.appendChild(row);
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * 7. 节点百科页
   * ------------------------------------------------------------------ */
  function initNodes() {
    var app = qs("#nodes-app");
    if (!app) return;

    var els = {
      treeHost: qs("#category-tree"),
      treeAll: qs("#tree-all"),
      treeInstalled: qs("#tree-installed"),
      cards: qs("#node-cards"),
      count: qs("#result-count"),
      input: qs("#node-search"),
      clearSearch: qs("#clear-search"),
      docOnly: qs("#filter-doc-only"),
      reset: qs("#filter-reset"),
      more: qs("#load-more"),
      moreWrap: qs("#load-more-wrap"),
      sort: qs("#sort-mode"),
      detail: qs("#node-detail"),
      hint: qs("#nodes-hint")
    };

    var nodes = getNodes();
    var state = {
      query: "",
      category: [],
      installedOnly: false,
      docOnly: false,
      selectedId: "",
      sort: "name",
      visibleLimit: 60
    };
    var PAGE_SIZE = 60;

    /* ---- 数据缺失降级 ---- */
    if (!nodes.length) {
      if (els.cards) {
        clear(els.cards);
        els.cards.appendChild(el("div", { class: "callout callout-warn" }, [
          el("p", { text: "未检测到节点数据：site/assets/nodes-data.js 不存在或内容为空。" }),
          el("p", { class: "muted", text: "请先运行 scripts/build_catalog.py 生成数据，然后刷新本页面。本页面其余功能（分类树、搜索）在数据就绪后会自动启用。" })
        ]));
      }
      if (els.count) els.count.textContent = "节点数据未就绪（0 条）";
      if (els.detail) renderDetail(null);
      return;
    }

    /* ---- 分类树 ---- */
    function buildTree() {
      var root = { name: "", path: [], children: {}, count: 0, direct: 0 };
      nodes.forEach(function (n) {
        var path = categoryPath(n);
        if (!path.length) path = ["未分类"];
        var cur = root;
        cur.count++;
        for (var i = 0; i < path.length; i++) {
          var name = path[i];
          if (!cur.children[name]) {
            cur.children[name] = { name: name, path: path.slice(0, i + 1), children: {}, count: 0, direct: 0 };
          }
          cur = cur.children[name];
          cur.count++;
        }
        cur.direct++;
        if (isInstalled(n)) cur.installed = (cur.installed || 0) + 1;
        else cur.installed = cur.installed || 0;
      });
      return root;
    }

    function treeList(node) {
      var names = Object.keys(node.children).sort(function (a, b) {
        return a.localeCompare(b, "zh-Hans-CN");
      });
      return names.map(function (n) { return node.children[n]; });
    }

    function renderTree() {
      if (!els.treeHost) return;
      clear(els.treeHost);
      var root = buildTree();
      var leafByPath = {};
      (function walk(node) {
        leafByPath[node.path.join("/")] = node;
        treeList(node).forEach(walk);
      })(root);

      var list = el("ul", { class: "tree", role: "tree", "aria-label": "节点分类" });

      function makeItem(label, count, path, opts) {
        opts = opts || {};
        var li = el("li");
        var item = el("button", {
          type: "button",
          class: "tree-item" + (opts.active ? " tree-item-active" : ""),
          "data-path": path,
          "aria-pressed": opts.active ? "true" : "false",
          title: opts.title || label
        }, [
          el("span", { class: "tree-label", text: label }),
          el("span", { class: "tree-count", text: fmtInt(count) })
        ]);
        li.appendChild(item);
        return { li: li, item: item };
      }

      // 顶层固定项：全部 / 已收录
      var all = makeItem("全部节点", root.count, "", { active: !state.category.length && !state.installedOnly, title: "清除分类过滤" });
      all.item.addEventListener("click", function () {
        state.category = [];
        state.installedOnly = false;
        update();
      });
      list.appendChild(all.li);

      var installCount = nodes.filter(isInstalled).length;
      var inst = makeItem("已收录", installCount, "\u0000installed", {
        active: state.installedOnly,
        title: "只显示公开节点数据集 节点数据集 中存在的节点"
      });
      inst.item.addEventListener("click", function () {
        state.installedOnly = !state.installedOnly;
        update();
      });
      list.appendChild(inst.li);

      // 分类层级
      (function build(container, node) {
        treeList(node).forEach(function (child) {
          var key = child.path.join("/");
          var isActive = state.category.join("/") === key;
          var li = el("li");
          var hasChildren = treeList(child).length > 0;
          var expanded = true;
          var toggle = null;
          if (hasChildren) {
            toggle = el("button", {
              type: "button",
              class: "tree-toggle",
              "aria-expanded": "true",
              "aria-label": "折叠分类 " + key,
              title: "展开 / 折叠"
            });
          }
          var item = el("button", {
            type: "button",
            class: "tree-item" + (isActive ? " tree-item-active" : ""),
            "data-path": key,
            "aria-pressed": isActive ? "true" : "false",
            title: key + "（" + child.count + " 个节点）"
          }, [
            el("span", { class: "tree-label", text: child.name }),
            el("span", { class: "tree-count", text: fmtInt(child.count) })
          ]);
          item.addEventListener("click", function () {
            if (state.category.join("/") === key) state.category = [];
            else state.category = child.path.slice();
            update();
          });

          var sub = null;
          if (hasChildren) {
            sub = el("ul", { class: "tree", role: "group" });
            build(sub, child);
            toggle.addEventListener("click", function (ev) {
              ev.stopPropagation();
              expanded = !expanded;
              toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
              sub.hidden = !expanded;
            });
          }
          if (toggle) li.appendChild(toggle);
          li.appendChild(item);
          if (sub) li.appendChild(sub);
          container.appendChild(li);
        });
      })(list, root);

      els.treeHost.appendChild(list);
    }

    /* ---- 过滤 ---- */
    function matches(node) {
      if (state.installedOnly && !isInstalled(node)) return false;
      if (state.docOnly && !isDocNode(node)) return false;
      if (state.category.length) {
        var path = categoryPath(node).join("/");
        var want = state.category.join("/");
        if (path !== want && path.indexOf(want + "/") !== 0) return false;
      }
      return true;
    }

    function filtered() {
      var out = [];
      var tokens = state.query.length >= 2 ? state.query.split(" ").filter(Boolean) : [];
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (!matches(node)) continue;
        if (tokens.length) {
          var score = searchScore(node, tokens);
          if (score === null) continue;
          out.push({ node: node, score: score });
        } else {
          out.push({ node: node, score: 0 });
        }
      }
      // 相关性优先：节点名命中 > 关键词 > 说明 > 输入输出参数
      // 无关键词时按用户选择的排序方式（默认节点名 A→Z，与数据 id 顺序一致）
      out.sort(function (a, b) {
        return (a.score - b.score) || compareNodes(a.node, b.node, state.sort);
      });
      return out.map(function (item) { return item.node; });
    }

    /* ---- 卡片 ---- */
    function cardFor(node) {
      var id = nodeId(node);
      var active = id === state.selectedId;
      var summary = truncate(summaryOf(node), 260);
      var tags = el("div", { class: "tag-row" }, [installBadge(node), packBadge(node)].concat(flagsBadges(node)));
      var title = el("h3", { class: "card-title" }, [
        el("span", { text: nodeDisplayName(node) }),
        str(node.titleZh) && str(node.titleZh) !== nodeDisplayName(node)
          ? el("span", { class: "muted", text: str(node.titleZh) })
          : null
      ]);
      var children = [title, tags];
      if (summary) children.push(el("p", { class: "node-card-summary", text: summary }));
      children.push(el("div", { class: "node-card-id", text: id || "(无节点名)" }));
      return el("a", {
        class: "card node-card" + (active ? " card-active" : ""),
        href: "#" + encodeURIComponent(id),
        "data-node-id": id,
        "aria-current": active ? "true" : null
      }, children);
    }

    function renderCards() {
      var list = filtered();
      if (els.cards) {
        clear(els.cards);
        if (!list.length) {
          els.cards.appendChild(el("div", { class: "callout" }, [
            el("p", { text: "没有匹配的节点。" }),
            el("p", { class: "muted", text: "可以尝试：缩短关键词、清空分类过滤、或关闭「仅看官方文档收录」。" })
          ]));
        } else {
          var shown = list.slice(0, state.visibleLimit);
          shown.forEach(function (n) { els.cards.appendChild(cardFor(n)); });
        }
      }
      if (els.count) {
        var parts = ["匹配 " + fmtInt(list.length) + " 个节点"];
        if (list.length > state.visibleLimit) parts.push("已显示前 " + fmtInt(state.visibleLimit) + " 个");
        parts.push("数据库共 " + fmtInt(nodes.length) + " 条");
        els.count.textContent = parts.join("，");
      }
      if (els.moreWrap) {
        var rest = list.length - state.visibleLimit;
        els.moreWrap.hidden = rest <= 0;
        if (els.more) els.more.textContent = "显示更多（剩余 " + fmtInt(Math.max(rest, 0)) + " 个）";
      }
      markActiveCard();
    }

    function markActiveCard() {
      qsa(".node-card", els.cards).forEach(function (a) {
        var on = a.getAttribute("data-node-id") === state.selectedId;
        a.classList.toggle("card-active", on);
        if (on) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    }

    /* ---- 详情面板 ---- */
    function fieldRow(label, valueNode) {
      return [el("dt", { text: label }), el("dd", {}, valueNode || notProvided())];
    }

    function portRow(port, required) {
      var name = str(port.name);
      var typeRaw = str(port.type || port.datatype || "");
      // 少数节点的 type 字段用 br 标记分隔同一槽位的多种候选类型（官方与 节点数据集 都会出现），
      // 显示时取第一个作为类型标签，其余列为"还接受"清单，避免把 br 标记当字面文本显示。
      var typeParts = typeRaw.split(/<br\s*\/?>/i).map(function (s) { return s.trim(); }).filter(Boolean);
      var type = typeParts[0] || "";
      var typeAlternatives = typeParts.slice(1);
      var desc = displayText(port.tooltip || port.desc || port.description || "");
      var attrs = [];
      if (typeAlternatives.length) attrs.push("该输入还接受：" + typeAlternatives.join("、"));
      if (port.default !== undefined && port.default !== null && str(port.default) !== "") attrs.push("默认值 " + str(port.default));
      if (port.min !== undefined && port.min !== null) attrs.push("最小 " + str(port.min));
      if (port.max !== undefined && port.max !== null) attrs.push("最大 " + str(port.max));
      if (port.step !== undefined && port.step !== null) attrs.push("步长 " + str(port.step));
      if (port.isList || port.is_list) attrs.push("列表输入");
      var head = [el("span", { class: "port-name", text: name || "(未命名)" })];
      if (type) head.push(document.createTextNode(" "), el("span", { class: "port-type", text: type }));
      head.push(document.createTextNode(" "), el("span", { class: "badge", text: required ? "必选" : "可选" }));
      // 节点数据集 里存在特殊类型：可变数量槽位与运行时动态选项
      if (/AUTOGROW/i.test(typeRaw)) {
        head.push(document.createTextNode(" "), el("span", {
          class: "badge badge-warn", text: "可变数量槽位",
          title: "该输入可接入数量可变的多个上游（AUTOGROW 类型），其描述继承自官方文档的首个槽位"
        }));
      }
      if (/DYNAMICCOMBO/i.test(typeRaw)) {
        head.push(document.createTextNode(" "), el("span", { class: "badge", text: "动态选项" }));
      }
      var children = [el("div", {}, head)];
      if (attrs.length) children.push(el("div", { class: "port-attrs", text: attrs.join(" · ") }));
      children.push(desc ? el("p", { class: "port-desc", text: desc }) : el("p", { class: "port-desc" }, notProvided()));
      var options = Array.isArray(port.options) ? port.options : null;
      if (options && options.length) {
        var shown = options.slice(0, 8).map(str);
        children.push(el("div", {
          class: "port-attrs",
          text: "可选项：" + shown.join(", ") + (options.length > shown.length ? " …（共 " + fmtInt(options.length) + " 项）" : "")
        }));
      }
      return el("li", { class: "port-row" }, children);
    }

    function portList(ports, required) {
      if (!ports || !ports.length) {
        return el("p", { class: "empty" }, notProvided());
      }
      return el("ul", { class: "port-list" }, ports.map(function (p) { return portRow(p || {}, required); }));
    }

    function outputList(ports) {
      if (!ports || !ports.length) return el("p", { class: "empty" }, notProvided());
      return el("ul", { class: "port-list" }, ports.map(function (p, idx) {
        p = p || {};
        var type = str(p.type || p.name || "");
        var head = [
          el("span", { class: "port-name", text: str(p.name || type || ("输出 " + (idx + 1))) })
        ];
        if (type) head.push(document.createTextNode(" "), el("span", { class: "port-type", text: type }));
        if (p.isList) head.push(document.createTextNode(" "), el("span", { class: "badge", text: "列表输出" }));
        if (p.slot !== undefined && p.slot !== null) head.push(document.createTextNode(" "), el("span", { class: "badge", text: "槽位 " + str(p.slot) }));
        var desc = displayText(p.desc || p.tooltip || p.description || "");
        return el("li", { class: "port-row" }, [
          el("div", {}, head),
          desc ? el("p", { class: "port-desc", text: desc }) : el("p", { class: "port-desc" }, notProvided())
        ]);
      }));
    }

    function sourceItem(url) {
      var u = str(url);
      var li = el("li");
      if (/^https?:\/\//i.test(u)) {
        // 只有 http(s) 才是可点击的联网链接
        li.appendChild(externalLink(u, u, "需联网"));
      } else if (/^local:\/\//i.test(u)) {
        // community:// 为构建脚本写入的本地溯源标记，不是可访问地址，渲染为纯文本
        li.appendChild(el("span", { class: "node-chip", text: "第三方来源" }));
        li.appendChild(document.createTextNode(" " + u.replace(/^local:\/\//i, "")));
      } else {
        li.appendChild(el("span", { class: "node-chip", text: "本地来源" }));
        li.appendChild(document.createTextNode(" " + u));
      }
      return li;
    }

    function sourceList(node) {
      var urls = Array.isArray(node.sourceUrls) ? node.sourceUrls.filter(Boolean) : [];
      var box = el("div", { class: "sources" });
      if (!urls.length) {
        box.appendChild(el("p", {}, notProvided()));
        return box;
      }
      var ul = el("ul");
      var hasHttp = false;
      urls.forEach(function (u) {
        if (/^https?:\/\//i.test(str(u))) hasHttp = true;
        ul.appendChild(sourceItem(u));
      });
      box.appendChild(ul);
      box.appendChild(el("p", {
        class: "muted",
        text: hasHttp
          ? "http(s) 链接为官方来源，离线状态下不可打开，需联网查看；community:// 为节点数据集 导出的本地溯源标记，不是网址。"
          : "以上来源为公开节点数据集 节点数据集 导出的本地溯源标记，不是网址。"
      }));
      return box;
    }

    /**
     * 输入端口合并视图：
     *  - 结构（名称/类型/默认值/最小最大值/可选项）取节点数据集（localInputs）
     *  - 参数说明优先取官方文档中文（inputs[].desc），文档缺失时回落到数据集 tooltip
     */
    function mergePorts(node) {
      var local = node.localInputs && typeof node.localInputs === "object" ? node.localInputs : null;
      var docs = node.inputs && typeof node.inputs === "object" ? node.inputs : null;
      function group(key) {
        var l = local && Array.isArray(local[key]) ? local[key] : null;
        var d = docs && Array.isArray(docs[key]) ? docs[key] : null;
        var dmap = {};
        (d || []).forEach(function (p) { if (p && p.name) dmap[p.name] = p; });
        var out = [];
        var used = {};
        (l || []).forEach(function (p) {
          if (!p || !p.name) return;
          used[p.name] = true;
          var dp = dmap[p.name] || {};
          out.push({
            name: p.name,
            type: p.type || dp.type,
            default: p.default !== undefined ? p.default : dp.default,
            min: p.min, max: p.max, step: p.step, options: p.options,
            desc: str(dp.desc) || str(p.tooltip),
            tooltip: str(p.tooltip)
          });
        });
        (d || []).forEach(function (dp) {
          if (dp && dp.name && !used[dp.name]) out.push(dp);
        });
        return out;
      }
      return { required: group("required"), optional: group("optional") };
    }

    function buildTabs(node) {
      var ports = mergePorts(node);
      var required = ports.required;
      var optional = ports.optional;
      var outputs = Array.isArray(node.localOutputs) ? node.localOutputs : (Array.isArray(node.outputs) ? node.outputs : []);
      var hasLocal = !!(node.localInputs && (ports.required.length || ports.optional.length));
      var hasDocsDesc = (function () {
        var list = required.concat(optional);
        for (var i = 0; i < list.length; i++) { if (str(list[i].desc)) return true; }
        return false;
      })();
      var source = hasLocal && hasDocsDesc
        ? "参数与可选项：节点数据集；参数说明：官方文档（中文优先）"
        : (hasLocal ? "节点数据集" : (hasDocsDesc ? "官方文档" : "无"));

      var panels = [
        { id: "required", label: "必选输入 (" + required.length + ")", body: portList(required, true) },
        { id: "optional", label: "可选输入 (" + optional.length + ")", body: portList(optional, false) },
        { id: "outputs", label: "输出 (" + outputs.length + ")", body: outputList(outputs) }
      ];

      var tabs = el("div", { class: "tabs", role: "tablist", "aria-label": "输入输出" });
      var panelsHost = el("div");
      var buttons = [];

      function select(idx, focus) {
        buttons.forEach(function (b, i) {
          var on = i === idx;
          b.setAttribute("aria-selected", on ? "true" : "false");
          b.tabIndex = on ? 0 : -1;
          var panel = document.getElementById(b.getAttribute("aria-controls"));
          if (panel) panel.hidden = !on;
        });
        if (focus && buttons[idx]) buttons[idx].focus();
      }

      panels.forEach(function (p, i) {
        var tabId = "cw-tab-" + p.id;
        var panelId = "cw-panel-" + p.id;
        var btn = el("button", {
          type: "button",
          role: "tab",
          id: tabId,
          "aria-controls": panelId,
          "aria-selected": i === 0 ? "true" : "false",
          tabindex: i === 0 ? "0" : "-1",
          text: p.label
        });
        btn.addEventListener("click", function () { select(i, false); });
        btn.addEventListener("keydown", function (ev) {
          var k = ev.key;
          if (k === "ArrowRight" || k === "ArrowLeft" || k === "Home" || k === "End") {
            ev.preventDefault();
            var next = i;
            if (k === "ArrowRight") next = (i + 1) % panels.length;
            if (k === "ArrowLeft") next = (i - 1 + panels.length) % panels.length;
            if (k === "Home") next = 0;
            if (k === "End") next = panels.length - 1;
            select(next, true);
          }
        });
        buttons.push(btn);
        tabs.appendChild(btn);
        panelsHost.appendChild(el("div", {
          role: "tabpanel",
          id: panelId,
          "aria-labelledby": tabId,
          hidden: i === 0 ? null : true
        }, [p.body]));
      });

      return el("div", {}, [
        el("p", { class: "muted", text: "输入来源：" + source }),
        tabs, panelsHost
      ]);
    }

    function renderDetail(node, missingId) {
      var host = els.detail;
      if (!host) return;
      clear(host);

      if (!node) {
        if (missingId) {
          // 深链指向了本站数据里不存在的节点：给出明确解释，而不是静默空白
          host.appendChild(el("h2", { tabindex: "-1", text: "未找到节点：" + str(missingId) }));
          host.appendChild(el("div", { class: "callout callout-warn" }, [
            el("p", { text: "本站数据中没有名为「" + str(missingId) + "」的节点。" }),
            el("p", { class: "muted", text: "可能的原因：① 该节点来自未收录的自定义节点包；② 链接拼写或大小写有误；③ 该节点未收录进官方文档与 节点数据集 导出。" }),
            el("p", { class: "muted", text: "你可以用左侧分类或搜索框查找同类节点。" })
          ]));
          host.appendChild(el("div", { class: "detail-section" }, [
            el("button", {
              type: "button",
              class: "btn btn-primary",
              text: "回到全部节点",
              onclick: function () {
                state.selectedId = "";
                try { window.history.replaceState(null, "", window.location.pathname + window.location.search); }
                catch (e) { window.location.hash = ""; }
                renderDetail(null);
                markActiveCard();
              }
            })
          ]));
          return;
        }
        host.appendChild(el("h2", { text: "节点详情" }));
        host.appendChild(el("p", { class: "muted", text: nodes.length ? "从左侧列表中选择一个节点，即可查看用途、输入、输出与来源。" : "节点数据未就绪。" }));
        return;
      }

      var id = nodeId(node);
      var name = nodeDisplayName(node);
      var head = el("div", { class: "detail-head" }, [
        el("h2", { tabindex: "-1", text: name || id || "(未命名节点)" }),
        el("div", { class: "tag-row" }, [installBadge(node), packBadge(node)].concat(flagsBadges(node)))
      ]);
      host.appendChild(head);
      if (name && id && name !== id) {
        host.appendChild(el("p", { class: "muted" }, [
          document.createTextNode("真实节点名："),
          el("span", { class: "node-chip", text: id })
        ]));
      }

      // 用途
      var usage = el("div", { class: "detail-section" });
      usage.appendChild(el("h3", { text: "用途" }));
      var zhSummary = displayText(node.summaryZh), zhDesc = displayText(node.descZh);
      var enSummary = displayText(node.summaryEn), enDesc = displayText(node.descEn);
      if (zhSummary || zhDesc) {
        if (zhSummary) usage.appendChild(el("p", { text: zhSummary }));
        if (zhDesc && zhDesc !== zhSummary) usage.appendChild(el("p", { text: zhDesc }));
      } else if (enSummary || enDesc) {
        usage.appendChild(el("p", {}, [el("span", { class: "badge badge-en", text: "官方暂无中文" })]));
        if (enSummary) usage.appendChild(el("p", { text: enSummary }));
        if (enDesc && enDesc !== enSummary) usage.appendChild(el("p", { text: enDesc }));
      } else {
        usage.appendChild(el("p", {}, notProvided()));
      }
      host.appendChild(usage);

      // 输入 / 输出
      var io = el("div", { class: "detail-section" });
      io.appendChild(el("h3", { text: "输入与输出" }));
      io.appendChild(buildTabs(node));
      host.appendChild(io);

      // 关键信息
      var info = el("div", { class: "detail-section" });
      info.appendChild(el("h3", { text: "基本信息" }));
      var pathText = categoryPath(node).join(" / ");
      var dl = el("dl", { class: "kv" });
      append(dl, fieldRow("分类路径", pathText ? el("span", { class: "node-chip", text: pathText }) : null));
      append(dl, fieldRow("来源包", packOf(node) ? el("span", { class: "node-chip", text: packOf(node) }) : null));
      append(dl, fieldRow("Python 模块", str(node.pythonModule || node.python_module) ? el("span", { class: "node-chip", text: str(node.pythonModule || node.python_module) }) : null));
      append(dl, fieldRow("是否数据集安装", isInstalled(node) ? el("span", { class: "badge badge-zh", text: "是" }) : el("span", { class: "badge badge-warn", text: "否" })));
      append(dl, fieldRow("输入数据来源", el("span", { class: "node-chip", text: str(node.inputsSource || (node.localInputs ? "object_info" : "docs")) })));
      if (Array.isArray(node.searchAliases) && node.searchAliases.length) {
        append(dl, fieldRow("搜索别名", el("span", { class: "node-chip", text: node.searchAliases.slice(0, 12).map(str).join(", ") })));
      }
      if (Array.isArray(node.conflicts) && node.conflicts.length) {
        append(dl, fieldRow("来源冲突", el("span", { class: "badge badge-warn", text: node.conflicts.map(str).join("；") })));
      }
      info.appendChild(dl);
      host.appendChild(info);

      // 来源
      var src = el("div", { class: "detail-section" });
      src.appendChild(el("h3", { text: "来源" }));
      src.appendChild(sourceList(node));
      host.appendChild(src);

      host.appendChild(el("div", { class: "detail-section" }, [
        el("button", {
          type: "button",
          class: "btn",
          text: "关闭详情",
          onclick: function () {
            state.selectedId = "";
            try { window.history.replaceState(null, "", window.location.pathname + window.location.search); }
            catch (e) { window.location.hash = ""; }
            renderDetail(null);
            markActiveCard();
          }
        })
      ]));
    }

    /* ---- 顶部筛选状态 ---- */
    function syncFilters() {
      if (els.docOnly) els.docOnly.setAttribute("aria-pressed", state.docOnly ? "true" : "false");
      if (els.reset) els.reset.disabled = !(state.query || state.category.length || state.installedOnly || state.docOnly);
      if (els.hint) {
        els.hint.textContent = state.installedOnly
          ? "当前：仅显示已收录节点"
          : "提示：搜索框输入 2 个字符以上开始过滤；按 / 快速聚焦搜索框，按 Esc 清空。";
      }
    }

    function update(opts) {
      opts = opts || {};
      state.visibleLimit = PAGE_SIZE;
      renderTree();
      renderCards();
      syncFilters();
      if (!opts.keepSelection) { /* 保留已选节点 */ }
    }

    /* ---- hash 深链 ---- */
    function applyHash() {
      var raw = str(window.location.hash).replace(/^#/, "");
      if (!raw) {
        if (state.selectedId) {
          state.selectedId = "";
          renderDetail(null);
          markActiveCard();
        }
        return;
      }
      var decoded = raw;
      try { decoded = decodeURIComponent(raw); } catch (e) { /* ignore */ }
      if (decoded.indexOf("cat:") === 0) {
        var path = decoded.slice(4).split("/").filter(Boolean);
        state.category = path;
        state.installedOnly = false;
        state.selectedId = "";
        renderDetail(null);
        update();
        return;
      }
      var node = findNodeById(decoded);
      state.selectedId = node ? nodeId(node) : "";
      renderDetail(node, node ? null : decoded); // 未命中时给出明确提示（例如工作流页链接到了一个本站未收录的节点）
      markActiveCard();
      if (node) announce("已显示节点 " + nodeDisplayName(node) + " 的详情");
      else announce("未找到节点 " + decoded);
      if (node) {
        // 深链目标可能排在第 120 张卡片之后：先把可见批次扩到包含它，否则卡片上不会有高亮
        var list = filtered();
        var index = -1;
        for (var i = 0; i < list.length; i++) {
          if (nodeId(list[i]) === state.selectedId) { index = i; break; }
        }
        if (index >= state.visibleLimit) {
          state.visibleLimit = index + 1;
          renderCards();
          markActiveCard();
        }
        var selector = '.node-card[data-node-id="' + (window.CSS && CSS.escape ? CSS.escape(state.selectedId) : state.selectedId.replace(/"/g, '\\"')) + '"]';
        var card = qs(selector, els.cards);
        if (card && card.scrollIntoView) card.scrollIntoView({ block: "nearest" });
      }
    }

    /* ---- 事件绑定 ---- */
    if (els.input) {
      els.input.addEventListener("input", debounce(function () {
        state.query = norm(els.input.value);
        update();
      }, 120));
      els.input.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") {
          ev.preventDefault();
          els.input.value = "";
          state.query = "";
          update();
          announce("已清空搜索");
        }
      });
    }
    if (els.clearSearch) {
      els.clearSearch.addEventListener("click", function () {
        if (els.input) { els.input.value = ""; els.input.focus(); }
        state.query = "";
        update();
      });
    }
    if (els.docOnly) {
      els.docOnly.addEventListener("click", function () {
        state.docOnly = !state.docOnly;
        update();
        announce(state.docOnly ? "已开启：仅看官方文档收录" : "已关闭：仅看官方文档收录");
      });
    }
    if (els.reset) {
      els.reset.addEventListener("click", function () {
        state.query = "";
        state.category = [];
        state.installedOnly = false;
        state.docOnly = false;
        if (els.input) els.input.value = "";
        update();
        announce("已重置全部筛选条件");
      });
    }
    if (els.sort) {
      state.sort = els.sort.value || "name";
      els.sort.addEventListener("change", function () {
        state.sort = els.sort.value || "name";
        update();
      });
    }
    if (els.more) {
      els.more.addEventListener("click", function () {
        state.visibleLimit += PAGE_SIZE * 2;
        renderCards();
        announce("已加载更多节点");
      });
    }

    // 滚动到底部时自动加载下一批（无 IntersectionObserver 时退化为「显示更多」按钮）
    if (els.moreWrap && "IntersectionObserver" in window) {
      try {
        var observer = new IntersectionObserver(function (entries) {
          for (var i = 0; i < entries.length; i++) {
            if (entries[i].isIntersecting && !els.moreWrap.hidden) {
              state.visibleLimit += PAGE_SIZE * 2;
              renderCards();
            }
          }
        }, { rootMargin: "300px" });
        observer.observe(els.moreWrap);
      } catch (e) { /* 忽略：保留按钮方式 */ }
    }

    document.addEventListener("keydown", function (ev) {
      var tag = (ev.target && ev.target.tagName) ? ev.target.tagName.toLowerCase() : "";
      var typing = tag === "input" || tag === "textarea" || tag === "select" || (ev.target && ev.target.isContentEditable);
      if (!typing && (ev.key === "/" || ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k"))) {
        if (els.input) { ev.preventDefault(); els.input.focus(); els.input.select(); }
      }
    });

    window.addEventListener("hashchange", applyHash);

    /* ---- 启动 ---- */
    renderDetail(null);
    update();
    applyHash();
  }

  /* ------------------------------------------------------------------ *
   * 8. 启动
   * ------------------------------------------------------------------ */
  function init() {
    theme.init();
    initNav();
    initHome();
    initNodes();
  }

  window.CW = {
    version: VERSION,
    esc: esc,
    el: el,
    qs: qs,
    qsa: qsa,
    clear: clear,
    append: append,
    norm: norm,
    str: str,
    truncate: truncate,
    displayText: displayText,
    normalizeCatalog: normalizeCatalog,
    normalizeTextValue: normalizeTextValue,
    fmtInt: fmtInt,
    debounce: debounce,
    announce: announce,
    theme: theme,
    initNav: initNav,
    getData: getData,
    getMeta: getMeta,
    getNodes: getNodes,
    findNodeById: findNodeById,
    nodeId: nodeId,
    nodeDisplayName: nodeDisplayName,
    categoryPath: categoryPath,
    isInstalled: isInstalled,
    isDocNode: isDocNode,
    hasZh: hasZh,
    packOf: packOf,
    nodeSearchText: nodeSearchText,
    dataAvailable: dataAvailable,
    init: init
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
