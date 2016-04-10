module.exports = function(sequelize, DataTypes) {
  var model = sequelize.define('dump', {
    data: DataTypes.JSONB
  });
  return model; 
};