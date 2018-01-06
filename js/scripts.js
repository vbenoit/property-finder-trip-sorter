Array.prototype.contains = function( contained ) {

	if ( !contained ){
		return null;
	}

    for(var i=0;i<contained.length;i++){
         if( this.indexOf( contained[i] ) < 0 ){
         	return false;
         } 
    }
    return true;

};

httpClient = {

	getContent: function( url, data, successProcessCallback ) {

		Vue.http.get( url, data ).then(

			function( response ) {
				if ( successProcessCallback ){
					successProcessCallback( response.body );
				}
			}, 
			function ( response ) {
				console.log("getContent - error: " + response.statusText );
			}

		);

	}

}

helpers = {
	deepCopy: function( object ) {
		return JSON.parse( JSON.stringify( object ) );
	},
	removeDuplicates: function( array ){

		var store = {};
		var filteredArray = [];
		for (var i = 0; i < array.length; i++) {
			if ( array[i] ){
				var key = array[i].join('|');
			
				if (!store[key]) {
					filteredArray.push(array[i]);
					store[key] = 1;
				}
			}
		}

		return filteredArray;

	},
	processList: function( sourceList, objectRef, sourceProperty, list ) {
		if ( sourceList ){
			//push each different value
			for ( var i = 0; i < sourceList.length; i++ ) {
				if ( objectRef[list].indexOf( sourceList[i][sourceProperty] ) 
						< 0 ){
					objectRef[list].push( sourceList[i][sourceProperty] );
				}
			}
			//sort
			objectRef[list].sort( this.alphabeticalSort );
		}
	},
	alphabeticalSort: function(nameA, nameB){
		var nameAFormatted = nameA.toLowerCase();
		var nameBFormatted = nameB.toLowerCase();
		if (nameAFormatted < nameBFormatted) {
			return -1;
		}
		if (nameAFormatted > nameBFormatted) {
			return 1;
		}
		return 0;
	}
};

