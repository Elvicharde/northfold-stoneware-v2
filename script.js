const API_URL = "https://coffee.mock.shop/api";
const DEFAULT_HANDLE = "ceramic-mug";

const productSection = document.querySelector("#product");
const titleElement = document.querySelector("[data-product-title]");
const descriptionElement = document.querySelector("[data-product-description]");
const priceElement = document.querySelector("[data-product-price]");
const breadcrumbElement = document.querySelector("[data-product-breadcrumb]");
const errorElement = document.querySelector("[data-product-error]");
const errorMessage = document.querySelector("[data-error-message]");
const retryButton = document.querySelector("[data-retry]");
const mainImage = document.querySelector("[data-main-image]");
const imageFallback = document.querySelector(".image-fallback");
const thumbnailsElement = document.querySelector("[data-gallery-thumbnails]");
const descriptionMeta = document.querySelector('meta[name="description"]');
const finishSelector = document.querySelector("[data-finish-selector]");
const finishOptionsElement = document.querySelector("[data-finish-options]");
const capacitySelector = document.querySelector("[data-capacity-selector]");
const capacityOptionsElement = document.querySelector("[data-capacity-options]");
const variantStatus = document.querySelector("[data-variant-status]");
const addToCartButton = document.querySelector("[data-add-to-cart]");
const cartButton = document.querySelector(".cart-button");
const cartCountElement = document.querySelector("[data-cart-count]");
const cartLiveElement = document.querySelector("[data-cart-live]");
const cartDialog = document.querySelector("[data-cart-dialog]");
const cartCloseButton = document.querySelector("[data-cart-close]");
const cartEmptyElement = document.querySelector("[data-cart-empty]");
const cartItemsElement = document.querySelector("[data-cart-items]");
const cartFooterElement = document.querySelector(".cart-drawer-footer");
const cartTotalElement = document.querySelector("[data-cart-total]");
const quantityInput = document.querySelector("#quantity");
const quantityButtons = document.querySelectorAll("[data-quantity-step]");

let selectedOptionValues = {};
let currentVariant = null;
let currentProduct = null;
let heroImageUrl = "";
let cart = [];
let cartOpener = null;
let focusAfterCartClose = null;

const CART_STORAGE_KEY = "northfold-cart-v1";

const PRODUCT_QUERY = `
  query ProductByHandle($handle: String!) {
    product(handle: $handle) {
      id
      title
      description
      productType
      tags
      seo { title description }
      options { name values }
      images(first: 3) {
        nodes { url altText }
      }
      variants(first: 10) {
        nodes {
          id
          availableForSale
          price { amount currencyCode }
          selectedOptions { name value }
          image { url altText }
        }
      }
    }
  }
`;

function currentHandle() {
  const handle = new URLSearchParams(window.location.search).get("handle")?.trim();
  return handle || DEFAULT_HANDLE;
}

function formatPrice(price) {
  if (!price) return "";
  const amount = Number(price.amount);
  if (!Number.isFinite(amount) || !price.currencyCode) return "";

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: price.currencyCode,
    }).format(amount);
  } catch {
    return `${price.currencyCode} ${amount}`;
  }
}

function imageAlt(image, productTitle, index) {
  const providedAlt = typeof image.altText === "string" ? image.altText.trim() : "";
  return providedAlt || `${productTitle} product image ${index + 1}`;
}

function displayHeroImage(image, alt) {
  if (!image?.url || typeof image.url !== "string" || !image.url.trim()) return;

  mainImage.hidden = false;
  imageFallback.hidden = true;
  mainImage.alt = alt;
  if (heroImageUrl === image.url && mainImage.getAttribute("src") === image.url) return;

  mainImage.onerror = () => {
    heroImageUrl = "";
    mainImage.removeAttribute("src");
    mainImage.hidden = true;
    imageFallback.hidden = false;
    imageFallback.textContent = "Product image unavailable";
  };
  heroImageUrl = image.url;
  mainImage.src = image.url;
}

function selectImage(image, index, productTitle, buttons) {
  displayHeroImage(image, imageAlt(image, productTitle, index));

  buttons.forEach((button, buttonIndex) => {
    button.setAttribute("aria-pressed", String(buttonIndex === index));
  });
}

