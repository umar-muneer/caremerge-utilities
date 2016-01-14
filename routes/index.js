var express = require('express');
var router = express.Router();
var Promise = require('bluebird')
var eventHandlers = require('../eventHandlers');
var plotly = require('plotly');
var _ = require('lodash');
var fs = require('fs');
var mailgun = require('mailgun-js');
var moment = require('moment');
var inflection = require('inflection');
var json2CSV = require('json2csv');
/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'github was here, well atleast it should have been !!!' });
});

router.post('/githooks/push', function(req,res) {
  eventHandlers.handlePushEvent(req.body);
  res.end();
});

router.post('/githooks/pullrequest', function(req,res) {
  eventHandlers.handlePullRequestEvent(req.body);
  res.status(200).end();
});


var createCharts = function(statistics) {
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

  var _pullRequestsChart = function() {
    var openedPullRequestData = {
      x: _.pluck(statistics, 'author'),
      y: _.pluck(_.pluck(statistics, 'pullRequest') , 'opened'),
      type: 'bar'
    };
    var closedPullRequestData = {
      x: _.pluck(statistics, 'author'),
      y: _.pluck(_.pluck(statistics, 'pullRequest') , 'opened'),
      type: 'bar'
    };
    return _create(openedPullRequestData, 'pullrequestsopened.png', 'Pull Requests Opened');
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
    var data = {
      x: _.pluck(statistics, 'author'),
      y: _.pluck(statistics , 'netChanges'),
      type: 'bar'
    };
    return _create(data, 'netchanges.png', 'Net Changes');
  };
  var _linesAddedChart = function() {
    var data = {
      x: _.pluck(statistics, 'author'),
      y: _.pluck(statistics , 'noOfAdditions'),
      type: 'bar'
    };
    return _create(data, 'additions.png', 'Lines Added');
  };

  var _linesDeletedChart = function() {
    var data = {
      x: _.pluck(statistics, 'author'),
      y: _.pluck(statistics , 'noOfDeletions'),
      type: 'bar'
    };
    return _create(data, 'deletions.png', 'Lines Deleted');
  };

  var _netLinesChart = function() {
    var data = {
      x: _.pluck(statistics, 'author'),
      y: _.pluck(statistics , 'netLines'),
      type: 'bar'
    };
    return _create(data, 'netlines.png', 'Net Lines');
  };
  return Promise.all([_commitsChart(), _pullRequestsChart(), _netChangesChart(), _linesAddedChart(), _linesDeletedChart(), _filesChangedChart(), _netLinesChart()]);
};

var sendEmail = function(chartNames, duration) {
  var mailer = mailgun({apiKey: process.env.MAILGUN_API_KEY, domain: process.env.MAILGUN_DOMAIN});
  var attachmentPromises = _.map(chartNames, function(chartName) {
    return new Promise(function(resolve, reject) {
      fs.readFile(chartName, function(err, data) {
        if (err)
          return reject(err);
        var attachment = new mailer.Attachment({data: data, filename: chartName});
        resolve(attachment);
      });
    });
  });

  return Promise.all(attachmentPromises).then(function(attachments) {
    var fromDate = moment(duration.fromDate).format('DD-MMM-YYYY');
    var toDate = moment(duration.toDate).format('DD-MMM-YYYY');
    var subject = inflection.capitalize(duration.title) + ' Stats: ' + fromDate + ' to ' + toDate
    var data = {
      from: process.env.CM_EMAIL_SENDER,
      to: process.env.CM_EMAIL_RECIPIENT,
      subject: subject,
      text: 'Developer statistics for the given period',
      attachment: attachments
    };
    return mailer.messages().send(data);
  });
};

var _generateCSV = function(statistics) {
  var csvData =  _.map(statistics, function(val) {
    return {
      Name: val.author,
      Commits: val.noOfCommits,
      PullRequestsOpened: val.pullRequest.opened,
      TicketsClosed: 0,
      FileChanges: val.noOfFilesChanged,
      NetLines: val.netLines
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

var _calculateDuration = function(period) {
  var result = {};
  if (period === 'weekly')
    result.fromDate   = moment.utc().subtract(1, 'week').format();
  else if (period === 'monthly')
    result.fromDate = moment.utc().subtract(1, 'month').format();
  else if (period === 'daily')
    result.fromDate = moment.utc().subtract(1, 'day').format();

  result.title = period;
  result.toDate = moment.utc().format();

  return result;
};
router.get('/statistics', function(req,res) {
  var statistics = {};
  var duration = _calculateDuration(req.query.period);

  req.query.format = req.query.format || 'json';
  return App.models.statistics.calculate(duration).then(function(result){
    statistics = result;
    if (process.env.NODE_ENV === 'test')
      return Promise.resolve([]);
    return createCharts(result);
  }).then(function(chartNames){
    console.log('successfully plotted all charts');
    if (process.env.NODE_ENV === 'test')
      return Promise.resolve({});
    return sendEmail(chartNames, duration);
  }).then(function() {
    console.log('email sent with attachments');
    if (req.query.format === 'csv'){
      return _generateCSV(statistics).then(function(file) {
        res.download(file, 'stats.csv');
      });
    }
    return res.json(statistics);

  }).catch(function(error) {
    res.status(500).json(error.stack ? error.stack : error);
  });
});

module.exports = router;