itineraryService = {

	helpers: helpers,
	http: httpClient,
	travelsDataUrl: "data/response.json",

	getTravelsData: function( dataFetchedCallback ) {

		var params = {};
		this.http.getContent( this.travelsDataUrl, params, dataFetchedCallback );

	},
	generateMap: function( travelsData ) {

		var neighboursMap = [];

		//key: town, value: array of neighboring towns
		for ( var i = 0; i < travelsData.deals.length; i++ ){

			var currentDeparture = travelsData.deals[i].departure;
			var currentArrival = travelsData.deals[i].arrival;

			if (!neighboursMap[ currentDeparture ]) {
				neighboursMap[ currentDeparture ] = [];
			}

			if ( neighboursMap[ currentDeparture ].indexOf( currentArrival ) < 0 ){
				neighboursMap[ currentDeparture ].push( currentArrival  );
			}
		}

		return neighboursMap;
	},
	/*2- recursive algorithm to two find all paths from a city to another city without
		passing by the same place two times
	*/
	findAllPathsFromAToB: function( src, dest, excludedPoints, neighboursMap, containerObject ) {

		if (!containerObject.correctPaths) {
			containerObject.correctPaths = [];
		}

		//dest in direct src neighbors
		if ( neighboursMap[src].indexOf(dest) >= 0 ) {
			//direct transportation
			if ( excludedPoints.length === 0 ){
				containerObject.correctPaths.push( [ src, dest ] );
			}
			else{
				return [ src , dest ];
			}
		}
		//all current neighbors excluded
		if ( excludedPoints.contains( neighboursMap[src] ) ) {
			return null;
		}

		for ( var i = 0; i < neighboursMap[src].length; i ++ ) {
			//current neighbor not excluded
			if ( excludedPoints.indexOf( neighboursMap[src][ i ] ) < 0  ){
				var updatedExcludedPoints = 
					excludedPoints.indexOf(src) < 0 ? excludedPoints.concat([src]) : excludedPoints;
				var path = this.findAllPathsFromAToB( 
					neighboursMap[src][ i ], dest, updatedExcludedPoints, neighboursMap, containerObject );
				if ( path ){
					var result;
					if ( excludedPoints.length == 0 ){
						result = [src].concat(path);
					}
					else{ 
						result = updatedExcludedPoints.concat( path );
					}
					containerObject.correctPaths.push( result );
				}
			}
		}

	},
	getBestItinerary: function( correctPaths, sortByPrice, sortByTime, cacheContainer, travelsData ) {

		var smallestAmount = null;
		var bestItineraryIndex = null;
		var bestItinerary = null;

		for ( var i=0, l = correctPaths.length; i < l; i++ ) {
			currentAmount = 0;
			var currentItinerary = [];
			var nullTransportation = false;
			for ( var j=0; j < correctPaths[i].length - 1; j++ ){
				
				var bestTransportation = null;

				if ( sortByPrice ) { 
					bestTransportation = 
						this.getBestTransportation( 
							correctPaths[i][j], 
							correctPaths[i][j + 1],
							travelsData,
							cacheContainer["cheapestTransportations"],
							{ 
								primary: "discountedCost",
								secondary: "travelTime"
							}
						);
				}
				else if ( sortByTime ) { 
					bestTransportation = 
						this.getBestTransportation( 
							correctPaths[i][j], 
							correctPaths[i][j + 1],
							travelsData,
							cacheContainer["fastestTransportations"],
							{
								primary: "travelTime",
								secondary: "discountedCost"
							}
						);
				}

				if (!bestTransportation){
					nullTransportation = true;
					break;
				}

				if ( sortByPrice ) { 
					currentAmount += bestTransportation.discountedCost;
				}
				if ( sortByTime ){
					currentAmount += bestTransportation.travelTime
				}
				currentItinerary.push( new Transportation(bestTransportation) );
			}

			if ( nullTransportation ){
				continue;
			}

			if ( smallestAmount == null || currentAmount < smallestAmount ){
				smallestAmount = currentAmount;
				bestItineraryIndex = i;
				bestItinerary = this.helpers.deepCopy( currentItinerary );
			}
		}

		return bestItinerary;

	},
	getBestTransportation: function( pDeparture, pArrival, travelsData, cache, propertiesToCompare ) {
			
		//a cache system
		if ( !cache[pDeparture + "|" + pArrival] ) {

			var directTransportations = this.getDirectTransportations( pDeparture, pArrival, travelsData );
			var bestDeal = null;
			//the best(cheapest/fastest) transportation
			for ( var i= 0; i < directTransportations.length; i++ ) {
				var currentTransportation = new Transportation( directTransportations[i] ); 
				currentTransportation.computeEffectiveCost();
				currentTransportation.computeTravelTimeInMin();

				if ( !bestDeal 
					|| currentTransportation[propertiesToCompare.primary] < bestDeal[propertiesToCompare.primary] 
					/* if both transportation are the same on the first element of comparison
						we can then check the best on the another element of comparison */
					|| ( currentTransportation[propertiesToCompare.primary] == bestDeal[propertiesToCompare.primary]
						&& currentTransportation[propertiesToCompare.secondary] < bestDeal[propertiesToCompare.secondary] ) ){
					bestDeal = this.helpers.deepCopy( currentTransportation );
				}
			}
			//fill the cache with the computed value
			cache[pDeparture + "|" + pArrival] = this.helpers.deepCopy( bestDeal );
		}

		return cache[pDeparture + "|" + pArrival];

	},
	getDirectTransportations: function( pDeparture, pArrival, travelsData ) {
		return travelsData.deals.filter( function( travel ) {
			return ( travel.departure === pDeparture && travel.arrival === pArrival  );
		} );
	}

};

