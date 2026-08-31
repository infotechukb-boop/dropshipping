const products = {
  lamp: {
    name: 'Orbit Table Lamp', price: 68, kicker: 'Soft light / Cobalt', colorName: 'Cobalt', color: '#174e8c', image: 'assets/product-lamp.webp', alt: 'Cobalt blue metal lamp with a glowing round white globe.', description: 'A little sculptural glow for shelves, bedside tables, and late-night reading.',
  },
  vase: {
    name: 'Gingham Glass Vase', price: 42, kicker: 'A little drama / Amber', colorName: 'Amber', color: '#df7b16', image: 'assets/product-vase.webp', alt: 'Amber and cranberry striped handblown glass vase.', description: 'A wobbly, light-catching vase that makes even one stem feel like a whole event.',
  },
  throw: {
    name: 'Checkerboard Throw', price: 56, kicker: 'Very soft / Green', colorName: 'Green', color: '#14734b', image: 'assets/product-throw.webp', alt: 'Folded green and cream checkerboard woven blanket.', description: 'Substantial, cosy, and exactly the amount of pattern your sofa was asking for.',
  },
  mug: {
    name: 'Loop Handle Mug', price: 24, kicker: 'Morning person / Tomato', colorName: 'Tomato', color: '#bf3824', image: 'assets/product-mug.webp', alt: 'Wavy tomato red ceramic mug with a cobalt blue circular handle.', description: 'A handmade-feeling mug with a joyfully oversized handle for slow starts.',
  },
  candle: {
    name: 'Fig Leaf Candle', price: 29, kicker: 'Green & bright / 40 hr burn', colorName: 'Fig leaf', color: '#7e9111', image: 'assets/product-candle.webp', alt: 'Chartreuse green candle in a translucent glass vessel on a coral background.', description: 'A bright, green little mood-lifter with soft fig leaf and warm cedar notes.',
  },
  stool: {
    name: 'Ripple Side Stool', price: 94, kicker: 'A nice little pedestal / Clay', colorName: 'Clay', color: '#bd5136', image: 'assets/product-stool.webp', alt: 'Glossy terracotta side stool with a rippled stacked silhouette.', description: 'A glossy little landing spot for a book, a drink, or simply a nice corner.',
  },
  plate: {
    name: 'Sunday Plate', price: 32, kicker: 'For the good stuff / Cobalt', colorName: 'Cobalt', color: '#1c4c9b', image: 'assets/product-plate.webp', alt: 'Cobalt blue wavy ceramic plate holding an orange.', description: 'A wavy-rim plate that turns whatever is on it into a bit of a ceremony.',
  },
};

const CART_STORAGE_KEY = 'luma-market-cart';
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const body = document.body;
const siteHeader = document.querySelector('.site-header');
const cartDrawer = document.querySelector('.cart-drawer');
const backdrop = document.querySelector('.modal-backdrop');
const cartItems = document.querySelector('.cart-items');
const cartCount = document.querySelector('.cart-count');
const drawerCount = document.querySelector('.drawer-count');
const cartTotal = document.querySelector('.cart-total strong');
const cartDelivery = document.querySelector('.cart-delivery p');
const checkoutButton = document.querySelector('.checkout-button');
const toast = document.querySelector('.toast');
const mobileMenu = document.querySelector('.mobile-menu');
const menuToggle = document.querySelector('.menu-toggle');
let lastTrigger = null;
let toastTimer = null;
let pdpQuantity = 1;

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

function price(value) {
  return currency.format(value);
}

function saveCart() {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([...cart.entries()]));
  } catch {
    // The cart remains usable for this visit if browser storage is unavailable.
  }
}

function cartQuantity() {
  return [...cart.values()].reduce((total, quantity) => total + quantity, 0);
}

function cartValue() {
  return [...cart.entries()].reduce((total, [id, quantity]) => total + products[id].price * quantity, 0);
}

function showToast(message) {
  toast.querySelector('span').textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
}

function cartItemMarkup(id, quantity) {
  const product = products[id];
  return `
    <article class="cart-item" data-cart-id="${id}">
      <img class="cart-item__image" src="${product.image}" alt="${product.alt}" />
      <div>
        <p class="product-kicker">${product.kicker}</p>
        <h3>${product.name}</h3>
        <span class="cart-item__price">${price(product.price)}</span>
        <div class="cart-item__controls" aria-label="Quantity controls for ${product.name}">
          <div class="quantity-control">
            <button type="button" data-cart-quantity="-1" data-product-id="${id}" aria-label="Decrease quantity of ${product.name}"><svg class="icon"><use href="#icon-minus"></use></svg></button>
            <span class="quantity-number" aria-label="Quantity">${quantity}</span>
            <button type="button" data-cart-quantity="1" data-product-id="${id}" aria-label="Increase quantity of ${product.name}"><svg class="icon"><use href="#icon-plus"></use></svg></button>
          </div>
          <button class="remove-button" type="button" data-remove-item="${id}">Remove</button>
        </div>
      </div>
      <strong class="cart-item__total">${price(product.price * quantity)}</strong>
    </article>`;
}

