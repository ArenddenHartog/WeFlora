import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from '../App';
import ErrorBoundary from './ErrorBoundary';

// Lightweight runtime error logging (no UI/flow changes).
window.onerror = (message, source, lineno, colno, error) => {
  console.error('[window.onerror]', { message, source, lineno, colno, error });
};

window.onunhandledrejection = (event) => {
  console.error('[window.onunhandledrejection]', event.reason);
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);