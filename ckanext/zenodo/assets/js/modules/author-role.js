// Handles storing the author roles list in localStorage and CKAN dataset extras

ckan.module('author-role', function ($, _) {
    return {
        initialize: function () {
            const self = this;
            console.log('Author Role module loaded', window.CKAN_PACKAGE_NAME);

            // Parse comma-separated author roles string into a list
            function parseAuthorRolesString(value) {
                if (!value || typeof value !== 'string') {
                    return [];
                }
                return value.split(',')
                    .map(role => role.trim());
            }

            // Convert author roles list back to comma-separated string
            function formatAuthorRolesString(roles) {
                if (!Array.isArray(roles)) {
                    return '';
                }
                return roles
                    .map(role => role.trim())
                    .join(', ');
            }

            // Store author roles in localStorage and broadcast change
            function storeAuthorRoles(value) {
                const roles = parseAuthorRolesString(value);
                window.localStorage.setItem('author_roles', JSON.stringify(roles));
                window.dispatchEvent(new Event('author_roles_changed'));
                console.log('Author roles stored:', roles);
            }

            // Set the author roles in the input element and localStorage
            function applyAuthorRoles(value) {
                const roles = Array.isArray(value) ? value : parseAuthorRolesString(value);
                const formattedValue = formatAuthorRolesString(roles);
                self.el.val(formattedValue);
                storeAuthorRoles(formattedValue);
            }

            // Update author roles in hidden custom field and optionally submit the form
            function updateAuthorRolesInDataset(rolesValue, packageName, $form) {
                const roles = parseAuthorRolesString(rolesValue);
                const rolesJson = JSON.stringify(roles);

                // Find the hidden input field for author_role in the form
                let found = false;
                $form.find('input[type="hidden"]').each(function() {
                    const $keyInput = $(this);
                    if ($keyInput.attr('name') && $keyInput.attr('name').includes('key') && $keyInput.val() === 'author_roles') {
                        // Found the key input, now find the corresponding value input
                        const keyName = $keyInput.attr('name');
                        const valueName = keyName.replace('key', 'value');
                        const $valueInput = $form.find(`input[name="${valueName}"]`);
                        if ($valueInput.length > 0) {
                            $valueInput.val(rolesJson);
                            found = true;
                            console.log('Author roles updated in hidden field:', roles);
                            return false; // Break out of the each loop
                        }
                    }
                });

                // If not found, add new hidden fields for author_role
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

                    // Add hidden fields for the new author_role extra
                    $('<input>').attr({
                        type: 'hidden',
                        name: prefix + 'key',
                        value: 'author_roles'
                    }).appendTo($form);

                    $('<input>').attr({
                        type: 'hidden',
                        name: prefix + 'value',
                        value: rolesJson
                    }).appendTo($form);

                    $('<input>').attr({
                        type: 'hidden',
                        name: prefix + 'deleted',
                        value: ''
                    }).appendTo($form);

                    console.log('Author roles added as new hidden field:', roles);
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

            // Validate author roles input
            function validateAuthorRoles(value) {
                const roles = parseAuthorRolesString(value);
                const errors = [];

                // Check for invalid characters (basic validation)
                roles.forEach(role => {
                    if (role === '') {
                        // Allow empty roles, skip validation
                        return;
                    }
                    if (role.length > 50) {
                        errors.push(`Author role too long: ${role}`);
                    }
                    if (!/^[a-zA-Z0-9\s\-_\.\/]+$/.test(role)) {
                        errors.push(`Invalid characters in author role: ${role}`);
                    }
                });

                return errors;
            }

            // Listen for changes in the input element
            this.el.on('input change', function () {
                const value = self.el.val();
                const errors = validateAuthorRoles(value);

                // Display validation errors if any
                const $errorBlock = self.el.siblings('.error-block');
                if (errors.length > 0) {
                    if ($errorBlock.length === 0) {
                        $('<span class="error-block"></span>').insertAfter(self.el);
                    }
                    self.el.siblings('.error-block').text(errors.join(', '));
                } else {
                    $errorBlock.remove();
                    storeAuthorRoles(value);
                }
            });

            // Set initial value from localStorage or CKAN extras
            const storedValue = window.localStorage.getItem('author_roles');
            let storedRoles = [];

            if (storedValue) {
                try {
                    storedRoles = JSON.parse(storedValue);
                } catch (e) {
                    console.error('Error parsing stored author roles:', e);
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
                            const found = extras.find(e => e.key === 'author_roles' && e.value);
                            if (found) {
                                try {
                                    foundValue = JSON.parse(found.value);
                                } catch (e) {
                                    // If JSON parsing fails, treat as comma-separated string
                                    foundValue = parseAuthorRolesString(found.value);
                                }
                            }
                        }
                        if (foundValue && foundValue.length > 0) {
                            applyAuthorRoles(foundValue);
                        } else if (storedRoles.length > 0) {
                            applyAuthorRoles(storedRoles);
                        } else if (self.el.val()) {
                            storeAuthorRoles(self.el.val());
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching package data:', error);
                        if (storedRoles.length > 0) {
                            applyAuthorRoles(storedRoles);
                        } else if (self.el.val()) {
                            storeAuthorRoles(self.el.val());
                        }
                    });
            } else if (storedRoles.length > 0) {
                applyAuthorRoles(storedRoles);
            } else if (self.el.val()) {
                storeAuthorRoles(self.el.val());
            }

            // Add click event for update dataset button
            $(document).on('click', 'button[name="save"]', function(e) {
                // Only run if the button text is "Update Dataset"
                if ($(this).text().trim() === 'Update Dataset' && window.CKAN_PACKAGE_NAME) {
                    const rolesValue = self.el.val();
                    const errors = validateAuthorRoles(rolesValue);

                    if (errors.length > 0) {
                        e.preventDefault(); // Prevent form submission if there are errors
                        alert('Please fix the following errors:\n' + errors.join('\n'));
                        return;
                    }

                    e.preventDefault(); // Prevent default form submission
                    const $form = $(this).closest('form');
                    updateAuthorRolesInDataset(rolesValue, window.CKAN_PACKAGE_NAME, $form);
                    window.localStorage.removeItem('author_roles'); // Clear the author roles after use
                }
            });
        }
    };
});