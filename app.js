const products = {
  lamp: {
    name: 'Orbit Table Lamp',
    price: 68,
    kicker: 'Soft light / Cobalt',
    image: 'assets/product-lamp.webp',
    alt: 'Cobalt blue metal lamp with a glowing round white globe.',
    description: 'A little sculptural glow for shelves, bedside tables, and late-night reading.',
    color: '#174e8c',
  },
  vase: {
    name: 'Gingham Glass Vase',
    price: 42,
    kicker: 'A little drama / Amber',
    image: 'assets/product-vase.webp',
    alt: 'Amber and cranberry striped handblown glass vase.',
    description: 'A wobbly, light-catching vase that makes even one stem feel like a whole event.',
    color: '#df7b16',
  },
  throw: {
    name: 'Checkerboard Throw',
    price: 56,
    kicker: 'Very soft / Green',
    image: 'assets/product-throw.webp',
    alt: 'Folded green and cream checkerboard woven blanket.',
    description: 'Substantial, cosy, and exactly the amount of pattern your sofa was asking for.',
    color: '#14734b',
  },
  mug: {
    name: 'Loop Handle Mug',
    price: 24,
    kicker: 'Morning person / Tomato',
    image: 'assets/product-mug.webp',
    alt: 'Wavy tomato red ceramic mug with a cobalt blue circular handle.',
    description: 'A handmade-feeling mug with a joyfully oversized handle for slow starts.',
    color: '#bf3824',
  },
  candle: {
    name: 'Fig Leaf Candle',
    price: 29,
    kicker: 'Green & bright / 40 hr burn',
    image: 'assets/product-candle.webp',
    alt: 'Chartreuse green candle in a translucent glass vessel on a coral background.',
    description: 'A bright, green little mood-lifter with soft fig leaf and warm cedar notes.',
    color: '#7e9111',
  },
  stool: {
    name: 'Ripple Side Stool',
    price: 94,
    kicker: 'A nice little pedestal / Clay',
    image: 'assets/product-stool.webp',
    alt: 'Glossy terracotta side stool with a rippled stacked silhouette.',
    description: 'A glossy little landing spot for a book, a drink, or simply a nice corner.',
    color: '#bd5136',
  },
  plate: {
    name: 'Sunday Plate',
    price: 32,
    kicker: 'For the good stuff / Cobalt',
    image: 'assets/product-plate.webp',
    alt: 'Cobalt blue wavy ceramic plate holding an orange.',
    description: 'A wavy-rim plate that turns whatever is on it into a bit of a ceremony.',
    color: '#1c4c9b',
  },
};

const PRODUCT_CATALOG_KEY = 'luma-market-product-catalog';
const CART_STORAGE_KEY = 'luma-market-cart';

function cleanText(value, limit = 300) {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function safeProductImage(value) {
  try {
    const image = new URL(String(value || ''), window.location.href);
    return image.protocol === 'https:' ? image.href : '';
  } catch {
    return '';
  }
}

function sanitizeCatalogProduct(raw) {
  const id = cleanText(raw?.id, 220);
  const parsedPrice = Number.parseFloat(raw?.price);
  if (!/^[a-z0-9:_-]{1,220}$/i.test(id) || !Number.isFinite(parsedPrice) || parsedPrice < 0) return null;
  const name = cleanText(raw?.name, 200);
  const image = safeProductImage(raw?.image);
  if (!name || !image) return null;
  return {
    id,
    name,
    price: Number(parsedPrice.toFixed(2)),
    kicker: cleanText(raw?.kicker || raw?.category || 'CJdropshipping pick', 160),
    image,
    alt: cleanText(raw?.alt || name, 240),
    description: cleanText(raw?.description || 'A CJdropshipping product selected for the Luma edit.', 850),
    color: /^#[0-9a-f]{6}$/i.test(raw?.color || '') ? raw.color : '#067b5c',
    source: raw?.source === 'cj' ? 'cj' : 'catalog',
    sourceId: cleanText(raw?.sourceId, 220),
    sku: cleanText(raw?.sku, 200),
  };
}

try {
  const storedProducts = JSON.parse(window.localStorage.getItem(PRODUCT_CATALOG_KEY));
  if (Array.isArray(storedProducts)) {
    storedProducts.map(sanitizeCatalogProduct).filter(Boolean).forEach((product) => { products[product.id] = product; });
  }
} catch {
  // Stored supplier products are optional; the storefront continues with its local edit.
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}
const storedCartEntries = (() => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY));
    return Array.isArray(stored)
      ? stored.filter(([id, quantity]) => products[id] && Number.isFinite(quantity) && quantity > 0)
      : [];
  } catch {
    return [];
  }
})();
const cart = new Map(storedCartEntries);
let lastTrigger = null;
let toastTimer = null;

