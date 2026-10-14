# Northfold Stoneware V2

An API-driven, minimalist product website showcasing Northfold's ceramic mug. Built on the original responsive product page, V2 integrates Shopify's Storefront API through `mock.shop` to load product information, images, prices, and variants dynamically.

The product experience includes an interactive image gallery, finish and capacity selectors, variant-dependent pricing and imagery, quantity controls, and a cart drawer. Cart contents persist across page reloads using `localStorage`. Product handles are read from the URL, supporting shareable and bookmarkable product links.

**Live site:** [Northfold Stoneware](https://elvicharde.github.io/northfold-stoneware-v2/)

## One key decision

**Keep the implementation framework-free and preserve the existing design.**

Rather than introducing a frontend framework or rebuilding the interface, V2 extends the original HTML and CSS with native JavaScript and the Fetch API. This keeps the implementation lightweight while demonstrating how an existing static product page can evolve into a data-driven shopping experience.

Product information remains API-driven rather than duplicated in the markup. Variant selection and gallery image selection are treated as independent states, allowing a variant to update the hero image without incorrectly changing the selected gallery thumbnail.

## What I would do next

- Replace the mock Storefront API with a production commerce backend and implement a complete checkout flow.
- Add automated tests for variant selection, cart calculations, persistence, and URL-based product loading.
- Improve cart and product-state handling for network failures and edge cases.
- Extend the experience to support multiple products, product listings, and product-specific pages.
- Evaluate server-side rendering or static generation if SEO, performance, and production requirements justify the added complexity.

V2 demonstrates the transition from a CSS-driven static showcase to a lightweight, API-powered product experience while retaining the original design approach.
