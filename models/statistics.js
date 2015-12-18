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
      getRepositories: function(owner) {
        return request(urlJoin(App.baseUrl, 'orgs', process.env.GIT_OWNER, 'repos'))
                .query({access_token: process.env.GIT_ACCESS_TOKEN})
                .endAsync()
                .then(function(response) {
                  console.log('####', response.body, '####')
                });
      },
      getContributors: function(repository) {
        return Promise.resolve({});
      },
      findUniqueContributors: function(allContributors) {
        return Promise.resolve({});
      },
      calculateContributorStats: function(contributor, toDate, fromDate) {
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
        });
        return getRepositories(processe.env.GIT_OWNER).then(function(repositories) {
          var contributors = _.map(repositories, function(repo) {
            return _this.getContributors(repo);
          });
          return Promise.all(contributors);
        }).then(function(allContributors) {
          return findUniqueContributors(allContributors);
        }).then(function(uniqueContributors) {
          var contributorStats = _.map(uniqueContributors, function(contributor) {
            return _this.calculateContributorStats(contributor);
          });
          return Promise.all(contributorStats);
        });
      }
    }
  });
  return statistics;
};