/* global App */
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
router.get('/', function (req, res) {
  res.render('index', { title: 'github was here, well atleast it should have been !!!' });
});

router.post('/githooks/push', function (req,res) {
  eventHandlers.handlePushEvent(req.body);
  res.end();
});

router.post('/githooks/pullrequest', function (req,res) {
  eventHandlers.handlePullRequestEvent(req.body);
  res.status(200).end();
});

router.post('/githooks/dump', function(req,res) {
  eventHandlers.handleDumpEvent(req.get('X-GitHub-Event'), req.body).then(function() {
    res.status(200).end();
  }).catch(function(error) {
    res.status(500).json(error);
  });

});
var sendEmail = function(recipient, attachments, duration) {
  var mailer = mailgun({apiKey: process.env.MAILGUN_API_KEY, domain: process.env.MAILGUN_DOMAIN});
  var attachmentPromises = _.map(attachments, function(chartName) {
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
      to: recipient || process.env.CM_EMAIL_RECIPIENT,
      subject: subject,
      text: 'Developer statistics for the given period',
      attachment: attachments
    };
    return mailer.messages().send(data);
  });
};
var _calculateDuration = function(query) {
  var period = query.period;
  var result = {};

  if (query.fromDate && query.toDate) {
    result.fromDate = moment.utc(query.fromDate, 'DD-MM-YYYY').format();
    result.toDate = moment.utc(query.toDate, 'DD-MM-YYYY').add(1, 'day').format();
  }
  else if (period === 'weekly')
    result.fromDate   = moment.utc().subtract(1, 'week').startOf('day').format();
  else if (period === 'monthly')
    result.fromDate = moment.utc().subtract(1, 'month').startOf('day').format();
  else if (period === 'daily')
    result.fromDate = moment.utc().subtract(1, 'day').startOf('day').format();

  result.title = period || 'period';
  result.toDate = result.toDate || moment.utc().format();
  return result;
};
var _mapEmployeeNames = function(stats) {
  var map = {
    'abdulbasitcm': 'Abdul Basit',
    'adnan-careaxiom': 'Adnan Nasir',
    'atif': 'Atif Dastgir',
    'awaismashwani': 'Awais Ahmed',
    'BenLampere': 'Ben Lampere',
    'farhi-naz': 'Farhat Naz',
    'faridu86': 'Farid Ud Din',
    'fubha': 'Fubha Burney',
    'furqan-razzaq': 'Furqan Razzaq',
    'haiderfaizan': 'Faizan Haider',
    'komalpervez': 'Komal Pervez',
    'krazi3': 'Awwab Haq',
    'mlkwaqas': 'Waqas Khalid',
    'mmfarooq': 'Muddassir Farooq',
    'MrJai': 'Junaid Rehmat',
    'mudaser-caremerge': 'Mudaser Ali',
    'mudassarn': 'Mudassar Nazar',
    'nazarhussain': 'Nazar Hussain',
    'neebz': 'Muneeb Khawaja',
    'omarcareaxiom': 'Omar Iqbal Naru',
    'omeryousaf': 'Omer Yousaf',
    'safakhan': 'Safa Khan',
    'shahqaan': 'Shahqaan Qasim',
    'Shujaat89': 'Shujaat Ali',
    'sulemanahmed': 'Suleman Ahmed',
    'umar-muneer': 'Umar Muneer',
    'waleedwaseem': 'Waleed Waseem',
    'chaudhryjunaid': 'Junaid Anwar',
    'SargeKhan': 'Usman Khan',
    'yasiralicare': 'Yasir Ali'
  };
  _.each(stats, function(stat) {
    stat.author = map[stat.author] || stat.author;
  });
};

var filterBlackList = function(statistics) {
  var blackList = ['ashhar-saeed', 'gerrymiller', 'fahad-aziz', 'Raziah'];
  return _.filter(statistics, function(stat) {
    return !_.contains(blackList, stat.author);
  });
};
/*
@apiParam period weekly | monthly | daily
@apiParam fromDate
@apiParam toDate
@apiParam linesCap
@apiParam emailRecipient
*/
router.get('/statistics', function(req,res) {
  var duration = _calculateDuration(req.query);
  req.query.format = req.query.format || 'json';
  return Promise.bind(this).then(function() {
    res.json('Your request is being processed');
    return App.models.statistics.calculate(duration);
  }).then(function(result) {
    this.statistics = filterBlackList(result);;
    _mapEmployeeNames(this.statistics);
    if (process.env.NODE_ENV === 'test')
      return Promise.resolve([]);
    return App.modules.output.createCharts(this.statistics, req.query.period).git();
  }).then(function(chartNames) {
    console.log('successfully plotted all charts');
    this.emailAttachments = chartNames;
    if (req.query.format === 'csv')
      return App.modules.output.generateGitCSV(this.statistics);
    return Promise.resolve({});
  }).then(function(csvFile) {
    console.log('successfully generated csv file');
    if (process.env.NODE_ENV === 'test')
      return Promise.resolve({});
    if (!_.isEmpty(csvFile))
      this.emailAttachments.push(csvFile);
    return sendEmail(req.query.emailRecipient, this.emailAttachments, duration);
  }).then(function() {
    console.log('sending results email');
  }).catch(function(error) {
    console.log(error.stack ? error.stack : error);
  });
});
/*
@apiParam period weekly | monthly | daily
@apiParam fromDate
@apiParam toDate
@apiParam format
@apiParam emailRecipient
*/
router.get('/statistics-planio', function(req, res) {
  var duration = _calculateDuration(req.query);
  var statistics = {};
  req.query.format = req.query.format || 'json';

  return Promise.bind(this).then(function() {
    res.json('your request is being processed');
    return App.modules.planIO.calculate(duration);
  }).then(function(result) {
    this.statistics = result;
    if (process.env.NODE_ENV === 'test') {
      console.log(result);
      return Promise.resolve({});
    }
    return App.modules.output.createCharts(this.statistics, req.query.period).planIO();
  }).then(function(chartNames) {
    this.emailAttachments = chartNames;
    if (process.env.NODE_ENV === 'test')
      return Promise.resolve();
    if (req.query.format !== 'csv')
      return Promise.resolve({});
    return App.modules.output.generatePlanIoCSV(this.statistics)
  }).then(function(csvFile) {
    if (!_.isEmpty(csvFile))
      this.emailAttachments.push(csvFile);
    return sendEmail(req.query.emailRecipient, this.emailAttachments, duration);
  }).catch(function(error) {
    console.log(error.stack ? error.stack : error);
  });
});
module.exports = router;
