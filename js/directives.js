if(window.skin){
	window.skin.addDirectives = function(module, done){

		//We have to remove existing directives we want to replace, otherwise it breaks.
		module.config(function($provide){
			$provide.decorator('inputPasswordDirective', ['$delegate', function($delegate) {
				$delegate.shift();
				return $delegate;
			}]);
			$provide.decorator('adminPortalDirective', ['$delegate', function($delegate) {
				$delegate.shift();
				return $delegate;
			}]);
		});

		module.directive('inputPassword', function(){
			return {
				restrict: 'E',
				replace: false,
				template:
					'<input type="password" autocomplete="off"/>' +
					'<button type="button" ng-class="{ pushed: toggle }" ng-click="show(!toggle)"></button>',
				scope: true,
				compile: function(element, attributes){
					element.addClass('toggleable-password');
					var passwordInput = element.children('input[type=password]');
					for(var prop in attributes.$attr){
						passwordInput.attr(attributes.$attr[prop], attributes[prop]);
						element.removeAttr(attributes.$attr[prop]);
					}

					return function(scope){
						scope.toggle = false

						scope.show = function(bool){
							scope.toggle = bool
							passwordInput[0].type = bool ? "text" : "password"
						}
					};
				}
			}
		});

		module.directive('xiti', function($http){
			return {
				restrict: 'E',
				replace: false,
				scope: false,
				compile: function(element, attributes){
					return function(scope){
						scope.locationPath = window.location.pathname

						scope.setLocation = function(newPath){
							scope.locationPath = newPath
						}

						//Xiti script path
						scope.scriptPath = skin.basePath + 'js/xtfirst_ENT.js'

						//Profile id map
						scope.profileMap = {
							"Student": 1,
							"Teacher": 2,
							"Relative": 3,
							"Personnel": 4
						}

						//Service map
						scope.serviceMap = {
							"": "Page_ENT",
							1:  "Stockage_Partage",
							2:  "Travail_Collaboratif",
							3:  "Notes",
							4:  "Absences",
							5:  "Services_Vie_Scolaire",
							6:  "Gestion_Competences",
							7:  "Gestion_Temps",
							9:  "Cahier_Textes",
							10: "Courrier_Electronique",
							11: "Actualites",
							12: "Reservation_Ressources",
							13: "Ressources_En_Ligne",
							15: "Documentation_CDI",
							16: "Orientation",
							17: "Parcours_Pedagogiques",
							18: "Services_Collectivites",
							19: "Visioconference"
						}

						 /////////////
						/// Tools ///

						var hookCheck = function(hook){ if(typeof(hook) === 'function'){ hook() }}

						var getOrElse = function(map, item, elseItem){
							if(map && item && map[item])
								return map[item]
							return elseItem
						}

						var convertStringId = function(stringId){
							var buffer = ""
							for(var i = 0; i < stringId.length; i++){
								buffer += stringId.charCodeAt(i)
							}
							return buffer
						}

						//Synchronizes in a given order
						var synchronize = function(){
							if(arguments.length === 0)
								return
							if(arguments.length === 1)
								return arguments[arguments.length - 1]()

							var launchPile = arguments[arguments.length - 1]
							for(var i = arguments.length - 2; i >= 0; i--){
								launchPile = arguments[i](launchPile)
							}
							return launchPile()
						}
						 ///        ///
						//////////////

						// CONF OBJECT //
						scope.xitiConf = {
							//Springboard constants
							ID_COLLECTIVITE: "",
							ID_PLATEFORME: "",
							ID_PROJET: "",

							//Structure var
							ID_ETAB : "",

							//App vars
							ID_SERVICE: "",
							LIB_SERVICE: "Page_ENT",

							//User vars
							ID_PERSO: convertStringId(model.me.userId),
							ID_PROFIL: 6
						}

						//Retrieves structure mapping & platform dependant vars
						var getXitiConfig = function(hook){
							return function(){
								$http.get('/xiti/config').success(function(data){
									//If XiTi is disabled
									if(!data.active)
										return

									scope.xitiConf.ID_COLLECTIVITE = data.ID_COLLECTIVITE
									scope.xitiConf.ID_PLATEFORME = data.ID_PLATEFORME
									scope.xitiConf.ID_PROJET = data.ID_PROJET

									scope.xitiConf.ID_ETAB =
										model.me.structures.length > 0 ?
										data.structureMap[model.me.structures[0]] :
										0

									hookCheck(hook)
								})
							}
						}

						//Retrieves user profile
						var getProfileInfos = function(hook){
							return function(){
								if(model.me.profiles){
									scope.xitiConf.ID_PROFIL = getOrElse(scope.profileMap, model.me.profiles[0], 6)
									hookCheck(hook)
									return
								}

								if(http().events['request-started.refreshAvatar'])
									http().bind('request-ended.refreshAvatar', function(){
										scope.xitiConf.ID_PROFIL = getOrElse(scope.profileMap, model.me.profiles[0], 6)
										hookCheck(hook)
									})
								else
									http().get('/userbook/api/person').done(function(result){
										model.me.profiles = result.result['0'].type
										scope.xitiConf.ID_PROFIL = getOrElse(scope.profileMap, model.me.profiles[0], 6)
										hookCheck(hook)
									})
							}
						}

						//Retrieves application dependent vars
						var getAppsInfos = function(hook){
							return function(){

								//!\ Temporary Userbook workaround  /!\
								var inUserbook = scope.locationPath.indexOf("/userbook") === 0
								////////////////////////////////////////

								// Eliot workaround //
								var inEliot = false;
								if(typeof eliotPrefix !== "undefined"){
									inEliot = true
								}

								$http.get('/' + (inUserbook ? 'directory' : inEliot ? 'eliot' : appPrefix) + '/conf/public').success(function(data){
									var currentLocation = inEliot ? '/eliot/'+eliotPrefix : scope.locationPath

									var serviceObj = getOrElse(data.xiti, 'ID_SERVICE', {})
									scope.xitiConf.ID_SERVICE = getOrElse(serviceObj, 'default', '')
									for(var prop in serviceObj){
										if(prop !== 'default' && serviceObj.hasOwnProperty(prop) && currentLocation.indexOf(prop) >= 0){
											scope.xitiConf.ID_SERVICE = serviceObj[prop]
											break;
										}
									}

									scope.xitiConf.ID_SERVICE = isNaN(scope.xitiConf.ID_SERVICE) ? '' : scope.xitiConf.ID_SERVICE
									scope.xitiConf.LIB_SERVICE = getOrElse(scope.serviceMap, scope.xitiConf.ID_SERVICE, "Page_ENT")

									hookCheck(hook)
								}).error(function(){
									hookCheck(hook)
								})
							}
						}

						//Final action - populates xiti vars & launches the script
						var loadScript = function(){
							//console.log(scope.xitiConf)

							xt_multc = "&x1=" + scope.xitiConf.ID_SERVICE +
								"&x2=" + scope.xitiConf.ID_PROFIL +
								"&x3=" + scope.xitiConf.ID_PROJET +
								"&x4=" + scope.xitiConf.ID_PLATEFORME

							xt_at = scope.xitiConf.ID_PERSO;
							xtidc = scope.xitiConf.ID_PERSO;
							xt_ac = scope.xitiConf.ID_PROFIL;

							window.xtparam = xt_multc + "&ac="+ xt_ac  +"&at=" + xt_at

							xtnv = document;
							xtsd = window.location.protocol === "https:" ? "https://logs" : "http://logi7";
							xtsite = scope.xitiConf.ID_COLLECTIVITE;
							xtn2 = scope.xitiConf.ID_ETAB;
							xtpage = scope.xitiConf.LIB_SERVICE;
							xtdi = "";

							loader.asyncLoad(scope.scriptPath, function(){})
						}

						//Script needs to be loaded only *after* everything is complete
						synchronize(
							getXitiConfig,
							getProfileInfos,
							getAppsInfos,
							loadScript)

						element.on('run.script', function(event, url){
							if(url)
								scope.setLocation(url)
							synchronize(
								getXitiConfig,
								getProfileInfos,
								getAppsInfos,
								loadScript)
						})

						scope.$on("$destroy", function() {
							element.off();
						})

					};
				}
			};
		});

		module.directive('adminPortal', function($compile){
			skin.skin = 'admin';
			skin.theme = '/public/admin/default/';
			return {
				restrict: 'E',
				transclude: true,
				templateUrl: '/public/admin/portal.html',
				compile: function(element, attributes, transclude){
					element.append('<xiti></xiti>') //<- Adds the XiTi directive
					$('[logout]').attr('href', '/auth/logout?callback=' + skin.logoutCallback);
					http().get('/userbook/preference/admin').done(function(data){
						var theme = data.preference ? JSON.parse(data.preference) : null

						if(!theme || !theme.path)
							ui.setStyle(skin.theme)
						else{
							ui.setStyle('/public/admin/'+theme.path+'/')
						}
					}).error(function(error){
						ui.setStyle(skin.theme)
					})
				}
			}
		});

		done();
	}
}