const body = document.body;
const siteHeader = document.querySelector('.site-header');
const backdrop = document.querySelector('.modal-backdrop');
const cartDrawer = document.querySelector('.cart-drawer');
const cartItems = document.querySelector('.cart-items');
const cartCount = document.querySelector('.cart-count');
const drawerCount = document.querySelector('.drawer-count');
const cartTotal = document.querySelector('.cart-total strong');
const cartDelivery = document.querySelector('.cart-delivery p');
const checkoutButton = document.querySelector('.checkout-button');
const searchModal = document.querySelector('.search-modal');
const searchInput = document.querySelector('#product-search');
const searchResults = document.querySelector('.search-results');
const quickView = document.querySelector('.quick-view-modal');
const quickViewImage = quickView.querySelector('img');
const quickViewTitle = quickView.querySelector('#quick-view-title');
const quickViewPrice = quickView.querySelector('.quick-view-price');
const quickViewDescription = quickView.querySelector('.quick-view-description');
const quickViewColor = quickView.querySelector('.quick-view-colors > span');
const quickViewAdd = quickView.querySelector('.quick-view-add');
const toast = document.querySelector('.toast');
const mobileMenu = document.querySelector('.mobile-menu');
const menuToggle = document.querySelector('.menu-toggle');
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function formatPrice(price) {
  return currency.format(price);
}

function saveCart() {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([...cart.entries()]));
  } catch {
    // The cart remains usable for the current session if storage is unavailable.
  }
}

function getCartCount() {
  return [...cart.values()].reduce((total, quantity) => total + quantity, 0);
}

function getCartTotal() {
  return [...cart.entries()].reduce((total, [id, quantity]) => total + products[id].price * quantity, 0);
}

function getFocusable(container) {
  return [...container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.hidden && element.offsetParent !== null);
}

function activeLayer() {
  return [cartDrawer, searchModal, quickView, mobileMenu].find((layer) => layer.classList.contains('is-open'));
}

function closeOverlays(returnFocus = true) {
  [cartDrawer, searchModal, quickView].forEach((overlay) => {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
  });
  backdrop.classList.remove('is-visible');
  body.classList.remove('is-locked');

  if (returnFocus && lastTrigger) {
    lastTrigger.focus();
    lastTrigger = null;
  }
}

function openOverlay(overlay, trigger) {
  closeOverlays(false);
  lastTrigger = trigger;
  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');
  backdrop.classList.add('is-visible');
  body.classList.add('is-locked');

  window.setTimeout(() => {
    const focusables = getFocusable(overlay);
    if (focusables[0]) focusables[0].focus();
  }, 60);
}

function closeMobileMenu(returnFocus = true) {
  mobileMenu.classList.remove('is-open');
  mobileMenu.setAttribute('aria-hidden', 'true');
  menuToggle.setAttribute('aria-expanded', 'false');
  body.classList.remove('is-locked');
  if (returnFocus) menuToggle.focus();
}

function openMobileMenu() {
  lastTrigger = menuToggle;
  mobileMenu.classList.add('is-open');
  mobileMenu.setAttribute('aria-hidden', 'false');
  menuToggle.setAttribute('aria-expanded', 'true');
  body.classList.add('is-locked');
  window.setTimeout(() => mobileMenu.querySelector('a')?.focus(), 50);
}

function showToast(message) {
  toast.querySelector('span').textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
}

function cartItemMarkup(id, quantity) {
  const product = products[id];
  const safeId = escapeHtml(id);
  const safeName = escapeHtml(product.name);
  return `
    <article class="cart-item" data-cart-id="${safeId}">
      <img class="cart-item__image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.alt)}" />
      <div>
        <p class="product-kicker">${escapeHtml(product.kicker)}</p>
        <h3>${safeName}</h3>
        <span class="cart-item__price">${formatPrice(product.price)}</span>
        <div class="cart-item__controls" aria-label="Quantity controls for ${safeName}">
          <div class="quantity-control">
            <button type="button" data-quantity-change="-1" data-product-id="${safeId}" aria-label="Decrease quantity of ${safeName}"><svg class="icon"><use href="#icon-minus"></use></svg></button>
            <span class="quantity-number" aria-label="Quantity">${quantity}</span>
            <button type="button" data-quantity-change="1" data-product-id="${safeId}" aria-label="Increase quantity of ${safeName}"><svg class="icon"><use href="#icon-plus"></use></svg></button>
          </div>
          <button class="remove-button" type="button" data-remove-item="${safeId}">Remove</button>
        </div>
      </div>
      <strong class="cart-item__total">${formatPrice(product.price * quantity)}</strong>
    </article>`;
}

