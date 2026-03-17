# eBay Seller Filter — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension (MV3) that filters eBay search results by seller feedback quality and warns on individual listing pages.

**Architecture:** Content scripts on eBay search and listing pages extract seller feedback data from the DOM, compare against user-configured thresholds, and hide/dim listings or show warning banners. A background service worker manages badge counts. Settings are stored via chrome.storage.sync and configured through a popup UI.

**Tech Stack:** Chrome Extension Manifest V3, vanilla JS, chrome.storage API, CSS

**Spec:** `docs/superpowers/specs/2026-03-17-ebay-seller-filter-design.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| `manifest.json` | Extension manifest — permissions, content script registration, popup, service worker |
| `common/settings.js` | Settings defaults, getSettings(), saveSettings() — shared by all scripts |
| `content/selectors.js` | Centralized CSS selectors for eBay DOM elements |
| `content/search.js` | Search results filtering — extract seller data, hide/dim, report badge count |
| `content/listing.js` | Listing page warning banner — extract seller data, inject banner |
| `content/styles.css` | CSS for hidden listings, dimmed listings, dim labels, warning banners |
| `background.js` | Service worker — badge count management, tab navigation clearing |
| `popup.html` | Settings UI markup |
| `popup.css` | Settings UI styles |
| `popup.js` | Settings UI logic — read/write settings, bind controls |
| `icons/icon{16,32,48,128}.png` | Extension icons |

---

## Task 1: Project Scaffolding — manifest.json and Icons

**Files:**
- Create: `manifest.json`
- Create: `icons/icon16.png`, `icons/icon32.png`, `icons/icon48.png`, `icons/icon128.png`

- [ ] **Step 1: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "eBay Seller Filter",
  "version": "1.0.0",
  "description": "Filter eBay search results by seller feedback quality",
  "permissions": ["storage", "tabs"],
  "host_permissions": ["*://*.ebay.com/*"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["*://*.ebay.com/sch/*", "*://*.ebay.com/b/*"],
      "js": ["common/settings.js", "content/selectors.js", "content/search.js"],
      "css": ["content/styles.css"],
      "run_at": "document_idle"
    },
    {
      "matches": ["*://*.ebay.com/itm/*"],
      "js": ["common/settings.js", "content/selectors.js", "content/listing.js"],
      "css": ["content/styles.css"],
      "run_at": "document_idle"
    }
  ]
}
```

- [ ] **Step 2: Generate extension icons**

Create PNG icons at 16, 32, 48, and 128px using an inline Node.js script with the `canvas` package (install via `npm install canvas` if needed), or alternatively create minimal SVG files and convert with `rsvg-convert` or `sips`.

