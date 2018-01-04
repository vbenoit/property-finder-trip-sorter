

app = new Vue({
	http: Vue.http,

	data: function() {
	
		return {
			dataFetched: false,
			dataUrl: "data/response.json",
			travelsData: {}
		}

	},
	methods: {
    	getContent: function( url, data, updatedObject, updatedFlag ) {

    		debugger;

      		Vue.http.get( url, data ).then(

          		function( response ) {

              		object.value = deepCopy( response.body );
              		flag = true;

            	}, 

          		function ( response ) {

            		console.log("getContent - error: " + response.statusText );

          		}

      		);

    	} 
  	},
  	mounted: function(){
  		this.getContent( this.dataUrl, {}, this.travelsData, this.dataFetched );
  	}

}).$mount("#app");