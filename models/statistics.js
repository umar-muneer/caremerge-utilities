'use strict';
module.exports = function(sequelize, DataTypes) {
  var statistics = sequelize.define('statistics', {
    data: DataTypes.JSONB
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
      }
    }
  });
  return statistics;
};