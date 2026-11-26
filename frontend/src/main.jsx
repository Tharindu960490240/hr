import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import './styles/global.css';
import App from './App';
import { UiProvider } from './context/UiContext';
import { AuthProvider } from './context/AuthContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <UiProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </UiProvider>
  </StrictMode>,
);
