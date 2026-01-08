
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Chat, ChatMessage, ContextItem } from '../types';
import type { ExecutionState } from '../src/decision-program/types';
import ChatInput from './ChatInput';
import { MessageRenderer, CitationsChip } from './MessageRenderer';
import { FloraGPTJsonRenderer } from './FloraGPTJsonRenderer';
import CitationsSidebar from './CitationsSidebar';
import PlanningRunnerView from './planning/PlanningRunnerView';
import { buildProgram } from '../src/decision-program/orchestrator/buildProgram';
import { inferIntent } from '../src/decision-program/orchestrator/inferIntent';
import { buildActionCards } from '../src/decision-program/orchestrator/buildActionCards';
import {
    buildDefaultPatchesForPointers,
    buildDefaultsLogEntry
} from '../src/decision-program/orchestrator/pointerInputRegistry';
import { planRun } from '../src/decision-program/orchestrator/planRun';
import { runAgentStep } from '../src/decision-program/orchestrator/runAgentStep';
import { buildAgentRegistry } from '../src/decision-program/agents/registry';
import { setByPointer } from '../src/decision-program/runtime/pointers';
import { buildRouteLogEntry, handleRouteAction } from '../src/decision-program/ui/decision-accelerator/routeHandlers';
import { promoteDraftMatrixToWorksheet } from '../utils/draftMatrixPromotion';
import { useChat } from '../contexts/ChatContext';
import { useProject } from '../contexts/ProjectContext';
import { useUI } from '../contexts/UIContext';
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
    draftKey?: string;
}

