var Promise = require('bluebird');
var request = Promise.promisifyAll(require('superagent'));
var urlJoin = require('url-join');
var _ = require('lodash');

var _getDevInProgressIssues = function(userIDs) {
	var jql = 'status changed to "Dev In Progress" <%=userID%> during(startOfWeek(),endOfWeek())';
	var url = urlJoin(App.jiraAPIUrl, 'search')
	
	return Promise.map(userIDs).then(function(userID) {
		return request.get(url)
		.set('Authorization', 'Basic ' + process.env.JIRA_BASIC_AUTHORIZATION_TOKEN)
		.set('Content-Type', 'application/json')
		.query({
			startAt: 0,
			maxResults: 100,
			jql: jql
		});
	}).then(function(issues) {
		console.log(issues);
		return issues;
	});
	
};

var _getReadyForQAIssues = function(userIDs) {
	var jql = 'status changed to "Ready For QA" during(startOfWeek(),endOfWeek()) and status not in ("Dev In Progress", "Ready for Dev", "Ready for Req Review", "Requirements in Progress", "Open") ' 
};


var _getUsers = function() {
	var url = urlJoin(App.jiraAPIUrl, 'user', 'search');
	return request.get(url)
		.set('Authorization', 'Basic ' + process.env.JIRA_BASIC_AUTHORIZATION_TOKEN)
		.set('Content-Type', 'application/json')
		.query({
			username: '%',
			startAt: 0,
			maxResults: 100
		})
		.endAsync()
		.then(function(response) {
			console.log('retrieved user list for jira stats');
			return response.body;
		});
};

module.exports.calculate = function() {
	return _getUsers().then(function(users) {
		var userKeys = _.pluck(users, 'key');
		return _getDevInProgressIssues(userKeys);
	});
};