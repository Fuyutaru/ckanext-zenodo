ckan.module('get-doi', function ($, _) {
  return {
    initialize: function () {
      this.el.on('click', this._onClick.bind(this));
    },

    // Helper function to prepare metadata object
    _prepareMetadata: function(dataset, DataTitle) {
      let resourceType = window.localStorage.getItem('resource_type') || 'other';
      const dataInterval = window.localStorage.getItem('data_interval') ||new Date().toISOString().split('T')[0];

      let type_list = resourceType.split('/');
      let pubType = "";
      let imgType = "";
      if (type_list.length > 1) {
        resourceType = type_list[0];
        if (resourceType === 'publication') {
          pubType = type_list[1];
        }
        if (resourceType === 'image') {
          imgType = type_list[1];
        }
      }

      const tags = this._FindTags(dataset);

      return {
        metadata: {
          title: `${DataTitle}`,
          upload_type: `${resourceType}`,
          publication_type: pubType || '',
          image_type: imgType || '',
          keywords: tags,
          publication_date: dataInterval,
          description: dataset.notes || 'No description provided',
          creators: [{ name: dataset.author || 'GeoEcomar', affiliation: dataset.organization.name || '' }],
          access_right: this._GetAccessRights(dataset),
        }
      };
    },

    // Helper function to upload file to bucket
    _uploadFileToBucket: async function(bucket_url, file, DataTitle, params) {
      const uploadUrl = `${bucket_url}/${encodeURIComponent(DataTitle)}?${params}`;
        
      const uploadResp = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file
      });
      if (!uploadResp.ok) {
        const err = await uploadResp.text();
        throw new Error(`Upload failed: ${uploadResp.status} – ${err}`);
      }
    },

    // Helper function to update deposition metadata
    _updateDepositionMetadata: async function(baseUrl, depositionId, metadata, params) {
      const metadataResponse = await fetch(`${baseUrl}/${depositionId}?${params}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      });
      if (!metadataResponse.ok) {
        const err = await metadataResponse.text();
        throw new Error(`Failed to set metadata: ${metadataResponse.status} – ${err}`);
      }
    },

    // Helper function to publish deposition
    _publishDeposition: async function(baseUrl, depositionId, params) {
      const publishResponse = await fetch(`${baseUrl}/${depositionId}/actions/publish?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!publishResponse.ok) {
        const err = await publishResponse.text();
        throw new Error(`Failed to publish: ${publishResponse.status} – ${err}`);
      }
      
      const publishedData = await publishResponse.json();
      return publishedData.doi;
    },

    // Function to create a new version of an existing Zenodo deposition
    _createNewVersionZenodoDeposition: async function(file, dataset, DataTitle) {
      // the token is in you ckan.ini or production.ini file in etc/lib/ckan
      const ACCESS_TOKEN = window.ZENODO_TOKEN; 
      const headers = {"Content-Type": "application/json"};
      // Used to pass the access token in the request
      const params = new URLSearchParams({ access_token: ACCESS_TOKEN }).toString();
      // Don't forget to remove the sandbox URL when you are ready to use it in production
      const baseUrl = 'https://sandbox.zenodo.org/api/deposit/depositions';

      let existingDepositionId = null;
      if (dataset.extras) {
          for (let extra of dataset.extras) {
            if (extra.key === 'doi') {
              // Extract numeric ID from DOI URL
              const match = extra.value.match(/zenodo\.(\d+)/);
              if (match) {
                existingDepositionId = match[1];
              }
              break;
            }
          }
        }

      if (!existingDepositionId) {
        throw new Error('No existing Zenodo deposition ID found in dataset');
      }

      // First, verify the existing deposition exists and get its current state
      const checkResponse = await fetch(`${baseUrl}/${existingDepositionId}?${params}`, {
        method: 'GET',
        headers: headers
      });
      
      if (!checkResponse.ok) {
        const err = await checkResponse.text();
        throw new Error(`Cannot access deposition ${existingDepositionId}: ${checkResponse.status} – ${err}`);
      }
      
      const existingData = await checkResponse.json();

      // Check if the deposition is published - this is required for creating new versions
      if (existingData.state !== 'done' && !existingData.published) {
        throw new Error(`Cannot create new version: deposition ${existingDepositionId} is not published yet. Current state: ${existingData.state}. Please publish the existing deposition first.`);
      }

      // Step 1: Create a new version of the existing deposition
      const newVersionResponse = await fetch(`${baseUrl}/${existingDepositionId}/actions/newversion?${params}`, {
        method: 'POST',
        headers: headers
      });
      
      if (!newVersionResponse.ok) {
        const err = await newVersionResponse.text();
        
        // More specific error handling
        if (newVersionResponse.status === 403) {
          throw new Error(`Access forbidden for deposition ${existingDepositionId}. This could mean:\n- The deposition doesn't belong to your account\n- The access token lacks permissions\n- The deposition is not published yet`);
        } else if (newVersionResponse.status === 404) {
          throw new Error(`Deposition ${existingDepositionId} not found`);
        } else if (newVersionResponse.status === 400) {
          throw new Error(`Bad request for deposition ${existingDepositionId}: ${err}`);
        } else {
          throw new Error(`Failed to create new version: ${newVersionResponse.status} – ${err}`);
        }
      }
      
      const newVersionData = await newVersionResponse.json();
      
      // The new version ID is in the latest_draft link
      if (!newVersionData.links || !newVersionData.links.latest_draft) {
        throw new Error('Invalid response from new version creation - missing latest_draft link');
      }
      
      const newDepositionId = newVersionData.links.latest_draft.split('/').pop();

      // Step 2: Get the new version deposition details to access the bucket
      const newDepositionResponse = await fetch(`${baseUrl}/${newDepositionId}?${params}`, {
        method: 'GET',
        headers: headers
      });
      
      if (!newDepositionResponse.ok) {
        throw new Error('Failed to get new version deposition details');
      }
      
      const newDepositionData = await newDepositionResponse.json();
      const bucket_url = newDepositionData.links.bucket;

      // Step 3: Upload the new file to the new version using the new Files API
      await this._uploadFileToBucket(bucket_url, file, DataTitle, params);

      // Step 4: Update metadata for the new version
      const metadata = this._prepareMetadata(dataset, DataTitle);
      await this._updateDepositionMetadata(baseUrl, newDepositionId, metadata, params);

      // Step 5: Publish the new version
      const doi = await this._publishDeposition(baseUrl, newDepositionId, params);
      
      return doi;
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
      await this._uploadFileToBucket(bucket_url, file, DataTitle, params);

      // Step 3: Add metadata
      const metadata = this._prepareMetadata(dataset, DataTitle);
      await this._updateDepositionMetadata(baseUrl, deposition_id, metadata, params);

      // Step 4: Publish the deposition
      const doi = await this._publishDeposition(baseUrl, deposition_id, params);
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

    _addExtraData: async function(extradata, dataset) {
      const ckanApiUrl = '/api/3/action/package_update';
      
      // Check if extras exist, if not stop the function
      if (!dataset.extras || !Array.isArray(dataset.extras)) {
        console.log('Dataset extras not found or invalid format, skipping extra data update');
        return;
      }

      // Define the keys that correspond to the extradata array elements
      const extraKeys = ['resource_type', 'data_interval'];
      
      // Process each element in the extradata array
      for (let i = 0; i < extradata.length && i < extraKeys.length; i++) {
        const key = extraKeys[i];
        const value = extradata[i];
        
        // Skip empty values
        if (!value) continue;
        
        // Check if this key already exists in the dataset extras
        let found = false;
        for (let extra of dataset.extras) {
          if (extra.key === key) {
            extra.value = value;
            found = true;
            break;
          }
        }
        // If not found, add it as a new extra
        if (!found) {
          dataset.extras.push({ key: key, value: value });
        }
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

    // Returns a list of tag names from the dataset, e.g. ["Keyword 1", "Keyword 2"]
    _FindTags: function(dataset) {
      if (!dataset || !Array.isArray(dataset.tags)) {
        return [];
      }
      // Extract the 'name' property from each tag object
      return dataset.tags.map(tag => tag.name);
    },


    _onClick: async function (event) {
      event.preventDefault(); // Important for preventing default form submission
      const $form = this.el.closest('form');
      const fileInput = $form.find('input[type="file"]')[0];

      const radio_resp = window.localStorage.getItem('want_doi') || 'no'; // Default to 'no' if not set
      const resourceType = window.localStorage.getItem('resource_type') || 'other'; // Default to 'other' if not set
      const dataInterval = window.localStorage.getItem('data_interval') || '';

      const extradata = [resourceType, dataInterval]

      const DataName = window.CKAN_PACKAGE_NAME;
      const getResp = await fetch(`/api/3/action/package_show?id=${DataName}`);
      const dataset = (await getResp.json()).result; // Get the dataset object from ckan
      const DataTitle = dataset.title || DataName;



      this._addExtraData(extradata, dataset); // Add resource type to the dataset

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
          try {
            if (this._DoiInDataset(dataset)) {
              console.log('This dataset already has a DOI.');
              const doi = await this._createNewVersionZenodoDeposition(file, dataset, DataTitle);
              await this._addDoiToCkanDataset(doi, dataset);
              $form.submit();
              
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

        window.localStorage.removeItem('want_doi'); // Clear the local storage item after use
        window.localStorage.removeItem('resource_type'); // Clear the resource type after use
        window.localStorage.removeItem('data_interval'); // Clear the data interval after use
      } else {
        $form.submit();
      }
    }
  };
});

