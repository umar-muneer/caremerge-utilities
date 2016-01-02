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
            .endAsync()
          }).then(function(response) {
            var members = _.map(response.body, function(member) {
              return this.getMemberName(member.login).then(function(result) {
                return _.extend(member, {name: result});
              });
            }, this);
            return Promise.all(members);
        });
      },
      calculateTeamMemberStats: function(member, fromDate, toDate) {
        var _this = this;
        var calculateCommitStats = function() {
          return _this.findAll({
            where: {
              author: member.login,
              type: 'commit'
            }
          }).then(function(commits) {
            var result = {
              noOfCommits: 0,
              noOfAdditions: 0,
              netChanges: 0
            };
            var uniqueFiles = [];
            _.each(commits, function(commit) {
              result.noOfCommits += 1;
              result.noOfAdditions += commit.data.stats.additions;
              result.noOfDeletions += commit.data.stats.deletions;
              result.netChanges += commit.data.stats.total;
              uniqueFiles = _.union(uniqueFiles, _.pluck(commit.data.files, 'filename'))
            });
            result.author = member.name || member.login,
            result.noOfFilesChanged = uniqueFiles.length;
            return result;
          });
        };

        var calculatePullRequestStats = function() {
          return _this.findAll({
            where: {
              author: member.login,
              type: 'pullrequest'
            }
          }).then(function(pullrequests) {
            var openedPullRequests = _.filter(pullrequests, function(pr) {
              return pr.data.action === 'opened';
            });
            var closedPullRequests = _.filter(pullrequests, function(pr) {
              return pr.data.action === 'closed';
            });
            return {
              opened: openedPullRequests.length,
              closed: closedPullRequests.length
            };
          })
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
        var teamStats = _.map(team, function(member) {
          return _this.calculateTeamMemberStats(member, fromDate, toDate);
        });
        return Promise.all(teamStats);
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