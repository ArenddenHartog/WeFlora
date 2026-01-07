
import React, { useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PinnedProject, RecentItem, PromptTemplate, KnowledgeItem, ChatMessage, Thread, ProjectFile, Report, Matrix, ContextItem } from '../types';
import ChatInput from './ChatInput';
import { 
    ClockIcon, MenuIcon, TableIcon, PlusIcon, FolderIcon, FileTextIcon, 
    SparklesIcon, LogoIcon, RefreshIcon, CopyIcon, CheckIcon, BookmarkIcon,
    ArrowUpIcon, TrendingUpIcon, ChevronRightIcon, FlowerIcon
} from './icons'; 
import { MessageRenderer, CitationsChip } from './MessageRenderer';

interface HomeViewProps {
    pinnedProjects: PinnedProject[];
    recentItems: RecentItem[];
    // NOTE: Removed data arrays (reports, matrices, projectFiles, knowledgeItems) as ChatInput now uses Context
    activeThreadId: string | null;
    threads: Thread[];
    onSelectProject: (id: string) => void;
    onSendQuery: (text: string, files?: File[], instructions?: string, model?: string, contextItems?: ContextItem[]) => void;
    onOpenMenu: () => void;
    onOpenCreateWorksheet: () => void;
    onOpenCreateProject: () => void;
    onCreateReport: () => void;
    onPromoteToProject: () => void;
    onCopyContentToReport: (message: ChatMessage) => void;
    onCopyContentToWorksheet: (message: ChatMessage) => void;
    isGenerating: boolean;
    onNewChat?: () => void;
    onBack?: () => void;
}