app = new Vue({
	http: Vue.http,

	data: function() {

		return {

			helpers: helpers,
			pItineraryService: itineraryService,

			sortByPrice: true,
			sortByTime: false,

			PRICE_SORT_TYPE: "price",
			TIME_SORT_TYPE: "time",

			BOTH_VALUES_SET_MSG: "All fields are not set",
			BOTH_VALUES_DIFFERENT_MSG: "Both location fields are the same",

			EMPTY_STRING: "",
			errorMessage: "",
			displayError: false,

			travelsDataFetched: false,
			travelsData: {},

			departures: [],
			arrivals: [],

			defaultCityValue: "0",
			currentDeparture: "0",
			currentArrival: "0",

			neighboursMap: [],

			displayForm: true,
			displayResult: false,
			FORM_BUTTON_VALUE: "Search",
			RESULT_BUTTON_VALUE: "Reset",
			buttonValue: "",
			FORM_ICON_VALUE: "fa-search",
			RESULT_ICON_VALUE: "fa-repeat horizontal-flip",
			iconValue: "",
			displayMode: "",
			SEARCH_DISPLAY_MODE: "search",
			RESET_DISPLAY_MODE: "reset",

			correctPaths: [],

			cheapestTransportations: [],
			fastestTransportations: [],

			processedItinerary: [],

			currency: "EUR",

			currenrySymbols: {
				"EUR" : "€",
				"DOLR" : "$",
				"PND" : "£"
			}

		}

	},
	methods: {
		setTravelsData: function( dealsData ){
			if ( dealsData ) {
				this.travelsData = this.helpers.deepCopy( dealsData );
				this.travelsDataFetched = true;
				this.processFormValues();
				/* for each city we set neighboring cities */
				this.neighboursMap = this.pItineraryService.generateMap( this.travelsData );
			}

		},
		processFormValues: function(){
			if ( this.travelsData ) {
				this.processDeparturesList();
				this.processArrivalsList();
			}
		},
		processDeparturesList: function(){
			this.helpers.processList( this.travelsData.deals, this, "departure", "departures" );
		},
		processArrivalsList: function(){
			this.helpers.processList( this.travelsData.deals, this, "arrival", "arrivals" );
		},
		getTravelsData: function(){
			this.pItineraryService.getTravelsData( this.setTravelsData );
		},
		setTimeSort: function() {
			this.sortByTime = true;
			this.sortByPrice = false;
		},
		setPriceSort: function() {
			this.sortByTime = false;
			this.sortByPrice = true;
		},
		setErrorMsg: function( msg ) {
			this.errorMessage = msg;
		},
		launchSearchFormControl: function() {
			var bothValuesSet = this.currentDeparture != "0" && this.currentArrival != "0";
			var bothValuesDifferent = ( this.currentDeparture != this.currentArrival );

			if ( !bothValuesSet ) {
				this.setErrorMsg( this.BOTH_VALUES_SET_MSG );
			}

			if ( !bothValuesDifferent ) {
				this.setErrorMsg( this.BOTH_VALUES_DIFFERENT_MSG );
			}
			return (bothValuesSet && bothValuesDifferent);
		},
		applyDisplayMode: function() {
			if ( this.displayMode === this.SEARCH_DISPLAY_MODE ){
				this.iconValue = this.FORM_ICON_VALUE;
				this.buttonValue = this.FORM_BUTTON_VALUE;
				this.displayForm = true;
				this.displayResult = false;
			}
			else if ( this.displayMode === this.RESET_DISPLAY_MODE ){
				this.iconValue = this.RESULT_ICON_VALUE;
				this.buttonValue = this.RESULT_BUTTON_VALUE;
				this.displayForm = false;
				this.displayResult = true;
			}
		},
		resetCitiesValues: function() {
			this.currentDeparture = this.defaultCityValue;
			this.currentArrival = this.defaultCityValue;
		},
		buttonClicked: function() {
			if ( this.displayMode === this.SEARCH_DISPLAY_MODE ){
				this.launchSearch();
			}
			else{
				this.resetCitiesValues();
				this.displayMode = this.SEARCH_DISPLAY_MODE;
				this.applyDisplayMode();
			}
		},
		launchSearch: function() {

			/* djikstras algorithm doesn't seem to be the most 
				suitable for this situation */
			this.setErrorMsg(this.EMPTY_STRING);

			console.time("Launchsearch processing time");
			/*  init results paths */
			this.correctPaths = [];	

			var formOk = this.launchSearchFormControl();

			if (!formOk){
				return;
			}
 
			this.pItineraryService.findAllPathsFromAToB( 
				this.currentDeparture, this.currentArrival, [], this.neighboursMap, this );

			/* 2 - remove duplicates */
			this.correctPaths = this.helpers.removeDuplicates(this.correctPaths);

			/* 3 - we chose the cheapest/fastest */
			var bestItinerary = 
				this.pItineraryService.getBestItinerary( 
					this.correctPaths, this.sortByPrice, this.sortByTime, this, this.travelsData );
			
			this.processedItinerary = new Itinerary( bestItinerary );
			this.processedItinerary.computeAdditionalInformations();
			console.timeEnd("Launchsearch processing time");

			this.displayMode = this.RESET_DISPLAY_MODE;
			this.applyDisplayMode();

		}
	},
	mounted: function(){
		this.displayMode = this.SEARCH_DISPLAY_MODE;
		this.applyDisplayMode();
		this.getTravelsData();
	},
	watch: {
		errorMessage: function() {
			if ( this.errorMessage ){
				this.displayError = true;
			}
			else{
				this.displayError = false;
			}
		}
	},
	filters: {
	  minutesCompletion: function (value) {
	    if (!value){ 
	    	return '';
	    }
	    value = value.toString().length === 1 ? "0" + value : value;
	    return value;
	  }
	}
}).$mount("#app");

