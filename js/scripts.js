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

itineraryService = {

	helpers: helpers,

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
							cacheContainer,
							"cheapestTransportations",
							"discountedCost"
						);
				}
				else if ( sortByTime ) { 
					bestTransportation = 
						this.getBestTransportation( 
							correctPaths[i][j], 
							correctPaths[i][j + 1],
							travelsData,
							cacheContainer,
							"fastestTransportations",
							"travelTime"
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
	getBestTransportation: function( pDeparture, pArrival, travelsData, cacheContainer, cachePropertyName, propertyToCompare ) {
			
		//a cache system
		if ( !cacheContainer[cachePropertyName][pDeparture + "|" + pArrival] ) {

			var directTransportations = this.getDirectTransportations( pDeparture, pArrival, travelsData );
			var bestDeal = null;
			//the best(cheapest/fastest) transportation
			for ( var i= 0; i < directTransportations.length; i++ ) {
				var currentTransportation = new Transportation( directTransportations[i] ); 
				currentTransportation.computeEffectiveCost();
				currentTransportation.computeTravelTimeInMin();

				if ( !bestDeal || currentTransportation[propertyToCompare] < bestDeal[propertyToCompare] ){
					bestDeal = this.helpers.deepCopy( currentTransportation );
				}
			}
			//fill the cache with the computed value
			cacheContainer[cachePropertyName][pDeparture + "|" + pArrival] = this.helpers.deepCopy( bestDeal );
		}

		return cacheContainer[cachePropertyName][pDeparture + "|" + pArrival];

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

			errorMessage: "",

			travelsDataFetched: false,
			travelsUrl: "data/response.json",
			travelsData: {},

			departures: [],
			arrivals: [],

			currentDeparture: "0",
			currentArrival: "0",

			neighboursMap: [],

			displayResult: false,

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

		},
		setDeals: function( dealsData ){
			if ( dealsData ) {
				this.travelsData = this.helpers.deepCopy( dealsData );
				this.travelsDataFetched = true;
				this.processFormValues();
				/* for each city we set neighboring cities */
				this.generateMap();
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
			var params = {};
			this.getContent( 
				this.travelsUrl, 
				params, 
				this.setDeals
			);
		},
		setTimeSort: function() {
			this.sortByTime = true;
			this.sortByPrice = false;
		},
		setPriceSort: function() {
			this.sortByTime = false;
			this.sortByPrice = true;
		},
		displayError: function( msg ) {
			this.errorMessage = msg;
		},
		launchSearchFormControl: function() {
			var bothValuesSet = this.currentDeparture != "0" && this.currentArrival != "0";
			var bothValuesDifferent = ( this.currentDeparture != this.currentArrival );

			if ( !bothValuesSet ) {
				this.displayError( this.BOTH_VALUES_SET_MSG );
			}

			if ( !bothValuesDifferent ) {
				this.displayError( this.BOTH_VALUES_DIFFERENT_MSG );
			}
			return (bothValuesSet && bothValuesDifferent);
		},
		launchSearch: function() {

			/* djikstras algorithm doesn't seem to be the most 
				suitable for this situation */

			console.time("Launchsearch processing time");
			/*  init results paths */
			this.correctPaths = [];	

			var formOk = this.launchSearchFormControl();

			if (!formOk){
				return;
			}

			this.correctPaths = 
				this.pItineraryService.findAllPathsFromAToB( 
					this.currentDeparture, this.currentArrival, [], this.neighboursMap, this);

			/* 2 - remove duplicates */
			this.correctPaths = this.helpers.removeDuplicates(this.correctPaths);

			/* 3 - we chose the cheapest/fastest */
			var bestItinerary = 
				this.pItineraryService.getBestItinerary( 
					this.correctPaths, this.sortByPrice, this.sortByTime, this, this.travelsData );
			
			this.processedItinerary = new Itinerary( bestItinerary );
			this.processedItinerary.computeAdditionalInformations();
			console.timeEnd("Launchsearch processing time");

			this.displayResult = true;

		},
		generateMap: function() {

			//key: town, value: array of neighboring towns
			for ( var i = 0; i < this.travelsData.deals.length; i++ ){

				var currentDeparture = this.travelsData.deals[i].departure;
				var currentArrival = this.travelsData.deals[i].arrival;
				//var townIndex = this.departures.indexOf( currentDeparture );

				if (!this.neighboursMap[ currentDeparture ]) {
					this.neighboursMap[ currentDeparture ] = [];
				}

				if ( this.neighboursMap[ currentDeparture ].indexOf( currentArrival ) < 0 ){
					this.neighboursMap[ currentDeparture ].push( currentArrival  );
				}
			}
		},
		
	},
	mounted: function(){
		this.getTravelsData();
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

function tests(){

	function processItinerary( pDeparture, pArrival, sortByPrice, sortByTime ) {

		var correctPathsContainerObject = {};
		var neighboursMap = app.neighboursMap;

		itineraryService.findAllPathsFromAToB( 
			pDeparture, pArrival, [], neighboursMap, correctPathsContainerObject);

		correctPaths = helpers.removeDuplicates(correctPathsContainerObject.correctPaths);

		correctPathsContainerObject = null;

		var cacheContainer = {};
		cacheContainer.cheapestTransportations= [];
		cacheContainer.fastestTransportations= [];

		var travelsData = app.travelsData;

		var processedItinerary = 
			new Itinerary( 
				itineraryService
					.getBestItinerary( 
						correctPaths, sortByPrice, sortByTime, cacheContainer, travelsData ) );

		processedItinerary.computeAdditionalInformations();	

		return processedItinerary;

	}

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