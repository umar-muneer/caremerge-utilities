/**
 * Created by umarmuneer on 22/01/16.
 */
var Promise = require('bluebird');
var request = Promise.promisifyAll(require('superagent'));
var urlJoin = require('url-join');
var _ = require('lodash');
var moment = require('moment');

var _getAllIssueStatuses = function() {
  return request.get(urlJoin(App.planIOUrl, '/issue_statuses.json'))
    .query({key: process.env.PLAN_IO_API_KEY, project_id: process.env.PLAN_IO_PROJECT_ID})
    .endAsync()
    .then(function(response) {
      return _.map(response.body.issue_statuses, function(status) {
        var result = {};
        result[status.name] = status;
        return result;
      });
    });
};

var _getAllIssues = function(period) {
  var fromDate = moment(period.fromDate).format('YYYY-MM-DD');
  var limit = 100;
  var issues = [];
  var _getIssues = function(issues, offset) {
    return request.get(urlJoin(App.planIOUrl, '/issues.json'))
      .query({key: process.env.PLAN_IO_API_KEY, project_id: process.env.PLAN_IO_PROJECT_ID, status_id: '*', updated_on: '>='+ fromDate, offset: offset, limit: limit})
      .endAsync()
      .then(function(response) {
        issues.push(response.body);
        if (response.body.total_count > response.body.offset + response.body.limit)
          return _getIssues(issues, offset += limit);
        return issues;
      });
  };

  var _getIssue = function(issue) {
    return request.get(urlJoin(App.planIOUrl, 'issues', issue.id + '.json'))
      .query({key: process.env.PLAN_IO_API_KEY, project_id: process.env.PLAN_IO_PROJECT_ID, include: 'journals'})
      .endAsync()
      .then(function(response) {
        return response.body;
      });
  };
  return _getIssues(issues, 0).then(function(result) {
    var allIssues =  _.flatten(_.map(result, function(r) {
      return r.issues;
    }));

    return Promise.all(_.map(allIssues, function(issue) {
      return _getIssue(issue);
    }));
  });
};

var _calculate = function(issues, issueStatuses) {
  var _calculateDevelopedTicketStats = function() {

  };

  var _calculateClosedTicketStats = function() {

  };

  var _calculateDeployedTicketStats = function() {

  };

  return Promise.bind(this).then(function() {
    return _calculateDevelopedTicketStats();
  }).then(function(result) {
    this.developedTickets = result;
    return _calculateClosedTicketStats();
  }).then(function() {
    this.closedTickets = result;
    return _calculateDeployedTicketStats();
  }).then(function(result) {
    return {
      closed: this.closedTickets,
      deployed: result,
      developed: this.developedTickets
    };
  });
};

module.exports.calculate = function(period) {
  return _getAllIssueStatuses().then(function(result) {
    return _getAllIssues(period);
  });
};