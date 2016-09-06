'use strict';

var controllerModule = angular.module('uchiwa.controllers', []);

/**
* Aggregate
*/
controllerModule.controller('AggregateController', ['backendService', '$http', '$rootScope', '$scope', '$routeParams', 'routingService', 'Sensu', 'titleFactory',
  function (backendService, $http, $rootScope, $scope, $routeParams, routingService, Sensu, titleFactory) {
    $scope.pageHeaderText = 'Aggregates';
    titleFactory.set($scope.pageHeaderText);

    // Routing
    $scope.dc = decodeURI($routeParams.dc);
    $scope.name = decodeURI($routeParams.name);

    // Get aggregates
    $scope.aggregates = [];
    var timer = Sensu.updateAggregates();
    $scope.$watch(function () { return Sensu.getAggregates(); }, function (data) {
      $scope.aggregates = _.find(data, function(aggregate) { // jshint ignore:line
        return $scope.name === aggregate.name && $scope.dc === aggregate.dc;
      });
    });
    $scope.$on('$destroy', function() {
      Sensu.stop(timer);
    });

    // Add support for aggregates v2.0 in Sensu >= 0.24.0
    $scope.$watch('aggregates', function () {
      if (angular.isDefined($scope.aggregates) && angular.isUndefined($scope.aggregates.issued)) {
        backendService.getAggregate($scope.name, $scope.dc)
          .success(function(data) {
            $scope.aggregate = data;
          })
          .error(function(error) {
            $scope.aggregate = null;
            console.error(error);
          });
      }
    });

    // Get aggregate
    $scope.aggregate = null;
    var getAggregate = function() {
      $scope.issued = decodeURI($routeParams.issued);
      if (isNaN($scope.issued)) {
        $scope.aggregate = null;
        return;
      }
      backendService.getAggregateIssued($scope.name, $scope.dc, $scope.issued)
        .success(function(data) {
          $scope.aggregate = {results: data};
        })
        .error(function(error) {
          $scope.aggregate = null;
          console.error(error);
        });
    };
    $scope.$on('$routeChangeSuccess', function(){
      getAggregate();
    });
    $scope.$on('$routeUpdate', function(){
      getAggregate();
    });

    // Services
    $scope.go = routingService.go;
    $scope.permalink = routingService.permalink;
  }
]);

/**
* Aggregates
*/
controllerModule.controller('AggregatesController', ['filterService', '$routeParams', 'routingService', '$scope', 'Sensu', 'titleFactory',
  function (filterService, $routeParams, routingService, $scope, Sensu, titleFactory) {
    $scope.pageHeaderText = 'Aggregates';
    titleFactory.set($scope.pageHeaderText);

    $scope.predicate = 'check';
    $scope.reverse = false;

    // Get aggregates
    $scope.aggregates = [];
    var timer = Sensu.updateAggregates();
    $scope.$watch(function () { return Sensu.getAggregates(); }, function (data) {
      $scope.aggregates = data;
    });
    $scope.$on('$destroy', function() {
      Sensu.stop(timer);
    });

    // Routing
    $scope.filters = {};
    routingService.initFilters($routeParams, $scope.filters, ['dc', 'limit', 'q']);
    $scope.$on('$locationChangeSuccess', function(){
      routingService.updateFilters($routeParams, $scope.filters);
    });

    // Services
    $scope.filterComparator = filterService.comparator;
    $scope.go = routingService.go;
    $scope.permalink = routingService.permalink;
  }
]);