function renderCart() {
  saveCart();
  const count = cartQuantity();
  const total = cartValue();
  cartCount.textContent = count;
  cartCount.classList.toggle('has-items', count > 0);
  drawerCount.textContent = `(${count})`;
  cartTotal.textContent = price(total);
  checkoutButton.disabled = count === 0;

  if (count === 0) {
    cartItems.innerHTML = `<div class="cart-empty"><svg class="icon"><use href="#icon-bag"></use></svg><p>Your bag is ready when you are.</p><button class="text-link close-cart" type="button">Keep browsing <svg class="icon icon--tiny" aria-hidden="true"><use href="#icon-arrow"></use></svg></button></div>`;
    cartDelivery.innerHTML = '<strong>You’re $75 away from free delivery.</strong><span>Add a little something lovely.</span>';
    return;
  }

  cartItems.innerHTML = [...cart.entries()].map(([id, quantity]) => cartItemMarkup(id, quantity)).join('');
  const remaining = Math.max(0, 75 - total);
  cartDelivery.innerHTML = remaining === 0
    ? '<strong>Free delivery unlocked.</strong><span>Your picks qualify for standard delivery.</span>'
    : `<strong>You’re ${price(remaining)} away from free delivery.</strong><span>Add a little something lovely.</span>`;
}

function addToCart(id, quantity = 1) {
  if (!products[id]) return;
  cart.set(id, (cart.get(id) || 0) + quantity);
  renderCart();
  showToast(`${products[id].name} added to your bag`);
}

function changeCartQuantity(id, amount) {
  const next = (cart.get(id) || 0) + amount;
  if (next <= 0) {
    cart.delete(id);
    showToast(`${products[id].name} removed from your bag`);
  } else {
    cart.set(id, next);
  }
  renderCart();
}

function getFocusable(container) {
  return [...container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled])')]
    .filter((element) => !element.hidden && getComputedStyle(element).visibility !== 'hidden');
}

function closeCart(returnFocus = true) {
  cartDrawer.classList.remove('is-open');
  cartDrawer.setAttribute('aria-hidden', 'true');
  backdrop.classList.remove('is-visible');
  body.classList.remove('is-locked');
  if (returnFocus && lastTrigger) {
    lastTrigger.focus();
    lastTrigger = null;
  }
}

function openCart(trigger) {
  closeMobileMenu(false);
  lastTrigger = trigger;
  cartDrawer.classList.add('is-open');
  cartDrawer.setAttribute('aria-hidden', 'false');
  backdrop.classList.add('is-visible');
  body.classList.add('is-locked');
  window.setTimeout(() => cartDrawer.querySelector('.close-cart')?.focus(), 60);
}

function closeMobileMenu(returnFocus = true) {
  mobileMenu.classList.remove('is-open');
  mobileMenu.setAttribute('aria-hidden', 'true');
  menuToggle.setAttribute('aria-expanded', 'false');
  if (!cartDrawer.classList.contains('is-open')) body.classList.remove('is-locked');
  if (returnFocus && document.activeElement && mobileMenu.contains(document.activeElement)) menuToggle.focus();
}

function openMobileMenu() {
  lastTrigger = menuToggle;
  mobileMenu.classList.add('is-open');
  mobileMenu.setAttribute('aria-hidden', 'false');
  menuToggle.setAttribute('aria-expanded', 'true');
  body.classList.add('is-locked');
  window.setTimeout(() => mobileMenu.querySelector('a')?.focus(), 50);
}

