/**
 * Created by umarmuneer on 23/01/16.
 */
var json2CSV = require('json2csv');
var plotly = require('plotly');
var fs = require('fs');
var Promise = require('bluebird');
var _ = require('lodash');
var moment = require('moment');

var _createCharts = function(statistics) {
  var chart = plotly(process.env.PLOTLY_USERNAME, process.env.PLOTLY_APIKEY);

  var _create = function(data, chartName, title) {
    var imgOpts = {
      format: 'png',
      width: 1280,
      height: 720
    };
    var annotations = _.map(_.zip(data.x, data.y), function(val) {
      return {
        x: val[0],
        y: val[1],
        text: val[1],
        showarrow: false,
        xref: 'x',
        yref: 'y',
        xanchor: 'top',
        yanchor: val[1] < 0 ? 'top' : 'bottom'
      };
    });

    annotations = _.filter(annotations, function(data) {
      return data.y != 0;
    });
    var layout = {
      title: title,
      annotations: annotations
    };
    var figure = {data: [data], layout: layout};
    return new Promise(function(resolve, reject) {
      chart.getImage(figure, imgOpts, function (error, imageStream) {
        if (error) {
          reject();
          return console.log (error);
        };
        var fileStream = fs.createWriteStream(chartName);
        fileStream.on('finish', function() {
          resolve(chartName);
        });
        imageStream.pipe(fileStream);
      });
    });
  };
  var _commitsChart = function() {
    var data = {
      x: _.pluck(statistics, 'author'),
      y: _.pluck(statistics, 'noOfCommits'),
      type: 'bar'
    };
    return _create(data, 'commits.png', 'Commits');
  };

  var _openedPullRequests = function() {
    var openedPullRequestData = {
      x: _.pluck(statistics, 'author'),
      y: _.pluck(_.pluck(statistics, 'pullRequest') , 'opened'),
      type: 'bar'
    };
    return _create(openedPullRequestData, 'pullrequestsopened.png', 'Pull Requests Opened');
  };

  var _closedPullRequests = function() {
    var closedPullRequestData = {
      x: _.pluck(statistics, 'author'),
      y: _.pluck(_.pluck(statistics, 'pullRequest') , 'closed'),
      type: 'bar'
    };
    return _create(closedPullRequestData, 'pullrequestsclosed.png', 'Closed Pull Requests');
  };
  var _filesChangedChart = function() {
    var data = {
      x: _.pluck(statistics, 'author'),
      y: _.pluck(statistics , 'noOfFilesChanged'),
      type: 'bar'
    };
    return _create(data, 'fileschanged.png', 'Files Changed');
  };

  var _netChangesChart = function() {
    var yAxis = _.map(_.pluck(statistics , 'netChanges'), function(value) {
      return value>3000 ? 3000 : value;
    });
    var data = {
      x: _.pluck(statistics, 'author'),
      y: yAxis,
      type: 'bar'
    };
    return _create(data, 'netchanges.png', 'Net Changes');
  };
  var _linesAddedChart = function() {
    var yAxis = _.map(_.pluck(statistics , 'noOfAdditions'), function(value) {
      return value>3000 ? 3000 : value;
    });
    var data = {
      x: _.pluck(statistics, 'author'),
      y: yAxis,
      type: 'bar'
    };
    return _create(data, 'additions.png', 'Lines Added');
  };

  var _linesDeletedChart = function() {
    var yAxis = _.map(_.pluck(statistics , 'noOfDeletions'), function(value) {
      return value>3000 ? 3000 : value;
    });
    var data = {
      x: _.pluck(statistics, 'author'),
      y: yAxis,
      type: 'bar'
    };
    return _create(data, 'deletions.png', 'Lines Deleted');
  };

  var _netLinesChart = function() {
    var yAxis = _.map(_.pluck(statistics , 'netLines'), function(value) {
      return value>3000 ? 3000 : value;
    });
    var data = {
      x: _.pluck(statistics, 'author'),
      y: yAxis,
      type: 'bar'
    };
    return _create(data, 'netlines.png', 'Net Lines');
  };
  return Promise.all([_commitsChart(), _openedPullRequests(), _netChangesChart(), _linesAddedChart(), _linesDeletedChart(), _filesChangedChart(), _netLinesChart()]);
};

var _generateCSV = function(statistics) {
  var csvData =  _.map(statistics, function(val) {
    return {
      Name: val.author,
      Commits: val.noOfCommits,
      PullRequestsOpened: val.pullRequest.opened,
      TicketsClosed: 0,
      FileChanges: val.noOfFilesChanged,
      NetLines: val.netLines,
      LinesAdded: val.noOfAdditions,
      LinesDeleted: val.noOfDeletions
    }
  });
  var fields = csvData.length ? _.keys(csvData[0]) : [];

  var fileName = 'stats-' + moment().unix() + '.csv';
  return new Promise(function(resolve, reject) {
    json2CSV( {data: csvData, fields: fields}, function(err, csv) {
      if (err)
        return reject(err);
      fs.writeFile(fileName, csv, function(_err) {
        if (_err)
          return reject(_err)
        return resolve(fileName);
      })
    });
  });
};

module.exports.createCharts = _createCharts;
module.exports.generateCSV = _generateCSV;