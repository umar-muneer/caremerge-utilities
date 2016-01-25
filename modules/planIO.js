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

var getDateObject = function(date) {
  return moment.utc(date);
}

var _getAllIssues = function(period) {
  var fromDate = moment.utc(period.fromDate).format('YYYY-MM-DD');
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

  var _calculateDevelopedStats = function() {
    _.each(issues, function(issue) {
      var journalsInDateRange = _.filter(issue.journals, function(ij) {
        return getDateObject(ij.created_on) >= getDateObject(period.fromDate);
      });
      var developedJournals = _.filter(journalsInDateRange, function(ij) {
        return _.filter(ij.details, function(ijd) {
          return ijd.name === 'status_id' && ijd.new_value == issueStatuses.Developed.id;
        }).length;
      });
      var unDevelopedJournals = _.filter(journalsInDateRange, function(jidr) {
        return !_.contains(_.pluck(developedJournals, 'id'), jidr.id);
      });
      var maxDevelopedTime = getDateObject(_.max(developedJournals, function(journal) {
        return getDateObject(journal.created_on).unix();
      }).created_on).unix();

      var developedJournal = _.find(developedJournals, function(dj) {
        return !_.find(unDevelopedJournals, function(udj) {
          return getDateObject(udj.created_on) >= getDateObject(dj.created_on) && _.find(udj.details, function(detail) {
              return detail.name === 'status_id' && (detail.new_value == issueStatuses.New.id || detail.new_value == issueStatuses.ReOpen.id);
            });
        }) && getDateObject(dj.created_on).unix() === maxDevelopedTime;
      });
      if (!developedJournal)
        return;
      var entry = statistics[developedJournal.user.name] || {};
      entry.developed = entry.developed || {};
      entry.developed.count = entry.developed.count ? entry.developed.count + 1 : 1;
      entry.developed.issues = entry.developed.issues || [];
      entry.developed.issues.push(issue.id);
      statistics[developedJournal.user.name] = entry;
    });
  };
  var _calculateDeployedStats = function() {
    _.each(issues, function(issue) {
      var journalsInDateRange = _.filter(issue.journals, function(ij) {
        return getDateObject(ij.created_on) >= getDateObject(period.fromDate);
      });
      var deployedJournals = _.filter(journalsInDateRange, function(ij) {
        return _.filter(ij.details, function(ijd) {
          return ijd.name === 'status_id' && ijd.new_value == issueStatuses.Deployed.id;
        }).length;
      });
      var unDeployedJournals = _.filter(journalsInDateRange, function(jidr) {
        return !_.contains(_.pluck(deployedJournals, 'id'), jidr.id);
      });
      var maxDeployedTime = getDateObject(_.max(deployedJournals, function(journal) {
        return getDateObject(journal.created_on).unix();
      }).created_on).unix();

      var deployedJournal = _.find(deployedJournals, function(dj) {
        return !_.find(unDeployedJournals, function(udj) {
            return getDateObject(udj.created_on) >= getDateObject(dj.created_on) && _.find(udj.details, function(detail) {
                return detail.name === 'status_id' && (detail.new_value == issueStatuses.New.id || detail.new_value == issueStatuses.ReOpen.id);
              });
          }) && getDateObject(dj.created_on).unix() === maxDeployedTime;
      });
      if (!deployedJournal)
        return;
      var entry = statistics[deployedJournal.user.name] || {};
      entry.deployed = entry.deployed || {};
      entry.deployed.count = entry.deployed.count ? entry.deployed.count + 1 : 1;
      entry.deployed.issues = entry.deployed.issues || [];
      entry.deployed.issues.push(issue.id);
      statistics[deployedJournal.user.name] = entry;
    });
  };
  var _calculateClosedStats = function() {
    var closedIssues = _.filter(issues, function(issue) {
      return issue.status.id === issueStatuses.Closed.id;
    });
    _.each(closedIssues, function(issue) {
      var journalsInDateRange = _.filter(issue.journals, function(ij) {
        return getDateObject(ij.created_on) >= getDateObject(period.fromDate);
      });
      var allClosedJournals = _.filter(journalsInDateRange, function(ij) {
        return _.filter(ij.details, function(ijd) {
          return ijd.name === 'status_id' && ijd.new_value == issueStatuses.Closed.id;
        }).length;
      });
      var maxClosedTime = getDateObject(_.max(allClosedJournals, function(cj) {
        return getDateObject(cj.created_on).unix();
      }).created_on).unix();
      var lastClosedJournal = _.find(allClosedJournals, function(closedJournal) {
        return getDateObject(closedJournal.created_on).unix() === maxClosedTime;
      });
      if (!lastClosedJournal)
        return;
      var entry = statistics[lastClosedJournal.user.name] || {};
      entry.closed = entry.closed || {};
      entry.closed.issues = entry.closed.issues || [];
      entry.closed.issues.push(issue.id);
      entry.closed.count = entry.closed.count ? entry.closed.count + 1 : 1;
      statistics[lastClosedJournal.user.name] = entry;
    });
  };
  return Promise.try(function() {
    _calculateDevelopedStats();
    _calculateClosedStats();
    _calculateDeployedStats();


    return _.map(_.keys(statistics), function(author) {
      var authorData = statistics[author];
      return {
        author: author,
        developed: authorData.developed ? authorData.developed.issues.length : 0,
        deployed: authorData.deployed ? authorData.deployed.issues.length : 0,
        closed: authorData.closed ? authorData.closed.issues.length : 0
      };
    });
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