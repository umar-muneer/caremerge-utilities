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
      getTeamMembers: function(teamId) {
        return request(urlJoin(App.baseUrl, 'teams', teamId, 'members'))
          .query({access_token: process.env.GIT_ACCESS_TOKEN, per_page:100})
          .endAsync()
          .then(function(response) {
            return _.map(response.body, function(member) {
              return _.pick(member, 'id', 'login');
            });
          });
      },
      calculateTeamMemberStats: function(member, toDate, fromDate) {
        return Promise.resolve({});
      },
      calculate: function(data) {
        var _this = this;
        return Promise.try(function() {
          data = data || {};
          if (!_.has(data, 'toDate') || !data.toDate)
            throw "to date not specified";
          if (!_.has(data, 'fromDate') || !data.fromDate)
            throw "from date not specified";
          return _this.getTeamMembers(process.env.TEAM_ID);
        }).then(function(members) {
          console.log('####', members, '####');
        });
      }
    }
  });
  return statistics;
};