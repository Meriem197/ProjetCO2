const { sequelize } = require('../config/mysql');
const defineCompany = require('./Company');
const defineCompanyUser = require('./CompanyUser');
const defineRole = require('./Role');
const defineCompanyUserRole = require('./CompanyUserRole');
const defineSite = require('./Sites');
const defineProductionLine = require('./ProductionLine');
const defineEdgeDevice = require('./EdgeDevice');
const defineSensor = require('./Sensor');
const defineUser = require('./User');
const defineAlert = require('./Alert');
const defineAiProject = require('./AiProject');
const defineCompanySetting = require('./CompanySetting');
const definePositioningPosition = require('./PositioningPosition');

const Company = defineCompany(sequelize);
const User = defineUser(sequelize);
const CompanyUser = defineCompanyUser(sequelize);
const Role = defineRole(sequelize);
const CompanyUserRole = defineCompanyUserRole(sequelize);
const Site = defineSite(sequelize);
const ProductionLine = defineProductionLine(sequelize);
const EdgeDevice = defineEdgeDevice(sequelize);
const Sensor = defineSensor(sequelize);
const Alert = defineAlert(sequelize);
const AiProject = defineAiProject(sequelize);
const CompanySetting = defineCompanySetting(sequelize);
const PositioningPosition = definePositioningPosition(sequelize);

Company.hasMany(CompanyUser, { foreignKey: 'companyId', as: 'memberships' });
CompanyUser.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });

User.hasMany(CompanyUser, { foreignKey: 'userId', as: 'memberships' });
CompanyUser.belongsTo(User, { foreignKey: 'userId', as: 'user' });

CompanyUser.belongsToMany(Role, {
  through: CompanyUserRole,
  foreignKey: 'companyUserId',
  otherKey: 'roleId',
  as: 'roles'
});
Role.belongsToMany(CompanyUser, {
  through: CompanyUserRole,
  foreignKey: 'roleId',
  otherKey: 'companyUserId',
  as: 'companyUsers'
});

Company.hasMany(Site, { foreignKey: 'companyId', as: 'sites' });
Site.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });

Site.hasMany(ProductionLine, { foreignKey: 'siteId', as: 'productionLines' });
ProductionLine.belongsTo(Site, { foreignKey: 'siteId', as: 'site' });

ProductionLine.hasMany(EdgeDevice, { foreignKey: 'productionLineId', as: 'edgeDevices' });
EdgeDevice.belongsTo(ProductionLine, { foreignKey: 'productionLineId', as: 'productionLine' });

EdgeDevice.hasMany(Sensor, { foreignKey: 'edgeDeviceId', as: 'sensors' });
Sensor.belongsTo(EdgeDevice, { foreignKey: 'edgeDeviceId', as: 'edgeDevice' });

Company.hasMany(Alert, { foreignKey: 'companyId', as: 'alerts' });
Alert.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });
Site.hasMany(Alert, { foreignKey: 'siteId', as: 'alerts' });
Alert.belongsTo(Site, { foreignKey: 'siteId', as: 'site' });
Sensor.hasMany(Alert, { foreignKey: 'sensorId', as: 'alerts' });
Alert.belongsTo(Sensor, { foreignKey: 'sensorId', as: 'sensor' });

Company.hasMany(AiProject, { foreignKey: 'companyId', as: 'aiProjects' });
AiProject.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });

Company.hasOne(CompanySetting, { foreignKey: 'companyId', as: 'settings' });
CompanySetting.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });

Company.hasMany(PositioningPosition, { foreignKey: 'companyId', as: 'positioningPositions' });
PositioningPosition.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });

module.exports = {
  sequelize,
  Company,
  User,
  CompanyUser,
  Role,
  CompanyUserRole,
  Site,
  ProductionLine,
  EdgeDevice,
  Sensor,
  Alert,
  AiProject,
  CompanySetting,
  PositioningPosition
};
