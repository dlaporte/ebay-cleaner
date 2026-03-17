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
