import React from 'react';
import { Outlet } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';
import DebugPanel from './ui/DebugPanel';

const AppLayout: React.FC = () => {
    return (
        <ErrorBoundary>
            <div className="flex flex-col h-full w-full min-w-0">
                <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
                    <Outlet />
                </div>
                <DebugPanel />
            </div>
        </ErrorBoundary>
    );
};

export default AppLayout;
