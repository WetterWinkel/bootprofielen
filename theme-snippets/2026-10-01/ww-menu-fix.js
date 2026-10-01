/* WetterWinkel – mobiel menu: categorieknoppen klappen het menu uit i.p.v. direct alle producten te openen (1 okt 2026) */
(function () {
  var mq = window.matchMedia("(max-width: 980px)");
  var nav = document.getElementById("main-navigation");
  var toggle = document.querySelector(".menu-toggle");
  if (!nav) return;
  var details = Array.prototype.slice.call(nav.querySelectorAll(".nav-details"));

  function norm(t) { return String(t || "").replace(/\s+/g, " ").trim().toLowerCase(); }
  function titleOf(d) { var s = d.querySelector(":scope > summary span"); return norm(s && s.textContent); }

  function openCategory(d) {
    nav.classList.add("is-open");
    if (toggle) toggle.setAttribute("aria-expanded", "true");
    details.forEach(function (o) { if (o !== d) o.removeAttribute("open"); });
    d.setAttribute("open", "");
    var header = document.querySelector(".site-header");
    var top = (header ? header.getBoundingClientRect().top : 0) + window.pageYOffset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    setTimeout(function () {
      var r = d.getBoundingClientRect(), nr = nav.getBoundingClientRect();
      nav.scrollTop += r.top - nr.top;
    }, 60);
  }

  /* 1. snelknoppen onder de zoekbalk */
  document.querySelectorAll(".mobile-shop-nav__scroll a").forEach(function (a) {
    if (a.classList.contains("mobile-shop-nav__all")) return;
    var match = details.filter(function (d) { return titleOf(d) === norm(a.textContent); })[0];
    if (!match) return;
    a.classList.add("ww-chip-menu");
    a.setAttribute("aria-haspopup", "true");
    a.addEventListener("click", function (e) {
      if (!mq.matches) return;
      e.preventDefault();
      e.stopPropagation();
      if (nav.classList.contains("is-open") && match.open) {
        match.removeAttribute("open");
        nav.classList.remove("is-open");
        if (toggle) toggle.setAttribute("aria-expanded", "false");
        return;
      }
      openCategory(match);
    });
  });

  /* 2. subgroepen als uitklapbare lijst */
  nav.querySelectorAll(".mega-group").forEach(function (g) {
    var title = g.querySelector(".mega-group-title");
    var kids = g.querySelectorAll(".mega-child");
    if (!title || !kids.length) return;
    g.classList.add("ww-acc");
    var isBrands = g.classList.contains("mega-group--brands");
    var all = document.createElement("a");
    all.className = "mega-child ww-acc-all";
    all.href = title.getAttribute("href");
    all.textContent = isBrands ? "Bekijk alle merken" : "Alles in " + title.textContent.trim();
    title.insertAdjacentElement("afterend", all);
    if (isBrands) title.setAttribute("data-mobile-label", "Merken");
  });

  nav.addEventListener("click", function (e) {
    if (!mq.matches) return;
    var title = e.target.closest(".ww-acc > .mega-group-title");
    if (!title) return;
    e.preventDefault();
    e.stopPropagation();
    var g = title.parentElement;
    var open = !g.classList.contains("is-open");
    g.parentElement.querySelectorAll(".ww-acc.is-open").forEach(function (o) { if (o !== g) o.classList.remove("is-open"); });
    g.classList.toggle("is-open", open);
    title.setAttribute("aria-expanded", String(open));
  }, true);
})();

/* 3. Terugknop op productpagina: altijd terug naar de vorige pagina binnen de webshop */
(function () {
  var back = document.querySelector("[data-ww-product-back]");
  if (!back) return;
  back.innerHTML = '<span aria-hidden="true">←</span> Terug';
  back.addEventListener("click", function (e) {
    try {
      var ref = document.referrer ? new URL(document.referrer) : null;
      if (ref && ref.origin === location.origin && history.length > 1) {
        e.preventDefault();
        e.stopImmediatePropagation();
        history.back();
      }
    } catch (err) {}
  }, true);
})();