/**
* Checks
*/
controllerModule.controller('ChecksController', ['checksService', '$filter', 'filterService', 'helperService', '$routeParams', 'routingService', '$scope', 'Sensu', 'titleFactory',
  function (checksService, $filter, filterService, helperService, $routeParams, routingService, $scope, Sensu, titleFactory) {
    $scope.pageHeaderText = 'Checks';
    titleFactory.set($scope.pageHeaderText);

    $scope.predicate = 'name';
    $scope.reverse = false;
    $scope.selected = {all: false, ids: {}};

    // Get checks
    $scope.checks = [];
    $scope.filtered = [];
    var timer = Sensu.updateChecks();
    $scope.$watch(function () { return Sensu.getChecks(); }, function (data) {
      $scope.checks = data;
      updateFilters();
    });
    $scope.$on('$destroy', function() {
      Sensu.stop(timer);
    });

    // Helpers
    $scope.subscribersSummary = function(subscribers){
      return subscribers.join(' ');
    };

    // Filters
    $scope.$watchGroup(['collection.search', 'filters.q', 'filters.dc'], function(newValues, oldValues) {
      updateFilters();
      helperService.updateSelected(newValues, oldValues, $scope.filtered, $scope.selected);
    });

    // Routing
    $scope.filters = {};
    routingService.initFilters($routeParams, $scope.filters, ['dc', 'limit', 'q']);
    $scope.$on('$locationChangeSuccess', function(){
      routingService.updateFilters($routeParams, $scope.filters);
    });

    // Services
    $scope.filterComparator = filterService.comparator;
    $scope.permalink = routingService.permalink;
    $scope.selectAll = helperService.selectAll;

    $scope.issueCheckRequest = function() {
      var items = helperService.getSelected($scope.filtered, $scope.selected);
      angular.forEach(items, function(item) {
        checksService.issueCheckRequest(item.name, item.dc, item.subscribers);
      });
    };

    var updateFilters = function() {
      var filtered = $filter('filter')($scope.checks, {dc: $scope.filters.dc}, $scope.filterComparator);
      filtered = $filter('filter')(filtered, $scope.filters.q);
      filtered = $filter('collection')(filtered, 'checks');
      $scope.filtered = filtered;
    };
  }
]);

/**
* Client
*/
controllerModule.controller('ClientController', ['backendService', 'clientsService', 'conf', '$filter', 'notification', 'titleFactory', '$routeParams', 'routingService', '$scope', 'Sensu', 'stashesService', 'userService',
  function (backendService, clientsService, conf, $filter, notification, titleFactory, $routeParams, routingService, $scope, Sensu, stashesService, userService) {
    $scope.predicate = '-last_status';
    $scope.reverse = false;

    // Routing
    $scope.clientName = decodeURI($routeParams.client);
    $scope.dc = decodeURI($routeParams.dc);

    // Get client
    $scope.client = null;
    var clientTimer = Sensu.updateClient($scope.clientName, $scope.dc);
    $scope.$watch(function () { return Sensu.getClient(); }, function (data) {
      $scope.client = data;
      getCheck();
    });

    // Get events
    var events = [];
    var eventsTimer = Sensu.updateEvents();
    $scope.$watch(function () { return Sensu.getEvents(); }, function (data) {
      events = data;
    });

    $scope.$on('$destroy', function() {
      Sensu.stop(clientTimer);
      Sensu.stop(eventsTimer);
      Sensu.cleanClient();
    });

    // Get check
    $scope.check = null;
    var checkName = null;
    // return the events or the client's history
    var getCheck = function() {
      if (!$scope.client || !$scope.client.name) {
        return;
      }

      if (angular.isDefined($routeParams.check)) {
        checkName = $routeParams.check;
        var check = searchCheckHistory(checkName, $scope.client.history);
        if (!check) {
          return;
        }

        if (angular.isDefined(check.last_result)) { // jshint ignore:line
          check.last_result.history = check.history; // jshint ignore:line
        }

        // apply filters
        var images = [];
        angular.forEach(check.last_result, function(value, key) { // jshint ignore:line
          value = $filter('getTimestamp')(value);
          value = $filter('richOutput')(value);

          if (/<img src=/.test(value)) {
            var obj = {};
            obj.key = key;
            obj.value = value;
            images.push(obj);
            delete check.last_result[key]; // jshint ignore:line
          } else {
            check.last_result[key] = value; // jshint ignore:line
          }
        });
        $scope.images = images;

        $scope.check = check;
        titleFactory.set(check.check + ' - ' + $scope.client.name);
      }
      else {
        $scope.check = null;
        $scope.images = null;
        checkName = null;
        titleFactory.set($scope.client.name);
      }
    };
    $scope.$on('$routeChangeSuccess', function(){
      getCheck();
    });
    $scope.$on('$routeUpdate', function(){
      getCheck();
    });

    // Services
    $scope.deleteCheckResult = clientsService.deleteCheckResult;
    $scope.deleteClient = clientsService.deleteClient;
    $scope.resolveEvent = clientsService.resolveEvent;
    $scope.permalink = routingService.permalink;
    $scope.stash = stashesService.stash;
    $scope.user = userService;
    var searchCheckHistory = clientsService.searchCheckHistory;
  }
]);

