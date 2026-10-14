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

let selectedOptionValues = {};
let currentVariant = null;

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
  return new URLSearchParams(window.location.search).get("handle") || DEFAULT_HANDLE;
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

function selectImage(image, index, productTitle, buttons) {
  mainImage.hidden = false;
  imageFallback.hidden = true;
  mainImage.alt = imageAlt(image, productTitle, index);
  mainImage.onerror = () => {
    mainImage.removeAttribute("src");
    mainImage.hidden = true;
    imageFallback.hidden = false;
    imageFallback.textContent = "Product image unavailable";
  };
  mainImage.src = image.url;

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

  renderGallery(product);
  renderOptionControls(product);
}

async function loadProduct() {
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
        variables: { handle: currentHandle() },
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
loadProduct();
