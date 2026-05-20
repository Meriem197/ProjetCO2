const { DataTypes } = require('sequelize');

/**
 * AiProject — Catalogue des projets (Placement IA)
 * Table créée via sequelize.sync (dev) ou via migration SQL (prod).
 */
module.exports = function defineAiProject(sequelize) {
  return sequelize.define(
    'AiProject',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      companyId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'company_id' },

      title: { type: DataTypes.STRING(255), allowNull: false },
      category: { type: DataTypes.STRING(80), allowNull: true },
      algorithmType: { type: DataTypes.STRING(80), allowNull: true, field: 'algorithm_type' },

      supervisorName: { type: DataTypes.STRING(160), allowNull: true, field: 'supervisor_name' },
      students: { type: DataTypes.JSON, allowNull: true }, // ex: [{name, email}]

      startDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'start_date' },
      endDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'end_date' },

      backendProgress: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'backend_progress' },
      frontendProgress: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'frontend_progress' },
      aiReadinessScore: { type: DataTypes.DECIMAL(5, 2), allowNull: true, field: 'ai_readiness_score' },

      status: {
        type: DataTypes.ENUM('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'),
        allowNull: false,
        defaultValue: 'ACTIVE'
      }
    },
    {
      tableName: 'ai_projects',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  );
};