function renderGallery(product) {
  const images = (product.images?.nodes ?? []).filter(
    (image) => typeof image.url === "string" && image.url.trim() !== "",
  );
  const productTitle = product.title || "Product";
  thumbnailsElement.replaceChildren();

  if (images.length === 0) {
    heroImageUrl = "";
    mainImage.hidden = true;
    imageFallback.hidden = false;
    imageFallback.textContent = "No product images available";
    return;
  }

  const buttons = images.map((image, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "thumbnail";
    button.setAttribute(
      "aria-label",
      `Show image ${index + 1}: ${imageAlt(image, productTitle, index)}`,
    );
    button.setAttribute("aria-pressed", "false");

    const thumbnailImage = document.createElement("img");
    thumbnailImage.src = image.url;
    thumbnailImage.alt = "";
    thumbnailImage.loading = "lazy";
    thumbnailImage.onerror = () => {
      thumbnailImage.removeAttribute("src");
      thumbnailImage.alt = "Image unavailable";
    };
    button.append(thumbnailImage);
    button.addEventListener("click", () => selectImage(image, index, productTitle, buttons));
    thumbnailsElement.append(button);
    return button;
  });

  selectImage(images[0], 0, productTitle, buttons);
}

function appendOptionInputs(container, option, groupName, product) {
  container.replaceChildren();
  const values = Array.isArray(option?.values) ? option.values : [];
  const firstProductImage = product.images?.nodes?.find((image) => image.url);

  values.forEach((value, index) => {
    const id = `${groupName}-${index}`;
    const label = document.createElement("label");
    label.className = groupName === "finish" ? "finish-option" : "capacity-option";
    label.htmlFor = id;

    const input = document.createElement("input");
    input.type = "radio";
    input.name = groupName;
    input.id = id;
    input.value = value;
    input.checked = index === 0;
    selectedOptionValues[option.name] = selectedOptionValues[option.name] ?? values[0];

    if (groupName === "finish") {
      const content = document.createElement("span");
      content.className = "finish-option-content";
      const tileImage = document.createElement("img");
      tileImage.alt = "";
      tileImage.loading = "lazy";

      const matchingVariant = (product.variants?.nodes ?? []).find((variant) =>
        variant.selectedOptions?.some(({ name, value: selectedValue }) =>
          name === option.name && selectedValue === value,
        ),
      );
      const variantImage = matchingVariant?.image;
      const image = variantImage?.url && variantImage.url !== firstProductImage?.url
        ? variantImage
        : firstProductImage;

      if (image?.url) {
        tileImage.src = image.url;
        tileImage.onerror = () => tileImage.remove();
      } else {
        tileImage.hidden = true;
      }

      const visibleValue = document.createElement("span");
      visibleValue.textContent = value;
      content.append(tileImage, visibleValue);
      label.append(input, content);
    } else {
      label.append(input, document.createTextNode(value));
    }

    input.addEventListener("change", () => {
      if (!input.checked) return;
      selectedOptionValues[option.name] = input.value;
      updateSelectedVariant(product);
    });
    container.append(label);
  });

  return values.length > 0;
}

function renderOptionControls(product) {
  selectedOptionValues = {};
  const options = product.options ?? [];
  const finishOption = options.find((option) => option.name === "Finish");
  const capacityOption = options.find((option) => option.name === "Capacity");

  finishSelector.hidden = !appendOptionInputs(
    finishOptionsElement,
    finishOption,
    "finish",
    product,
  );
  capacitySelector.hidden = !appendOptionInputs(
    capacityOptionsElement,
    capacityOption,
    "capacity",
    product,
  );
  updateSelectedVariant(product);
}

function updateSelectedVariant(product) {
  const optionNames = ["Finish", "Capacity"].filter((name) => selectedOptionValues[name]);
  currentVariant = (product.variants?.nodes ?? []).find((variant) =>
    optionNames.length === 2 && optionNames.every((name) =>
      variant.selectedOptions?.some(({ name: variantOption, value }) =>
        variantOption === name && value === selectedOptionValues[name],
      ),
    ),
  ) ?? null;

  const isAvailable = currentVariant?.availableForSale === true;
  if (currentVariant?.image?.url && currentProduct?.title) {
    displayHeroImage(
      currentVariant.image,
      imageAlt(currentVariant.image, currentProduct.title, 0),
    );
  }
  const price = currentVariant ? formatPrice(currentVariant.price) : "";
  priceElement.textContent = price;
  priceElement.hidden = !price;
  addToCartButton.disabled = !isAvailable;

  if (!currentVariant) {
    variantStatus.textContent = "This option combination is unavailable.";
  } else if (!isAvailable) {
    variantStatus.textContent = "This option combination is currently unavailable.";
  } else {
    variantStatus.textContent = "";
  }
}

