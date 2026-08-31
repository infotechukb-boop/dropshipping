(() => {
  const rawProductId = new URLSearchParams(window.location.search).get('cj');
  if (!rawProductId) return;

  const status = document.querySelector('[data-cj-product-status]');
  const staticOption = document.querySelector('[data-pdp-option]');
  const variantsRoot = document.querySelector('[data-cj-variant-options]');
  const detailsPanel = document.querySelector('#product-details-panel p');
  const country = new URLSearchParams(window.location.search).get('country') || 'IN';
  let activeProduct = null;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  }

  function safeKey(value) {
    return String(value || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 180);
  }

  function updateStatus(message, tone) {
    status.textContent = message;
    status.dataset.tone = tone;
    status.hidden = false;
  }

  function toStorefrontProduct(product, variant = null) {
    const productKey = safeKey(product.id);
    const variantKey = variant ? safeKey(variant.id || variant.sku || variant.name) : '';
    const id = variantKey ? `cj:${productKey}:${variantKey}` : `cj:${productKey}`;
    const selectedPrice = Number.isFinite(variant?.price) ? variant.price : product.price;
    const selectedName = variant?.name || '';
    return {
      id,
      source: 'cj',
      sourceId: product.id,
      sku: variant?.sku || product.sku || '',
      name: product.name,
      price: selectedPrice,
      kicker: selectedName ? `${product.category || 'CJdropshipping'} / ${selectedName}` : product.category || 'CJdropshipping pick',
      colorName: selectedName || product.productOptions || 'CJ product option',
      color: '#067b5c',
      image: variant?.image || product.image,
      alt: product.name,
      description: product.description || 'A live CJdropshipping product selected for the Luma edit.',
    };
  }

  function selectVariant(variant, button) {
    const product = window.LumaStore.registerProduct(toStorefrontProduct(activeProduct, variant));
    if (!product) return;
    window.LumaStore.setActiveProduct(product.id);
    variantsRoot.querySelectorAll('[data-cj-variant]').forEach((item) => {
      const selected = item === button;
      item.classList.toggle('is-selected', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
  }

  function renderVariants(product, selectedVariant = null) {
    if (!Array.isArray(product.variants) || product.variants.length < 2) {
      staticOption.hidden = true;
      variantsRoot.hidden = true;
      return;
    }
    staticOption.hidden = true;
    variantsRoot.hidden = false;
    const visibleVariants = product.variants.slice(0, 12);
    const selectedIndex = visibleVariants.findIndex((variant) => variant === selectedVariant || (variant.id && variant.id === selectedVariant?.id));
    variantsRoot.innerHTML = `<p class="cj-variant-options__label">${escapeHtml(product.productOptions || 'Choose an option')}</p><div class="cj-variant-list">${visibleVariants.map((variant, index) => {
      const selected = index === selectedIndex;
      return `<button class="cj-variant ${selected ? 'is-selected' : ''}" type="button" data-cj-variant="${index}" aria-pressed="${selected}" ${Number.isFinite(variant.price) ? '' : 'disabled'}><span>${escapeHtml(variant.name || 'Default option')}</span>${Number.isFinite(variant.price) ? `<strong>${escapeHtml(window.LumaStore.formatPrice(variant.price))}</strong>` : '<strong>Unavailable</strong>'}</button>`;
    }).join('')}</div>`;
    visibleVariants.forEach((variant, index) => {
      if (!Number.isFinite(variant.price)) return;
      variantsRoot.querySelector(`[data-cj-variant="${index}"]`).addEventListener('click', (event) => selectVariant(variant, event.currentTarget));
    });
  }

  async function loadProduct() {
    updateStatus('Loading live CJ product details…', 'loading');
    try {
      const response = await fetch(`/api/cj/products/${encodeURIComponent(rawProductId)}?country=${encodeURIComponent(country)}`, { headers: { Accept: 'application/json' } });
      const payload = await response.json();
      if (!response.ok) throw payload.error || { code: 'CJ_UPSTREAM_UNAVAILABLE' };
      if (!payload.product || !payload.product.image) throw { code: 'CJ_PRODUCT_UNAVAILABLE' };
      activeProduct = payload.product;
      const initialVariant = Array.isArray(activeProduct.variants)
        ? activeProduct.variants.slice(0, 12).find((variant) => Number.isFinite(variant?.price)) || null
        : null;
      if (!Number.isFinite(activeProduct.price) && !initialVariant) throw { code: 'CJ_PRODUCT_UNAVAILABLE' };
      const initialProduct = window.LumaStore.registerProduct(toStorefrontProduct(activeProduct, initialVariant));
      if (!initialProduct) throw { code: 'CJ_PRODUCT_UNAVAILABLE' };
      window.LumaStore.setActiveProduct(initialProduct.id);
      if (detailsPanel) {
        const materials = Array.isArray(activeProduct.materials) && activeProduct.materials.length ? ` Materials: ${activeProduct.materials.join(', ')}.` : '';
        const weight = Number.isFinite(activeProduct.weightGrams) ? ` Packed weight: ${activeProduct.weightGrams}g.` : '';
        detailsPanel.textContent = `${activeProduct.description || 'Live product information supplied by CJdropshipping.'}${materials}${weight}`;
      }
      renderVariants(activeProduct, initialVariant);
      const sourceLine = activeProduct.sku ? `Live CJdropshipping product · SKU ${activeProduct.sku}` : 'Live CJdropshipping product';
      updateStatus(sourceLine, 'connected');
    } catch (error) {
      const isUnconfigured = error?.code === 'CJ_NOT_CONFIGURED';
      updateStatus(isUnconfigured
        ? 'Live CJ product details are standing by for the secure server connection.'
        : 'This CJ product is unavailable right now. You can return to the live catalogue and try another pick.', isUnconfigured ? 'standby' : 'error');
      variantsRoot.hidden = true;
    }
  }

  loadProduct();
})();
