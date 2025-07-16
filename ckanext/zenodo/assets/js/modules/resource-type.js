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

            // Update resource_type in hidden custom field and optionally submit the form
            function updateResourceTypeInDataset(resourceType, packageName, $form) {
                // Find the hidden input field for resource_type in the form
                let found = false;
                $form.find('input[type="hidden"]').each(function() {
                    const $keyInput = $(this);
                    if ($keyInput.attr('name') && $keyInput.attr('name').includes('key') && $keyInput.val() === 'resource_type') {
                        // Found the key input, now find the corresponding value input
                        const keyName = $keyInput.attr('name');
                        const valueName = keyName.replace('key', 'value');
                        const $valueInput = $form.find(`input[name="${valueName}"]`);
                        if ($valueInput.length > 0) {
                            $valueInput.val(resourceType);
                            found = true;
                            console.log('Resource type updated in hidden field:', resourceType);
                            return false; // Break out of the each loop
                        }
                    }
                });

                // If not found, add new hidden fields for resource_type
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
                    
                    // Add hidden fields for the new resource_type extra
                    $('<input>').attr({
                        type: 'hidden',
                        name: prefix + 'key',
                        value: 'resource_type'
                    }).appendTo($form);
                    
                    $('<input>').attr({
                        type: 'hidden',
                        name: prefix + 'value',
                        value: resourceType
                    }).appendTo($form);
                    
                    $('<input>').attr({
                        type: 'hidden',
                        name: prefix + 'deleted',
                        value: ''
                    }).appendTo($form);
                    
                    console.log('Resource type added as new hidden field:', resourceType);
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
            let usedValue = null;

            if (window.CKAN_PACKAGE_NAME) {
                // Always try to fetch from CKAN extras first
                fetch(`/api/3/action/package_show?id=${window.CKAN_PACKAGE_NAME}`)
                    .then(resp => resp.json())
                    .then(data => {
                        let foundValue = null;
                        if (data && data.result && data.result.extras) {
                            const extras = data.result.extras;
                            const found = extras.find(e => e.key === 'resource_type' && e.value);
                            if (found && self.el.find('option[value="' + found.value + '"]').length) {
                                foundValue = found.value;
                            }
                        }
                        if (foundValue) {
                            applyResourceType(foundValue);
                        } else if (storedValue && self.el.find('option[value="' + storedValue + '"]').length) {
                            applyResourceType(storedValue);
                        } else if (self.el.val()) {
                            storeResourceType(self.el.val());
                        }
                    });
            } else if (storedValue && self.el.find('option[value="' + storedValue + '"]').length) {
                applyResourceType(storedValue);
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
                    // window.localStorage.removeItem('want_doi'); // Clear the local storage item after use
                    window.localStorage.removeItem('resource_type'); // Clear the resource type after use
                }
            });
        }
    };
});
