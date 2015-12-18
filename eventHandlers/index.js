//An array containing all stats per user.
var output = [];
var _ = require('lodash');
var Promise =require('bluebird');
var request = Promise.promisifyAll(require('superagent'));
var urlJoin = require('url-join');

var isMergeCommit = function(commit) {
  return commit.parents.length > 1 ? true : false;
};

var pushEvent = function(payload) {
  var _getCommitData = function(commit) {
    return request(urlJoin(App.baseUrl, 'repos',payload.repository.owner.name, payload.repository.name, 'commits', commit.id))
      .query({access_token: process.env.GIT_ACCESS_TOKEN})
      .endAsync()
      .then(function(result) {
        var commit = _.pick(result.body.commit, 'author', 'message');

        if (isMergeCommit(result.body)) {
          console.log('Merge commit ignored');
        }
        return _.extend(_.pick(result.body, 'stats', 'files', 'parents'), {
          'author': commit.author.name,
          'email': commit.author.email,
          'message': commit.message,
          'repository': payload.repository.name
        });
      });
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
    var nonMergeCommits = _.filter(result, function(commit) {
      return !isMergeCommit(commit);
    })
    var data = _.map(nonMergeCommits, function(commit) {
      return {
        data: commit,
        type: 'commit',
        author: commit.author
      };
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
      data: result,
      type: 'pullrequest',
      author: result.author
    });
  }).then(function() {
    console.log('data successfully inserted in db');
  }).catch(function(error) {
    console.log('####', error, '####');
  });
};

module.exports.output = output;