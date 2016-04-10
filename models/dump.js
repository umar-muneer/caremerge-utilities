var _ = require('lodash');
var Promise = require('bluebird');
var request = Promise.promisifyAll(require('superagent'));
var urlJoin = require('url-join');
var moment = require('moment');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('git_dump', {
    data: DataTypes.JSONB
  }); 
};