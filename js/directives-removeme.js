if(window.skin){
	window.skin.addDirectives = function(module, done){

		//We have to remove existing directives we want to replace, otherwise it breaks.
		module.config(function($provide){
			$provide.decorator('inputPasswordDirective', ['$delegate', function($delegate) {
				$delegate.shift();
				return $delegate;
			}]);
		});

		//We can also do fun stuff like adding factories and things...
		module.service('whatever', function(){
			return function(){
				console.log('whatever');
			}
		});

		//...and change setup and routing. But we're not doing that.
		//We'll just add the added directives we need.
		module.directive('inputPassword', function(){
			return {
				restrict: 'E',
				template: '<div>hooray !</div>'
			}
		});

		//Then we're done().
		done();
		//Of course, if we need to load additional stuff, we can always be done() later.
	}
}