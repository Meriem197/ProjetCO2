import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Wifi, Battery, Check, X } from 'lucide-react';
import './Topbar.css';

const Topbar = ({ pageTitle, sensorStatus = 'connected' }) => {
  const { t, i18n } = useTranslation();
  const [lastUpdate, setLastUpdate] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [wifiSignal, setWifiSignal] = useState(100);
  const [batteryLevel, setBatteryLevel] = useState(85);

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  const changeLanguage = (lang) => i18n.changeLanguage(lang);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h2 className="page-title">{pageTitle}</h2>
      </div>

      <div className="topbar-center">
        <div className={`sync-status ${sensorStatus}`}>
          {sensorStatus === 'connected' ? <Check size={16} /> : <X size={16} />}
          <span>
            {sensorStatus === 'connected' ? t('topbar.synced') : t('topbar.disconnected')}
            · {t('topbar.updated')} {formatTime(lastUpdate)}
          </span>
        </div>
      </div>

      <div className="topbar-right">
        <div className="sensor-indicators">
          <div className="indicator wifi-signal">
            <Wifi size={18} />
            <div className="signal-bars">
              {[...Array(4)].map((_, i) => (
                <div key={i} className={`bar ${i < Math.ceil((wifiSignal / 100) * 4) ? 'active' : ''}`}></div>
              ))}
            </div>
          </div>
          <div className="indicator battery">
            <Battery size={18} />
            <span className="battery-text">{batteryLevel}%</span>
          </div>
        </div>

        <div className="language-selector">
          <button className={`lang-btn ${i18n.language === 'fr' ? 'active' : ''}`} onClick={() => changeLanguage('fr')} title="Français">FR</button>
          <button className={`lang-btn ${i18n.language === 'en' ? 'active' : ''}`} onClick={() => changeLanguage('en')} title="English">EN</button>
          <button className={`lang-btn ${i18n.language === 'ar' ? 'active' : ''}`} onClick={() => changeLanguage('ar')} title="العربية">AR</button>
        </div>

        <button className="notification-btn">
          <Bell size={20} />
          {notificationCount > 0 && <span className="notification-badge">{notificationCount}</span>}
        </button>

        <button className="user-menu-btn">
          <div className="user-avatar-small">M</div>
        </button>
      </div>
    </header>
  );
};

export default Topbar;
