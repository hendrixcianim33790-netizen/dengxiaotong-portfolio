/* ============================================================
   Stagger Testimonials — 运行时
   错落卡片阵:点卡换位,或用底部按钮 / 键盘左右滚动。
   ============================================================ */
(function () {
  "use strict";

  var CHEV_L = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var CHEV_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

  function buildStagger(root) {
    if (root.__stgInit) return;
    root.__stgInit = true;

    var items = [];
    try { items = JSON.parse(root.getAttribute("data-stagger") || "[]"); } catch (e) { return; }
    if (!items.length) return;

    var track = document.createElement("div");
    track.className = "stg-track";
    track.setAttribute("role", "list");
    track.setAttribute("aria-label", root.getAttribute("aria-label") || "经历");

    var cards = items.map(function (it, i) {
      var el = document.createElement("button");
      el.type = "button";
      el.className = "stg-card";
      el.setAttribute("role", "listitem");
      el.style.setProperty("--av-h", it.hue != null ? it.hue : 340);

      var stats = (it.stats || []).map(function (s) {
        return '<div class="stg-stat"><b>' + s[0] + "</b><span>" + s[1] + "</span></div>";
      }).join("");

      el.innerHTML =
        '<span class="stg-notch" aria-hidden="true"></span>' +
        '<span class="stg-head">' +
          '<span class="stg-av" aria-hidden="true">' + (it.mark || it.org.charAt(0)) + "</span>" +
          '<span class="stg-id">' +
            '<span class="stg-when">' + it.when + "</span>" +
            '<span class="stg-org">' + it.org + "</span>" +
          "</span>" +
        "</span>" +
        '<span class="stg-role">' + it.role + "</span>" +
        '<span class="stg-body">' + it.body + "</span>" +
        (stats ? '<span class="stg-stats">' + stats + "</span>" : "");

      el.addEventListener("click", function () { moveTo(i); });
      track.appendChild(el);
      return el;
    });

    root.appendChild(track);

    var prev = document.createElement("button");
    prev.type = "button";
    prev.className = "stg-btn";
    prev.innerHTML = CHEV_L;
    prev.setAttribute("aria-label", "上一段经历");
    var next = document.createElement("button");
    next.type = "button";
    next.className = "stg-btn";
    next.innerHTML = CHEV_R;
    next.setAttribute("aria-label", "下一段经历");

    var nav = document.createElement("div");
    nav.className = "stg-nav";
    nav.appendChild(prev);
    nav.appendChild(next);
    root.appendChild(nav);

    var dots = document.createElement("div");
    dots.className = "stg-dots";
    dots.setAttribute("aria-hidden", "true");
    var dotEls = items.map(function () {
      var d = document.createElement("i");
      d.className = "stg-dot";
      dots.appendChild(d);
      return d;
    });
    root.appendChild(dots);

    var n = items.length;
    var pos = Math.floor(n / 2);

    function layout() {
      for (var i = 0; i < n; i++) {
        var offset = i - pos;
        var abs = Math.abs(offset);
        var c = cards[i];
        c.style.setProperty("--pos", offset);
        c.style.setProperty("--abs", abs);
        /* 上下错落:奇偶交替,幅度 12px。
           幅度必须小 —— 错落一大,上下两张卡的边界就错开成锯齿,
           视觉上就是"位置很乱"而不是"有节奏"。 */
        c.style.setProperty("--dy", offset === 0 ? -6 : (i % 2 ? 12 : -12));
        /* 旋转压到 ±1°。2.2° 时 getBoundingClientRect 返回的外接矩形
           会比未旋转的卡大 15px,肉眼就是"大小不统一"。 */
        c.style.setProperty("--rot", offset === 0 ? 0 : (i % 2 ? 1 : -1));
        if (offset === 0) c.setAttribute("data-center", "");
        else c.removeAttribute("data-center");
        /* 只保留中心左右各一张:5 张全排开时最外侧会被容器切掉大半,
           露出半张残卡比不显示更难看。 */
        c.style.visibility = abs > 1 ? "hidden" : "";
      }
      for (var k = 0; k < dotEls.length; k++) {
        if (k === pos) dotEls[k].setAttribute("data-on", "");
        else dotEls[k].removeAttribute("data-on");
      }
    }

    function move(steps) {
      pos = (pos + steps + n) % n;
      layout();
    }
    function moveTo(i) {
      if (i === pos) return;
      pos = i;
      layout();
    }

    prev.addEventListener("click", function () { move(-1); });
    next.addEventListener("click", function () { move(1); });

    root.setAttribute("tabindex", "0");
    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); move(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); move(1); }
      else if (e.key === "Home") { e.preventDefault(); moveTo(0); }
      else if (e.key === "End") { e.preventDefault(); moveTo(n - 1); }
    });

    // 入场:第一张居中的卡从透明淡入
    root.style.setProperty("--stg-in", "1");
    layout();
  }

  window.initStaggers = function (scope) {
    var nodes = (scope || document).querySelectorAll("[data-stagger]");
    for (var i = 0; i < nodes.length; i++) {
      try { buildStagger(nodes[i]); } catch (e) { /* 单个失败不影响其余 */ }
    }
    return nodes.length;
  };

  window.addEventListener("DOMContentLoaded", function () {
    window.initStaggers(document);
  });
})();