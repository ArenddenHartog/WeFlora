
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from './icons';

interface BaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Visible title (DialogTitle). Required for accessibility. */
    title: React.ReactNode;
    /** Subtitle / description (aria-describedby target) */
    subtitle?: string;
    /** Small uppercase text above title (e.g. "STEP 1 OF 3") */
    kicker?: string;
    /** Size: responsive — full width on mobile, constrained on desktop */
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
    children: React.ReactNode;
    /** Footer: secondary actions left, primary right. Rendered in a flex-end row. */
    footer?: React.ReactNode;
    className?: string;
}

/**
 * BaseModal — Design contract (Deliverable C2):
 * - Always has a visible title (DialogTitle) and description (or explicit aria-describedby)
 * - Consistent footer buttons (secondary left, primary right)
 * - Responsive: full width on mobile, max-w-lg or max-w-2xl on desktop
 * - Modal body scrolls internally if content is long (acceptable inside modal)
 * - Never introduces new outer scroll containers
 */
const BaseModal: React.FC<BaseModalProps> = ({ 
    isOpen, onClose, title, subtitle, kicker, size = 'md', children, footer, className 
}) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const titleId = 'modal-title';
    const descId = subtitle ? 'modal-desc' : undefined;

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

    const sizeClasses: Record<string, string> = {
        sm: 'max-w-sm',
        md: 'max-w-lg',
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
            aria-labelledby={titleId}
            aria-describedby={descId}
        >
            {/* Blurred Backdrop */}
            <div 
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity duration-300 animate-fadeIn"
                onClick={onClose}
            />

            {/* Modal Container — responsive width */}
            <div 
                ref={modalRef}
                className={`
                    relative bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden
                    transform transition-all duration-300 scale-100 animate-slideUp
                    max-h-[90vh] ${sizeClasses[size] || sizeClasses.md} ${className || ''}
                `}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header — always visible title */}
                <header className="px-6 pt-6 pb-3 flex items-start justify-between shrink-0 bg-white md:px-8 md:pt-8 md:pb-4">
                    <div className="flex-1 min-w-0 pr-4">
                        {kicker && (
                            <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2">
                                {kicker}
                            </p>
                        )}
                        <div id={titleId} className="text-xl font-bold text-slate-900 leading-tight md:text-2xl">
                            {title}
                        </div>
                        {subtitle && (
                            <div id={descId} className="text-sm text-slate-500 mt-1">
                                {subtitle}
                            </div>
                        )}
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                        aria-label="Close modal"
                    >
                        <XIcon className="h-5 w-5 md:h-6 md:w-6" />
                    </button>
                </header>

                {/* Body — scrolls internally if content is long */}
                <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2 md:px-8 md:pb-8">
                    {children}
                </div>

                {/* Footer — secondary left, primary right */}
                {footer && (
                    <footer className="px-6 py-4 bg-white border-t border-slate-100 shrink-0 flex items-center justify-end gap-3 md:px-8 md:py-5">
                        {footer}
                    </footer>
                )}
            </div>
        </div>,
        document.body
    );
};

export default BaseModal;
