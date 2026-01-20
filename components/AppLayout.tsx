import React from 'react';
import { Outlet } from 'react-router-dom';

const AppLayout: React.FC = () => {
    return (
        <div className="flex flex-col h-full w-full min-w-0">
            <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
                <Outlet />
            </div>
        </div>
    );
};

export default AppLayout;
