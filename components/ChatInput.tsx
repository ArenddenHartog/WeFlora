
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { ProjectFile, ContextItem, PromptTemplate } from '../types';
import { FLORA_GPT_SYSTEM_INSTRUCTION } from '../services/prompts';
import {
  UploadIcon, XIcon, ArrowUpIcon, PlusIcon, 
  FolderIcon, DatabaseIcon, GlobeIcon, SearchIcon,
  CheckIcon, ChatBubbleIcon, MessageSquareIcon,
  TableIcon, FileTextIcon, SparklesIcon
} from './icons';
import { useProject } from '../contexts/ProjectContext';
import { useData } from '../contexts/DataContext';
import FilePicker from './FilePicker';
import { FILE_VALIDATION } from '../services/fileService';

interface ChatInputProps {
    // Logic Props
    onSend?: (text: string, files?: File[], instructions?: string, model?: string, contextItems?: ContextItem[], enableThinking?: boolean, outputLanguage?: 'auto' | 'en' | 'nl') => void;
    isLoading?: boolean;
    draftKey?: string;
    initialContextItems?: ContextItem[];
    languageKey?: string;
    
    // Scoping Prop
    contextProjectId?: string; // If provided, limits context to this project. If null, global.

    // UI Props
    highlightedFileName?: string | null;
    onFileClick?: (file: ProjectFile) => void;
    onRemoveContextFile?: (fileId: string) => void;
}

type ResponseMode = 'chat' | 'table' | 'report';

