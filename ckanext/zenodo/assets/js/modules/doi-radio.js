// ckanext/zenodo/assets/js/modules/doi-radio.js
// Handles broadcasting the DOI radio button choice across forms

ckan.module('doi-radio', function ($, _) {
  return {
    initialize: function () {
      $(document).ready(function() {
        const yes = document.getElementById('doi-yes');
        const no = document.getElementById('doi-no');
        function sendDoiChoice(value) {
          window.localStorage.setItem('want_doi', value);
          window.dispatchEvent(new Event('want_doi_changed'));
        }

        // For user interaction
        if (yes) yes.addEventListener('change', function() { if (yes.checked) sendDoiChoice('yes'); });
        if (no) no.addEventListener('change', function() { if (no.checked) sendDoiChoice('no'); });
        
        // Check if the radio button is already checked
        const checked = document.querySelector('input[name="want_doi"]:checked');
        if (checked) sendDoiChoice(checked.value);
      });
    }
  };
});