/**
* Clients
*/
controllerModule.controller('ClientsController', ['clientsService', '$filter', 'filterService', 'helperService', '$rootScope', '$routeParams', 'routingService', '$scope', 'Sensu', 'stashesService', 'titleFactory', 'userService',
  function (clientsService, $filter, filterService, helperService, $rootScope, $routeParams, routingService, $scope, Sensu, stashesService, titleFactory, userService) {
    $scope.pageHeaderText = 'Clients';
    titleFactory.set($scope.pageHeaderText);

    $scope.predicate = ['-status', 'name'];
    $scope.reverse = false;
    $scope.selected = {all: false, ids: {}};
    $scope.statuses = {0: 'Healthy', 1: 'Warning', 2: 'Critical', 3: 'Unknown'};

    // Get clients
    $scope.clients = [];
    $scope.filtered = [];
    var timer = Sensu.updateClients();
    $scope.$watch(function () { return Sensu.getClients(); }, function (data) {
      $scope.clients = data;
      updateFilters();
    });
    $scope.$on('$destroy', function() {
      Sensu.stop(timer);
    });

    // Get subscriptions
    Sensu.updateSubscriptions();
    $scope.$watch(function () { return Sensu.getSubscriptions(); }, function (data) {
      if (angular.isObject(data)) {
        $scope.subscriptions = data;
      }
    });

    // Filters
    $scope.$watchGroup(['collection.search', 'filters.q', 'filters.dc', 'filters.subscription', 'filters.status'], function(newValues, oldValues) {
      updateFilters();
      helperService.updateSelected(newValues, oldValues, $scope.filtered, $scope.selected);
    });

    // Routing
    $scope.filters = {};
    routingService.initFilters($routeParams, $scope.filters, ['dc', 'subscription', 'limit', 'q', 'status']);
    $scope.$on('$locationChangeSuccess', function(){
      routingService.updateFilters($routeParams, $scope.filters);
    });

    // Services
    $scope.filterComparator = filterService.comparator;
    $scope.go = routingService.go;
    $scope.openLink = helperService.openLink;
    $scope.permalink = routingService.permalink;
    $scope.selectAll = helperService.selectAll;
    $scope.stash = stashesService.stash;
    $scope.user = userService;
    $scope.deleteClients = function() {
      helperService.deleteItems(clientsService.deleteClient, $scope.filtered, $scope.selected).then(function(filtered){
        $scope.filtered = filtered;
      });
    };
    $scope.silenceClients = function() {
      helperService.silenceItems(stashesService.stash, $scope.filtered, $scope.selected);
    };

    var updateFilters = function() {
      var filtered = $filter('filter')($scope.clients, {dc: $scope.filters.dc}, $scope.filterComparator);
      filtered = $filter('filter')(filtered, {status: $scope.filters.status});
      filtered = $filter('filterSubscriptions')(filtered, $scope.filters.subscription);
      filtered = $filter('filter')(filtered, $scope.filters.q);
      filtered = $filter('collection')(filtered, 'clients');
      $scope.filtered = filtered;
    };
  }
]);

/**
* Datacenters
*/
controllerModule.controller('DatacentersController', ['$scope', 'Sensu', 'titleFactory',
  function ($scope, Sensu, titleFactory) {
    $scope.pageHeaderText = 'Datacenters';
    titleFactory.set($scope.pageHeaderText);

    // Get health and metrics
    var timer = Sensu.updateMetrics();
    $scope.$on('$destroy', function() {
      Sensu.stop(timer);
    });
  }
]);