function normalizeQuantity(value) {
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity >= 1
    ? Math.max(1, Math.floor(quantity))
    : 1;
}

function storageHandle() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeStoredLine(line) {
  const unitPrice = Number(line?.unitPrice);
  if (
    typeof line?.productId !== "string" ||
    typeof line?.variantId !== "string" ||
    typeof line?.productTitle !== "string" ||
    !Array.isArray(line?.selectedOptions) ||
    !Number.isFinite(unitPrice) || unitPrice < 0 ||
    typeof line?.currencyCode !== "string" ||
    line.currencyCode.trim() === "" ||
    !Number.isInteger(Number(line?.quantity)) || Number(line.quantity) < 1
  ) return null;

  return {
    productId: line.productId,
    variantId: line.variantId,
    productTitle: line.productTitle,
    selectedOptions: line.selectedOptions
      .filter((option) => typeof option?.name === "string" && typeof option?.value === "string")
      .map(({ name, value }) => ({ name, value })),
    unitPrice,
    currencyCode: line.currencyCode,
    quantity: Number(line.quantity),
    imageUrl: typeof line.imageUrl === "string" ? line.imageUrl : "",
    imageAlt: typeof line.imageAlt === "string" ? line.imageAlt : line.productTitle,
  };
}

function cartLineKey(line) {
  return `${line.productId}::${line.variantId}`;
}