function Transportation( valuesObject ){

	this.transport = valuesObject.transport;
	this.departure = valuesObject.departure;
	this.arrival = valuesObject.arrival;
	this.duration = {};
	this.duration.h = valuesObject.duration ? valuesObject.duration.h : null;
	this.duration.m = valuesObject.duration ? valuesObject.duration.m : null;
	this.cost = valuesObject.cost;
	this.discount = valuesObject.discount;
	this.reference = valuesObject.reference;

	this.computeEffectiveCost = function() {
		this.discountedCost = parseInt( this.cost ) * 
				( 100 - parseInt( this.discount ) ) / 100;  
	}

	this.computeTravelTimeInMin = function() {
		this.travelTime = parseInt( this.duration.h ) * 60  + parseInt( this.duration.m ); 
	}

}

function Itinerary( pTransportationsList ){

	this.transportationsList = [];

	self = this;

	pTransportationsList.map( function( pTransportation ){
		var transportation = new Transportation( pTransportation );
		transportation.computeEffectiveCost();
		transportation.computeTravelTimeInMin();
		self.transportationsList.push( transportation );
	});

	this.computeAdditionalInformations = function() {

		this.totalCost = 
			this.transportationsList.reduce( 
				function( totalAmount, currentTransportation ) { 
					return totalAmount + currentTransportation.discountedCost 
				}, 0 );

		this.totalTime = 
			this.transportationsList.reduce( 
				function( totalAmount, currentTransportation ) { 
					return totalAmount + currentTransportation.travelTime 
				}, 0 );

		this.duration = {};
		this.duration.h = 
			Math.floor(this.totalTime / 60 );

		this.duration.m =
			Math.round(this.totalTime % 60 );

	}

}

(function tests(){

	function launchTests() {

		var colorOk = 'background: #222; color: #a7c93c';
		var colorError = 'background: #222; color: #ec4d09';

		console.time('Test #1');
		var itinerary = processItinerary( "Geneva", "Stockholm", false, true );
		if ( itinerary.transportationsList[1].departure === "Brussels" 
			&& itinerary.transportationsList[2].departure === "Prague"
			&& itinerary.transportationsList[3].departure === "Moscow"
			&& itinerary.totalCost === 640
			&& itinerary.duration.h === 14
			&& itinerary.duration.m === 0 ){
			console.log( "%c processedItinerary( \"Geneva\", \"Stockholm\", fastest ) is what's expected", colorOk );
		}
		else{
			console.log( "%c Error, regression - processedItinerary( \"Geneva\", \"Stockholm\", fastest )", colorError );
		}
		console.timeEnd('Test #1');

		console.time('Test #2');
		itinerary = processItinerary( "Geneva", "Stockholm", true, false );
		if ( itinerary.transportationsList[1].departure === "Brussels" 
			&& itinerary.transportationsList[2].departure === "Amsterdam"
			&& itinerary.transportationsList[3].departure === "Warsaw"
			&& itinerary.totalCost === 110
			&& itinerary.duration.h === 21
			&& itinerary.duration.m === 0 ){
			console.log( "%c processedItinerary( \"Geneva\", \"Stockholm\", cheapest ) is what's expected", colorOk );
		}
		else{
			console.log( "%c Error, regression - processedItinerary( \"Geneva\", \"Stockholm\", cheapest )", colorError );
		}
		console.timeEnd('Test #2');

	}

	var travelsData;
	function setTravelsData( pTravelsData ) {
		travelsData = helpers.deepCopy( pTravelsData );
		launchTests();
	}

	itineraryService.getTravelsData( setTravelsData );

	function processItinerary( pDeparture, pArrival, sortByPrice, sortByTime ) {

		var correctPathsContainerObject = {};
		var neighboursMap = itineraryService.generateMap( travelsData );

		itineraryService.findAllPathsFromAToB( 
			pDeparture, pArrival, [], neighboursMap, correctPathsContainerObject);

		correctPaths = helpers.removeDuplicates(correctPathsContainerObject.correctPaths);

		correctPathsContainerObject = null;

		var cacheContainer = {};
		cacheContainer.cheapestTransportations= [];
		cacheContainer.fastestTransportations= [];

		var processedItinerary = 
			new Itinerary( 
				itineraryService
					.getBestItinerary( 
						correctPaths, sortByPrice, sortByTime, cacheContainer, travelsData ) );

		processedItinerary.computeAdditionalInformations();	

		return processedItinerary;

	}

})();