/**
* Events
*/
controllerModule.controller('EventsController', ['clientsService', 'conf', '$cookieStore', '$filter', 'filterService', 'helperService', '$rootScope', '$routeParams','routingService', '$scope', 'Sensu', 'stashesService', 'titleFactory', 'userService',
  function (clientsService, conf, $cookieStore, $filter, filterService, helperService, $rootScope, $routeParams, routingService, $scope, Sensu, stashesService, titleFactory, userService) {
    $scope.pageHeaderText = 'Events';
    titleFactory.set($scope.pageHeaderText);

    $scope.filters = {};
    $scope.predicate = ['-check.status', '-check.issued'];
    $scope.reverse = false;
    $scope.selected = {all: false, ids: {}};
    $scope.statuses = {1: 'Warning', 2: 'Critical', 3: 'Unknown'};

    // Get events
    $scope.events = [];
    $scope.filtered = [];
    var timer = Sensu.updateEvents();
    $scope.$watch(function () { return Sensu.getEvents(); }, function (data) {
      if (angular.isObject(data)) {
        $scope.events = data;
        updateFilters();
      }
    });
    $scope.$on('$destroy', function() {
      Sensu.stop(timer);
    });

    // Filters
    $scope.$watchGroup(['collection.search', 'filters.q', 'filters.dc', 'filters.check' , 'filters.status' , 'filters.silenced' , 'filters.clientsSilenced' , 'filters.occurrences'], function(newValues, oldValues) {
      updateFilters();
      helperService.updateSelected(newValues, oldValues, $scope.filtered, $scope.selected);
    });

    // Routing
    routingService.initFilters($routeParams, $scope.filters, ['dc', 'check', 'limit', 'q', 'status']);
    $scope.$on('$locationChangeSuccess', function(){
      routingService.updateFilters($routeParams, $scope.filters);
    });

    // Services
    $scope.filterComparator = filterService.comparator;
    $scope.go = routingService.go;
    $scope.openLink = helperService.openLink;
    $scope.permalink = routingService.permalink;
    $scope.selectAll = helperService.selectAll;
    $scope.stash = stashesService.stash;
    $scope.user = userService;
    $scope.resolveEvents = function() {
      helperService.deleteItems(clientsService.resolveEvent, $scope.filtered, $scope.selected).then(function(filtered){
        $scope.filtered = filtered;
      });
    };
    $scope.silenceEvents = function() {
      helperService.silenceItems(stashesService.stash, $scope.filtered, $scope.selected);
    };

    var updateFilters = function() {
      var filtered = $filter('filter')($scope.events, {dc: $scope.filters.dc}, $scope.filterComparator);
      filtered = $filter('filter')(filtered, {check: {status: $scope.filters.status}});
      filtered = $filter('hideSilenced')(filtered, $scope.filters.silenced);
      filtered = $filter('hideClientsSilenced')(filtered, $scope.filters.clientsSilenced);
      filtered = $filter('hideOccurrences')(filtered, $scope.filters.occurrences);
      filtered = $filter('filter')(filtered, {check: {name: $scope.filters.check}});
      filtered = $filter('filter')(filtered, $scope.filters.q);
      filtered = $filter('collection')(filtered, 'events');
      $scope.filtered = filtered;
    };

    // Hide silenced
    $scope.filters.silenced = $cookieStore.get('hideSilenced') || conf.hideSilenced;
    $scope.$watch('filters.silenced', function () {
      $cookieStore.put('hideSilenced', $scope.filters.silenced);
    });

    // Hide events from silenced clients
    $scope.filters.clientsSilenced = $cookieStore.get('hideClientsSilenced') || conf.hideClientsSilenced;
    $scope.$watch('filters.clientsSilenced', function () {
      $cookieStore.put('hideClientsSilenced', $scope.filters.clientsSilenced);
    });

    // Hide occurrences
    $scope.filters.occurrences = $cookieStore.get('hideOccurrences') || conf.hideOccurrences;
    $scope.$watch('filters.occurrences', function () {
      $cookieStore.put('hideOccurrences', $scope.filters.occurrences);
    });
  }
]);

/**
* Info
*/
controllerModule.controller('InfoController', ['backendService', '$scope', 'Sensu', 'titleFactory', 'version',
  function (backendService, $scope, Sensu, titleFactory, version) {
    $scope.pageHeaderText = 'Info';
    titleFactory.set($scope.pageHeaderText);

    $scope.uchiwa = { version: version.uchiwa };

    // Get health and metrics
    var timer = Sensu.updateMetrics();
    $scope.$on('$destroy', function() {
      Sensu.stop(timer);
    });
  }
]);

/**
* Login
*/
controllerModule.controller('LoginController', ['audit', 'backendService', '$cookieStore', '$location', 'notification', '$rootScope', '$scope',
function (audit, backendService, $cookieStore, $location, notification, $rootScope, $scope) {

  $scope.login = {user: '', pass: ''};

  // get the authentication mode
  backendService.getConfigAuth()
    .success(function (data) {
      $scope.configAuth = data;
    })
    .error(function () {
      $scope.configAuth = 'simple';
    });

  $scope.submit = function () {
    backendService.login($scope.login)
    .success(function (data) {
      $cookieStore.put('uchiwa_auth', data);
      $rootScope.auth = {};
      $location.path('/events');
      backendService.getConfig();

      if ($rootScope.enterprise) {
        var username = data.username;
        if (angular.isUndefined(username)) {
          username = '';
        }
        audit.log({action: 'login', level: 'default'});
      }
    })
    .error(function () {
      notification('error', 'There was an error with your username/password combination. Please try again.');
    });
  };

  if (angular.isObject($rootScope.auth) || angular.isObject($rootScope.config)) {
    $location.path('/events');
  }
}
]);

