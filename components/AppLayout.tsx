import React from 'react';
import { Outlet } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';
import DebugPanel from './ui/DebugPanel';

/**
 * AppLayout — Single scroll container per route.
 *
 * Rules (Deliverable C):
 * - The route content area uses ONE scroll container (overflow-y-auto on this wrapper).
 * - No overflow-hidden wrappers that prevent scrolling.
 * - Pages rely on this container for scrolling, not nested scroll.
 * - Exception: Vault Preview section (only allowed nested scroll).
 */
const AppLayout: React.FC = () => {
    return (
        <ErrorBoundary>
            <div className="flex flex-col h-full w-full min-w-0">
                {/* Single scroll container for route content */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
                    <Outlet />
                </div>
                <DebugPanel />
            </div>
        </ErrorBoundary>
    );
};

export default AppLayout;
