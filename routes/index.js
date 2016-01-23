var express = require('express');
var router = express.Router();
var Promise = require('bluebird')
var eventHandlers = require('../eventHandlers');
var _ = require('lodash');
var fs = require('fs');
var mailgun = require('mailgun-js');
var moment = require('moment');
var inflection = require('inflection');

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
    return App.modules.output.createCharts(statistics);
  }).then(function(chartNames){
    console.log('successfully plotted all charts');
    if (process.env.NODE_ENV === 'test')
      return Promise.resolve({});
    return sendEmail(chartNames, duration);
  }).then(function() {
    console.log('email sent with attachments');
    if (req.query.format === 'csv'){
      return App.modules.output.generateCSV(statistics).then(function(file) {
        res.download(file, 'stats.csv');
      });
    }
    return res.json(statistics);

  }).catch(function(error) {
    res.status(500).json(error.stack ? error.stack : error);
  });
});

router.get('/statistics-planio', function(req, res) {
  var duration = _calculateDuration(req.query.period);
  return App.modules.planIO.calculate(duration).then(function(statistics) {
    res.json(statistics);
  }).catch(function(error) {
    res.status(500).json(error.stack ? error.stack : error);
  });
});

module.exports = router;
