(async function () {
  var selectFields = ['filterMode', 'bannerStyle', 'galleryMode'];
  var checkboxFields = ['filterFeedbackCount', 'filterPositivePercent', 'filterClassifieds'];
  var numberFields = ['minFeedbackCount', 'minPositivePercent'];

  // Load current settings into form
  var settings = await ebfGetSettings();

  for (var i = 0; i < selectFields.length; i++) {
    var el = document.getElementById(selectFields[i]);
    if (el) el.value = settings[selectFields[i]];
  }
  for (var i = 0; i < checkboxFields.length; i++) {
    var el = document.getElementById(checkboxFields[i]);
    if (el) el.checked = settings[checkboxFields[i]];
  }
  for (var i = 0; i < numberFields.length; i++) {
    var el = document.getElementById(numberFields[i]);
    if (el) el.value = settings[numberFields[i]];
  }

  // Save
  document.getElementById('save').addEventListener('click', async function () {
    var updated = {};

    updated.minFeedbackCount = parseInt(document.getElementById('minFeedbackCount').value, 10);
    updated.minPositivePercent = parseInt(document.getElementById('minPositivePercent').value, 10);
    updated.filterFeedbackCount = document.getElementById('filterFeedbackCount').checked;
    updated.filterPositivePercent = document.getElementById('filterPositivePercent').checked;
    updated.filterClassifieds = document.getElementById('filterClassifieds').checked;
    updated.filterMode = document.getElementById('filterMode').value;
    updated.bannerStyle = document.getElementById('bannerStyle').value;
    updated.galleryMode = document.getElementById('galleryMode').value;

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
