var _ = require('lodash');
var Promise = require('bluebird');
var request = Promise.promisifyAll(require('superagent'));
var urlJoin = require('url-join');
module.exports = function(sequelize, DataTypes) {
  var statistics = sequelize.define('statistics', {
    data: DataTypes.JSONB,
    type: DataTypes.STRING,
    author: DataTypes.STRING
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
      getTeamMembers: function(organization, teamName) {
        return Promise.bind(this).then(function() {
          return this.getCaremergeTeamId(organization, teamName);  
        }).then(function(teamId) {
          return request(urlJoin(App.baseUrl, 'teams', teamId, 'members'))
            .query({access_token: process.env.GIT_ACCESS_TOKEN, per_page:100})
            .endAsync()
          }).then(function(response) {
            return _.map(response.body, function(member) {
              return _.pick(member, 'id', 'login');
          });
        });
      },
      calculateTeamMemberStats: function(member, toDate, fromDate) {
        var _this = this;
        var calculateCommitStats = function() {
          return _this.findAll({
            where: {
              author: member.login,
              type: 'commit'
            }
          }).then(function(commitInfo) {
            console.log(commitInfo);
          });
        };

        var calculatePullRequestStats = function() {

        };


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
        }).then(function(members) {
          console.log('####', members, '####');
        });
      }
    }
  });
  return statistics;
};