function readStoredCart() {
  const storage = storageHandle();
  if (!storage) return [];

  try {
    const saved = JSON.parse(storage.getItem(CART_STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return [];

    const restored = new Map();
    saved.forEach((storedLine) => {
      const line = normalizeStoredLine(storedLine);
      if (!line) return;
      const key = cartLineKey(line);
      const existing = restored.get(key);
      if (existing) existing.quantity += line.quantity;
      else restored.set(key, line);
    });
    return [...restored.values()];
  } catch {
    return [];
  }
}

function persistCart() {
  const storage = storageHandle();
  if (!storage) return;
  try {
    storage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // Keep the in-memory cart usable when storage is blocked or full.
  }
}

function formatLineOptionSummary(line) {
  return line.selectedOptions.map(({ name, value }) => `${name}: ${value}`).join(" · ");
}

function renderCart(focusTarget = null) {
  cartItemsElement.replaceChildren();
  const isEmpty = cart.length === 0;
  cartEmptyElement.hidden = !isEmpty;
  cartItemsElement.hidden = isEmpty;
  cartFooterElement.hidden = isEmpty;

  cart.forEach((line) => {
    const key = cartLineKey(line);
    const item = document.createElement("article");
    item.className = "cart-item";

    const image = document.createElement("img");
    image.className = "cart-item-image";
    image.alt = line.imageAlt;
    image.loading = "lazy";
    if (line.imageUrl) {
      image.src = line.imageUrl;
      image.onerror = () => {
        image.removeAttribute("src");
        image.hidden = true;
      };
    } else {
      image.hidden = true;
    }

    const body = document.createElement("div");
    body.className = "cart-item-body";
    const title = document.createElement("h3");
    title.className = "cart-item-title";
    title.textContent = line.productTitle;
    const options = document.createElement("p");
    options.className = "cart-item-options";
    options.textContent = formatLineOptionSummary(line);
    const unitPrice = document.createElement("p");
    unitPrice.className = "cart-item-unit-price";
    unitPrice.textContent = `${formatPrice({ amount: line.unitPrice, currencyCode: line.currencyCode })} each`;

    const controls = document.createElement("div");
    controls.className = "cart-item-controls";
    const decrease = makeCartActionButton("−", `Decrease quantity of ${line.productTitle}`, "decrease", key);
    const lineQuantity = document.createElement("input");
    lineQuantity.className = "cart-item-quantity";
    lineQuantity.type = "number";
    lineQuantity.min = "1";
    lineQuantity.step = "1";
    lineQuantity.value = String(line.quantity);
    lineQuantity.setAttribute("aria-label", `Quantity of ${line.productTitle}`);
    lineQuantity.setAttribute("data-cart-key", key);
    lineQuantity.setAttribute("data-line-quantity", "true");
    lineQuantity.addEventListener("change", () => {
      setCartLineQuantity(key, normalizeQuantity(lineQuantity.value));
      renderCart({ quantity: true, key });
    });
    const increase = makeCartActionButton("+", `Increase quantity of ${line.productTitle}`, "increase", key);
    const remove = makeCartActionButton("Remove", `Remove ${line.productTitle} from cart`, "remove", key);
    remove.className = "cart-item-remove";
    controls.append(decrease, lineQuantity, increase, remove);

    const subtotal = document.createElement("p");
    subtotal.className = "cart-item-subtotal";
    subtotal.textContent = `Subtotal: ${formatPrice({
      amount: line.unitPrice * line.quantity,
      currencyCode: line.currencyCode,
    })}`;

    body.append(title, options, unitPrice, controls, subtotal);
    item.append(image, body);
    cartItemsElement.append(item);
  });

  const totalsByCurrency = new Map();
  cart.forEach((line) => {
    totalsByCurrency.set(
      line.currencyCode,
      (totalsByCurrency.get(line.currencyCode) || 0) + line.unitPrice * line.quantity,
    );
  });
  cartTotalElement.textContent = [...totalsByCurrency.entries()]
    .map(([currencyCode, amount]) => formatPrice({ amount, currencyCode }))
    .join(" · ");

  syncCartBadge();
  restoreLineControlFocus(focusTarget);
}

function makeCartActionButton(text, label, action, key) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.setAttribute("aria-label", label);
  button.setAttribute("data-line-action", action);
  button.setAttribute("data-cart-key", key);
  button.addEventListener("click", () => handleCartLineAction(action, key));
  return button;
}

function restoreLineControlFocus(focusTarget) {
  if (!focusTarget) return;
  if (focusTarget.fallback || !cart.length) {
    cartCloseButton.focus();
    return;
  }

  const controls = [...cartItemsElement.querySelectorAll("[data-line-action], [data-line-quantity]")];
  const target = controls.find((control) =>
    control.getAttribute("data-cart-key") === focusTarget.key &&
    (focusTarget.quantity
      ? control.hasAttribute("data-line-quantity")
      : control.getAttribute("data-line-action") === focusTarget.action),
  );
  (target || cartCloseButton).focus();
}

function setCartLineQuantity(key, quantity) {
  const line = cart.find((cartLine) => cartLineKey(cartLine) === key);
  if (!line) return;
  line.quantity = normalizeQuantity(quantity);
  persistCart();
}

function handleCartLineAction(action, key) {
  const line = cart.find((cartLine) => cartLineKey(cartLine) === key);
  if (!line) return;

  if (action === "remove") {
    cart = cart.filter((cartLine) => cartLineKey(cartLine) !== key);
    persistCart();
    renderCart({ fallback: true });
    return;
  }

  line.quantity = normalizeQuantity(line.quantity + (action === "increase" ? 1 : -1));
  persistCart();
  renderCart({ action, key });
}

function syncCartBadge() {
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  cartCountElement.textContent = String(count);
  cartCountElement.hidden = count === 0;
  cartButton.setAttribute(
    "aria-label",
    count === 0 ? "Shopping cart, empty" : `Shopping cart, ${count} ${count === 1 ? "item" : "items"}`,
  );
  cartLiveElement.textContent = count === 0
    ? "Your cart is empty."
    : `Your cart contains ${count} ${count === 1 ? "item" : "items"}.`;
}

function openCart(opener) {
  if (!cartDialog.open) {
    cartOpener = opener;
    cartDialog.showModal();
    cartButton.setAttribute("aria-expanded", "true");
  }
  cartCloseButton.focus();
}

function closeCart(restoreTarget = cartOpener) {
  if (!cartDialog.open) return;
  focusAfterCartClose = restoreTarget;
  cartDialog.close();
}

function addSelectedVariantToCart() {
  if (!currentProduct || !currentVariant || currentVariant.availableForSale !== true) return;
  const unitPrice = Number(currentVariant.price?.amount);
  const currencyCode = currentVariant.price?.currencyCode;
  if (!currentProduct.id || !currentVariant.id || !Number.isFinite(unitPrice) || !currencyCode?.trim()) return;

  const imageUrl = currentVariant.image?.url || mainImage.currentSrc || mainImage.src || "";
  const newLine = {
    productId: currentProduct.id,
    variantId: currentVariant.id,
    productTitle: currentProduct.title,
    selectedOptions: (currentVariant.selectedOptions ?? []).map(({ name, value }) => ({ name, value })),
    unitPrice,
    currencyCode,
    quantity: normalizeQuantity(quantityInput.value),
    imageUrl,
    imageAlt: currentVariant.image?.altText?.trim() || mainImage.alt || currentProduct.title,
  };
  quantityInput.value = String(newLine.quantity);

  const existingLine = cart.find((line) => cartLineKey(line) === cartLineKey(newLine));
  if (existingLine) {
    const nextQuantity = existingLine.quantity + newLine.quantity;
    Object.assign(existingLine, newLine, { quantity: nextQuantity });
  } else {
    cart.push(newLine);
  }

  persistCart();
  renderCart();
  openCart(addToCartButton);
}

function setupCartControls() {
  cart = readStoredCart();
  renderCart();

  quantityButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const quantity = normalizeQuantity(quantityInput.value);
      quantityInput.value = String(normalizeQuantity(quantity + Number(button.dataset.quantityStep)));
    });
  });
  quantityInput.addEventListener("change", () => {
    quantityInput.value = String(normalizeQuantity(quantityInput.value));
  });
  quantityInput.addEventListener("blur", () => {
    quantityInput.value = String(normalizeQuantity(quantityInput.value));
  });
  addToCartButton.addEventListener("click", addSelectedVariantToCart);
  cartButton.addEventListener("click", () => {
    if (cartDialog.open) closeCart(cartButton);
    else openCart(cartButton);
  });
  cartCloseButton.addEventListener("click", () => closeCart());
  cartDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeCart();
  });
  cartDialog.addEventListener("click", (event) => {
    if (event.target === cartDialog) closeCart();
  });
  cartDialog.addEventListener("close", () => {
    const restoreTarget = focusAfterCartClose || cartOpener;
    focusAfterCartClose = null;
    cartOpener = null;
    cartButton.setAttribute("aria-expanded", "false");
    if (restoreTarget && restoreTarget.isConnected !== false) restoreTarget.focus();
    else cartButton.focus();
  });
}

