
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../contexts/ChatContext';
import { useUI } from '../contexts/UIContext';
import { 
    SearchIcon, MenuIcon, MessageSquareIcon, ClockIcon, XIcon, ChevronRightIcon, ChatBubbleIcon, PinIcon, PinFilledIcon, FlowerIcon
} from './icons';
import ConfirmDeleteModal from './ConfirmDeleteModal';

interface ResearchHistoryViewProps {
    onOpenMenu: () => void;
}

const ResearchHistoryView: React.FC<ResearchHistoryViewProps> = ({ onOpenMenu }) => {
    const { threads, planningRuns, setActiveThreadId, togglePinThread, deleteThread } = useChat();
    const { navigateToHome, setSessionOpenOrigin } = useUI();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [pendingDeleteThreadId, setPendingDeleteThreadId] = useState<string | null>(null);

    const filteredThreads = threads
        .filter(t => t.title.toLowerCase().includes(search.toLowerCase()) || 
                     t.messages.some(m => m.text.toLowerCase().includes(search.toLowerCase())))
        .sort((a, b) => {
            // Sort by pinned status first
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            // Then by date
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });

    const handleThreadClick = (threadId: string) => {
        setSessionOpenOrigin('sessions');
        setActiveThreadId(threadId);
        navigateToHome();
    };

    const handleDeleteThread = (e: React.MouseEvent, threadId: string) => {
        e.stopPropagation();
        setPendingDeleteThreadId(threadId);
    };

    const handlePinThread = (e: React.MouseEvent, threadId: string) => {
        e.stopPropagation();
        togglePinThread(threadId);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const statusBadgeClass = (status: string) => {
        switch (status) {
            case 'done':
                return 'bg-emerald-50 text-emerald-700';
            case 'running':
                return 'bg-amber-50 text-amber-700';
            case 'blocked':
                return 'bg-amber-100 text-amber-800';
            case 'error':
                return 'bg-rose-50 text-rose-700';
            default:
                return 'bg-slate-100 text-slate-500';
        }
    };

    return (
        <div className="h-full overflow-y-auto bg-white p-4 md:p-8">
            <header className="mb-8">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={onOpenMenu} className="md:hidden p-1 -ml-1 text-slate-600">
                        <MenuIcon className="h-6 w-6" />
                    </button>
                    <div className="h-10 w-10 bg-weflora-mint/20 rounded-xl flex items-center justify-center text-weflora-teal">
                        <MessageSquareIcon className="h-6 w-6" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">Sessions History</h1>
                </div>

                <div className="relative w-full max-w-md">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search threads..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none text-slate-900"
                    />
                </div>
            </header>

            <div className="space-y-6 max-w-4xl">
                {planningRuns.length > 0 && (
                    <div>
                        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Planning</h2>
                        <div className="space-y-3">
                            {planningRuns.map((run) => (
                                <div
                                    key={run.runId}
                                    onClick={() => navigate(`/planning/${run.runId}`)}
                                    className="group flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:shadow-sm hover:border-weflora-teal transition-all cursor-pointer"
                                >
                                    <div className="flex items-start gap-4 min-w-0">
                                        <div className="mt-1 h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-weflora-mint/20 text-weflora-teal">
                                            <FlowerIcon className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-sm truncate pr-4 text-slate-800 group-hover:text-weflora-teal">
                                                {run.executionState?.draftMatrix?.title ?? 'Planning run'}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-medium">
                                                <span className={`px-2 py-0.5 rounded-full ${statusBadgeClass(run.status)}`}>
                                                    {run.status}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <ClockIcon className="h-3 w-3" /> {formatDate(run.updatedAt ?? run.createdAt ?? new Date().toISOString())}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRightIcon className="h-4 w-4 text-slate-300" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Research</h2>
                    {filteredThreads.length === 0 ? (
                        <div className="text-center py-20 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <MessageSquareIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p className="text-sm">No research threads found.</p>
                        </div>
                    ) : (
                        filteredThreads.map(thread => (
                            <div 
                                key={thread.id}
                                onClick={() => handleThreadClick(thread.id)}
                                className={`group flex items-center justify-between p-4 bg-white border rounded-xl hover:shadow-sm transition-all cursor-pointer ${thread.isPinned ? 'border-weflora-teal bg-weflora-mint/5' : 'border-slate-200 hover:border-slate-400'}`}
                            >
                                <div className="flex items-start gap-4 min-w-0">
                                    <div className={`mt-1 h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${thread.isPinned ? 'bg-weflora-mint/20 text-weflora-teal' : 'bg-slate-50 text-slate-400'}`}>
                                        {thread.isPinned ? <PinFilledIcon className="h-4 w-4" /> : <MessageSquareIcon className="h-4 w-4" />}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className={`font-bold text-sm truncate pr-4 transition-colors ${thread.isPinned ? 'text-weflora-dark' : 'text-slate-800 group-hover:text-weflora-teal'}`}>
                                            {thread.title}
                                        </h3>
                                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                                            {thread.messages[thread.messages.length - 1]?.text || 'No messages'}
                                        </p>
                                        <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 font-medium">
                                            <span className="flex items-center gap-1">
                                                <ClockIcon className="h-3 w-3" /> {formatDate(thread.updatedAt)}
                                            </span>
                                            {thread.contextSnapshot && thread.contextSnapshot.length > 0 && (
                                                <>
                                                    <span>•</span>
                                                    <span>{thread.contextSnapshot.length} references</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 pl-4 shrink-0">
                                    <button
                                        onClick={(e) => handlePinThread(e, thread.id)}
                                        className={`p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100 ${thread.isPinned ? 'text-weflora-teal bg-weflora-mint/20 hover:bg-weflora-mint/30 opacity-100' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'}`}
                                        title={thread.isPinned ? "Unpin Thread" : "Pin Thread"}
                                    >
                                        {thread.isPinned ? <PinFilledIcon className="h-4 w-4" /> : <PinIcon className="h-4 w-4" />}
                                    </button>
                                    <button 
                                        onClick={(e) => handleDeleteThread(e, thread.id)}
                                        className="p-2 text-slate-300 hover:text-weflora-red hover:bg-weflora-red/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                        title="Delete Thread"
                                    >
                                        <XIcon className="h-4 w-4" />
                                    </button>
                                    <ChevronRightIcon className="h-4 w-4 text-slate-300" />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <ConfirmDeleteModal
                isOpen={Boolean(pendingDeleteThreadId)}
                title="Delete session?"
                description={`This will permanently delete "${
                    pendingDeleteThreadId ? (threads.find(t => t.id === pendingDeleteThreadId)?.title || 'this session') : 'this session'
                }". This cannot be undone.`}
                confirmLabel="Delete session"
                onCancel={() => setPendingDeleteThreadId(null)}
                onConfirm={() => {
                    if (!pendingDeleteThreadId) return;
                    deleteThread(pendingDeleteThreadId);
                    setPendingDeleteThreadId(null);
                }}
            />
        </div>
    );
};

export default ResearchHistoryView;
