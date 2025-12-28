import React, { Component, ReactNode } from 'react';

interface ErrorPayload {
  name: string;
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: string;
}

interface Props {
  children: ReactNode;
  name?: string;
  onError?: (error: Error, errorInfo: React.ErrorInfo, payload: ErrorPayload) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

declare global {
  interface Window {
    __WF_STAGING_ERRORS?: ErrorPayload[];
  }
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const boundaryName = this.props.name ?? 'Application';
    const payload: ErrorPayload = {
      name: boundaryName,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    };
    console.error(`[ErrorBoundary:${boundaryName}]`, error, errorInfo);

    if (typeof window !== 'undefined') {
      window.__WF_STAGING_ERRORS = window.__WF_STAGING_ERRORS || [];
      window.__WF_STAGING_ERRORS.push(payload);
    }

    if (this.props.onError) {
      this.props.onError(error, errorInfo, payload);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: '#f00', color: '#fff', fontFamily: 'monospace' }}>
          <h2>{this.props.name ?? 'Application'} Error</h2>
          <p>We hit an unexpected issue. Please reload or try again.</p>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
