// ckanext/zenodo/assets/js/modules/add-contributor.js
// Handles dynamic addition of contributor fields

ckan.module('add-contributor', function ($, _) {
    return {
        initialize: function () {
            const self = this;
            console.log('Add Contributor module loaded');

            // Find the highest contributor field index currently in the DOM
            function getHighestContributorIndex() {
                let highestIndex = -1;
                $('input[id^="field-contributor-name-"]').each(function() {
                    const id = $(this).attr('id');
                    const match = id.match(/field-contributor-name-(\d+)/);
                    if (match) {
                        const index = parseInt(match[1]);
                        if (index > highestIndex) {
                            highestIndex = index;
                        }
                    }
                });
                return highestIndex;
            }

            // Create HTML for a new contributor field pair by cloning the first field
            function createContributorFieldHTML(index) {
                // Find the first contributor field group as our template
                const $firstField = $('.contributor-field-group[data-contributor-index="0"]').first();
                
                if ($firstField.length === 0) {
                    console.error('Could not find first contributor field to clone');
                    return '';
                }
                
                // Clone the first field
                const $cloned = $firstField.clone();
                
                // Update the data-contributor-index
                $cloned.attr('data-contributor-index', index);
                
                // Clear the values and update IDs/names for name field
                const $nameInput = $cloned.find('input[id^="field-contributor-name-"]');
                $nameInput.attr('id', `field-contributor-name-${index}`);
                $nameInput.attr('name', `contributor_name_${index}`);
                $nameInput.val(''); // Clear the value
                
                // Update the label for name field - keep "Contributor Name:" for all fields
                const $nameLabel = $cloned.find('label[for^="field-contributor-name-"]');
                if ($nameLabel.length > 0) {
                    $nameLabel.attr('for', `field-contributor-name-${index}`);
                    $nameLabel.text('Contributor Name');
                }
                
                // Clear the values and update IDs/names for role field
                const $roleSelect = $cloned.find('select[id^="field-contributor-role-"]');
                $roleSelect.attr('id', `field-contributor-role-${index}`);
                $roleSelect.attr('name', `contributor_role_${index}`);
                $roleSelect.val(''); // Reset to empty option
                
                // Update the label for role field - keep "Role:" for all fields
                const $roleLabel = $cloned.find('label[for^="field-contributor-role-"]');
                if ($roleLabel.length > 0) {
                    $roleLabel.attr('for', `field-contributor-role-${index}`);
                    $roleLabel.text('Role');
                }
                
                // Clear the values and update IDs/names for affiliation field
                const $affiliationInput = $cloned.find('input[id^="field-contributor-affiliation-"]');
                $affiliationInput.attr('id', `field-contributor-affiliation-${index}`);
                $affiliationInput.attr('name', `contributor_affiliation_${index}`);
                $affiliationInput.val(''); // Clear the value

                // Update the label for affiliation field
                const $affiliationLabel = $cloned.find('label[for^="field-contributor-affiliation-"]');
                if ($affiliationLabel.length > 0) {
                    $affiliationLabel.attr('for', `field-contributor-affiliation-${index}`);
                    $affiliationLabel.text('Affiliation');
                }
                
                // Update the remove button
                const $removeBtn = $cloned.find('.remove-contributor');
                if ($removeBtn.length === 0) {
                    // The first field doesn't have a remove button, so we need to add the entire structure
                    const removeButtonHTML = `
                        <div style="flex: 0 0 auto;">
                            <label class="form-label" style="visibility: hidden;">Remove</label>
                            <div class="controls">
                                <button type="button" class="btn btn-danger btn-sm remove-contributor" 
                                        data-contributor-index="${index}" 
                                        title="Remove this contributor">
                                    <i class="fa fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `;
                    $cloned.find('> div[style*="display: flex"]').append(removeButtonHTML);
                } else {
                    // Update existing remove button
                    $removeBtn.attr('data-contributor-index', index);
                }
                
                return $cloned.prop('outerHTML');
            }

            // Add a new contributor field
            function addContributorField() {
                const highestIndex = getHighestContributorIndex();
                const newIndex = highestIndex + 1;
                
                // Find the location to insert the new field (before the "Add Contributor" button)
                const $addButton = $('#add-contributor-field');
                const $newField = $(createContributorFieldHTML(newIndex));
                
                // Insert the new field before the button
                $newField.insertBefore($addButton);
                
                // Focus on the new name field
                $newField.find(`#field-contributor-name-${newIndex}`).focus();
                
                console.log(`Added contributor field with index ${newIndex}`);
                
                // Trigger change event to update localStorage via the contributor module
                setTimeout(function() {
                    $newField.find('input, select').trigger('change');
                }, 100);
            }

            // Remove a contributor field
            function removeContributorField(index) {
                const $fieldGroup = $(`.contributor-field-group[data-contributor-index="${index}"]`);
                if ($fieldGroup.length > 0) {
                    // Mark the fields as disabled instead of removing them completely
                    // This prevents issues with form submission and data collection
                    $fieldGroup.find('input, select').prop('disabled', true);
                    $fieldGroup.hide();
                    
                    console.log(`Removed contributor field with index ${index}`);
                    
                    // Trigger change event to update localStorage via the contributor module
                    setTimeout(function() {
                        $(document).trigger('change');
                    }, 100);
                }
            }

            // Click handler for the "Add Contributor" button
            this.el.on('click', function(e) {
                e.preventDefault();
                addContributorField();
            });

            // Click handler for remove buttons (using event delegation)
            $(document).on('click', '.remove-contributor', function(e) {
                e.preventDefault();
                const index = $(this).data('contributor-index');
                removeContributorField(index);
            });
        }
    };
});
