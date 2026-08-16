(function () {
  const TIP_KEY = "ww-captain-tip-v2";
  const DAY = 24 * 60 * 60 * 1000;

  function parseContext(root) {
    try {
      return JSON.parse(root.querySelector("[data-captain-context]").textContent);
    } catch {
      return { pageType: "", product: null, collection: null, url: location.href };
    }
  }

  function productLooksLikeFender(product) {
    if (!product) return false;
    return /\b(fender|fenders|stootwil|stootwillen|stootkussen)\b/i.test(
      [product.title, product.type, product.vendor, (product.tags || []).join(" ")].join(" "),
    );
  }

  function tipText(context) {
    if (productLooksLikeFender(context.product)) {
      return "Ik kan met uw bootprofiel helpen bepalen welke maat en hoeveel fenders u nodig heeft.";
    }
    if (context.product) {
      return "Twijfelt u of dit product bij uw boot past? Vraag het Captain AI.";
    }
    if (context.collection) {
      return "Hulp nodig met kiezen binnen " + context.collection.title + "? Vraag het Captain AI.";
    }
    return "Heeft u een vraag over onderhoud of een passend product? Vraag het Captain AI.";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function answerHtml(raw) {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return "<p>" + escapeHtml(raw) + "</p>";
    }
    const blocks = [];
    if (data.summary) blocks.push("<p><strong>Advies</strong>" + escapeHtml(data.summary) + "</p>");
    const sections = [
      ["Let op", data.safety],
      ["Controleer dit", data.checks],
      ["Mogelijke oorzaken", data.causes],
      ["Aanpak", data.solution],
    ];
    sections.forEach(([title, items]) => {
      if (!Array.isArray(items) || !items.length) return;
      blocks.push(
        "<div><strong>" + title + "</strong><ul>" +
          items.map((item) => "<li>" + escapeHtml(item) + "</li>").join("") +
        "</ul></div>",
      );
    });
    if (data.follow_up) blocks.push("<p><strong>Nog één vraag</strong>" + escapeHtml(data.follow_up) + "</p>");
    return blocks.join("");
  }

  function productCards(products) {
    if (!Array.isArray(products) || !products.length) return "";
    return '<div class="ww-captain__products">' +
      products.map((product) =>
        '<a class="ww-captain__product" href="' + escapeHtml(product.url) + '">' +
          (product.imageUrl ? '<img src="' + escapeHtml(product.imageUrl) + '" alt="">' : "") +
          '<span>' + escapeHtml(product.title) +
            (product.price ? '<small>Vanaf ' + escapeHtml(product.price) + " " + escapeHtml(product.currency || "EUR") + "</small>" : "") +
          "</span></a>",
      ).join("") + "</div>";
  }

  function messageNode(role, content, products) {
    const node = document.createElement("div");
    node.className = "ww-captain__message ww-captain__message--" + role;
    node.innerHTML =
      "<strong>" + (role === "user" ? "U" : "Captain AI") + "</strong>" +
      (role === "assistant" ? answerHtml(content) : "<p>" + escapeHtml(content) + "</p>") +
      productCards(products);
    return node;
  }

  function initialize(root) {
    if (root.dataset.captainReady === "true") return;
    root.dataset.captainReady = "true";

    const context = parseContext(root);
    const endpoint = root.dataset.endpoint;
    const panel = root.querySelector("[data-captain-panel]");
    const launcher = root.querySelector("[data-captain-open]");
    const close = root.querySelector("[data-captain-close]");
    const status = root.querySelector("[data-captain-status]");
    const gate = root.querySelector("[data-captain-gate]");
    const gateText = root.querySelector("[data-captain-gate-text]");
    const chat = root.querySelector("[data-captain-chat]");
    const form = root.querySelector("[data-captain-form]");
    const question = root.querySelector("[data-captain-question]");
    const messages = root.querySelector("[data-captain-messages]");
    const remaining = root.querySelector("[data-captain-remaining]");
    const tip = root.querySelector("[data-captain-tip]");
    const tipCopy = root.querySelector("[data-captain-tip-text]");
    let ready = false;

    const label = root.querySelector("[data-captain-context-label]");
    if (context.product) label.textContent = "U bekijkt: " + context.product.title;
    else if (context.collection) label.textContent = "U bekijkt: " + context.collection.title;
    else label.hidden = true;

    function setOpen(value) {
      panel.hidden = !value;
      launcher.setAttribute("aria-expanded", String(value));
      if (value) {
        tip.hidden = true;
        connect();
        setTimeout(() => question.focus(), 50);
      }
    }

    launcher.addEventListener("click", () => setOpen(panel.hidden));
    close.addEventListener("click", () => setOpen(false));
    root.querySelector("[data-captain-tip-close]").addEventListener("click", () => {
      tip.hidden = true;
    });
    root.querySelector("[data-captain-tip-open]").addEventListener("click", () => setOpen(true));

    async function request(method, body) {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.success) {
        const error = new Error(json.message || "Captain AI reageert tijdelijk niet.");
        error.payload = json;
        throw error;
      }
      return json;
    }

    async function connect() {
      if (ready) return;
      status.hidden = false;
      status.textContent = "Captain AI wordt verbonden…";
      try {
        const data = await request("GET");
        ready = true;
        status.hidden = true;
        gate.hidden = true;
        chat.hidden = false;
        if (data.profileName) {
          messages.appendChild(
            messageNode("assistant", JSON.stringify({
              summary: "Ik gebruik uw bootprofiel " + data.profileName + " en de pagina die u nu bekijkt. Waarmee kan ik helpen?",
              urgency: "normal", safety: [], causes: [], checks: [], solution: [], follow_up: ""
            })),
          );
        }
        if (typeof data.remaining === "number") {
          remaining.textContent = data.remaining + " vragen beschikbaar vandaag";
        }
      } catch (error) {
        status.hidden = true;
        chat.hidden = true;
        gate.hidden = false;
        gateText.textContent = error.payload && error.payload.message
          ? error.payload.message
          : "Log in en maak gratis uw bootprofiel om persoonlijk advies te krijgen.";
      }
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const value = question.value.trim();
      if (!value) return;
      const button = form.querySelector("button[type=submit]");
      button.disabled = true;
      button.textContent = "Captain AI denkt na…";
      messages.appendChild(messageNode("user", value));
      question.value = "";
      messages.scrollTop = messages.scrollHeight;
      try {
        const data = await request("POST", { message: value, context });
        messages.appendChild(messageNode("assistant", data.message.content, data.message.products));
        if (typeof data.remaining === "number") {
          remaining.textContent = data.remaining + " vragen beschikbaar vandaag";
        }
      } catch (error) {
        messages.appendChild(messageNode("assistant", JSON.stringify({
          summary: error.message,
          urgency: "attention", safety: [], causes: [], checks: [], solution: [], follow_up: ""
        })));
      } finally {
        button.disabled = false;
        button.textContent = "Vraag stellen";
        messages.scrollTop = messages.scrollHeight;
        question.focus();
      }
    });

    if (root.dataset.tips !== "false") {
      try {
        const last = Number(localStorage.getItem(TIP_KEY) || 0);
        if (Date.now() - last > DAY) {
          tipCopy.textContent = tipText(context);
          setTimeout(() => {
            if (panel.hidden) {
              tip.hidden = false;
              localStorage.setItem(TIP_KEY, String(Date.now()));
            }
          }, productLooksLikeFender(context.product) ? 5500 : 9000);
        }
      } catch {
        // Privacy settings may disable storage; the launcher remains available.
      }
    }

    document.addEventListener("change", (event) => {
      if (!context.product || !event.target.closest('form[action*="/cart/add"]')) return;
      const input = event.target.closest("form").querySelector('[name="id"]');
      if (input && input.value) {
        context.product.variantId = input.value;
        const variant = Array.isArray(context.product.variants)
          ? context.product.variants.find((item) => String(item.id) === String(input.value))
          : null;
        if (variant) {
          context.product.variantTitle = variant.title || "";
          context.product.sku = variant.sku || "";
          context.product.price = variant.price || context.product.price;
        }
      }
    });
  }

  function start(scope) {
    (scope || document).querySelectorAll("[data-ww-captain]").forEach(initialize);
  }

  start();
  document.addEventListener("shopify:section:load", (event) => start(event.target));
})();
