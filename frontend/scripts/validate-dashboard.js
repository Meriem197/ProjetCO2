#!/usr/bin/env node

/**
 * Dashboard Validation Script
 * Vérifie que tous les composants sont correctement configurés
 * Usage: node scripts/validate-dashboard.js
 */

const fs = require('fs');
const path = require('path');

// Couleurs pour le terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFile(filePath, description) {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (fs.existsSync(fullPath)) {
    log(`✓ ${description}`, 'green');
    return true;
  } else {
    log(`✗ ${description} - MISSING: ${filePath}`, 'red');
    return false;
  }
}

function checkFileContent(filePath, searchString, description) {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    log(`✗ ${description} - File not found: ${filePath}`, 'red');
    return false;
  }
  
  const content = fs.readFileSync(fullPath, 'utf-8');
  
  if (content.includes(searchString)) {
    log(`✓ ${description}`, 'green');
    return true;
  } else {
    log(`✗ ${description} - Content not found: "${searchString}"`, 'red');
    return false;
  }
}

// Main validation
log('\n╔═══════════════════════════════════════════════════════╗', 'cyan');
log('║     DASHBOARD IoT CO₂ - VALIDATION SCRIPT              ║', 'cyan');
log('╚═══════════════════════════════════════════════════════╝\n', 'cyan');

let passCount = 0;
let failCount = 0;

// 1. Component Files
log('1️⃣  COMPONENT FILES:', 'blue');
const componentChecks = [
  ['frontend/src/components/dashboard/DashboardHeader.jsx', 'DashboardHeader component'],
  ['frontend/src/components/dashboard/DashboardCards.jsx', 'DashboardCards components'],
  ['frontend/src/pages/Dashboard.jsx', 'Dashboard page'],
];

componentChecks.forEach(([file, desc]) => {
  if (checkFile(file, desc)) passCount++;
  else failCount++;
});

// 2. CSS Files
log('\n2️⃣  CSS STYLES:', 'blue');
const cssChecks = [
  ['frontend/src/styles/dashboard.css', 'Dashboard CSS styles'],
];

cssChecks.forEach(([file, desc]) => {
  if (checkFile(file, desc)) passCount++;
  else failCount++;
});

// 3. Main Entry Point
log('\n3️⃣  ENTRY POINT:', 'blue');
if (checkFileContent('frontend/src/main.jsx', 'dashboard.css', 'Dashboard CSS imported in main.jsx')) {
  passCount++;
} else {
  failCount++;
}

// 4. Component Imports
log('\n4️⃣  COMPONENT IMPORTS:', 'blue');
const importChecks = [
  ['frontend/src/pages/Dashboard.jsx', 'import DashboardHeader', 'DashboardHeader imported in Dashboard'],
  ['frontend/src/pages/Dashboard.jsx', 'import.*DashboardCards', 'DashboardCards imported in Dashboard'],
  ['frontend/src/pages/Dashboard.jsx', 'import.*CO2HistoryChart', 'CO2Charts imported in Dashboard'],
  ['frontend/src/pages/Dashboard.jsx', 'import { motion }', 'Framer Motion imported in Dashboard'],
];

importChecks.forEach(([file, pattern, desc]) => {
  if (checkFileContent(file, pattern, desc)) passCount++;
  else failCount++;
});

// 5. Key Classes/Components
log('\n5️⃣  KEY COMPONENTS DEFINITION:', 'blue');
const componentDef = [
  ['frontend/src/components/dashboard/DashboardHeader.jsx', 'export default function DashboardHeader', 'DashboardHeader export'],
  ['frontend/src/components/dashboard/DashboardCards.jsx', 'export function PremiumKpiCard', 'PremiumKpiCard export'],
  ['frontend/src/components/dashboard/DashboardCards.jsx', 'export function LargeCO2Card', 'LargeCO2Card export'],
  ['frontend/src/components/dashboard/DashboardCards.jsx', 'export function SensorStatusPanel', 'SensorStatusPanel export'],
];

componentDef.forEach(([file, pattern, desc]) => {
  if (checkFileContent(file, pattern, desc)) passCount++;
  else failCount++;
});

// 6. Hook Usage
log('\n6️⃣  HOOKS INTEGRATION:', 'blue');
const hookChecks = [
  ['frontend/src/pages/Dashboard.jsx', 'const { t, i18n } = useTranslation()', 'useTranslation hook'],
  ['frontend/src/pages/Dashboard.jsx', 'const { current, status, history', 'useCO2Data hook'],
];

