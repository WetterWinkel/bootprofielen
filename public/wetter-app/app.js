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
    share: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v8h14v-8"/></svg>',
    home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
    wind: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h16a3 3 0 1 1-3 3"/><path d="M3 16h7"/></svg>',
    market: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12l-8 8-9-9V3h8l9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
    box: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></svg>',
    user: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.5 3.5-7 8-7s7.2 2.5 8 7"/></svg>',
    back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    pin: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
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
    tab: "home",
    weather: null,
    weatherLoading: false,
    weatherError: "",
    place: null,
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
    var ua = navigator.userAgent;
    var ios = /iphone|ipad|ipod/i.test(ua);
    var iosNotSafari = ios && /crios|fxios|edgios|instagram|fban|fbav/i.test(ua);
    var steps;
    if (deferredPrompt) {
      steps = '<button type="button" class="ww-btn ww-btn-primary" data-install>Installeer de app</button>';
    } else if (iosNotSafari) {
      steps = "<ol class=\"ww-steps\"><li>Open deze pagina in <strong>Safari</strong></li><li>Tik op <strong>Delen</strong> " + ICON.share + "</li><li>Kies <strong>Zet op beginscherm</strong></li></ol>";
    } else if (ios) {
      steps = "<ol class=\"ww-steps\"><li>Tik onderin op <strong>Delen</strong> " + ICON.share + "</li><li>Scroll en kies <strong>Zet op beginscherm</strong></li><li>Tik op <strong>Voeg toe</strong></li></ol>";
    } else {
      steps = "<ol class=\"ww-steps\"><li>Open het menu <strong>⋮</strong> rechtsboven</li><li>Kies <strong>App installeren</strong> of <strong>Toevoegen aan startscherm</strong></li></ol>";
    }
    return '<section class="ww-install-card"><div class="ww-install-top"><img src="' + esc(S.iconUrl || "") + '" alt="" width="48" height="48">' +
      '<div><strong>Zet WetterWinkel op je telefoon</strong><span>Eén tik en je bent aan boord.</span></div>' +
      '<button type="button" data-install-close aria-label="Sluiten">×</button></div>' + steps + "</section>";
  }


  var LOGO_URL = "https://cdn.shopify.com/s/files/1/1035/9495/0996/files/8ab183bf-319f-4e98-9b12-df45ce6862b2.png?v=1780527341";

  function homeScreen() {
    var boats = S.boats || [];
    var boat = currentBoat();
    var login = S.firstName || S.loggedIn
      ? '<div class="ww-login-row">' + ICON.user + "<span>Ingelogd als <strong>" + esc(S.firstName || "klant") + '</strong></span><a class="ww-link" href="/account">Mijn account</a></div>'
      : '<div class="ww-login-row"><a class="ww-btn ww-btn-primary" href="/account/login?return_url=' + encodeURIComponent(S.appPath) + '">Inloggen</a></div>';
    var cart = '<a class="ww-icon-btn ww-icon-btn-light" href="/cart" aria-label="Winkelwagen">' + ICON.bag +
      '<span class="ww-badge" data-cart-badge' + (ui.cartCount ? "" : " hidden") + ">" + ui.cartCount + "</span></a>";
    var head = '<header class="ww-home-head"><div class="ww-home-top"><span style="width:44px"></span>' +
      '<img class="ww-logo" src="' + LOGO_URL + '" alt="WetterWinkel – voor maximaal watersportplezier" width="600" height="300">' + cart + "</div>" + login + "</header>";

    var captain = '<section class="ww-section"><form class="ww-captain-hero" data-home-ask>' +
      '<div class="ww-captain-hero-top"><span class="ww-avatar">' + ICON.captain + '</span><div><strong>Ahoy' + (S.firstName ? " " + esc(S.firstName) : "") +
      '! Ik ben Captain AI.</strong><span>Waarmee kunnen we je helpen?</span></div></div>' +
      '<div class="ww-composer-row"><label class="sr-only" for="ww-home-q">Vraag het Captain AI</label>' +
      '<input id="ww-home-q" type="text" enterkeyhint="send" maxlength="1500" placeholder="Bijv. welke impeller past op mijn motor?" autocomplete="off">' +
      '<button type="submit" class="ww-send ww-send-amber" aria-label="Verstuur">' + ICON.send + "</button></div></form></section>";

    var boatsLabel = boats.length > 1 ? "Uw boten" : "Uw boot";
    var boatSub = boat ? boat.name + (boats.length > 1 ? " +" + (boats.length - 1) : "") : "Maak je bootprofiel";
    var w = ui.weather && ui.weather.current;
    var tiles = [
      { href: "#vaarinfo", icon: "wind", title: "Actuele vaarinformatie", sub: w ? Math.round(w.wind_speed_10m) + " kn · " + beaufort(w.wind_speed_10m) + " Bft " + windDir(w.wind_direction_10m) : "Wind, weer, bruggen & sluizen", big: true },
      { href: "#kaart", icon: "pin", title: "Vaarkaart", sub: "Bruggen, sluizen & jachthavens" },
      { href: "#boot", icon: "boat", title: boatsLabel, sub: boatSub },
      { href: "#shop", icon: "bag", title: "Shoppen", sub: "30.000+ artikelen" },
      { href: "/apps/bootmarkt", icon: "market", title: "Bootmarkt", sub: "Boten kopen & verkopen" },
      { href: "#service", icon: "book", title: "Serviceboek", sub: (S.entries || []).length ? (S.entries.length + " registraties") : "Onderhoud bijhouden" },
      { href: "/account", icon: "box", title: "Bestellingen", sub: "Status & facturen" },
      { href: "#captain", icon: "chat", title: "Captain AI", sub: "Je AI-schipper" }
    ];
    var grid = '<section class="ww-section"><div class="ww-tiles">' + tiles.map(function (t) {
      return '<a class="ww-tile' + (t.big ? " ww-tile-big" : "") + '" href="' + esc(t.href) + '"><span class="ww-tile-icon">' + (ICON[t.icon] || "") + "</span>" +
        '<span class="ww-tile-title">' + esc(t.title) + '</span><span class="ww-tile-sub">' + esc(t.sub) + "</span></a>";
    }).join("") + "</div></section>";

    return head + installHint() + captain + grid;
  }

  // ---------- Vaarinformatie (Open-Meteo, testfase) ----------
  var WMO = { 0: "Onbewolkt", 1: "Overwegend helder", 2: "Half bewolkt", 3: "Bewolkt", 45: "Mist", 48: "Mist met rijp",
    51: "Lichte motregen", 53: "Motregen", 55: "Dichte motregen", 61: "Lichte regen", 63: "Regen", 65: "Zware regen",
    66: "IJzel", 67: "Zware ijzel", 71: "Lichte sneeuw", 73: "Sneeuw", 75: "Zware sneeuw", 80: "Lichte buien", 81: "Buien",
    82: "Zware buien", 85: "Sneeuwbuien", 86: "Zware sneeuwbuien", 95: "Onweer", 96: "Onweer met hagel", 99: "Zwaar onweer met hagel" };
  function beaufort(kn) {
    var limits = [1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64];
    for (var i = 0; i < limits.length; i++) if (kn < limits[i]) return i;
    return 12;
  }
  function windDir(deg) {
    var dirs = ["N", "NNO", "NO", "ONO", "O", "OZO", "ZO", "ZZO", "Z", "ZZW", "ZW", "WZW", "W", "WNW", "NW", "NNW"];
    return dirs[Math.round(((Number(deg) % 360) / 22.5)) % 16];
  }
  function loadWeather(lat, lon, label) {
    ui.weatherLoading = true; ui.weatherError = "";
    ui.place = { lat: lat, lon: lon, label: label };
    if (ui.tab === "vaarinfo") render();
    fetch(S.appPath + "/weer?lat=" + Number(lat).toFixed(4) + "&lon=" + Number(lon).toFixed(4), { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (r) { return r.json().catch(function () { return { success: false, message: "Weer niet beschikbaar (" + r.status + ")" }; }); })
      .then(function (d) {
        if (!d || !d.success || !d.weather) throw new Error((d && d.message) || "Weer niet beschikbaar");
        ui.weather = d.weather; ui.marine = d.marine; storageSet("ww-place", JSON.stringify(ui.place));
      })
      .catch(function (err) { ui.weatherError = err.message || "Weer niet beschikbaar"; })
      .then(function () { ui.weatherLoading = false; if (ui.tab === "vaarinfo" || ui.tab === "home") render(); });
  }
  function locateMe() {
    if (!navigator.geolocation) { ui.weatherError = "Je telefoon geeft geen locatie door."; render(); return; }
    ui.weatherLoading = true; ui.weatherError = ""; render();
    navigator.geolocation.getCurrentPosition(
      function (pos) { loadWeather(pos.coords.latitude, pos.coords.longitude, "Jouw locatie"); },
      function () { ui.weatherLoading = false; ui.weatherError = "Geen toegang tot je locatie. Sta locatie toe of zoek een plaats."; render(); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  }
  function searchPlace(name) {
    name = String(name || "").trim();
    if (!name) return;
    ui.weatherLoading = true; ui.weatherError = ""; render();
    fetch("https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?rows=1&fq=type:(woonplaats%20OR%20gemeente%20OR%20weg)&q=" + encodeURIComponent(name))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var doc = d && d.response && d.response.docs && d.response.docs[0];
        var m = doc && /POINT\(([-0-9.]+) ([-0-9.]+)\)/.exec(doc.centroide_ll || "");
        if (!m) throw new Error("Plaats niet gevonden: " + name);
        loadWeather(parseFloat(m[2]), parseFloat(m[1]), doc.weergavenaam);
      })
      .catch(function (err) { ui.weatherLoading = false; ui.weatherError = err.message; render(); });
  }
  function ensureWeather() {
    if (ui.weather || ui.weatherLoading) return;
    var saved = null;
    try { saved = JSON.parse(storageGet("ww-place") || "null"); } catch (e) { saved = null; }
    if (saved && typeof saved.lat === "number") { loadWeather(saved.lat, saved.lon, saved.label); return; }
    var harbour = boatField("thuishaven") || boatField("ligplaats");
    if (harbour) { searchPlace(harbour); return; }
  }

  function vaarinfoScreen() {
    var head = '<header class="ww-head"><div class="ww-head-row" style="justify-content:flex-start">' +
      '<a class="ww-icon-btn" href="#home" aria-label="Terug">' + ICON.back + '</a><div style="flex:1"><h1 style="font-size:22px">Actuele vaarinformatie</h1>' +
      '<div class="ww-sub">' + esc(ui.place ? ui.place.label : "Kies je locatie") + "</div></div></div>" +
      '<form class="ww-search" data-place-form><label class="sr-only" for="ww-place">Plaats of haven</label>' + ICON.pin +
      '<input id="ww-place" type="search" enterkeyhint="search" placeholder="Plaats of haven" autocomplete="off">' +
      '<button type="button" class="ww-link" data-locate style="white-space:nowrap">Mijn locatie</button></form></header>';
    var body = "";
    if (ui.weatherLoading) body = '<section class="ww-section"><p class="ww-small">Vaarinformatie laden…</p></section>';
    else if (ui.weatherError) body = '<section class="ww-section"><div class="ww-notice">' + esc(ui.weatherError) + "</div></section>";
    if (!ui.weather && !ui.weatherLoading) {
      body += '<section class="ww-section"><div class="ww-empty">Zie direct wind, weer en golven waar je vaart.' +
        '<button type="button" class="ww-btn ww-btn-primary" data-locate>Gebruik mijn locatie</button></div></section>';
    }
    if (ui.weather && ui.weather.current) {
      var c = ui.weather.current;
      var bft = beaufort(c.wind_speed_10m);
      var warn = bft >= 6 ? '<div class="ww-notice"><strong>Let op: ' + bft + " Bft.</strong> Voor kleine boten en rubberboten is dit te veel wind.</div>" : "";
      var marine = ui.marine && ui.marine.current && ui.marine.current.wave_height != null
        ? '<div class="ww-spec"><span class="ww-small">Golfhoogte</span><span>' + ui.marine.current.wave_height.toFixed(1).replace(".", ",") + " m</span></div>" : "";
      body += '<section class="ww-section">' + warn +
        '<div class="ww-wind-card"><div class="ww-wind-main"><span class="ww-wind-arrow" style="transform:rotate(' + ((c.wind_direction_10m + 180) % 360) + 'deg)" aria-hidden="true">↑</span>' +
        '<div><div class="ww-wind-bft">' + bft + ' Bft <span>' + windDir(c.wind_direction_10m) + "</span></div>" +
        '<div class="ww-small" style="color:#C9D6E2">' + Math.round(c.wind_speed_10m) + " kn · stoten " + Math.round(c.wind_gusts_10m) + " kn</div></div></div>" +
        '<div class="ww-wind-side"><div class="ww-wind-temp">' + Math.round(c.temperature_2m) + "°</div><div>" + esc(WMO[c.weather_code] || "") + "</div></div></div>" +
        '<div class="ww-specs ww-specs-white">' +
        '<div class="ww-spec"><span class="ww-small">Neerslag nu</span><span>' + (c.precipitation || 0).toString().replace(".", ",") + " mm</span></div>" + marine +
        (ui.weather.daily ? '<div class="ww-spec"><span class="ww-small">Zon op / onder</span><span>' + esc(String(ui.weather.daily.sunrise[0]).slice(11)) + " – " + esc(String(ui.weather.daily.sunset[0]).slice(11)) + "</span></div>" : "") +
        "</div></section>";

      var h = ui.weather.hourly;
      if (h && h.time) {
        var now = Date.now(), rows = [];
        for (var i = 0; i < h.time.length && rows.length < 12; i++) {
          var t = new Date(h.time[i]).getTime();
          if (t < now - 3600000) continue;
          rows.push('<div class="ww-hour"><span>' + esc(h.time[i].slice(11, 16)) + '</span><strong>' + beaufort(h.wind_speed_10m[i]) + ' Bft</strong><span class="ww-small">' +
            windDir(h.wind_direction_10m[i]) + "</span><span class=\"ww-small\">" + (h.precipitation_probability[i] == null ? "" : h.precipitation_probability[i] + "% regen") + "</span></div>");
        }
        body += '<section class="ww-section"><h2>Komende uren</h2><div class="ww-hours">' + rows.join("") + "</div></section>";
      }
      var d = ui.weather.daily;
      if (d && d.time) {
        body += '<section class="ww-section"><h2>Komende dagen</h2><div class="ww-list">' + d.time.map(function (day, i) {
          var label = i === 0 ? "Vandaag" : new Date(day + "T12:00:00").toLocaleDateString("nl-NL", { weekday: "long" });
          label = label.charAt(0).toUpperCase() + label.slice(1);
          return '<div class="ww-list-row"><span>' + esc(label) + "</span><span>" + beaufort(d.wind_speed_10m_max[i]) + " Bft · " +
            Math.round(d.temperature_2m_max[i]) + "° · " + esc(WMO[d.weather_code[i]] || "") + "</span></div>";
        }).join("") + "</div></section>";
      }
    }
    body += '<section class="ww-section"><a class="ww-btn ww-btn-primary" href="#kaart">Open de vaarkaart</a></section>';
    body += '<section class="ww-section"><h2>Vaarwegen</h2><div class="ww-list">' +
      '<a class="ww-list-row ww-list-link" href="https://www.vaarweginformatie.nl/frp/main/#/geo/map" target="_blank" rel="noopener"><span>Bruggen &amp; sluizen</span><span>Bedieningstijden ›</span></a>' +
      '<a class="ww-list-row ww-list-link" href="https://www.vaarweginformatie.nl/frp/main/#/nts" target="_blank" rel="noopener"><span>Berichten aan de scheepvaart</span><span>Stremmingen ›</span></a>' +
      '<a class="ww-list-row ww-list-link" href="https://waterinfo.rws.nl/" target="_blank" rel="noopener"><span>Waterstanden</span><span>Rijkswaterstaat ›</span></a>' +
      '<a class="ww-list-row ww-list-link" href="https://www.knmi.nl/nederland-nu/weer/waarschuwingen" target="_blank" rel="noopener"><span>Weerwaarschuwingen</span><span>KNMI ›</span></a>' +
      '</div><p class="ww-small" style="margin:0">Weerdata: Open-Meteo.com (CC BY 4.0). Controleer altijd de officiële berichten voordat je vaart.</p></section>';
    return head + body;
  }


  // ---------- Vaarkaart (Leaflet + Rijkswaterstaat FIS) ----------
  var FIS_WFS = "https://geo.rijkswaterstaat.nl/services/ogc/gdr/fis_vnds/ows?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&count=800";
  var map = null, mapLayers = null, mapObjects = {}, mapOpenings = {}, mapLoadTimer = null, watchId = null, meMarker = null, meAccuracy = null;
  var leafletLoading = null, lineRenderer = null;

  function airDraft() {
    var saved = storageGet("ww-airdraft");
    var raw = saved || boatField("doorvaarthoogte");
    var n = parseFloat(String(raw || "").replace(",", ".").replace(/[^0-9.]/g, ""));
    return isFinite(n) && n > 0 && n < 40 ? n : null;
  }
  function fmtM(n) { return n == null ? "?" : (Math.round(n * 100) / 100).toString().replace(".", ",") + " m"; }

  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    if (leafletLoading) return leafletLoading;
    leafletLoading = new Promise(function (resolve, reject) {
      var css = document.createElement("link");
      css.rel = "stylesheet"; css.href = S.assetBase + "/vendor/leaflet/leaflet.css";
      document.head.appendChild(css);
      var js = document.createElement("script");
      js.src = S.assetBase + "/vendor/leaflet/leaflet.js";
      js.onload = function () { resolve(); };
      js.onerror = function () { leafletLoading = null; reject(new Error("Kaart kon niet laden")); };
      document.head.appendChild(js);
    });
    return leafletLoading;
  }

  function kaartScreen() {
    var ad = airDraft();
    return '<div class="ww-map-screen">' +
      '<header class="ww-map-head"><a class="ww-icon-btn" href="#home" aria-label="Terug">' + ICON.back + "</a>" +
      '<div style="flex:1;min-width:0"><h1 style="font-size:19px;color:#fff">Vaarkaart</h1>' +
      '<button type="button" class="ww-airdraft" data-airdraft>' + (ad ? "Doorvaarthoogte boot: <strong>" + fmtM(ad) + "</strong> · wijzig" : "Stel je doorvaarthoogte in") + "</button></div>" +
      '<span class="ww-map-speed" data-speed hidden></span><button type="button" class="ww-btn ww-btn-amber ww-btn-sm" data-route-open>Route</button></header>' +
      '<div class="ww-map-tools-left"><button type="button" class="ww-map-btn" data-layers aria-label="Kaartlagen">' + ICON.box + "</button></div>" +
      '<div class="ww-nav-bar" data-nav-bar hidden></div>' +
      '<div id="ww-map" class="ww-map" role="application" aria-label="Vaarkaart"></div>' +
      '<div class="ww-map-tools"><button type="button" class="ww-map-btn ww-follow-btn' + (following ? " is-on" : "") + '" data-follow aria-pressed="' + following + '">' + ICON.pin + '<span data-follow-label>' + (following ? "Volgen" : "Vrij") + "</span></button></div>" +
      '<div class="ww-map-legend"><span><i style="background:#16A34A"></i>Past eronder</span><span><i style="background:#EA8A00"></i>Moet open</span><span><i style="background:#DC2626"></i>Past niet</span><span><i style="background:#7C3AED"></i>Sluis</span></div>' +
      '<div class="ww-map-hint" data-map-hint>Zoom in om bruggen en sluizen te zien</div>' +
      '<div class="ww-sheet-map" data-map-sheet hidden></div></div>';
  }

  function initMap() {
    var el = document.getElementById("ww-map");
    if (!el) return;
    loadLeaflet().then(function () {
      if (!document.getElementById("ww-map")) return;
      if (map) { map.remove(); map = null; }
      var saved = null;
      try { saved = JSON.parse(storageGet("ww-map-view") || "null"); } catch (e) { saved = null; }
      var center = saved ? [saved.lat, saved.lon] : (ui.place ? [ui.place.lat, ui.place.lon] : [53.03, 5.75]);
      // Canvas met extra tikmarge (vinger op telefoon), lijnen in een laag onder de punten.
      map = L.map("ww-map", { zoomControl: false, attributionControl: true, preferCanvas: true, renderer: L.canvas({ tolerance: 14 }) }).setView(center, saved ? saved.z : 12);
      map.createPane("ww-lines").style.zIndex = 390;
      lineRenderer = L.canvas({ pane: "ww-lines", tolerance: 6 });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
      L.tileLayer("https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenSeaMap" }).addTo(map);
      L.control.zoom({ position: "topright" }).addTo(map);
      map.attributionControl.addAttribution("Vaarwegdata: Rijkswaterstaat");
      mapLayers = L.layerGroup().addTo(map);
      mapObjects = {}; mapOpenings = {};
      map.on("moveend", function () {
        var c = map.getCenter();
        storageSet("ww-map-view", JSON.stringify({ lat: c.lat, lon: c.lng, z: map.getZoom() }));
        clearTimeout(mapLoadTimer);
        mapLoadTimer = setTimeout(loadMapData, 250);
      });
      map.on("dragstart", function () { if (following) setFollow(false); });
      map.on("contextmenu", function (ev) {
        route.to = { label: "Gekozen punt", lat: ev.latlng.lat, lon: ev.latlng.lng };
        L.popup().setLatLng(ev.latlng).setContent('<button type="button" class="ww-btn ww-btn-primary ww-btn-sm" data-route-here>Vaar hierheen</button>').openOn(map);
      });
      loadMapData();
      startWatch(!saved && !route.data);
      if (route.data) drawRoute();
    }).catch(function (err) { toast(err.message); });
  }

  function wfs(type, b) {
    var bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map(function (n) { return n.toFixed(5); }).join(",") + ",urn:ogc:def:crs:OGC:1.3:CRS84";
    return fetch(FIS_WFS + "&typeName=" + type + "&bbox=" + bbox).then(function (r) { return r.json(); }).then(function (d) { return d.features || []; });
  }

  var LAYERS = [
    ["bruggen", "Bruggen & sluizen", true],
    ["havens", "Jachthavens", true],
    ["kabels", "Hoogspanning & kabels", true],
    ["diepte", "Vaardiepte", true],
    ["snelheid", "Maximumsnelheid", false],
    ["veer", "Veerponten", true],
    ["helling", "Trailerhellingen", true],
    ["meldpunt", "Marifoon-meldpunten", false],
    ["horeca", "Restaurants & cafés", false]
  ];
  function layerOn(key) {
    var saved = null;
    try { saved = JSON.parse(storageGet("ww-layers") || "null"); } catch (e) { saved = null; }
    if (saved && key in saved) return saved[key];
    for (var i = 0; i < LAYERS.length; i++) if (LAYERS[i][0] === key) return LAYERS[i][2];
    return false;
  }
  function setLayer(key, on) {
    var saved = {};
    try { saved = JSON.parse(storageGet("ww-layers") || "{}") || {}; } catch (e) { saved = {}; }
    saved[key] = on; storageSet("ww-layers", JSON.stringify(saved));
  }
  function boatDraft() {
    var n = parseFloat(String(boatField("diepgang") || "").replace(",", ".").replace(/[^0-9.]/g, ""));
    return isFinite(n) && n > 0 && n < 10 ? n : null;
  }
  var poiTimer = null, lastPoiKey = "";
  function loadPois() {
    if (!map || !layerOn("horeca") || map.getZoom() < 14) return;
    var b = map.getBounds();
    var bbox = [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()].map(function (n) { return n.toFixed(3); }).join(",");
    if (bbox === lastPoiKey) return;
    lastPoiKey = bbox;
    var q = '[out:json][timeout:20];(nwr["amenity"~"^(restaurant|cafe|pub|bar|fast_food|ice_cream)$"](' + bbox + ');nwr["leisure"="marina"](' + bbox + ');nwr["waterway"="fuel"](' + bbox + '););out center tags 150;';
    fetch("https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        (d.elements || []).forEach(function (el) {
          var lat = el.lat || (el.center && el.center.lat), lon = el.lon || (el.center && el.center.lon);
          if (lat == null) return;
          var tg = el.tags || {};
          var kind = tg.leisure === "marina" ? "marina" : tg.waterway === "fuel" ? "fuel" : "poi";
          addPoint(kind, "osm" + el.type + el.id, [lat, lon], tg, kind === "poi" ? "#B45309" : kind === "fuel" ? "#0F766E" : "#07345C", kind === "poi" ? 6 : 7);
        });
      })
      .catch(function () { /* OSM tijdelijk niet bereikbaar */ });
  }

  function addPoint(kind, id, ll, props, color, radius) {
    var key = kind + ":" + id;
    if (mapObjects[key]) return;
    var marker = L.circleMarker(ll, { radius: radius || 7, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 }).addTo(mapLayers);
    props = props || {}; props.id = id;
    marker.on("click", function () { openInfoSheet(kind, id); });
    mapObjects[key] = { marker: marker, props: props, kind: kind };
  }
  function addLine(kind, f, color, dash) {
    var p = f.properties || {}, key = kind + ":" + p.id;
    if (mapObjects[key]) return;
    var g = f.geometry || {};
    var lines = g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : [];
    if (!lines.length) return;
    var latlngs = lines.map(function (line) { return line.map(function (c) { return [c[1], c[0]]; }); });
    var poly = L.polyline(latlngs, { color: color, weight: 5, opacity: 0.6, dashArray: dash || null, renderer: lineRenderer || undefined, pane: "ww-lines" }).addTo(mapLayers);
    poly.on("click", function () { openInfoSheet(kind, p.id); });
    mapObjects[key] = { marker: poly, props: p, kind: kind };
  }

  function hoursNl(h) {
    var map = { Mo: "ma", Tu: "di", We: "wo", Th: "do", Fr: "vr", Sa: "za", Su: "zo", PH: "feestdagen", off: "gesloten", closed: "gesloten",
      Jan: "jan", Feb: "feb", Mar: "mrt", Apr: "apr", May: "mei", Jun: "jun", Jul: "jul", Aug: "aug", Sep: "sep", Oct: "okt", Nov: "nov", Dec: "dec" };
    return String(h).replace(/24\/7/g, "dag en nacht").replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH|off|closed|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, function (m) { return map[m]; }).replace(/;\s*/g, "; ");
  }
  function contactHtml(tg) {
    var rows = [], btns = [];
    var hours = tg.opening_hours || tg["seamark:harbour:opening_hours"];
    if (hours) rows.push(["Openingstijden", hoursNl(hours)]);
    var phone = tg.phone || tg["contact:phone"] || tg["contact:mobile"];
    var mail = tg.email || tg["contact:email"];
    var web = tg.website || tg["contact:website"] || tg.url;
    var vhf = tg.vhf || tg["seamark:radio_station:channel"] || tg["communication:vhf"];
    if (vhf) rows.push(["Marifoon", "kanaal " + String(vhf).replace(/;/g, " / ")]);
    if (tg["addr:street"]) rows.push(["Adres", tg["addr:street"] + " " + (tg["addr:housenumber"] || "") + (tg["addr:city"] ? ", " + tg["addr:city"] : "")]);
    if (phone) { rows.push(["Telefoon", phone]); btns.push('<a class="ww-btn ww-btn-primary ww-btn-sm" href="tel:' + esc(String(phone).split(";")[0].replace(/[^0-9+]/g, "")) + '">Bel</a>'); }
    if (mail) btns.push('<a class="ww-btn ww-btn-ghost ww-btn-sm" href="mailto:' + esc(String(mail).split(";")[0]) + '">Mail</a>');
    if (web && /^https?:/.test(web)) btns.push('<a class="ww-btn ww-btn-ghost ww-btn-sm" href="' + esc(web) + '" target="_blank" rel="noopener">Website</a>');
    return (rows.length ? '<div class="ww-list">' + rows.map(function (r) { return '<div class="ww-list-row"><span>' + esc(r[0]) + "</span><span>" + esc(r[1]) + "</span></div>"; }).join("") + "</div>" : "") +
      (btns.length ? '<div class="ww-sheet-actions">' + btns.join("") + "</div>" : "");
  }
  function loadHarbourContact(ll, name) {
    var q = '[out:json][timeout:15];nwr(around:400,' + ll.lat.toFixed(5) + "," + ll.lng.toFixed(5) + ')["leisure"="marina"];out center tags 5;';
    fetch("https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var box = document.querySelector("[data-harbour-contact]");
        if (!box) return;
        var els = (d.elements || []).filter(function (el) { return el.tags; });
        var words = String(name).toLowerCase().split(/[^a-z0-9à-ÿ]+/).filter(function (w) { return w.length > 3 && w !== "jachthaven"; });
        els.sort(function (a, b) {
          var sa = words.filter(function (w) { return String(a.tags.name || "").toLowerCase().indexOf(w) >= 0; }).length;
          var sb = words.filter(function (w) { return String(b.tags.name || "").toLowerCase().indexOf(w) >= 0; }).length;
          var ca = (a.tags.phone || a.tags["contact:phone"] || a.tags.website || a.tags["contact:website"]) ? 1 : 0;
          var cb = (b.tags.phone || b.tags["contact:phone"] || b.tags.website || b.tags["contact:website"]) ? 1 : 0;
          return (sb * 2 + cb) - (sa * 2 + ca);
        });
        var html = els.length ? contactHtml(els[0].tags) : "";
        box.innerHTML = html || '<p class="ww-small" style="margin:0">Geen openingstijden of contactgegevens bekend.</p>';
      })
      .catch(function () { var box = document.querySelector("[data-harbour-contact]"); if (box) box.innerHTML = '<p class="ww-small" style="margin:0">Contactgegevens nu niet bereikbaar.</p>'; });
  }

  function openInfoSheet(kind, id) {
    var o = mapObjects[kind + ":" + id];
    var sheet = document.querySelector("[data-map-sheet]");
    if (!o || !sheet) return;
    var p = o.props, title = p.name || "", sub = "", rows = [], extra = "";
    var ad = airDraft(), dr = boatDraft();
    if (kind === "cable") {
      sub = p.type === "POWER_LINE" ? "Hoogspanningslijn" : "Bovengrondse kabel";
      var ch = p.clearanceheight != null ? p.clearanceheight : p.height;
      rows.push(["Vrije hoogte", fmtM(ch)]);
      if (ad) rows.push(["Jouw boot", fmtM(ad)]);
      if (ad && ch != null) extra = '<div class="ww-verdict" style="border-color:' + (ch >= ad + 1 ? "#16A34A" : "#DC2626") + '"><span style="background:' + (ch >= ad + 1 ? "#16A34A" : "#DC2626") + '"></span>' + (ch >= ad + 1 ? "Ruim voldoende hoogte" : "Let op: weinig of te weinig hoogte") + "</div>";
      if (p.note) rows.push(["Opmerking", p.note]);
    } else if (kind === "depth") {
      title = "Vaardiepte"; sub = "Minimale diepte vaarweg";
      var lo = Math.abs(p.minimaldepthlowerlimit != null ? p.minimaldepthlowerlimit : p.minimaldepthupperlimit);
      rows.push(["Minimale diepte", fmtM(lo) + (p.referencelevel ? " (t.o.v. " + p.referencelevel + ")" : "")]);
      if (dr) { rows.push(["Diepgang boot", fmtM(dr)]); extra = '<div class="ww-verdict" style="border-color:' + (lo >= dr + 0.2 ? "#16A34A" : "#DC2626") + '"><span style="background:' + (lo >= dr + 0.2 ? "#16A34A" : "#DC2626") + '"></span>' + (lo >= dr + 0.2 ? "Diep genoeg voor je boot" : "Let op: ondiep voor je boot") + "</div>"; }
    } else if (kind === "speed") {
      title = "Maximumsnelheid"; sub = "Vaarweg";
      rows.push(["Max. snelheid", (p.calibratedspeedup || p.calibratedspeeddown || "?") + " km/u"]);
    } else if (kind === "ferry") { sub = "Veerpont / veersteiger"; }
    else if (kind === "slipway") { sub = "Trailerhelling"; if (p.amount) rows.push(["Aantal hellingen", p.amount]); }
    else if (kind === "callpoint") {
      sub = "Marifoon-meldpunt";
      var ch2 = []; try { ch2 = JSON.parse(p.vhfchannels || "[]"); } catch (e) { ch2 = []; }
      if (ch2.length) rows.push(["Marifoonkanaal", ch2.join(" / ")]);
    } else if (kind === "poi" || kind === "marina" || kind === "fuel") {
      title = p.name || (kind === "marina" ? "Jachthaven" : kind === "fuel" ? "Tankstation (water)" : "Horeca");
      var typeNl = { restaurant: "Restaurant", cafe: "Café", pub: "Kroeg", bar: "Bar", fast_food: "Snackbar", ice_cream: "IJs" };
      sub = kind === "marina" ? "Jachthaven (OpenStreetMap)" : kind === "fuel" ? "Brandstof aan het water" : (typeNl[p.amenity] || "Horeca") + (p.cuisine ? " · " + p.cuisine.replace(/;/g, ", ") : "");
      extra = contactHtml(p) || '<p class="ww-small" style="margin:0">Geen openingstijden of contactgegevens bekend.</p>';
    }
    var ll = o.marker.getLatLng ? o.marker.getLatLng() : o.marker.getBounds().getCenter();
    var canFav = kind === "poi" || kind === "marina" || kind === "slipway" || kind === "ferry" || kind === "fuel";
    sheet.innerHTML = '<div class="ww-sheet-map-head"><div><strong>' + esc(title) + '</strong><span class="ww-small">' + esc(sub) + "</span></div>" +
      '<button type="button" class="ww-link" data-close-map-sheet aria-label="Sluiten" style="font-size:22px;min-width:44px;min-height:44px">×</button></div>' + extra +
      (rows.length ? '<div class="ww-list">' + rows.map(function (r) { return '<div class="ww-list-row"><span>' + esc(r[0]) + "</span><span>" + esc(r[1]) + "</span></div>"; }).join("") + "</div>" : "") +
      '<div class="ww-sheet-actions"><button type="button" class="ww-btn ww-btn-primary ww-btn-sm" data-route-to="' + ll.lat.toFixed(5) + "," + ll.lng.toFixed(5) + '" data-route-label="' + esc(title) + '">Vaar hierheen</button>' +
      (canFav ? '<button type="button" class="ww-btn ww-btn-ghost ww-btn-sm" data-fav="' + ll.lat.toFixed(5) + "," + ll.lng.toFixed(5) + '" data-fav-label="' + esc(title) + '">' + (isFav(ll.lat, ll.lng) ? "★ Favoriet" : "☆ Bewaar") + "</button>" : "") + "</div>" +
      '<p class="ww-small" style="margin:0;opacity:.8">Bron: ' + (kind === "poi" || kind === "marina" || kind === "fuel" ? "OpenStreetMap" : "Rijkswaterstaat") + ". Controleer ter plaatse.</p>";
    sheet.hidden = false;
  }

  function loadMapData() {
    if (!map) return;
    var hint = document.querySelector("[data-map-hint]");
    var z = map.getZoom();
    if (z < 11) { if (hint) { hint.hidden = false; hint.textContent = "Zoom in om bruggen en sluizen te zien"; } return; }
    if (hint) { hint.hidden = false; hint.textContent = "Laden…"; }
    var b = map.getBounds().pad(0.15);
    var types = ["brug", "opening", "sluis_v", "jachthaven_p", "bovengrondse_kabel", "vaarwegdiepte", "navigatiesnelheid", "veersteiger_p", "trailerhelling_p", "meldpunt"];
    var want = { brug: layerOn("bruggen"), opening: layerOn("bruggen"), sluis_v: layerOn("bruggen"), jachthaven_p: layerOn("havens") && z >= 12,
      bovengrondse_kabel: layerOn("kabels"), vaarwegdiepte: layerOn("diepte"), navigatiesnelheid: layerOn("snelheid"), veersteiger_p: layerOn("veer"),
      trailerhelling_p: layerOn("helling"), meldpunt: layerOn("meldpunt") };
    Promise.all(types.map(function (t) { return want[t] ? wfs(t, b).catch(function () { return []; }) : Promise.resolve([]); }))
      .then(function (res) {
        var openings = res[1] || [];
        openings.forEach(function (f) {
          var p = f.properties || {};
          if (p.parentgeotype !== "bridge" || !p.parentid) return;
          var list = mapOpenings[p.parentid] || (mapOpenings[p.parentid] = []);
          if (!list.some(function (o) { return o.id === p.id; })) list.push({ id: p.id, type: p.type, clearance: p.clearanceheightclosed, width: p.width, name: p.name });
        });
        (res[0] || []).forEach(function (f) { addObject("bridge", f); });
        (res[2] || []).forEach(function (f) { addObject("lock", f); });
        (res[3] || []).forEach(function (f) { addObject("harbour", f); });
        var ad = airDraft(), dr = boatDraft();
        (res[4] || []).forEach(function (f) {
          var p = f.properties || {}, ch = p.clearanceheight != null ? p.clearanceheight : p.height;
          var c = f.geometry && f.geometry.coordinates;
          if (c) addPoint("cable", p.id, [c[1], c[0]], p, ad && ch != null && ch < ad + 1 ? "#DC2626" : "#CA8A04", 6);
        });
        (res[5] || []).forEach(function (f) {
          var p = f.properties || {}, lo = Math.abs(p.minimaldepthlowerlimit != null ? p.minimaldepthlowerlimit : (p.minimaldepthupperlimit || 0));
          addLine("depth", f, dr && lo < dr + 0.2 ? "#DC2626" : "#0EA5E9", "6 6");
        });
        (res[6] || []).forEach(function (f) { addLine("speed", f, "#9333EA", "2 8"); });
        [[7, "ferry", "#0F766E"], [8, "slipway", "#475569"], [9, "callpoint", "#BE185D"]].forEach(function (cfg) {
          (res[cfg[0]] || []).forEach(function (f) { var c = f.geometry && f.geometry.coordinates; if (c && f.geometry.type === "Point") addPoint(cfg[1], f.properties.id, [c[1], c[0]], f.properties, cfg[2], 6); });
        });
        clearTimeout(poiTimer); poiTimer = setTimeout(loadPois, 400);
        if (hint) hint.hidden = true;
      })
      .catch(function () { if (hint) { hint.hidden = false; hint.textContent = "Vaarwegdata niet bereikbaar"; } });
  }

  function bridgeVerdict(p, openings) {
    var ad = airDraft();
    var fixedOpenings = openings.filter(function (o) { return o.type === "VST"; });
    var clearances = openings.map(function (o) { return o.clearance; }).filter(function (n) { return typeof n === "number"; });
    var maxClear = clearances.length ? Math.max.apply(null, clearances) : null;
    var canOpen = p.canopen === "Yes" || openings.some(function (o) { return o.type && o.type !== "VST"; });
    var verdict = { color: "#64748B", label: canOpen ? "Beweegbare brug" : "Vaste brug", clearance: maxClear, canOpen: canOpen };
    if (ad == null || maxClear == null) {
      verdict.color = canOpen ? "#0877BD" : "#64748B";
      return verdict;
    }
    if (maxClear >= ad + 0.1) { verdict.color = "#16A34A"; verdict.label = "Jouw boot past eronder"; }
    else if (canOpen) { verdict.color = "#EA8A00"; verdict.label = "Brug moet open"; }
    else { verdict.color = "#DC2626"; verdict.label = "Past niet: vaste brug te laag"; }
    if (fixedOpenings.length && canOpen && maxClear < ad + 0.1) verdict.label = "Brug moet open";
    return verdict;
  }

  function addObject(kind, f) {
    var p = f.properties || {};
    var key = kind + ":" + p.id;
    var g = f.geometry || {};
    var ll = null;
    if (g.type === "Point") ll = [g.coordinates[1], g.coordinates[0]];
    else if (g.type === "Polygon" && g.coordinates && g.coordinates[0]) {
      var ring = g.coordinates[0], la = 0, lo = 0;
      ring.forEach(function (c) { lo += c[0]; la += c[1]; });
      ll = [la / ring.length, lo / ring.length];
    } else if (g.type === "MultiPolygon" && g.coordinates && g.coordinates[0] && g.coordinates[0][0]) {
      var r2 = g.coordinates[0][0], la2 = 0, lo2 = 0;
      r2.forEach(function (c) { lo2 += c[0]; la2 += c[1]; });
      ll = [la2 / r2.length, lo2 / r2.length];
    }
    if (!ll) return;
    var existing = mapObjects[key];
    var color, radius = 8;
    if (kind === "bridge") color = bridgeVerdict(p, mapOpenings[p.id] || []).color;
    else if (kind === "lock") color = "#7C3AED";
    else { color = "#07345C"; radius = 9; }
    if (existing) { existing.marker.setStyle({ fillColor: color }); existing.props = p; return; }
    var marker = L.circleMarker(ll, { radius: radius, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 }).addTo(mapLayers);
    marker.on("click", function () { openMapSheet(kind, p.id); });
    mapObjects[key] = { marker: marker, props: p, kind: kind };
  }

  function refreshBridgeColors() {
    Object.keys(mapObjects).forEach(function (k) {
      var o = mapObjects[k];
      if (o.kind === "bridge") o.marker.setStyle({ fillColor: bridgeVerdict(o.props, mapOpenings[o.props.id] || []).color });
    });
  }

  function openMapSheet(kind, id) {
    var o = mapObjects[kind + ":" + id];
    var sheet = document.querySelector("[data-map-sheet]");
    if (!o || !sheet) return;
    var p = o.props;
    var html = '<div class="ww-sheet-map-head"><div><strong>' + esc(p.name || "Onbekend") + "</strong>" +
      '<span class="ww-small">' + esc([p.city, kind === "bridge" ? "Brug" : kind === "lock" ? "Sluis" : "Jachthaven"].filter(Boolean).join(" · ")) + "</span></div>" +
      '<button type="button" class="ww-link" data-close-map-sheet aria-label="Sluiten" style="font-size:22px;min-width:44px;min-height:44px">×</button></div>';
    if (kind === "bridge") {
      var v = bridgeVerdict(p, mapOpenings[p.id] || []);
      html += '<div class="ww-verdict" style="border-color:' + v.color + '"><span style="background:' + v.color + '"></span>' + esc(v.label) + "</div>" +
        '<div class="ww-specs ww-specs-white"><div class="ww-spec"><span class="ww-small">Doorvaarthoogte (dicht)</span><span>' + fmtM(v.clearance) + "</span></div>" +
        '<div class="ww-spec"><span class="ww-small">Jouw boot</span><span>' + (airDraft() ? fmtM(airDraft()) : '<button type="button" class="ww-link" data-airdraft>Instellen</button>') + "</span></div></div>";
    }
    if (kind === "harbour") {
      var hl = o.marker.getLatLng();
      html += '<div class="ww-list"><div class="ww-list-row"><span>Passantenplaatsen</span><span>' + (p.shortstayplaces || "onbekend") + '</span></div><div class="ww-list-row"><span>Vaste ligplaatsen</span><span>' + (p.longstayplaces || "onbekend") + '</span></div><div class="ww-list-row"><span>Brandstof</span><span>' + (p.suppliesfuel === "Yes" ? "Ja" : "Nee / onbekend") + "</span></div></div>" +
        '<div class="ww-sheet-actions"><button type="button" class="ww-btn ww-btn-primary ww-btn-sm" data-route-to="' + hl.lat.toFixed(5) + "," + hl.lng.toFixed(5) + '" data-route-label="' + esc(p.name || "Jachthaven") + '">Vaar hierheen</button>' +
        '<button type="button" class="ww-btn ww-btn-ghost ww-btn-sm" data-fav="' + hl.lat.toFixed(5) + "," + hl.lng.toFixed(5) + '" data-fav-label="' + esc(p.name || "Jachthaven") + '">' + (isFav(hl.lat, hl.lng) ? "★ Favoriet" : "☆ Bewaar") + "</button></div>" +
        '<div data-harbour-contact><p class="ww-small" style="margin:0">Contactgegevens zoeken…</p></div>' +
        '<p class="ww-small" style="margin:0;opacity:.8">Bron: Rijkswaterstaat en OpenStreetMap.</p>';
    } else {
      html += '<div data-times><p class="ww-small" style="margin:0">Bedieningstijden laden…</p></div>';
    }
    sheet.innerHTML = html;
    sheet.hidden = false;
    if (kind === "harbour") { loadHarbourContact(o.marker.getLatLng(), p.name || ""); return; }
    fetch(S.appPath + "/vaardata?type=" + kind + "&id=" + encodeURIComponent(id), { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var box = sheet.querySelector("[data-times]");
        if (!box) return;
        if (!d || !d.success) { box.innerHTML = '<p class="ww-small" style="margin:0">' + esc((d && d.message) || "Geen bedieningstijden gevonden.") + "</p>"; return; }
        var ob = d.object || {}, t = d.times;
        var out = "";
        if (t && t.days) {
          out += '<div class="ww-list">' + t.days.slice(0, 3).map(function (day) {
            return '<div class="ww-list-row"><span>' + esc(day.label) + "</span><span>" + (day.windows.length ? esc(day.windows.join(", ")) : (day.known ? "Geen bediening" : "Onbekend")) + "</span></div>";
          }).join("") + "</div>";
          if (t.note) out += '<p class="ww-small" style="margin:0">' + esc(t.note) + "</p>";
        } else if (kind === "bridge" && ob.canOpen === false) {
          out += '<p class="ww-small" style="margin:0">Vaste brug, wordt niet bediend.</p>';
        } else {
          out += '<p class="ww-small" style="margin:0">Geen bedieningstijden bekend.</p>';
        }
        var actions = [];
        if (ob.vhf && ob.vhf.length) actions.push('<span class="ww-chip-static">Marifoon kanaal ' + esc(ob.vhf.join(" / ")) + "</span>");
        if (ob.phone) actions.push('<a class="ww-btn ww-btn-primary ww-btn-sm" href="tel:' + esc(String(ob.phone).replace(/[^0-9+]/g, "")) + '">Bel ' + esc(ob.phone) + "</a>");
        if (actions.length) out += '<div class="ww-sheet-actions">' + actions.join("") + "</div>";
        if (kind === "bridge" && ob.canOpen) {
          out += '<p class="ww-small" style="margin:0">Brugopening aanvragen: via marifoon, telefoon of de aanmeldknop bij de brug.</p>';
        }
        out += '<p class="ww-small" style="margin:0;opacity:.8">Bron: Rijkswaterstaat. Controleer ter plaatse.</p>';
        box.innerHTML = out;
      })
      .catch(function () { var box = sheet.querySelector("[data-times]"); if (box) box.innerHTML = '<p class="ww-small" style="margin:0">Bedieningstijden niet bereikbaar.</p>'; });
  }

  var following = false;
  function setFollow(on) {
    following = on;
    var b = document.querySelector("[data-follow]");
    if (b) {
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", String(on));
      var lbl = b.querySelector("[data-follow-label]"); if (lbl) lbl.textContent = on ? "Volgen" : "Vrij";
    }
  }
  function startWatch(centerFirst) {
    if (!navigator.geolocation || watchId != null) return;
    var first = true;
    watchId = navigator.geolocation.watchPosition(function (pos) {
      if (!map) return;
      var ll = [pos.coords.latitude, pos.coords.longitude];
      if (!meMarker) {
        meAccuracy = L.circle(ll, { radius: pos.coords.accuracy || 30, color: "#0877BD", weight: 1, fillOpacity: 0.12, interactive: false }).addTo(map);
        meMarker = L.circleMarker(ll, { radius: 8, color: "#fff", weight: 3, fillColor: "#0877BD", fillOpacity: 1, interactive: false }).addTo(map);
      } else { meMarker.setLatLng(ll); meAccuracy.setLatLng(ll).setRadius(pos.coords.accuracy || 30); }
      if (first && centerFirst) map.setView(ll, Math.max(map.getZoom(), 14));
      else if (following) map.panTo(ll, { animate: true, duration: 0.5 });
      updateNavBar();
      first = false;
      var sp = document.querySelector("[data-speed]");
      if (sp && pos.coords.speed != null && pos.coords.speed >= 0) {
        sp.hidden = false;
        sp.textContent = (pos.coords.speed * 1.943844).toFixed(1).replace(".", ",") + " kn · " + (pos.coords.speed * 3.6).toFixed(1).replace(".", ",") + " km/u";
      }
    }, function () { /* geen locatie: kaart werkt gewoon */ }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  }
  function stopWatch() {
    if (watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
    watchId = null; meMarker = null; meAccuracy = null; following = false;
    route.line = null; route.marks = null; route.nav = false;
    if (map) { map.remove(); map = null; }
  }


  // ---------- Favorieten ----------
  function favs() { try { return JSON.parse(storageGet("ww-favs") || "[]") || []; } catch (e) { return []; } }
  function isFav(lat, lon) { return favs().some(function (f) { return Math.abs(f.lat - lat) < 0.0002 && Math.abs(f.lon - lon) < 0.0002; }); }
  function toggleFav(lat, lon, label) {
    var list = favs();
    var i = -1;
    list.forEach(function (f, k) { if (Math.abs(f.lat - lat) < 0.0002 && Math.abs(f.lon - lon) < 0.0002) i = k; });
    if (i >= 0) { list.splice(i, 1); toast("Verwijderd uit favorieten"); }
    else { list.unshift({ lat: lat, lon: lon, label: label || "Favoriet", at: Date.now() }); toast("Bewaard als favoriet"); }
    storageSet("ww-favs", JSON.stringify(list.slice(0, 30)));
  }

  // ---------- Gesproken aanwijzingen ----------
  var spoken = {};
  function voiceOn() { return storageGet("ww-voice") !== "0"; }
  function say(text) {
    if (!voiceOn() || !window.speechSynthesis) return;
    try {
      var u = new SpeechSynthesisUtterance(text);
      u.lang = "nl-NL"; u.rate = 1;
      var nl = (window.speechSynthesis.getVoices() || []).filter(function (v) { return /^nl/i.test(v.lang); })[0];
      if (nl) u.voice = nl;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) { /* geen spraak */ }
  }
  function spokenDistance(m) { return m >= 1000 ? (Math.round(m / 100) / 10).toString().replace(".", ",") + " kilometer" : (Math.round(m / 50) * 50) + " meter"; }

  // ---------- Routeplanner ----------
  var route = { from: null, to: null, data: null, line: null, marks: null, nav: false, loading: false };
  function speedKn() { var n = parseFloat(String(storageGet("ww-speed") || "6").replace(",", ".")); return isFinite(n) && n > 0 ? n : 6; }
  function fmtKm(m) { return (m / 1000).toFixed(m < 10000 ? 1 : 0).replace(".", ",") + " km"; }
  function fmtDur(min) { min = Math.round(min); var h = Math.floor(min / 60), m = min % 60; return h ? h + " u " + (m < 10 ? "0" : "") + m + " min" : m + " min"; }
  function routeMinutes(r) {
    var opens = r.objects.filter(function (o) { return o.kind === "bridge" && o.mustOpen; }).length;
    var locks = r.objects.filter(function (o) { return o.kind === "lock"; }).length;
    return (r.distanceM / 1852) / speedKn() * 60 + opens * 5 + locks * 15;
  }
  function myLatLng() { return meMarker ? meMarker.getLatLng() : null; }

  function routePanelHtml() {
    var from = route.from ? route.from.label : (myLatLng() ? "Mijn locatie" : "Kies vertrekpunt");
    var to = route.to ? route.to.label : "Kies bestemming";
    return '<div class="ww-sheet-map-head"><div><strong>Route plannen</strong><span class="ww-small">Lang drukken op de kaart = vaar hierheen</span></div>' +
      '<button type="button" class="ww-link" data-close-map-sheet aria-label="Sluiten" style="font-size:22px;min-width:44px;min-height:44px">×</button></div>' +
      '<form class="ww-route-form" data-route-form>' +
      '<label class="ww-field">Van<input type="search" name="from" placeholder="' + esc(from) + '" autocomplete="off" data-geo="from"></label>' +
      '<label class="ww-field">Naar<input type="search" name="to" placeholder="' + esc(to) + '" autocomplete="off" data-geo="to"' + (route.to ? ' value="' + esc(route.to.label) + '"' : "") + "></label>" +
      '<div class="ww-geo-results" data-geo-results>' + favs().slice(0, 6).map(function (f, i) { return '<button type="button" class="ww-geo-item" data-fav-pick="' + i + '">★ ' + esc(f.label) + "</button>"; }).join("") + "</div>" +
      '<div class="ww-row2"><label class="ww-field">Snelheid (knopen)<input type="text" inputmode="decimal" name="speed" value="' + esc(String(speedKn()).replace(".", ",")) + '"></label>' +
      '<label class="ww-field">Doorvaarthoogte<input type="text" inputmode="decimal" name="air" value="' + esc(airDraft() ? String(airDraft()).replace(".", ",") : "") + '" placeholder="m"></label></div>' +
      '<button type="submit" class="ww-btn ww-btn-primary">Plan route</button></form>';
  }

  function openRoutePanel() {
    var sheet = document.querySelector("[data-map-sheet]");
    if (!sheet) return;
    sheet.innerHTML = routePanelHtml();
    sheet.hidden = false;
  }

  var geoTimer = null, geoTarget = null;
  function geoSearch(q, target) {
    geoTarget = target;
    var box = document.querySelector("[data-geo-results]");
    if (!box) return;
    if (!q || q.length < 2) { box.innerHTML = ""; return; }
    fetch("https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?rows=6&fq=type:(woonplaats%20OR%20gemeente%20OR%20weg)&q=" + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var docs = (d && d.response && d.response.docs) || [];
        var harbours = Object.keys(mapObjects).map(function (k) { return mapObjects[k]; })
          .filter(function (o) { return o.kind === "harbour" && String(o.props.name || "").toLowerCase().indexOf(q.toLowerCase()) >= 0; })
          .slice(0, 3)
          .map(function (o) { var ll = o.marker.getLatLng(); return { label: o.props.name, lat: ll.lat, lon: ll.lng }; });
        var places = docs.map(function (doc) {
          var m = /POINT\(([-0-9.]+) ([-0-9.]+)\)/.exec(doc.centroide_ll || "");
          return m ? { label: doc.weergavenaam, lat: parseFloat(m[2]), lon: parseFloat(m[1]) } : null;
        }).filter(Boolean);
        var list = harbours.concat(places);
        if (target === "from" && myLatLng()) list.unshift({ label: "Mijn locatie", me: true });
        box.innerHTML = list.map(function (it, i) {
          return '<button type="button" class="ww-geo-item" data-geo-pick="' + i + '">' + esc(it.label) + "</button>";
        }).join("");
        box._items = list;
      })
      .catch(function () { box.innerHTML = '<p class="ww-small">Zoeken lukt nu niet.</p>'; });
  }

  function clearRoute() {
    if (route.line && map) map.removeLayer(route.line);
    if (route.marks && map) map.removeLayer(route.marks);
    route.line = null; route.marks = null; route.data = null; route.nav = false;
    var bar = document.querySelector("[data-nav-bar]"); if (bar) bar.hidden = true;
  }

  function planRoute(attempt) {
    attempt = attempt || 0;
    var from = route.from;
    if (!from) {
      var me = myLatLng();
      if (me) from = { label: "Mijn locatie", lat: me.lat, lon: me.lng, me: true };
    }
    if (!from) { toast("Kies een vertrekpunt of sta locatie toe"); openRoutePanel(); return; }
    if (!route.to) { toast("Kies een bestemming"); openRoutePanel(); return; }
    var sheet = document.querySelector("[data-map-sheet]");
    if (sheet) { sheet.hidden = false; sheet.innerHTML = '<p class="ww-small" style="margin:0">' + (attempt ? "Routeplanner wordt voorbereid… (eerste keer even geduld)" : "Route berekenen…") + "</p>"; }
    var url = S.appPath + "/route?from=" + from.lat.toFixed(5) + "," + from.lon.toFixed(5) + "&to=" + route.to.lat.toFixed(5) + "," + route.to.lon.toFixed(5) + (airDraft() ? "&air=" + airDraft() : "");
    fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.preparing && attempt < 12) { setTimeout(function () { planRoute(attempt + 1); }, 3000); return; }
        clearRoute();
        if (!d || !d.success) { showRouteError(d || {}); return; }
        route.data = d.route; route.usedFrom = from;
        drawRoute();
      })
      .catch(function () { if (sheet) sheet.innerHTML = '<p class="ww-small">Routeplanner niet bereikbaar.</p>'; });
  }

  function showRouteError(d) {
    var sheet = document.querySelector("[data-map-sheet]");
    if (!sheet) return;
    sheet.hidden = false;
    sheet.innerHTML = '<div class="ww-sheet-map-head"><div><strong>Geen route</strong></div><button type="button" class="ww-link" data-close-map-sheet aria-label="Sluiten" style="font-size:22px;min-width:44px;min-height:44px">×</button></div>' +
      '<div class="ww-notice">' + esc(d.message || "Geen route gevonden.") + '</div><button type="button" class="ww-btn ww-btn-ghost" data-route-open>Andere bestemming</button>';
    if (d.blockers && d.blockers.length && map) {
      route.marks = L.layerGroup().addTo(map);
      d.blockers.slice(0, 5).forEach(function (b) {
        L.circleMarker([b.lat, b.lon], { radius: 11, color: "#fff", weight: 3, fillColor: "#DC2626", fillOpacity: 1 }).addTo(route.marks);
      });
      map.setView([d.blockers[0].lat, d.blockers[0].lon], 15);
    }
  }

  function drawRoute() {
    var r = route.data;
    if (!map || !r) return;
    route.line = L.polyline(r.coords, { color: "#0877BD", weight: 6, opacity: 0.85, interactive: false, renderer: lineRenderer || undefined, pane: "ww-lines" }).addTo(map);
    route.marks = L.layerGroup().addTo(map);
    L.circleMarker(r.coords[0], { radius: 9, color: "#fff", weight: 3, fillColor: "#16A34A", fillOpacity: 1 }).addTo(route.marks);
    L.circleMarker(r.coords[r.coords.length - 1], { radius: 9, color: "#fff", weight: 3, fillColor: "#07345C", fillOpacity: 1 }).addTo(route.marks);
    r.objects.forEach(function (o) {
      if (o.kind === "bridge" && !o.mustOpen) return;
      L.circleMarker([o.lat, o.lon], { radius: 7, color: "#fff", weight: 2, fillColor: o.kind === "lock" ? "#7C3AED" : "#EA8A00", fillOpacity: 1 })
        .on("click", function () { openMapSheet(o.kind, o.id); }).addTo(route.marks);
    });
    map.fitBounds(route.line.getBounds(), { padding: [40, 40] });
    showRouteSheet();
  }

  function showRouteSheet() {
    var r = route.data, sheet = document.querySelector("[data-map-sheet]");
    if (!r || !sheet) return;
    var opens = r.objects.filter(function (o) { return o.kind === "bridge" && o.mustOpen; });
    var locks = r.objects.filter(function (o) { return o.kind === "lock"; });
    var under = r.objects.filter(function (o) { return o.kind === "bridge" && !o.mustOpen; });
    var eta = new Date(Date.now() + routeMinutes(r) * 60000);
    var html = '<div class="ww-sheet-map-head"><div><strong>' + esc((route.usedFrom ? route.usedFrom.label : "Start") + " → " + route.to.label) + "</strong>" +
      '<span class="ww-small">' + esc(r.waterways.slice(0, 4).join(" · ")) + "</span></div>" +
      '<button type="button" class="ww-link" data-route-clear aria-label="Route wissen" style="font-size:22px;min-width:44px;min-height:44px">×</button></div>' +
      '<div class="ww-route-sum"><div><strong>' + fmtKm(r.distanceM) + "</strong><span>afstand</span></div><div><strong>" + fmtDur(routeMinutes(r)) + "</strong><span>bij " + String(speedKn()).replace(".", ",") + " kn</span></div><div><strong>" +
      eta.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) + "</strong><span>aankomst</span></div></div>" +
      '<p class="ww-small" style="margin:0">' + opens.length + " brug" + (opens.length === 1 ? "" : "gen") + " moet" + (opens.length === 1 ? "" : "en") + " open · " + locks.length + " slui" + (locks.length === 1 ? "s" : "zen") + " · " + under.length + (under.length === 1 ? " brug" : " bruggen") + " waar je onderdoor past" +
      (r.air ? "" : ' · <button type="button" class="ww-link" data-airdraft>doorvaarthoogte instellen</button>') + "</p>" +
      '<button type="button" class="ww-btn ww-btn-primary" data-nav-start>Start navigatie</button>' +
      '<button type="button" class="ww-btn ww-btn-ghost ww-btn-sm" data-save-dest style="width:100%">' + (isFav(route.to.lat, route.to.lon) ? "★ Bewaard" : "☆ Bewaar bestemming") + "</button>";
    var list = r.objects.filter(function (o) { return o.kind === "lock" || o.mustOpen; });
    if (list.length) {
      html += '<div class="ww-list">' + list.map(function (o) {
        return '<button type="button" class="ww-list-row ww-route-obj" data-route-obj="' + o.kind + ":" + o.id + '"><span>km ' + (o.atM / 1000).toFixed(1).replace(".", ",") + " · " + esc(o.name || (o.kind === "lock" ? "Sluis" : "Brug")) + "</span><span>" +
          (o.kind === "lock" ? "Sluis" : "Moet open" + (o.clearance != null ? " (" + fmtM(o.clearance) + ")" : "")) + " ›</span></button>";
      }).join("") + "</div>";
    }
    if (r.snapFromM > 300 || r.snapToM > 300) html += '<p class="ww-small" style="margin:0">Let op: start of bestemming ligt ' + Math.round(Math.max(r.snapFromM, r.snapToM)) + " m van de dichtstbijzijnde bekende vaarweg.</p>";
    html += '<p class="ww-small" style="margin:0;opacity:.8">Route over het vaarwegennet van Rijkswaterstaat. Kleine sloten ontbreken. Tijd is een schatting; controleer bedieningstijden en ter plaatse.</p>';
    sheet.innerHTML = html;
    sheet.hidden = false;
  }

  function distToRoute(ll) {
    var r = route.data; if (!r) return null;
    var best = { i: 0, d: Infinity };
    for (var i = 0; i < r.coords.length; i++) {
      var dy = (r.coords[i][0] - ll.lat) * 111320, dx = (r.coords[i][1] - ll.lng) * 111320 * Math.cos(ll.lat * Math.PI / 180);
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < best.d) best = { i: i, d: d };
    }
    var along = 0;
    for (var j = 1; j <= best.i; j++) along += L.latLng(r.coords[j - 1]).distanceTo(L.latLng(r.coords[j]));
    return { offM: best.d, alongM: along };
  }

  function updateNavBar() {
    if (!route.nav || !route.data) return;
    var bar = document.querySelector("[data-nav-bar]");
    var me = myLatLng();
    if (!bar) return;
    bar.hidden = false;
    if (!me) { bar.innerHTML = "Wachten op je locatie…"; return; }
    var pos = distToRoute(me);
    var left = Math.max(0, route.data.distanceM - pos.alongM);
    var next = route.data.objects.filter(function (o) { return (o.kind === "lock" || o.mustOpen) && o.atM > pos.alongM; })[0];
    if (next) {
      var dn = next.atM - pos.alongM;
      [1000, 300, 80].forEach(function (th) {
        var key = next.kind + next.id + ":" + th;
        if (dn <= th && dn > th / 3 && !spoken[key]) {
          spoken[key] = true;
          say("Over " + spokenDistance(dn) + ", " + (next.name || (next.kind === "lock" ? "sluis" : "brug")) + "." + (next.kind === "lock" ? " Sluis." : " Deze brug moet open."));
        }
      });
    }
    if (pos.offM > 150 && !spoken.off) { spoken.off = true; say("Je bent van de route af."); }
    if (pos.offM < 60) spoken.off = false;
    bar.innerHTML = '<button type="button" class="ww-voice" data-voice aria-label="Spraak aan of uit">' + (voiceOn() ? "🔊" : "🔇") + "</button><strong>" + fmtKm(left) + "</strong> te gaan · ±" + fmtDur(left / 1852 / speedKn() * 60) +
      (next ? "<br>Over " + fmtKm(next.atM - pos.alongM) + ": " + esc(next.name || "brug") + (next.kind === "lock" ? " (sluis)" : " (moet open)") : "") +
      (pos.offM > 150 ? '<br><span style="color:#FCD34D">Je bent ' + Math.round(pos.offM) + " m van de route</span>" : "");
    if (left < 60) { bar.innerHTML = "<strong>Je bent er!</strong> Welkom in " + esc(route.to.label); route.nav = false; say("Je bent er. Welkom in " + route.to.label); }
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
    return head + usp +
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
    var items = [["home", "Home", ICON.home], ["shop", "Shoppen", ICON.bag], ["captain", "Captain AI", ICON.chat], ["boot", "Je boot", ICON.boat], ["service", "Serviceboek", ICON.book]];
    return '<nav class="ww-nav" aria-label="Hoofdmenu"><div class="ww-nav-inner">' + items.map(function (it) {
      return '<a href="#' + it[0] + '"' + (ui.tab === it[0] ? ' aria-current="page"' : "") + ">" + it[2] + esc(it[1]) + "</a>";
    }).join("") + "</div></nav>";
  }

  // ---------- render ----------
  function render() {
    var screen = ui.tab === "kaart" ? kaartScreen() : ui.tab === "home" ? homeScreen() : ui.tab === "vaarinfo" ? vaarinfoScreen() : ui.tab === "boot" ? boatScreen() : ui.tab === "captain" ? captainScreen() : ui.tab === "service" ? serviceScreen() : shopScreen();
    root.className = ui.tab === "kaart" ? "is-map" : "";
    root.innerHTML = screen + nav() + (ui.sheet ? sheetHtml() : "");
    if (ui.tab === "shop") renderResults();
    if (ui.tab === "captain") {
      var chat = document.querySelector("[data-chat]");
      if (chat) window.scrollTo(0, document.body.scrollHeight);
    }
  }

  function setTab(tab) {
    if (ui.tab === "kaart" && tab !== "kaart") stopWatch();
    var valid = { kaart: 1, home: 1, vaarinfo: 1, shop: 1, boot: 1, captain: 1, service: 1 };
    ui.tab = valid[tab] ? tab : "home";
    render();
    if (ui.tab !== "captain") window.scrollTo(0, 0);
    if (ui.tab === "captain" && !ui.captain && !ui.captainLoading) loadCaptain();
    if (ui.tab === "vaarinfo" || ui.tab === "home") ensureWeather();
    if (ui.tab === "kaart") initMap();
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
    if (t.hasAttribute("data-layers")) {
      var ls = document.querySelector("[data-map-sheet]"); if (!ls) return;
      ls.innerHTML = '<div class="ww-sheet-map-head"><div><strong>Kaartlagen</strong></div><button type="button" class="ww-link" data-close-map-sheet aria-label="Sluiten" style="font-size:22px;min-width:44px;min-height:44px">×</button></div>' +
        LAYERS.map(function (l) { return '<label class="ww-toggle"><input type="checkbox" data-layer="' + l[0] + '"' + (layerOn(l[0]) ? " checked" : "") + "><span>" + esc(l[1]) + "</span></label>"; }).join("") +
        '<p class="ww-small" style="margin:0">Horeca zie je als je dichtbij inzoomt. Bronnen: Rijkswaterstaat en OpenStreetMap.</p>';
      ls.hidden = false; return;
    }
    if (t.hasAttribute("data-voice")) { storageSet("ww-voice", voiceOn() ? "0" : "1"); if (voiceOn()) say("Spraak aan"); updateNavBar(); return; }
    if (t.hasAttribute("data-route-to")) {
      var rt = t.getAttribute("data-route-to").split(",").map(Number);
      route.to = { label: t.getAttribute("data-route-label") || "Bestemming", lat: rt[0], lon: rt[1] };
      planRoute(); return;
    }
    if (t.hasAttribute("data-fav")) {
      var fv = t.getAttribute("data-fav").split(",").map(Number);
      toggleFav(fv[0], fv[1], t.getAttribute("data-fav-label"));
      t.textContent = isFav(fv[0], fv[1]) ? "★ Favoriet" : "☆ Bewaar"; return;
    }
    if (t.hasAttribute("data-fav-pick")) {
      var fp = favs()[Number(t.getAttribute("data-fav-pick"))];
      if (fp) { route.to = { label: fp.label, lat: fp.lat, lon: fp.lon }; var ti = document.querySelector('[data-geo="to"]'); if (ti) ti.value = fp.label; }
      return;
    }
    if (t.hasAttribute("data-save-dest") && route.to) { toggleFav(route.to.lat, route.to.lon, route.to.label); t.textContent = isFav(route.to.lat, route.to.lon) ? "★ Bewaard" : "☆ Bewaar bestemming"; return; }
    if (t.hasAttribute("data-route-open")) { e.preventDefault(); openRoutePanel(); return; }
    if (t.hasAttribute("data-route-here")) { if (map) map.closePopup(); planRoute(); return; }
    if (t.hasAttribute("data-route-clear")) { clearRoute(); var rs = document.querySelector("[data-map-sheet]"); if (rs) rs.hidden = true; return; }
    if (t.hasAttribute("data-route-obj")) {
      var parts = t.getAttribute("data-route-obj").split(":");
      var obj = (route.data.objects || []).filter(function (o) { return o.kind === parts[0] && String(o.id) === parts[1]; })[0];
      if (obj && map) {
        map.setView([obj.lat, obj.lon], 16);
        setTimeout(function () {
          if (!mapObjects[obj.kind + ":" + obj.id]) {
            mapObjects[obj.kind + ":" + obj.id] = { marker: L.circleMarker([obj.lat, obj.lon], { radius: 1, opacity: 0 }), kind: obj.kind, props: { id: obj.id, name: obj.name, city: obj.city, canopen: obj.canOpen ? "Yes" : "No" } };
            if (obj.clearance != null && !mapOpenings[obj.id]) mapOpenings[obj.id] = [{ id: 0, type: obj.canOpen ? "BC" : "VST", clearance: obj.clearance }];
          }
          openMapSheet(obj.kind, obj.id);
        }, 300);
      }
      return;
    }
    if (t.hasAttribute("data-nav-start")) {
      route.nav = true; spoken = {};
      say("Navigatie gestart naar " + route.to.label + ".");
      setFollow(true);
      var ns = document.querySelector("[data-map-sheet]"); if (ns) ns.hidden = true;
      if (!meMarker) startWatch(true); else map.setView(meMarker.getLatLng(), Math.max(map.getZoom(), 14));
      updateNavBar();
      return;
    }
    if (t.hasAttribute("data-geo-pick")) {
      var box = document.querySelector("[data-geo-results]");
      var it = box && box._items ? box._items[Number(t.getAttribute("data-geo-pick"))] : null;
      if (it) {
        if (geoTarget === "from") route.from = it.me ? null : it; else route.to = it;
        var inp = document.querySelector('[data-geo="' + geoTarget + '"]'); if (inp) inp.value = it.label;
        box.innerHTML = "";
      }
      return;
    }
    if (t.hasAttribute("data-close-map-sheet")) { var ms = document.querySelector("[data-map-sheet]"); if (ms) ms.hidden = true; return; }
    if (t.hasAttribute("data-follow")) {
      setFollow(!following);
      if (following && meMarker && map) map.panTo(meMarker.getLatLng());
      toast(following ? "Kaart volgt je locatie" : "Vrij scrollen");
      if (!meMarker) { toast("Locatie zoeken… sta locatie toe"); startWatch(true); }
      return;
    }
    if (t.hasAttribute("data-airdraft")) {
      var cur = airDraft();
      var val = window.prompt("Doorvaarthoogte van je boot in meters (hoogste punt boven water, bijv. 2,4):", cur ? String(cur).replace(".", ",") : "");
      if (val != null) {
        var n = parseFloat(String(val).replace(",", "."));
        if (isFinite(n) && n > 0 && n < 40) { storageSet("ww-airdraft", String(n)); toast("Doorvaarthoogte: " + fmtM(n)); }
        else if (String(val).trim() === "") { try { window.localStorage.removeItem("ww-airdraft"); } catch (er) { /* niets */ } }
        var head = document.querySelector("[data-airdraft]");
        if (head && ui.tab === "kaart") { var ad2 = airDraft(); head.innerHTML = ad2 ? "Doorvaarthoogte boot: <strong>" + fmtM(ad2) + "</strong> · wijzig" : "Stel je doorvaarthoogte in"; }
        refreshBridgeColors();
        var ms2 = document.querySelector("[data-map-sheet]"); if (ms2) ms2.hidden = true;
        if (route.data && route.to) planRoute();
      }
      return;
    }
    if (t.hasAttribute("data-locate")) { e.preventDefault(); locateMe(); return; }
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

  root.addEventListener("change", function (e) {
    var el = e.target;
    if (el && el.hasAttribute && el.hasAttribute("data-layer")) {
      setLayer(el.getAttribute("data-layer"), el.checked);
      if (map && mapLayers) { mapLayers.clearLayers(); mapObjects = {}; lastPoiKey = ""; loadMapData(); }
    }
  });

  root.addEventListener("input", function (e) {
    if (e.target && e.target.hasAttribute && e.target.hasAttribute("data-geo")) {
      var gq = e.target.value.trim(), gt = e.target.getAttribute("data-geo");
      clearTimeout(geoTimer);
      geoTimer = setTimeout(function () { geoSearch(gq, gt); }, 300);
      return;
    }
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
    if (form.hasAttribute("data-home-ask")) {
      e.preventDefault();
      var hq = document.getElementById("ww-home-q");
      var question = hq ? hq.value : "";
      if (!String(question).trim()) { window.location.hash = "#captain"; return; }
      window.location.hash = "#captain";
      setTimeout(function () { askCaptain(question); }, 30);
      return;
    }
    if (form.hasAttribute("data-route-form")) {
      e.preventDefault();
      var fd = new FormData(form);
      var sp = parseFloat(String(fd.get("speed") || "").replace(",", "."));
      if (isFinite(sp) && sp > 0 && sp < 60) storageSet("ww-speed", String(sp));
      var adv = parseFloat(String(fd.get("air") || "").replace(",", "."));
      if (isFinite(adv) && adv > 0 && adv < 40) storageSet("ww-airdraft", String(adv));
      if (!String(fd.get("from") || "").trim()) route.from = null;
      refreshBridgeColors();
      planRoute();
      return;
    }
    if (form.hasAttribute("data-place-form")) {
      e.preventDefault();
      var pq = document.getElementById("ww-place");
      searchPlace(pq ? pq.value : "");
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
  setTab(window.location.hash.replace("#", "") || "home");
  refreshCart();
})();
