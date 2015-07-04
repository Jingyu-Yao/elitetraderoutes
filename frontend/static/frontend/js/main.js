// Included libraries: bootstrap, jQuery, Mustache
// Global scope

var STATIC_BASE = '/static/frontend/';

var cache = {
    templates: {},
    station_inputs: {},

    /**
     * Get the template from {@code template} and stores it in the
     * cache. Actual 304 status is not validated since templates are
     * unlikely to change during a session.
     *
     * @param {string} templateName Url to the template
     * @param {Function} callback Callback function to run on the template
     */
    getTemplate: function (templateName, callback) {
        templateName = STATIC_BASE + 'templates/' + templateName;
        if (cache.templates.hasOwnProperty(templateName)) {
            callback(cache.templates[templateName]);
        }
        else {
            $.get(templateName, function (data) {
                cache.templates[templateName] = data;
                callback(data);
            });
        }
    }
};
var util = {
    /**
     * Case-insensitive search.
     *
     * @param {string} search Search string
     * @param {string} source Source string
     * @returns {boolean} Whether search is in source
     */
    iCompare: function (search, source) {
        return source.toLowerCase().indexOf(search.toLowerCase()) != -1;
    },

    stationCommodityTemplateChooser: function (forStation) {
        return (forStation ? 'station_commodities_table.mustache' : 'commodity_stations_table.mustache');
    },

    findModel: function (name) {
        if (typeof name === 'undefined') {

        }
        else if (util.iCompare('system', name)) {
            return 'systems';
        }
        else if (util.iCompare('station', name)) {
            return 'stations';
        }
        else if (util.iCompare('commodity', name)) {
            return 'commodities';
        }
    },

    renderNav: function(data, pagerName, callback){
        if (data.data.previous || data.data.next){
            cache.getTemplate('list_nav.mustache', function(template){
                var nav = Mustache.render(template,{
                    previous: data.data.previous,
                    next: data.data.next,
                    targeter: function () {
                        return function (val, render) {
                            // The cursor style is a hack for pager with no href
                            return 'style="cursor: pointer;" name="' + pagerName + '" data-url="' + render(val) + '"';
                        };
                    }
                });
                callback(nav);
            });
        }
        else{
            callback('');
        }
    }
};

function initSearchBox() {
    // Search box logic
    var $input = $('#search_input');

    if (!$input.length) {
        return;
    }

    // Default option
    var checkedRadio = $('input[name=search_type]:checked');
    attachSearchToModel($input, checkedRadio.val());

    $('input[name=search_type]').click(function () {
        attachSearchToModel($input, $(this).val());
    });

    function attachSearchToModel($input, model) {
        // Clean previous typeahead
        $input.typeahead('destroy');

        $input.typeahead({
            minLength: 2,
            delay: 250, // Millisecond
            source: function (query, process) {
                var requestUrl = '/' + model + '/?search=' + query;

                $.getJSON(requestUrl, function (response) {
                    process(response.data.results);
                });
            },
            afterSelect: function (suggestion) {
                window.location.href = suggestion.url;
            },
            displayText: function (item) {
                if (item.hasOwnProperty('system_name')) {
                    return item.name + ' (' + item.system_name + ')';
                }

                return item.name;
            }
        });

        $input.keypress(function (e) {
            if (e.which == 13) {
                $('#search_error').html('<div class="alert alert-warning" role="alert">Please select item from dropdown or tab complete.</div>');
            }
        });
    }
}