const ChatInput: React.FC<ChatInputProps> = ({ 
    onSend, isLoading, onFileClick, onRemoveContextFile, draftKey, initialContextItems, contextProjectId, languageKey
}) => {
    // -- Data Access via Hooks (Dependency Injection) --
    const { files: allFiles, matrices: allMatrices, reports: allReports, uploadProjectFile } = useProject();
    const { knowledgeItems, promptTemplates } = useData();

    // -- Derived State for Context Picker --
    const availableFiles = useMemo(() => {
        if (contextProjectId) return allFiles[contextProjectId] || [];
        return Object.values(allFiles).flat();
    }, [allFiles, contextProjectId]);

    const availableReports = useMemo(() => {
        if (contextProjectId) return allReports.filter(r => r.projectId === contextProjectId);
        return allReports; // In global view, we might want to filter out sub-sections, but usually all docs are fine
    }, [allReports, contextProjectId]);

    const availableMatrices = useMemo(() => {
        if (contextProjectId) return allMatrices.filter(m => m.projectId === contextProjectId);
        return allMatrices;
    }, [allMatrices, contextProjectId]);

    // -- Local State --
    const [text, setText] = useState('');
    const [selectedContextItems, setSelectedContextItems] = useState<ContextItem[]>([]);
    
    // The "Invisible Hand": Hidden system instructions from templates
    const [activeSystemInstruction, setActiveSystemInstruction] = useState<string | undefined>(undefined);
    
    // UI States
    const [isContextPickerOpen, setIsContextPickerOpen] = useState(false);
    const [contextTab, setContextTab] = useState<'files' | 'reports' | 'worksheets'>('files');
    const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [isDeepResearchEnabled, setIsDeepResearchEnabled] = useState(false);
    const [isReasoningEnabled, setIsReasoningEnabled] = useState(false);
    
    const [responseMode, setResponseMode] = useState<ResponseMode>('chat');
    const [userHasSelectedMode, setUserHasSelectedMode] = useState(false);
    const [autoSwitched, setAutoSwitched] = useState(false);
    const [outputLanguage, setOutputLanguage] = useState<'auto' | 'en' | 'nl'>('auto');
    
    const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const contextPickerRef = useRef<HTMLDivElement>(null);
    const templatePickerRef = useRef<HTMLDivElement>(null);
    
    const addRefButtonRef = useRef<HTMLButtonElement>(null);
    const templateButtonRef = useRef<HTMLButtonElement>(null);

    // Sync with initialContextItems when they change
    useEffect(() => {
        if (initialContextItems) {
            setSelectedContextItems(initialContextItems);
            if (initialContextItems.some(i => i.source === 'web')) {
                setIsDeepResearchEnabled(true);
            }
        }
    }, [initialContextItems]);

    // Auto-save: Load draft
    useEffect(() => {
        if (draftKey) {
            const savedDraft = localStorage.getItem(draftKey);
            if (savedDraft) setText(savedDraft);
        }
    }, [draftKey]);

    useEffect(() => {
        if (!languageKey) return;
        const saved = localStorage.getItem(languageKey);
        if (saved === 'auto' || saved === 'en' || saved === 'nl') {
            setOutputLanguage(saved);
        }
    }, [languageKey]);

    // Allow external prefill (e.g. GlobalTopBar escalation) without remount/reload.
    useEffect(() => {
        if (!draftKey) return;

        const handler = (e: Event) => {
            const evt = e as CustomEvent<{ draftKey?: string; value?: string }>;
            if (!evt.detail) return;
            if (evt.detail.draftKey !== draftKey) return;
            if (typeof evt.detail.value !== 'string') return;
            setText(evt.detail.value);
        };

        window.addEventListener('weflora:draft', handler as EventListener);
        return () => window.removeEventListener('weflora:draft', handler as EventListener);
    }, [draftKey]);

    // Auto-save: Save draft
    useEffect(() => {
        if (draftKey) localStorage.setItem(draftKey, text);
    }, [text, draftKey]);

    useEffect(() => {
        if (!languageKey) return;
        localStorage.setItem(languageKey, outputLanguage);
    }, [languageKey, outputLanguage]);

    // Clear system instruction if text is cleared manually
    useEffect(() => {
        if (!text.trim() && activeSystemInstruction) {
            setActiveSystemInstruction(undefined);
        }
    }, [text, activeSystemInstruction]);

    // --- AUTO-INTENT LOGIC ---
    useEffect(() => {
        if (userHasSelectedMode) return; 

        const lowerText = text.toLowerCase();
        let detectedMode: ResponseMode = 'chat';

        if (/\b(compare|vs\.?|versus|list|table|matrix|columns|rows|grid|breakdown|vergelijk|tabel|lijst|schema|overzicht|tegen)\b/i.test(lowerText)) {
            detectedMode = 'table';
        }
        else if (/\b(draft|report|outline|proposal|summary|document|memo|article|blog|rapport|verslag|samenvatting|artikel|ontwerp)\b/i.test(lowerText)) {
            detectedMode = 'report';
        }

        if (detectedMode !== responseMode) {
            setResponseMode(detectedMode);
            setAutoSwitched(true);
            const timer = setTimeout(() => setAutoSwitched(false), 2000); 
            return () => clearTimeout(timer);
        }
    }, [text, userHasSelectedMode, responseMode]);

    const handleModeSelect = (mode: ResponseMode) => {
        setResponseMode(mode);
        setUserHasSelectedMode(true);
    };

    // Calculate Popover Position with smart clamping
    const updatePopoverPosition = useCallback(() => {
        let targetRect: DOMRect | null = null;
        if (isContextPickerOpen && addRefButtonRef.current) {
            targetRect = addRefButtonRef.current.getBoundingClientRect();
        } else if (isTemplatePickerOpen && templateButtonRef.current) {
            targetRect = templateButtonRef.current.getBoundingClientRect();
        }

        if (targetRect) {
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            const maxPopoverHeight = 350;
            const popoverWidth = 320;
            let left = targetRect.left;
            
            if (left + popoverWidth > viewportWidth - 16) {
                left = viewportWidth - popoverWidth - 16;
            }
            if (left < 16) left = 16;

            setPopoverStyle({
                position: 'fixed',
                left: left,
                bottom: viewportHeight - targetRect.top + 8,
                top: 'auto',
                zIndex: 10000,
                width: `${popoverWidth}px`,
                maxHeight: `${maxPopoverHeight}px`
            });
        }
    }, [isContextPickerOpen, isTemplatePickerOpen]);

    useEffect(() => {
        updatePopoverPosition();
        window.addEventListener('resize', updatePopoverPosition);
        window.addEventListener('scroll', updatePopoverPosition, true);
        return () => {
            window.removeEventListener('resize', updatePopoverPosition);
            window.removeEventListener('scroll', updatePopoverPosition, true);
        };
    }, [isContextPickerOpen, isTemplatePickerOpen, updatePopoverPosition]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && containerRef.current.contains(event.target as Node)) {
                return;
            }
            if (contextPickerRef.current && !contextPickerRef.current.contains(event.target as Node)) {
                setIsContextPickerOpen(false);
            }
            if (templatePickerRef.current && !templatePickerRef.current.contains(event.target as Node)) {
                setIsTemplatePickerOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSend = () => {
        if (!text.trim() && selectedContextItems.length === 0) return;
        if (onSend) {
            const files = selectedContextItems
                .filter(item => item.source === 'upload' && item.file)
                .map(item => item.file!);
            
            let activeContext = selectedContextItems.filter(item => item.source !== 'upload');

            if (isDeepResearchEnabled && !activeContext.some(i => i.source === 'web')) {
                activeContext.push({ id: 'ctx-deep', name: 'Deep Research', source: 'web' });
            }
            
            let outputFormatInstruction = "";
            if (responseMode === 'table') {
                outputFormatInstruction = `
                OUTPUT FORMATTING RULE: 
                You MUST generate the response strictly as a Markdown Table. 
                - **NEGATIVE CONSTRAINT:** Do NOT write an introduction. Do NOT write a conclusion.
                - Start your response immediately with the table headers (e.g. | Item | Feature |).
                - Use the primary entities (e.g. Species, Sites) as ROWS.
                - Use their attributes as COLUMNS.
                `;
            } else if (responseMode === 'report') {
                outputFormatInstruction = `
                OUTPUT FORMATTING RULE:
                You MUST generate the response as a Structured Report.
                - Use Markdown Headers (#, ##, ###) to organize sections.
                - Structure: Executive Summary -> Detailed Analysis -> Recommendations.
                - Tone: Professional, objective, and comprehensive.
                `;
            }

            const baseInstruction = FLORA_GPT_SYSTEM_INSTRUCTION;
            let finalInstructions = baseInstruction;
            if (activeSystemInstruction) {
                finalInstructions += `\n\nTEMPLATE SPECIFIC INSTRUCTION:\n${activeSystemInstruction}`;
            }
            if (outputFormatInstruction) {
                finalInstructions += `\n\n${outputFormatInstruction}`;
            }

            onSend(text, files.length > 0 ? files : undefined, finalInstructions, undefined, activeContext, isReasoningEnabled, outputLanguage);
            
            if (draftKey) localStorage.removeItem(draftKey);
            setText('');
            setActiveSystemInstruction(undefined);
            setSelectedContextItems([]); 
            setIsDeepResearchEnabled(false); 
            setIsReasoningEnabled(false);
            setUserHasSelectedMode(false);
            setResponseMode('chat');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleFileSelect = async (files: File[]) => {
        if (files.length === 0) return;
        const uploaded = await Promise.all(files.map(async (file) => {
            if (file.size > FILE_VALIDATION.MAX_FILE_SIZE) {
                alert(`Skipped "${file.name}": File size exceeds 10MB limit.`);
                return null;
            }
            return uploadProjectFile(file, contextProjectId || 'generic');
        }));

        const validFiles: ContextItem[] = uploaded
            .filter((file): file is ProjectFile => Boolean(file))
            .map((file) => ({
                id: `upl-${file.id}`,
                name: file.name,
                source: 'upload',
                itemId: file.id,
                file: file.file,
                projectId: contextProjectId || null
            }));

        if (validFiles.length > 0) {
            setSelectedContextItems(prev => [...prev, ...validFiles]);
        }
        setIsContextPickerOpen(false);
    };

    const addContextItem = (item: any, type: 'project' | 'knowledge') => {
        if (selectedContextItems.some(i => i.itemId === item.id)) return;
        const newItem: ContextItem = {
            id: `ctx-${item.id}`,
            itemId: item.id,
            name: 'name' in item ? item.name : item.title,
            source: type,
            projectId: contextProjectId || null
        };
        setSelectedContextItems(prev => [...prev, newItem]);
        setIsContextPickerOpen(false);
    };

    const addReportContext = (report: any) => {
        if (selectedContextItems.some(i => i.itemId === report.id)) return;
        // NOTE: We only store the ID here. The ChatContext will hydrate the content.
        const newItem: ContextItem = {
            id: `ctx-rep-${report.id}`,
            itemId: report.id,
            name: report.title,
            source: 'report',
            projectId: contextProjectId || report.projectId || null
        };
        setSelectedContextItems(prev => [...prev, newItem]);
        setIsContextPickerOpen(false);
    };

    const addWorksheetContext = (matrix: any) => {
        if (selectedContextItems.some(i => i.itemId === matrix.id)) return;
        // NOTE: We only store the ID here. The ChatContext will hydrate the content.
        const newItem: ContextItem = {
            id: `ctx-mtx-${matrix.id}`,
            itemId: matrix.id,
            name: matrix.title,
            source: 'worksheet',
            projectId: contextProjectId || matrix.projectId || null
        };
        setSelectedContextItems(prev => [...prev, newItem]);
        setIsContextPickerOpen(false);
    };

    const removeContextItem = (id: string) => {
        setSelectedContextItems(prev => prev.filter(item => item.id !== id));
    };

    const handleTemplateSelect = (template: PromptTemplate) => {
        setText(template.templateText);
        setActiveSystemInstruction(template.systemInstruction);
        setIsTemplatePickerOpen(false);
        textAreaRef.current?.focus();
        setUserHasSelectedMode(false); 
    };

    const getContextStyle = (source: string) => {
        switch (source) {
            case 'knowledge': return 'bg-weflora-teal/10 text-weflora-dark border-weflora-teal/20';
            // NOTE: Use WeFlora tokens for project context (avoid Tailwind blue palette in AI-adjacent UI).
            case 'project': return 'bg-weflora-mint/20 text-weflora-dark border-weflora-teal/20';
            case 'report': return 'bg-weflora-teal/10 text-weflora-dark border-weflora-teal/20';
            case 'worksheet': return 'bg-weflora-mint/20 text-weflora-dark border-weflora-teal';
            case 'upload': return 'bg-slate-50 text-slate-700 border-slate-200';
            case 'web': return 'bg-weflora-success/10 text-weflora-success border-weflora-success/20';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const getIcon = (source: string) => {
         if (source === 'knowledge') return <DatabaseIcon className="h-3 w-3" />;
         if (source === 'project') return <FolderIcon className="h-3 w-3" />;
         if (source === 'report') return <FileTextIcon className="h-3 w-3" />;
         if (source === 'worksheet') return <TableIcon className="h-3 w-3" />;
         if (source === 'web') return <GlobeIcon className="h-3 w-3" />;
         return <UploadIcon className="h-3 w-3" />;
    };

    // Filtering logic for the picker
    const filterItems = (items: any[]) => items.filter(item => {
        const name = item.name || item.title;
        return name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const filteredFiles = filterItems(availableFiles);
    const filteredReports = filterItems(availableReports);
    const filteredMatrices = filterItems(availableMatrices);

    return (
        <FilePicker accept={FILE_VALIDATION.ACCEPTED_FILE_TYPES} multiple onPick={handleFileSelect}>
            {({ open }) => (
                <div ref={containerRef} className={`bg-white border transition-all rounded-xl shadow-sm relative flex flex-col ${isDeepResearchEnabled || isReasoningEnabled ? 'border-weflora-teal ring-2 ring-weflora-mint/30' : 'border-slate-200 focus-within:ring-2 focus-within:ring-weflora-teal/20 focus-within:border-weflora-teal'}`}>
            {/* Header: Mode Selector */}
            <div className="flex items-center gap-1 p-1.5 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
                <button onClick={() => handleModeSelect('chat')} className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs transition-all relative ${responseMode === 'chat' ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200 font-bold' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 font-medium'}`}><MessageSquareIcon className={`h-3.5 w-3.5 ${responseMode === 'chat' ? 'text-weflora-teal' : ''}`} /> Chat</button>
                <button onClick={() => handleModeSelect('table')} className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs transition-all relative overflow-hidden ${responseMode === 'table' ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200 font-bold' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 font-medium'}`}><TableIcon className={`h-3.5 w-3.5 ${responseMode === 'table' ? 'text-weflora-teal' : ''}`} /> Create Table {autoSwitched && responseMode === 'table' && <div className="absolute inset-0 bg-weflora-teal/10 animate-pulse pointer-events-none" />}</button>
                <button onClick={() => handleModeSelect('report')} className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs transition-all relative overflow-hidden ${responseMode === 'report' ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200 font-bold' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 font-medium'}`}><FileTextIcon className={`h-3.5 w-3.5 ${responseMode === 'report' ? 'text-weflora-teal' : ''}`} /> Draft Outline {autoSwitched && responseMode === 'report' && <div className="absolute inset-0 bg-weflora-teal/10 animate-pulse pointer-events-none" />}</button>
            </div>

            {/* Active Context Pills */}
            {(selectedContextItems.length > 0 || isDeepResearchEnabled || isReasoningEnabled) && (
                <div className="flex flex-wrap gap-2 px-3 pt-3 pb-1 animate-fadeIn">
                     {isDeepResearchEnabled && <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-weflora-mint/20 text-weflora-dark border border-weflora-teal"><GlobeIcon className="h-3 w-3" /> Deep Research On</div>}
                     {isReasoningEnabled && <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-weflora-teal/20 text-weflora-dark border border-weflora-teal/20"><SparklesIcon className="h-3 w-3" /> Thinking Mode</div>}
                     {selectedContextItems.map((item) => (
                        <div key={item.id} className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${getContextStyle(item.source)}`}>
                            {getIcon(item.source)}
                            <span className="max-w-[120px] truncate">{item.name}</span>
                            <button onClick={() => removeContextItem(item.id)} className="hover:opacity-70 ml-1"><XIcon className="h-3 w-3" /></button>
                        </div>
                    ))}
                </div>
            )}

            {!text.trim() && promptTemplates.length > 0 && (
                <div className="px-3 pt-2 flex flex-wrap gap-2 animate-fadeIn">
                    {promptTemplates.slice(0, 3).map(t => (
                        <button key={t.id} onClick={() => handleTemplateSelect(t)} className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-100 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 hover:border-slate-200 transition-colors"><ChatBubbleIcon className="h-3 w-3 text-weflora-teal" />{t.title}</button>
                    ))}
                </div>
            )}

            <textarea ref={textAreaRef} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={handleKeyDown} placeholder={selectedContextItems.length > 0 ? "Ask FloraGPT about these items..." : "Ask FloraGPT..."} className="w-full h-12 max-h-32 p-3 bg-transparent text-sm text-slate-700 placeholder-slate-400 resize-none focus:outline-none" />

            <div className="flex items-center justify-between p-2 px-3 border-t border-slate-100 bg-slate-50/30 rounded-b-xl relative">
                <div className="flex items-center gap-1">
                    <button ref={addRefButtonRef} onClick={() => setIsContextPickerOpen(!isContextPickerOpen)} className={`p-1.5 px-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold ${isContextPickerOpen ? 'bg-weflora-mint/20 text-weflora-dark' : 'text-slate-500 hover:text-weflora-teal hover:bg-weflora-mint/10'}`} title="Add files or context"><PlusIcon className="h-3.5 w-3.5" /> Add Context</button>
                    <div className="w-px h-4 bg-slate-300 mx-1"></div>
                    <button onClick={() => setIsDeepResearchEnabled(!isDeepResearchEnabled)} className={`p-1.5 px-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold ${isDeepResearchEnabled ? 'bg-weflora-mint/20 text-weflora-dark' : 'text-slate-500 hover:bg-weflora-mint/10 hover:text-weflora-teal'}`} title="Enable Web Search"><GlobeIcon className="h-3.5 w-3.5" /> Research</button>
                    <button onClick={() => setIsReasoningEnabled(!isReasoningEnabled)} className={`p-1.5 px-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold ${isReasoningEnabled ? 'bg-weflora-teal/20 text-weflora-dark' : 'text-slate-500 hover:bg-weflora-teal/10 hover:text-weflora-dark'}`} title="Enable Complex Reasoning"><SparklesIcon className="h-3.5 w-3.5" /> Think</button>
                    <div className="w-px h-4 bg-slate-300 mx-1"></div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                        <span className="hidden sm:inline">Output</span>
                        <select
                            value={outputLanguage}
                            onChange={(e) => setOutputLanguage(e.target.value as 'auto' | 'en' | 'nl')}
                            className="text-xs font-bold px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-weflora-teal/30"
                            title="Output language"
                        >
                            <option value="auto">Auto</option>
                            <option value="en">English</option>
                            <option value="nl">Dutch</option>
                        </select>
                    </div>
                    <div className="w-px h-4 bg-slate-300 mx-1"></div>
                    <button ref={templateButtonRef} onClick={() => setIsTemplatePickerOpen(!isTemplatePickerOpen)} className={`p-1.5 px-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold ${isTemplatePickerOpen ? 'bg-weflora-mint/20 text-weflora-dark' : 'text-slate-500 hover:text-weflora-teal hover:bg-weflora-mint/10'}`} title="Prompts"><ChatBubbleIcon className="h-3.5 w-3.5" /> Prompts</button>
                </div>
                <button onClick={handleSend} disabled={isLoading || (!text.trim() && selectedContextItems.length === 0)} className="p-1.5 bg-weflora-teal text-white rounded-lg hover:bg-weflora-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"><ArrowUpIcon className="h-4 w-4" /></button>
            </div>

            {/* Context Hub Picker */}
            {isContextPickerOpen && createPortal(
                <div ref={contextPickerRef} className="fixed bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col animate-fadeIn z-[10000]" style={{ ...popoverStyle }}>
                    <div className="p-3 border-b border-slate-100 bg-white">
                        <div className="flex gap-2 mb-2 pb-2 border-b border-slate-50">
                            <button onClick={() => setContextTab('files')} className={`px-2 py-1 rounded text-xs font-bold ${contextTab === 'files' ? 'bg-weflora-teal/10 text-weflora-dark' : 'text-slate-500 hover:bg-slate-50'}`}>Files</button>
                            <button onClick={() => setContextTab('reports')} className={`px-2 py-1 rounded text-xs font-bold ${contextTab === 'reports' ? 'bg-weflora-teal/10 text-weflora-dark' : 'text-slate-500 hover:bg-slate-50'}`}>Reports</button>
                            <button onClick={() => setContextTab('worksheets')} className={`px-2 py-1 rounded text-xs font-bold ${contextTab === 'worksheets' ? 'bg-weflora-mint/20 text-weflora-teal' : 'text-slate-500 hover:bg-slate-50'}`}>Worksheets</button>
                        </div>
                        <div className="relative"><SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" /><input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-7 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-slate-400 text-slate-900 font-medium" autoFocus /></div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
                        {contextTab === 'files' && (
                            <>
                                <div onClick={open} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer text-slate-700 transition-colors"><div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500"><UploadIcon className="h-4 w-4" /></div><div className="flex-1"><div className="text-xs font-bold">Upload Local File</div><div className="text-[10px] text-slate-400">PDF, Excel, CSV, Word</div></div></div>
                                {filteredFiles.map(file => (
                                    <div key={file.id} onClick={() => addContextItem(file, 'project')} className="flex items-center gap-3 p-2 hover:bg-weflora-teal/10 rounded-lg cursor-pointer transition-colors group">
                                        <div className="w-8 h-8 rounded-lg bg-weflora-mint/20 text-weflora-teal flex items-center justify-center"><FolderIcon className="h-4 w-4" /></div>
                                        <div className="flex-1 min-w-0"><div className="text-xs font-bold text-slate-700 truncate">{file.name}</div><div className="text-[10px] text-slate-400">{file.date}</div></div>
                                        {selectedContextItems.some(i => i.itemId === file.id) && <CheckIcon className="h-3 w-3 text-weflora-teal" />}
                                    </div>
                                ))}
                            </>
                        )}
                        {contextTab === 'reports' && filteredReports.map(report => (
                            <div key={report.id} onClick={() => addReportContext(report)} className="flex items-center gap-3 p-2 hover:bg-weflora-teal/10 rounded-lg cursor-pointer transition-colors group">
                                <div className="w-8 h-8 rounded-lg bg-weflora-teal/10 text-weflora-teal flex items-center justify-center"><FileTextIcon className="h-4 w-4" /></div>
                                <div className="flex-1 min-w-0"><div className="text-xs font-bold text-slate-700 truncate">{report.title}</div><div className="text-[10px] text-slate-400">Report</div></div>
                                {selectedContextItems.some(i => i.itemId === report.id) && <CheckIcon className="h-3 w-3 text-weflora-teal" />}
                            </div>
                        ))}
                        {contextTab === 'worksheets' && filteredMatrices.map(matrix => (
                            <div key={matrix.id} onClick={() => addWorksheetContext(matrix)} className="flex items-center gap-3 p-2 hover:bg-weflora-mint/10 rounded-lg cursor-pointer transition-colors group">
                                <div className="w-8 h-8 rounded-lg bg-weflora-mint/20 text-weflora-teal flex items-center justify-center"><TableIcon className="h-4 w-4" /></div>
                                <div className="flex-1 min-w-0"><div className="text-xs font-bold text-slate-700 truncate">{matrix.title}</div><div className="text-[10px] text-slate-400">{matrix.rows?.length || 0} rows</div></div>
                                {selectedContextItems.some(i => i.itemId === matrix.id) && <CheckIcon className="h-3 w-3 text-weflora-teal" />}
                            </div>
                        ))}
                    </div>
                </div>,
                document.body
            )}

            {/* Template Picker */}
            {isTemplatePickerOpen && createPortal(
                <div ref={templatePickerRef} className="fixed bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col animate-fadeIn z-[10000]" style={{ ...popoverStyle }}>
                    <div className="p-3 border-b border-slate-100 bg-white"><span className="text-xs font-bold text-slate-500 uppercase">Select Template</span></div>
                    <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
                        {promptTemplates.map(template => (
                            <button key={template.id} onClick={() => handleTemplateSelect(template)} className="w-full text-left p-2 hover:bg-slate-50 rounded-lg transition-colors group mb-1 last:mb-0">
                                <div className="flex items-center gap-2 mb-1"><ChatBubbleIcon className="h-3.5 w-3.5 text-weflora-teal" /><span className="text-xs font-bold text-slate-800">{template.title}</span></div>
                                <p className="text-[10px] text-slate-500 line-clamp-1 pl-5.5">{template.description}</p>
                            </button>
                        ))}
                    </div>
                </div>,
                document.body
            )}
                </div>
            )}
        </FilePicker>
    );
};

export default ChatInput;