Fallback approach if no image tools available: create a simple HTML file that draws the icons on canvas elements, open in a browser, and right-click save each. The icon should be a funnel/filter shape in eBay blue (#0654BA) on a transparent background.

Simplest approach — generate 1-pixel colored PNGs as placeholders (the extension will work fine with these, and real icons can be added later):

```bash
mkdir -p icons
# Create minimal valid PNGs using Python (available on macOS)
python3 -c "
import struct, zlib
def make_png(size, path):
    def chunk(ctype, data):
        return struct.pack('>I', len(data)) + ctype + data + struct.pack('>I', zlib.crc32(ctype + data) & 0xffffffff)
    raw = b''
    for y in range(size):
        raw += b'\x00'  # filter byte
        for x in range(size):
            # Simple blue circle on transparent background
            cx, cy, r = size/2, size/2, size/2 - 1
            if (x - cx)**2 + (y - cy)**2 <= r**2:
                raw += b'\x06\x54\xba\xff'  # eBay blue, opaque
            else:
                raw += b'\x00\x00\x00\x00'  # transparent
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        f.write(chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)))
        f.write(chunk(b'IDAT', zlib.compress(raw)))
        f.write(chunk(b'IEND', b''))
for s in [16, 32, 48, 128]:
    make_png(s, f'icons/icon{s}.png')
print('Icons created')
"
```

- [ ] **Step 3: Verify manifest loads in Chrome**

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" → select project directory
4. Verify extension appears with no errors

- [ ] **Step 4: Commit**

```bash
git add manifest.json icons/
git commit -m "feat: add manifest.json and extension icons"
```

---

## Task 2: Settings Module — common/settings.js

**Files:**
- Create: `common/settings.js`

- [ ] **Step 1: Create common/settings.js**

```js
const EBF_DEFAULTS = {
  minFeedbackCount: 1,
  minPositivePercent: 90,
  filterMode: 'hide',
  bannerStyle: 'sticky'
};

async function ebfGetSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(EBF_DEFAULTS, (settings) => {
      resolve(settings);
    });
  });
}

async function ebfSaveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(settings, resolve);
  });
}
```

Note: Functions use `ebf` prefix to avoid global namespace collisions since this is loaded as a plain script, not a module.

- [ ] **Step 2: Commit**

```bash
git add common/settings.js
git commit -m "feat: add shared settings module with defaults"
```

---

## Task 3: Selectors Module — content/selectors.js

**Files:**
- Create: `content/selectors.js`

DOM research findings (from live eBay inspection, March 2026):

**Search results:**
- Listing card: `li.s-card`
- Seller info text area: `.su-card-container__attributes__secondary .s-card__attribute-row`
- Feedback pattern in text: `99.3% positive (154.8K)` — regex: `/(\d+\.?\d*)%\s*positive\s*\(([\d,.]+K?)\)/`
- Counts use K suffix (e.g., `154.8K` = 154,800)

**Listing pages:**
- Seller card: `div.x-sellercard-atf` or `[data-testid="x-sellercard-atf"]`
- Feedback count: `[data-testid="x-sellercard-atf__about-seller"] span.ux-textspans--SECONDARY` — text like `(154843)`
- Positive %: `[data-testid="x-sellercard-atf__data-item"] span.ux-textspans--PSEUDOLINK` — text like `99.3% positive`

- [ ] **Step 1: Create content/selectors.js**

```js
const EBF_SELECTORS = {
  search: {
    listingCard: 'li.s-card',
    sellerInfoRow: '.su-card-container__attributes__secondary .s-card__attribute-row'
  },
  listing: {
    sellerCard: '[data-testid="x-sellercard-atf"]',
    feedbackCount: '[data-testid="x-sellercard-atf__about-seller"] span.ux-textspans--SECONDARY',
    feedbackPercent: '[data-testid="x-sellercard-atf__data-item"] span.ux-textspans--PSEUDOLINK'
  }
};

// Regex to extract percentage and count from search result seller text
// Matches: "99.3% positive (154.8K)" or "100% positive (42)"
const EBF_FEEDBACK_REGEX = /(\d+\.?\d*)%\s*positive\s*\(([\d,.]+K?)\)/i;

/**
 * Parse a feedback count string like "154.8K" or "42" into a number.
 */
function ebfParseFeedbackCount(str) {
  if (!str) return null;
  const cleaned = str.replace(/,/g, '').trim();
  if (cleaned.toUpperCase().endsWith('K')) {
    return Math.round(parseFloat(cleaned) * 1000);
  }
  const val = parseInt(cleaned, 10);
  return isNaN(val) ? null : val;
}

function ebfLog(msg, ...args) {
  console.log(`[eBay Seller Filter] ${msg}`, ...args);
}

function ebfWarn(msg, ...args) {
  console.warn(`[eBay Seller Filter] ${msg}`, ...args);
}
```

- [ ] **Step 2: Commit**

```bash
git add content/selectors.js
git commit -m "feat: add centralized selectors and feedback parsing"
```

---

## Task 4: Content Styles — content/styles.css

**Files:**
- Create: `content/styles.css`

- [ ] **Step 1: Create content/styles.css**

```css
/* === Search Results: Hidden listings === */
li.s-card.ebf-hidden {
  display: none !important;
}

/* === Search Results: Dimmed listings === */
li.s-card.ebf-dimmed {
  opacity: 0.35 !important;
  position: relative;
}

li.s-card.ebf-dimmed:hover {
  opacity: 0.7 !important;
}

.ebf-dim-label {
  position: absolute;
  top: 8px;
  right: 8px;
  background: #d32f2f;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 3px;
  z-index: 100;
  pointer-events: none;
}

/* === Listing Page: Warning Banner === */
.ebf-warning-banner {
  background: #fff3cd;
  border-bottom: 2px solid #ffc107;
  color: #856404;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 99999;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  box-sizing: border-box;
  width: 100%;
}

.ebf-warning-banner.ebf-banner-sticky {
  position: fixed;
  top: 0;
  left: 0;
}

.ebf-warning-banner.ebf-banner-dismissible {
  position: relative;
}

.ebf-warning-banner__text {
  flex: 1;
}

.ebf-warning-banner__close {
  background: none;
  border: none;
  color: #856404;
  font-size: 20px;
  cursor: pointer;
  padding: 0 0 0 16px;
  line-height: 1;
}

.ebf-warning-banner__close:hover {
  color: #533f03;
}

/* Push page content down when sticky banner is shown */
body.ebf-has-sticky-banner {
  padding-top: 48px !important;
}
```

- [ ] **Step 2: Commit**

```bash
git add content/styles.css
git commit -m "feat: add content styles for filtering and warning banners"
```

---

## Task 5: Search Results Content Script — content/search.js

**Files:**
- Create: `content/search.js`

- [ ] **Step 1: Create content/search.js**

```js
(async function ebfSearchMain() {
  const settings = await ebfGetSettings();
  let filteredCount = 0;

  function shouldFilter(feedbackCount, positivePercent) {
    if (feedbackCount !== null && feedbackCount < settings.minFeedbackCount) return true;
    if (positivePercent !== null && positivePercent < settings.minPositivePercent) return true;
    return false;
  }

  function extractSellerData(card) {
    const rows = card.querySelectorAll(EBF_SELECTORS.search.sellerInfoRow);
    for (const row of rows) {
      const text = row.textContent || '';
      const match = text.match(EBF_FEEDBACK_REGEX);
      if (match) {
        return {
          positivePercent: parseFloat(match[1]),
          feedbackCount: ebfParseFeedbackCount(match[2])
        };
      }
    }
    // If no feedback regex matched anywhere in the card, we can't determine — fail open
    return null;
  }

  function processCard(card) {
    if (card.classList.contains('ebf-processed')) return;
    card.classList.add('ebf-processed');

    const data = extractSellerData(card);
    if (!data) return; // Can't extract — leave untouched

    if (shouldFilter(data.feedbackCount, data.positivePercent)) {
      filteredCount++;

      if (settings.filterMode === 'hide') {
        card.classList.add('ebf-hidden');
      } else {
        card.classList.add('ebf-dimmed');
        const label = document.createElement('div');
        label.className = 'ebf-dim-label';
        const countStr = data.feedbackCount !== null ? data.feedbackCount : '?';
        const pctStr = data.positivePercent !== null ? data.positivePercent + '%' : '?';
        label.textContent = 'Low seller feedback (' + countStr + ' reviews, ' + pctStr + ' positive)';
        card.style.position = 'relative';
        card.appendChild(label);
      }
    }
  }

  function processAllCards() {
    const cards = document.querySelectorAll(EBF_SELECTORS.search.listingCard);
    cards.forEach(processCard);
    updateBadge();
  }

  function updateBadge() {
    chrome.runtime.sendMessage({
      type: 'ebf-update-badge',
      count: filteredCount
    });
  }

  // Initial processing
  processAllCards();
  ebfLog('Filtered ' + filteredCount + ' listings');

  // Watch for dynamically loaded results (infinite scroll)
  const observer = new MutationObserver(function (mutations) {
    let hasNewCards = false;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.matches && node.matches(EBF_SELECTORS.search.listingCard)) {
            processCard(node);
            hasNewCards = true;
          }
          // Also check descendants
          const nested = node.querySelectorAll
            ? node.querySelectorAll(EBF_SELECTORS.search.listingCard)
            : [];
          nested.forEach(function (card) {
            processCard(card);
            hasNewCards = true;
          });
        }
      }
    }
    if (hasNewCards) {
      updateBadge();
      ebfLog('Filtered ' + filteredCount + ' listings (updated)');
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
```

- [ ] **Step 2: Test manually on eBay search page**

1. Load extension in Chrome
2. Navigate to `https://www.ebay.com/sch/i.html?_nkw=laptop`
3. Open DevTools console — check for `[eBay Seller Filter]` log messages
4. Verify listings from low-feedback sellers are hidden (default settings: count < 1, positive < 90%)
5. If selectors fail, check console for warnings and update `content/selectors.js`

- [ ] **Step 3: Commit**

```bash
git add content/search.js
git commit -m "feat: add search results filtering content script"
```

---

## Task 6: Listing Page Content Script — content/listing.js

**Files:**
- Create: `content/listing.js`

- [ ] **Step 1: Create content/listing.js**

```js
(async function ebfListingMain() {
  const settings = await ebfGetSettings();

  function extractSellerData() {
    const card = document.querySelector(EBF_SELECTORS.listing.sellerCard);
    if (!card) {
      ebfWarn('Seller card not found on listing page');
      return null;
    }

    var feedbackCount = null;
    var positivePercent = null;

    // Extract feedback count: text like "(154843)"
    const countEl = document.querySelector(EBF_SELECTORS.listing.feedbackCount);
    if (countEl) {
      const countText = countEl.textContent.trim();
      const countMatch = countText.match(/\(?([\d,]+)\)?/);
      if (countMatch) {
        feedbackCount = parseInt(countMatch[1].replace(/,/g, ''), 10);
      }
    }

    // Extract positive percentage: text like "99.3% positive"
    const pctEl = document.querySelector(EBF_SELECTORS.listing.feedbackPercent);
    if (pctEl) {
      const pctText = pctEl.textContent.trim();
      const pctMatch = pctText.match(/([\d.]+)%/);
      if (pctMatch) {
        positivePercent = parseFloat(pctMatch[1]);
      }
    }

    if (feedbackCount === null && positivePercent === null) {
      ebfWarn('Could not extract any feedback data');
      return null;
    }

    return { feedbackCount: feedbackCount, positivePercent: positivePercent };
  }

  function shouldWarn(feedbackCount, positivePercent) {
    if (feedbackCount !== null && feedbackCount < settings.minFeedbackCount) return true;
    if (positivePercent !== null && positivePercent < settings.minPositivePercent) return true;
    return false;
  }

  function injectBanner(data) {
    // Don't inject twice
    if (document.querySelector('.ebf-warning-banner')) return;

    const banner = document.createElement('div');
    banner.className = 'ebf-warning-banner';

    if (settings.bannerStyle === 'sticky') {
      banner.classList.add('ebf-banner-sticky');
      document.body.classList.add('ebf-has-sticky-banner');
    } else {
      banner.classList.add('ebf-banner-dismissible');
    }

    const countStr = data.feedbackCount !== null ? data.feedbackCount.toLocaleString() : 'unknown';
    const pctStr = data.positivePercent !== null ? data.positivePercent + '%' : 'unknown';

    const textSpan = document.createElement('span');
    textSpan.className = 'ebf-warning-banner__text';

    // Build banner text safely using DOM methods (no innerHTML)
    const warningIcon = document.createTextNode('\u26A0 ');
    const boldLabel = document.createElement('strong');
    boldLabel.textContent = 'Warning:';
    const messageText = document.createTextNode(
      ' This seller has low feedback \u2014 ' + countStr + ' reviews, ' + pctStr + ' positive'
    );
    textSpan.appendChild(warningIcon);
    textSpan.appendChild(boldLabel);
    textSpan.appendChild(messageText);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'ebf-warning-banner__close';
    closeBtn.textContent = '\u00D7';
    closeBtn.title = 'Dismiss warning';
    closeBtn.addEventListener('click', function () {
      banner.remove();
      document.body.classList.remove('ebf-has-sticky-banner');
    });

    banner.appendChild(textSpan);
    banner.appendChild(closeBtn);
    document.body.prepend(banner);
  }

  // Main
  const data = extractSellerData();
  if (data && shouldWarn(data.feedbackCount, data.positivePercent)) {
    injectBanner(data);
    ebfLog('Warning banner shown: ' + data.feedbackCount + ' reviews, ' + data.positivePercent + '% positive');
  }
})();
```

- [ ] **Step 2: Test manually on eBay listing page**

1. Navigate to an eBay listing from a low-feedback seller
2. Verify warning banner appears at top
3. Test sticky mode: scroll down, banner stays fixed
4. Change setting to dismissible: reload, click X to dismiss
5. Navigate to a high-feedback seller listing — no banner

- [ ] **Step 3: Commit**

```bash
git add content/listing.js
git commit -m "feat: add listing page warning banner content script"
```

---

## Task 7: Background Service Worker — background.js

**Files:**
- Create: `background.js`

- [ ] **Step 1: Create background.js**

```js
// Badge count management
chrome.runtime.onMessage.addListener(function (message, sender) {
  if (message.type === 'ebf-update-badge' && sender.tab) {
    var count = message.count;
    chrome.action.setBadgeText({
      tabId: sender.tab.id,
      text: count > 0 ? String(count) : ''
    });
    chrome.action.setBadgeBackgroundColor({
      tabId: sender.tab.id,
      color: '#d32f2f'
    });
  }
});

// Clear badge when navigating away from eBay search pages
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {
  if (changeInfo.url) {
    var isSearchPage = /ebay\.com\/(sch|b)\//.test(changeInfo.url);
    if (!isSearchPage) {
      chrome.action.setBadgeText({ tabId: tabId, text: '' });
    }
  }
});
```

- [ ] **Step 2: Test badge behavior**

1. Search on eBay — badge should show filtered count
2. Navigate to a listing — badge should clear
3. Go back to search — badge should repopulate

- [ ] **Step 3: Commit**

```bash
git add background.js
git commit -m "feat: add background service worker for badge management"
```

---

## Task 8: Popup Settings UI — popup.html, popup.css, popup.js

**Files:**
- Create: `popup.html`
- Create: `popup.css`
- Create: `popup.js`

- [ ] **Step 1: Create popup.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="popup">
    <h1>eBay Seller Filter</h1>

    <div class="field">
      <label for="minFeedbackCount">Minimum feedback count</label>
      <input type="number" id="minFeedbackCount" min="0" step="1">
    </div>

    <div class="field">
      <label for="minPositivePercent">Minimum positive feedback %</label>
      <input type="number" id="minPositivePercent" min="0" max="100" step="1">
    </div>

    <div class="field">
      <label for="filterMode">Filter mode</label>
      <select id="filterMode">
        <option value="hide">Hide listings</option>
        <option value="dim">Dim listings</option>
      </select>
    </div>

    <div class="field">
      <label for="bannerStyle">Warning banner style</label>
      <select id="bannerStyle">
        <option value="sticky">Sticky (stays on scroll)</option>
        <option value="dismissible">Dismissible</option>
      </select>
    </div>

    <div class="actions">
      <button id="save">Save</button>
      <span id="status"></span>
    </div>
  </div>

  <script src="common/settings.js"></script>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create popup.css**

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  color: #333;
}

