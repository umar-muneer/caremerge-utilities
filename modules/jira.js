var Promise = require('bluebird');
var request = Promise.promisfyAll(require('superagent'));
module.exports.getDevInProgressIssues = function() {
	var jql = 'status changed to "Dev In Progress" during(startOfWeek(),endOfWeek())';
};

module.exports.getReadyForQAIssues = function() {
	var jql = 'status changed to "Ready For QA" during(startOfWeek(),endOfWeek()) and status not in ("Dev In Progress", "Ready for Dev", "Ready for Req Review", "Requirements in Progress", "Open") ' 
};