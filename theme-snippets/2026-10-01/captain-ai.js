/* WetterWinkel – Captain AI (AI-schipper) storefront widget – 1 okt 2026 */
(function () {
  var TEASER_KEY = "ww-captain-teaser-v3";
  var PROFILE_URL = "/customer_authentication/redirect?locale=nl&region_country=NL";

  /* ---------- Productzoeker: brede zoekterm -> wedervraag met keuzes ---------- */
  var S = function (q) { return "/search?q=" + encodeURIComponent(q) + "&type=product"; };
  var C = function (h) { return "/collections/" + h; };
  var CATS = [
    { id: "fenders", label: "fenders", keys: /\b(fender|fenders|stootwil|stootwillen|stootkussen)\b/i,
      q: "Welk type fender zoek je?",
      opts: [["Cilinderfenders", C("meai-cilinderfenders")], ["Kogelfenders", C("meai-kogelfenders")], ["Dropfenders", S("dropfender")],
             ["Steiger- en hoekfenders", C("meai-steiger-en-hoekfenders")], ["Trapfenders", C("meai-trapfenders")],
             ["Fenderlijnen", C("meai-fenderlijnen")], ["Fenderhoezen", C("meai-fenderhoezen")], ["Alle fenders", C("fenders")]] },
    { id: "touw", label: "touw en lijnen", keys: /\b(touw|touwen|lijn|lijnen|landvast|landvasten|meertouw|schoot|schoten|val|vallen)\b/i,
      q: "Wat voor touw zoek je?",
      opts: [["Landvasten", C("meai-landvasten")], ["Landvastveren", C("meai-landvastveren-compensatoren")], ["Fenderlijnen", C("meai-fenderlijnen")],
             ["Ankerlijnen", C("meai-ankerlijnen")], ["Schoten en vallen", C("meai-schoten-vallen")], ["Kant-en-klare lijnen", C("meai-voorverpakte-lijnen")], ["Overige lijnen", C("meai-overige-lijnen")]] },
    { id: "anker", label: "ankeren", keys: /\b(anker|ankers|ankeren|ankerketting|ankerlier)\b/i,
      q: "Wat heb je nodig om te ankeren?",
      opts: [["Ankers", C("meai-ankers")], ["Ankerlijnen", C("meai-ankerlijnen")], ["Ankerketting & toebehoren", C("meai-ankerketting-accessoires")], ["Ankerlieren", C("meai-ankerlieren")], ["Boegrollen", C("meai-boegrollen")]] },
    { id: "vest", label: "zwem- en reddingsvesten", keys: /\b(zwemvest|zwemvesten|reddingsvest|reddingsvesten|vest|vesten|reddingsboei)\b/i,
      q: "Voor wie zoek je een vest?",
      opts: [["Reddingsvesten volwassenen", C("meai-reddingsvesten")], ["Zwemvesten / drijfhulp", C("meai-zwemvesten")], ["Hondenzwemvesten", C("meai-dierenzwemvesten")],
             ["Professionele vesten", C("meai-professionele-reddingsvesten")], ["Reddingsboeien", C("meai-reddingsboeien")]] },
    { id: "antifouling", label: "antifouling en verf", keys: /\b(antifouling|verf|lak|primer|onderwaterschip|coating|epoxy|plamuur)\b/i,
      q: "Waar ben je mee bezig?",
      opts: [["Antifouling", C("meai-antifouling")], ["Primers", C("meai-primers")], ["Lak & coatings", C("meai-lak-coatings")],
             ["Plamuur & epoxy", C("meai-plamuur-epoxy")], ["Kwasten, rollers & tape", C("meai-schildersbenodigdheden")]] },
    { id: "poetsen", label: "poetsen en reinigen", keys: /\b(poetsen|polijsten|polish|wax|reinigen|reiniger|schoonmaken|shampoo)\b/i,
      q: "Wat wil je doen?",
      opts: [["Reinigen & polijsten", C("meai-reiniging-polijsten")], ["Polijstmiddelen", C("meai-polijstmiddelen")], ["Wax & sealants", C("meai-wax-sealants")],
             ["Keramische coatings", C("meai-keramische-coatings")], ["Poetsaccessoires", C("meai-poetsaccessoires")], ["Poetsmachines", C("meai-poetsmachines")]] },
    { id: "accu", label: "accu's en stroom", keys: /\b(accu|accus|accu's|acculader|lader|omvormer|zonnepaneel|zonnepanelen|walstroom|stroom)\b/i,
      q: "Wat zoek je voor de stroom aan boord?",
      opts: [["Accu's", C("meai-accus")], ["Acculaders", C("meai-acculaders")], ["Accuschakelaars", C("meai-accuschakelaars")], ["Omvormers", C("meai-omvormers-converters")],
             ["Omvormer-laders", C("meai-omvormer-laders")], ["Zonnepanelen", C("meai-zonnepanelen")], ["Walstroom", C("meai-walstroom")]] },
    { id: "licht", label: "verlichting", keys: /\b(verlichting|lamp|lampen|licht|lichten|boordlicht|boordlichten|navigatieverlichting|led|schijnwerper)\b/i,
      q: "Welke verlichting zoek je?",
      opts: [["Navigatieverlichting", C("meai-navigatieverlichting")], ["Interieurverlichting", C("meai-interieurverlichting")], ["Schijnwerpers", C("meai-lampen-schijnwerpers")],
             ["Onderwaterverlichting", C("meai-onderwaterverlichting")], ["Losse lampen", C("meai-lampen-en-lichtbronnen")]] },
    { id: "pomp", label: "pompen", keys: /\b(pomp|pompen|bilgepomp|lenspomp|waterpomp|drinkwaterpomp)\b/i,
      q: "Welke pomp zoek je?",
      opts: [["Elektrische bilgepompen", C("meai-elektrische-bilgepompen")], ["Handbilgepompen", C("meai-handbilgepompen")], ["Drinkwaterpompen", C("meai-drinkwaterpompen")],
             ["Vuilwaterpompen", C("meai-vuilwaterpompen")], ["Koelwaterpompen", C("meai-koelwaterpompen")], ["Dekwaspompen", C("meai-dekwaspompen")]] },
    { id: "motor", label: "motoronderhoud", keys: /\b(motor|olie|motorolie|impeller|impellers|filter|filters|oliefilter|brandstoffilter|bougie|bougies|anode|anodes|onderhoud)\b/i,
      q: "Wat heb je nodig voor je motor?",
      opts: [["Motorolie & smeermiddelen", C("meai-motorolie-smeermiddelen")], ["Impellers", C("meai-impellers")], ["Anodes", C("meai-anodes")],
             ["Brandstofpompen & filters", C("meai-brandstofpompen-filters")], ["Bougies", C("meai-bougies")], ["Bardahl", C("merk-bardahl")], ["Motoronderdelen", C("meai-motoraccessoires-en-onderdelen")]] },
    { id: "toilet", label: "toilet en sanitair", keys: /\b(toilet|wc|vuilwater|vuilwatertank|sanitair|douche|kraan)\b/i,
      q: "Wat zoek je voor het sanitair?",
      opts: [["Scheepstoiletten", C("meai-scheepstoiletten")], ["Toiletonderdelen", C("meai-toiletonderdelen")], ["Vuilwatertanks", C("meai-vuilwatertanks")],
             ["Kranen & douches", C("meai-kranen-douches")], ["Watertanks", C("meai-watertanks-en-tankaccessoires")]] },
    { id: "koelen", label: "koelen", keys: /\b(koelkast|koelkasten|koelbox|koelboxen|koellade|koelen)\b/i,
      q: "Wat voor koeling zoek je?",
      opts: [["Koelkasten", C("meai-koelkasten")], ["Koelboxen", C("meai-koelboxen")], ["Koellades & koelunits", C("meai-koellades-koelunits")]] },
    { id: "rubberboot", label: "rubberboten en RIB's", keys: /\b(rubberboot|rubberboten|rib|ribs|bijboot|opblaasboot)\b/i,
      q: "Wat zoek je?",
      opts: [["Rubberboten & RIB's", C("meai-rubberboten-ribs")], ["Onderdelen & accessoires", C("meai-rubberbootonderdelen-en-accessoires")], ["Elektrische buitenboordmotoren", C("meai-elektrische-buitenboordmotoren")],
             ["Opblaaspompen", C("meai-opblaaspompen")], ["Peddels & roeiriemen", C("meai-peddels-roeiriemen")]] },
    { id: "besturing", label: "besturing", keys: /\b(stuur|stuurwiel|stuurkabel|besturing|stuurkop)\b/i,
      q: "Welk deel van de besturing zoek je?",
      opts: [["Stuurwielen", C("meai-stuurwielen")], ["Stuurkabels", C("meai-stuurkabels")], ["Mechanische besturing", C("meai-mechanische-besturing")], ["Hydraulische besturing", C("meai-hydraulische-besturing")]] },
    { id: "kit", label: "kit en tape", keys: /\b(kit|kitten|sikaflex|lijm|afdichten|afdichtmiddel|tape)\b/i,
      q: "Wat wil je afdichten of repareren?",
      opts: [["Kit & afdichtmiddelen", C("meai-kit-afdichtmiddelen")], ["Tape & reparatie", C("meai-tape-reparatie")], ["Plamuur & epoxy", C("meai-plamuur-epoxy")]] },
    { id: "veiligheid", label: "veiligheid", keys: /\b(veiligheid|brandblusser|blusdeken|reddingsvlot|ais|mob)\b/i,
      q: "Wat zoek je voor de veiligheid aan boord?",
      opts: [["Brandblussers & blusdekens", C("meai-brandblussers-blusdekens")], ["Reddingsvlotten", C("meai-reddingsvlotten")], ["AIS & MOB-bakens", C("meai-ais-mob-bakens")],
             ["Reddingsboeien", C("meai-reddingsboeien")], ["Alle veiligheid", C("veiligheid")]] },
    { id: "vlag", label: "vlaggen", keys: /\b(vlag|vlaggen|vlaggenstok)\b/i,
      q: "Wat zoek je?", opts: [["Vlaggen & vlaggenstokken", C("meai-vlaggen-vlaggenstokken")]] }
  ];

  function findCat(text) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].keys.test(text)) return CATS[i];
    return null;
  }
  var STOP = /^(voor|van|de|het|een|mijn|op|met|en|in|bij|aan|om|te|die|dat|welke|wat|ik|zoek|nodig)$/i;
  function meaningful(text) {
    return String(text || "").toLowerCase().split(/[^a-z0-9à-ÿ-]+/i).filter(function (w) { return w && !STOP.test(w); });
  }
  function stem(w) { return String(w).toLowerCase().replace(/(en|s)$/, ""); }
  // Specifieke keuze binnen een categorie, bijv. "primer voor antifouling" -> Primers.
  function findOpt(text) {
    var words = meaningful(text).map(stem);
    if (words.length < 2) return null;
    var hits = [];
    for (var i = 0; i < CATS.length; i++)
      for (var j = 0; j < CATS[i].opts.length; j++) {
        var label = CATS[i].opts[j][0];
        if (/^alle /i.test(label)) continue;
        var lw = meaningful(label).map(stem);
        if (lw.length && lw.every(function (x) { return words.some(function (w) { return w === x || (x.length > 4 && w.indexOf(x) === 0); }); }))
          hits.push({ label: label, url: CATS[i].opts[j][1], generic: CATS[i].keys.test(label) });
      }
    // Liefst de specifieke keuze (Primers), niet de categorienaam zelf (Antifouling).
    return hits.filter(function (h) { return !h.generic; })[0] || null;
  }
  function optUrl(label) {
    var l = String(label || "").trim().toLowerCase();
    for (var i = 0; i < CATS.length; i++)
      for (var j = 0; j < CATS[i].opts.length; j++)
        if (CATS[i].opts[j][0].toLowerCase() === l) return CATS[i].opts[j][1];
    return "";
  }

  function parseContext(root) {
    try { return JSON.parse(root.querySelector("[data-captain-context]").textContent); }
    catch (e) { return { pageType: "", product: null, collection: null, url: location.href }; }
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function chipsHtml(choices) {
    if (!Array.isArray(choices) || !choices.length) return "";
    return '<div class="ww-captain__choices">' + choices.slice(0, 6).map(function (c) {
      return '<button type="button" class="ww-captain__chip" data-captain-choice="' + esc(c) + '">' + esc(c) + "</button>";
    }).join("") + "</div>";
  }

  function linkChipsHtml(opts) {
    return '<div class="ww-captain__choices">' + opts.map(function (o) {
      return '<a class="ww-captain__chip" href="' + esc(o[1]) + '">' + esc(o[0]) + "</a>";
    }).join("") + "</div>";
  }

  function sourceName(s) {
    var t = String(s.title || "").trim();
    if (t && !/^https?:\/\//i.test(t)) return t.length > 70 ? t.slice(0, 67) + "…" : t;
    try {
      var u = new URL(s.url);
      var file = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() || "");
      var host = u.hostname.replace(/^www\./, "").replace(/^cdn\d*\./, "");
      var isPdf = /\.pdf$/i.test(file);
      file = file.replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[-_]+/g, " ");
      if (file.length > 34) file = file.slice(0, 31) + "…";
      return (isPdf ? "Handleiding (PDF) – " : "") + host + (file && !isPdf ? " – " + file : "");
    } catch (e) { return "Bron"; }
  }

  function sourcesHtml(sources) {
    if (!Array.isArray(sources) || !sources.length) return "";
    var items = sources.filter(function (s) { return s && s.url; }).slice(0, 4);
    if (!items.length) return "";
    return '<details class="ww-captain__sources"><summary>Bronnen (' + items.length + ")</summary><ul>" +
      items.map(function (s) {
        return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener nofollow">' + esc(sourceName(s)) + "</a></li>";
      }).join("") + "</ul></details>";
  }

  function clean(t) {
    return String(t == null ? "" : t)
      .replace(/\s*\(\[[^\]]+\]\((https?:\/\/[^)\s]+)\)\)/g, "")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1")
      .replace(/\s+([.,;:])/g, "$1");
  }

  function answerHtml(raw) {
    var data;
    try { data = JSON.parse(raw); } catch (e) { return "<p>" + esc(raw) + "</p>"; }
    if (data && data.local) return data.html || "";
    var blocks = [];
    if (data.summary) blocks.push("<p>" + esc(clean(data.summary)) + "</p>");
    [["Let op", data.safety], ["Controleer dit", data.checks], ["Mogelijke oorzaken", data.causes], ["Advies", data.solution]].forEach(function (s) {
      if (!Array.isArray(s[1]) || !s[1].length) return;
      blocks.push("<div><strong>" + s[0] + "</strong><ul>" + s[1].map(function (i) { return "<li>" + esc(clean(i)) + "</li>"; }).join("") + "</ul></div>");
    });
    if (data.follow_up) blocks.push('<p class="ww-captain__followup">' + esc(clean(data.follow_up)) + "</p>");
    blocks.push(chipsHtml(data.choices));
    return blocks.join("");
  }

  function money(p) {
    var n = Number(p);
    if (!isFinite(n) || !n) return "";
    return "€ " + n.toFixed(2).replace(".", ",");
  }

  function productCards(products) {
    if (!Array.isArray(products) || !products.length) return "";
    return '<div class="ww-captain__products">' +
      '<p class="ww-captain__cart-offer">' + (products.length > 1 ? "Mijn advies voor jou:" : "Mijn advies:") + "</p>" +
      products.map(function (product, idx) {
        var variants = Array.isArray(product.variants) ? product.variants.filter(function (v) { return v && v.available; }) : [];
        if (!variants.length && product.available && product.variantId)
          variants.push({ id: product.variantId, title: product.variantTitle || "", available: true, options: [] });
        var label = function (v) {
          var o = (Array.isArray(v.options) ? v.options : []).filter(function (x) { return x && x.value && x.value !== "Default Title"; })
            .map(function (x) { return x.name + ": " + x.value; }).join(" · ");
          return o || (v.title && v.title !== "Default Title" ? v.title : "Standaard uitvoering");
        };
        var choice = "";
        var action = '<a class="ww-captain__choose" href="' + esc(product.url) + '">Bekijk product</a>';
        if (variants.length === 1) {
          action = '<button type="button" class="ww-captain__add" data-captain-add data-variant-id="' + esc(String(variants[0].id || "").split("/").pop()) +
            '" data-product-title="' + esc(product.title) + '">In winkelwagen</button>';
        } else if (variants.length > 1) {
          var sid = "captain-variant-" + Math.random().toString(36).slice(2);
          choice = '<label class="ww-captain__variant-label" for="' + sid + '">Kies uitvoering</label><select class="ww-captain__variant-select" id="' + sid + '" data-captain-variant-select>' +
            variants.map(function (v) { return '<option value="' + esc(String(v.id || "").split("/").pop()) + '">' + esc(label(v)) + "</option>"; }).join("") + "</select>";
          action = '<button type="button" class="ww-captain__add" data-captain-add data-product-title="' + esc(product.title) + '">In winkelwagen</button>';
        }
        var price = money(product.price);
        return '<div class="ww-captain__product' + (idx === 0 ? " ww-captain__product--top" : "") + '">' +
          (idx === 0 && products.length > 1 ? '<span class="ww-captain__badge">Aanbevolen</span>' : "") +
          '<a class="ww-captain__product-link" href="' + esc(product.url) + '">' +
          (product.imageUrl ? '<img src="' + esc(product.imageUrl + (product.imageUrl.indexOf("?") > -1 ? "&" : "?") + "width=160") + '" alt="" loading="lazy">' : "") +
          "<span>" + esc(product.title) + (price ? "<small>" + (variants.length > 1 ? "Vanaf " : "") + price + "</small>" : "") + "</span></a>" +
          choice +
          '<div class="ww-captain__buy"><label class="ww-captain__qty"><span>Aantal</span><input type="number" min="1" max="99" value="' +
          esc(Math.max(1, Number(product.quantity) || 1)) + '" data-captain-qty></label>' + action + "</div></div>";
      }).join("") + "</div>";
  }

  function messageNode(role, content, products, sources) {
    var node = document.createElement("div");
    node.className = "ww-captain__message ww-captain__message--" + role;
    node.innerHTML = (role === "assistant"
      ? '<div class="ww-captain__msg-head"><img src="' + esc(window.__wwCaptainAvatar || "") + '" alt="" width="22" height="22"><strong>Captain AI</strong></div>' + answerHtml(content)
      : "<p>" + esc(content) + "</p>") + productCards(products) + (role === "assistant" ? sourcesHtml(sources) : "");
    return node;
  }

  function local(html) { return JSON.stringify({ local: true, html: html }); }
  function plain(summary, choices) {
    return JSON.stringify({ summary: summary, urgency: "normal", safety: [], causes: [], checks: [], solution: [], follow_up: "", choices: choices || [] });
  }

  function initialize(root) {
    if (root.dataset.captainReady === "true") return;
    root.dataset.captainReady = "true";
    window.__wwCaptainAvatar = root.dataset.image || "";

    var context = parseContext(root);
    var endpoint = root.dataset.endpoint;
    var panel = root.querySelector("[data-captain-panel]");
    var launcher = root.querySelector("[data-captain-open]");
    var closeBtn = root.querySelector("[data-captain-close]");
    var homeBtn = root.querySelector("[data-captain-home]");
    var status = root.querySelector("[data-captain-status]");
    var gate = root.querySelector("[data-captain-gate]");
    var chat = root.querySelector("[data-captain-chat]");
    var form = root.querySelector("[data-captain-form]");
    var question = root.querySelector("[data-captain-question]");
    var messages = root.querySelector("[data-captain-messages]");
    var remaining = root.querySelector("[data-captain-remaining]");
    var tip = root.querySelector("[data-captain-tip]");
    var tipCopy = root.querySelector("[data-captain-tip-text]");
    var nav = root.querySelector("[data-captain-navigator]");
    var menu = root.querySelector("[data-captain-menu]");
    var finder = root.querySelector("[data-captain-finder]");
    var searchForm = root.querySelector("[data-captain-shop-search]");
    var searchInput = root.querySelector("[data-captain-shop-search-input]");
    var label = root.querySelector("[data-captain-context-label]");
    var ready = false;
    var locked = false;
    function endpointUrl() { return endpoint; }
    var anonWrap = null;
    function renderAnon(billing) {
      if (!remaining) return;
      if (!billing || !billing.anonymousAllowed) { if (anonWrap) anonWrap.hidden = true; return; }
      if (!anonWrap) {
        anonWrap = document.createElement("label");
        anonWrap.className = "ww-captain__consent";
        anonWrap.innerHTML = '<input type="checkbox" data-captain-anon> <span>Anoniem vragen: mijn vragen niet gebruiken om Captain AI te verbeteren (betaalde versie).</span>';
        remaining.parentNode.insertBefore(anonWrap, remaining.nextSibling);
        anonWrap.querySelector("input").addEventListener("change", function (ev) {
          var box = ev.target;
          request("POST", { intent: "set_anonymous", anonymous: box.checked }).catch(function () { box.checked = !box.checked; });
        });
      }
      anonWrap.hidden = false;
      anonWrap.querySelector("input").checked = !!billing.anonymous;
    }
    function unlock() {
      locked = false;
      if (chat) chat.classList.remove("is-locked");
      if (form) {
        form.hidden = false;
        delete form.dataset.captainLocked;
        question.disabled = false;
        form.querySelector("button[type=submit]").disabled = false;
      }
      Array.prototype.forEach.call(root.querySelectorAll(".ww-captain__profile-nudge--hard"), function (n) { n.remove(); });
    }
    var hasPage = !!(context.product || context.collection);
    var pageTitle = context.product ? context.product.title : (context.collection ? context.collection.title : "");
    var about = hasPage ? null : "other";
    var pendingQuestion = "";

    if (context.product) label.textContent = "Je bekijkt: " + context.product.title;
    else if (context.collection) label.textContent = "Je bekijkt: " + context.collection.title;
    else label.hidden = true;

    /* ----- modi: menu of gesprek ----- */
    function showMenu() {
      nav.hidden = false;
      chat.hidden = true;
      finder.hidden = true;
      homeBtn.hidden = true;
      if (messages.children.length) addResume();
    }
    function showChat() {
      nav.hidden = true;
      chat.hidden = false;
      homeBtn.hidden = false;
      messages.scrollTop = messages.scrollHeight;
    }
    function addResume() {
      if (menu.querySelector("[data-captain-resume]")) return;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "ww-captain__resume";
      b.setAttribute("data-captain-resume", "");
      b.textContent = "↩ Verder met je gesprek";
      b.onclick = showChat;
      menu.insertBefore(b, menu.firstChild);
    }

    function setOpen(value) {
      panel.hidden = !value;
      launcher.setAttribute("aria-expanded", String(value));
      root.classList.toggle("is-open", value);
      if (value) {
        tip.hidden = true;
        try { sessionStorage.setItem(TEASER_KEY, "1"); } catch (e) {}
        connect();
      }
    }
    launcher.addEventListener("click", function () { setOpen(panel.hidden); });
    closeBtn.addEventListener("click", function () { setOpen(false); });
    homeBtn.addEventListener("click", showMenu);
    root.querySelector("[data-captain-tip-close]").addEventListener("click", function () {
      tip.hidden = true;
      try { sessionStorage.setItem(TEASER_KEY, "1"); } catch (e) {}
    });
    root.querySelector("[data-captain-tip-open]").addEventListener("click", function () { setOpen(true); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) setOpen(false); });

    /* knop "Vraag Captain AI om advies" op de productpagina */
    document.addEventListener("click", function (e) {
      if (!e.target.closest("[data-ww-open-captain]")) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (panel.hidden) setOpen(true);
      showMenu();
    }, true);

    /* ----- hoofdmenu ----- */
    function item(icon, title, sub, onClick, href) {
      var el = document.createElement(href ? "a" : "button");
      if (href) el.href = href; else el.type = "button";
      el.className = "ww-captain__menu-item";
      el.innerHTML = '<span class="ww-captain__menu-icon" aria-hidden="true">' + icon + '</span><span><b>' + esc(title) + "</b><small>" + esc(sub) + "</small></span>";
      if (onClick) el.addEventListener("click", function (e) { e.preventDefault(); onClick(); });
      return el;
    }
    function group(title) {
      var h = document.createElement("p");
      h.className = "ww-captain__menu-title";
      h.textContent = title;
      return h;
    }

    function buildMenu() {
      menu.innerHTML = "";
      if (context.product) {
        var t = context.product.title;
        menu.appendChild(group("Over dit product"));
        menu.appendChild(item("✅", "Past dit op mijn boot?", "Ik check het voor je", function () { askAbout("product", "Past " + t + " op mijn boot? Vraag gerust wat je van mijn boot moet weten."); }));
        menu.appendChild(item("🧰", "Wat heb ik er nog bij nodig?", "Complete set voor de klus", function () { askAbout("product", "Wat heb ik nog meer nodig bij " + t + " om de klus in één keer goed te doen?"); }));
        menu.appendChild(item("📏", "Welke maat of uitvoering kies ik?", "Advies op maat", function () { askAbout("product", "Welke maat of uitvoering van " + t + " moet ik kiezen?"); }));
        menu.appendChild(group("Of iets anders"));
      } else if (context.collection) {
        var ct = context.collection.title;
        menu.appendChild(item("🧭", "Help mij kiezen", "Binnen " + ct, function () { askAbout("product", "Help mij kiezen binnen " + ct + ". Wat moet ik weten?"); }));
      }
      menu.appendChild(item("🔎", "Producten zoeken", "Snel naar de juiste categorie", openFinderHome));
      menu.appendChild(item("🛠️", "Boot onderhoud", "Motor, winterklaar, antifouling", openMaintenance));
      menu.appendChild(item("💬", "Stel een vraag aan Captain", "Advies, handleidingen, onderdelen", function () { showChat(); setTimeout(function () { question.focus(); }, 60); }));
      menu.appendChild(item("⚓", context.customer ? "Mijn bootprofiel" : "Bootprofiel aanmaken", "Gratis – advies op maat van jouw boot", null,
        context.customer ? "/pages/digitaal-bootprofiel" : PROFILE_URL));
      menu.appendChild(item("❄️", "Boot winterklaar", "Alles om je boot de winter door te helpen", null, "/collections/onlangs-toegevoegd"));
      menu.appendChild(item("📞", "Liever iemand spreken?", "Bel 0513-241911 (ma–vr 9–17 uur)", null, "tel:+31513241911"));
      if (messages.children.length) addResume();
    }

    function finderShow(html) {
      finder.innerHTML = '<button type="button" class="ww-captain__back" data-captain-finder-back>← Terug</button>' + html;
      finder.hidden = false;
      menu.hidden = true;
      finder.querySelector("[data-captain-finder-back]").onclick = function () {
        finder.hidden = true;
        menu.hidden = false;
      };
    }
    function openFinderHome() {
      finderShow('<strong class="ww-captain__finder-q">Waar ben je naar op zoek?</strong>' +
        '<div class="ww-captain__choices">' + CATS.map(function (c) {
          return '<button type="button" class="ww-captain__chip" data-captain-cat="' + c.id + '">' + esc(c.label.charAt(0).toUpperCase() + c.label.slice(1)) + "</button>";
        }).join("") + "</div>");
      try { searchInput.focus({ preventScroll: true }); } catch (e) {}
    }
    function openCat(cat, typed) {
      finderShow('<strong class="ww-captain__finder-q">' + esc(cat.q) + "</strong>" + linkChipsHtml(cat.opts) +
        '<button type="button" class="ww-captain__ask" data-captain-cat-ask>🧭 Weet je het niet? Laat Captain adviseren</button>');
      finder.querySelector("[data-captain-cat-ask]").onclick = function () {
        askAbout("other", "Ik zoek " + (typed || cat.label) + ". Welke past het beste bij mijn boot?");
      };
    }
    function openMaintenance() {
      finderShow('<strong class="ww-captain__finder-q">Waar ben je mee bezig?</strong>' +
        '<div class="ww-captain__choices">' +
        '<button type="button" class="ww-captain__chip" data-captain-ask="Ik wil mijn motor onderhouden (olie, filters, impeller). Wat heb ik nodig voor mijn motor?">Motor onderhouden</button>' +
        '<button type="button" class="ww-captain__chip" data-captain-ask="Ik wil mijn boot winterklaar maken. Wat moet ik doen en wat heb ik nodig?">Winterklaar maken</button>' +
        '<button type="button" class="ww-captain__chip" data-captain-cat="antifouling">Onderwaterschip & antifouling</button>' +
        '<button type="button" class="ww-captain__chip" data-captain-cat="poetsen">Poetsen & polijsten</button>' +
        '<button type="button" class="ww-captain__chip" data-captain-ask="Ik zoek de handleiding van mijn motor. Kun je die voor mij vinden?">Handleiding zoeken</button>' +
        '<button type="button" class="ww-captain__chip" data-captain-ask="Ik zoek een onderdeel voor mijn motor of boot. Kun je helpen het juiste onderdeel te vinden?">Onderdeel zoeken</button>' +
        "</div>");
    }

    finder.addEventListener("click", function (e) {
      var c = e.target.closest("[data-captain-cat]");
      if (c) {
        var cat = CATS.filter(function (x) { return x.id === c.dataset.captainCat; })[0];
        if (cat) openCat(cat);
        return;
      }
      var a = e.target.closest("[data-captain-ask]");
      if (a) askAbout("other", a.dataset.captainAsk);
    });

    searchForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = searchInput.value.trim();
      if (!q) return;
      if (q.split(/\s+/).length >= 4 || /\?$/.test(q)) { ask(q); return; }
      var opt = findOpt(q);
      if (opt) { location.href = opt.url; return; }
      var cat = findCat(q);
      if (cat && meaningful(q).length <= 1) { openCat(cat, q); return; }
      location.href = S(meaningful(q).join(" ") || q);
    });

    /* ----- verbinding en gesprek ----- */
    function request(method, body) {
      return fetch(endpointUrl(), {
        method: method,
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: body ? JSON.stringify(body) : undefined
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (json) {
          if (!response.ok || !json.success) {
            var error = new Error(json.message || "Captain AI reageert tijdelijk niet.");
            error.payload = json;
            throw error;
          }
          return json;
        });
      });
    }

    function setRemaining(d) {
      if (d && d.billing) renderAnon(d.billing);
      if (d && d.billing && d.billing.statusText) remaining.textContent = d.billing.statusText;
      else if (typeof d.remaining === "number") remaining.textContent = "Nog " + d.remaining + " gratis adviesvragen";
    }

    function buyBox(payload) {
      var b = payload.billing || {};
      var box = document.createElement("div");
      box.className = "ww-captain__profile-nudge ww-captain__profile-nudge--hard ww-captain__buy-box";
      var packs = (b.packs || []).map(function (p) {
        return '<button type="button" class="ww-captain__pack" data-captain-pack="' + esc(p.id) + '" data-captain-variant="' + esc(p.variantId) + '"><span class="ww-captain__pack-top"><b>' + esc(p.label) + '</b><span>' + esc(p.price) + '</span></span><small>' + esc(p.description) + '</small></button>';
      }).join("");
      box.innerHTML = "<strong>Je " + esc(String(payload.limit || 6)) + " gratis vragen voor vandaag zijn op</strong><p>Ga direct verder met Captain AI, of stel morgen weer gratis vragen. Met deze kleine bijdrage help je Captain AI verder te ontwikkelen.</p>" +
        '<div class="ww-captain__packs">' + packs + '</div><p class="ww-captain__pack-note">Afrekenen via de gewone WetterWinkel-kassa (iDEAL e.d.). Bestel met hetzelfde e-mailadres als je account; de vragen worden direct bijgeschreven. Geen abonnement.</p>';
      box.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-captain-pack]");
        if (!btn) return;
        btn.disabled = true;
        btn.querySelector("small").textContent = "Naar de kassa…";
        var variant = btn.getAttribute("data-captain-variant");
        fetch("/cart/add.js", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ items: [{ id: Number(variant), quantity: 1 }] })
        }).then(function (r) {
          if (!r.ok) throw new Error("Toevoegen aan winkelwagen mislukt.");
          window.location.href = "/checkout";
        }).catch(function (error) {
          btn.disabled = false;
          btn.querySelector("small").textContent = error.message || "Probeer het opnieuw of bel 0513-241911.";
        });
      });
      return box;
    }

    function lock(payload) {
      locked = true;
      form.dataset.captainLocked = "true";
      question.disabled = true;
      form.querySelector("button[type=submit]").disabled = true;
      Array.prototype.forEach.call(root.querySelectorAll(".ww-captain__profile-nudge--hard"), function (n) { n.remove(); });
      chat.classList.add("is-locked");
      form.hidden = true;
      var showBox = function (b) {
        chat.appendChild(b);
        setTimeout(function () {
          messages.scrollTop = messages.scrollHeight;
          b.scrollIntoView({ block: "end", behavior: "smooth" });
        }, 60);
      };
      if (payload && payload.billing && payload.billing.canBuy) { showBox(buyBox(payload)); return; }
      var box = document.createElement("div");
      box.className = "ww-captain__profile-nudge ww-captain__profile-nudge--hard";
      var used = payload && payload.limit ? payload.limit : 2;
      box.innerHTML = "<strong>Je " + esc(String(used)) + " gratis proefvragen zijn op</strong><p>Maak gratis een bootprofiel aan: dan onthoudt Captain je boot en krijg je elke dag 5 gratis adviesvragen.</p>" +
        '<div><a href="' + esc((payload && payload.profileUrl) || PROFILE_URL) + '">Bootprofiel aanmaken</a><a class="ww-captain__ghost" href="tel:+31513241911">Bel 0513-241911</a></div>';
      showBox(box);
    }

    function softNudge() {
      if (chat.querySelector("[data-captain-soft]") || context.customer) return;
      var box = document.createElement("div");
      box.className = "ww-captain__profile-nudge";
      box.setAttribute("data-captain-soft", "");
      box.innerHTML = "<strong>Tip van de AI-schipper</strong><p>Met een gratis bootprofiel onthoud ik je boot en motor, zodat mijn advies precies past.</p>" +
        '<div><a href="' + PROFILE_URL + '">Bootprofiel aanmaken</a><button type="button">Later</button></div>';
      box.querySelector("button").onclick = function () { box.remove(); };
      messages.appendChild(box);
    }

    function connect() {
      if (ready) return;
      ready = true;
      request("GET").then(function (data) {
        gate.hidden = true;
        var history = Array.isArray(data.history) ? data.history : [];
        history.forEach(function (m) {
          var role = String(m.role || "").toUpperCase() === "USER" ? "user" : "assistant";
          messages.appendChild(messageNode(role, m.content || "", m.products || [], m.sources || []));
        });
        if (data.profileName && !history.length) {
          messages.appendChild(messageNode("assistant", plain("Ik gebruik je bootprofiel " + data.profileName + " en de pagina die je nu bekijkt. Waarmee kan ik helpen?")));
        }
        setRemaining(data);
        if (data.limitReached || data.remaining === 0) lock(data);
        if (history.length) addResume();
      }).catch(function (error) {
        gate.hidden = true;
        var p = error && error.payload;
        if (p && (p.limitReached || p.remaining === 0)) lock(p);
        else remaining.textContent = "5 gratis adviesvragen per dag met je bootprofiel";
      });
    }

    /* ----- waar gaat de vraag over: dit product of iets anders ----- */
    var focusBar = document.createElement("div");
    focusBar.className = "ww-captain__focus";
    chat.insertBefore(focusBar, form);
    function renderFocus() {
      if (!hasPage) { focusBar.hidden = true; return; }
      focusBar.hidden = false;
      focusBar.innerHTML = "<span>Je vraag gaat over:</span>" +
        '<button type="button" data-captain-focus="product" class="' + (about === "product" ? "is-active" : "") + '">' + esc(context.product ? "Dit product" : "Deze categorie") + "</button>" +
        '<button type="button" data-captain-focus="other" class="' + (about === "other" ? "is-active" : "") + '">Iets anders</button>';
      focusBar.title = pageTitle;
    }
    focusBar.addEventListener("click", function (e) {
      var b = e.target.closest("[data-captain-focus]");
      if (!b) return;
      about = b.dataset.captainFocus;
      renderFocus();
      if (pendingQuestion) { var q = pendingQuestion; pendingQuestion = ""; pendingShown = true; send(q, true); }
    });
    renderFocus();

    function askAbout(which, text) {
      about = which;
      renderFocus();
      ask(text);
    }

    function ask(text) {
      if (panel.hidden) setOpen(true);
      showChat();
      send(text, true);
    }

    function send(value, force) {
      value = String(value || "").trim();
      if (!value || locked) return;
      if (hasPage && !about) {
        pendingQuestion = value;
        messages.appendChild(messageNode("user", value));
        var q = "<p>Gaat je vraag over <b>" + esc(pageTitle) + "</b> of over iets anders?</p>" +
          '<div class="ww-captain__choices"><button type="button" class="ww-captain__chip" data-captain-pick="product">Over ' + esc(context.product ? "dit product" : "deze categorie") + '</button>' +
          '<button type="button" class="ww-captain__chip" data-captain-pick="other">Over iets anders</button></div>';
        messages.appendChild(messageNode("assistant", local(q)));
        messages.scrollTop = messages.scrollHeight;
        return;
      }
      var cat = findCat(value);
      if (!force && cat && meaningful(value).length <= 1) {
        messages.appendChild(messageNode("user", value));
        var html = "<p>" + esc(cat.q) + "</p>" + linkChipsHtml(cat.opts) +
          '<button type="button" class="ww-captain__ask" data-captain-advise="' + esc(value) + '">🧭 Laat Captain adviseren wat bij jouw boot past</button>';
        messages.appendChild(messageNode("assistant", local(html)));
        messages.scrollTop = messages.scrollHeight;
        return;
      }
      var button = form.querySelector("button[type=submit]");
      button.disabled = true;
      button.textContent = "Captain denkt na…";
      if (!pendingShown) messages.appendChild(messageNode("user", value));
      pendingShown = false;
      var thinking = document.createElement("div");
      thinking.className = "ww-captain__message ww-captain__message--assistant ww-captain__thinking";
      thinking.innerHTML = "<span></span><span></span><span></span>";
      messages.appendChild(thinking);
      messages.scrollTop = messages.scrollHeight;
      request("POST", { message: value, context: about === "product" ? context : { pageType: context.pageType, url: context.url, product: null, collection: null, customer: context.customer } }).then(function (data) {
        thinking.remove();
        messages.appendChild(messageNode("assistant", data.message.content, data.message.products, data.message.sources));
        setRemaining(data);
        if (data.limitReached) lock(data);
        else if (data.profilePrompt) softNudge();
      }).catch(function (error) {
        thinking.remove();
        var p = error.payload || {};
        if (p.limitReached) lock(p);
        else messages.appendChild(messageNode("assistant", plain(error.message + " Bel ons gerust: 0513-241911.")));
      }).then(function () {
        button.disabled = locked;
        button.textContent = "Vraag stellen";
        messages.scrollTop = messages.scrollHeight;
      });
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var v = question.value.trim();
      if (!v) return;
      question.value = "";
      send(v, false);
    });
    question.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event("submit", { cancelable: true }));
      }
    });

    var pendingShown = false;
    messages.addEventListener("click", function (event) {
      var pick = event.target.closest("[data-captain-pick]");
      if (pick) {
        about = pick.dataset.captainPick;
        renderFocus();
        pick.parentElement.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
        pick.classList.add("ww-captain__chip--primary");
        if (pendingQuestion) { var pq = pendingQuestion; pendingQuestion = ""; pendingShown = true; send(pq, true); }
        return;
      }
      var choice = event.target.closest("[data-captain-choice]");
      if (choice) {
        var txt = choice.dataset.captainChoice;
        var url = optUrl(txt);
        if (url) { location.href = url; return; }
        send(txt, true);
        return;
      }
      var adv = event.target.closest("[data-captain-advise]");
      if (adv) { send("Ik zoek " + adv.dataset.captainAdvise + ". Welke past het beste bij mijn boot?", true); return; }

      var button = event.target.closest("[data-captain-add]");
      if (!button || button.disabled) return;
      var card = button.closest(".ww-captain__product");
      var selector = card && card.querySelector("[data-captain-variant-select]");
      var variantId = selector ? selector.value : button.dataset.variantId;
      var qtyInput = card && card.querySelector("[data-captain-qty]");
      var qty = Math.max(1, Math.min(99, parseInt(qtyInput && qtyInput.value, 10) || 1));
      var variantLabel = selector && selector.selectedIndex >= 0 ? selector.options[selector.selectedIndex].textContent : "";
      var productTitle = button.dataset.productTitle || "Het product";
      if (!variantId) return;
      button.disabled = true;
      button.textContent = "Wordt toegevoegd…";
      fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ items: [{ id: variantId, quantity: qty }] })
      }).then(function (r) {
        if (!r.ok) throw new Error("fail");
        button.textContent = "Toegevoegd ✓";
        return fetch("/cart.js", { headers: { "Accept": "application/json" } }).then(function (c) { return c.json(); });
      }).then(function (cart) {
        document.querySelectorAll(".cart-count, .cart-count-bubble span[aria-hidden='true']").forEach(function (n) { n.textContent = String(cart.item_count || 0); });
        var total = (cart.total_price || 0) / 100;
        var rest = 75 - total;
        var msg = (qty > 1 ? qty + "× " : "") + productTitle + (variantLabel ? " (" + variantLabel + ")" : "") + " ligt in je winkelwagen.";
        msg += rest > 0 ? " Nog " + money(rest) + " tot gratis verzending." : " Je bestelling wordt gratis verzonden!";
        var node = messageNode("assistant", plain(msg));
        node.insertAdjacentHTML("beforeend", '<div class="ww-captain__choices"><a class="ww-captain__chip ww-captain__chip--primary" href="/cart">Naar winkelwagen</a>' +
          '<button type="button" class="ww-captain__chip" data-captain-choice="Wat heb ik er nog meer bij nodig?">Wat heb ik er nog bij nodig?</button></div>');
        messages.appendChild(node);
        messages.scrollTop = messages.scrollHeight;
      }).catch(function () {
        button.disabled = false;
        button.textContent = "In winkelwagen";
        messages.appendChild(messageNode("assistant", plain("Toevoegen lukte niet. Open het product en kies daar de uitvoering.")));
      });
    });

    /* ----- subtiel tekstballonnetje ----- */
    var teaserSeen = false;
    try { teaserSeen = sessionStorage.getItem(TEASER_KEY) === "1"; } catch (e) {}
    if (!teaserSeen) {
      tipCopy.textContent = context.product ? "Vragen over dit product? Ik help je kiezen." : "Waarmee kan ik je helpen?";
      setTimeout(function () {
        if (!panel.hidden) return;
        tip.hidden = false;
        try { sessionStorage.setItem(TEASER_KEY, "1"); } catch (e) {}
        setTimeout(function () { tip.hidden = true; }, 12000);
      }, context.product ? 6000 : 4000);
    }

    document.addEventListener("change", function (event) {
      if (!context.product || !event.target.closest('form[action*="/cart/add"]')) return;
      var input = event.target.closest("form").querySelector('[name="id"]');
      if (input && input.value) {
        context.product.variantId = input.value;
        var v = Array.isArray(context.product.variants) ? context.product.variants.filter(function (x) { return String(x.id) === String(input.value); })[0] : null;
        if (v) { context.product.variantTitle = v.title || ""; context.product.sku = v.sku || ""; }
      }
    });

    buildMenu();
    showMenu();
  }

  function start(scope) { (scope || document).querySelectorAll("[data-ww-captain]").forEach(initialize); }
  start();
  document.addEventListener("shopify:section:load", function (e) { start(e.target); });
})();
