import React, { useState } from 'react';
import { BarChart3, AlertTriangle, Wind } from 'lucide-react';
import MainLayout from '@/components/Layout/MainLayout';
import KPICard from '@/components/Common/KPICard';
import { useTranslation } from 'react-i18next';
import './Dashboard.css';

const Dashboard = () => {
  const { t } = useTranslation();
  const [co2Current] = useState(645);
  const [co2Avg24h] = useState(580);
  const [co2Max24h] = useState(1050);
  const [co2Min24h] = useState(420);

  return (
    <MainLayout pageTitle={t('menu.dashboard')} sensorStatus="connected">
      <div className="dashboard-container">
        {/* KPI Cards */}
        <div className="kpi-grid">
          <KPICard
            title={t('dashboard.currentCO2')}
            value={co2Current}
            unit="ppm"
            badge="Moderate"
            trend="down"
            trendValue="-15 vs 1h"
            color="moderate"
            icon={Wind}
          />
          <KPICard
            title={t('dashboard.avg24h')}
            value={co2Avg24h}
            unit="ppm"
            color="healthy"
          />
          <KPICard
            title={t('dashboard.max24h')}
            value={co2Max24h}
            unit="ppm"
            badge="Alert"
            color="critical"
            icon={AlertTriangle}
          />
          <KPICard
            title={t('dashboard.min24h')}
            value={co2Min24h}
            unit="ppm"
            color="healthy"
          />
        </div>

        {/* Charts Section */}
        <div className="charts-section">
          <div className="chart-card">
            <h3 className="chart-title">CO₂ Evolution (24h)</h3>
            <div className="chart-placeholder">
              <BarChart3 size={48} />
              <p>Real-time chart will be displayed here</p>
            </div>
          </div>
          
          <div className="chart-card">
            <h3 className="chart-title">AI Prediction (30min)</h3>
            <div className="chart-placeholder">
              <BarChart3 size={48} />
              <p>Forecast chart will be displayed here</p>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="stats-grid">
          <div className="stat-card">
            <h4>Recent Alerts</h4>
            <p className="stat-count">2</p>
            <p className="stat-desc">Last 24 hours</p>
          </div>
          <div className="stat-card">
            <h4>System Status</h4>
            <p className="stat-status connected">Connected</p>
            <p className="stat-desc">Last reading 2m ago</p>
          </div>
          <div className="stat-card">
            <h4>Air Quality</h4>
            <p className="stat-quality">Moderate</p>
            <p className="stat-desc">52% of time healthy</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;
