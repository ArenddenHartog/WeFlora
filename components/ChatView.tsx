
import React, { useState, useEffect, useRef } from 'react';
import type { Chat, ChatMessage, ContextItem } from '../types';
import ChatInput from './ChatInput';
import { MessageRenderer, EvidenceChip } from './MessageRenderer';
import CitationsSidebar from './CitationsSidebar';
import { 
    MenuIcon, ArrowUpIcon, RefreshIcon, CopyIcon, 
    FileTextIcon, TableIcon, CheckCircleIcon, CircleIcon,
    ChevronRightIcon, SparklesIcon, LogoIcon
} from './icons';

interface ChatViewProps {
    chat: Chat;
    messages: ChatMessage[];
    onBack: () => void;
    onSendMessage: (text: string, files?: File[], instructions?: string, model?: string, contextItems?: ContextItem[]) => void;
    isGenerating: boolean;
    // Removed onProjectFileCitationClick
    onRegenerateMessage: (id: string) => void;
    onOpenMenu: () => void;
    variant?: 'full' | 'panel';
    onContinueInReport?: (message: ChatMessage) => void;
    onContinueInWorksheet?: (message: ChatMessage) => void;
    contextProjectId?: string; // New prop for scoping
}

const ChatView: React.FC<ChatViewProps> = ({ 
    chat, messages, onBack, onSendMessage, isGenerating, 
    onRegenerateMessage, onOpenMenu, variant = 'full',
    onContinueInReport, onContinueInWorksheet, contextProjectId
}) => {
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
    const [highlightedFileName, setHighlightedFileName] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isGenerating]);

    const handleToggleSelection = (id: string) => {
        setSelectedMessageIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleBulkAction = (action: 'report' | 'worksheet') => {
        const selectedMsgs = messages.filter(m => selectedMessageIds.has(m.id));
        if (selectedMsgs.length === 0) return;
        
        // Preserve chronological order
        const indices = new Map<string, number>(messages.map((m, i) => [m.id, i]));
        selectedMsgs.sort((a, b) => (indices.get(a.id) || 0) - (indices.get(b.id) || 0));

        const combinedText = selectedMsgs.map(m => 
            `**${m.sender === 'user' ? 'User' : 'FloraGPT'}**: ${m.text}`
        ).join('\n\n---\n\n');

        const syntheticMessage: ChatMessage = {
            id: `bulk-${Date.now()}`,
            sender: 'ai',
            text: combinedText, 
        } as ChatMessage;

        if (action === 'report' && onContinueInReport) {
            onContinueInReport(syntheticMessage);
        } else if (action === 'worksheet' && onContinueInWorksheet) {
            onContinueInWorksheet(syntheticMessage);
        }
        
        setIsSelectionMode(false);
        setSelectedMessageIds(new Set());
    };

    return (
        <div className="flex h-full bg-white relative overflow-hidden">
            <div className="flex-1 flex flex-col min-w-0">
                <header className="flex-none h-14 border-b border-slate-200 flex items-center justify-between px-4 bg-white z-20">
                    <div className="flex items-center gap-3">
                        {variant === 'full' && (
                            <button onClick={onOpenMenu} className="md:hidden p-1 -ml-1 text-slate-600">
                                <MenuIcon className="h-6 w-6" />
                            </button>
                        )}
                        {onBack && (
                            <button onClick={onBack} className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm font-medium pr-3 border-r border-slate-200 h-6">
                                <ChevronRightIcon className="h-4 w-4 rotate-180" /> Back
                            </button>
                        )}
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-sm truncate max-w-[200px]">
                                {chat.title}
                            </span>
                        </div>
                    </div>
                    <div>
                        <button 
                            onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedMessageIds(new Set()); }}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${isSelectionMode ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            {isSelectionMode ? 'Cancel Selection' : 'Select Messages'}
                        </button>
                    </div>
                </header>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/30">
                    <div className="max-w-3xl mx-auto space-y-6 pb-4">
                        {messages.length === 0 && (
                            <div className="text-center py-20 text-slate-400">
                                <SparklesIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p>Start the conversation...</p>
                            </div>
                        )}

                        {messages.map(msg => {
                            // Robust Table Detection Logic: Look for pipe separator lines
                            const hasTable = /\|.*\|/.test(msg.text) && /\|[\s-]*\|/.test(msg.text);
                            
                            return (
                                <div key={msg.id} className={`group flex gap-4 ${msg.sender === 'user' ? 'flex-row-reverse' : ''} ${isSelectionMode ? 'cursor-pointer' : ''}`} onClick={() => isSelectionMode && handleToggleSelection(msg.id)}>
                                    {isSelectionMode && (
                                        <div className="flex items-center justify-center shrink-0 pt-2">
                                            {selectedMessageIds.has(msg.id) ? <CheckCircleIcon className="h-5 w-5 text-weflora-teal" /> : <CircleIcon className="h-5 w-5 text-slate-300" />}
                                        </div>
                                    )}
                                    
                                    <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center mt-1 text-[10px] font-bold shadow-sm ${msg.sender === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-weflora-teal text-white'}`}>
                                        {msg.sender === 'user' ? 'You' : <LogoIcon className="h-5 w-5 fill-white" />}
                                    </div>

                                    <div className={`flex-1 min-w-0 max-w-[85%] ${msg.sender === 'user' ? 'text-right' : ''}`}>
                                        <div className={`prose prose-sm max-w-none text-slate-700 leading-relaxed ${msg.sender === 'user' ? 'bg-white border border-slate-200 p-3 rounded-2xl rounded-tr-none shadow-sm text-left inline-block' : ''}`}>
                                            {msg.sender === 'ai' && (
                                                <div className="flex justify-end mb-2">
                                                    <EvidenceChip citations={msg.citations} label="Assistant answer" />
                                                </div>
                                            )}
                                            <MessageRenderer text={msg.text} />
                                        </div>
                                        
                                        {/* Footer / Actions for AI Message */}
                                        {msg.sender === 'ai' && !isSelectionMode && (
                                            <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="p-1 hover:bg-slate-100 rounded text-slate-400" title="Copy"><CopyIcon className="h-3.5 w-3.5" /></button>
                                                <button className="p-1 hover:bg-slate-100 rounded text-slate-400" title="Regenerate" onClick={() => onRegenerateMessage(msg.id)}><RefreshIcon className="h-3.5 w-3.5" /></button>
                                                
                                                {onContinueInReport && <button onClick={() => onContinueInReport(msg)} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-weflora-teal" title="Use in Report"><FileTextIcon className="h-3.5 w-3.5" /></button>}
                                                
                                                {/* Smart Worksheet Action */}
                                                {onContinueInWorksheet && (
                                                    <button 
                                                        onClick={() => onContinueInWorksheet(msg)} 
                                                        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors hover:bg-weflora-mint/20 hover:text-weflora-dark text-slate-400`}
                                                        title="Extract Data to Worksheet"
                                                    >
                                                        <TableIcon className="h-3.5 w-3.5" />
                                                        Extract Data
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        
                        {isGenerating && (
                            <div className="flex gap-4 animate-pulse">
                                <div className="w-8 h-8 rounded-full bg-weflora-teal text-white shrink-0 flex items-center justify-center">
                                    <LogoIcon className="h-5 w-5 fill-white" />
                                </div>
                                <div className="space-y-2 w-full max-w-md pt-2">
                                    <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                                    <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                                </div>
                            </div>
                        )}
                        <div ref={scrollRef} />
                    </div>
                </div>

                {/* Bulk Actions Bar */}
                {isSelectionMode && selectedMessageIds.size > 0 && (
                    <div className="p-3 bg-slate-800 text-white flex items-center justify-between px-6 animate-slideUp">
                        <span className="text-sm font-bold">{selectedMessageIds.size} messages selected</span>
                        <div className="flex gap-3">
                            <button onClick={() => handleBulkAction('report')} className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors">
                                <FileTextIcon className="h-4 w-4" /> Convert to Report
                            </button>
                            <button onClick={() => handleBulkAction('worksheet')} className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors">
                                <TableIcon className="h-4 w-4" /> Create Worksheet
                            </button>
                        </div>
                    </div>
                )}

                {/* Input Area */}
                {!isSelectionMode && (
                    <div className="p-4 bg-white border-t border-slate-200">
                        <div className="max-w-3xl mx-auto">
                            <ChatInput 
                                onSend={onSendMessage} 
                                isLoading={isGenerating}
                                highlightedFileName={highlightedFileName}
                                contextProjectId={contextProjectId}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Citations Sidebar (Responsive, maybe hidden on small screens or toggleable) */}
            {variant === 'full' && messages.some(m => m.citations && m.citations.length > 0) && (
                <CitationsSidebar 
                    messages={messages} 
                    highlightedFileName={highlightedFileName}
                    onSourceClick={setHighlightedFileName}
                />
            )}
        </div>
    );
};

export default ChatView;
