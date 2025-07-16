// ckanext/zenodo/assets/js/modules/contributor.js
// Handles storing contributor data (name + role) in localStorage and CKAN dataset extras

ckan.module('contributor', function ($, _) {
    return {
        initialize: function () {
            const self = this;
            console.log('Contributor module loaded', window.CKAN_PACKAGE_NAME);

            // Store contributor data in localStorage and broadcast change
            function storeContributorData(value) {
                window.localStorage.setItem('contributor', value);
                window.dispatchEvent(new Event('contributor_changed'));
                console.log('Contributor data stored:', value);
            }

            // Collect all contributor name and role pairs and combine them into JSON array
            function collectContributorData() {
                const contributors = [];
                
                // Loop through the 3 contributor fields (0, 1, 2)
                for (let i = 0; i < 3; i++) {
                    const nameField = $(`#field-contributor-name-${i}`);
                    const roleField = $(`#field-contributor-role-${i}`);
                    
                    const name = nameField.val() ? nameField.val().trim() : '';
                    const role = roleField.val() ? roleField.val().trim() : '';
                    
                    // Only add if both name and role are provided
                    if (name && role) {
                        contributors.push(`${name} / ${role}`);
                    }
                }
                
                return contributors.length > 0 ? JSON.stringify(contributors) : '';
            }

            // Apply contributor data from stored JSON array value
            function applyContributorData(value) {
                if (!value) return;
                
                try {
                    // Parse the JSON array
                    const contributors = JSON.parse(value);
                    
                    contributors.forEach((contributor, index) => {
                        if (index < 3) { // Only apply to the 3 available fields
                            const parts = contributor.split(' / ');
                            if (parts.length === 2) {
                                const name = parts[0].trim();
                                const role = parts[1].trim();
                                
                                $(`#field-contributor-name-${index}`).val(name);
                                $(`#field-contributor-role-${index}`).val(role);
                            }
                        }
                    });
                } catch (e) {
                    console.warn('Failed to parse contributor data:', e);
                    // Fallback: try to parse as old format (semicolon-separated)
                    const contributors = value.split('; ');
                    
                    contributors.forEach((contributor, index) => {
                        if (index < 3) {
                            const parts = contributor.split(' / ');
                            if (parts.length === 2) {
                                const name = parts[0].trim();
                                const role = parts[1].trim();
                                
                                $(`#field-contributor-name-${index}`).val(name);
                                $(`#field-contributor-role-${index}`).val(role);
                            }
                        }
                    });
                }
                
                storeContributorData(value);
            }

            // Update contributor in hidden custom field and optionally submit the form
            function updateContributorInDataset(contributorData, packageName, $form) {
                // Find the hidden input field for contributor in the form
                let found = false;
                $form.find('input[type="hidden"]').each(function() {
                    const $keyInput = $(this);
                    if ($keyInput.attr('name') && $keyInput.attr('name').includes('key') && $keyInput.val() === 'contributor') {
                        // Found the key input, now find the corresponding value input
                        const keyName = $keyInput.attr('name');
                        const valueName = keyName.replace('key', 'value');
                        const $valueInput = $form.find(`input[name="${valueName}"]`);
                        if ($valueInput.length > 0) {
                            $valueInput.val(contributorData);
                            found = true;
                            console.log('Contributor data updated in hidden field:', contributorData);
                            return false; // Break out of the each loop
                        }
                    }
                });

                // If not found, add new hidden fields for contributor
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
                    
                    // Add hidden fields for the new contributor extra
                    $('<input>').attr({
                        type: 'hidden',
                        name: prefix + 'key',
                        value: 'contributor'
                    }).appendTo($form);
                    
                    $('<input>').attr({
                        type: 'hidden',
                        name: prefix + 'value',
                        value: contributorData
                    }).appendTo($form);
                    
                    $('<input>').attr({
                        type: 'hidden',
                        name: prefix + 'deleted',
                        value: ''
                    }).appendTo($form);
                    
                    console.log('Contributor data added as new hidden field:', contributorData);
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

            // Listen for changes in any contributor name or role field
            $(document).on('input change', 'input[id^="field-contributor-name-"], select[id^="field-contributor-role-"]', function () {
                const contributorData = collectContributorData();
                storeContributorData(contributorData);
            });

            // Set initial value from localStorage or CKAN extras
            const storedValue = window.localStorage.getItem('contributor');

            if (window.CKAN_PACKAGE_NAME) {
                // Always try to fetch from CKAN extras first
                fetch(`/api/3/action/package_show?id=${window.CKAN_PACKAGE_NAME}`)
                    .then(resp => resp.json())
                    .then(data => {
                        let foundValue = null;
                        if (data && data.result && data.result.extras) {
                            const extras = data.result.extras;
                            const found = extras.find(e => e.key === 'contributor' && e.value);
                            if (found) {
                                foundValue = found.value;
                            }
                        }
                        if (foundValue) {
                            applyContributorData(foundValue);
                        } else if (storedValue) {
                            applyContributorData(storedValue);
                        } else {
                            // Store current state if any fields already have values
                            const currentData = collectContributorData();
                            if (currentData) {
                                storeContributorData(currentData);
                            }
                        }
                    });
            } else if (storedValue) {
                applyContributorData(storedValue);
            } else {
                // Store current state if any fields already have values
                const currentData = collectContributorData();
                if (currentData) {
                    storeContributorData(currentData);
                }
            }

            // Add click event for update dataset button
            $(document).on('click', 'button[name="save"]', function(e) {
                // Only run if the button text is "Update Dataset"
                if ($(this).text().trim() === 'Update Dataset' && window.CKAN_PACKAGE_NAME) {
                    e.preventDefault(); // Prevent default form submission
                    const contributorData = collectContributorData();
                    const $form = $(this).closest('form');
                    updateContributorInDataset(contributorData, window.CKAN_PACKAGE_NAME, $form);
                    window.localStorage.removeItem('contributor'); // Clear the contributor data after use
                }
            });
        }
    };
});
