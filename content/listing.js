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
