var _ = require('lodash');
var Promise = require('bluebird');
var request = Promise.promisifyAll(require('superagent'));
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

      },
      getContributors: function(repository) {

      },
      findUniqueContributors: function(allContributors) {

      },
      calculateContributorStats: function(contributor, toDate, fromDate) {

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