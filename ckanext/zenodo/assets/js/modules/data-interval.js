// ckanext/zenodo/assets/js/modules/data-interval.js
// Handles storing the data interval in localStorage and CKAN dataset extras

ckan.module('data-interval', function ($, _) {
    return {
        initialize: function () {
            const self = this;
            console.log('Data Interval module loaded', window.CKAN_PACKAGE_NAME);

            // Store data interval in localStorage and broadcast change
            function storeDataInterval(value) {
                window.localStorage.setItem('data_interval', value);
                window.dispatchEvent(new Event('data_interval_changed'));
                console.log('Data interval stored:', value);
            }

            // Set the data interval in the input element and localStorage
            function applyDataInterval(value) {
                self.el.val(value);
                storeDataInterval(value);
            }

            // Update data_intervalle in CKAN dataset extras and optionally submit the form
            async function updateDataIntervalInDataset(dataInterval, packageName, $form) {
                // Fetch dataset
                const getResp = await fetch(`/api/3/action/package_show?id=${packageName}`);
                const dataset = (await getResp.json()).result;
                dataset.extras = dataset.extras || [];

                // Update or add data_intervalle in extras
                let found = false;
                for (let extra of dataset.extras) {
                    if (extra.key === 'data_interval') {
                        extra.value = dataInterval;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    dataset.extras.push({ key: 'data_interval', value: dataInterval });
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
                    console.log('Failed to update data_interval in extras');
                } else {
                    console.log('Data interval saved to dataset!');
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

            // Listen for changes in the input element
            this.el.on('input change', function () {
                storeDataInterval(self.el.val());
            });

            // Set initial value from localStorage or CKAN extras
            const storedValue = window.localStorage.getItem('data_interval');
            let initialValue = storedValue;

            if (!initialValue && window.CKAN_PACKAGE_NAME) {
                // Try to fetch from CKAN extras if not in localStorage
                fetch(`/api/3/action/package_show?id=${window.CKAN_PACKAGE_NAME}`)
                    .then(resp => resp.json())
                    .then(data => {
                        if (data && data.result && data.result.extras) {
                            const extras = data.result.extras;
                            const found = extras.find(e => e.key === 'data_interval' && e.value);
                            if (found) {
                                applyDataInterval(found.value);
                            }
                        }
                    });
            } else if (initialValue) {
                applyDataInterval(initialValue);
            } else if (self.el.val()) {
                storeDataInterval(self.el.val());
            }

            // Add click event for update dataset button
            $(document).on('click', 'button[name="save"]', function(e) {
                // Only run if the button text is "Update Dataset"
                if ($(this).text().trim() === 'Update Dataset' && window.CKAN_PACKAGE_NAME) {
                    e.preventDefault(); // Prevent default form submission
                    const dataInterval = self.el.val();
                    const $form = $(this).closest('form');
                    updateDataIntervalInDataset(dataInterval, window.CKAN_PACKAGE_NAME, $form);
                    window.localStorage.removeItem('data_interval'); // Clear the data interval after use
                }
            });
        }
    };
});
