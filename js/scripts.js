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
	}
}

app = new Vue({
	http: Vue.http,

	data: function() {

		return {

			sortByPrice: true,
			sortByTime: false,

			PRICE_SORT_TYPE: "price",
			TIME_SORT_TYPE: "time",

			travelsDataFetched: false,
			travelsUrl: "data/response.json",
			travelsData: {},

			departures: [],
			arrivals: [],

			currentDeparture: "0",
			currentArrival: "0",

			neighboursMap: [],

			correctPaths: []

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

			if ( this.currentDeparture != "0" && this.currentArrival != "0" ) {
				ways= this.findAllWaysFromAToB( this.currentDeparture, this.currentArrival, []);
			}

			console.log( this.correctPaths );

			/* 2 - remove duplicates */

			/* 3 - for all these ways we compute all combinaison by train, bus, plane with theirs duration and prices */

			/* 4 - we chose the cheapest/fastest */

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
				return [ src, dest ];
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
						var result = excludedPoints.concat( path );
						this.correctPaths.push( result );
						console.log(this.correctPaths.length + ' | ' +  result);
					}
				}
			}

		}
	},
	mounted: function(){
		this.getTravelsData();
	}
}).$mount("#app");