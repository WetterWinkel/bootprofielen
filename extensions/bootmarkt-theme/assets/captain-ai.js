(function () {
  function initialize(root) {
    if (root.dataset.captainReady === "true") return;
    root.dataset.captainReady = "true";
    const panel = root.querySelector("[data-captain-panel]");
    const open = root.querySelector("[data-captain-open]");
    const close = root.querySelector("[data-captain-close]");

    open.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      open.setAttribute("aria-expanded", String(!panel.hidden));
    });
    close.addEventListener("click", () => {
      panel.hidden = true;
      open.setAttribute("aria-expanded", "false");
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