const HomeView: React.FC<HomeViewProps> = ({ 
    pinnedProjects, recentItems, activeThreadId, threads,
    onSelectProject, onSendQuery, onOpenMenu, onOpenCreateWorksheet, onOpenCreateProject, onCreateReport,
    onPromoteToProject, onCopyContentToReport, onCopyContentToWorksheet,
    isGenerating, onNewChat, onBack
}) => {
    
    // Find active thread
    const activeThread = threads.find(t => t.id === activeThreadId);
    const messages = useMemo(() => activeThread?.messages || [], [activeThread?.messages]);
    const chatScrollRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    // Auto-scroll logic for thread view
    useEffect(() => {
        if ((activeThreadId || isGenerating) && chatScrollRef.current) {
            chatScrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, activeThreadId, isGenerating]);

    // --- ZERO STATE: DASHBOARD ---
    // Only show dashboard if no thread is active AND we are not currently creating one (generating)
    if (!activeThreadId && !isGenerating) {
        return (
            <div className="h-full flex flex-col bg-white">
                {/* Mobile Menu Trigger for Zero State */}
                <div className="md:hidden flex items-center p-4 pb-0">
                    <button onClick={onOpenMenu} className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <MenuIcon className="h-6 w-6" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center">
                    <header className="mb-8 md:mb-10 text-center relative w-full max-w-3xl mt-4 md:mt-8">
                        <div className="flex flex-col items-center gap-4 mb-6">
                            <div className="h-16 w-16 bg-weflora-mint/20 rounded-2xl flex items-center justify-center text-weflora-teal shadow-sm">
                                <LogoIcon className="h-10 w-10" />
                            </div>
                            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Knowledge work starts here</h1>
                        </div>
                        <p className="text-slate-500 text-lg">Automate species research, project analysis, and policy checks with FloraGPT</p>
                    </header>

                    <div className="w-full max-w-3xl flex flex-col items-center gap-2 mb-6">
                        <button
                            onClick={() => navigate('/planning')}
                            className="w-full max-w-2xl bg-weflora-teal text-white rounded-2xl px-6 py-4 font-semibold text-sm shadow-md hover:bg-weflora-dark transition-colors relative flex items-center"
                        >
                            <span className="absolute left-5 flex items-center">
                                <FlowerIcon className="h-5 w-5" />
                            </span>
                            <span className="w-full text-center">Start Automated Planning Flow</span>
                        </button>
                        <p className="text-lg text-slate-500">Or just ask</p>
                    </div>
        
                    <div className="w-full max-w-3xl mb-12 relative z-10">
                        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200/60 p-1">
                            <ChatInput 
                                onSend={onSendQuery} 
                                draftKey="weflora-home-draft"
                            />
                        </div>
                    </div>
        
                    {/* Quick Actions Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl mb-12">
                        <button onClick={onOpenCreateProject} className="flex flex-col items-start p-5 bg-white border border-slate-100 rounded-xl hover:border-weflora-teal hover:shadow-md transition-all group text-left">
                            <div className="p-2 bg-weflora-mint/20 text-weflora-teal rounded-lg mb-3 group-hover:scale-110 transition-transform">
                                <FolderIcon className="h-5 w-5" />
                            </div>
                            <span className="font-bold text-slate-800 text-sm">Create Project</span>
                            <span className="text-xs text-slate-400 mt-1">Organize your work</span>
                        </button>
                        <button onClick={onOpenCreateWorksheet} className="flex flex-col items-start p-5 bg-white border border-slate-100 rounded-xl hover:border-weflora-teal hover:shadow-md transition-all group text-left">
                            <div className="p-2 bg-weflora-mint/20 text-weflora-teal rounded-lg mb-3 group-hover:scale-110 transition-transform">
                                <TableIcon className="h-5 w-5" />
                            </div>
                            <span className="font-bold text-slate-800 text-sm">Build Worksheet</span>
                            <span className="text-xs text-slate-400 mt-1">Analyze data or species</span>
                        </button>
                        <button onClick={onCreateReport} className="flex flex-col items-start p-5 bg-white border border-slate-100 rounded-xl hover:border-weflora-teal hover:shadow-md transition-all group text-left">
                            <div className="p-2 bg-weflora-mint/20 text-weflora-teal rounded-lg mb-3 group-hover:scale-110 transition-transform">
                                <FileTextIcon className="h-5 w-5" />
                            </div>
                            <span className="font-bold text-slate-800 text-sm">Draft Report</span>
                            <span className="text-xs text-slate-400 mt-1">Write a document</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- ACTIVE THREAD STATE: RESEARCH INTERFACE ---
    return (
        <div className="h-full flex flex-col bg-white relative">
            {/* Thread Context Header */}
            <header className="flex-none h-14 border-b border-slate-100 flex items-center justify-between px-4 bg-white/80 backdrop-blur-md z-30">
                <div className="flex items-center gap-4">
                    <button onClick={onOpenMenu} className="md:hidden p-1 -ml-1 text-slate-600">
                        <MenuIcon className="h-6 w-6" />
                    </button>

                    {onBack && (
                        <button 
                            onClick={onBack}
                            className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm font-medium -ml-1 pr-3 border-r border-slate-200 h-6 mr-1"
                            title="Back to Sessions"
                        >
                            <ChevronRightIcon className="h-4 w-4 rotate-180" />
                            <span className="hidden sm:inline">Back</span>
                        </button>
                    )}

                    <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-sm truncate max-w-[200px] md:max-w-xs">
                            {activeThread?.title || 'New Research'}
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full hidden sm:inline-block">Research Session</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {onNewChat && (
                        <button 
                            onClick={onNewChat}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all"
                            title="Start a new research session"
                        >
                            <PlusIcon className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">New Chat</span>
                        </button>
                    )}
                    <button 
                        onClick={onPromoteToProject}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-weflora-teal text-weflora-teal hover:bg-weflora-mint/10 rounded-lg text-xs font-bold transition-all shadow-sm"
                        title="Move this research into a Project context"
                    >
                        <FolderIcon className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Promote to Project</span>
                    </button>
                </div>
            </header>

            {/* Chat Stream - flex-1 scrollable */}
            <div className="flex-1 overflow-y-auto p-4 md:p-0 scroll-smooth">
                <div className="max-w-3xl mx-auto w-full pt-6 px-4 md:px-0 pb-4">
                    {/* Only show "Start Research" if NOT generating and NO messages */}
                    {messages.length === 0 && !isGenerating && (
                        <div className="text-center py-20 text-slate-400">
                            <SparklesIcon className="h-12 w-12 mx-auto mb-4 text-weflora-teal/20" />
                            <p>Start your research...</p>
                        </div>
                    )}
                    
                    {messages.map((msg, index) => (
                        <div key={msg.id} className={`group mb-8 animate-fadeIn ${msg.sender === 'user' ? 'flex justify-end' : ''}`}>
                            <div className={`flex gap-4 max-w-full md:max-w-[90%] ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                                {/* Avatar */}
                                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold shadow-sm mt-1 ${
                                    msg.sender === 'user' ? 'bg-slate-100 text-slate-500' : 'bg-weflora-teal text-white'
                                }`}>
                                    {msg.sender === 'user' ? 'You' : <LogoIcon className="h-5 w-5 fill-white" />}
                                </div>

                                {/* Content */}
                                <div className={`flex-1 min-w-0 ${msg.sender === 'user' ? 'text-right' : ''}`}>
                                    <div className={`text-sm font-bold mb-1 ${msg.sender === 'user' ? 'text-slate-400' : 'text-slate-800'}`}>
                                        {msg.sender === 'user' ? 'You' : 'FloraGPT'}
                                    </div>
                                    <div className={`prose prose-sm max-w-none text-slate-700 leading-relaxed ${
                                        msg.sender === 'user' ? 'bg-slate-50 p-4 rounded-2xl rounded-tr-none text-left inline-block' : ''
                                    }`}>
                                        {msg.sender === 'ai' && (
                                            <div className="flex justify-end mb-2">
                                                <CitationsChip citations={msg.citations} label="Assistant answer" />
                                            </div>
                                        )}
                                        <MessageRenderer text={msg.text} />
                                    </div>

                                    {/* AI Footer Actions */}
                                    {msg.sender === 'ai' && !isGenerating && (
                                        <div className="flex items-center gap-3 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600" title="Copy Text">
                                                <CopyIcon className="h-4 w-4" />
                                            </button>
                                            <button className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600" title="Regenerate Response">
                                                <RefreshIcon className="h-4 w-4" />
                                            </button>
                                            <div className="h-4 w-px bg-slate-200"></div>
                                            <button 
                                                onClick={() => onCopyContentToReport(msg)}
                                                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-weflora-teal hover:bg-weflora-mint/10 px-2 py-1 rounded transition-colors"
                                            >
                                                <FileTextIcon className="h-3.5 w-3.5" />
                                                Copy to Report
                                            </button>
                                            <button 
                                                onClick={() => onCopyContentToWorksheet(msg)}
                                                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-weflora-teal hover:bg-weflora-mint/10 px-2 py-1 rounded transition-colors"
                                            >
                                                <TableIcon className="h-3.5 w-3.5" />
                                                Copy to Worksheet
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {isGenerating && (
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-weflora-teal text-white flex-shrink-0 flex items-center justify-center animate-pulse">
                                <LogoIcon className="h-5 w-5 fill-white" />
                            </div>
                            <div className="space-y-2 w-full max-w-md">
                                {messages.length === 0 && <div className="text-xs text-slate-400 mb-2">Initializing session...</div>}
                                <div className="h-4 bg-slate-100 rounded w-3/4 animate-pulse"></div>
                                <div className="h-4 bg-slate-100 rounded w-1/2 animate-pulse"></div>
                            </div>
                        </div>
                    )}
                    <div ref={chatScrollRef} />
                </div>
            </div>

            {/* Input Area - Flex Item (Not Absolute) */}
            <div className="flex-none p-4 bg-white z-20 border-t border-slate-100">
                <div className="max-w-3xl mx-auto shadow-lg rounded-2xl border border-slate-200 bg-white">
                    <ChatInput 
                        onSend={onSendQuery} 
                        isLoading={isGenerating}
                        initialContextItems={activeThread?.contextSnapshot}
                        draftKey={activeThreadId ? `thread-${activeThreadId}-draft` : undefined}
                    />
                </div>
            </div>
        </div>
    );
};

export default HomeView;