function initFormSubmitChange() {
    var $forms = $('form');

    if (!$forms.length) {
        return;
    }

    // When submitting a form, replace inputs with input.data('selected').url
    $forms.each(function () {
        var $form = $(this);

        attachTypeaheadForInputs($form);

        $form.submit(function () {
            $form.find(':input').each(function () {
                var selected = $(this).data('selected');
                if (typeof selected !== 'undefined') {
                    $(this).val(selected.url);
                    $(this).removeData();
                }
            });
        });
    });

    function attachTypeaheadForInputs($form) {
        $form.find(':input').each(function () {
            var $input = $(this);
            var name = $input.attr('name');
            var model = util.findModel(name);

            if (typeof model === 'undefined') {
                return;
            }

            var isStation = name.search('station') != -1;

            $input.typeahead({
                minLength: isStation ? 0 : 2,
                showHintOnFocus: isStation,
                delay: 250, // Millisecond
                source: function (query, process) {
                    var requestUrl = '/' + model + '/?search=' + query;

                    // If the input is for a station, only supply data from the corresponding system.
                    // If no system is selected, return a helper message first.
                    if (isStation) {
                        // Return cached station data for this input if it exists
                        if (cache.station_inputs.hasOwnProperty(name)) {
                            process(cache.station_inputs[name]);
                            return;
                        }

                        var correspondingSystemInput = name.replace('station', 'system');
                        // We got rid of the id for input tags cause there is no easy way to make them unique across multiple
                        // forms. Now we have to use selectors to find nearest sibling input
                        var selectedSystem = $input.closest('form').find('input[name=' + correspondingSystemInput + ']').data('selected');
                        if (typeof selectedSystem !== 'undefined') {
                            requestUrl = selectedSystem.url + 'stations/';
                        }
                        else {
                            process([]);
                            return;
                        }
                    }

                    $.getJSON(requestUrl, function (response) {
                        var autocompleteList = response.data.results;
                        if (isStation) {
                            // Cache the list of station results for this input
                            cache.station_inputs[name] = autocompleteList;
                        }
                        process(autocompleteList);
                    });
                },
                afterSelect: function (suggestion) {
                    $input.data('selected', suggestion);
                    if (!isStation) {
                        // Resets the associated station input data cache when a new
                        // system is selected.
                        var correspondingStationInput = name.replace('system', 'station');
                        if (cache.station_inputs.hasOwnProperty(correspondingStationInput)) {
                            delete cache.station_inputs[correspondingStationInput];
                        }
                    }
                }
            });
        });
    }
}

function initStationCommodityBrowseButtons() {
    $('[name=station_commodities_browse_button]').each(function () {
        var $btn = $(this);
        var uuid = $btn.data('uuid');
        var station = $btn.data('station');
        var commodity = $btn.data('commodity');

        $btn.click(function () {
            var listId = uuid + '_station_commodity_list';
            $btn.parent().after('<div class="collapse" id="' + listId + '"></div>');
            $btn.attr('data-toggle', 'collapse');
            $btn.attr('data-target', '#' + listId);
            $btn.off('click');

            populateStationCommoditiesList(listId, station, commodity, "");
        });
    });
}

/**
     * Populate the #listId with station commodity data.
     *
     * If {@code url} is supplied, then the data returned by the url
     * will be used to populate the list. Else the list data is populated
     * using either station or commodity as the source.
     *
     * Has to be top level since pager buttons call this.
     *
     * @param {string} listId
     * @param {number} station
     * @param {number} commodity
     * @param {string} url
     */
function populateStationCommoditiesList(listId, station, commodity, url) {
    var $listDiv = $('#' + listId);

    // Get the station commodities
    $.getJSON(url ? url : '/station_commodities/',
        url ? null : {
            station: station,
            commodity: commodity
        }, function (data) {
            util.renderNav(data, 'station_commodities_list_pager', function(nav){
                cache.getTemplate(util.stationCommodityTemplateChooser(station), function (template) {
                    var table = Mustache.render(template, data);
                    $listDiv.html(nav+table);

                    // Attach click listeners to the created pagers
                    $listDiv.find('a[name=station_commodities_list_pager]').each(function () {
                        var $pager = $(this);
                        $pager.click(function () {
                            populateStationCommoditiesList(listId, station, commodity, $pager.data('url'));
                        });
                    });
                });
            });
        });
}

