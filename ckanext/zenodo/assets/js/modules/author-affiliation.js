// Handles storing the author affiliations list in localStorage and CKAN dataset extras

ckan.module('author-affiliation', function ($, _) {
    return {
        initialize: function () {
            const self = this;
            console.log('Author Affiliation module loaded', window.CKAN_PACKAGE_NAME);

            // Parse comma-separated author affiliations string into a list
            function parseAuthorAffiliationsString(value) {
                if (!value || typeof value !== 'string') {
                    return [];
                }
                return value.split(',')
                    .map(affil => affil.trim());
            }

            // Convert author affiliations list back to comma-separated string
            function formatAuthorAffiliationsString(affils) {
                if (!Array.isArray(affils)) {
                    return '';
                }
                return affils
                    .map(affil => affil.trim())
                    .join(', ');
            }

            // Store author affiliations in localStorage and broadcast change
            function storeAuthorAffiliations(value) {
                const affils = parseAuthorAffiliationsString(value);
                window.localStorage.setItem('author_affiliations', JSON.stringify(affils));
                window.dispatchEvent(new Event('author_affiliations_changed'));
                console.log('Author affiliations stored:', affils);
            }

            // Set the author affiliations in the input element and localStorage
            function applyAuthorAffiliations(value) {
                const affils = Array.isArray(value) ? value : parseAuthorAffiliationsString(value);
                const formattedValue = formatAuthorAffiliationsString(affils);
                self.el.val(formattedValue);
                storeAuthorAffiliations(formattedValue);
            }

            // Update author affiliations in hidden custom field and optionally submit the form
            function updateAuthorAffiliationsInDataset(affilsValue, packageName, $form) {
                const affils = parseAuthorAffiliationsString(affilsValue);
                const affilsJson = JSON.stringify(affils);

                // Find the hidden input field for author_affiliation in the form
                let found = false;
                $form.find('input[type="hidden"]').each(function() {
                    const $keyInput = $(this);
                    if ($keyInput.attr('name') && $keyInput.attr('name').includes('key') && $keyInput.val() === 'author_affiliations') {
                        // Found the key input, now find the corresponding value input
                        const keyName = $keyInput.attr('name');
                        const valueName = keyName.replace('key', 'value');
                        const $valueInput = $form.find(`input[name="${valueName}"]`);
                        if ($valueInput.length > 0) {
                            $valueInput.val(affilsJson);
                            found = true;
                            console.log('Author affiliations updated in hidden field:', affils);
                            return false; // Break out of the each loop
                        }
                    }
                });

                // If not found, add new hidden fields for author_affiliation
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

                    // Add hidden fields for the new author_affiliation extra
                    $('<input>').attr({
                        type: 'hidden',
                        name: prefix + 'key',
                        value: 'author_affiliations'
                    }).appendTo($form);

                    $('<input>').attr({
                        type: 'hidden',
                        name: prefix + 'value',
                        value: affilsJson
                    }).appendTo($form);

                    $('<input>').attr({
                        type: 'hidden',
                        name: prefix + 'deleted',
                        value: ''
                    }).appendTo($form);

                    console.log('Author affiliations added as new hidden field:', affils);
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

            // Validate author affiliations input
            function validateAuthorAffiliations(value) {
                const affils = parseAuthorAffiliationsString(value);
                const errors = [];

                // Check for invalid characters (basic validation)
                affils.forEach(affil => {
                    if (affil === '') {
                        // Allow empty affiliations, skip validation
                        return;
                    }
                    if (affil.length > 100) {
                        errors.push(`Author affiliation too long: ${affil}`);
                    }
                    if (!/^[a-zA-Z0-9\s\-_\.\/,]+$/.test(affil)) {
                        errors.push(`Invalid characters in author affiliation: ${affil}`);
                    }
                });

                return errors;
            }

            // Listen for changes in the input element
            this.el.on('input change', function () {
                const value = self.el.val();
                const errors = validateAuthorAffiliations(value);

                // Display validation errors if any
                const $errorBlock = self.el.siblings('.error-block');
                if (errors.length > 0) {
                    if ($errorBlock.length === 0) {
                        $('<span class="error-block"></span>').insertAfter(self.el);
                    }
                    self.el.siblings('.error-block').text(errors.join(', '));
                } else {
                    $errorBlock.remove();
                    storeAuthorAffiliations(value);
                }
            });

            // Set initial value from localStorage or CKAN extras
            const storedValue = window.localStorage.getItem('author_affiliations');
            let storedAffils = [];

            if (storedValue) {
                try {
                    storedAffils = JSON.parse(storedValue);
                } catch (e) {
                    console.error('Error parsing stored author affiliations:', e);
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
                            const found = extras.find(e => e.key === 'author_affiliations' && e.value);
                            if (found) {
                                try {
                                    foundValue = JSON.parse(found.value);
                                } catch (e) {
                                    // If JSON parsing fails, treat as comma-separated string
                                    foundValue = parseAuthorAffiliationsString(found.value);
                                }
                            }
                        }
                        if (foundValue && foundValue.length > 0) {
                            applyAuthorAffiliations(foundValue);
                        } else if (storedAffils.length > 0) {
                            applyAuthorAffiliations(storedAffils);
                        } else if (self.el.val()) {
                            storeAuthorAffiliations(self.el.val());
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching package data:', error);
                        if (storedAffils.length > 0) {
                            applyAuthorAffiliations(storedAffils);
                        } else if (self.el.val()) {
                            storeAuthorAffiliations(self.el.val());
                        }
                    });
            } else if (storedAffils.length > 0) {
                applyAuthorAffiliations(storedAffils);
            } else if (self.el.val()) {
                storeAuthorAffiliations(self.el.val());
            }

            // Add click event for update dataset button
            $(document).on('click', 'button[name="save"]', function(e) {
                // Only run if the button text is "Update Dataset"
                if ($(this).text().trim() === 'Update Dataset' && window.CKAN_PACKAGE_NAME) {
                    const affilsValue = self.el.val();
                    const errors = validateAuthorAffiliations(affilsValue);

                    if (errors.length > 0) {
                        e.preventDefault(); // Prevent form submission if there are errors
                        alert('Please fix the following errors:\n' + errors.join('\n'));
                        return;
                    }

                    e.preventDefault(); // Prevent default form submission
                    const $form = $(this).closest('form');
                    updateAuthorAffiliationsInDataset(affilsValue, window.CKAN_PACKAGE_NAME, $form);
                    window.localStorage.removeItem('author_affiliations'); // Clear the author affiliations after use
                }
            });
        }
    };
});