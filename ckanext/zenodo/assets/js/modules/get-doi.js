ckan.module('get-doi', function ($, _) {
  return {
    initialize: function () {
      this.el.on('click', this._onClick.bind(this));
    },

    _onClick: async function (event) {
      event.preventDefault();

      const $form = this.el.closest('form');
      const fileInput = $form.find('input[type="file"]')[0];

      if (fileInput && fileInput.files.length > 0) {

        const file = fileInput.files[0];

        // Get the description from the form
        const description = $form.find('textarea[name="description"]').val() || '';

        try {
          const ACCESS_TOKEN = window.ZENODO_TOKEN;
          const headers = {"Content-Type": "application/json"};
          const params = new URLSearchParams({ access_token: ACCESS_TOKEN }).toString();

          // remove the sandbox in the url when deploying to production and change the access token
          const baseUrl = 'https://sandbox.zenodo.org/api/deposit/depositions';

          // Step 1: Create a deposition
          const response = await fetch(`${baseUrl}?${params}`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({})  // Empty JSON body 
          });

          const data = await response.json();
          console.log("oui", data);

          const bucket_url = data.links.bucket;
          const deposition_id = data.id; // the DOI

          // Step 2: Upload the file
          const uploadResp = await fetch(
            `${bucket_url}/${encodeURIComponent(file.name)}?access_token=${ACCESS_TOKEN}`,
            {
              method : 'PUT',
              headers: { 'Content-Type': 'application/octet-stream' },
              body : file // File is already a Blob – no FileReader needed
            }
          );

          if (!uploadResp.ok) {
            const err = await uploadResp.text();
            throw new Error(`Upload failed: ${uploadResp.status} – ${err}`);
          }

          // Step 3: Add metadata (optional but needed to publish)
          const metadata = {
            metadata: {
              title: `CKAN-${file.name}`,
              upload_type: 'dataset',
              description: description || 'No description provided',
              creators: [{ name: 'GeoEcomar', affiliation: 'GeoEcomar' }]
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
          console.log('Metadata updated');


          // Step 4: Publish the deposition
          const publishResponse = await fetch(`${baseUrl}/${deposition_id}/actions/publish?${params}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          });

          const publishedData = await publishResponse.json();
          const doi = publishedData.doi;

          console.log('Deposition published. DOI:', doi);


          console.log('Dataset Name:', window.CKAN_PACKAGE_NAME);
          // Name of the current dataset
          const datasetId = window.CKAN_PACKAGE_NAME;
          // const datasetId = 'aaa';

          const ckanApiUrl = '/api/3/action/package_update';

          // Get the current dataset metadata
          const getResp = await fetch(`/api/3/action/package_show?id=${datasetId}`);
          const dataset = (await getResp.json()).result;

          console.log('Dataset to update:', dataset);

          // Add or update the DOI in extras
          let found = false;
          dataset.extras = dataset.extras || [];
          for (let extra of dataset.extras) {
            if (extra.key === 'doi') {
              extra.value = doi;
              found = true;
              break;
            }
          }
          if (!found) {
            dataset.extras.push({ key: 'doi', value: doi });
          }

          // Remove forbidden fields that CKAN does not accept in package_update
          const forbidden = [
            'tracking_summary', 'num_resources', 'num_tags',
            'metadata_modified', 'metadata_created', 'isopen', 'revision_id',
            'state', 'relationships_as_object', 'relationships_as_subject'
          ];
          for (const k of forbidden) delete dataset[k];

          // Now update the dataset with the full object
          const payload = dataset;

          console.log('Updated dataset with DOI:', dataset);
          console.log('payload', JSON.stringify(payload));


          // Get the csrf value from the page meta tag
          const csrf_value = $('meta[name=_csrf_token]').attr('content')

          
          const updateResp = await fetch(ckanApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': window.CKAN_TOKEN,
              'X-CSRF-Token': csrf_value,
              // 'Authorization': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJENTRZZ285dkVReThYTEZWbEdMZDlGTkdSeEZfOVJyUzVlWmZybW5VbmJNIiwiaWF0IjoxNzUxMzU2NDMwfQ.sB0d937Tu9OU0xau2EvUvYKNGd8FEIkHkkbd9_NGbig'
            },
            body: JSON.stringify(payload)
          });

          if (!updateResp.ok) {
            alert('Failed to update dataset with DOI');
          } else {
            alert('DOI saved to dataset!');
          }
          

          alert('DOI created: ' + doi);

          
        }catch (error) {
          console.error('Error uploading file to Zenodo:', error);
          alert('Error uploading file to Zenodo: ' + error.message);
          return;
        }
      }
      
    }
  };
});

