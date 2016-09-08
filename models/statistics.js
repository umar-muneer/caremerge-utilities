var _ = require('lodash');
var Promise = require('bluebird');
var request = Promise.promisifyAll(require('superagent'));
var urlJoin = require('url-join');
var moment = require('moment');
module.exports = function(sequelize, DataTypes) {
  var statistics = sequelize.define('statistics', {
    data: DataTypes.JSONB,
    type: DataTypes.STRING,
    author: DataTypes.STRING,
    createdAt: DataTypes.DATE
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
      },
      getCaremergeTeamId: function(organization, teamName) {
        return request(urlJoin(App.baseUrl, 'orgs', organization, 'teams' ))
                .query({access_token: process.env.GIT_ACCESS_TOKEN, per_page: 100})
                .endAsync()
                .then(function(response) {
                  var team = _.findWhere(response.body, function(r) {
                    return r.name === teamName;
                  });
                  return team.id;
                });
      },
      getAuthenticatedRepos: function() {
        return request(urlJoin(App.baseUrl, 'user', 'repos'))
          .query({
            access_token: process.env.GIT_ACCESS_TOKEN,
            per_page: 100
          })
          .endAsync()
          .then(function (response) {
            return _.reduce(response.body, function(result, repo) {
              result[repo.id] = _.pick(repo, 'id', 'name');
              return result;
            }, {});
          });
      },
      getMemberName: function(memberLogin) {
        return request(urlJoin(App.baseUrl, 'users', memberLogin))
          .query({access_token: process.env.GIT_ACCESS_TOKEN})
          .endAsync()
          .then(function(response) {
            return response.body.name || response.body.login;
          });
      },
      getTeamMembers: function(organization, teamName) {
        return Promise.bind(this).then(function() {
          return this.getCaremergeTeamId(organization, teamName);
        }).then(function(teamId) {
          return request(urlJoin(App.baseUrl, 'teams', teamId, 'members'))
            .query({access_token: process.env.GIT_ACCESS_TOKEN, per_page:100})
            .endAsync();
        }).then(function(response) {
          return response.body;
        });
      },
      calculateTeamMemberStats: function(member, fromDate, toDate, pullRequests) {
        var _this = this;
        var calculateCommitStats = function() {
          return _this.findAll({
            where: {
              author: member.login,
              type: 'commit',
              createdAt: {
                $gt: fromDate,
                $lt: toDate
              }
            },
            order: [['author', 'ASC']]
          }).then(function(commits) {
            var result = {
              noOfCommits: 0,
              noOfAdditions: 0,
              netChanges: 0,
              netLines: 0,
              noOfDeletions: 0
            };
            var uniqueFiles = [];
            _.each(commits, function(commit) {
              result.noOfCommits += 1;
              result.noOfAdditions += commit.data.stats.additions;
              result.noOfDeletions += commit.data.stats.deletions;
              result.netChanges += commit.data.stats.total;
              uniqueFiles = _.union(uniqueFiles, _.pluck(commit.data.files, 'filename'))
            });
            result.netLines = result.noOfAdditions - result.noOfDeletions;
            result.author = member.name || member.login,
            result.noOfFilesChanged = uniqueFiles.length;
            return result;
          });
        };

        var calculatePullRequestStats = function() {
          var opened = _.filter(pullRequests, function(pr) {
            return pr.data.action === 'opened' && pr.author === member.login;
          }).length;
          var closed = _.filter(pullRequests, function(pr) {
            return pr.data.action === 'closed' && pr.author === member.login && pr.data.pullRequest.merged !== true;
          }).length;
          var mergedByOther = _.filter(pullRequests, function(pr) {
            return pr.author !== member.login && pr.data.action === 'closed' && pr.data.pullRequest.user.login === member.login && pr.data.pullRequest.merged === true;
          }).length;
          var mergedOwn = _.filter(pullRequests, function(pr) {
            return pr.author === member.login && pr.data.action === 'closed' && pr.data.pullRequest.user.login === member.login && pr.data.pullRequest.merged === true;
          }).length;
          var mergedOthers = _.filter(pullRequests, function(pr) {
            return pr.author === member.login && pr.data.action === 'closed' && pr.data.pullRequest.user.login !== member.login && pr.data.pullRequest.merged === true;
          }).length;
          return {
            opened: opened,
            closed: closed,
            mergedOwn: mergedOwn,
            mergedByOther: mergedByOther,
            mergedOthers: mergedOthers
          };
        };

        var result = {};
        return calculateCommitStats().then(function(commitStats){
          _.extend(result, commitStats);
          return calculatePullRequestStats();
        }).then(function(prStats) {
          return _.extend(result, {
            'pullRequest':prStats
          });
        });
      },
      calculateTeamStats: function(team, fromDate, toDate) {
        var _this = this;

        return _this.findAll({
          where: {
            type: 'pullrequest',
            createdAt: {
              $gt: fromDate,
              $lt: toDate
            }
          },
          order: [['author', 'ASC']]
        }).then(function(pullRequests) {
          var teamStats = _.map(team, function(member) {
            return _this.calculateTeamMemberStats(member, fromDate, toDate, pullRequests);
          });
          return Promise.all(teamStats);
        });
      },
      calculate: function(data) {
        var _this = this;
        return Promise.try(function() {
          data = data || {};
          if (!_.has(data, 'toDate') || !data.toDate)
            throw "to date not specified";
          if (!_.has(data, 'fromDate') || !data.fromDate)
            throw "from date not specified";
          return _this.getTeamMembers(process.env.CM_GIT_ORGANIZATION, process.env.CM_TEAM_NAME);
        }).then(function(teamMembers) {
          return _this.calculateTeamStats(teamMembers, data.fromDate, data.toDate);
        });
      }
    }
  });
  return statistics;
};