function renderCart() {
  saveCart();
  const totalQuantity = getCartCount();
  const total = getCartTotal();

  cartCount.textContent = totalQuantity;
  cartCount.classList.toggle('has-items', totalQuantity > 0);
  drawerCount.textContent = `(${totalQuantity})`;
  cartTotal.textContent = formatPrice(total);
  checkoutButton.disabled = totalQuantity === 0;

  if (totalQuantity === 0) {
    cartItems.innerHTML = `
      <div class="cart-empty">
        <svg class="icon"><use href="#icon-bag"></use></svg>
        <p>Your bag is ready when you are.</p>
        <button class="text-link close-cart" type="button">Keep browsing <svg class="icon icon--tiny" aria-hidden="true"><use href="#icon-arrow"></use></svg></button>
      </div>`;
    cartDelivery.innerHTML = '<strong>You’re $75 away from free delivery.</strong><span>Add a little something lovely.</span>';
    return;
  }

  cartItems.innerHTML = [...cart.entries()].map(([id, quantity]) => cartItemMarkup(id, quantity)).join('');
  const deliveryRemaining = Math.max(0, 75 - total);
  cartDelivery.innerHTML = deliveryRemaining === 0
    ? '<strong>Free delivery unlocked.</strong><span>Your picks qualify for standard delivery.</span>'
    : `<strong>You’re ${formatPrice(deliveryRemaining)} away from free delivery.</strong><span>Add a little something lovely.</span>`;
}

function addToCart(id, quantity = 1, message = true) {
  cart.set(id, (cart.get(id) || 0) + quantity);
  renderCart();
  if (message) showToast(`${products[id].name} added to your bag`);
}

function changeQuantity(id, amount) {
  const updatedQuantity = (cart.get(id) || 0) + amount;
  if (updatedQuantity <= 0) {
    cart.delete(id);
    showToast(`${products[id].name} removed from your bag`);
  } else {
    cart.set(id, updatedQuantity);
  }
  renderCart();
}

function openQuickView(id, trigger) {
  const product = products[id];
  if (!product) return;
  quickViewImage.src = product.image;
  quickViewImage.alt = product.alt;
  quickViewTitle.textContent = product.name;
  quickViewPrice.textContent = formatPrice(product.price);
  quickViewDescription.textContent = product.description;
  quickViewColor.style.backgroundColor = product.color;
  quickViewAdd.dataset.productId = id;
  openOverlay(quickView, trigger);
}

function renderSearch(query = '') {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    searchResults.innerHTML = `
      <p class="search-hint">Popular right now</p>
      <div class="popular-searches">
        <button type="button" data-search-term="lamp">Good lighting</button>
        <button type="button" data-search-term="throw">Soft living</button>
        <button type="button" data-search-term="mug">Table tales</button>
      </div>`;
    return;
  }

  const found = Object.entries(products).filter(([id, product]) => {
    const categories = document.querySelector(`[data-product-id="${id}"]`)?.dataset.category || '';
    return `${product.name} ${product.kicker} ${product.description} ${categories}`.toLowerCase().includes(normalizedQuery);
  });

  if (found.length === 0) {
    searchResults.innerHTML = '<p class="search-empty">No good things found. Try “lamp”, “mug”, or “soft”.</p>';
    return;
  }

  searchResults.innerHTML = `<div class="search-product-list">${found.map(([id, product]) => `
    <button class="search-product" type="button" data-search-product="${escapeHtml(id)}">
      <img src="${escapeHtml(product.image)}" alt="" />
      <span><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(product.kicker)}</span></span>
      <span>${formatPrice(product.price)}</span>
    </button>`).join('')}</div>`;
}

function setFilter(filter) {
  const cards = [...document.querySelectorAll('.product-card')];
  let visibleCount = 0;
  cards.forEach((card) => {
    const categories = card.dataset.category.split(' ');
    const visible = filter === 'all' || categories.includes(filter);
    card.hidden = !visible;
    if (visible) visibleCount += 1;
  });

  document.querySelectorAll('.filter-chip').forEach((chip) => {
    const selected = chip.dataset.filter === filter;
    chip.classList.toggle('is-active', selected);
    chip.setAttribute('aria-pressed', String(selected));
  });
  document.querySelector('#product-count').textContent = visibleCount;
  document.querySelector('.empty-products').hidden = visibleCount !== 0;
}

function cycleReview(index) {
  const reviews = [
    ['“Everything looks even better than it did in my saved folder. Dangerous.”', '— Marie, Portland'],
    ['“It is a very slippery slope from one cute mug to a better-looking kitchen.”', '— Gia, Austin'],
    ['“The lamp makes my 8pm dinner look like I have a life together.”', '— Nell, Brooklyn'],
  ];
  const quote = document.querySelector('.review-band blockquote');
  quote.childNodes[0].nodeValue = reviews[index][0];
  quote.querySelector('cite').textContent = reviews[index][1];
  document.querySelectorAll('.review-control').forEach((button, buttonIndex) => button.classList.toggle('is-active', buttonIndex === index));
}

