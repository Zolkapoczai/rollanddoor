/* /technologia: az animáció indítása, amikor látszik, és az „újra” gomb. Csökkentett mozgásnál nem fut: álló rajz + feliratlista. */
(function () {
  'use strict';
  var fig = document.getElementById('anim');
  if (!fig) { return; }
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { return; }

  // A videófelvétel (tools/) ?felvetel=1 paraméterrel azonnal indítja, görgetés nélkül.
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
