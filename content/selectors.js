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
