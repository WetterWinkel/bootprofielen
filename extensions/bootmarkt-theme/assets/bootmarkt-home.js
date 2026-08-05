(function () {
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function card(listing) {
    const article = element('article', 'ww-bootmarkt-home__card');
    const imageLink = element('a', 'ww-bootmarkt-home__image');
    imageLink.href = `/apps/bootmarkt/${encodeURIComponent(listing.slug)}`;
    const imageUrl = listing.coverPhotoUrl || listing.photos?.[0]?.url;
    if (imageUrl) {
      const image = element('img');
      image.src = imageUrl;
      image.alt = listing.title || 'Boot te koop';
      image.loading = 'lazy';
      imageLink.append(image);
    } else {
      imageLink.textContent = 'Geen foto';
    }
    const body = element('div', 'ww-bootmarkt-home__body');
    body.append(element('p', 'ww-bootmarkt-home__location', listing.location || ''));
    const heading = element('h3');
    const link = element('a', '', listing.title || 'Boot te koop');
    link.href = imageLink.href;
    heading.append(link);
    body.append(heading, element('p', 'ww-bootmarkt-home__price', listing.priceLabel || ''));
    article.append(imageLink, body);
    return article;
  }

  async function load(block) {
    if (block.dataset.loaded === 'true') return;
    block.dataset.loaded = 'true';
    const grid = block.querySelector('[data-ww-bootmarkt-grid]');
    try {
      const response = await fetch(block.dataset.feed, {headers: {Accept: 'application/json'}});
      const data = await response.json();
      grid.replaceChildren();
      if (!data.listings?.length) {
        grid.append(element('p', 'ww-bootmarkt-home__empty', 'Er staan binnenkort boten te koop.'));
        return;
      }
      data.listings.forEach((listing) => grid.append(card(listing)));
    } catch {
      grid.replaceChildren(element('p', 'ww-bootmarkt-home__empty', 'De advertenties konden niet worden geladen.'));
    }
  }

  function start(root) {
    (root || document).querySelectorAll('[data-ww-bootmarkt]').forEach(load);
  }
  start();
  document.addEventListener('shopify:section:load', (event) => start(event.target));
})();
