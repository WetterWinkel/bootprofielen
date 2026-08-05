/* global globalThis */
(function () {
  function visitorId() {
    const key = "ww-captain-visitor-v1";
    try {
      let value = localStorage.getItem(key);
      if (!value) {
        value =
          globalThis.crypto?.randomUUID?.() ||
          `ww_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        localStorage.setItem(key, value);
      }
      return value.replace(/[^a-zA-Z0-9_-]/g, "_");
    } catch {
      return `ww_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }
  }

  function text(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value || "";
    return node;
  }

  function addMessage(container, role, content, sources, products) {
    const box = text(
      "div",
      `ww-captain__message ww-captain__message--${role}`,
      "",
    );
    box.append(text("strong", "", role === "user" ? "U" : "Captain AI"));
    box.append(text("div", "", content));

    if (sources?.length) {
      const list = text("div", "ww-captain__sources", "");
      sources.forEach((source) => {
        if (!source.url) return;
        const link = text(
          "a",
          "ww-captain__source",
          source.title || "Gebruikte bron",
        );
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        list.append(link);
      });
      if (list.childNodes.length) box.append(list);
    }

    if (products?.length) {
      const list = text("div", "ww-captain__products", "");
      products.forEach((product) => {
        const link = text("a", "ww-captain__product", "");
        link.href = product.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        if (product.imageUrl) {
          const image = document.createElement("img");
          image.src = product.imageUrl;
          image.alt = product.imageAlt || product.title;
          image.loading = "lazy";
          link.append(image);
        }
        const body = text("div", "", "");
        body.append(text("span", "", product.title));
        const price = product.price
          ? new Intl.NumberFormat("nl-NL", {
              style: "currency",
              currency: product.currency || "EUR",
            }).format(Number(product.price))
          : "";
        body.append(
          text(
            "small",
            "",
            price ? `Vanaf ${price} · WetterWinkel` : "Bekijk bij WetterWinkel",
          ),
        );
        link.append(body);
        list.append(link);
      });
      box.append(list);
    }
    container.append(box);
    container.scrollTop = container.scrollHeight;
  }

  function initialize(root) {
    if (root.dataset.captainReady === "true") return;
    root.dataset.captainReady = "true";
    const id = visitorId();
    const api = root.dataset.api;
    const panel = root.querySelector("[data-captain-panel]");
    const open = root.querySelector("[data-captain-open]");
    const close = root.querySelector("[data-captain-close]");
    const form = root.querySelector("[data-captain-form]");
    const question = root.querySelector("[data-captain-question]");
    const send = root.querySelector("[data-captain-send]");
    const messages = root.querySelector("[data-captain-messages]");
    const remaining = root.querySelector("[data-captain-remaining]");
    const gate = root.querySelector("[data-captain-gate]");
    let busy = false;

    function showGate() {
      gate.hidden = false;
      form.hidden = true;
    }
    function setRemaining(count) {
      remaining.textContent =
        count === 1
          ? "Nog 1 openbare vraag beschikbaar"
          : `${count} openbare vragen beschikbaar`;
      if (count <= 0) showGate();
    }
    function boat() {
      return {
        brand: root.querySelector("[data-boat-brand]").value,
        model: root.querySelector("[data-boat-model]").value,
        length: root.querySelector("[data-boat-length]").value,
        year: root.querySelector("[data-boat-year]").value,
        details: root.querySelector("[data-boat-details]").value,
      };
    }

    open.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      open.setAttribute("aria-expanded", String(!panel.hidden));
      if (!panel.hidden) question.focus();
    });
    close.addEventListener("click", () => {
      panel.hidden = true;
      open.setAttribute("aria-expanded", "false");
    });

    fetch(`${api}?visitorId=${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
    })
      .then((response) => response.json())
      .then((data) => data.success && setRemaining(data.remaining))
      .catch(() => undefined);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const value = question.value.trim();
      if (!value || busy) return;
      busy = true;
      send.disabled = true;
      send.textContent = "Captain AI denkt na…";
      addMessage(messages, "user", value);
      question.value = "";
      try {
        const response = await fetch(api, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            visitorId: id,
            message: value,
            boat: boat(),
            improvementConsent: root.querySelector("[data-captain-consent]")
              .checked,
          }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          if (data.gated) showGate();
          throw new Error(data.message || "Captain AI reageerde niet.");
        }
        addMessage(
          messages,
          "assistant",
          data.message.content,
          data.message.sources,
          data.message.products,
        );
        setRemaining(data.remaining);
      } catch (error) {
        addMessage(
          messages,
          "assistant",
          error.message || "Er ging iets mis. Probeer het later opnieuw.",
        );
      } finally {
        busy = false;
        send.disabled = false;
        send.textContent = "Vraag stellen";
      }
    });
  }

  function start(scope) {
    (scope || document)
      .querySelectorAll("[data-ww-captain]")
      .forEach(initialize);
  }
  start();
  document.addEventListener("shopify:section:load", (event) =>
    start(event.target),
  );
})();
