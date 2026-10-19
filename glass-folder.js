/* ============================================================
   Glass Folder — 运行时
   ------------------------------------------------------------
   1) ART_PRESETS 域扭曲噪声插画(移植自 React 版的 createArtJob)
   2) 共享绘制队列:每帧只花几毫秒,一排文件夹不会卡
   3) 交互:指针视差、展开/收起、+ 投入文件、键盘可达性
   ============================================================ */
(function () {
  "use strict";

  /* ---------- 1. 插画生成 ---------- */

  var ART_PRESETS = {
    aurora:   { style: "streak", colors: ["#f4efe9", "#e9c2b8", "#c2433f", "#2a1e2a", "#22395e", "#6f97c2", "#e5edf4"], scale: 0.7, warp: 1.4, angle: -0.62, gloss: 0.18, veins: 0 },
    ember:    { style: "marble", colors: ["#07090c", "#16252c", "#3d5f68", "#1a1416", "#a3201a", "#ef4a2b", "#ff8a5c"], scale: 0.62, warp: 3.2, angle: -0.5, gloss: 0.55, veins: 0.6 },
    dusk:     { style: "marble", colors: ["#120c18", "#3e2850", "#8f6c9c", "#2b1a24", "#b3502f", "#eab08a", "#fbe7d2"], scale: 0.75, warp: 3.6, angle: 0.8, gloss: 0.5, veins: 0.5 },
    glacier:  { style: "streak", colors: ["#f7f8fa", "#d9e2ea", "#9fb4c7", "#e8edf2", "#bccbd8", "#ffffff"], scale: 0.7, warp: 1.6, angle: 0.35, gloss: 0.25, veins: 0 },
    verdant:  { style: "marble", colors: ["#070b08", "#173024", "#4f7a5a", "#141812", "#a7843a", "#e9cf87", "#fbf3d6"], scale: 0.7, warp: 3.4, angle: 2.1, gloss: 0.5, veins: 0.5 },
    // 与站点粉灰主色一致的预设,用在「AI 创意生产」这一册
    blush:    { style: "marble", colors: ["#1a1219", "#3d2430", "#7a4a58", "#2a1e2a", "#b8798a", "#e3b4bc", "#f6e8ea"], scale: 0.72, warp: 3.0, angle: 0.62, gloss: 0.46, veins: 0.42 }
  };

  function hexToRgb(hex) {
    var h = String(hex).trim().replace(/^#/, "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = /^[0-9a-f]{6}$/i.test(h) ? parseInt(h, 16) : 0x808080;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  function makeFbm(seed) {
    var r = rng(seed);
    var perm = new Uint8Array(512), grad = new Float32Array(512), p = [], i, j, t;
    for (i = 0; i < 256; i++) p[i] = i;
    for (i = 255; i > 0; i--) { j = Math.floor(r() * (i + 1)); t = p[i]; p[i] = p[j]; p[j] = t; }
    for (i = 0; i < 512; i++) perm[i] = p[i & 255];
    for (i = 0; i < 256; i++) { var a = r() * Math.PI * 2; grad[i * 2] = Math.cos(a); grad[i * 2 + 1] = Math.sin(a); }

    function noise(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      var X = xi & 255, Y = yi & 255;
      var h00 = perm[X + perm[Y]] * 2, h10 = perm[X + 1 + perm[Y]] * 2;
      var h01 = perm[X + perm[Y + 1]] * 2, h11 = perm[X + 1 + perm[Y + 1]] * 2;
      var d00 = grad[h00] * xf + grad[h00 + 1] * yf;
      var d10 = grad[h10] * (xf - 1) + grad[h10 + 1] * yf;
      var d01 = grad[h01] * xf + grad[h01 + 1] * (yf - 1);
      var d11 = grad[h11] * (xf - 1) + grad[h11 + 1] * (yf - 1);
      var u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
      return d00 + u * (d10 - d00) + v * (d01 - d00 + u * (d11 - d01 - d10 + d00));
    }
    return function (x, y, oct) {
      var sum = 0, amp = 0.5;
      for (var k = 0; k < oct; k++) {
        sum += amp * noise(x, y);
        var nx = 1.6 * x + 1.2 * y + 7.1;
        y = -1.2 * x + 1.6 * y + 3.3;
        x = nx;
        amp *= 0.5;
      }
      return sum;
    };
  }

  function createArtJob(width, height, recipe, seed) {
    var w = Math.max(1, Math.round(width)), h = Math.max(1, Math.round(height));
    var colors = (recipe.colors && recipe.colors.length >= 2) ? recipe.colors : ["#111111", "#eeeeee"];
    var stops = colors.map(function (c, i) { return { t: i / (colors.length - 1), c: hexToRgb(c) }; });
    var scale = recipe.scale != null ? recipe.scale : 0.7;
    var warp = recipe.warp != null ? recipe.warp : 3;
    var gloss = recipe.gloss != null ? recipe.gloss : 0.4;
    var veins = recipe.veins != null ? recipe.veins : 0;
    var streak = recipe.style === "streak";
    var fbm = makeFbm(seed * 977 + 13);
    var r = rng(seed + 1);
    var ox = r() * 50, oy = r() * 50;
    var angle = (recipe.angle || 0) + (r() - 0.5) * 0.5;
    var ca = Math.cos(angle), sa = Math.sin(angle);
    var m = Math.min(w, h);

    var gw = Math.ceil(w / 2) + 3, gh = Math.ceil(h / 2) + 3;
    var G = new Float32Array(gw * gh), GQ = new Float32Array(gw * gh);
    var F = new Float32Array(w * h), Q = new Float32Array(w * h);
    var pixels = new Uint8ClampedArray(w * h * 4);
    var row = 0;

    function field(gy) {
      for (var gx = 0; gx < gw; gx++) {
        var u = ((gx - 1) * 2 - w / 2) / m, v = ((gy - 1) * 2 - h / 2) / m;
        var px = (u * ca - v * sa) * scale, py = (u * sa + v * ca) * scale;
        if (streak) { px *= 0.14; py *= 2.2; }
        px += ox; py += oy;
        var qx = fbm(px, py, 3), qy = fbm(px + 5.2, py + 1.3, 3);
        var rx = fbm(px + warp * qx + 1.7, py + warp * qy + 9.2, 3);
        var ry = fbm(px + warp * qx + 8.3, py + warp * qy + 2.8, 3);
        G[gy * gw + gx] = fbm(px + warp * rx, py + warp * ry, 4);
        GQ[gy * gw + gx] = Math.sqrt(qx * qx + qy * qy);
      }
    }

    function upsample() {
      var cr = function (a, b, c, d) { return (-a + 9 * b + 9 * c - d) / 16; };
      var T = new Float32Array(w * gh);
      for (var gy = 0; gy < gh; gy++) {
        var rr = gy * gw;
        for (var x = 0; x < w; x++) {
          var c0 = (x >> 1) + 1;
          T[gy * w + x] = x & 1 ? cr(G[rr + c0 - 1], G[rr + c0], G[rr + c0 + 1], G[rr + c0 + 2]) : G[rr + c0];
        }
      }
      for (var y = 0; y < h; y++) {
        var c1 = (y >> 1) + 1;
        for (var x2 = 0; x2 < w; x2++) {
          F[y * w + x2] = y & 1
            ? cr(T[(c1 - 1) * w + x2], T[c1 * w + x2], T[(c1 + 1) * w + x2], T[(c1 + 2) * w + x2])
            : T[c1 * w + x2];
          var gx2 = (x2 >> 1) + 1;
          var q0 = GQ[c1 * gw + gx2];
          var qx2 = x2 & 1 ? (q0 + GQ[c1 * gw + gx2 + 1]) / 2 : q0;
          var q1 = y & 1 ? (x2 & 1 ? (GQ[(c1 + 1) * gw + gx2] + GQ[(c1 + 1) * gw + gx2 + 1]) / 2 : GQ[(c1 + 1) * gw + gx2]) : qx2;
          Q[y * w + x2] = (qx2 + q1) / 2;
        }
      }
    }

    function colorize() {
      var sample = [], stride = Math.max(1, Math.floor(F.length / 4096));
      for (var i = 0; i < F.length; i += stride) sample.push(F[i]);
      sample.sort(function (a, b) { return a - b; });
      var lo = sample[Math.floor(sample.length * 0.02)];
      var hi = sample[Math.floor(sample.length * 0.98)];
      var k = 1 / (hi - lo || 1);
      var lx = -0.55, ly = -0.65, lz = 0.52, slope = k * m * 0.012;
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var idx = y * w + x;
          var tt = (F[idx] - lo) * k;
          tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
          var j = 1;
          while (j < stops.length - 1 && stops[j].t < tt) j++;
          var sa2 = stops[j - 1], sb = stops[j];
          var f = (tt - sa2.t) / (sb.t - sa2.t || 1);
          f = f < 0 ? 0 : f > 1 ? 1 : f;
          f = f * f * (3 - 2 * f);
          var gx = (F[x < w - 1 ? idx + 1 : idx] - F[x > 0 ? idx - 1 : idx]) * slope;
          var gy = (F[y < h - 1 ? idx + w : idx] - F[y > 0 ? idx - w : idx]) * slope;
          var nd = (-gx * lx - gy * ly + lz) / Math.sqrt(gx * gx + gy * gy + 1);
          var spec = Math.pow(nd > 0 ? nd : 0, 24) * gloss * 255;
          var silk = 1 + 0.035 * Math.sin(tt * 150 + Q[idx] * 24);
          var vein = veins * Math.max(0, 1 - Math.abs(Q[idx] - 0.42) * 14) * 0.6;
          var lit = (0.82 + 0.28 * nd) * silk * (1 - vein);
          pixels[idx * 4] = (sa2.c[0] + (sb.c[0] - sa2.c[0]) * f) * lit + spec;
          pixels[idx * 4 + 1] = (sa2.c[1] + (sb.c[1] - sa2.c[1]) * f) * lit + spec;
          pixels[idx * 4 + 2] = (sa2.c[2] + (sb.c[2] - sa2.c[2]) * f) * lit + spec;
          pixels[idx * 4 + 3] = 255;
        }
      }
    }

    return {
      width: w, height: h, pixels: pixels,
      step: function (rows) {
        if (row >= gh) return true;
        var end = Math.min(gh, row + Math.max(1, rows));
        while (row < end) field(row++);
        if (row < gh) return false;
        upsample();
        colorize();
        return true;
      }
    };
  }

  /* ---------- 2. 共享绘制队列 ---------- */

  var artCache = {};   // key -> Promise<HTMLCanvasElement>
  var queue = [];
  var pumping = false;

  function pump() {
    if (pumping) return;
    pumping = true;
    function tick() {
      var until = performance.now() + 7;
      while (queue.length && performance.now() < until) {
        var head = queue[0];
        if (head.job.step(4)) {
          queue.shift();
          var c = document.createElement("canvas");
          c.width = head.job.width; c.height = head.job.height;
          c.getContext("2d").putImageData(new ImageData(head.job.pixels, c.width, c.height), 0, 0);
          head.done(c);
        }
      }
      if (queue.length) requestAnimationFrame(tick);
      else pumping = false;
    }
    requestAnimationFrame(tick);
  }

  function paint(recipe, seed, w, h, priority) {
    var key = JSON.stringify([recipe, seed, w, h]);
    if (!artCache[key]) {
      artCache[key] = new Promise(function (done) {
        var at = queue.length;
        while (at > 1 && queue[at - 1].priority > priority) at--;
        queue.splice(at, 0, { job: createArtJob(w, h, recipe, seed), priority: priority, done: done });
        pump();
      });
    }
    return artCache[key];
  }

  function recipeOf(art) {
    return (typeof art === "string") ? (ART_PRESETS[art] || ART_PRESETS.dusk) : art;
  }

  function mountCanvas(el, art, seed, w, h, priority) {
    var recipe = recipeOf(art);
    var pw = Math.round(w * priority.density);
    var ph = Math.round(h * priority.density);
    paint(recipe, seed, pw, ph, 1).then(function (src) {
      var c = el;
      if (!c.isConnected) return;
      c.width = src.width; c.height = src.height;
      c.getContext("2d").drawImage(src, 0, 0);
      c.setAttribute("data-ready", "");
    });
  }

  /* ---------- 3. 组件 ---------- */

  var W = 340, H = 272, HEADROOM = 54, FRONT_TOP = 74, FRONT_H = H - FRONT_TOP;
  var SHEET_W = 272, SHEET_H = 184;
  var MAX_VISIBLE = 4;

  // 330 单位坐标系里的固定路径
  var BACK_PATH = "M0 56A22 22 0 0 1 22 34L146 34C170 34 172 0 198 0L318 0A22 22 0 0 1 340 22L340 250A22 22 0 0 1 318 272L22 272A22 22 0 0 1 0 250Z";
  var FRONT_PATH = "M0 22A22 22 0 0 1 22 0L118 0C144 0 146 32 172 32L318 32A22 22 0 0 1 340 54L340 " +
    (FRONT_H - 22) + "A22 22 0 0 1 318 " + FRONT_H + "L22 " + FRONT_H + "A22 22 0 0 1 0 " + (FRONT_H - 22) + "Z";

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function init(root) {
    if (root.__gfInit) return;
    root.__gfInit = true;

    /* 优先复用外部脚本已经解析并挂好的 cfg(作品弹窗会往里塞 onOpen)。
       如果就地 JSON.parse(data-folder),外部挂的函数会被丢掉 —— 组件
       在 DOMContentLoaded 才初始化,那时外部的 onOpen 早就挂好了。 */
    var cfg = root.__gfCfg || JSON.parse(root.getAttribute("data-folder") || "{}");
    /* 把 cfg 挂到 DOM 上:外部脚本(作品弹窗)读走 onOpen 并调用它。
       组件本身不关心谁在消费 —— 只提供一个"点这张纸"的出口。 */
    root.__gfCfg = cfg;
    var label = cfg.label || "My Files";
    var labelLine = cfg.meta || "";
    var place = cfg.labelPlacement || "bottom-left";
    var width = cfg.width || 340;
    var seed = cfg.seed == null ? 3 : cfg.seed;
    var art = cfg.art === undefined ? "aurora" : cfg.art;
    var files = Array.isArray(cfg.files) ? cfg.files : [];
    var defaultOpen = !!cfg.defaultOpen;

    var k = width / W;
    var density = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1)) * k;
    var dpr = Math.min(density, 1.25);

    var uid = "gf" + Math.random().toString(36).slice(2, 8);

    root.classList.add("gf");
    root.setAttribute("data-place", place);
    root.style.width = width + "px";
    root.style.height = (H + HEADROOM) * k + "px";

    // ── 骨架 ──
    var stage = el("div", "gf-stage");
    stage.style.transform = "translateY(" + HEADROOM * k + "px) scale(" + k + ")";
    var tilt = el("div", "gf-tilt");
    tilt.appendChild(el("div", "gf-shadow"));

    var back = el("div", "gf-back");
    back.setAttribute("aria-hidden", "true");
    back.style.clipPath = "path('" + BACK_PATH + "')";
    if (art && art !== "none") {
      var bc = el("canvas", "gf-art");
      bc.setAttribute("aria-hidden", "true");
      bc.style.width = (W + 24) + "px";
      bc.style.height = (H + 24) + "px";
      back.appendChild(bc);
      mountCanvas(bc, art, seed, W + 24, H + 24, { density: density });
    }
    back.appendChild(el("div", "gf-back-sheen"));
    tilt.appendChild(back);

    var backRim = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    backRim.setAttribute("class", "gf-rim gf-back-rim");
    backRim.setAttribute("viewBox", "0 0 " + W + " " + H);
    backRim.setAttribute("aria-hidden", "true");
    backRim.innerHTML = '<path d="' + BACK_PATH + '"/>';
    tilt.appendChild(backRim);

    // ── 前玻璃 ──
    var front = el("div", "gf-front");
    front.style.clipPath = "path('" + FRONT_PATH + "')";
    front.appendChild(el("div", "gf-tint"));
    front.appendChild(el("div", "gf-spec"));

    var frontRim = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    frontRim.setAttribute("class", "gf-rim gf-front-rim");
    frontRim.setAttribute("viewBox", "0 0 " + W + " " + FRONT_H);
    frontRim.setAttribute("aria-hidden", "true");
    frontRim.innerHTML =
      '<defs><linearGradient id="rim-' + uid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#fff" stop-opacity=".9"/>' +
      '<stop offset=".35" stop-color="#fff" stop-opacity=".32"/>' +
      '<stop offset="1" stop-color="#fff" stop-opacity=".1"/>' +
      '</linearGradient></defs><path d="' + FRONT_PATH + '" stroke="url(#rim-' + uid + ')"/>';
    front.appendChild(frontRim);

    var hit = el("button", "gf-hit");
    hit.type = "button";
    var labelBox = el("div", "gf-label");
    var title = el("span", "gf-title");
    title.textContent = label;
    var metaLine = el("span", "gf-meta");
    labelBox.appendChild(title);
    labelBox.appendChild(metaLine);
    front.appendChild(hit);
    front.appendChild(labelBox);
    tilt.appendChild(front);

    // ── 纸张 ──
    var filesBox = el("div", "gf-files");
    filesBox.setAttribute("role", "list");
    filesBox.setAttribute("aria-label", label + " 目录");
    tilt.appendChild(filesBox);

    // ── + 号 ──
    var key = el("button", "gf-key gf-key--add");
    key.type = "button";
    key.innerHTML = '<svg class="gf-glyph gf-glyph--plus" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5v15M4.5 12h15"/></svg>';
    tilt.appendChild(key);

    stage.appendChild(tilt);
    root.appendChild(stage);

    // ── 状态 ──
    var open = defaultOpen;
    var nextId = files.length;
    var ids = files.map(function (_, i) { return i; });

    function countText() {
      return labelLine || (files.length + (files.length === 1 ? " 件" : " 件"));
    }
    function syncMeta() {
      var t = countText();
      metaLine.textContent = t;
      // 重置滚动动画
      metaLine.style.animation = "none";
      void metaLine.offsetWidth;
      metaLine.style.animation = "";
      hit.setAttribute("aria-label", (open ? "收起 " : "展开 ") + label + "，" + files.length + " 件");
    }

    function renderFiles() {
      filesBox.textContent = "";
      var start = Math.max(0, files.length - MAX_VISIBLE);
      var visible = files.slice(start);
      visible.forEach(function (file, v) {
        var id = ids[start + v];
        var slot = visible.length <= 1 ? 0 : (v / (visible.length - 1)) * 2 - 1;
        var jitter = rng(hashString(file.name) + id);
        var picture = !!(file.art || file.image);

        /* 媒体项(视频/图片)是可点的:点纸张直接开播放器。
           纯文字项仍然只是静态纸张 —— 它们在文件夹里代表文档,
           让它们也可点会让人以为点得动却什么都不发生。 */
        var playable = !!(file.media || file.image);
        var sheet = el("a", "gf-sheet" + (picture ? " gf-sheet--art" : "") + (playable ? " gf-sheet--play" : ""));
        if (picture && file.href) sheet.setAttribute("href", file.href);
        sheet.setAttribute("role", "listitem");
        if (playable) {
          sheet.setAttribute("href", "#");
          sheet.setAttribute("aria-label", "打开:" + file.name);
        } else if (!picture) {
          sheet.type = "button";
        }
        sheet.style.setProperty("--slot", slot.toFixed(3));
        sheet.style.setProperty("--depth", visible.length - 1 - v);
        sheet.style.setProperty("--jx", ((jitter() - 0.5) * 10).toFixed(2) + "px");
        sheet.style.setProperty("--jr", ((jitter() - 0.5) * 3.2).toFixed(2) + "deg");
        sheet.style.zIndex = v + 1;

        if (picture) {
          if (file.image) {
            var im = el("img", "gf-sheet-art");
            im.src = file.image; im.alt = ""; im.draggable = false;
            im.loading = "lazy"; im.decoding = "async";
            sheet.appendChild(im);
          } else {
            var sc = el("canvas", "gf-sheet-art");
            sc.setAttribute("aria-hidden", "true");
            sc.style.width = SHEET_W + "px";
            sc.style.height = SHEET_H + "px";
            sheet.appendChild(sc);
            mountCanvas(sc, file.art, hashString(file.name) % 997, SHEET_W, SHEET_H, { density: dpr });
          }
          /* 视频项:叠一个播放角标。缩略图上盖一个三角比文字说明更直接 ——
             访客在文件夹里是"扫"的状态,不是"读"的状态。 */
          if (file.media) {
            var pl = el("span", "gf-sheet-play", '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>');
            sheet.appendChild(pl);
          }
        } else {
          sheet.appendChild(
            el("span", "gf-lines",
              '<i style="width:86%"></i><i style="width:92%"></i><i style="width:64%"></i><i style="width:88%"></i><i style="width:42%"></i>')
          );
          sheet.setAttribute("aria-hidden", "true");
        }

        var head = el("span", "gf-sheet-head");
        var nm = el("span", "gf-sheet-name");
        nm.textContent = file.name;
        head.appendChild(nm);
        if (file.meta) {
          var mt = el("span", "gf-sheet-meta");
          mt.textContent = file.meta;
          head.appendChild(mt);
        }
        sheet.appendChild(head);
        filesBox.appendChild(sheet);

        /* 点纸张 → 通知外部打开播放器。
           事件走 CustomEvent 而不是直接调用函数:文件夹是独立组件,
           不该知道播放器的存在。当前文件夹 cfg 上有 onOpen 时才监听。 */
        if (playable && cfg.onOpen) {
          sheet.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            cfg.onOpen(file);
          });
        }
      });
      filesBox.toggleAttribute("inert", !open);
      syncMeta();
    }

    function setOpen(next) {
      open = next;
      if (open) root.setAttribute("data-open", ""); else root.removeAttribute("data-open");
      filesBox.toggleAttribute("inert", !open);
      syncMeta();
    }

    function bump() {
      front.classList.remove("gf-front--bump");
      void front.offsetWidth;
      front.classList.add("gf-front--bump");
    }

    hit.addEventListener("click", function () { setOpen(!open); });

    key.addEventListener("click", function () {
      var made = {
        name: "Untitled " + (files.length + 1),
        meta: "刚刚",
        art: ["dusk", "ember", "verdant", "aurora", "blush"][files.length % 5]
      };
      files.push(made);
      ids.push(nextId++);
      bump();
      // 重绘后只有新文件播放落入动画
      renderFiles();
      var sheets = filesBox.querySelectorAll(".gf-sheet");
      if (sheets.length) {
        var last = sheets[sheets.length - 1];
        last.classList.add("gf-sheet--drop");
        last.addEventListener("animationend", function () { last.classList.remove("gf-sheet--drop"); }, { once: true });
      }
      if (cfg.onAdd) cfg.onAdd(files);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || !open) return;
      if (!root.contains(document.activeElement) && document.activeElement !== hit) return;
      setOpen(false);
      hit.focus();
    });

    document.addEventListener("pointerdown", function (e) {
      if (!open || root.contains(e.target)) return;
      setOpen(false);
    });

    renderFiles();

    // ── 入场:首次进入视口才组装 ──
    if (!("IntersectionObserver" in window)) {
      root.setAttribute("data-entered", "");
    } else {
      var delay = cfg.appearDelay || 0;
      var io = new IntersectionObserver(function (entries) {
        if (!entries.some(function (e2) { return e2.isIntersecting; })) return;
        io.disconnect();
        setTimeout(function () { root.setAttribute("data-entered", ""); }, delay);
      }, { threshold: 0.2 });
      io.observe(root);
    }

    // ── 指针视差:只写 CSS 变量,不触发重排 ──
    var raf = 0, px = 0, py = 0;
    function write() {
      raf = 0;
      root.style.setProperty("--px", px.toFixed(3));
      root.style.setProperty("--py", py.toFixed(3));
    }
    root.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;
      var rect = root.getBoundingClientRect();
      px = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      py = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(write);
    });
    root.addEventListener("pointerleave", function () {
      px = 0; py = 0;
      if (!raf) raf = requestAnimationFrame(write);
    });

    return { setOpen: setOpen, addFile: function () { key.click(); } };
  }

  window.initGlassFolders = function (scope) {
    var nodes = (scope || document).querySelectorAll("[data-folder]");
    var api = [];
    for (var i = 0; i < nodes.length; i++) {
      try { var a = init(nodes[i]); if (a) api.push(a); } catch (err) { /* 单个失败不影响其余 */ }
    }
    return api;
  };

  // 每张卡只在首次进入视口时组装
  window.addEventListener("DOMContentLoaded", function () {
    window.initGlassFolders(document);
  });
})();