/**
* Navbar
*/
controllerModule.controller('NavbarController', ['audit', '$location', '$rootScope', '$scope', 'navbarServices', 'routingService', 'userService',
  function (audit, $location, $rootScope, $scope, navbarServices, routingService, userService) {

    // Helpers
    $scope.getClass = function(path) {
      if ($location.path().substr(0, path.length) === path) {
        return 'selected';
      } else {
        return '';
      }
    };

    // Services
    $scope.go = routingService.go;
    $scope.user = userService;

    $scope.logout = function() {
      if ($rootScope.enterprise) {
        var username = userService.getUsername();
        audit.log({action: 'logout', level: 'default', user: username}).finally(
          function() {
            userService.logout();
          });
      }
      else {
        userService.logout();
      }
    };
  }
]);

/**
* Settings
*/
controllerModule.controller('SettingsController', ['$cookies', '$scope', 'Sensu', 'titleFactory',
  function ($cookies, $scope, Sensu, titleFactory) {
    $scope.pageHeaderText = 'Settings';
    titleFactory.set($scope.pageHeaderText);

    $scope.$watch('currentTheme', function (theme) {
      $scope.$emit('theme:changed', theme);
    });

    // Get health and metrics
    var timer = Sensu.updateMetrics();
    $scope.$on('$destroy', function() {
      Sensu.stop(timer);
    });
  }
]);

/**
* Sidebar
*/
controllerModule.controller('SidebarController', ['$location', 'navbarServices', '$scope', 'userService',
  function ($location, navbarServices, $scope, userService) {
    // Get CSS class for sidebar elements
    $scope.getClass = function(path) {
      if ($location.path().substr(0, path.length) === path) {
        return 'selected';
      } else {
        return '';
      }
    };

    $scope.$watch('metrics', function() {
      if (angular.isObject($scope.metrics) && angular.isDefined($scope.metrics.clients)) {
        $scope.clientsStyle = $scope.metrics.clients.critical > 0 ? 'critical' : $scope.metrics.clients.warning > 0 ? 'warning' : $scope.metrics.clients.unknown > 0 ? 'unknown' : 'success';
        $scope.eventsStyle = $scope.metrics.events.critical > 0 ? 'critical' : $scope.metrics.events.warning > 0 ? 'warning' : $scope.metrics.events.unknown > 0 ? 'unknown' : 'success';
      }
      else {
        $scope.clientsStyle = 'unknown';
        $scope.eventsStyle = 'unknown';
      }
    });

    // Services
    $scope.user = userService;
    $scope.$watch('health', function (){
      navbarServices.health();
    });
  }
]);

/**
* Stash
*/
controllerModule.controller('StashController', [ 'backendService', '$filter', '$routeParams', '$scope', 'Sensu', 'stashesService', 'titleFactory',
  function (backendService, $filter, $routeParams, $scope, Sensu, stashesService, titleFactory) {
    // Routing
    $scope.id = decodeURI($routeParams.id);
    titleFactory.set($scope.id);

    // Get the stash
    $scope.stash = null;
    var stashes = [];
    backendService.getStashes()
      .success(function (data) {
        stashes = data;

        var stash = stashesService.get(stashes, $scope.id);
        // Prepare rich output
        angular.forEach(stash.content, function(value, key) { // jshint ignore:line
          value = $filter('getTimestamp')(value);
          value = $filter('richOutput')(value);
          stash.content[key] = value; // jshint ignore:line
        });

        $scope.stash = stash;
      })
      .error(function(error) {
        if (error !== null) {
          console.error(JSON.stringify(error));
        }
      });

    // Get health and metrics
    var timer = Sensu.updateMetrics();
    $scope.$on('$destroy', function() {
      Sensu.stop(timer);
    });
  }
]);

