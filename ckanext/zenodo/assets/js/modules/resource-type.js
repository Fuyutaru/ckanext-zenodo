// ckanext/zenodo/assets/js/modules/resource-type.js
// Handles storing the selected resource type in localStorage and broadcasting changes

ckan.module('resource-type', function ($, _) {
    return {
        initialize: function () {
            console.log('Resource Type module loaded');
            const self = this;

            function sendResourceType(value) {
                window.localStorage.setItem('resource_type', value);
                window.dispatchEvent(new Event('resource_type_changed'));
                console.log('Resource type stored:', value);
            }

            // Set up event listener for changes
            this.el.on('change', function () {
                sendResourceType(self.el.val());
            });

            // Set initial value from localStorage if present
            const storedValue = window.localStorage.getItem('resource_type');
            let initialValue = storedValue;

            // If no localStorage value, try to fetch from CKAN extras
            if (!initialValue && window.CKAN_PACKAGE_NAME) {
                fetch(`/api/3/action/package_show?id=${window.CKAN_PACKAGE_NAME}`)
                    .then(resp => resp.json())
                    .then(data => {
                        if (data && data.result && data.result.extras) {
                            const extras = data.result.extras;
                            const found = extras.find(e => e.key === 'resource_type' && e.value);
                            if (found && self.el.find('option[value="' + found.value + '"]').length) {
                                self.el.val(found.value);
                                self.el.find('option[value=""]').remove();
                                self.el.trigger('change'); // Force redraw
                                sendResourceType(found.value);
                            }
                        }
                    });
            } else if (initialValue && self.el.find('option[value="' + initialValue + '"]').length) {
                self.el.val(initialValue);
                self.el.find('option[value=""]').remove();
                self.el.trigger('change'); // Force redraw
                sendResourceType(initialValue);
            } else if (self.el.val()) {
                sendResourceType(self.el.val());
            }
        }
    };
});
