/* WetterWinkel-app (testversie). Draait op www.wetterwinkel.nl/apps/bootmarkt/app */
(function () {
  "use strict";

  var root = document.getElementById("ww-app");
  var stateEl = document.getElementById("ww-state");
  if (!root || !stateEl) return;
  var S = JSON.parse(stateEl.textContent || "{}");

  var CATEGORIES = [
    "Motoronderhoud", "Aandrijving & keerkoppeling", "Brandstofsysteem", "Koeling & impeller",
    "Elektrisch & accu", "Schroef & schroefas", "Romp & anodes", "Stuurinrichting",
    "Navigatie & elektronica", "Veiligheid", "Comfort & sanitair", "Winterklaar / voorjaarsbeurt",
    "Inspectie / keuring", "Reparatie", "Upgrade / verbouwing", "Overige werkzaamheden"
  ];

  var ICON = {
    bag: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 7h12l-1 13H7L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
    boat: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 15l2 4h14l2-4H3z"/><path d="M12 3v12"/><path d="M12 4l6 9h-6"/></svg>',
    chat: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5z"/><path d="M9 10h.01M12 10h.01M15 10h.01"/></svg>',
    book: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z"/><path d="M9 9h6M9 13h6"/></svg>',
    search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
    plus: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    check: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
    send: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    captain: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="2"/><path d="M12 7v14"/><path d="M5 13a7 7 0 0 0 14 0"/><path d="M8 11h8"/></svg>',
    motor: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="7" width="12" height="10" rx="2"/><path d="M16 10h3v4h-3M8 7V4h4v3"/></svg>',
    paint: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h8v5H7z"/><path d="M11 8v4"/><path d="M9 12h4v9H9z"/></svg>',
    bolt: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2L5 14h6l-1 8 8-12h-6l1-8z"/></svg>',
    ring: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 4v4.5M12 15.5V20M4 12h4.5M15.5 12H20"/></svg>',
    drop: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c3 4 5 7 5 10a5 5 0 0 1-10 0c0-3 2-6 5-10z"/></svg>',
    dinghy: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 14h18l-2 5H5l-2-5z"/><path d="M6 14c0-3 2-5 6-5s6 2 6 5"/></svg>'
  };

  var SHOP_CATS = [
    { label: "Motor & aandrijving", q: "motor", icon: "motor" },
    { label: "Onderhoud & verf", q: "antifouling", icon: "paint" },
    { label: "Elektra & energie", q: "accu", icon: "bolt" },
    { label: "Veiligheid", q: "reddingsvest", icon: "ring" },
    { label: "Sanitair & water", q: "toilet", icon: "drop" },
    { label: "Rubberboten", q: "rubberboot", icon: "dinghy" }
  ];

  var ui = {
    tab: "shop",
    cartCount: 0,
    search: "",
    searchResults: null,
    searching: false,
    captain: null, // geladen bij eerste bezoek
    captainLoading: false,
    captainSending: false,
    captainError: "",
    sheet: false,
    sheetError: "",
    sheetSaving: false,
    form: null,
    installHidden: storageGet("ww-install-hidden") === "1"
  };

  // ---------- helpers ----------
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function euro(amount) {
    var n = Number(amount);
    if (!isFinite(n)) return "";
    try { return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n); }
    catch (e) { return "€ " + n.toFixed(2).replace(".", ","); }
  }
  function dateNl(iso) {
    if (!iso) return "";
    var d = new Date(iso + (iso.length === 10 ? "T12:00:00Z" : ""));
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
  }
  function today() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }
  function storageGet(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
  function storageSet(key, value) { try { window.localStorage.setItem(key, value); } catch (e) { /* niets */ } }
  function numericId(id) { return String(id || "").split("/").pop(); }
  function currentBoat() {
    for (var i = 0; i < (S.boats || []).length; i++) if (S.boats[i].id === S.boatId) return S.boats[i];
    return null;
  }
  function boatField(key) {
    var b = currentBoat();
    var v = b && b.data ? b.data[key] : "";
    return v == null ? "" : String(v).trim();
  }
  function engineLabel() {
    return [boatField("motormerk"), boatField("motormodel")].filter(Boolean).join(" ");
  }
  function toast(message, linkHref, linkText) {
    var old = document.querySelector(".ww-toast");
    if (old) old.remove();
    var el = document.createElement("div");
    el.className = "ww-toast";
    el.setAttribute("role", "status");
    el.innerHTML = esc(message) + (linkHref ? ' · <a href="' + esc(linkHref) + '" style="color:#FCD34D">' + esc(linkText) + "</a>" : "");
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 3500);
  }
  function formatAnswer(text) {
    var safe = esc(text || "");
    safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    safe = safe.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, '<a href="$2">$1</a>');
    return safe.split(/\n{2,}/).map(function (block) {
      var lines = block.split("\n");
      if (lines.every(function (l) { return /^\s*[-•]\s+/.test(l); })) {
        return "<ul style=\"margin:0;padding-left:18px\">" + lines.map(function (l) { return "<li>" + l.replace(/^\s*[-•]\s+/, "") + "</li>"; }).join("") + "</ul>";
      }
      return "<p>" + lines.join("<br>") + "</p>";
    }).join("");
  }

  // ---------- winkelwagen ----------
  function refreshCart() {
    fetch("/cart.js", { headers: { Accept: "application/json" }, credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        ui.cartCount = cart.item_count || 0;
        var badge = document.querySelector("[data-cart-badge]");
        if (badge) { badge.textContent = String(ui.cartCount); badge.hidden = !ui.cartCount; }
      })
      .catch(function () { /* stil */ });
  }
  function addToCart(variantId, button) {
    var id = Number(numericId(variantId));
    if (!id) return;
    if (button) button.disabled = true;
    fetch("/cart/add.js", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ items: [{ id: id, quantity: 1 }] })
    })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.data && (res.data.description || res.data.message) || "Toevoegen mislukt");
        if (button) { button.classList.add("is-done"); button.innerHTML = ICON.check; }
        toast("In je winkelwagen", "/checkout", "Afrekenen");
        refreshCart();
      })
      .catch(function (err) { toast(err.message || "Toevoegen mislukt"); })
      .then(function () { if (button) button.disabled = false; });
  }

  // ---------- productkaart ----------
  function productCard(p) {
    var img = p.image
      ? '<img class="ww-product-img" src="' + esc(p.image) + '" alt="" loading="lazy">'
      : '<div class="ww-product-img" aria-hidden="true"></div>';
    var add = p.variantId
      ? '<button type="button" class="ww-add" data-add="' + esc(p.variantId) + '" aria-label="' + esc(p.title) + ' in winkelwagen">' + ICON.plus + "</button>"
      : "";
    return '<div class="ww-product">' + img +
      '<a class="ww-product-body" href="' + esc(p.url) + '">' +
      '<span class="ww-product-title">' + esc(p.title) + "</span>" +
      (p.vendor ? '<span class="ww-small">' + esc(p.vendor) + "</span>" : "") +
      (p.price ? '<span class="ww-price">' + euro(p.price) + "</span>" : "") +
      "</a>" + add + "</div>";
  }

  // ---------- zoeken (Shopify predictive search) ----------
  var searchTimer = null;
  function runSearch(q) {
    ui.search = q;
    if (!q || q.length < 2) { ui.searchResults = null; renderResults(); return; }
    ui.searching = true; renderResults();
    var url = "/search/suggest.json?q=" + encodeURIComponent(q) +
      "&resources[type]=product&resources[limit]=10&resources[options][unavailable_products]=last";
    fetch(url, { headers: { Accept: "application/json" }, credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (ui.search !== q) return;
        var items = (data && data.resources && data.resources.results && data.resources.results.products) || [];
        ui.searchResults = items.map(function (p) {
          var variant = (p.variants || []).filter(function (v) { return v.available; })[0] || (p.variants || [])[0];
          return {
            title: p.title,
            vendor: p.vendor,
            url: (p.url || "").split("?")[0],
            image: p.featured_image && p.featured_image.url ? p.featured_image.url : (p.image || ""),
            price: p.price,
            variantId: variant ? String(variant.id) : ""
          };
        });
      })
      .catch(function () { ui.searchResults = []; })
      .then(function () { ui.searching = false; renderResults(); });
  }
  function renderResults() {
    var box = document.querySelector("[data-results]");
    var rest = document.querySelector("[data-shop-rest]");
    if (!box || !rest) return;
    if (ui.searchResults === null && !ui.searching) { box.innerHTML = ""; rest.hidden = false; return; }
    rest.hidden = true;
    if (ui.searching && !ui.searchResults) { box.innerHTML = '<div class="ww-section"><p class="ww-small">Zoeken…</p></div>'; return; }
    var list = ui.searchResults || [];
    box.innerHTML = '<section class="ww-section"><div class="ww-section-head"><h2>Resultaten</h2>' +
      '<a class="ww-link" href="/search?type=product&q=' + encodeURIComponent(ui.search) + '">Alles bekijken</a></div>' +
      (list.length ? list.map(productCard).join("") : '<div class="ww-empty">Niets gevonden voor “' + esc(ui.search) + '”. Probeer een ander woord of vraag het Captain AI.</div>') +
      "</section>";
  }

  // ---------- schermen ----------
  function header(title, sub, right) {
    return '<header class="ww-head"><div class="ww-head-row"><div>' +
      (title ? "<h1>" + esc(title) + "</h1>" : '<div class="ww-wordmark">WetterWinkel</div>') +
      (sub ? '<div class="ww-sub">' + esc(sub) + "</div>" : "") +
      "</div>" + (right || "") + "</div></header>";
  }
  function installHint() {
    var standalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if (standalone || ui.installHidden) return "";
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    var text = ios
      ? "Zet de app op je beginscherm: tik op <strong>Delen</strong> en kies <strong>Zet op beginscherm</strong>."
      : (deferredPrompt ? 'Zet de app op je beginscherm. <button type="button" class="ww-link" data-install>Installeren</button>'
        : "Zet de app op je beginscherm via het browsermenu → <strong>App installeren</strong>.");
    return '<div class="ww-install" style="margin-top:16px">' + ICON.boat + "<span>" + text +
      '</span><button type="button" data-install-close aria-label="Sluiten">×</button></div>';
  }

  function shopScreen() {
    var boat = currentBoat();
    var cart = '<a class="ww-icon-btn" href="/cart" aria-label="Winkelwagen">' + ICON.bag +
      '<span class="ww-badge" data-cart-badge' + (ui.cartCount ? "" : " hidden") + ">" + ui.cartCount + "</span></a>";
    var head = '<header class="ww-head"><div class="ww-head-row"><div class="ww-wordmark">WetterWinkel</div>' + cart + "</div>" +
      '<form class="ww-search" role="search" data-search-form><label class="sr-only" for="ww-q">Zoeken</label>' + ICON.search +
      '<input id="ww-q" type="search" enterkeyhint="search" autocomplete="off" placeholder="Zoek in 30.000+ artikelen" value="' + esc(ui.search) + '"></form></header>';
    var usp = '<div class="ww-usp"><span>Gratis verzending vanaf €100</span><span>20 dagen retour</span><span>1–3 werkdagen</span></div>';
    var chip = boat
      ? '<a class="ww-boatchip" href="#boot"><span class="ww-boatchip-icon">' + ICON.boat + '</span><span class="ww-boatchip-text"><span class="ww-small">Je winkelt voor</span><span class="ww-strong">' +
        esc(boat.name + (engineLabel() ? " · " + engineLabel() : "")) + '</span></span><span class="ww-link">Wijzig</span></a>'
      : '<a class="ww-boatchip" href="' + esc(S.profileUrl) + '"><span class="ww-boatchip-icon">' + ICON.boat + '</span><span class="ww-boatchip-text"><span class="ww-strong">Maak je bootprofiel</span><span class="ww-small">Dan zie je wat op jouw boot past</span></span></a>';
    var cats = '<div class="ww-cats">' + SHOP_CATS.map(function (c) {
      return '<button type="button" class="ww-cat" style="border:0;cursor:pointer" data-cat="' + esc(c.q) + '">' + ICON[c.icon] + esc(c.label) + "</button>";
    }).join("") + "</div>";
    var products = S.products || [];
    var title = boat && boatField("motormerk") ? "Voor jouw " + boatField("motormerk") : "Populair";
    var list = products.length
      ? products.map(productCard).join("")
      : '<div class="ww-empty">Nog geen suggesties. Zoek hierboven of vraag het Captain AI.</div>';
    return head + usp + installHint() +
      '<div data-results></div><div data-shop-rest>' +
      '<section class="ww-section">' + chip + "</section>" +
      '<section class="ww-section"><h2>Categorieën</h2>' + cats + "</section>" +
      '<section class="ww-section"><div class="ww-section-head"><h2>' + esc(title) + "</h2></div>" + list + "</section>" +
      "</div>";
  }

  function boatScreen() {
    var boats = S.boats || [];
    var add = '<a class="ww-btn ww-btn-sm" style="background:rgba(255,255,255,.12);color:#fff" href="' + esc(S.profileUrl) + '">+ Boot</a>';
    if (!boats.length) {
      return header("Je boot", "", add) +
        '<section class="ww-section"><div class="ww-empty"><strong style="color:#10202E">Nog geen bootprofiel</strong>' +
        "Maak gratis een bootprofiel aan. Dan weet de app welke onderdelen passen, kent Captain AI je boot en houd je je onderhoud bij." +
        '<a class="ww-btn ww-btn-primary" href="' + esc(S.profileUrl) + '">Bootprofiel maken</a></div></section>';
    }
    var boat = currentBoat() || boats[0];
    var d = boat.data || {};
    var pills = boats.length > 1
      ? '<div class="ww-tabs-boats" style="margin-top:16px">' + boats.map(function (b) {
          return '<button type="button" class="ww-pill' + (b.id === boat.id ? " is-active" : "") + '" data-boat="' + esc(b.id) + '">' + esc(b.name) + "</button>";
        }).join("") + "</div>"
      : "";
    var specs = [
      ["Motor", engineLabel()], ["Vermogen", d.motorvermogen], ["Bouwjaar", d.bouwjaar_boot],
      ["Lengte", d.lengte], ["Breedte", d.breedte], ["Diepgang", d.diepgang],
      ["Doorvaarthoogte", d.doorvaarthoogte], ["Brandstof", d.brandstof]
    ].filter(function (s) { return s[1] != null && String(s[1]).trim() !== ""; });
    var extra = [
      ["Boottype", d.boottype], ["Romp", d.materiaal_romp], ["Soort motor", d.soort_motor],
      ["Aantal motoren", d.aantal_motoren], ["Bouwjaar motor", d.bouwjaar_motor], ["Generator", d.merk_generator],
      ["Thuishaven", d.thuishaven || d.ligplaats], ["Vaargebied", d.vaargebied], ["Winterstalling", d.winterstalling]
    ].filter(function (s) { return s[1] != null && String(s[1]).trim() !== ""; });
    var sub = [d.merk_boot, d.model_boot].filter(Boolean).join(" ");
    return '<header class="ww-head" style="padding-bottom:84px"><div class="ww-head-row"><h1>Je boot</h1>' + add + "</div></header>" +
      '<section class="ww-boat-hero"><div class="ww-boat-photo">' + ICON.boat.replace('width="22" height="22"', 'width="48" height="48"') + "</div>" +
      '<div class="ww-boat-body"><div><div class="ww-boat-name">' + esc(boat.name) + "</div>" +
      (sub && sub !== boat.name ? '<div class="ww-small" style="font-size:14px">' + esc(sub) + "</div>" : "") + "</div>" +
      (specs.length ? '<div class="ww-specs">' + specs.map(function (s) {
        return '<div class="ww-spec"><span class="ww-small">' + esc(s[0]) + "</span><span>" + esc(s[1]) + "</span></div>";
      }).join("") + "</div>" : '<p class="ww-small" style="margin:0">Vul je bootprofiel aan voor betere suggesties.</p>') +
      "</div></section>" + pills +
      (extra.length ? '<section class="ww-section"><h2>Details</h2><div class="ww-list">' + extra.map(function (s) {
        return '<div class="ww-list-row"><span>' + esc(s[0]) + "</span><span>" + esc(s[1]) + "</span></div>";
      }).join("") + "</div></section>" : "") +
      '<section class="ww-section"><a class="ww-btn ww-btn-primary" href="#shop">Shop onderdelen voor ' + esc(boat.name) + "</a>" +
      '<a class="ww-btn ww-btn-ghost" href="' + esc(S.profileUrl) + '">Bootprofiel bewerken</a></section>';
  }

  function captainScreen() {
    var c = ui.captain;
    var counter = c && c.billing && c.billing.statusText
      ? '<span class="ww-counter">' + esc(c.remaining > 0 ? c.remaining + " van " + c.limit + " vandaag" : "Tegoed") + "</span>"
      : "";
    var boat = currentBoat();
    var head = '<header class="ww-head"><div class="ww-head-row" style="justify-content:flex-start"><span class="ww-avatar">' + ICON.captain +
      '</span><div style="flex:1"><h1 style="font-size:20px">Captain AI</h1><div class="ww-sub">Je eigen AI-schipper</div></div>' + counter + "</div>" +
      (boat ? '<div class="ww-sub">Kent jouw boot: ' + esc(boat.name + (engineLabel() ? " · " + engineLabel() : "")) + "</div>" : "") + "</header>";

    var body = "";
    if (ui.captainLoading && !c) body = '<p class="ww-small">Captain AI wordt geladen…</p>';
    else if (ui.captainError && !c) body = '<div class="ww-notice">' + esc(ui.captainError) + "</div>";
    else if (c) {
      var hist = c.history || [];
      if (!hist.length) {
        body = '<div class="ww-msg ww-msg-ai"><p>Ahoy' + (S.firstName ? " " + esc(S.firstName) : "") +
          "! Ik ben Captain AI. Vraag me alles over onderhoud, onderdelen of je boot" + (boat ? ", ik ken de " + esc(boat.name) : "") + ".</p></div>";
      }
      body += hist.map(messageHtml).join("");
      if (ui.captainSending) body += '<div class="ww-msg ww-msg-ai ww-typing" aria-label="Captain AI typt"><span></span><span></span><span></span></div>';
      if (ui.captainError) body += '<div class="ww-notice">' + esc(ui.captainError) + "</div>";
      if (c.limitReached) body += limitNotice(c);
    }

    var engine = boatField("motormerk") ? "mijn " + boatField("motormerk") : "mijn motor";
    var chips = [
      "Welke bougie past op " + engine + "?",
      "Hoe maak ik mijn boot winterklaar?",
      "Welke antifouling past bij mijn boot?",
      "Wanneer moet de impeller vervangen?"
    ];
    var composer = '<form class="ww-composer" data-captain-form>' +
      '<div class="ww-chips">' + chips.map(function (t) { return '<button type="button" class="ww-chip" data-ask="' + esc(t) + '">' + esc(t) + "</button>"; }).join("") + "</div>" +
      '<div class="ww-composer-row"><label class="sr-only" for="ww-ask">Stel je vraag</label>' +
      '<input id="ww-ask" type="text" enterkeyhint="send" maxlength="1500" placeholder="Vraag het Captain AI…" autocomplete="off">' +
      '<button type="submit" class="ww-send" aria-label="Verstuur"' + (ui.captainSending ? " disabled" : "") + ">" + ICON.send + "</button></div></form>";
    return '<div class="ww-captain">' + head + '<div class="ww-chat" data-chat>' + body + "</div>" + composer + "</div>";
  }

  function messageHtml(m) {
    if (m.role === "USER") return '<div class="ww-msg ww-msg-user">' + esc(m.content) + "</div>";
    var products = (m.products || []).slice(0, 4).map(function (p) {
      return productCard({ title: p.title, vendor: p.vendor, url: p.url, image: p.imageUrl, price: p.price, variantId: p.available === false ? "" : p.variantId });
    }).join("");
    return '<div class="ww-msg ww-msg-ai">' + formatAnswer(m.content) + products + "</div>";
  }

  function limitNotice(c) {
    var packs = (c.billing && c.billing.packs) || [];
    var canBuy = c.billing && c.billing.canBuy;
    return '<div class="ww-notice"><strong>Je gratis vragen voor vandaag zijn op.</strong><br>Morgen kun je weer gratis vragen stellen' +
      (canBuy && packs.length ? ", of koop extra vragen:" : ".") +
      (canBuy ? '<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">' + packs.map(function (p) {
        return '<button type="button" class="ww-btn ww-btn-dark ww-btn-sm" style="width:100%" data-buy="' + esc(p.id) + '">' + esc(p.label) + " · " + esc(p.price) + "</button>";
      }).join("") + "</div>" : "") + "</div>";
  }

  function serviceScreen() {
    var boat = currentBoat();
    var add = boat ? '<button type="button" class="ww-btn ww-btn-amber ww-btn-sm" data-open-sheet>+ Onderhoud</button>' : "";
    var head = header("Serviceboek", boat ? boat.name + (engineLabel() ? " · " + engineLabel() : "") : "", add);
    if (!boat) {
      return head + '<section class="ww-section"><div class="ww-empty">Je serviceboek hoort bij je boot. Maak eerst een bootprofiel aan.' +
        '<a class="ww-btn ww-btn-primary" href="' + esc(S.profileUrl) + '">Bootprofiel maken</a></div></section>';
    }
    var entries = S.entries || [];
    var planned = entries.filter(function (e) { return e.status === "PLANNED"; })
      .sort(function (a, b) { return a.serviceDate < b.serviceDate ? -1 : 1; });
    var done = entries.filter(function (e) { return e.status !== "PLANNED"; });
    var dueFromDone = done.filter(function (e) { return e.nextServiceDate; })
      .map(function (e) { return { title: e.title, date: e.nextServiceDate, category: e.category }; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0];

    var next = "";
    if (planned.length || dueFromDone) {
      var p = planned[0];
      var title = p ? p.title : dueFromDone.title;
      var date = p ? p.serviceDate : dueFromDone.date;
      var cat = p ? p.category : dueFromDone.category;
      next = '<section class="ww-section"><div class="ww-next"><span class="ww-kicker">Binnenkort · ' + esc(dateNl(date)) + "</span>" +
        '<h2 style="font-size:20px">' + esc(title) + "</h2>" +
        (p && p.description ? '<p class="ww-entry-desc" style="margin:0">' + esc(p.description) + "</p>" : "") +
        '<button type="button" class="ww-btn ww-btn-primary" data-shop-for="' + esc(cat) + '">Bestel wat je nodig hebt</button></div></section>';
    }

    var timeline = done.length
      ? '<div class="ww-timeline">' + done.map(function (e, i) {
          var meta = [e.engineHours !== "" && e.engineHours != null ? e.engineHours + " motoruren" : "", e.cost ? "€ " + e.cost : ""].filter(Boolean).join(" · ");
          return '<div class="ww-entry"><div class="ww-dot-col"><span class="ww-dot"></span>' + (i < done.length - 1 ? '<span class="ww-rail"></span>' : "") + "</div>" +
            '<div class="ww-entry-card"><div class="ww-entry-meta"><span>' + esc(dateNl(e.serviceDate)) + "</span><span>" + esc(e.performedBy) + "</span></div>" +
            '<span class="ww-strong">' + esc(e.title) + "</span>" +
            '<span class="ww-small">' + esc(e.category) + (meta ? " · " + esc(meta) : "") + "</span>" +
            (e.description ? '<span class="ww-entry-desc">' + esc(e.description) + "</span>" : "") +
            (e.partsMaterials ? '<span class="ww-entry-desc">Onderdelen: ' + esc(e.partsMaterials) + "</span>" : "") +
            "</div></div>";
        }).join("") + "</div>"
      : '<div class="ww-empty">Nog geen onderhoud vastgelegd. Leg je eerste beurt vast, dan zie je hier de historie van je boot.' +
        '<button type="button" class="ww-btn ww-btn-primary" data-open-sheet>Onderhoud toevoegen</button></div>';

    var morePlanned = planned.slice(1).map(function (e) {
      return '<div class="ww-list-row"><span>' + esc(dateNl(e.serviceDate)) + "</span><span>" + esc(e.title) + "</span></div>";
    }).join("");

    return head + next +
      (morePlanned ? '<section class="ww-section"><h2>Gepland</h2><div class="ww-list">' + morePlanned + "</div></section>" : "") +
      '<section class="ww-section"><h2>Historie</h2>' + timeline + "</section>";
  }

  function sheetHtml() {
    var f = ui.form;
    var opt = CATEGORIES.map(function (c) { return "<option" + (c === f.category ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("");
    var doneMode = f.status === "COMPLETED";
    return '<div class="ww-sheet-bg" data-sheet-bg><form class="ww-sheet" data-sheet-form role="dialog" aria-modal="true" aria-labelledby="ww-sheet-title">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><h2 id="ww-sheet-title" style="font-size:20px">Onderhoud toevoegen</h2>' +
      '<button type="button" class="ww-link" data-close-sheet>Annuleer</button></div>' +
      '<div class="ww-seg" role="group" aria-label="Status"><button type="button" data-status="COMPLETED" class="' + (doneMode ? "is-active" : "") + '" aria-pressed="' + doneMode + '">Uitgevoerd</button>' +
      '<button type="button" data-status="PLANNED" class="' + (!doneMode ? "is-active" : "") + '" aria-pressed="' + !doneMode + '">Gepland</button></div>' +
      '<div class="ww-row2"><label class="ww-field">Datum<input type="date" name="serviceDate" required value="' + esc(f.serviceDate) + '"></label>' +
      '<label class="ww-field">Motoruren<input type="number" inputmode="numeric" min="0" name="engineHours" value="' + esc(f.engineHours) + '"></label></div>' +
      '<label class="ww-field">Categorie<select name="category">' + opt + "</select></label>" +
      '<label class="ww-field">Titel<input type="text" name="title" maxlength="250" placeholder="Bijv. olie en filter vervangen" value="' + esc(f.title) + '"></label>' +
      '<label class="ww-field">Wat is er gedaan?<textarea name="description" maxlength="10000" required>' + esc(f.description) + "</textarea></label>" +
      '<label class="ww-field">' + (doneMode ? "Uitgevoerd door *" : "Uit te voeren door") + '<input type="text" name="performedBy" maxlength="250" placeholder="Zelf, of naam monteur" value="' + esc(f.performedBy) + '"' + (doneMode ? " required" : "") + "></label>" +
      '<label class="ww-field">Gebruikte onderdelen<input type="text" name="partsMaterials" maxlength="5000" value="' + esc(f.partsMaterials) + '"></label>' +
      '<div class="ww-row2"><label class="ww-field">Kosten (€)<input type="text" inputmode="decimal" name="cost" value="' + esc(f.cost) + '"></label>' +
      '<label class="ww-field">Volgende beurt<input type="date" name="nextServiceDate" value="' + esc(f.nextServiceDate) + '"></label></div>' +
      (ui.sheetError ? '<p class="ww-error" role="alert">' + esc(ui.sheetError) + "</p>" : "") +
      '<button type="submit" class="ww-btn ww-btn-primary"' + (ui.sheetSaving ? " disabled" : "") + ">" + (ui.sheetSaving ? "Opslaan…" : "Opslaan") + "</button>" +
      "</form></div>";
  }

  function nav() {
    var items = [["shop", "Shoppen", ICON.bag], ["boot", "Je boot", ICON.boat], ["captain", "Captain AI", ICON.chat], ["service", "Serviceboek", ICON.book]];
    return '<nav class="ww-nav" aria-label="Hoofdmenu"><div class="ww-nav-inner">' + items.map(function (it) {
      return '<a href="#' + it[0] + '"' + (ui.tab === it[0] ? ' aria-current="page"' : "") + ">" + it[2] + esc(it[1]) + "</a>";
    }).join("") + "</div></nav>";
  }

  // ---------- render ----------
  function render() {
    var screen = ui.tab === "boot" ? boatScreen() : ui.tab === "captain" ? captainScreen() : ui.tab === "service" ? serviceScreen() : shopScreen();
    root.innerHTML = screen + nav() + (ui.sheet ? sheetHtml() : "");
    if (ui.tab === "shop") renderResults();
    if (ui.tab === "captain") {
      var chat = document.querySelector("[data-chat]");
      if (chat) window.scrollTo(0, document.body.scrollHeight);
    }
  }

  function setTab(tab) {
    var valid = { shop: 1, boot: 1, captain: 1, service: 1 };
    ui.tab = valid[tab] ? tab : "shop";
    render();
    if (ui.tab !== "captain") window.scrollTo(0, 0);
    if (ui.tab === "captain" && !ui.captain && !ui.captainLoading) loadCaptain();
  }

  // ---------- Captain AI (bestaande endpoint /apps/bootmarkt/captain-ai) ----------
  function loadCaptain() {
    ui.captainLoading = true; ui.captainError = "";
    render();
    fetch("/apps/bootmarkt/captain-ai", { headers: { Accept: "application/json" }, credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || data.success === false) throw new Error((data && data.message) || "Captain AI kon niet worden geladen.");
        ui.captain = data;
      })
      .catch(function (err) { ui.captainError = err.message || "Captain AI kon niet worden geladen."; })
      .then(function () { ui.captainLoading = false; if (ui.tab === "captain") render(); });
  }
  function askCaptain(question) {
    question = String(question || "").trim();
    if (!question || ui.captainSending) return;
    if (!ui.captain) ui.captain = { history: [] };
    ui.captain.history = (ui.captain.history || []).concat([{ role: "USER", content: question }]);
    ui.captainSending = true; ui.captainError = "";
    render();
    fetch("/apps/bootmarkt/captain-ai", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ message: question, profileId: S.boatId || "", conversationId: ui.captain.conversationId || "" })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || data.success === false) {
          if (data && data.limitReached) { ui.captain.limitReached = true; ui.captain.billing = data.billing || ui.captain.billing; }
          throw new Error((data && data.message) || "Captain AI kon deze vraag niet beantwoorden.");
        }
        ui.captain.history = ui.captain.history.concat([data.message]);
        ui.captain.conversationId = data.conversationId;
        ui.captain.remaining = data.remaining;
        ui.captain.limit = data.limit;
        ui.captain.limitReached = data.limitReached;
        ui.captain.billing = data.billing || ui.captain.billing;
      })
      .catch(function (err) { ui.captainError = err.message; })
      .then(function () { ui.captainSending = false; if (ui.tab === "captain") render(); });
  }
  function buyCaptain(pack) {
    fetch("/apps/bootmarkt/captain-ai", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ intent: "buy", pack: pack, profileId: S.boatId || "" })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.checkoutUrl) window.location.href = data.checkoutUrl;
        else toast((data && data.message) || "Kopen lukt nu niet.");
      })
      .catch(function () { toast("Kopen lukt nu niet."); });
  }

  // ---------- Serviceboek ----------
  function openSheet() {
    ui.form = { status: "COMPLETED", serviceDate: today(), engineHours: "", category: CATEGORIES[0], title: "", description: "", performedBy: "", partsMaterials: "", cost: "", nextServiceDate: "" };
    ui.sheet = true; ui.sheetError = "";
    render();
  }
  function readForm(form) {
    var data = new FormData(form);
    ["serviceDate", "engineHours", "category", "title", "description", "performedBy", "partsMaterials", "cost", "nextServiceDate"].forEach(function (k) {
      ui.form[k] = String(data.get(k) || "");
    });
  }
  function saveEntry() {
    ui.sheetSaving = true; ui.sheetError = ""; render();
    fetch(S.appPath, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ intent: "service_create", profileId: S.boatId, entry: ui.form })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.success) throw new Error((data && data.message) || "Opslaan mislukt.");
        S.entries = data.entries || S.entries;
        ui.sheet = false;
        toast("Opgeslagen in je serviceboek");
      })
      .catch(function (err) { ui.sheetError = err.message; })
      .then(function () { ui.sheetSaving = false; render(); });
  }

  // ---------- events ----------
  var deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferredPrompt = e; if (ui.tab === "shop") render(); });

  root.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("button, a") : null;
    if (!t) return;
    if (t.hasAttribute("data-add")) { e.preventDefault(); addToCart(t.getAttribute("data-add"), t); return; }
    if (t.hasAttribute("data-cat")) {
      var q = t.getAttribute("data-cat");
      var input = document.getElementById("ww-q");
      if (input) input.value = q;
      runSearch(q); window.scrollTo(0, 0); return;
    }
    if (t.hasAttribute("data-boat")) {
      window.location.href = S.appPath + "?boot=" + encodeURIComponent(t.getAttribute("data-boat")) + "#boot"; return;
    }
    if (t.hasAttribute("data-ask")) { askCaptain(t.getAttribute("data-ask")); return; }
    if (t.hasAttribute("data-buy")) { buyCaptain(t.getAttribute("data-buy")); return; }
    if (t.hasAttribute("data-open-sheet")) { openSheet(); return; }
    if (t.hasAttribute("data-close-sheet")) { ui.sheet = false; render(); return; }
    if (t.hasAttribute("data-status")) {
      var form = document.querySelector("[data-sheet-form]");
      if (form) readForm(form);
      ui.form.status = t.getAttribute("data-status"); render(); return;
    }
    if (t.hasAttribute("data-shop-for")) {
      ui.search = ""; window.location.hash = "#captain";
      setTimeout(function () { askCaptain("Wat heb ik nodig voor: " + t.getAttribute("data-shop-for") + "?"); }, 50);
      return;
    }
    if (t.hasAttribute("data-install-close")) { ui.installHidden = true; storageSet("ww-install-hidden", "1"); render(); return; }
    if (t.hasAttribute("data-install") && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () { deferredPrompt = null; render(); });
    }
  });

  root.addEventListener("input", function (e) {
    if (e.target && e.target.id === "ww-q") {
      var q = e.target.value.trim();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { runSearch(q); }, 300);
    }
  });

  root.addEventListener("submit", function (e) {
    var form = e.target;
    if (form.hasAttribute("data-search-form")) {
      e.preventDefault();
      var input = document.getElementById("ww-q");
      clearTimeout(searchTimer);
      runSearch(input ? input.value.trim() : "");
      if (input) input.blur();
      return;
    }
    if (form.hasAttribute("data-captain-form")) {
      e.preventDefault();
      var ask = document.getElementById("ww-ask");
      var q = ask ? ask.value : "";
      if (ask) ask.value = "";
      askCaptain(q);
      return;
    }
    if (form.hasAttribute("data-sheet-form")) {
      e.preventDefault();
      readForm(form);
      saveEntry();
    }
  });

  root.addEventListener("mousedown", function (e) {
    if (e.target && e.target.hasAttribute && e.target.hasAttribute("data-sheet-bg")) { ui.sheet = false; render(); }
  });

  window.addEventListener("hashchange", function () { setTab(window.location.hash.replace("#", "")); });

  // start
  setTab(window.location.hash.replace("#", "") || "shop");
  refreshCart();
})();
