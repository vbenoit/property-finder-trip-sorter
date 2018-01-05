helpers = {
	arrayContains: function( container, contained ){

	    for(var i=0;i<contained.length;i++){
	         if( container.indexOf( contained[i] ) < 0 ){
	         	return false;
	         } 
	    }
	    return true;

	},
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

	}
}

//[].prototype.containsArray = helpers.arrayContains;

app = new Vue({
	http: Vue.http,

	data: function() {

		return {

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
		getContent: function( url, data, successProcessCallbackMethod ) {

			Vue.http.get( url, data ).then(

				function( response ) {
					if ( successProcessCallbackMethod ){
						successProcessCallbackMethod( response.body );
					}
				}, 
				function ( response ) {
					console.log("getContent - error: " + response.statusText );
				}

			);

		},
		setDeals: function( dealsData ){
			if ( dealsData ) {
				this.travelsData = helpers.deepCopy( dealsData );
				this.travelsDataFetched = true;
				this.processFormValues();
				/* for each town we set neighbor town */
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
			this.processList( this.travelsData.deals, "departure", "departures" );
		},
		processArrivalsList: function(){
			this.processList( this.travelsData.deals, "arrival", "arrivals" );
		},
		processList: function( sourceList, sourceProperty, list ) {
			if ( sourceList ){
				//push each different value
				for ( var i = 0; i < sourceList.length; i++ ) {
					if ( this[list].indexOf( sourceList[i][sourceProperty] ) 
							< 0 ){
						this[list].push( sourceList[i][sourceProperty] );
					}
				}
				//sort
				this[list].sort( this.alphabeticalSort );
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
		launchSearch: function() {

			/* djikstras algorithm doesn't seem to be the most 
				adequate for this situation */

			/*  init results paths */
			this.correctPaths = [];	

			var bothValuesSet = this.currentDeparture != "0" && this.currentArrival != "0";
			var bothValuesDifferent = ( this.currentDeparture != this.currentArrival );

			if ( !bothValuesSet ) {
				this.errorMessage = this.BOTH_VALUES_SET_MSG;
				return;
			}

			if ( !bothValuesDifferent ) {
				this.errorMessage = this.BOTH_VALUES_DIFFERENT_MSG;
				return;
			}

			if ( bothValuesSet && bothValuesDifferent ) {
				ways= this.findAllWaysFromAToB( this.currentDeparture, this.currentArrival, []);
				this.correctPaths = this.correctPaths.concat( [ways] );
			}

			console.log( this.correctPaths.length + " - before removing duplicates" );

			/* 2 - remove duplicates */
			this.correctPaths = helpers.removeDuplicates(this.correctPaths);

			console.log( this.correctPaths.length + " - after removing duplicates" );

			/* 3 - we chose the cheapest/fastest */
			this.processedItinerary = helpers.deepCopy( this.getBestItinerary() );
			//Vue.set(app, "processedItinerary", this.getBestItinerary());

			this.displayResult = true;
			
			/* processing for additional informations */
			this.processedItinerary.totalCost = 
				this.processedItinerary.reduce( 
					function( totalAmount, currentTransportation ) { 
						return totalAmount + currentTransportation.discountedCost 
					}, 0 );

			//debugger;

		},
		getBestItinerary: function() {

			var smallestAmount = null;
			var bestItineraryIndex = null;
			var bestItinerary = null;

			for ( var i=0, l = this.correctPaths.length; i < l; i++ ) {
				currentAmount = 0;
				var currentItinerary = [];
				var nullTransportation = false;
				for ( var j=0; j < this.correctPaths[i].length - 1; j++ ){
					
					var bestTransportation = null;

					if ( this.sortByPrice ) { 
						bestTransportation = 
							this.getCheapestTransportation( 
								this.correctPaths[i][j], 
								this.correctPaths[i][j + 1] 
							);
					}
					else if ( this.sortByTime ) { 
						bestTransportation = 
							this.getFastestTransportation( 
								this.correctPaths[i][j], 
								this.correctPaths[i][j + 1] 
							);
					}

					if (!bestTransportation){
						nullTransportation = true;
						break;
					}

					if ( this.sortByPrice ) { 
						currentAmount += bestTransportation.discountedCost;
					}
					if ( this.sortByTime ){
						currentAmount += bestTransportation.travelTime
					}
					currentItinerary.push( helpers.deepCopy( bestTransportation) );
				}

				if ( nullTransportation ){
					continue;
				}

				if ( smallestAmount == null || currentAmount < smallestAmount ){
					smallestAmount = currentAmount;
					bestItineraryIndex = i;
					bestItinerary = helpers.deepCopy( currentItinerary );
				}
			}

			return bestItinerary;

		},
		getCheapestTransportation: function( pDeparture, pArrival ) {

			function effectiveCost( transportation ) {
				return transportation.cost * ( 100 - transportation.discount ) / 100; 
			}
			//var useCache = true;
			
			//a cache system
			if ( !this.cheapestTransportations[pDeparture + "|" + pArrival] ) {
				//useCache = false;
				var directTransportations = this.getDirectTransportations( pDeparture, pArrival );
				var bestDeal = null;
				//the cheapest transportation
				for ( var i= 0; i < directTransportations.length; i++ ) {
					directTransportations[i].discountedCost = 
						effectiveCost( directTransportations[i] );
					if ( !bestDeal || directTransportations[i].discountedCost < bestDeal.discountedCost ){
						bestDeal = directTransportations[i];
					}
				}
				//fill the cache with the computed value
				this.cheapestTransportations[pDeparture + "|" + pArrival] = helpers.deepCopy( bestDeal );
			}

			/*if ( useCache ) {
				console.log( "useCache: " + pDeparture + "|" + pArrival );
			}*/
			return this.cheapestTransportations[pDeparture + "|" + pArrival];

		},
		getFastestTransportation: function( pDeparture, pArrival ) {

			function travelTime( transportation ) {
				return parseInt( transportation.duration.h ) * 60  + parseInt( transportation.duration.m ); 
			}

			//a cache system
			if ( !this.fastestTransportations[pDeparture + "|" + pArrival] ) {
				//useCache = false;
				var directTransportations = this.getDirectTransportations( pDeparture, pArrival );
				var bestDeal = null;
				//the fastest transportation
				for ( var i= 0; i < directTransportations.length; i++ ) {
					directTransportations[i].travelTime = 
						travelTime( directTransportations[i] );
					if ( !bestDeal || directTransportations[i].travelTime < bestDeal.travelTime ){
						bestDeal = directTransportations[i];
					}
				}
				//fill the cache with the computed value
				this.fastestTransportations[pDeparture + "|" + pArrival] = helpers.deepCopy( bestDeal );
			}

			return this.fastestTransportations[pDeparture + "|" + pArrival];

		},
		getDirectTransportations: function( pDeparture, pArrival ) {
			return this.travelsData.deals.filter( function( travel ) {
				return ( travel.departure === pDeparture && travel.arrival === pArrival  );
			} );
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
		/*2- finds all ways from a to b
				we start from the departure
				we check all of the consecutives town
				we note each town we pass by
				we don't go back to a town already seen
				until: 
					1 - there are no new town
					2 - or the town is destination
				if 2 , we add it to paths to check
			*/
		findAllWaysFromAToB: function( src, dest, excludedPoints ) {

			//dest in direct src neighbors
			if ( this.neighboursMap[src].indexOf(dest) >= 0 ) {
				//direct transportation
				if ( excludedPoints.length === 0 ){
					this.correctPaths.push( [ src, dest ] );
				}
				else{
					return [ src , dest ];
				}
			}
			//all neighbors excluded
			if ( helpers.arrayContains( excludedPoints, this.neighboursMap[src] ) ) {
				return null;
			}

			for ( var i = 0; i < this.neighboursMap[src].length; i ++ ) {
				//current neighbor not excluded
				if ( excludedPoints.indexOf( this.neighboursMap[src][ i ] ) < 0  ){
					var updatedExcludedPoints = 
						excludedPoints.indexOf(src) < 0 ? excludedPoints.concat([src]) : excludedPoints;
					var path = this.findAllWaysFromAToB( this.neighboursMap[src][ i ], dest, updatedExcludedPoints );
					if ( path ){
						var result;
						if ( excludedPoints.length == 0 ){
							result = [src].concat(path);
						}
						else{ 
							result = updatedExcludedPoints.concat( path );
						}
						this.correctPaths.push( result );
						//console.log(this.correctPaths.length + ' | ' +  result);
					}
				}
			}

		}
	},
	mounted: function(){
		this.getTravelsData();
	}
}).$mount("#app");