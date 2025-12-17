
import React, { useState, useEffect } from 'react';

interface ResizablePanelProps {
    width: number;
    setWidth: (w: number) => void;
    minWidth?: number;
    maxWidth?: number;
    children: React.ReactNode;
    isOpen: boolean;
    onClose: () => void;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({ 
    width, setWidth, minWidth = 320, maxWidth = 800, children, isOpen, onClose 
}) => {
    const [isResizing, setIsResizing] = useState(false);
    
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            // Calculate new width from right edge
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                setWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none'; // Prevent text selection while dragging
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        };
    }, [isResizing, minWidth, maxWidth, setWidth]);

    if (!isOpen) return null;

    return (
        <div 
            className="fixed right-0 top-16 bottom-0 bg-white shadow-2xl z-[60] border-l border-slate-200 flex flex-col transition-all duration-75 ease-out"
            style={{ width: width }}
        >
            {/* Resize Handle */}
            <div 
                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-weflora-teal/50 transition-colors z-50 flex items-center justify-center group"
                onMouseDown={() => setIsResizing(true)}
            >
                {/* Visual indicator for handle */}
                <div className="h-8 w-1 rounded-full bg-slate-300 group-hover:bg-weflora-teal transition-colors"></div>
            </div>
            
            <div className="flex-1 flex flex-col overflow-hidden h-full relative">
                {children}
            </div>
        </div>
    );
};
