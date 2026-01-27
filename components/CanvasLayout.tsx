import React from 'react';
import { Outlet } from 'react-router-dom';

const CanvasLayout: React.FC = () => {
    return (
        <div className="flex flex-col h-full w-full min-w-0">
            <div className="flex-1 overflow-hidden relative">
                <Outlet />
            </div>
        </div>
    );
};

export default CanvasLayout;
