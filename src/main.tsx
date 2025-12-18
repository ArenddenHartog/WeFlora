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

const root = document.getElementById('root');
if (root) {
  root.innerHTML = '<div style="padding:12px;font-family:monospace;background:#fffbcc;border-bottom:1px solid #ddd">[BOOT] JS entry executed</div>';
}
console.log('[BOOT] main.tsx executed', window.location.href);

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