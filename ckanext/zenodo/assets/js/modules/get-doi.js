ckan.module('get-doi', function ($, _) {
  return {
    initialize: function () {
      this.el.on('click', this._onClick.bind(this));
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
              console.log('Found DOI in dataset:', extra.value);
              // Extract numeric ID from DOI URL
              const match = extra.value.match(/zenodo\.(\d+)/);
              if (match) {
                existingDepositionId = match[1];
                console.log('Extracted Zenodo deposition ID:', existingDepositionId);
              }
              break;
            }
          }
        }

      if (!existingDepositionId) {
        throw new Error('No existing Zenodo deposition ID found in dataset');
      }

      // First, verify the existing deposition exists and get its current state
      console.log(`Checking existing deposition ${existingDepositionId}...`);
      const checkResponse = await fetch(`${baseUrl}/${existingDepositionId}?${params}`, {
        method: 'GET',
        headers: headers
      });
      
      if (!checkResponse.ok) {
        const err = await checkResponse.text();
        console.error('Failed to get existing deposition:', err);
        throw new Error(`Cannot access deposition ${existingDepositionId}: ${checkResponse.status} – ${err}`);
      }
      
      const existingData = await checkResponse.json();
      console.log('Existing deposition state:', existingData.state);
      console.log('Existing deposition submitted:', existingData.submitted);
      console.log('Existing deposition published:', existingData.published);

      // Check if the deposition is published - this is required for creating new versions
      if (existingData.state !== 'done' && !existingData.published) {
        throw new Error(`Cannot create new version: deposition ${existingDepositionId} is not published yet. Current state: ${existingData.state}. Please publish the existing deposition first.`);
      }

      // Step 1: Create a new version of the existing deposition
      console.log(`Creating new version of deposition ${existingDepositionId}...`);
      const newVersionUrl = `${baseUrl}/${existingDepositionId}/actions/newversion?${params}`;
      console.log('New version URL:', newVersionUrl);
      
      const newVersionResponse = await fetch(newVersionUrl, {
        method: 'POST',
        headers: headers
      });
      
      console.log('New version response status:', newVersionResponse.status);
      console.log('New version response headers:', Object.fromEntries(newVersionResponse.headers.entries()));
      
      if (!newVersionResponse.ok) {
        const err = await newVersionResponse.text();
        console.error('New version creation failed:', err);
        
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
      console.log('New version response data:', newVersionData);
      
      // The new version ID is in the latest_draft link
      if (!newVersionData.links || !newVersionData.links.latest_draft) {
        console.error('No latest_draft link found in response:', newVersionData);
        throw new Error('Invalid response from new version creation - missing latest_draft link');
      }
      
      const newDepositionId = newVersionData.links.latest_draft.split('/').pop();
      console.log('Created new version with ID:', newDepositionId);

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

      console.log('New version bucket URL:', bucket_url);
      console.log('New version files:', newDepositionData.files);

      // Step 3: Upload the new file to the new version using the new Files API
      const uploadResp = await fetch(
        `${bucket_url}/${encodeURIComponent(DataTitle)}?${params}`,
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

      console.log('File uploaded successfully');

      // Step 4: Update metadata for the new version
      let resourceType = window.localStorage.getItem('resource_type') || 'other';

      let type_list = resourceType.split('/');
      let pubType = "";
      let imgType = "";
      if (type_list.length > 1) {
        resourceType = type_list[0];
        if (resourceType ==='publication') {
          pubType = type_list[1];
        }
        if (resourceType === 'image') {
          imgType = type_list[1];
        }
      }

      const tags = this._FindTags(dataset);

      const metadata = {
        metadata: {
          title: `${DataTitle}`,
          upload_type: `${resourceType}`,
          publication_type: pubType || '',
          image_type: imgType || '',
          keywords: tags,
          description: dataset.notes || 'No description provided',
          creators: [{ name: dataset.author || 'GeoEcomar', affiliation: dataset.organization.name || '' }],
          access_right: this._GetAccessRights(dataset),
        }
      };
      
      const metadataResponse = await fetch(`${baseUrl}/${newDepositionId}?${params}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      });
      if (!metadataResponse.ok) {
        const err = await metadataResponse.text();
        throw new Error(`Failed to set metadata for new version: ${metadataResponse.status} – ${err}`);
      }

      console.log('Metadata updated successfully');

      // Step 5: Publish the new version
      const publishResponse = await fetch(`${baseUrl}/${newDepositionId}/actions/publish?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!publishResponse.ok) {
        const err = await publishResponse.text();
        throw new Error(`Failed to publish new version: ${publishResponse.status} – ${err}`);
      }
      
      const publishedData = await publishResponse.json();
      const doi = publishedData.doi;
      
      console.log('New version published with DOI:', doi);
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
      let resourceType = window.localStorage.getItem('resource_type') || 'other';

      let type_list = resourceType.split('/');
      let pubType = "";
      let imgType = "";
      if (type_list.length > 1) {
        resourceType = type_list[0];
        if (resourceType ==='publication') {
          pubType = type_list[1];
        }
        if (resourceType === 'image') {
          imgType = type_list[1];
        }
      }

      const tags = this._FindTags(dataset);

      const metadata = {
        metadata: {
          title: `${DataTitle}`,
          upload_type: `${resourceType}`,
          publication_type: pubType || '',
          image_type: imgType || '',
          keywords: tags,
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

    _addResourceType: async function(type, dataset) {
      const ckanApiUrl = '/api/3/action/package_update';
      dataset.extras = dataset.extras || [];

      // Check if the DOI already exists in the dataset
      let found = false;
      for (let extra of dataset.extras) {
        if (extra.key === `resource_type`) {
          extra.value = type;
          found = true;
          break;
        }
      }
      if (!found) {
        dataset.extras.push({ key: `resource_type`, value: type });
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
      
      const DataTitle = window.CKAN_PACKAGE_NAME;
      const getResp = await fetch(`/api/3/action/package_show?id=${DataTitle}`);
      const dataset = (await getResp.json()).result; // Get the dataset object from ckan



      this._addResourceType(resourceType, dataset); // Add resource type to the dataset

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
              // new function to call here
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
      } else {
        $form.submit();
      }
    }
  };
});

