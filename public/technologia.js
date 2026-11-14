/* A dupla sín bemutatása.
   1) Főoldal (#tech-video): a videó csak a közelébe görgetve töltődik le, látható állapotban magától fut (hang nélkül,
      ismétlődve), eltűnve megáll. Telefonon az álló (9:16), szélesebb képernyőn a négyzetes (1:1) változat.
      Csökkentett mozgásnál nem indul el magától: lejátszógombokkal jelenik meg.
   2) technologia.html (#anim): az SVG-animáció, ebből készül a videó (tools/video-felvetel.mjs, ?felvetel=1). */
(function () {
  'use strict';
  var csendes = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1) Videó a főoldalon ---------- */
  var v = document.getElementById('tech-video');
  if (v) {
    var allo = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
    var src = v.getAttribute(allo ? 'data-tall' : 'data-wide');
    v.poster = v.getAttribute(allo ? 'data-tall-poster' : 'data-wide-poster');
    if (allo) { v.width = 1080; v.height = 1920; v.classList.add('tech-video--tall'); }
    var betoltve = false;
    function betolt() { if (!betoltve) { betoltve = true; v.src = src; v.load(); } }
    function indit() { var p = v.play(); if (p && p.catch) { p.catch(function () { v.controls = true; }); } }

    if (csendes) { v.controls = true; v.preload = 'metadata'; betolt(); }
    else if (!('IntersectionObserver' in window)) { betolt(); v.autoplay = true; indit(); }
    else {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { betolt(); } });
      }, { rootMargin: '600px 0px' }).observe(v);
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { betolt(); indit(); } else if (!v.paused) { v.pause(); }
        });
      }, { threshold: 0.35 }).observe(v);
    }
  }

  /* ---------- 2) SVG-animáció (technologia.html) ---------- */
  var fig = document.getElementById('anim');
  if (!fig || csendes) { return; }
  var azonnal = /[?&]felvetel=1\b/.test(location.search);
  fig.classList.add('ready');

  function play() {
    fig.classList.remove('play');
    void fig.getBoundingClientRect(); // újraindítja a CSS-animációkat
    fig.classList.add('play');
  }
  var replay = document.getElementById('replay');
  if (replay) { replay.addEventListener('click', play); }

  if (azonnal || !('IntersectionObserver' in window)) { play(); return; }
  var io = new IntersectionObserver(function (entries) {
    if (entries.some(function (e) { return e.isIntersecting; })) { play(); io.disconnect(); }
  }, { threshold: 0.5 });
  io.observe(fig);
})();
