(() => {
  const root = document.querySelector('[data-cj-catalog]');
  if (!root) return;

  const sourceStatus = root.querySelector('[data-cj-status]');
  const feedback = root.querySelector('[data-cj-feedback]');
  const searchForm = root.querySelector('[data-cj-search-form]');
  const searchInput = root.querySelector('[data-cj-search]');
  const countryInput = root.querySelector('[data-cj-country]');
  const sortInput = document.querySelector('#cj-catalog-sort');
  const demoCatalog = document.querySelector('[data-demo-catalog]');
  const liveCatalog = document.querySelector('[data-cj-live-catalog]');
  const liveGrid = document.querySelector('[data-cj-product-grid]');
  const count = document.querySelector('[data-cj-product-count]');
  const empty = document.querySelector('[data-cj-empty]');
  const pagination = document.querySelector('[data-cj-pagination]');
  const loadMore = document.querySelector('[data-cj-load-more]');
  const reload = root.querySelector('[data-cj-reload]');
  const filterButtons = [...root.querySelectorAll('[data-cj-filter]')];

  const state = { page: 1, size: 12, filter: 'all', keyword: '', country: countryInput.value, sort: 'featured', total: 0 };
  let activeRequest = 0;
  let liveProducts = [];

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  }

  function setStatus(message, tone = 'quiet') {
    sourceStatus.textContent = message;
    sourceStatus.dataset.tone = tone;
  }

  function setFeedback(message = '', tone = '') {
    feedback.textContent = message;
    feedback.dataset.tone = tone;
  }

  function setBusy(isBusy, label = 'Refreshing picks') {
    root.classList.toggle('is-loading', isBusy);
    reload.disabled = isBusy;
    reload.textContent = isBusy ? label : 'Refresh picks';
    if (!isBusy) {
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.classList.add('icon', 'icon--tiny');
      icon.setAttribute('aria-hidden', 'true');
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', '#icon-arrow');
      icon.append(use);
      reload.append(' ', icon);
    }
  }

  function storefrontId(product) {
    const normalized = String(product.id || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 190);
    return normalized ? `cj:${normalized}` : '';
  }

  function toStorefrontProduct(product, index) {
    const accents = ['#067b5c', '#b94728', '#1c4c9b', '#8a6423', '#6f4a81'];
    const id = storefrontId(product);
    return {
      id,
      source: 'cj',
      sourceId: product.id,
      name: product.name,
      price: product.price,
      kicker: product.category || 'CJdropshipping pick',
      colorName: product.category || 'CJ product option',
      color: accents[index % accents.length],
      image: product.image,
      alt: product.name,
      description: product.description || 'A CJdropshipping product ready to be evaluated for your store.',
      sku: product.sku || '',
    };
  }

  function productMarkup(product, index) {
    const storeId = storefrontId(product);
    const href = `product.html?cj=${encodeURIComponent(product.id)}&country=${encodeURIComponent(state.country)}`;
    const price = Number.isFinite(product.price) ? window.LumaStore.formatPrice(product.price) : 'Price on request';
    const inventory = product.inventory > 0 ? 'Stock checked' : 'Check availability';
    const tag = product.freeShipping ? 'Free shipping' : product.isNew ? 'New on CJ' : product.listedCount > 0 ? 'Trending' : 'CJ pick';
    const media = product.image
      ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="${index < 4 ? 'eager' : 'lazy'}" referrerpolicy="no-referrer" />`
      : '<span class="cj-image-fallback">Image loading</span>';
    return `<article class="product-card cj-product-card" data-cj-product-id="${escapeHtml(product.id)}">
      <div class="product-card__media cj-product-card__media">
        <span class="product-badge ${product.freeShipping ? '' : 'product-badge--dark'}">${escapeHtml(tag)}</span>
        <a class="product-photo-button" href="${href}" aria-label="View ${escapeHtml(product.name)}">${media}</a>
      </div>
      <div class="product-card__details">
        <div><p class="product-kicker">${escapeHtml(product.category || 'CJdropshipping pick')}</p><h3><a href="${href}">${escapeHtml(product.name)}</a></h3><span class="cj-product-stock"><i aria-hidden="true"></i>${inventory}</span></div>
        <p class="price">${price}</p>
      </div>
      <button class="add-button" type="button" data-cj-add="${escapeHtml(storeId)}" data-cj-source-id="${escapeHtml(product.id)}"><span>Add to bag</span><svg class="icon"><use href="#icon-plus"></use></svg></button>
    </article>`;
  }

  function renderProducts(products, append) {
    if (!append) liveGrid.innerHTML = '';
    const offset = append ? liveProducts.length - products.length : 0;
    liveGrid.insertAdjacentHTML('beforeend', products.map((product, index) => productMarkup(product, offset + index)).join(''));
    liveGrid.querySelectorAll('img').forEach((image) => {
      if (image.dataset.imageHandled) return;
      image.dataset.imageHandled = 'true';
      image.addEventListener('error', () => {
        image.closest('.cj-product-card__media')?.classList.add('is-media-unavailable');
        image.remove();
      }, { once: true });
    });
    const loaded = liveProducts.length;
    count.textContent = state.total || loaded;
    empty.hidden = loaded !== 0;
    pagination.hidden = !(state.total > loaded);
    if (!pagination.hidden) loadMore.disabled = false;
  }

  function activeFilterParams(params) {
    if (state.filter === 'trending') params.set('flag', '0');
    if (state.filter === 'new') params.set('flag', '1');
    if (state.filter === 'verified') params.set('verified', '1');
    if (state.sort === 'new') params.set('orderBy', '3');
    if (state.sort === 'popular') params.set('orderBy', '1');
  }

  async function loadProducts({ append = false } = {}) {
    const request = ++activeRequest;
    setBusy(true, append ? 'Loading more' : 'Refreshing picks');
    setFeedback('', '');
    if (!append) setStatus('Searching live CJdropshipping inventory…', 'loading');

    const params = new URLSearchParams({ page: String(state.page), size: String(state.size), country: state.country });
    if (state.keyword) params.set('keyword', state.keyword);
    activeFilterParams(params);

    try {
      const response = await fetch(`/api/cj/products?${params.toString()}`, { headers: { Accept: 'application/json' } });
      const payload = await response.json();
      if (request !== activeRequest) return;
      if (!response.ok) throw payload.error || { code: 'CJ_UPSTREAM_UNAVAILABLE' };
      const incoming = Array.isArray(payload.products) ? payload.products.filter((product) => storefrontId(product) && Number.isFinite(product.price)) : [];
      liveProducts = append ? [...liveProducts, ...incoming] : incoming;
      state.total = Number(payload.meta?.total) || liveProducts.length;
      renderProducts(incoming, append);
      demoCatalog.hidden = true;
      liveCatalog.hidden = false;
      setStatus(`Live CJ inventory · ${state.total} matching products for ${state.country}`, 'connected');
      setFeedback(incoming.length ? 'Prices shown follow the server-side rule set for this storefront.' : 'No CJ products matched those filters.', incoming.length ? 'success' : 'quiet');
    } catch (error) {
      if (request !== activeRequest) return;
      pagination.hidden = true;
      const isConfig = error?.code === 'CJ_NOT_CONFIGURED';
      demoCatalog.hidden = false;
      liveCatalog.hidden = true;
      empty.hidden = true;
      count.textContent = demoCatalog.querySelectorAll('.product-card').length;
      setStatus(isConfig ? 'CJ connection in standby' : 'Live CJ catalogue is temporarily unavailable', isConfig ? 'standby' : 'error');
      setFeedback(isConfig
        ? 'The secure server connection is ready; connect CJ in the server environment to load live products. Supplier credentials never reach the browser.'
        : 'Showing the starter edit while CJ inventory reconnects. Try refreshing in a moment.', isConfig ? 'quiet' : 'error');
    } finally {
      if (request === activeRequest) setBusy(false);
    }
  }

  function selectFilter(button) {
    state.filter = button.dataset.cjFilter;
    state.page = 1;
    filterButtons.forEach((item) => {
      const selected = item === button;
      item.classList.toggle('is-active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    loadProducts();
  }

  root.addEventListener('click', (event) => {
    const filter = event.target.closest('[data-cj-filter]');
    if (filter) {
      selectFilter(filter);
      return;
    }
    if (event.target.closest('[data-cj-reload]')) {
      state.page = 1;
      loadProducts();
    }
  });

  liveGrid.addEventListener('click', (event) => {
    const addButton = event.target.closest('[data-cj-add]');
    if (!addButton) return;
    const sourceId = addButton.dataset.cjSourceId;
    const product = liveProducts.find((item) => String(item.id) === sourceId);
    const registered = product && window.LumaStore.registerProduct(toStorefrontProduct(product, liveProducts.indexOf(product)));
    if (registered) window.LumaStore.addToCart(registered.id);
  });

  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    state.keyword = searchInput.value.trim().slice(0, 120);
    state.page = 1;
    loadProducts();
  });
  countryInput.addEventListener('change', () => {
    state.country = countryInput.value;
    state.page = 1;
    loadProducts();
  });
  sortInput.addEventListener('change', () => {
    state.sort = sortInput.value;
    state.page = 1;
    loadProducts();
  });
  loadMore.addEventListener('click', () => {
    state.page += 1;
    loadMore.disabled = true;
    loadProducts({ append: true });
  });

  loadProducts();
})();