/**
* Stash Modal
*/
controllerModule.controller('StashModalController', ['conf', '$filter', 'items', '$modalInstance', 'notification', '$q', '$scope', 'stashesService',
  function (conf, $filter, items, $modalInstance, notification, $q, $scope, stashesService) {
    $scope.items = items;
    $scope.acknowledged = $filter('filter')(items, {acknowledged: true}).length;
    $scope.itemType = items[0].hasOwnProperty('client') ? 'check' : 'client';
    $scope.stash = { 'content': {} };
    $scope.stash.expirations = {
      '900': 900,
      '3600': 3600,
      '86400': 86400,
      'none': -1,
      'custom': 'custom'
    };
    $scope.stash.reason = '';
    $scope.stash.expiration = 900;
    $scope.stash.content.to = moment().add(1, 'h').format(conf.date);


    $scope.ok = function () {
      if ($scope.stash.expiration === 'custom') {
        if (angular.isUndefined($scope.stash.content.to)) {
          notification('error', 'Please enter a date for the custom expiration.');
          return false;
        }
        $scope.stash = stashesService.getExpirationFromDateRange($scope.stash);
      }

      var promises = [];
      angular.forEach(items, function(item) {
        var deffered = $q.defer();
        stashesService.submit(item, $scope.stash).then(function() {
          deffered.resolve(item);
        }, function() {
          deffered.reject();
        });
        promises.push(deffered.promise);
      });
      $q.all(promises).then(function() {
        $modalInstance.close();
      });
    };
    $scope.cancel = function () {
      $modalInstance.dismiss('cancel');
    };

    // Services
    $scope.findStash = stashesService.find;
    $scope.getPath = stashesService.getPath;
  }
]);

/**
* Stashes
*/
controllerModule.controller('StashesController', ['$filter', 'filterService', 'helperService', '$rootScope', '$routeParams', 'routingService', '$scope', 'Sensu', 'stashesService', 'titleFactory', 'userService',
  function ($filter, filterService, helperService, $rootScope, $routeParams, routingService, $scope, Sensu, stashesService, titleFactory, userService) {
    $scope.pageHeaderText = 'Stashes';
    titleFactory.set($scope.pageHeaderText);

    $scope.predicate = 'client';
    $scope.reverse = false;
    $scope.selectAll = {checked: false};
    $scope.selected = {all: false, ids: {}};

    // Get stashes
    $scope.stashes = [];
    $scope.filtered = [];
    var timer = Sensu.updateStashes();
    $scope.$watch(function () { return Sensu.getStashes(); }, function (data) {
      $scope.stashes = data;
      updateFilters();
    });
    $scope.$on('$destroy', function() {
      Sensu.stop(timer);
    });

    // Filters
    $scope.$watchGroup(['collection.search', 'filters.q', 'filters.dc'], function(newValues, oldValues) {
      updateFilters();
      helperService.updateSelected(newValues, oldValues, $scope.filtered, $scope.selected);
    });

    // Routing
    $scope.filters = {};
    routingService.initFilters($routeParams, $scope.filters, ['dc', 'limit', 'q']);
    $scope.$on('$locationChangeSuccess', function(){
      routingService.updateFilters($routeParams, $scope.filters);
    });

    // Services
    $scope.filterComparator = filterService.comparator;
    $scope.go = routingService.go;
    $scope.permalink = routingService.permalink;
    $scope.selectAll = helperService.selectAll;
    $scope.user = userService;
    $scope.deleteStash = function($event, id) {
      $event.stopPropagation();
      stashesService.deleteStash(id).then(function() {
        $scope.filtered = $filter('filter')($scope.filtered, {_id: '!'+id});
        $rootScope.skipOneRefresh = true;
      });
    };
    $scope.deleteStashes = function() {
      helperService.deleteItems(stashesService.deleteStash, $scope.filtered, $scope.selected).then(function(filtered){
        $scope.filtered = filtered;
      });
    };

    var updateFilters = function() {
      var filtered = $filter('filter')($scope.stashes, {dc: $scope.filters.dc}, $scope.filterComparator);
      filtered = $filter('filter')(filtered, $scope.filters.q);
      filtered = $filter('collection')(filtered, 'stashes');
      $scope.filtered = filtered;
    };
  }
]);

