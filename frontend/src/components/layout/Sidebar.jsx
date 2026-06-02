import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Radar, LineChart, Layers, AlertCircle, Settings, MapPin, ChevronLeft, LogOut } from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ isCompact = false, onToggleCompact }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [co2Level, setCo2Level] = useState('healthy');

  const menuItems = [
    { id: 'dashboard', label: t('menu.dashboard'), icon: LayoutDashboard, path: '/' },
    { id: 'surveillance', label: t('menu.surveillance'), icon: Radar, path: '/surveillance' },
    { id: 'prediction', label: t('menu.prediction'), icon: LineChart, path: '/prediction' },
    { id: 'classification', label: t('menu.classification'), icon: Layers, path: '/classification' },
    { id: 'alerts', label: t('menu.alerts'), icon: AlertCircle, path: '/alerts' },
    { id: 'placement', label: t('menu.placement'), icon: MapPin, path: '/ia-placement' },
    { id: 'settings', label: t('menu.settings'), icon: Settings, path: '/parametres' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <aside className={`sidebar ${isCompact ? 'compact' : ''}`}>
      <div className="sidebar-header">
        <div className="logo-container">
          <div className="logo-icon">💨</div>
          {!isCompact && (
            <div className="logo-text">
              <h1>AirSense</h1>
              <p>IoT</p>
            </div>
          )}
        </div>
        <button className="toggle-btn" onClick={onToggleCompact} title={isCompact ? 'Expand' : 'Collapse'}>
          <ChevronLeft size={20} />
        </button>
      </div>

      <div className={`quality-badge ${co2Level}`}>
        <div className="quality-dot"></div>
        {!isCompact && (
          <div className="quality-text">
            <div className="quality-label">{t('quality.label')}</div>
            <div className="quality-value">
              {co2Level === 'healthy' && t('quality.healthy')}
              {co2Level === 'moderate' && t('quality.moderate')}
              {co2Level === 'critical' && t('quality.critical')}
            </div>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <button
              key={item.id}
              className={`nav-item ${active ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
              title={isCompact ? item.label : undefined}
            >
              <Icon size={20} />
              {!isCompact && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="user-card">
          <div className="user-avatar">M</div>
          {!isCompact && (
            <div className="user-info">
              <div className="user-name">{t('user.name')}</div>
              <div className="user-role">{t('user.role')}</div>
            </div>
          )}
        </div>
        {!isCompact && (
          <button className="logout-btn" title={t('common.logout')}>
            <LogOut size={16} />
            {t('common.logout')}
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
