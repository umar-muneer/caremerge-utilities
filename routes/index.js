var express = require('express');
var router = express.Router();
var Promise = require('bluebird')
var eventHandlers = require('../eventHandlers');
var plotly = require('plotly');
var _ = require('lodash');
var fs = require('fs');
var mailgun = require('mailgun-js');

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
  var imgOpts = {
    format: 'png',
    width: 1280,
    height: 720
  };

  var _create = function(data, chartName) {
    var figure = {data: [data]};
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
    return _create(data, 'commits.png');
  };

  var _pullRequestsChart = function() {
    var data = {
      x: _.pluck(statistics, 'author'),
      y: _.pluck(_.pluck(statistics, 'pullRequest') , 'opened'),
      type: 'bar'
    };
    return _create(data, 'pullrequests.png');
  };

  var _filesChangedChart = function() {
    var data = {
      x: _.pluck(statistics, 'author'),
      y: _.pluck(statistics , 'noOfFilesChanged'),
      type: 'bar'
    };
    return _create(data, 'fileschanged.png');
  };

  var _netLinesChart = function() {
    var data = {
      x: _.pluck(statistics, 'author'),
      y: _.pluck(statistics , 'netChanges'),
      type: 'bar'
    };
    return _create(data, 'netlines.png');
  };

  var _linesAddedChart = function() {
    var data = {
      x: _.pluck(statistics, 'author'),
      y: _.pluck(statistics , 'noOfAdditions'),
      type: 'bar'
    };
    return _create(data, 'additions.png');
  };

  var _linesDeletedChart = function() {
    var data = {
      x: _.pluck(statistics, 'author'),
      y: _.pluck(statistics , 'noOfDeletions'),
      type: 'bar'
    };
    return _create(data, 'deletions.png');
  };

  return Promise.all([_commitsChart(), _pullRequestsChart(), _netLinesChart(), _linesAddedChart(), _linesDeletedChart(), _filesChangedChart()]);
};

var sendEmail = function(chartNames) {
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
    var data = {
      from: process.env.CM_EMAIL_SENDER,
      to: process.env.CM_EMAIL_RECIPIENT,
      subject: 'Developer Statistics',
      text: 'Developer statistics for the given period',
      attachment: attachments
    };
    return mailer.messages().send(data);
  });
};

router.get('/statistics', function(req,res) {
  var statistics = {};
  return App.models.statistics.calculate({
    fromDate: req.query.fromDate,
    toDate: req.query.toDate
  }).then(function(result){
    statistics = result;
    return createCharts(result);
  }).then(function(chartNames){
    console.log('successfully plotted all charts');
    return sendEmail(chartNames);
  }).then(function() {
    console.log('email sent with attachments');
    res.json(statistics);
  }).catch(function(error) {
    res.status(500).json(error.stack ? error.stack : error);
  });
});

module.exports = router;