/**
* Tenant
*/
controllerModule.controller('TenantController', ['backendService', '$scope', '$cookieStore', '$http', 'notification', 'titleFactory', 'version',
  function (backendService, $scope, $cookieStore, $http, notification, titleFactory, version) {
    var userInfo = {};
    $scope.postUser = {};
    $scope.userPasswd = {};
    $scope.editUsr = false;
    $scope.changePw = false;
    $scope.addUser = false;
	 $scope.editUserIcon = false;
	 $scope.addUserIcon = false;
	 $scope.passwdUserIcon = false;
    $scope.pageHeaderText = 'Tenant';
    titleFactory.set($scope.pageHeaderText);

    $scope.keksi = $cookieStore.get('uchiwa_auth');

    $scope.editUser = function() {
        $scope.editUsr = !$scope.editUsr;
		  $scope.editUserIcon = !$scope.editUserIcon;

		  if ($scope.changePw == true) {
			  $scope.changePw = !$scope.changePw;
			  $scope.passwdUserIcon = !$scope.passwdUserIcon;
		  } else if ($scope.addUser == true) {
			  $scope.addUser = !$scope.addUser;
			  $scope.addUserIcon = !$scope.addUserIcon;
		  };
    }

	 $scope.editUserReset = function() {
		 $scope.postUser = angular.copy($scope.userInfo);
	 };

    $scope.changePasswd = function() {
        $scope.changePw = !$scope.changePw;
		  $scope.passwdUserIcon = !$scope.passwdUserIcon;

		  if ($scope.editUsr == true) {
			  $scope.editUsr = !$scope.editUsr;
			  $scope.editUserIcon = !$scope.editUserIcon;
		  } else if ($scope.addUser == true) {
			  $scope.addUser = !$scope.addUser;
			  $scope.addUserIcon = !$scope.addUserIcon;
		  };
//		  console.log($scope.userPasswd);
    }

    $scope.addNewUser = function() {
       $scope.addUser = !$scope.addUser;
		 $scope.addUserIcon = !$scope.addUserIcon;

		 if ($scope.editUsr == true) {
			  $scope.editUsr = !$scope.editUsr;
			  $scope.editUserIcon = !$scope.editUserIcon;
		 } else if ($scope.changePw == true) {
			  $scope.changePw = !$scope.changePw;
			  $scope.passwdUserIcon = !$scope.passwdUserIcon;
		 };
    }

// PASSWORD CHANGE
    $scope.postPasswd = function() {
        var self = this;
        var data = {userName: $scope.userInfo.uid, oldPassword: $scope.userPasswd.oldPassword, newPassword: $scope.userPasswd.password1};
        console.log(data);
        console.log($scope.userPasswd);

        this.changePwd = function(payload) {
            return $http.post('post_passwd', payload);
        };

        this.changePwd(data)
        .success(function (data, status) {
            console.log("Post success!", status, data.error);
			   notification('success', '' + data.error.split(":")[1]);
//            if (data.error != null) {
//                //err = data.error.split(":");
//                notification('error', 'There was an error. ' + data.error.split(":")[1]);
//            };
        })
        .error(function (data, error) {
            console.log('Post error:' + error);
            notification('error', 'There was an error changing the password');
        });

/*        $http({
//            method:'POST',
//            url:'post_passwd',
//            data: $scope.userPasswd.password1
//        }).success(function(data, status, headers, config) {
//            $scope.passwordChanged = "OK";
//            console.log("Password changed.", $scope.passwordChanged, status);
//        });
*/
        $scope.changePasswd();
    }

// ADD NEW USER
    $scope.postNewUserForm = function() {
        var self = this;
        var data = {givenName: $scope.newUser.givenName, sn: $scope.newUser.sn, mail: $scope.newUser.mail, mobile: $scope.newUser.mobile, ou: $scope.userInfo.ou};
        /*console.log(data);
        console.log($scope.newUser.givenName, $scope.newUser.sn, $scope.newUser.mail, $scope.newUser.mobile, $scope.newUser.ou);*/

        this.newUser = function(payload) {
            return $http.post('post_adduser', payload);
        };

        this.newUser(data)
        .success(function (data, status) {
//            console.log("Post success!", status, data.error);
//            if (data.error != null) {
            if (data.status == '1') {
                notification('success', data.error);
            } else if (data.status == '0') {
                notification('error', data.error);
            };
        })
        .error(function (data, error) {
            console.log('Post error:' + error);
            notification('error', 'There was an error adding a user');
        });

        $scope.addNewUser();
    }

    $scope.sendForm = function() {
        console.log('testing form...');
        console.log($scope.testText01);
    };

// POST USER EDIT
    $scope.postUserForm = function() {
       var self = this;
		 var data = {givenName: $scope.postUser.givenName, sn: $scope.postUser.sn, mail: $scope.postUser.mail, mobile: $scope.postUser.mobile, ou: $scope.userInfo.ou};
		 console.log($scope.postUser);

       this.editUserPost = function(payload) {
			 return $http.post('post_user', payload);
		 };

		 this.editUserPost(data)
		 .success(function (data, status) {
			 if (data.status == '1') {
				 notification('success', data.error);
			 } else if (data.status == '0') {
				 notification('error', data.error);
			 };
		 })
		 .error(function (data, error) {
			 notification('error', "There was an error editing your user account.");
		 });

//		 $http({
//            method: 'POST',
//            url: 'post_user',
//            data: $scope.postUser,
//            headers: {'Content-Type': 'application/x-www-form-urlencoded'}
//        })

		 $scope.editUser();
		 $scope.userRefresh();
    };

// DOWNLOAD CUSTOMER ZIP
//	 $scope.downloadZip = function() {
//		 $http.get('get_zip')
//        .success(function (data, status) {
//          console.log("File downloaded")
//			 console.log(data)
//			 console.log(status)
//        })
//        .error(function () {
//          console.log("Could not download the file!")
//        });
//	 };
	  $scope.downloadZip = function() {
        // Resetting headers to Accept */* is necessary to perform a simple cross-site request
        // (see https://developer.mozilla.org/en-US/docs/HTTP/Access_control_CORS#Simple_requests)
//        delete $http.defaults.headers.common['X-Requested-With'];
        $http.get('get_zip', {
          responseType: "arraybuffer"
        }).
        success(function(data) {
          $scope.info =
            "Read '" + $scope.URL + "' with " + data.byteLength + " bytes in a variable of type '" + typeof(data) + "'. The original file has " + $scope.ORIGINAL_SIZE + " bytes."

// to download in IE >10 versions
          // Try using msSaveBlob if supported
          console.log("Trying saveBlob method ...");
          var blob = new Blob([data], {
            type: 'application/zip'
          });
          console.log(blob);
//          if (navigator.msSaveBlob)
//            navigator.msSaveBlob(blob, 'MonniWizard.zip');
//          else {
//            // Try using other saveBlob implementations, if available
//            var saveBlob = navigator.webkitSaveBlob || navigator.mozSaveBlob || navigator.saveBlob;
//            if (saveBlob === undefined) throw "Not supported";
////            saveBlob(blob, filename);
//				saveBlob(blob, filename);
//          }
			 window.saveAs = window.saveAs || window.webkitSaveAs || window.mozSaveAs || window.msSaveAs;
			 window.saveAs(blob, 'client.zip')
          console.log("saveBlob succeeded");

        }).
        error(function(data, status) {
          $scope.info = "Request failed with status: " + status;
        });
      };

//	  REFRESH FUNCTIONS
    $scope.userRefresh = function() {
		 $http.get('get_user')
		 .success(function(data, status) {
			  $scope.httpStatus = status;
			  $scope.userInfo = data;

	//        var lastLogin = $scope.userInfo.krbLastSuccessfulAuth;
	//
	//        lastLogin = lastLogin.slice(0,4) + "/" + lastLogin.slice(4,6) + "/" + lastLogin.slice(6,8) + " " + lastLogin.slice(8,10) + ":" + lastLogin.slice(10,12) + "UTC";
	////        console.log("lastLogin:" + lastLogin);
	//        $scope.userInfo.lastLogin = lastLogin;

			  if ($scope.userInfo.employeeType == 'admin') {
				  $scope.userInfo.isAdmin = true;
				  $scope.usersRefresh();
				  console.log($scope.userInfo);
			  };

			  $scope.postUser = angular.copy($scope.userInfo);
		 })
		 .error(function(error) {
			  console.log('Error: ' + JSON.stringify(error));
		 });
	 };

    //Last login
    //var lastLogin = $scope.user[0].krbLastSuccessfulAuth;
    //var year = lastLogin.splice(0,4);
    //$scope.user.lastLogin = year;
    console.log($scope.userInfo);

	 $scope.usersRefresh = function() {
        $http.get('get_users')
        .success(function(data, status) {
            $scope.httpStatus = status;
            $scope.users = data;
        })
        .error(function(error) {
            console.log('Error: ' + JSON.stringify(error));
        });
    };

    $scope.tenantRefresh = function() {
		 console.log("tenantRefresh")
        $http.get('get_tenant')
        .success(function(data, status) {
            $scope.httpStatus = status;
            $scope.tenant = data;
			  console.log(data)
        })
        .error(function(error) {
            console.log('Error: ' + JSON.stringify(error));
        });
    };
    console.log("Toimiiko tää??")
    $scope.userRefresh();
	 $scope.tenantRefresh();
	 $scope.usersRefresh();

    $scope.uchiwa = { version: version.uchiwa };
  }
]);
