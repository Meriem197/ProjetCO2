import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import './KPICard.css';

const KPICard = ({ title, value, unit = '', badge, trend, trendValue, sparkline, icon: Icon, color = 'healthy', loading = false }) => {
  return (
    <div className={`kpi-card ${color} ${loading ? 'loading' : ''}`}>
      <div className="kpi-header">
        <div className="kpi-title-section">
          <h3 className="kpi-title">{title}</h3>
          {Icon && <Icon size={18} className="kpi-icon" />}
        </div>
        {badge && <div className="kpi-badge">{badge}</div>}
      </div>

      <div className="kpi-body">
        <div className="kpi-value-section">
          <div className="kpi-value">
            {value}
            {unit && <span className="kpi-unit">{unit}</span>}
          </div>
          {trend && (
            <div className={`kpi-trend ${trend === 'up' ? 'positive' : 'negative'}`}>
              {trend === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        {sparkline && <div className="kpi-sparkline">{sparkline}</div>}
      </div>
      {loading && <div className="kpi-skeleton"></div>}
    </div>
  );
};

export default KPICard;
