// ckanext/zenodo/assets/js/modules/resource-type.js
// Handles storing the selected resource type in localStorage and broadcasting changes


// CKAN Resource Type Module
// Handles storing the selected resource type in localStorage and updating CKAN dataset extras

ckan.module('resource-type', function ($, _) {
    return {
        initialize: function () {
            const self = this;
            console.log('Resource Type module loaded', window.CKAN_PACKAGE_NAME);

            // Store resource type in localStorage and broadcast change
            function storeResourceType(value) {
                window.localStorage.setItem('resource_type', value);
                window.dispatchEvent(new Event('resource_type_changed'));
                console.log('Resource type stored:', value);
            }

            // Set the resource type in the select element and localStorage
            function applyResourceType(value) {
                self.el.val(value);
                self.el.find('option[value=""]').remove();
                self.el.trigger('change'); // Force redraw
                storeResourceType(value);
            }

            // Update resource_type in CKAN dataset extras and optionally submit the form
            async function updateResourceTypeInDataset(resourceType, packageName, $form) {
                // Fetch dataset
                const getResp = await fetch(`/api/3/action/package_show?id=${packageName}`);
                const dataset = (await getResp.json()).result;
                dataset.extras = dataset.extras || [];

                // Update or add resource_type in extras
                let found = false;
                for (let extra of dataset.extras) {
                    if (extra.key === 'resource_type') {
                        extra.value = resourceType;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    dataset.extras.push({ key: 'resource_type', value: resourceType });
                }

                // Remove forbidden fields
                const forbidden = [
                    'tracking_summary', 'num_resources', 'num_tags',
                    'metadata_modified', 'metadata_created', 'isopen', 'revision_id',
                    'state', 'relationships_as_object', 'relationships_as_subject'
                ];
                forbidden.forEach(k => delete dataset[k]);

                // Add CSRF token for security
                const csrf_value = $('meta[name=_csrf_token]').attr('content');
                const updateResp = await fetch('/api/3/action/package_update', {
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
                    console.log('Failed to update resource_type in extras');
                } else {
                    console.log('Resource type saved to dataset!');
                }

                // If form element is provided, submit after update
                if ($form) {
                    if ($form.find('input[name="save"]').length === 0) {
                        $('<input>').attr({
                            type: 'hidden',
                            name: 'save',
                            value: 'go-metadata'
                        }).appendTo($form);
                    }
                    $form.submit();
                }
            }

            // Listen for changes in the select element
            this.el.on('change', function () {
                storeResourceType(self.el.val());
            });

            // Set initial value from localStorage or CKAN extras
            const storedValue = window.localStorage.getItem('resource_type');
            let initialValue = storedValue;

            if (!initialValue && window.CKAN_PACKAGE_NAME) {
                // Try to fetch from CKAN extras if not in localStorage
                fetch(`/api/3/action/package_show?id=${window.CKAN_PACKAGE_NAME}`)
                    .then(resp => resp.json())
                    .then(data => {
                        if (data && data.result && data.result.extras) {
                            const extras = data.result.extras;
                            const found = extras.find(e => e.key === 'resource_type' && e.value);
                            if (found && self.el.find('option[value="' + found.value + '"]').length) {
                                applyResourceType(found.value);
                            }
                        }
                    });
            } else if (initialValue && self.el.find('option[value="' + initialValue + '"]').length) {
                applyResourceType(initialValue);
            } else if (self.el.val()) {
                storeResourceType(self.el.val());
            }

            // Add click event for update dataset button
            $(document).on('click', 'button[name="save"]', function(e) {
                // Only run if the button text is "Update Dataset"
                if ($(this).text().trim() === 'Update Dataset' && window.CKAN_PACKAGE_NAME) {
                    e.preventDefault(); // Prevent default form submission
                    const resourceType = self.el.val();
                    const $form = $(this).closest('form');
                    updateResourceTypeInDataset(resourceType, window.CKAN_PACKAGE_NAME, $form);
                    window.localStorage.removeItem('want_doi'); // Clear the local storage item after use
                    window.localStorage.removeItem('resource_type'); // Clear the resource type after use
                }
            });
        }
    };
});
