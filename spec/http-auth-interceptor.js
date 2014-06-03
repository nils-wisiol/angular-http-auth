'use strict';

describe('http auth interceptor', function() {

  var authService, $httpBackend, $http, $scope;
  var methods = ['GET', 'POST', 'UPDATE', 'DELETE'];

  beforeEach(function() {
    // Load http-auth-interceptor module
    module('http-auth-interceptor');
  });
  
  beforeEach(function() {
    // Get services and make them available
    inject(function(_authService_, _$httpBackend_, _$http_, _$rootScope_) {
      authService = _authService_;
      $httpBackend = _$httpBackend_;
      $http = _$http_;
      $scope = _$rootScope_;
    });
    
    // Spy on $emit to detect events
    spyOn($scope, '$broadcast');  
  });
  
   afterEach(function() {
     $httpBackend.verifyNoOutstandingExpectation();
     $httpBackend.verifyNoOutstandingRequest();
   });  

  describe('events', function() {
  
    it('should broadcast "event:auth-loginRequired" on http 401 respones and "event:auth-loginConfirmed" after calling loginConfirmed', function() {
      angular.forEach(methods, function(method) {
        // require authentication (http 401)
        $httpBackend.expect(method, '/myresource').respond(401);
        $http({method: method, url: '/myresource'});
        $httpBackend.flush();
        expect($scope.$broadcast).toHaveBeenCalledWith('event:auth-loginRequired', jasmine.any(Object));        
        $scope.$broadcast.reset();
        
        // confirm auth
        $httpBackend.expect(method, '/myresource').respond(200);
        authService.loginConfirmed();
        $httpBackend.flush();
        expect($scope.$broadcast).toHaveBeenCalledWith('event:auth-loginConfirmed', undefined);        
      });
    });

    it('should broadcast "event:auth-loginRequired" on http 401 respones and "event:auth-loginCancelled" after calling loginConfirmed', function() {
      angular.forEach(methods, function(method) {
        // require authentication (http 401)
        $httpBackend.expect(method, '/myresource').respond(401);
        $http({method: method, url: '/myresource'});
        $httpBackend.flush();
        expect($scope.$broadcast).toHaveBeenCalledWith('event:auth-loginRequired', jasmine.any(Object));        
        $scope.$broadcast.reset();
        
        // confirm auth
        authService.loginCancelled();
        expect($scope.$broadcast).toHaveBeenCalledWith('event:auth-loginCancelled', undefined);        
      });
    });
    
    it('should not broadcast any event on responses other than 401', function() {
      // most of the following tests don't make sense, but they also don't hurt
      for(status = 100; status <= 599; status++) {
        angular.forEach(methods, function(method) {
          $httpBackend.expect(method, '/myresource').respond(status);
          $http({method: method, url: '/myresource'});
          $httpBackend.flush();
          expect($scope.$broadcast).not.toHaveBeenCalled();
        });
      }
    });
  
  });
  
  describe('loginAttempted()', function() {
  
    it('retries the first request and broadcasts "event:auth-loginSuccessful" if request successful', function() {
      angular.forEach(methods, function(method) {
        $httpBackend.expect(method, '/myresource').respond(401);
        $http({method: method, url: '/myresource'});
        $httpBackend.flush();
        expect($scope.$broadcast).toHaveBeenCalledWith('event:auth-loginRequired', jasmine.any(Object));        
        $scope.$broadcast.reset();
        
        $httpBackend.expect(method, '/myresource').respond(200);
        authService.loginAttempted();
        $httpBackend.flush();
        expect($scope.$broadcast).toHaveBeenCalledWith('event:auth-loginSuccessful');
      });
    });
  
    angular.forEach(methods, function(method) {
      it('retries the first request and broadcasts "event:auth-loginFailed" if request unsuccessful (' + method + ')', function() {
        $httpBackend.expect(method, '/myresource').respond(401);
        $http({method: method, url: '/myresource'});
        $httpBackend.flush();
        expect($scope.$broadcast).toHaveBeenCalledWith('event:auth-loginRequired', jasmine.any(Object));        
        $scope.$broadcast.reset();
        
        $httpBackend.expect(method, '/myresource').respond(401);
        authService.loginAttempted();
        $httpBackend.flush();
        expect($scope.$broadcast).toHaveBeenCalledWith('event:auth-loginFailed', jasmine.any(Object));
      });
    });
    
    angular.forEach(methods, function(method) {
      it('retries only the first requst if loginAttempted() is called and first request fails (' + method + ')', function() {
        $httpBackend.expect(method, '/myresource1').respond(401);
        $http({method: method, url: '/myresource1'});
        $httpBackend.expect(method, '/myresource2').respond(401);
        $http({method: method, url: '/myresource2'});
        $httpBackend.flush();
        expect($scope.$broadcast).toHaveBeenCalledWith('event:auth-loginRequired', jasmine.any(Object));        
        $scope.$broadcast.reset();
        
        $httpBackend.expect(method, '/myresource1').respond(401);
        authService.loginAttempted();
        $httpBackend.flush();
        expect($scope.$broadcast).toHaveBeenCalledWith('event:auth-loginFailed', jasmine.any(Object));
      });      
    });
    
    it('retries only all requsts if loginAttempted() is called and first request succeeds', function() {
      angular.forEach(methods, function(method) {
        $httpBackend.expect(method, '/myresource1').respond(401);
        $http({method: method, url: '/myresource1'});
        $httpBackend.expect(method, '/myresource2').respond(401);
        $http({method: method, url: '/myresource2'});
        $httpBackend.flush();
        expect($scope.$broadcast).toHaveBeenCalledWith('event:auth-loginRequired', jasmine.any(Object));        
        $scope.$broadcast.reset();
        
        $httpBackend.expect(method, '/myresource1').respond(200);
        $httpBackend.expect(method, '/myresource2').respond(200);
        authService.loginAttempted();
        $httpBackend.flush();
        expect($scope.$broadcast).toHaveBeenCalledWith('event:auth-loginSuccessful');
      });
    });    
  
    it('handles empty retry queue correctly', function() {
      authService.loginAttempted();
    });
    
    it('handles failed auth attempt correctly', function() {
      var method = 'GET';
      
      // do request without auth info and get 401
      $httpBackend.expect(method, '/myresource1').respond(401);
      $http({method: method, url: '/myresource1'});
      $httpBackend.flush();
      expect($scope.$broadcast).toHaveBeenCalledWith('event:auth-loginRequired', jasmine.any(Object));
      $scope.$broadcast.reset();
      $httpBackend.resetExpectations();
      $scope.$digest();
            
      // do request with false auth info and get 401
      $http.defaults.headers.common.Authorization = 'Basic falsecredentials';
      $httpBackend.expect(method, '/myresource1').respond(401);
      authService.loginAttempted();
      $httpBackend.flush();
      expect($scope.$broadcast).toHaveBeenCalledWith('event:auth-loginFailed', jasmine.any(Object));
      $scope.$broadcast.reset();
      $httpBackend.resetExpectations();
      $scope.$digest();
            
      // do request with right auth info and get 200
      $http.defaults.headers.common.Authorization = 'Basic goodcredentials';
      $httpBackend.expect(method, '/myresource1', undefined, function(headers) {
        return headers.Authorization == 'Basic goodcredentials';
      }).respond(200);
      authService.loginAttempted();
      $httpBackend.flush();
      expect($scope.$broadcast).toHaveBeenCalledWith('event:auth-loginSuccessful');
      $scope.$broadcast.reset();
      $httpBackend.resetExpectations();      
    });
  });

});
