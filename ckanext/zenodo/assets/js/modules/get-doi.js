ckan.module('get-doi', function ($, _) {
  return {
    initialize: function () {
      this.el.on('click', this._onClick.bind(this));
    },

    // Function to create a deposition, upload file, set metadata, and publish to get DOI
    _createAndPublishZenodoDeposition: async function(file, description, dataset) {
      // the token is in you ckan.ini or production.ini file in etc/lib/ckan
      const ACCESS_TOKEN = window.ZENODO_TOKEN; 
      const headers = {"Content-Type": "application/json"};
      // Used to pass the access token in the request
      const params = new URLSearchParams({ access_token: ACCESS_TOKEN }).toString();
      // Don't forget to remove the sandbox URL when you are ready to use it in production
      const baseUrl = 'https://sandbox.zenodo.org/api/deposit/depositions';

      // Step 1: Create a deposition
      const response = await fetch(`${baseUrl}?${params}`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({}) // Empty body to create a new deposition
      });
      const data = await response.json();
      const bucket_url = data.links.bucket;
      const deposition_id = data.id;

      // Step 2: Upload the file
      const uploadResp = await fetch(
        `${bucket_url}/${encodeURIComponent(file.name)}?access_token=${ACCESS_TOKEN}`,
        {
          method : 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' }, // type used for the blob
          body : file // the file is already a blob
        }
      );
      if (!uploadResp.ok) {
        const err = await uploadResp.text();
        throw new Error(`Upload failed: ${uploadResp.status} – ${err}`);
      }

      // Step 3: Add metadata
      const metadata = {
        metadata: {
          title: `CKAN-${file.name}`,
          upload_type: 'dataset',
          description: description || 'No description provided',
          creators: [{ name: dataset.author || 'GeoEcomar', affiliation: dataset.organization.name || '' }]
        }
      };
      const metadataResponse = await fetch(`${baseUrl}/${deposition_id}?${params}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      });
      if (!metadataResponse.ok) {
        throw new Error('Failed to set metadata');
      }

      // Step 4: Publish the deposition
      const publishResponse = await fetch(`${baseUrl}/${deposition_id}/actions/publish?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const publishedData = await publishResponse.json();
      const doi = publishedData.doi;
      return doi;
    },

    // Function to update CKAN dataset with DOI
    _addDoiToCkanDataset: async function(doi, dataset, file) {
      const ckanApiUrl = '/api/3/action/package_update';
      dataset.extras = dataset.extras || [];

      // Check if the DOI already exists in the dataset
      let found = false;
      for (let extra of dataset.extras) {
        if (extra.key === `doi_${file.name}`) {
          extra.value = doi;
          found = true;
          break;
        }
      }
      if (!found) {
        dataset.extras.push({ key: `doi_${file.name}`, value: doi });
      }

      // Remove forbidden fields from the dataset object
      const forbidden = [
        'tracking_summary', 'num_resources', 'num_tags',
        'metadata_modified', 'metadata_created', 'isopen', 'revision_id',
        'state', 'relationships_as_object', 'relationships_as_subject'
      ];
      for (const k of forbidden) delete dataset[k];

      // Add CSRF token for security and because CKAN requires it
      const csrf_value = $('meta[name=_csrf_token]').attr('content');
      const updateResp = await fetch(ckanApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': window.CKAN_TOKEN,
          'X-CSRF-Token': csrf_value,
        },
        body: JSON.stringify(dataset)
      });
      if (!updateResp.ok) {
        alert('Failed to update dataset with DOI');
      } else {
        alert('DOI saved to dataset!');
      }
    },

    _DoiInDataset: function(dataset, file) {
      for (let extra of dataset.extras) {
        if (extra.key === `doi_${file.name}`) {
          return true;
        }
      }
      return false;
    },

    _isUploaded: function () {
      const $form = this.el.closest('form');
      const fileInput = $form.find('input[type="file"]')[0];
      return fileInput && fileInput.files.length > 0;
    },

    _onClick: async function (event) {
      event.preventDefault();
      const $form = this.el.closest('form');
      const fileInput = $form.find('input[type="file"]')[0];
      if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const description = $form.find('textarea[name="description"]').val() || '';
        try {
          // Fetch the dataset information from CKAN
          const datasetId = window.CKAN_PACKAGE_NAME;
          const getResp = await fetch(`/api/3/action/package_show?id=${datasetId}`);
          const dataset = (await getResp.json()).result;

          // change this part if you want to publish on zenodo muliple times
          if (this._DoiInDataset(dataset, file)) {
            alert('This dataset already has a DOI.');
            return; 
          }
          else {
            const doi = await this._createAndPublishZenodoDeposition(file, description, dataset);
            await this._addDoiToCkanDataset(doi, dataset, file);
            alert('DOI created: ' + doi);
          }

        } catch (error) {
          console.error('Error uploading file to Zenodo:', error);
          alert('Error uploading file to Zenodo: ' + error.message);
          return;
        }
      }
      else {
        alert('Please select a file to upload.');
        return;
      }
    }
  };
});

