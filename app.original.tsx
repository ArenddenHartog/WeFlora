import React from 'react';
import App from './App';

// Bootloader interface
export function mount(rootElement: HTMLElement, ReactLib: any, createRoot: any) {
    console.log("[ORIGINAL] Mounting Full App...");
    
    // Use the passed createRoot to ensure version compatibility with the bootloader
    const root = createRoot(rootElement);
    
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );

    return () => {
        console.log("[ORIGINAL] Unmounting...");
        root.unmount();
    };
}