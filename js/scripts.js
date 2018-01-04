app = new Vue({
	http: Vue.http,

	data: function() {

		return {
			travelsDataFetched: false,
			travelsUrl: "data/response.json",
			travelsData: {},

			departures: [],
			arrivals: []
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
		deepCopy: function( object ) {
			return JSON.parse( JSON.stringify( object ) );
		},
		setDeals: function( dealsData ){
			if ( dealsData ) {
				this.travelsData = this.deepCopy( dealsData );
				this.travelsDataFetched = true;
				this.processFormValues();
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
		}
	},
	mounted: function(){
		this.getTravelsData();
	}
}).$mount("#app");