// Main product interactions
document.addEventListener('click', (event) => {
  const addButton = event.target.closest('[data-add-to-cart]');
  if (addButton) {
    addToCart(addButton.dataset.addToCart);
    return;
  }

  const quickViewTrigger = event.target.closest('[data-quick-view]');
  if (quickViewTrigger) {
    openQuickView(quickViewTrigger.dataset.quickView, quickViewTrigger);
    return;
  }

  const wishButton = event.target.closest('[data-wishlist]');
  if (wishButton) {
    const saved = wishButton.classList.toggle('is-saved');
    wishButton.setAttribute('aria-pressed', String(saved));
    const itemName = products[wishButton.dataset.wishlist].name;
    wishButton.setAttribute('aria-label', `${saved ? 'Remove' : 'Save'} ${itemName} ${saved ? 'from' : 'to'} wishlist`);
    showToast(saved ? `${itemName} saved for later` : `${itemName} removed from saved items`);
    return;
  }

  const quantityButton = event.target.closest('[data-quantity-change]');
  if (quantityButton) {
    changeQuantity(quantityButton.dataset.productId, Number(quantityButton.dataset.quantityChange));
    return;
  }

  const removeButton = event.target.closest('[data-remove-item]');
  if (removeButton) {
    const { removeItem: id } = removeButton.dataset;
    cart.delete(id);
    renderCart();
    showToast(`${products[id].name} removed from your bag`);
    return;
  }

  const filterButton = event.target.closest('[data-filter]');
  if (filterButton) {
    setFilter(filterButton.dataset.filter);
    return;
  }

  const categoryLink = event.target.closest('[data-category-link]');
  if (categoryLink) {
    event.preventDefault();
    setFilter(categoryLink.dataset.categoryLink);
    document.querySelector('#shop').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  const searchTerm = event.target.closest('[data-search-term]');
  if (searchTerm) {
    searchInput.value = searchTerm.dataset.searchTerm;
    renderSearch(searchInput.value);
    searchInput.focus();
    return;
  }

  const searchProduct = event.target.closest('[data-search-product]');
  if (searchProduct) {
    const id = searchProduct.dataset.searchProduct;
    closeOverlays(false);
    openQuickView(id, searchProduct);
  }
});

// Navigation and modal controls
document.querySelector('.cart-trigger').addEventListener('click', (event) => openOverlay(cartDrawer, event.currentTarget));
document.querySelector('.search-trigger').addEventListener('click', (event) => {
  openOverlay(searchModal, event.currentTarget);
  renderSearch();
  window.setTimeout(() => searchInput.focus(), 80);
});
document.querySelectorAll('.close-cart, .close-search, .quick-view-close').forEach((button) => button.addEventListener('click', () => closeOverlays()));
backdrop.addEventListener('click', () => closeOverlays());
quickViewAdd.addEventListener('click', () => {
  addToCart(quickViewAdd.dataset.productId);
  closeOverlays(false);
});
searchInput.addEventListener('input', (event) => renderSearch(event.target.value));
menuToggle.addEventListener('click', () => (mobileMenu.classList.contains('is-open') ? closeMobileMenu() : openMobileMenu()));
document.querySelector('.close-menu').addEventListener('click', () => closeMobileMenu());
document.querySelectorAll('.mobile-menu nav a').forEach((link) => link.addEventListener('click', () => closeMobileMenu(false)));

checkoutButton.addEventListener('click', () => {
  if (!checkoutButton.disabled) window.location.href = 'checkout.html';
});
document.querySelector('.desktop-only').addEventListener('click', () => showToast('Your account space is coming soon'));

// Newsletter feedback
document.querySelector('.newsletter-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = event.currentTarget.querySelector('input');
  const message = event.currentTarget.querySelector('.form-message');
  if (!input.validity.valid) {
    message.textContent = 'Add a valid email and we’ll save your welcome treat.';
    message.className = 'form-message is-error';
    input.focus();
    return;
  }
  message.textContent = 'You’re on the list. Your 10% hello is on its way.';
  message.className = 'form-message is-success';
  event.currentTarget.querySelector('button[type="submit"]').innerHTML = 'You’re in <svg class="icon"><use href="#icon-check"></use></svg>';
  input.disabled = true;
});

// Review controls
document.querySelectorAll('.review-control').forEach((button, index) => button.addEventListener('click', () => cycleReview(index)));

// Sticky header, Escape, and simple focus traps
window.addEventListener('scroll', () => siteHeader.classList.toggle('is-scrolled', window.scrollY > 10), { passive: true });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (mobileMenu.classList.contains('is-open')) closeMobileMenu();
    else if (activeLayer()) closeOverlays();
  }

  if (event.key !== 'Tab') return;
  const layer = activeLayer();
  if (!layer) return;
  const focusable = getFocusable(layer);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

renderCart();
