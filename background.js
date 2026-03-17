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
