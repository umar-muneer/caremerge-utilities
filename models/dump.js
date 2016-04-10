module.exports = function(sequelize, DataTypes) {
  var model = sequelize.define('git_dump', {
    data: DataTypes.JSONB
  });
  console.log('@@@@', 'am i even coming here');
  console.log('@@@@', model);
  return model; 
};