hookChecks.forEach(([file, pattern, desc]) => {
  if (checkFileContent(file, pattern, desc)) passCount++;
  else failCount++;
});

// 7. CSS Animations
log('\n7️⃣  CSS ANIMATIONS:', 'blue');
const animationChecks = [
  ['frontend/src/styles/dashboard.css', '@keyframes dashboard-float', 'Dashboard float animation'],
  ['frontend/src/styles/dashboard.css', '@keyframes dashboard-glow', 'Dashboard glow animation'],
  ['frontend/src/styles/dashboard.css', '@keyframes dashboard-pulse-ring', 'Dashboard pulse animation'],
  ['frontend/src/styles/dashboard.css', 'dashboard-card', 'Dashboard card styles'],
];

animationChecks.forEach(([file, pattern, desc]) => {
  if (checkFileContent(file, pattern, desc)) passCount++;
  else failCount++;
});

// 8. Responsive Classes
log('\n8️⃣  RESPONSIVE DESIGN:', 'blue');
const responsiveChecks = [
  ['frontend/src/styles/dashboard.css', 'grid-template-columns: repeat(3, 1fr)', 'KPI grid 3 columns'],
  ['frontend/src/styles/dashboard.css', '@media (max-width: 1024px)', 'Tablet breakpoint'],
  ['frontend/src/styles/dashboard.css', '@media (max-width: 639px)', 'Mobile breakpoint'],
];

responsiveChecks.forEach(([file, pattern, desc]) => {
  if (checkFileContent(file, pattern, desc)) passCount++;
  else failCount++;
});

// 9. Dark Mode Support
log('\n9️⃣  DARK MODE SUPPORT:', 'blue');
const darkModeChecks = [
  ['frontend/src/styles/dashboard.css', '.dark .dashboard-card', 'Dark mode card styles'],
  ['frontend/src/pages/Dashboard.jsx', 'isDarkMode', 'Dark mode state'],
  ['frontend/src/pages/Dashboard.jsx', 'handleToggleDarkMode', 'Dark mode toggle handler'],
];

darkModeChecks.forEach(([file, pattern, desc]) => {
  if (checkFileContent(file, pattern, desc)) passCount++;
  else failCount++;
});

// 10. i18n Support
log('\n🔟  INTERNATIONALIZATION:', 'blue');
const i18nChecks = [
  ['frontend/src/pages/Dashboard.jsx', 't("', 'Translation strings used'],
  ['frontend/src/components/dashboard/DashboardHeader.jsx', 't(', 'Header translations'],
  ['frontend/src/components/dashboard/DashboardCards.jsx', 'useTranslation', 'Cards translations'],
];

i18nChecks.forEach(([file, pattern, desc]) => {
  if (checkFileContent(file, pattern, desc)) passCount++;
  else failCount++;
});

// Summary
log('\n╔═══════════════════════════════════════════════════════╗', 'cyan');
log('║              VALIDATION SUMMARY                       ║', 'cyan');
log('╚═══════════════════════════════════════════════════════╝\n', 'cyan');

log(`✓ PASSED: ${passCount}`, 'green');
log(`✗ FAILED: ${failCount}`, failCount > 0 ? 'red' : 'green');

const total = passCount + failCount;
const percentage = Math.round((passCount / total) * 100);
log(`Score: ${percentage}% (${passCount}/${total})\n`, percentage === 100 ? 'green' : percentage >= 80 ? 'yellow' : 'red');

// Recommendations
if (failCount > 0) {
  log('⚠️  RECOMMENDATIONS:', 'yellow');
  log('  1. Check all file paths are correct', 'yellow');
  log('  2. Verify all imports are properly set up', 'yellow');
  log('  3. Run: npm install framer-motion lucide-react react-i18next', 'yellow');
  log('  4. Restart development server: npm run dev', 'yellow');
  log('  5. Clear browser cache and reload', 'yellow');
}

if (percentage === 100) {
  log('\n✨ ALL CHECKS PASSED! Dashboard is properly configured.', 'green');
  log('You can now run: npm run dev', 'green');
} else if (percentage >= 80) {
  log('\n⚡ MOSTLY GOOD! Fix the remaining issues and you\'re ready.', 'yellow');
} else {
  log('\n❌ SIGNIFICANT ISSUES FOUND! Please fix them before running.', 'red');
}

// Exit code
process.exit(failCount > 0 ? 1 : 0);
