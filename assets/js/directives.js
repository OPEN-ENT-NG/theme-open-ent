console.log("ent additionnal directives");

var addDirectives = function (module, done) {
  //We have to remove existing directives we want to replace, otherwise it breaks.
  module.config(function ($provide) {
    $provide.decorator("inputPasswordDirective", [
      "$delegate",
      function ($delegate) {
        $delegate.shift();
        return $delegate;
      },
    ]);
    $provide.decorator("adminPortalDirective", [
      "$delegate",
      function ($delegate) {
        $delegate.shift();
        return $delegate;
      },
    ]);
  });

  module.directive("inputPassword", function () {
    return {
      restrict: "E",
      replace: false,
      template:
        '<input type="password" autocomplete="off"/>' +
        '<button type="button" ng-class="{ pushed: toggle }" ng-click="show(!toggle)"></button>',
      scope: true,
      compile: function (element, attributes) {
        element.addClass("toggleable-password");
        var passwordInput = element.children("input[type=password]");
        for (var prop in attributes.$attr) {
          passwordInput.attr(attributes.$attr[prop], attributes[prop]);
          element.removeAttr(attributes.$attr[prop]);
        }

        return function (scope) {
          scope.toggle = false;

          scope.show = function (bool) {
            scope.toggle = bool;
            passwordInput[0].type = bool ? "text" : "password";
          };
        };
      },
    };
  });

  // Same link as the React header (@edifice.io/react/homepage): open the
  // customization page, which redirects back to the current page on save.
  module.directive("customizeLink", function () {
    return {
      restrict: "A",
      link: function (scope, element) {
        var updateHref = function () {
          element.attr(
            "href",
            "/timeline/customize?callback=" +
              encodeURIComponent(window.location.pathname + window.location.search)
          );
        };
        updateHref();
        // The current URL can change after link time (client-side routing).
        element.on("mousedown focus", updateHref);
      },
    };
  });

  module.directive("adminPortal", function ($compile) {
    skin.skin = "admin";
    skin.theme = "/public/admin/default/";
    return {
      restrict: "E",
      transclude: true,
      templateUrl: "/public/admin/portal.html",
      compile: function (element, attributes, transclude) {
        $("[logout]").attr(
          "href",
          "/auth/logout?callback=" + skin.logoutCallback
        );
        http()
          .get("/userbook/preference/admin")
          .done(function (data) {
            var theme = data.preference ? JSON.parse(data.preference) : null;

            if (!theme || !theme.path) ui.setStyle(skin.theme);
            else {
              ui.setStyle("/public/admin/" + theme.path + "/");
            }
          })
          .error(function (error) {
            ui.setStyle(skin.theme);
          });
      },
    };
  });

  done();
};

if (window.skin) {
  window.skin.addDirectives = addDirectives;
}
if (entcore.skin) {
  entcore.skin.addDirectives = addDirectives;
  window.skin = entcore.skin;
}
