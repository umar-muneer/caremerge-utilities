var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'github was here, well atleast it should have been !!!' });
});

router.post('/githooks/push', function(req,res) {
  console.log(req.body);
  res.status(200).end();
});

router.post('/githooks/pullrequest', function(req,res) {
  console.log(req.body);
  res.status(200).end();
});

module.exports = router;
