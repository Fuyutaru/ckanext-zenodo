ckan.module('get-doi', function ($, _) {
  return {
    initialize: function () {
      this.el.on('click', this._onClick.bind(this));
    },

    // Function to create a deposition, upload file, set metadata, and publish to get DOI
    _createAndPublishZenodoDeposition: async function(file, dataset, DataTitle) {
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
        `${bucket_url}/${encodeURIComponent(DataTitle)}?access_token=${ACCESS_TOKEN}`,
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
          title: `${DataTitle}`,
          upload_type: 'dataset',
          description: dataset.notes || 'No description provided',
          creators: [{ name: dataset.author || 'GeoEcomar', affiliation: dataset.organization.name || '' }],
          access_right: this._GetAccessRights(dataset),
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
    _addDoiToCkanDataset: async function(doi, dataset) {
      const ckanApiUrl = '/api/3/action/package_update';
      dataset.extras = dataset.extras || [];

      const doiurl = `https://doi.org/${doi}`;
      const doiLink = `<a href="${doiurl}" target="_blank">${doiurl}</a>`;

      // Check if the DOI already exists in the dataset
      let found = false;
      for (let extra of dataset.extras) {
        if (extra.key === `doi`) {
          extra.value = doiLink;
          found = true;
          break;
        }
      }
      if (!found) {
        dataset.extras.push({ key: `doi`, value: doiLink });
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
        console.log('Failed to update dataset with DOI');
      } else {
        console.log('DOI saved to dataset!');
      }
    },

    _DoiInDataset: function(dataset) {
      for (let extra of dataset.extras) {
        if (extra.key === `doi`) {
          return true;
        }
      }
      return false;
    },

    _GetAccessRights: function(dataset) {
      if (dataset.private) {
        return 'closed';
      }
      else {
        return 'open';
      }
    },


    _onClick: async function (event) {
      event.preventDefault(); // Important for preventing default form submission
      const $form = this.el.closest('form');
      const fileInput = $form.find('input[type="file"]')[0];
      const radio_resp = window.RADIO_RESP;
      console.log('Want DOI:', radio_resp);

      // Mandatory because CKAN won't submit the form without a save input
      if ($form.find('input[name="save"]').length === 0) {
        $('<input>').attr({
          type: 'hidden',
          name: 'save',
          value: 'go-metadata'
        }).appendTo($form);
      }
      if (radio_resp == 'yes') {
        if (fileInput && fileInput.files.length > 0) {
          const file = fileInput.files[0];
          const DataTitle = window.CKAN_PACKAGE_NAME;
          try {
            const getResp = await fetch(`/api/3/action/package_show?id=${DataTitle}`);
            const dataset = (await getResp.json()).result; // Get the dataset object from ckan
            if (this._DoiInDataset(dataset)) {
              console.log('This dataset already has a DOI.');
              $form.submit();
              return;
            } else {
              const doi = await this._createAndPublishZenodoDeposition(file, dataset, DataTitle);
              await this._addDoiToCkanDataset(doi, dataset);
              console.log('DOI created: ' + doi);
              $form.submit();
            }
          } catch (error) {
            console.error('Error uploading file to Zenodo:', error);
            alert('Error uploading file to Zenodo: ' + error.message);
            return;
          }
        } else {
          alert('Please select a file to upload.');
          return;
        }
      } else {
        $form.submit();
      }
    }
  };
});

