/* Spotlight Card — 只做一件事:把指针位置写进 CSS 变量 */
(function () {
  "use strict";

  var raf = 0, targets = [];

  function apply() {
    raf = 0;
    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      var rect = t.getBoundingClientRect();
      t.style.setProperty("--x", (t._x != null ? t._x : rect.width * 0.5).toFixed(1));
      t.style.setProperty("--y", (t._y != null ? t._y : rect.height * 0.34).toFixed(1));
      t.style.setProperty("--xp", (t._xp != null ? t._xp : 0.5).toFixed(3));
      t.style.setProperty("--yp", (t._yp != null ? t._yp : 0.34).toFixed(3));
    }
  }

  function track(el) {
    if (el.__glowTrack) return;
    el.__glowTrack = true;
    // 初始指针位置先置空,首次 apply 时按真实尺寸填入
    el._x = el._y = el._xp = el._yp = null;
    apply();

    el.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;
      var rect = el.getBoundingClientRect();
      el._x = e.clientX - rect.left;
      el._y = e.clientY - rect.top;
      el._xp = el._x / rect.width;
      el._yp = el._y / rect.height;
      if (!raf) raf = requestAnimationFrame(apply);
    });

    el.addEventListener("pointerleave", function () {
      var rect = el.getBoundingClientRect();
      el._x = rect.width * 0.5;
      el._y = rect.height * 0.34;
      el._xp = 0.5;
      el._yp = 0.34;
      if (!raf) raf = requestAnimationFrame(apply);
    });

    targets.push(el);
  }

  window.initSpotlight = function (scope) {
    var nodes = (scope || document).querySelectorAll("[data-spotlight]");
    for (var i = 0; i < nodes.length; i++) track(nodes[i]);
    return nodes.length;
  };

  // 布局稳定后按最终位置初始化(字体加载会改变卡片尺寸)
  window.addEventListener("load", function () {
    targets = [];
    window.initSpotlight(document);
  });
})();