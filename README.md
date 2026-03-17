# eBay Seller Filter

A Chrome extension that filters eBay search results by seller feedback quality, helping you avoid listings from sellers with poor or insufficient feedback.

## What It Does

eBay Seller Filter inspects seller feedback data on eBay search results and individual listing pages. Listings from sellers who do not meet your minimum feedback thresholds are either hidden or dimmed, so you can focus on trustworthy sellers without manually checking each one.

## Features

- **Filters search results** — hides or dims listings from low-feedback sellers on eBay search and browse pages
- **Warning banner on listing pages** — displays a prominent warning on individual item pages when the seller does not meet your thresholds
- **Badge count** — the extension icon shows how many listings were filtered on the current page
- **Configurable thresholds** — set your own minimum feedback count and minimum positive feedback percentage via the popup
- **Infinite scroll support** — works with lazily loaded results as you scroll
- **Auto list-view switching** — gallery mode does not show seller feedback data, so the extension automatically switches to list view on search pages where gallery mode is detected

## Default Settings

| Setting | Default |
|---|---|
| Minimum feedback count | 1 |
| Minimum positive feedback % | 90% |
| Filter mode | Hide |
| Banner style | Sticky |

## How to Install

This extension is not yet published to the Chrome Web Store. To install it manually:

1. Download or clone this repository to your local machine.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked** and select the folder containing this repository.
5. The eBay Seller Filter icon will appear in your Chrome toolbar.

To configure thresholds, click the extension icon and adjust the settings in the popup.

## How It Works

The extension uses content scripts that run on eBay search pages (`/sch/`, `/b/`) and individual listing pages (`/itm/`). On search pages, each listing is inspected for seller feedback information. Any seller whose feedback count or positive percentage falls below your configured thresholds will have their listing hidden or dimmed depending on your chosen filter mode. On individual listing pages, a warning banner is injected at the top of the page if the seller does not meet your thresholds.

All filtering happens locally in your browser. No network requests are made by the extension.

## Permissions

| Permission | Purpose |
|---|---|
| `storage` | Save your settings across browser sessions |
| `tabs` | Detect page navigation changes so the badge count can be reset correctly |
| `*://*.ebay.com/*` | Run content scripts on eBay pages to read seller feedback data |

## Privacy Policy

eBay Seller Filter does not collect, transmit, or store any user data.

- **No analytics or telemetry** — the extension contains no tracking code of any kind.
- **No external servers** — the extension makes no network requests. No data is ever sent off your device.
- **Local settings only** — your threshold preferences are stored using `chrome.storage.sync`, which syncs only to your own Chrome profile via your Google account. No third party has access to this data.
- **DOM access is read-only and limited** — the extension reads eBay page content solely to extract seller feedback numbers for filtering purposes. It does not read, collect, or store any personal information, search queries, purchase history, or account details.
- **Host permissions scope** — the `*://*.ebay.com/*` host permission is required only to allow content scripts to run on eBay pages. It is not used to intercept network traffic or access any data outside the visible page DOM.

## License

MIT
