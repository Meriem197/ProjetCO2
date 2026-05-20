const { DataTypes } = require('sequelize');

/**
 * CompanySetting — Paramètres du système (par entreprise)
 * Table créée via sequelize.sync (dev) ou via migration SQL (prod).
 */
module.exports = function defineCompanySetting(sequelize) {
  return sequelize.define(
    'CompanySetting',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      companyId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true, field: 'company_id' },

      // Seuils (ppm)
      limitGood: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 600, field: 'limit_good' },
      limitWarning: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1000, field: 'limit_warning' },
      limitCritical: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1400, field: 'limit_critical' },

      // IA (prédiction)
      aiModel: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'Random Forest', field: 'ai_model' },
      horizonMinutes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 30, field: 'horizon_minutes' },

      // IoT
      samplingIntervalSeconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 60, field: 'sampling_interval_seconds' },
      wifiSsid: { type: DataTypes.STRING(128), allowNull: true, field: 'wifi_ssid' },
      mqttBrokerUrl: { type: DataTypes.STRING(255), allowNull: true, field: 'mqtt_broker_url' },
      mqttTopic: { type: DataTypes.STRING(255), allowNull: true, field: 'mqtt_topic' },

      // Notifications
      notifyEmail: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'notify_email' },
      notifyPush: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'notify_push' },

      // Webhooks (Slack / Discord) — optionnels (peuvent rester NULL si désactivés)
      notifyWebhookSlack: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'notify_webhook_slack' },
      slackWebhookUrl: { type: DataTypes.STRING(512), allowNull: true, field: 'slack_webhook_url' },
      notifyWebhookDiscord: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'notify_webhook_discord' },
      discordWebhookUrl: { type: DataTypes.STRING(512), allowNull: true, field: 'discord_webhook_url' }
    },
    {
      tableName: 'company_settings',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  );
};
