// This file is included on every page. Try not to bloat it.
// Page specific js should be inserted using the script block tag
// from the template.

// Global scope

var endpointToInputs = {
    systems: ['start_system', 'destination_system'],
    stations: ['start_station', 'destination_station'],
    commodities: ['commodity']
};

var cache = {};

function matcher(item){
    return this.query.toLowerCase().indexOf(item.name) != -1;
}

function attachInputToModel(name, model){
    var input = '#' + name + '_input';
    var isStation = name.search('station') != -1;

    $(input).typeahead({
        minLength: isStation ? 0 : 2,
        showHintOnFocus: isStation,
        delay: 250, // Millisecond
        source: function(query, process) {
          var requestUrl = '/' + model + '/?search=' + query;

          // If the input is for a station, only supply data from the corresponding system.
          // If no system is selected, return a helper message first.
          if (isStation){
              // Return cached station data for this input if it exists
              if (cache.hasOwnProperty(name)){
                  process(cache[name]);
                  return;
              }

              var correspondingSystemInput = input.replace('station', 'system');
              var selectedSystem = $(correspondingSystemInput).data('selected');
              if (typeof selectedSystem !== 'undefined'){
                requestUrl = selectedSystem.url + 'stations/';
              }
              else{
                process([]);
                return;
              }
            }

            $.getJSON(requestUrl, function(response){
              var autocompleteList = response.data.results;
              if (isStation){
                // Cache the list of station results for this input
                cache[name] = autocompleteList;
              }
              process(autocompleteList);
            });
        },
        afterSelect: function(suggestion){
            $(input).data('selected', suggestion);
            if (!isStation){
                // Resets the associated station input data cache when a new
                // system is selected.
                var correspondingStationInput = name.replace('system', 'station');
                if (cache.hasOwnProperty(correspondingStationInput)){
                    delete cache[correspondingStationInput];
                }
            }
        }
    });
}

function attachInputsToModels(dict){
    // Attaches the list of inputs from
    for (var model in dict){
        if (dict.hasOwnProperty(model)){
            var input_list = dict[model];
            for (var x = 0; x < input_list.length; x++){
                var input = input_list[x];
                attachInputToModel(input, model);
            }
        }
    }
}

$(function(){
    attachInputsToModels(endpointToInputs);

    // When submitting a form, replace inputs with input.data('selected').url
    $('form').each(function(){
        var $form = $(this);
        $form.submit(function(){
            $form.find(':input').each(function(){
                var selected = $(this).data('selected');
                if (typeof selected !== 'undefined'){
                    $(this).val(selected.url);
                    $(this).removeData();
                }
            });
        });
    });
});