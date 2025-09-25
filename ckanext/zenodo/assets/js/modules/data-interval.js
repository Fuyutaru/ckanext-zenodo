// ckanext/zenodo/assets/js/modules/data-interval.js
// Handles storing the data interval in localStorage and CKAN dataset extras

ckan.module('data-interval', function ($, _) {
    return {
        initialize: function () {
            const self = this;
            const $interval = self.el;
            const $dateType = $('#field-date-type');

            function getCombinedValue() {
                return `${$interval.val()}, ${$dateType.val()}`;
            }

            function setFieldsFromCombined(value) {
                if (!value) return;
                const parts = value.split(',');
                $interval.val(parts[0] ? parts[0].trim() : '');
                $dateType.val(parts[1] ? parts[1].trim() : '');
            }

            function storeDataInterval() {
                const combined = getCombinedValue();
                window.localStorage.setItem('data_interval', combined);
                window.dispatchEvent(new Event('data_interval_changed'));
                console.log('Data interval stored:', combined);
            }

            function applyDataInterval(value) {
                setFieldsFromCombined(value);
                storeDataInterval();
            }

            function updateDataIntervalInDataset(dataInterval, dateType, packageName, $form) {
                const combined = `${dataInterval}, ${dateType}`;
                let found = false;
                $form.find('input[type="hidden"]').each(function() {
                    const $keyInput = $(this);
                    if ($keyInput.attr('name') && $keyInput.attr('name').includes('key') && $keyInput.val() === 'data_interval') {
                        const keyName = $keyInput.attr('name');
                        const valueName = keyName.replace('key', 'value');
                        const $valueInput = $form.find(`input[name="${valueName}"]`);
                        if ($valueInput.length > 0) {
                            $valueInput.val(combined);
                            found = true;
                            console.log('Data interval updated in hidden field:', combined);
                            return false;
                        }
                    }
                });
                if (!found) {
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
                    $('<input>').attr({
                        type: 'hidden',
                        name: prefix + 'key',
                        value: 'data_interval'
                    }).appendTo($form);
                    $('<input>').attr({
                        type: 'hidden',
                        name: prefix + 'value',
                        value: combined
                    }).appendTo($form);
                    $('<input>').attr({
                        type: 'hidden',
                        name: prefix + 'deleted',
                        value: ''
                    }).appendTo($form);
                    console.log('Data interval added as new hidden field:', combined);
                }
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

            $interval.on('input change', storeDataInterval);
            $dateType.on('change', storeDataInterval);

            const storedValue = window.localStorage.getItem('data_interval');
            if (window.CKAN_PACKAGE_NAME) {
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
                            setFieldsFromCombined(foundValue);
                        } else if (storedValue) {
                            setFieldsFromCombined(storedValue);
                        }
                        // Always store current field values to localStorage if non-empty
                        if ($interval.val() || $dateType.val()) {
                            storeDataInterval();
                        }
                    });
            } else {
                if (storedValue) {
                    setFieldsFromCombined(storedValue);
                }
                // Always store current field values to localStorage if non-empty
                if ($interval.val() || $dateType.val()) {
                    storeDataInterval();
                }
            }

            $(document).on('click', 'button[name="save"]', function(e) {
                if ($(this).text().trim() === 'Update Dataset' && window.CKAN_PACKAGE_NAME) {
                    e.preventDefault();
                    const dataInterval = $interval.val();
                    const dateType = $dateType.val();
                    const $form = $(this).closest('form');
                    updateDataIntervalInDataset(dataInterval, dateType, window.CKAN_PACKAGE_NAME, $form);
                    window.localStorage.removeItem('data_interval');
                }
            });
        }
    };
});