function initStationCommodityModalHandler(){
    var $stationCommodityModal = $('#station_commodity_modal');
    var $stationCommodityModalTitle = $stationCommodityModal.find('.modal-title');
    var $stationCommodityModalBrowseResults = $stationCommodityModal.find('#station_commodity_modal_browse_results');
    var $stationCommodityModalSearchResults = $stationCommodityModal.find('#station_commodity_modal_search_results');
    var $searchBox = $('#' + 'station_commodity_modal_search_input');

    $stationCommodityModal.on('show.bs.modal', function(event){
        var $btn = $(event.relatedTarget);
        var uuid = $btn.data('uuid');
        var station = $btn.data('station');
        var commodity = $btn.data('commodity');
        var name = $btn.data('name');

        // Modal configurations
        $stationCommodityModalTitle.html(name);
        $searchBox.attr('placeholder', station ? 'Search commodity...' : 'Search station...');

        // Start browsing by default
        populateStationCommoditiesList('station_commodity_modal_browse_results', station, commodity, "");

        initStationCommoditySearchBox($searchBox, $stationCommodityModalSearchResults, station, commodity);
    });

    // Reset modal state
    $stationCommodityModal.on('hidden.bs.modal', function(event){
        $searchBox.val('');
        $stationCommodityModalSearchResults.empty();
        $stationCommodityModalBrowseResults.empty();
    });
}

function initStationCommoditySearchBox($searchBox, $target, station, commodity){
    station = typeof station !== 'undefined' ? station : $searchBox.data('station');
    commodity = typeof commodity !== 'undefined' ? commodity : $searchBox.data('commodity');

    $searchBox.keypress(function (e) {
        if (e.which == 13) {
            var val = $searchBox.val();

            if (val.length < 2) {
                $target.html('<p>Minimum of 2 characters to search</p>');
            }
            else {
                var params = {
                    commodity: commodity,
                    station: station,
                    search: val
                };

                $.getJSON('/station_commodities/', params, function (data) {
                    if (data.data.count) {
                        // Limit # of results to 5
                        data.data.results = data.data.results.slice(0, 5);
                        cache.getTemplate(util.stationCommodityTemplateChooser(station), function (template) {
                            $target.html(Mustache.render(template, data));
                        });
                    }
                    else {
                        $target.html('<p>No results</p>');
                    }
                });
            }
            $target.collapse('show');
        }
    });
}

function initAllStationCommoditySearchBox() {
    var $inputs = $('input[name=station_commodity_search_input]');

    if (!$inputs.length) {
        return;
    }

    $inputs.each(function () {
        var $input = $(this);
        var resultsDivId = $input.data('uuid') + '_station_commodity_results';
        $input.parent().after('<div class="collapse" id="' + resultsDivId + '"></div>');
        var $resultsDiv = $('#' + resultsDivId);

        initStationCommoditySearchBox($input, $resultsDiv);
    });
}

function initStationListModalHandler(){
    var $modal = $('#station_list_modal');
    var $title = $modal.find('.modal-title');
    var $body = $modal.find('.modal-body');

    $modal.on('show.bs.modal', function(event){
        var $btn = $(event.relatedTarget);
        var uuid = $btn.data('uuid');
        var system = $btn.data('system');
        var url = $btn.data('url');
        var name = $btn.data('name');

        // Modal configurations
        $title.html(name);

        // Modal data
        $.getJSON(url+'stations/', function(data){
            util.renderNav(data, 'station_list_modal_pager', function(nav){
                cache.getTemplate('station_table.mustache', function(template){
                    var table = Mustache.render(template, data);
                    $body.html(nav + table);
                });
            });
        });
    });
}

$(function () {
    initFormSubmitChange();
    initSearchBox();
    initAllStationCommoditySearchBox();
    initStationCommodityBrowseButtons();
    initStationCommodityModalHandler();
    initStationListModalHandler();
});
