/* Restrained scroll-reveal. Content is fully visible without JS or with reduced motion. */
(function () {
  "use strict";
  if (typeof document === "undefined") return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) return;
  var els = document.querySelectorAll("main section .card, .video-feature, .contact-prompt, .hero-visual");
  document.documentElement.classList.add("js-reveal");
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
  els.forEach(function (el) { el.classList.add("reveal"); io.observe(el); });
  // Safety net: never leave content hidden.
  setTimeout(function () { els.forEach(function (el) { el.classList.add("in"); }); }, 2500);
})();
