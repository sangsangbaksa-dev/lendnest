(function () {
  var I = window.LNI, sel = document.getElementById('lang'), saved = '';
  try { saved = localStorage.getItem('lendnest.lang') || ''; } catch (e) {}
  var lang = I.LAND[saved] ? saved : I.detect(navigator);
  I.langs.forEach(function (l) { var o = document.createElement('option'); o.value = l; o.textContent = I.L[l].name; sel.appendChild(o); });
  function draw() {
    var d = I.LAND[lang]; sel.value = lang; document.documentElement.lang = lang; document.title = d.ttl;
    var md = document.querySelector('meta[name=description]'); if (md) md.setAttribute('content', d.lede);
    document.querySelectorAll('[data-i]').forEach(function (n) { var v = d[n.getAttribute('data-i')]; if (v) n.textContent = v; });
  }
  sel.addEventListener('change', function () { lang = sel.value; try { localStorage.setItem('lendnest.lang', lang); } catch (e) {} draw(); });
  draw();
})();