function filterCatalog(filter) {
  const cards = [...document.querySelectorAll('[data-catalog-grid] .product-card')];
  if (!cards.length) return;
  let count = 0;
  cards.forEach((card) => {
    const visible = filter === 'all' || card.dataset.category.split(' ').includes(filter);
    card.hidden = !visible;
    if (visible) count += 1;
  });
  document.querySelectorAll('[data-catalog-filter]').forEach((button) => {
    const active = button.dataset.catalogFilter === filter;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelector('[data-catalog-count]').textContent = count;
  document.querySelector('.catalog-empty').hidden = count !== 0;
}

function sortCatalog(value) {
  const grid = document.querySelector('[data-catalog-grid]');
  if (!grid) return;
  [...grid.children]
    .sort((left, right) => {
      if (value === 'featured') return Number(left.dataset.order) - Number(right.dataset.order);
      const comparison = products[left.dataset.productId].price - products[right.dataset.productId].price;
      return value === 'low' ? comparison : -comparison;
    })
    .forEach((card) => grid.append(card));
}

function initialiseProductPage() {
  const pageIsProduct = document.querySelector('[data-pdp-name]');
  if (!pageIsProduct) return;
  const requested = new URLSearchParams(window.location.search).get('product');
  const productId = products[requested] ? requested : 'lamp';
  const product = products[productId];
  body.dataset.product = productId;
  document.querySelectorAll('[data-pdp-name]').forEach((element) => { element.textContent = product.name; });
  document.querySelector('[data-pdp-kicker]').textContent = product.kicker;
  document.querySelector('[data-pdp-price]').textContent = price(product.price);
  document.querySelector('[data-pdp-description]').textContent = product.description;
  document.querySelector('[data-pdp-color-label]').textContent = product.colorName;
  document.querySelector('[data-pdp-swatch-color]').style.backgroundColor = product.color;
  const image = document.querySelector('[data-pdp-image]');
  image.src = product.image;
  image.alt = product.alt;
  document.title = `${product.name} — Luma Market`;

  document.querySelectorAll('[data-pdp-swatch]').forEach((button, index) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-pdp-swatch]').forEach((item) => {
        item.classList.remove('is-selected');
        item.setAttribute('aria-pressed', 'false');
      });
      button.classList.add('is-selected');
      button.setAttribute('aria-pressed', 'true');
      document.querySelector('[data-pdp-color-label]').textContent = index === 0 ? product.colorName : 'Milk white';
    });
  });

  document.querySelectorAll('[data-pdp-quantity]').forEach((button) => {
    button.addEventListener('click', () => {
      pdpQuantity = Math.max(1, pdpQuantity + Number(button.dataset.pdpQuantity));
      document.querySelector('[data-pdp-quantity-value]').textContent = pdpQuantity;
    });
  });
  document.querySelector('[data-pdp-add]').addEventListener('click', () => addToCart(productId, pdpQuantity));
}

function initialiseAccordions() {
  document.querySelectorAll('[data-accordion]').forEach((button) => {
    button.addEventListener('click', () => {
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
      panel.hidden = expanded;
      const icon = button.querySelector('use');
      icon.setAttribute('href', expanded ? '#icon-plus' : '#icon-minus');
    });
  });
}

document.addEventListener('click', (event) => {
  const addButton = event.target.closest('[data-add-to-cart]');
  if (addButton) {
    addToCart(addButton.dataset.addToCart);
    return;
  }
  const quantityButton = event.target.closest('[data-cart-quantity]');
  if (quantityButton) {
    changeCartQuantity(quantityButton.dataset.productId, Number(quantityButton.dataset.cartQuantity));
    return;
  }
  const removeButton = event.target.closest('[data-remove-item]');
  if (removeButton) {
    const id = removeButton.dataset.removeItem;
    cart.delete(id);
    renderCart();
    showToast(`${products[id].name} removed from your bag`);
    return;
  }
  const filterButton = event.target.closest('[data-catalog-filter]');
  if (filterButton) {
    filterCatalog(filterButton.dataset.catalogFilter);
    return;
  }
  if (event.target.closest('.close-cart')) {
    closeCart();
  }
});

document.querySelector('.cart-trigger').addEventListener('click', (event) => openCart(event.currentTarget));
document.querySelector('.close-cart').addEventListener('click', () => closeCart());
backdrop.addEventListener('click', () => closeCart());
checkoutButton.addEventListener('click', () => {
  if (!checkoutButton.disabled) window.location.href = 'checkout.html';
});
menuToggle.addEventListener('click', () => (mobileMenu.classList.contains('is-open') ? closeMobileMenu() : openMobileMenu()));
document.querySelector('.close-menu').addEventListener('click', () => closeMobileMenu());
document.querySelectorAll('.mobile-menu nav a').forEach((link) => link.addEventListener('click', () => closeMobileMenu(false)));
document.querySelector('#catalog-sort')?.addEventListener('change', (event) => sortCatalog(event.target.value));

window.addEventListener('scroll', () => siteHeader.classList.toggle('is-scrolled', window.scrollY > 10), { passive: true });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (cartDrawer.classList.contains('is-open')) closeCart();
    else if (mobileMenu.classList.contains('is-open')) closeMobileMenu();
  }
  if (event.key !== 'Tab') return;
  const layer = cartDrawer.classList.contains('is-open') ? cartDrawer : mobileMenu.classList.contains('is-open') ? mobileMenu : null;
  if (!layer) return;
  const focusable = getFocusable(layer);
  if (!focusable.length) return;
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

initialiseProductPage();
initialiseAccordions();
const requestedCollection = new URLSearchParams(window.location.search).get('collection');
if (requestedCollection && document.querySelector(`[data-catalog-filter="${requestedCollection}"]`)) filterCatalog(requestedCollection);
renderCart();
