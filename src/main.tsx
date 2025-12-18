import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../App';
import ErrorBoundary from './ErrorBoundary';

// Add error handlers
window.onerror = (message, source, lineno, colno, error) => {
  const errorMsg = `Error: ${message}\nSource: ${source}\nLine: ${lineno}\nColumn: ${colno}\nStack: ${error?.stack}`;
  console.error(errorMsg);
  const overlay = document.createElement('pre');
  overlay.id = 'wf-crash';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#fff;color:#000;z-index:9999;padding:20px;font-family:monospace;';
  overlay.textContent = errorMsg;
  document.body.appendChild(overlay);
};

window.onunhandledrejection = (event) => {
  const errorMsg = `Unhandled Rejection: ${event.reason}\nStack: ${event.reason?.stack}`;
  console.error(errorMsg);
  const overlay = document.createElement('pre');
  overlay.id = 'wf-crash';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#fff;color:#000;z-index:9999;padding:20px;font-family:monospace;';
  overlay.textContent = errorMsg;
  document.body.appendChild(overlay);
};

// Wrap React bootstrap in try/catch
try {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
} catch (error) {
  const errorMsg = `Bootstrap Error: ${error}\nStack: ${error?.stack}`;
  console.error(errorMsg);
  const overlay = document.createElement('pre');
  overlay.id = 'wf-crash';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#fff;color:#000;z-index:9999;padding:20px;font-family:monospace;';
  overlay.textContent = errorMsg;
  document.body.appendChild(overlay);
}