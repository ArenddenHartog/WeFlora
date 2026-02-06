import React, { Component, ErrorInfo, ReactNode } from 'react';
import { track } from '../src/agentic/telemetry/telemetry';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  traceId: string | null;
}

/**
 * Global error boundary that catches React rendering errors.
 * 
 * Features:
 * - Generates unique trace ID for debugging
 * - Logs to console with full context
 * - Reports to telemetry
 * - Shows user-friendly error UI with retry option
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      traceId: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const traceId = `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      hasError: true,
      error,
      traceId
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { traceId } = this.state;
    
    // Log to console with full context
    console.error('[ErrorBoundary] Caught error:', {
      traceId,
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });

    // Track in telemetry
    track('error_boundary.caught', {
      traceId,
      message: error.message,
      name: error.name,
      componentStack: errorInfo.componentStack?.slice(0, 500) // Truncate for telemetry
    });

    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      traceId: null
    });
  };

  handleCopyDebugInfo = () => {
    const { error, errorInfo, traceId } = this.state;
    const debugInfo = {
      traceId,
      error: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      url: window.location.href,
      timestamp: new Date().toISOString()
    };
    
    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2))
      .then(() => {
        // Could show a toast here, but we're in error state so keep it simple
        alert('Debug info copied to clipboard');
      })
      .catch(() => {
        alert('Failed to copy debug info');
      });
  };

  render() {
    const { hasError, error, traceId } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-rose-100 flex items-center justify-center">
                <svg className="h-5 w-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">We hit an unexpected issue</h1>
                <p className="text-sm text-slate-500">Something went wrong while loading this page</p>
              </div>
            </div>

            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 mb-4">
              <p className="text-sm text-rose-700 font-medium">{error?.message || 'Unknown error'}</p>
              {traceId && (
                <p className="text-xs text-rose-500 mt-1 font-mono">Trace ID: {traceId}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors"
              >
                Reload
              </button>
              <button
                onClick={this.handleRetry}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Try again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Go home
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200">
              <button
                onClick={this.handleCopyDebugInfo}
                className="w-full px-4 py-2 border border-slate-200 text-slate-500 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors"
              >
                Copy debug info
              </button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
