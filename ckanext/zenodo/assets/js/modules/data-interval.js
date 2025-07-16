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

            // Update data_interval in hidden custom field and optionally submit the form
            function updateDataIntervalInDataset(dataInterval, packageName, $form) {
                // Find the hidden input field for data_interval in the form
                let found = false;
                $form.find('input[type="hidden"]').each(function() {
                    const $keyInput = $(this);
                    if ($keyInput.attr('name') && $keyInput.attr('name').includes('key') && $keyInput.val() === 'data_interval') {
                        // Found the key input, now find the corresponding value input
                        const keyName = $keyInput.attr('name');
                        const valueName = keyName.replace('key', 'value');
                        const $valueInput = $form.find(`input[name="${valueName}"]`);
                        if ($valueInput.length > 0) {
                            $valueInput.val(dataInterval);
                            found = true;
                            console.log('Data interval updated in hidden field:', dataInterval);
                            return false; // Break out of the each loop
                        }
                    }
                });

                // If not found, add new hidden fields for data_interval
                if (!found) {
                    // Find the highest extras index to append new fields
                    let highestIndex = -1;
                    $form.find('input').each(function() {
                        const name = $(this).attr('name');
                        if (name && name.startsWith('extras__') && (name.includes('__key') || name.includes('__value') || name.includes('__deleted'))) {
                            const match = name.match(/extras__(\d+)__/);
                            if (match) {
                                const index = parseInt(match[1]);
                                if (index > highestIndex) {
                                    highestIndex = index;
                                }
                            }
                        }
                    });

                    const newIndex = highestIndex + 1;
                    const prefix = `extras__${newIndex}__`;
                    
                    // Add hidden fields for the new data_interval extra
                    $('<input>').attr({
                        type: 'hidden',
                        name: prefix + 'key',
                        value: 'data_interval'
                    }).appendTo($form);
                    
                    $('<input>').attr({
                        type: 'hidden',
                        name: prefix + 'value',
                        value: dataInterval
                    }).appendTo($form);
                    
                    $('<input>').attr({
                        type: 'hidden',
                        name: prefix + 'deleted',
                        value: ''
                    }).appendTo($form);
                    
                    console.log('Data interval added as new hidden field:', dataInterval);
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

            if (window.CKAN_PACKAGE_NAME) {
                // Always try to fetch from CKAN extras first
                fetch(`/api/3/action/package_show?id=${window.CKAN_PACKAGE_NAME}`)
                    .then(resp => resp.json())
                    .then(data => {
                        let foundValue = null;
                        if (data && data.result && data.result.extras) {
                            const extras = data.result.extras;
                            const found = extras.find(e => e.key === 'data_interval' && e.value);
                            if (found) {
                                foundValue = found.value;
                            }
                        }
                        if (foundValue) {
                            applyDataInterval(foundValue);
                        } else if (storedValue) {
                            applyDataInterval(storedValue);
                        } else if (self.el.val()) {
                            storeDataInterval(self.el.val());
                        }
                    });
            } else if (storedValue) {
                applyDataInterval(storedValue);
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
