
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from './icons';

interface BaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: React.ReactNode;
    subtitle?: string; // Added subtitle
    kicker?: string; // Small uppercase text above title (e.g. "STEP 1 OF 3")
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
    children: React.ReactNode;
    footer?: React.ReactNode;
    className?: string;
}

const BaseModal: React.FC<BaseModalProps> = ({ 
    isOpen, onClose, title, subtitle, kicker, size = 'md', children, footer, className 
}) => {
    const modalRef = useRef<HTMLDivElement>(null);

    // Handle Escape Key & Scroll Locking
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            document.body.style.overflow = 'hidden';
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.body.style.overflow = '';
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-[480px]', // Slightly wider than standard md for better form fit
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
        '2xl': 'max-w-6xl',
        'full': 'max-w-[95vw]'
    };

    return createPortal(
        <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
        >
            {/* Blurred Backdrop */}
            <div 
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity duration-300 animate-fadeIn"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div 
                ref={modalRef}
                className={`
                    relative bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden transform transition-all duration-300 scale-100 animate-slideUp
                    max-h-[90vh] ${sizeClasses[size]} ${className || ''}
                `}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <header className="px-8 pt-8 pb-4 flex items-start justify-between shrink-0 bg-white">
                    <div className="flex-1 min-w-0 pr-4">
                        {kicker && (
                            <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2">
                                {kicker}
                            </p>
                        )}
                        <div className="text-2xl font-bold text-slate-900 leading-tight">
                            {title}
                        </div>
                        {subtitle && (
                            <div className="text-sm text-slate-500 mt-1">
                                {subtitle}
                            </div>
                        )}
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                        aria-label="Close modal"
                    >
                        <XIcon className="h-6 w-6" />
                    </button>
                </header>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-8 pb-8 pt-2 custom-scrollbar">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <footer className="px-8 py-6 bg-white border-t border-slate-50 shrink-0 flex items-center justify-end gap-3">
                        {footer}
                    </footer>
                )}
            </div>
        </div>,
        document.body
    );
};

export default BaseModal;