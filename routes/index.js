var express = require('express');
var router = express.Router();
var Promise = require('bluebird')
var eventHandlers = require('../eventHandlers');
var plotly = require('plotly');

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


var generateCharts = function(statistics) {
  var chart = plotly(process.env.PLOTLY_USERNAME, process.env.PLOTLY_APIKEY);

  var _generateCommitsChart = function() {};

  var _generatePullRequestsChart = function() {};

  var _generateFilesChangedChart = function() {};

  var _generateNetLinesChart = function() {};
};

router.get('/statistics', function(req,res) {
  return App.models.statistics.calculate({
    fromDate: req.query.fromDate,
    toDate: req.query.toDate
  }).then(function(result){
    res.json(result);
  }).catch(function(error) {
    res.status(500).json(error.stack ? error.stack : error);
  });
});

module.exports = router;
