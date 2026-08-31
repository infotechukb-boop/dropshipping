const products = {
  lamp: { name: 'Orbit Table Lamp', price: 68, image: 'assets/product-lamp.webp', alt: 'Cobalt blue metal lamp with a glowing round white globe.' },
  vase: { name: 'Gingham Glass Vase', price: 42, image: 'assets/product-vase.webp', alt: 'Amber and cranberry striped handblown glass vase.' },
  throw: { name: 'Checkerboard Throw', price: 56, image: 'assets/product-throw.webp', alt: 'Folded green and cream checkerboard woven blanket.' },
  mug: { name: 'Loop Handle Mug', price: 24, image: 'assets/product-mug.webp', alt: 'Wavy tomato red ceramic mug with a cobalt blue circular handle.' },
  candle: { name: 'Fig Leaf Candle', price: 29, image: 'assets/product-candle.webp', alt: 'Chartreuse green candle in a translucent glass vessel on a coral background.' },
  stool: { name: 'Ripple Side Stool', price: 94, image: 'assets/product-stool.webp', alt: 'Glossy terracotta side stool with a rippled stacked silhouette.' },
  plate: { name: 'Sunday Plate', price: 32, image: 'assets/product-plate.webp', alt: 'Cobalt blue wavy ceramic plate holding an orange.' },
};

const CART_STORAGE_KEY = 'luma-market-cart';
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const cart = new Map((() => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY));
    return Array.isArray(saved) ? saved.filter(([id, quantity]) => products[id] && Number.isFinite(quantity) && quantity > 0) : [];
  } catch {
    return [];
  }
})());
let selectedDelivery = 'standard';

const items = document.querySelector('.checkout-summary__items');
const count = document.querySelector('[data-summary-count]');
const subtotal = document.querySelector('[data-summary-subtotal]');
const delivery = document.querySelector('[data-summary-delivery]');
const deliveryCard = document.querySelector('[data-delivery-price]');
const total = document.querySelector('[data-summary-total]');
const placeOrderTotal = document.querySelector('[data-place-order-total]');
const orderButton = document.querySelector('.place-order');
const message = document.querySelector('.checkout-message');
const form = document.querySelector('.checkout-form');

function price(value) {
  return currency.format(value);
}

function saveCart() {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([...cart.entries()]));
  } catch {
    // This demo continues without persistence if browser storage is unavailable.
  }
}

function subtotalValue() {
  return [...cart.entries()].reduce((sum, [id, quantity]) => sum + products[id].price * quantity, 0);
}

function cartCount() {
  return [...cart.values()].reduce((sum, quantity) => sum + quantity, 0);
}

function deliveryValue() {
  if (cartCount() === 0) return 0;
  if (selectedDelivery === 'express') return 12;
  return subtotalValue() >= 75 ? 0 : 6;
}

function itemMarkup(id, quantity) {
  const product = products[id];
  return `<article class="checkout-item"><img src="${product.image}" alt="${product.alt}" /><div><h3>${product.name}</h3><div class="checkout-quantity"><button type="button" data-checkout-change="-1" data-product-id="${id}" aria-label="Decrease quantity of ${product.name}"><svg class="icon"><use href="#icon-minus"></use></svg></button><span>${quantity}</span><button type="button" data-checkout-change="1" data-product-id="${id}" aria-label="Increase quantity of ${product.name}"><svg class="icon"><use href="#icon-plus"></use></svg></button></div></div><strong>${price(product.price * quantity)}</strong></article>`;
}

function renderCheckout() {
  saveCart();
  const quantity = cartCount();
  const sub = subtotalValue();
  const ship = deliveryValue();
  const grandTotal = sub + ship;

  count.textContent = `(${quantity})`;
  subtotal.textContent = price(sub);
  delivery.textContent = ship === 0 ? 'Free' : price(ship);
  deliveryCard.textContent = sub >= 75 || quantity === 0 ? 'Free' : '$6';
  total.textContent = price(grandTotal);
  placeOrderTotal.textContent = price(grandTotal);
  orderButton.disabled = quantity === 0;

  if (!quantity) {
    items.innerHTML = `<div class="checkout-empty"><svg class="icon"><use href="#icon-bag"></use></svg><p>Your bag is waiting for a good thing.</p><a class="text-link" href="shop.html">Browse the edit <svg class="icon icon--tiny" aria-hidden="true"><use href="#icon-arrow"></use></svg></a></div>`;
    return;
  }

  items.innerHTML = [...cart.entries()].map(([id, itemQuantity]) => itemMarkup(id, itemQuantity)).join('');
}

function changeQuantity(id, adjustment) {
  const next = (cart.get(id) || 0) + adjustment;
  if (next <= 0) cart.delete(id);
  else cart.set(id, next);
  renderCheckout();
}

document.addEventListener('click', (event) => {
  const adjustment = event.target.closest('[data-checkout-change]');
  if (!adjustment) return;
  changeQuantity(adjustment.dataset.productId, Number(adjustment.dataset.checkoutChange));
});

document.querySelectorAll('input[name="delivery"]').forEach((input) => {
  input.addEventListener('change', () => {
    selectedDelivery = input.value;
    document.querySelectorAll('.delivery-option').forEach((option) => option.classList.toggle('is-selected', option.contains(input) && input.checked));
    renderCheckout();
  });
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (cartCount() === 0) {
    message.textContent = 'Your bag is empty — choose something good before checking out.';
    message.className = 'checkout-message is-error';
    return;
  }
  if (!form.checkValidity()) {
    message.textContent = 'A few details are missing. Please check the highlighted fields.';
    message.className = 'checkout-message is-error';
    form.reportValidity();
    return;
  }
  message.textContent = 'Nice. This demo is ready to hand off to a real payment provider.';
  message.className = 'checkout-message is-success';
  orderButton.innerHTML = '<span>Order details saved</span><svg class="icon"><use href="#icon-check"></use></svg>';
  orderButton.disabled = true;
});

renderCheckout();
