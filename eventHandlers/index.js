//An array containing all stats per user.
var output = [];
var _ = require('lodash');
var Promise =require('bluebird');
var request = Promise.promisifyAll(require('superagent'));
var urlJoin = require('url-join');
var baseUrl = 'https://api.github.com';

var pushEvent = function(payload) {
  var _getCommitData = function(commit) {
    return request(urlJoin(baseUrl, 'repos',payload.repository.owner.name, payload.repository.name, 'commits', commit.id))
      .query({access_token: process.env.GIT_ACCESS_TOKEN})
      .endAsync()
      .then(function(result) {
        var commit = _.pick(result.body.commit, 'author', 'message');

        if (isMergeCommit(result.body)) {
          console.log('Merge commit ignored');
          return {};
        }
        return _.extend(_.pick(result.body, 'stats', 'files', 'parents'), {
          'author': commit.author,
          'message': commit.message
        });
      });
  };
  var isMergeCommit = function(commit) {
    return commit.parents.length > 1 ? true : false;
  };
  var distinctCommits = _.filter(payload.commits, function(commit) {
    return commit.distinct;
  });
  var commitDataPromises = _.map(distinctCommits, function(commit) {
    return _getCommitData(commit);
  });
  return Promise.all(commitDataPromises);
};

var pullRequestEvent = function(payload) {
  return Promise.try(function() {
    return {
      author: payload.pull_request.user.login,
      url: payload.pull_request.url,
      action: payload.action,
      state: payload.pull_request.state,
      createdAt: payload.pull_request.created_at,
      updatedAt: payload.pull_request.updated_at
    };
  });
};

module.exports.handlePushEvent = function(payload) {
  return pushEvent(payload).then(function(result) {
    var data = _.map(result, function(r) {
      return {data: _.extend(r, {statType: 'commit'})};
    });
    return App.models.statistics.bulkCreate(data);
  }).then(function() {
    console.log('data successfully inserted in db');
  }).catch(function(error) {
    console.log('####', error, '####');
  });  
};

module.exports.handlePullRequestEvent = function(payload) {
  return pullRequestEvent(payload).then(function(result) {
    return App.models.statistics.create({
      data: _.extend(result, {statType: 'pullrequest'})
    });
  }).catch(function(error) {
    console.log('####', error, '####');
  });
};

module.exports.output = output;