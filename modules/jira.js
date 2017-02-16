var Promise = require('bluebird');
var request = Promise.promisifyAll(require('superagent'));
var urlJoin = require('url-join');
var _ = require('lodash');

var _getDevInProgressIssuesForUser = function(userName) {
	console.log('-----retrieving dev in progress issues for user name -> ', userName, '---------------');
	var JQL_TEMPLATE = 'status changed to "Dev In Progress" by "<%=userName%>" during(startOfWeek(),endOfWeek())';
	var url = urlJoin(App.jiraAPIUrl, 'search');
	var jql = _.template(JQL_TEMPLATE)({
		userName: userName
	});
	return request.get(url)
	.set('Authorization', 'Basic ' + process.env.JIRA_BASIC_AUTHORIZATION_TOKEN)
	.set('Content-Type', 'application/json')
	.query({
		startAt: 0,
		maxResults: 100,
		jql: jql,
		fields: []
	})
	.endAsync()
	.then(function(response) {
		console.log('-------retrieved dev in progress issues for user name -> ', userName, '----------');
		return response.body;
	})
	.catch(function(error) {
		console.log('error retrieving stats for user name -> ', userName);
		throw error;
	});
};

var _getReadyForQAIssues = function(userIDs) {
	var jql = 'status changed to "Ready For QA" during(startOfWeek(),endOfWeek()) and status not in ("Dev In Progress", "Ready for Dev", "Ready for Req Review", "Requirements in Progress", "Open") ' 
};


var _getUsers = function() {
	var url = urlJoin(App.jiraAPIUrl, 'user', 'search');
	console.log('----retrieving active users-----');
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
			console.log('-----retrieved active users-----')
			return response.body;
		});
};

module.exports.calculate = function() {
	return _getUsers().then(function(users) {
		var userNames = _.chain(users)
										.pluck('name')
										.reject(function(key) {
											return key.indexOf('addon') !== -1;
										})
										.value();
		return Promise.bind({}).then(function() {
			return Promise.map(userNames, function(userName) {
				return _getDevInProgressIssuesForUser(userName);
			});
		}).reduce(function(output, issuePerUser, index) {
			output[userNames[index]] = issuePerUser.total;
			return output;
		},[]).then(function(result) {
			this.devInProgressIssuesPerUser = result;
			console.log('dev in progress issues are -> ', this.devInProgressIssuesPerUser);
		});
	});
};