function renderProduct(product) {
  const productTitle = product.title?.trim();
  if (!productTitle) throw new Error("The product response did not include a title.");

  const productDescription = product.description?.trim() || "";
  const seoTitle = product.seo?.title?.trim() || productTitle;
  const seoDescription = product.seo?.description?.trim() || productDescription;

  titleElement.textContent = productTitle;
  descriptionElement.textContent = productDescription;
  breadcrumbElement.textContent = productTitle;
  document.title = seoTitle;
  descriptionMeta.content = seoDescription;
  currentProduct = product;

  renderGallery(product);
  renderOptionControls(product);
}

function syncProductUrl(handle) {
  const url = new URL(window.location.href);
  url.searchParams.set("handle", handle);
  window.history.replaceState(window.history.state, "", url);
}

async function loadProduct() {
  const handle = currentHandle();
  productSection.classList.add("is-loading");
  productSection.setAttribute("aria-busy", "true");
  errorElement.hidden = true;
  retryButton.disabled = true;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: PRODUCT_QUERY,
        variables: { handle },
      }),
    });

    if (!response.ok) throw new Error(`The product request failed (${response.status}).`);

    const result = await response.json();
    if (result.errors?.length) {
      throw new Error(result.errors.map((error) => error.message).filter(Boolean).join(" ") || "The product request returned an error.");
    }

    if (!result.data?.product) {
      throw new Error("We couldn't find that product. Check the link and try again.");
    }

    renderProduct(result.data.product);
    syncProductUrl(handle);
    productSection.classList.remove("is-loading");
  } catch (error) {
    errorMessage.textContent = error instanceof TypeError
      ? "We couldn't load the product. Check your connection and try again."
      : error instanceof Error
        ? error.message
        : "We couldn't load this product. Please try again.";
    errorElement.hidden = false;
  } finally {
    productSection.classList.remove("is-loading");
    productSection.setAttribute("aria-busy", "false");
    retryButton.disabled = false;
  }
}

retryButton.addEventListener("click", loadProduct);
setupCartControls();
loadProduct();
