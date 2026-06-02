import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import './styles/theme.css';
import './i18n';

createRoot(document.getElementById('root')).render(<App />);
