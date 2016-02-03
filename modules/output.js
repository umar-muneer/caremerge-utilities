/**
 * Created by umarmuneer on 23/01/16.
 */
var json2CSV = require('json2csv');
var plotly = require('plotly');
var fs = require('fs');
var Promise = require('bluebird');
var _ = require('lodash');
var moment = require('moment');

var _createCharts = function(statistics, period) {
  var _create = function(data) {
    var chart = plotly(process.env.PLOTLY_USERNAME, process.env.PLOTLY_APIKEY);
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
      title: data.title,
      annotations: annotations
    };
    var figure = {data: [data], layout: layout};
    return new Promise(function(resolve, reject) {
      chart.getImage(figure, imgOpts, function (error, imageStream) {
        if (error) {
          reject();
          return console.log (error);
        };
        var fileStream = fs.createWriteStream(data.file);
        fileStream.on('finish', function() {
          resolve(data.file);
        });
        imageStream.pipe(fileStream);
      });
    });
  };
  
  var _git = function(linesCap) {
    var pullRequests = _.pluck(statistics, 'pullRequest');
    linesCap = parseInt(linesCap) || (period === 'monthly' ? 12000 : 3000);
    var chartData = {
        commits: {
          x: _.pluck(statistics, 'author'),
          y: _.pluck(statistics, 'noOfCommits'),
          type: 'bar',
          file: 'commits.png',
          title: 'Commits'
        },
        filesChanged: {
          x: _.pluck(statistics, 'author'),
          y: _.pluck(statistics , 'noOfFilesChanged'),
          type: 'bar',
          file: 'fileschanged.png',
          title: 'No. of Files Changed'
        },
        netChanges: {
          x: _.pluck(statistics, 'author'),
          y: _.map(_.pluck(statistics , 'netChanges'), function(value) {
            return value>linesCap ? linesCap : value;
          }),
          type: 'bar',
          file: 'netchanges.png',
          title: 'Net Changes'
        },
        linesAdded: {
          x: _.pluck(statistics, 'author'),
          y: _.map(_.pluck(statistics , 'noOfAdditions'), function(value) {
            return value>linesCap ? linesCap : value;
          }),
          type: 'bar',
          file: 'noofadditions.png',
          title: 'No. Of Additions'
        },
        linesDeleted: {
          x: _.pluck(statistics, 'author'),
          y: _.map(_.pluck(statistics , 'noOfDeletions'), function(value) {
            return value>linesCap ? linesCap : value;
          }),
          type: 'bar',
          file: 'noofdeletions.png',
          title: 'No. Of Deletions'
        },
        netLines: {
          x: _.pluck(statistics, 'author'),
          y: _.map(_.pluck(statistics , 'netLines'), function(value) {
            return value>linesCap ? linesCap : value;
          }),
          type: 'bar',
          file: 'netlines.png',
          title: 'Net Lines'
        },
        openedPrs: {
            x: _.pluck(statistics, 'author'),
            y: _.pluck(pullRequests, 'opened'),
            type: 'bar',
            file: 'pullrequestsopened.png',
            title: 'Opened Pull Requests'
        },
        closedPrs: {
            x: _.pluck(statistics, 'author'),
            y: _.pluck(pullRequests, 'closed'),
            type: 'bar',
            file: 'pullrequestsclosed.png',
            title: 'Closed Pull Requests'
        },
        mergedOwnPrs: {
            x: _.pluck(statistics, 'author'),
            y: _.pluck(pullRequests, 'mergedOwn'),
            type: 'bar',
            file: 'ownpullrequestsmerged.png',
            title: 'Own Pull Requests Merged'
        },
        mergedOthersPrs: {
            x: _.pluck(statistics, 'author'),
            y: _.pluck(pullRequests, 'mergedOthers'),
            type: 'bar',
            file: 'otherspullrequestsmerged.png',
            title: 'Others Pull Requests Merged By You'
        },
        mergedByOtherPrs: {
          x: _.pluck(statistics, 'author'),
          y: _.pluck(pullRequests, 'mergedByOther'),
          type: 'bar',
          file: 'mergedbyotherspullrequests.png',
          title: 'Your Pull Requests Merged By Someone else'
        }
      };
      var charts = _.map(_.keys(chartData), function(key) {
        return _create(chartData[key]);
      });
      return Promise.all(charts);
  }; 
  var _planIO = function() {
    var chartData = {
      developed: {
        x: _.pluck(statistics, 'author'),
        y: _.pluck(statistics, 'developed'),
        type: 'bar',
        file: 'pideveloped.png',
        title: 'Tickets Developed'
      },
      deployed: {
        x: _.pluck(statistics, 'author'),
        y: _.pluck(statistics, 'deployed'),
        type: 'bar',
        file: 'pideployed.png',
        title: 'Tickets Deployed'
      },
      closed: {
        x: _.pluck(statistics, 'author'),
        y: _.pluck(statistics, 'closed'),
        type: 'bar',
        file: 'piclosed.png',
        title: 'Tickets Closed'
      }
    };
    var charts = _.map(_.keys(chartData), function(key) {
      return _create(chartData[key]);
    });
    return Promise.all(charts);
  };
 
  return {
    git: _git,
    planIO: _planIO
  };
};

var _generateGitCSV = function(statistics) {
  var csvData =  _.map(statistics, function(val) {
    return {
      Name: val.author,
      Commits: val.noOfCommits,
      PullRequestsOpened: val.pullRequest.opened,
      PullRequestsClosed: val.pullRequest.closed,
      OwnPullRequstsMerged: val.pullRequest.mergedOwn,
      OthersPullRequestsMerged: val.pullRequest.mergedOthers,
      OwnPullRequestsMergedByOther: val.pullRequest.mergedByOther,
      FileChanges: val.noOfFilesChanged,
      NetLines: val.netLines,
      LinesAdded: val.noOfAdditions,
      LinesDeleted: val.noOfDeletions
    };
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

var _generatePlanIoCSV = function(statistics) {
  var csvData =  _.map(statistics, function(val) {
    return {
      Name: val.author,
      Developed: val.developed,
      Closed: val.closed,
      Deployed: val.deployed
    };
  });
  var fields = csvData.length ? _.keys(csvData[0]) : [];

  var fileName = 'planio-stats-' + moment().unix() + '.csv';
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
module.exports.generateGitCSV = _generateGitCSV;
module.exports.generatePlanIoCSV = _generatePlanIoCSV;