var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'github was here, well atleast it should have been !!!' });
});

router.post('/githook', function(req,res) {
  console.log(req.body);  
})

module.exports = router;
