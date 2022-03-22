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

  module.directive("adminPortal", function ($compile) {
    skin.skin = "admin";
    skin.theme = "/public/admin/default/";
    return {
      restrict: "E",
      transclude: true,
      templateUrl: "/public/admin/portal.html",
      compile: function (element, attributes, transclude) {
        element.append("<xiti></xiti>"); //<- Adds the XiTi directive
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
