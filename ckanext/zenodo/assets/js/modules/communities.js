// ckanext/zenodo/assets/js/modules/communities.js
// Handles storing the communities list in localStorage and CKAN dataset extras

ckan.module('communities', function ($, _) {
    return {
        initialize: function () {
            const self = this;
            console.log('Communities module loaded', window.CKAN_PACKAGE_NAME);

            // Parse comma-separated communities string into a list
            function parseCommunitiesString(value) {
                if (!value || typeof value !== 'string') {
                    return [];
                }
                return value.split(',')
                    .map(community => community.trim())
                    .filter(community => community.length > 0);
            }

            // Convert communities list back to comma-separated string
            function formatCommunitiesString(communities) {
                if (!Array.isArray(communities)) {
                    return '';
                }
                return communities
                    .filter(community => community && community.trim().length > 0)
                    .map(community => community.trim())
                    .join(', ');
            }

            // Store communities in localStorage and broadcast change
            function storeCommunities(value) {
                const communities = parseCommunitiesString(value);
                window.localStorage.setItem('communities', JSON.stringify(communities));
                window.dispatchEvent(new Event('communities_changed'));
                console.log('Communities stored:', communities);
            }

            // Set the communities in the input element and localStorage
            function applyCommunities(value) {
                const communities = Array.isArray(value) ? value : parseCommunitiesString(value);
                const formattedValue = formatCommunitiesString(communities);
                self.el.val(formattedValue);
                storeCommunities(formattedValue);
            }

            // Update communities in hidden custom field and optionally submit the form
            function updateCommunitiesInDataset(communitiesValue, packageName, $form) {
                const communities = parseCommunitiesString(communitiesValue);
                const communitiesJson = JSON.stringify(communities);
                
                // Find the hidden input field for communities in the form
                let found = false;
                $form.find('input[type="hidden"]').each(function() {
                    const $keyInput = $(this);
                    if ($keyInput.attr('name') && $keyInput.attr('name').includes('key') && $keyInput.val() === 'communities') {
                        // Found the key input, now find the corresponding value input
                        const keyName = $keyInput.attr('name');
                        const valueName = keyName.replace('key', 'value');
                        const $valueInput = $form.find(`input[name="${valueName}"]`);
                        if ($valueInput.length > 0) {
                            $valueInput.val(communitiesJson);
                            found = true;
                            console.log('Communities updated in hidden field:', communities);
                            return false; // Break out of the each loop
                        }
                    }
                });

                // If not found, add new hidden fields for communities
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
                    
                    // Add hidden fields for the new communities extra
                    $('<input>').attr({
                        type: 'hidden',
                        name: prefix + 'key',
                        value: 'communities'
                    }).appendTo($form);
                    
                    $('<input>').attr({
                        type: 'hidden',
                        name: prefix + 'value',
                        value: communitiesJson
                    }).appendTo($form);
                    
                    $('<input>').attr({
                        type: 'hidden',
                        name: prefix + 'deleted',
                        value: ''
                    }).appendTo($form);
                    
                    console.log('Communities added as new hidden field:', communities);
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

            // Validate communities input
            function validateCommunities(value) {
                const communities = parseCommunitiesString(value);
                const errors = [];
                
                // Check for duplicate communities
                const uniqueCommunities = [...new Set(communities.map(c => c.toLowerCase()))];
                if (uniqueCommunities.length !== communities.length) {
                    errors.push('Duplicate communities found');
                }
                
                // Check for invalid characters (basic validation)
                communities.forEach(community => {
                    if (community.length > 50) {
                        errors.push(`Community name too long: ${community}`);
                    }
                    if (!/^[a-zA-Z0-9\s\-_\.\/]+$/.test(community)) {
                        errors.push(`Invalid characters in community: ${community}`);
                    }
                });
                
                return errors;
            }

            // Listen for changes in the input element
            this.el.on('input change', function () {
                const value = self.el.val();
                const errors = validateCommunities(value);
                
                // Display validation errors if any
                const $errorBlock = self.el.siblings('.error-block');
                if (errors.length > 0) {
                    if ($errorBlock.length === 0) {
                        $('<span class="error-block"></span>').insertAfter(self.el);
                    }
                    self.el.siblings('.error-block').text(errors.join(', '));
                } else {
                    $errorBlock.remove();
                    storeCommunities(value);
                }
            });

            // Set initial value from localStorage or CKAN extras
            const storedValue = window.localStorage.getItem('communities');
            let storedCommunities = [];
            
            if (storedValue) {
                try {
                    storedCommunities = JSON.parse(storedValue);
                } catch (e) {
                    console.error('Error parsing stored communities:', e);
                }
            }

            if (window.CKAN_PACKAGE_NAME) {
                // Always try to fetch from CKAN extras first
                fetch(`/api/3/action/package_show?id=${window.CKAN_PACKAGE_NAME}`)
                    .then(resp => resp.json())
                    .then(data => {
                        let foundValue = null;
                        if (data && data.result && data.result.extras) {
                            const extras = data.result.extras;
                            const found = extras.find(e => e.key === 'communities' && e.value);
                            if (found) {
                                try {
                                    foundValue = JSON.parse(found.value);
                                } catch (e) {
                                    // If JSON parsing fails, treat as comma-separated string
                                    foundValue = parseCommunitiesString(found.value);
                                }
                            }
                        }
                        if (foundValue && foundValue.length > 0) {
                            applyCommunities(foundValue);
                        } else if (storedCommunities.length > 0) {
                            applyCommunities(storedCommunities);
                        } else if (self.el.val()) {
                            storeCommunities(self.el.val());
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching package data:', error);
                        if (storedCommunities.length > 0) {
                            applyCommunities(storedCommunities);
                        } else if (self.el.val()) {
                            storeCommunities(self.el.val());
                        }
                    });
            } else if (storedCommunities.length > 0) {
                applyCommunities(storedCommunities);
            } else if (self.el.val()) {
                storeCommunities(self.el.val());
            }

            // Add click event for update dataset button
            $(document).on('click', 'button[name="save"]', function(e) {
                // Only run if the button text is "Update Dataset"
                if ($(this).text().trim() === 'Update Dataset' && window.CKAN_PACKAGE_NAME) {
                    const communitiesValue = self.el.val();
                    const errors = validateCommunities(communitiesValue);
                    
                    if (errors.length > 0) {
                        e.preventDefault(); // Prevent form submission if there are errors
                        alert('Please fix the following errors:\n' + errors.join('\n'));
                        return;
                    }
                    
                    e.preventDefault(); // Prevent default form submission
                    const $form = $(this).closest('form');
                    updateCommunitiesInDataset(communitiesValue, window.CKAN_PACKAGE_NAME, $form);
                    window.localStorage.removeItem('communities'); // Clear the communities after use
                }
            });
        }
    };
});