.popup {
  width: 280px;
  padding: 16px;
}

h1 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 14px;
  color: #0654BA;
}

.field {
  margin-bottom: 12px;
}

.field label {
  display: block;
  font-weight: 500;
  margin-bottom: 4px;
  font-size: 12px;
  color: #555;
}

.field input,
.field select {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;
}

.field input:focus,
.field select:focus {
  outline: none;
  border-color: #0654BA;
  box-shadow: 0 0 0 2px rgba(6, 84, 186, 0.15);
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
}

#save {
  background: #0654BA;
  color: #fff;
  border: none;
  padding: 7px 18px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

#save:hover {
  background: #0448a0;
}

#status {
  font-size: 12px;
  color: #2e7d32;
}
```

- [ ] **Step 3: Create popup.js**

```js
(async function () {
  var fields = ['minFeedbackCount', 'minPositivePercent', 'filterMode', 'bannerStyle'];

  // Load current settings into form
  var settings = await ebfGetSettings();
  for (var i = 0; i < fields.length; i++) {
    var el = document.getElementById(fields[i]);
    if (el) el.value = settings[fields[i]];
  }

  // Save
  document.getElementById('save').addEventListener('click', async function () {
    var updated = {};
    updated.minFeedbackCount = parseInt(document.getElementById('minFeedbackCount').value, 10);
    updated.minPositivePercent = parseInt(document.getElementById('minPositivePercent').value, 10);
    updated.filterMode = document.getElementById('filterMode').value;
    updated.bannerStyle = document.getElementById('bannerStyle').value;

    // Basic validation
    if (isNaN(updated.minFeedbackCount) || updated.minFeedbackCount < 0) {
      updated.minFeedbackCount = EBF_DEFAULTS.minFeedbackCount;
    }
    if (isNaN(updated.minPositivePercent) || updated.minPositivePercent < 0 || updated.minPositivePercent > 100) {
      updated.minPositivePercent = EBF_DEFAULTS.minPositivePercent;
    }

    await ebfSaveSettings(updated);

    var status = document.getElementById('status');
    status.textContent = 'Saved! Reload eBay tabs to apply.';
    setTimeout(function () { status.textContent = ''; }, 3000);
  });
})();
```

- [ ] **Step 4: Test popup**

1. Click extension icon — popup should open with default values
2. Change values, click Save — "Saved!" message appears
3. Close and reopen popup — values should persist
4. Reload eBay tab — new settings should take effect

- [ ] **Step 5: Commit**

```bash
git add popup.html popup.css popup.js
git commit -m "feat: add popup settings UI"
```

---

## Task 9: End-to-End Testing and Polish

**Files:**
- Possibly modify: any file based on testing results

- [ ] **Step 1: Full E2E test — search results**

1. Load extension in Chrome
2. Set thresholds: min count = 10, min positive = 95%
3. Search eBay for a common term (e.g., "usb cable")
4. Verify: low-feedback sellers are hidden
5. Switch to "Dim" mode in settings, reload
6. Verify: low-feedback listings are dimmed with red label
7. Check badge count matches number of filtered listings

- [ ] **Step 2: Full E2E test — listing pages**

1. Navigate directly to a listing from a low-feedback seller
2. Verify: warning banner appears
3. Test sticky mode: scroll, banner stays
4. Change to dismissible in settings, reload
5. Click X — banner disappears
6. Navigate to a high-feedback seller listing — no banner

- [ ] **Step 3: Edge case testing**

1. Test with eBay page that has lazy-loaded results (scroll to load more)
2. Verify MutationObserver catches new listings
3. Verify badge accumulates
4. Test with min count = 0 — nothing should be filtered
5. Test with min count = 999999 — everything should be filtered

- [ ] **Step 4: Fix any issues found during testing**

Address any selector mismatches, styling glitches, or logic bugs.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "fix: address issues found during E2E testing"
```

(Only if changes were needed)
