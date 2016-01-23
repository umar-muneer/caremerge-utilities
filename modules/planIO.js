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
      console.log('retrieved issue statuses');
      var result = {};
      _.each(response.body.issue_statuses, function(status) {
        result[status.name] = status;
      });
      return result;
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
        console.log('retrieved issues page, total -> ', response.body.issues.length);
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
        console.log('retrieved an individual issue with id -> ', response.body.issue.id);
        return response.body.issue;
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

var _calculate = function(period, issues, issueStatuses) {

  var statistics = {};

  var _calculateDevelopedTicketStats = function() {
    var fromDate = moment(moment(period.fromDate).format('YYYY-DD-MMMM'));

    var result = {};
    _.each(issues, function(issue) {
      var journalsInDateRange = _.filter(issue.journals, function(ij) {
        return moment(moment(ij.created_on).format('YYYY-DD-MMMM')) >= fromDate;
      });
      var developedJournals = _.filter(journalsInDateRange, function(ij) {
        return _.filter(ij.details, function(ijd) {
          return ijd.name === 'status_id' && ijd.new_value == issueStatuses.Developed.id;
        }).length;
      });
      _.each(developedJournals, function(dj) {
        var entry = result[dj.user.name] || {};
        entry.issues = entry.issues || [];
        entry.developed = entry.developed ? entry.developed + 1 : 1;
        entry.issues.push(issue.id);
        result[dj.user.name] = entry;
      });
    });
    return result;
  };
  var _calculateClosedTicketStats = function() {

  };
  var _calculateDeployedTicketStats = function() {

  };
  return Promise.try(function() {
    var developedTickets = _calculateDevelopedTicketStats();
    return developedTickets;
  });
};

module.exports.calculate = function(period) {
  var issueStatuses = [];
  return _getAllIssueStatuses().then(function(result) {
    issueStatuses = result
    return _getAllIssues(period);
  }).then(function(result) {
    return _calculate(period, result, issueStatuses);
  });
};