# eBay Seller Filter — Chrome Extension Design Spec

## Problem

eBay search results are cluttered with listings from scam or low-quality sellers — accounts with zero feedback, very few reviews, or poor feedback percentages. There is no built-in way to filter these out.

## Solution

A Chrome extension that:

1. **Filters search results** — hides or dims listings from sellers who don't meet configurable feedback thresholds
2. **Warns on listing pages** — shows a banner when you land on an individual listing from a low-quality seller
3. **Shows a badge count** — the extension icon displays how many listings were filtered on the current page

## User-Configurable Settings

All settings are exposed in a popup UI accessed by clicking the extension icon.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Minimum feedback count | Number | 1 | Sellers with fewer than this many reviews are flagged |
| Minimum positive feedback % | Number | 90 | Sellers below this positive percentage are flagged |
| Filter mode | Toggle | Hide | "Hide" removes listings from DOM; "Dim" grays them out with a label |
| Warning banner style | Toggle | Sticky | "Sticky" stays visible on scroll; "Dismissible" can be closed |

Settings are persisted via `chrome.storage.sync` so they roam across devices.

## Behavior

### Search Results Pages

- Content script runs on eBay search/browse result pages
- For each listing, extract the seller's feedback count and positive percentage
- If the seller is below **either** threshold:
  - **Hide mode**: Remove the listing from the visible DOM (not deleted — hidden via CSS so the page layout remains stable)
  - **Dim mode**: Reduce opacity and overlay a label: "Low seller feedback (X reviews, Y% positive)"
- The extension icon badge updates with the count of filtered listings on the current page

### Individual Listing Pages

- Content script runs on eBay item pages (`/itm/` URLs)
- Extract seller feedback count and positive percentage from the seller info section
- If below either threshold, inject a warning banner at the top of the page:
  - Banner content: "Warning: This seller has low feedback — [X] reviews, [Y]% positive"
  - **Sticky mode** (default): Banner is fixed-position, stays visible on scroll
  - **Dismissible mode**: Banner appears at top, user can click X to close it
- Banner is visually distinct (e.g., amber/yellow background) to catch attention without being alarming

### Badge Count

- Background service worker listens for messages from content scripts
- When a search page content script finishes filtering, it sends the filtered count to the background
- Background worker updates the extension icon badge with the count
- Badge count **accumulates** as new results load via infinite scroll / lazy loading
- Badge clears on navigation: background uses `chrome.tabs.onUpdated` to detect URL changes — if the new URL is not an eBay search page, the badge is cleared for that tab

## Technical Architecture

### Manifest V3

The extension uses Chrome Manifest V3 (current standard).

**Permissions:**
- `storage` — for persisting settings
- `tabs` — for detecting tab navigation changes (badge clearing)

**Host permissions:**
- `*://*.ebay.com/*`

### File Structure

```
manifest.json              — Extension manifest (MV3)
popup.html                 — Settings UI markup
popup.css                  — Settings UI styles
popup.js                   — Settings UI logic (read/write chrome.storage)
content/selectors.js       — Centralized DOM selectors (easy to update)
content/search.js          — Content script for search result pages
content/listing.js         — Content script for individual listing pages
content/styles.css         — Injected styles (dimming, banners)
common/settings.js         — Shared module for reading settings with defaults
background.js              — Service worker for badge count management
icons/
  icon16.png
  icon32.png
  icon48.png
  icon128.png
```

### Content Script Matching

- **Search results**: `*://*.ebay.com/sch/*` and `*://*.ebay.com/b/*`
- **Listing pages**: `*://*.ebay.com/itm/*`

### Data Extraction Strategy

Seller feedback data is present in the DOM on both search and listing pages. Since eBay's DOM structure can change, all selectors are centralized in a single `content/selectors.js` file for easy maintenance.

**Selector discovery approach**: The exact CSS selectors must be determined at implementation time by inspecting the live eBay DOM. The implementation plan should include a research step to capture current selectors for:

- **Search results**: Each listing card's seller info area — feedback count (numeric) and positive percentage
- **Listing pages**: The seller info panel — feedback score and positive percentage

**Selector module** (`content/selectors.js`):
```js
// Centralized selectors — update here when eBay changes their DOM
export const SELECTORS = {
  search: {
    listingCard: '...', // Each result item container
    sellerInfo: '...',  // Seller info within a card
    feedbackCount: '...', // Numeric feedback count
    feedbackPercent: '...' // Positive percentage
  },
  listing: {
    sellerPanel: '...',
    feedbackCount: '...',
    feedbackPercent: '...'
  }
};
```

**Resilience**: If a selector fails to match, the listing is left untouched (fail open, not fail closed). Extraction failures are logged to the console with a `[eBay Seller Filter]` prefix for easy debugging.

### Settings Module

A shared `common/settings.js` provides:

```js
const DEFAULTS = {
  minFeedbackCount: 1,
  minPositivePercent: 90,
  filterMode: 'hide',      // 'hide' | 'dim'
  bannerStyle: 'sticky'    // 'sticky' | 'dismissible'
};

async function getSettings() { ... }
async function saveSettings(settings) { ... }
```

The `common/settings.js` file is included as an additional script in each content script's `js` array in the manifest (loaded before the main content script). The popup loads it via a `<script>` tag. This avoids ES module complexity in content scripts.

## Edge Cases

- **Seller data not found**: If feedback info can't be extracted from a listing, leave it untouched. Never filter a listing you can't evaluate.
- **eBay DOM changes**: Selectors may break on eBay redesigns. The extension should fail gracefully — no filtering rather than broken pages.
- **International eBay sites**: The `*.ebay.com` match pattern covers the US site. International sites (ebay.co.uk, ebay.de, etc.) are out of scope for v1 but the architecture supports adding them later.
- **Dynamically loaded results**: eBay may lazy-load additional results on scroll. The content script should use a MutationObserver to catch newly added listings.

## Out of Scope (v1)

- Seller whitelist/blacklist
- Account age filtering
- International eBay domains
- Firefox/Safari support
- Export/import of settings
