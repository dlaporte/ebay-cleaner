(async function ebfSearchMain() {
  const settings = await ebfGetSettings();

  // Gallery mode doesn't include seller feedback data — handle per user preference
  if (window.location.search.includes('_dmd=2')) {
    var listUrl = new URL(window.location.href);
    listUrl.searchParams.set('_dmd', '1');

    var galleryBanner = document.createElement('div');
    galleryBanner.className = 'ebf-warning-banner ebf-banner-sticky';
    document.body.classList.add('ebf-has-sticky-banner');

    var galleryText = document.createElement('span');
    galleryText.className = 'ebf-warning-banner__text';

    if (settings.galleryMode === 'redirect') {
      var secondsLeft = 5;
      var countSpan = document.createElement('strong');
      countSpan.textContent = secondsLeft + 's';

      var before = document.createTextNode('\u26A0 Seller filtering does not work in gallery view. Switching to list view in ');
      var after = document.createTextNode('...');
      galleryText.appendChild(before);
      galleryText.appendChild(countSpan);
      galleryText.appendChild(after);

      var interval = setInterval(function () {
        secondsLeft--;
        if (secondsLeft <= 0) {
          clearInterval(interval);
          window.location.replace(listUrl.toString());
        } else {
          countSpan.textContent = secondsLeft + 's';
        }
      }, 1000);
    } else {
      var switchLink = document.createElement('a');
      switchLink.href = listUrl.toString();
      switchLink.textContent = 'Switch to list view';
      switchLink.style.color = 'inherit';
      switchLink.style.fontWeight = '700';

      var bannerMsg = document.createTextNode('\u26A0 Seller filtering does not work in gallery view. ');
      galleryText.appendChild(bannerMsg);
      galleryText.appendChild(switchLink);
    }

    var closeBtn = document.createElement('button');
    closeBtn.className = 'ebf-warning-banner__close';
    closeBtn.textContent = '\u00D7';
    closeBtn.title = 'Dismiss';
    closeBtn.addEventListener('click', function () {
      galleryBanner.remove();
      document.body.classList.remove('ebf-has-sticky-banner');
    });

    galleryBanner.appendChild(galleryText);
    galleryBanner.appendChild(closeBtn);
    document.body.prepend(galleryBanner);
    return;
  }
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

  function isClassifiedAd(card) {
    var spans = card.querySelectorAll(EBF_SELECTORS.search.classifiedText);
    for (var i = 0; i < spans.length; i++) {
      if (spans[i].textContent.trim().indexOf('Classified Ad') === 0) return true;
    }
    return false;
  }

  function applyFilter(card, labelText) {
    filteredCount++;
    if (settings.filterMode === 'hide') {
      card.classList.add('ebf-hidden');
    } else {
      card.classList.add('ebf-dimmed');
      var imageWrap = card.querySelector(EBF_SELECTORS.search.imageWrapper);
      if (imageWrap) {
        imageWrap.classList.add('ebf-dim-label-wrap');
        var label = document.createElement('div');
        label.className = 'ebf-dim-label';
        label.textContent = labelText;
        imageWrap.appendChild(label);
      }
    }
  }

  function processCard(card) {
    if (card.classList.contains('ebf-processed')) return;
    card.classList.add('ebf-processed');

    // Check for classified ads first
    if (settings.filterClassifieds && isClassifiedAd(card)) {
      applyFilter(card, 'Classified Ad');
      return;
    }

    const data = extractSellerData(card);
    if (!data) return; // Can't extract — leave untouched

    if (shouldFilter(data.feedbackCount, data.positivePercent)) {
      var countStr = data.feedbackCount !== null ? data.feedbackCount : '?';
      var pctStr = data.positivePercent !== null ? data.positivePercent + '%' : '?';
      applyFilter(card, 'Low feedback (' + countStr + ' reviews, ' + pctStr + ')');
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
    }, function () {
      // Suppress "Could not establish connection" errors when service worker is inactive
      void chrome.runtime.lastError;
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
