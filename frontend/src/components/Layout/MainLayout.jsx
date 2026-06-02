import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import './MainLayout.css';

const MainLayout = ({ children, pageTitle = 'Dashboard', sensorStatus = 'connected' }) => {
  const [isCompact, setIsCompact] = useState(false);
  const handleToggleCompact = () => setIsCompact(!isCompact);

  return (
    <div className={`main-layout ${isCompact ? 'compact' : ''}`}>
      <Sidebar isCompact={isCompact} onToggleCompact={handleToggleCompact} />
      <Topbar pageTitle={pageTitle} sensorStatus={sensorStatus} />
      <main className="main-content">{children}</main>
    </div>
  );
};

export default MainLayout;