const ChatView: React.FC<ChatViewProps> = ({ 
    chat, messages, onBack, onSendMessage, isGenerating, 
    onRegenerateMessage, onOpenMenu, variant = 'full',
    onContinueInReport, onContinueInWorksheet, contextProjectId, draftKey
}) => {
    const navigate = useNavigate();
    const { upsertPlanningRun } = useChat();
    const { createMatrix } = useProject();
    const { showNotification } = useUI();
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
    const [highlightedFileName, setHighlightedFileName] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const lastIntentMessageId = useRef<string | null>(null);
    const persistenceErrorLogged = useRef(false);

    const program = useMemo(() => buildProgram(), []);
    const agentRegistry = useMemo(() => buildAgentRegistry(), []);
    const defaultDecisionContext = useMemo(
        () => ({
            site: {},
            regulatory: {},
            equity: {},
            species: {},
            supply: {},
            selectedDocs: [] as any[]
        }),
        []
    );
    const initialDecisionState = useMemo(() => {
        const planned = planRun(program, defaultDecisionContext);
        return { ...planned, actionCards: buildActionCards(planned) };
    }, [defaultDecisionContext, program]);
    const [decisionState, setDecisionState] = useState<ExecutionState>(initialDecisionState);
    const [viewMode, setViewMode] = useState<'chat' | 'decision'>('chat');
    const evidenceCount = useMemo(() => {
        if (!decisionState.draftMatrix) return 0;
        return decisionState.draftMatrix.rows.reduce((total, row) => {
            return total + row.cells.reduce((cellTotal, cell) => cellTotal + (cell.evidence?.length ?? 0), 0);
        }, 0);
    }, [decisionState.draftMatrix]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            upsertPlanningRun({
                runId: decisionState.runId,
                programId: decisionState.programId,
                executionState: decisionState,
                status: decisionState.status,
                projectId: contextProjectId ?? null
            });
        }, 600);
        return () => window.clearTimeout(timeout);
    }, [contextProjectId, decisionState, upsertPlanningRun]);

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

    const withActionCards = useCallback((state: ExecutionState) => ({
        ...state,
        actionCards: buildActionCards(state)
    }), []);

    const promoteToWorksheet = useCallback(async () => {
        if (!decisionState.draftMatrix) return;
        const hasEvidence = decisionState.draftMatrix.rows.some((row) =>
            row.cells.some((cell) => (cell.evidence ?? []).length > 0)
        );
        const includeCitations = hasEvidence ? window.confirm('Include citations column?') : false;
        const { columns: worksheetColumns, rows: worksheetRows } = promoteDraftMatrixToWorksheet(
            decisionState.draftMatrix,
            { includeCitations }
        );
        const created = await createMatrix({
            id: `mtx-${Date.now()}`,
            title: decisionState.draftMatrix.title ?? 'Draft Matrix',
            description: 'Planning matrix promotion',
            columns: worksheetColumns,
            rows: worksheetRows,
            projectId: contextProjectId ?? undefined
        });
        if (!created?.id) {
            showNotification('Worksheet creation not implemented', 'error');
            return;
        }
        showNotification('Worksheet created', 'success');
        navigate(`/worksheets/${created.id}`);
    }, [contextProjectId, createMatrix, decisionState.draftMatrix, navigate, showNotification]);

    const startDecisionRun = useCallback(async () => {
        const planned = withActionCards(planRun(program, defaultDecisionContext));
        setDecisionState(planned);
        const stepped = await runAgentStep(planned, program, agentRegistry);
        setDecisionState(withActionCards(stepped));
    }, [agentRegistry, defaultDecisionContext, program, withActionCards]);

    const stepsVM = useMemo(() => {
        if (decisionState.status === 'idle') {
            return [];
        }

        const lastActiveIndex = program.steps.reduce((acc, step, index) => {
            const stepState = decisionState.steps.find(candidate => candidate.stepId === step.id);
            if (!stepState) return acc;
            if (stepState.status !== 'queued') return index;
            if (decisionState.currentStepId === step.id) return index;
            return acc;
        }, -1);

        const visibleSteps =
            decisionState.status === 'done'
                ? program.steps
                : program.steps.slice(0, lastActiveIndex + 1);

        return visibleSteps.map(step => {
            const stepState = decisionState.steps.find(candidate => candidate.stepId === step.id);
            const startedAt = stepState?.startedAt;
            const endedAt = stepState?.endedAt;
            const durationMs =
                startedAt && endedAt
                    ? new Date(endedAt).getTime() - new Date(startedAt).getTime()
                    : undefined;
            const relatedLogs = decisionState.logs.filter((entry) => entry.data?.stepId === step.id);
            const summary = relatedLogs[relatedLogs.length - 1]?.message;
            return {
                stepId: step.id,
                title: step.title,
                kind: step.kind,
                phase: step.phase,
                agentRef: step.agentRef,
                status: (stepState?.status ?? 'queued') as any,
                startedAt,
                endedAt,
                durationMs,
                blockingMissingInputs: stepState?.blockingMissingInputs,
                error: stepState?.error,
                summary,
                reasoningSummary: stepState?.reasoningSummary,
                evidenceCount,
                producesPointers: step.producesPointers
            };
        });
    }, [decisionState.currentStepId, decisionState.logs, decisionState.status, decisionState.steps, evidenceCount, program.steps]);

    const handleSubmitActionCard = useCallback(
        async ({ cardId, cardType, input }: { cardId: string; cardType: 'deepen' | 'refine' | 'next_step'; input?: Record<string, unknown> }) => {
            const action = typeof (input as any)?.action === 'string' ? ((input as any).action as string) : null;
            const resumeRequested = Boolean((input as any)?.resume);
            let patches = Array.isArray((input as any)?.patches)
                ? ((input as any).patches as Array<{ pointer: string; value: unknown }>)
                : [];
            const contextPatch = input && (input as any).context && typeof (input as any).context === 'object'
                ? ((input as any).context as any)
                : null;

            let handledRoute = false;
            let nextStateSnapshot: ExecutionState | null = null;

            setDecisionState((prev) => {
                let nextState = { ...prev };
                if (action) {
                    handledRoute = handleRouteAction({
                        action,
                        onPromoteToWorksheet: () => {
                            promoteToWorksheet();
                        },
                        onDraftReport: () => {
                            if (!onContinueInReport) {
                                showNotification('Report drafting not yet implemented', 'error');
                                return;
                            }
                            onContinueInReport({
                                id: `decision-report-${cardId}`,
                                sender: 'ai',
                                text: 'Planning Action: draft report.'
                            } as ChatMessage);
                        },
                        toast: (message) => showNotification(message, 'error')
                    });
                    if (handledRoute) {
                        nextState = {
                            ...nextState,
                            logs: [...nextState.logs, buildRouteLogEntry({ action, runId: nextState.runId })]
                        };
                        nextStateSnapshot = nextState;
                        return withActionCards(nextState);
                    }
                }

            if (cardType === 'refine' && action === 'refine:apply-defaults') {
                const card = prev.actionCards.find(candidate => candidate.id === cardId);
                const pointers = card?.inputs?.map((candidate) => candidate.pointer) ?? [];
                const { patches: defaultPatches, appliedPointers } = buildDefaultPatchesForPointers(prev, pointers);
                if (appliedPointers.length > 0) {
                    patches = defaultPatches;
                        nextState = {
                            ...nextState,
                            logs: [...nextState.logs, buildDefaultsLogEntry({ runId: nextState.runId, pointers: appliedPointers })]
                        };
                    } else {
                        patches = [];
                }
            }

                patches.forEach((patch) => {
                    try {
                        setByPointer(nextState, patch.pointer, patch.value);
                    } catch (error) {
                        console.error('decision_program_patch_failed', {
                            runId: nextState.runId,
                            pointer: patch.pointer,
                            error: (error as Error).message
                        });
                    }
                });

                if (contextPatch) {
                    nextState.context = { ...nextState.context, ...contextPatch };
                }

            nextStateSnapshot = nextState;
            return withActionCards(nextState);
        });

            if (handledRoute && action) {
                return { navigation: { kind: action.replace('route:', '') as 'worksheet' | 'report' } };
            }

            if (cardType === 'next_step') {
                return { navigation: { kind: 'worksheet' } };
            }

            if (nextStateSnapshot) {
                const shouldResume =
                    cardType === 'refine' &&
                    (resumeRequested || action === 'refine:continue' || action === 'refine:apply-defaults');
                if (!shouldResume) {
                    return { patches, resumeRun: false };
                }
                const resumeState =
                    nextStateSnapshot.status === 'done'
                        ? {
                            ...nextStateSnapshot,
                            status: 'running',
                            steps: nextStateSnapshot.steps.map((step) =>
                                step.status === 'done'
                                    ? {
                                        ...step,
                                        status: 'queued',
                                        startedAt: undefined,
                                        endedAt: undefined,
                                        error: undefined
                                    }
                                    : step
                            )
                        }
                        : nextStateSnapshot;
                const stepped = await runAgentStep(resumeState, program, agentRegistry);
                setDecisionState(withActionCards(stepped));
                return { patches, resumeRun: true };
            }
            return { patches, resumeRun: false };
        },
        [agentRegistry, onContinueInReport, program, promoteToWorksheet, showNotification, withActionCards]
    );

    useEffect(() => {
        const lastUserMessage = [...messages].reverse().find(message => message.sender === 'user');
        if (!lastUserMessage) return;
        if (lastIntentMessageId.current === lastUserMessage.id) return;
        lastIntentMessageId.current = lastUserMessage.id;
        const intent = inferIntent(lastUserMessage.text || '');
        if (['suggest', 'compare', 'shortlist', 'propose'].includes(intent)) {
            setViewMode('decision');
            if (decisionState.status === 'idle') {
                startDecisionRun();
            }
        }
    }, [decisionState.status, messages, startDecisionRun]);

    useEffect(() => {
        if (!decisionState.runId) return;
        try {
            localStorage.setItem('decision-program:lastRun', JSON.stringify({
                runId: decisionState.runId,
                status: decisionState.status,
                updatedAt: new Date().toISOString()
            }));
        } catch (error) {
            if (!persistenceErrorLogged.current) {
                persistenceErrorLogged.current = true;
                console.error('decision_program_persistence_error', {
                    runId: decisionState.runId,
                    error: (error as Error).message
                });
            }
        }
    }, [decisionState.runId, decisionState.status]);

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
                    <div className="flex items-center gap-2">
                        <div className="flex rounded-lg bg-slate-100 p-1">
                            <button
                                onClick={() => setViewMode('chat')}
                                className={`text-xs font-bold px-3 py-1.5 rounded-md transition-colors ${viewMode === 'chat' ? 'bg-white text-slate-800 shadow' : 'text-slate-500'}`}
                            >
                                Chat
                            </button>
                            <button
                                onClick={() => setViewMode('decision')}
                                className={`text-xs font-bold px-3 py-1.5 rounded-md transition-colors ${viewMode === 'decision' ? 'bg-white text-slate-800 shadow' : 'text-slate-500'}`}
                            >
                                Planning
                            </button>
                        </div>
                        {viewMode === 'chat' && (
                            <button 
                                onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedMessageIds(new Set()); }}
                                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${isSelectionMode ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                {isSelectionMode ? 'Cancel Selection' : 'Select Messages'}
                            </button>
                        )}
                    </div>
                </header>

                {viewMode === 'chat' ? (
                    <>
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
                                                        <div className="flex items-center justify-end gap-2 mb-2">
                                                            {import.meta.env.DEV && (
                                                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-slate-200 text-slate-500">
                                                                    {msg.floraGPT ? 'Structured v0.2' : 'Legacy'}
                                                                </span>
                                                            )}
                                                            <CitationsChip citations={msg.citations} label="Assistant answer" />
                                                        </div>
                                                    )}
                                                    {msg.sender === 'ai' && msg.floraGPT
                                                        ? <FloraGPTJsonRenderer payload={msg.floraGPT} />
                                                        : <MessageRenderer text={msg.text} />}
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
                                                                title="Preview Worksheet"
                                                            >
                                                                <TableIcon className="h-3.5 w-3.5" />
                                                                Preview Worksheet
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
                    </>
                ) : (
                    <PlanningRunnerView
                        program={program}
                        state={decisionState}
                        stepsVM={stepsVM}
                        onStartRun={startDecisionRun}
                        onSubmitCard={handleSubmitActionCard}
                        onPromoteToWorksheet={(payload) => onContinueInWorksheet?.({
                            id: `decision-${payload.matrixId}`,
                            sender: 'ai',
                            text: `Planning Matrix promoted (${payload.rowIds?.length ?? 'all'} rows).`
                        } as ChatMessage)}
                    />
                )}

                {viewMode === 'chat' && (
                    <>
                        {/* Bulk Actions Bar */}
                        {isSelectionMode && selectedMessageIds.size > 0 && (
                            <div className="p-3 bg-slate-800 text-white flex items-center justify-between px-6 animate-slideUp">
                                <span className="text-sm font-bold">{selectedMessageIds.size} messages selected</span>
                                <div className="flex gap-3">
                                    <button onClick={() => handleBulkAction('report')} className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors">
                                        <FileTextIcon className="h-4 w-4" /> Convert to Report
                                    </button>
                                    <button onClick={() => handleBulkAction('worksheet')} className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors">
                                        <TableIcon className="h-4 w-4" /> Preview Worksheet
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
                                        draftKey={draftKey}
                                    />
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Citations Sidebar (Responsive, maybe hidden on small screens or toggleable) */}
            {viewMode === 'chat' && variant === 'full' && messages.some(m => m.citations && m.citations.length > 0) && (
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
