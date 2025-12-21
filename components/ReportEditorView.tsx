
import React, { useState, useEffect, useRef } from 'react';
import type { Report, Matrix, ReportTemplate } from '../types';
import { 
    BoldIcon, ItalicIcon, ListIcon, HeadingIcon, FileTextIcon, XIcon, PencilIcon,
    PlusIcon, SparklesIcon, HistoryIcon, DownloadIcon, CheckCircleIcon, RefreshIcon, EyeIcon, EyeOffIcon,
    FilePdfIcon, FileSheetIcon, BookIcon, LayoutGridIcon, UserCircleIcon, FileCodeIcon, ArrowUpIcon, BookmarkIcon,
    TableIcon, UndoIcon, RedoIcon
} from './icons';
import { MessageRenderer } from './MessageRenderer';
import InsertWorksheetModal from './InsertWorksheetModal';
import { useUI } from '../contexts/UIContext';
import ConfirmDeleteModal from './ConfirmDeleteModal';

interface ReportEditorViewProps {
    report?: Report;
    reports?: Report[];
    activeReportId?: string;
    onActiveReportIdChange?: (id: string) => void;
    onUpdate: (report: Report) => void;
    onCreateReport?: () => void;
    onDeleteReport?: (id: string) => void;
    onSaveTemplate?: (template: ReportTemplate) => void;
    availableMatrices?: Matrix[];
    onToggleAssistant?: () => void;
    onToggleFiles?: () => void;
    onAIQuery?: (query: string, context?: string) => void;
    onClose?: () => void;
    hideToolbar?: boolean;
}

export const ManageReportPanel: React.FC<{
    report: Report;
    onUpdate: (report: Report) => void;
    onClose: () => void;
}> = ({ report, onUpdate, onClose }) => {
    const [title, setTitle] = useState(report.title);
    const [tags, setTags] = useState<string[]>(report.tags || []);
    const [newTagInput, setNewTagInput] = useState('');

    useEffect(() => {
        setTitle(report.title);
        setTags(report.tags || []);
    }, [report.id]);

    const handleSave = () => {
        onUpdate({ 
            ...report, 
            title, 
            tags,
            lastModified: new Date().toLocaleDateString() 
        });
    };

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (title !== report.title || JSON.stringify(tags) !== JSON.stringify(report.tags)) {
                handleSave();
            }
        }, 500);
        return () => clearTimeout(timeout);
    }, [title, tags]);

    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && newTagInput.trim()) {
            e.preventDefault();
            if (!tags.includes(newTagInput.trim())) {
                setTags([...tags, newTagInput.trim()]);
            }
            setNewTagInput('');
        }
    };

    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 border-l border-slate-200">
            <header className="p-4 border-b border-slate-200 bg-white flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                    <PencilIcon className="h-5 w-5 text-weflora-teal" />
                    Report Settings
                </div>
                <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600">
                    <XIcon className="h-5 w-5" />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Report Title</label>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-slate-900" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tags</label>
                    <div className="flex flex-wrap gap-2 mb-2 p-2 bg-white border border-slate-200 rounded-lg min-h-[40px]">
                        {tags.map(tag => (
                            <span key={tag} className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded border border-slate-200 shadow-sm">
                                #{tag}
                                <button onClick={() => removeTag(tag)} className="text-slate-400 hover:text-weflora-red"><XIcon className="h-3 w-3" /></button>
                            </span>
                        ))}
                        <input type="text" value={newTagInput} onChange={(e) => setNewTagInput(e.target.value)} onKeyDown={handleAddTag} placeholder="Add tag..." className="bg-transparent text-xs outline-none min-w-[60px] flex-1 text-slate-900" />
                    </div>
                    <p className="text-[10px] text-slate-400">Press Enter to add a tag.</p>
                </div>
            </div>
        </div>
    );
};

const ReportEditorView: React.FC<ReportEditorViewProps> = ({ 
    report: singleReport, reports, activeReportId, onActiveReportIdChange, onUpdate, onCreateReport, onDeleteReport, availableMatrices = [], onToggleAssistant, onClose, hideToolbar
}) => {
    const { showNotification } = useUI();
    const activeReport = (reports && activeReportId) ? reports.find(r => r.id === activeReportId) : singleReport || (reports && reports.length > 0 ? reports[0] : undefined);
    const [content, setContent] = useState(activeReport?.content || '');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isInsertModalOpen, setIsInsertModalOpen] = useState(false);
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const historyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [pendingDeleteReportId, setPendingDeleteReportId] = useState<string | null>(null);

    useEffect(() => {
        if (activeReport) {
            setHistory([activeReport.content || '']);
            setHistoryIndex(0);
        }
    }, [activeReport?.id]);

    useEffect(() => {
        setContent(activeReport?.content || '');
    }, [activeReport?.id, activeReport?.content]);

    useEffect(() => {
        if (reports) {
            if (activeReportId && reports.length > 0 && !reports.find(r => r.id === activeReportId)) {
                if (onActiveReportIdChange) onActiveReportIdChange(reports[0].id);
            } else if (reports.length === 0 && onClose) onClose();
        }
    }, [reports, activeReportId, onActiveReportIdChange, onClose]);

    const saveToHistory = (newText: string, immediate = false) => {
        if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
        const update = () => {
            setHistory(prev => {
                const currentHist = prev.slice(0, historyIndex + 1);
                return [...currentHist, newText];
            });
            setHistoryIndex(prev => prev + 1);
        };
        if (immediate) update();
        else historyTimeoutRef.current = setTimeout(update, 1000);
    };

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        setContent(newContent);
        saveToHistory(newContent);
        if (activeReport) onUpdate({ ...activeReport, content: newContent, lastModified: new Date().toLocaleDateString() });
    };

    const handleUndo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            const newContent = history[newIndex];
            setHistoryIndex(newIndex);
            setContent(newContent);
            if (activeReport) onUpdate({ ...activeReport, content: newContent, lastModified: new Date().toLocaleDateString() });
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            const newContent = history[newIndex];
            setHistoryIndex(newIndex);
            setContent(newContent);
            if (activeReport) onUpdate({ ...activeReport, content: newContent, lastModified: new Date().toLocaleDateString() });
        }
    };

    const handleSaveReport = () => { 
        setIsSaving(true); 
        setTimeout(() => setIsSaving(false), 800); 
        showNotification("Report saved.");
    };

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        showNotification("Link copied to clipboard.");
    };

    const handleHistoryAction = () => {
        showNotification("Version history available in Admin dashboard.", "success");
    };

    const handleBookmark = () => {
        setIsBookmarked(!isBookmarked);
        showNotification(isBookmarked ? "Removed from bookmarks." : "Added to bookmarks.");
    };

    const handleDeleteReport = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setPendingDeleteReportId(id);
    };

    const applyFormat = (marker: string) => {
        if (textareaRef.current) {
            const start = textareaRef.current.selectionStart;
            const end = textareaRef.current.selectionEnd;
            const text = content;
            const selection = text.substring(start, end);

            let newText;
            let newCursorPos;

            if (selection.length > 0) {
                // Wrap selection
                newText = text.substring(0, start) + marker + selection + marker + text.substring(end);
                // Keep the cursor after the wrapped text
                newCursorPos = end + (marker.length * 2); 
            } else {
                // Insert marker (e.g. **|**) and place cursor in middle
                newText = text.substring(0, start) + marker + marker + text.substring(end);
                newCursorPos = start + marker.length;
            }

            setContent(newText);
            saveToHistory(newText, true);
            if (activeReport) onUpdate({ ...activeReport, content: newText, lastModified: new Date().toLocaleDateString() });

            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.focus();
                    if (selection.length > 0) {
                         // Select the text inside markers for easy re-editing or chaining
                         textareaRef.current.setSelectionRange(start + marker.length, end + marker.length);
                    } else {
                        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
                    }
                }
            }, 0);
        }
    };

    const insertText = (textToInsert: string) => {
        if (textareaRef.current) {
            const start = textareaRef.current.selectionStart;
            const end = textareaRef.current.selectionEnd;
            const text = content;
            const newText = text.substring(0, start) + textToInsert + text.substring(end);
            setContent(newText);
            saveToHistory(newText, true);
            if (activeReport) onUpdate({ ...activeReport, content: newText, lastModified: new Date().toLocaleDateString() });
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.focus();
                    textareaRef.current.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
                }
            }, 0);
        }
    };

    if (!activeReport) return <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50"><FileTextIcon className="h-12 w-12 mb-4 opacity-20" /><p>No report selected.</p>{onCreateReport && <button onClick={onCreateReport} className="mt-4 px-4 py-2 bg-weflora-teal text-white rounded-lg text-sm hover:bg-weflora-dark transition-colors">Create New Report</button>}</div>;

    const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

    return (
        <div className="flex flex-col h-full bg-white relative overflow-hidden">
             {!hideToolbar && (
                 <div className="flex-none h-12 bg-slate-50 border-b border-slate-200 flex items-center px-4 justify-between z-40">
                    <div className="flex items-center gap-4 h-full">
                        <div className="text-slate-400"><FileTextIcon className="h-5 w-5" /></div>
                        <div className="h-6 w-px bg-slate-200 mx-1"></div>
                        <div className="flex items-end gap-1 h-full pt-2">
                            {reports && reports.map(r => (
                                <div key={r.id} onClick={() => onActiveReportIdChange && onActiveReportIdChange(r.id)} className={`group relative flex items-center gap-2 pl-3 pr-2 py-2 text-sm font-bold rounded-t-lg transition-all border-t border-x cursor-pointer select-none ${activeReport.id === r.id ? 'bg-white border-slate-200 text-slate-800 border-b-white z-10 -mb-[1px]' : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`} style={{ maxWidth: '200px' }} role="button">
                                    <span className="truncate flex-1">{r.title}</span>
                                    {onDeleteReport && (
                                        <button
                                            onClick={(e) => handleDeleteReport(e, r.id)}
                                            className={`h-8 w-8 flex items-center justify-center cursor-pointer rounded-md hover:bg-weflora-red/20 hover:text-weflora-red transition-colors ${activeReport.id === r.id ? 'text-slate-300' : 'text-transparent group-hover:text-slate-300'}`}
                                            title="Delete report"
                                        >
                                            <XIcon className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            {onCreateReport && <button onClick={onCreateReport} className="mb-2 ml-1 p-1.5 text-slate-400 hover:text-weflora-teal hover:bg-weflora-mint/10 rounded-md transition-colors" title="New Report"><PlusIcon className="h-4 w-4" /></button>}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 mr-4">
                            <button onClick={handleShare} className="p-2 text-slate-400 hover:text-weflora-teal hover:bg-weflora-mint/10 rounded-lg transition-colors" title="Share"><ArrowUpIcon className="h-4 w-4 rotate-45" /></button>
                            <button onClick={handleHistoryAction} className="p-2 text-slate-400 hover:text-weflora-teal hover:bg-weflora-mint/10 rounded-lg transition-colors" title="Version History"><HistoryIcon className="h-4 w-4" /></button>
                            <button className="p-2 text-slate-400 hover:text-weflora-teal hover:bg-weflora-mint/10 rounded-lg transition-colors" title="Download"><DownloadIcon className="h-4 w-4" /></button>
                            <button onClick={handleBookmark} className={`p-2 rounded-lg transition-colors ${isBookmarked ? 'text-weflora-teal bg-weflora-mint/10' : 'text-slate-400 hover:text-weflora-teal hover:bg-weflora-mint/10'}`} title="Bookmark"><BookmarkIcon className="h-4 w-4" /></button>
                        </div>
                        <div className="h-6 w-px bg-slate-200 mr-2"></div>
                        <button onClick={handleSaveReport} disabled={isSaving} className={`flex items-center justify-center p-2 rounded-lg transition-colors disabled:opacity-70 ${isSaving ? 'bg-weflora-mint/20 text-weflora-teal' : 'text-slate-400 hover:text-weflora-teal hover:bg-weflora-mint/10'}`} title="Save Report">{isSaving ? <RefreshIcon className="h-5 w-5 animate-spin" /> : <CheckCircleIcon className="h-5 w-5" />}</button>
                    </div>
                 </div>
             )}

             <div className="flex-1 flex flex-col min-w-0 relative">
                <div className="flex-none h-10 border-b border-slate-200 flex items-center justify-between px-4 bg-white z-30">
                    <div className="flex items-center gap-1">
                        <button onClick={() => applyFormat('**')} className="p-1.5 hover:bg-weflora-mint/10 hover:text-weflora-teal rounded text-slate-500 transition-colors" title="Bold"><BoldIcon className="h-4 w-4" /></button>
                        <button onClick={() => applyFormat('*')} className="p-1.5 hover:bg-weflora-mint/10 hover:text-weflora-teal rounded text-slate-500 transition-colors" title="Italic"><ItalicIcon className="h-4 w-4" /></button>
                        <div className="h-4 w-px bg-slate-200 mx-1"></div>
                        <button onClick={() => insertText('\n# Heading\n')} className="p-1.5 hover:bg-weflora-mint/10 hover:text-weflora-teal rounded text-slate-500 transition-colors" title="Heading"><HeadingIcon className="h-4 w-4" /></button>
                        <button onClick={() => insertText('\n- List Item\n')} className="p-1.5 hover:bg-weflora-mint/10 hover:text-weflora-teal rounded text-slate-500 transition-colors" title="List"><ListIcon className="h-4 w-4" /></button>
                        <div className="h-4 w-px bg-slate-200 mx-1"></div>
                        <button onClick={handleUndo} className="p-1.5 hover:bg-weflora-mint/10 hover:text-weflora-teal rounded text-slate-500 transition-colors disabled:opacity-30 disabled:hover:bg-transparent" title="Undo" disabled={historyIndex <= 0}><UndoIcon className="h-4 w-4" /></button>
                        <button onClick={handleRedo} className="p-1.5 hover:bg-weflora-mint/10 hover:text-weflora-teal rounded text-slate-500 transition-colors disabled:opacity-30 disabled:hover:bg-transparent" title="Redo" disabled={historyIndex >= history.length - 1}><RedoIcon className="h-4 w-4" /></button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsInsertModalOpen(true)} className="flex items-center gap-1.5 px-2 py-1 bg-weflora-mint/10 hover:bg-weflora-mint/30 text-weflora-dark rounded text-xs font-bold transition-colors border border-transparent hover:border-weflora-teal/30" title="Insert from Worksheet"><TableIcon className="h-3.5 w-3.5" />Insert Worksheet Data</button>
                        <div className="h-4 w-px bg-slate-300 mx-1"></div>
                        <button onClick={() => setIsPreviewOpen(!isPreviewOpen)} className={`flex items-center justify-center p-2 rounded-lg transition-all border ${isPreviewOpen ? 'bg-weflora-teal text-white border-weflora-teal' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`} title={isPreviewOpen ? "Edit" : "Preview"}><EyeIcon className="h-3.5 w-3.5" /></button>
                        <div className="h-4 w-px bg-slate-300 mx-1"></div>
                        {onToggleAssistant && <button onClick={onToggleAssistant} className="flex items-center gap-1.5 px-3 py-1.5 bg-weflora-mint/20 text-weflora-dark border border-weflora-teal hover:bg-weflora-mint/30 rounded-lg transition-colors" title="Open Writing Assistant"><SparklesIcon className="h-3.5 w-3.5" /><span className="text-xs font-bold hidden sm:inline">Assistant</span></button>}
                    </div>
                </div>
                
                <div className="flex-1 relative overflow-hidden flex bg-slate-50/30">
                    <div className={`h-full flex flex-col transition-all duration-300 ${isPreviewOpen ? 'w-1/2 border-r border-slate-200' : 'w-full'}`}>
                        <textarea ref={textareaRef} className="w-full flex-1 p-8 resize-none outline-none font-serif text-lg leading-relaxed text-slate-800 bg-white min-h-0 overflow-y-auto" value={content} onChange={handleContentChange} placeholder="Start typing your report..." />
                        <div className="h-8 flex-none flex items-center justify-between px-4 bg-white border-t border-slate-200 text-[10px] text-slate-500 select-none">
                            <div className="flex gap-4"><span>{wordCount} words</span><span>Reading time: {Math.ceil(wordCount / 200)} min</span></div>
                            <div className="flex gap-3"><span>{activeReport.lastModified}</span><span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-weflora-teal"></div> Saved</span></div>
                        </div>
                    </div>
                    {isPreviewOpen && (
                        <div className="w-1/2 h-full bg-slate-50 overflow-y-auto p-8 animate-fadeIn border-l border-slate-200 flex-none relative">
                            <div className="prose prose-sm max-w-none prose-headings:font-bold prose-a:text-blue-600"><MessageRenderer text={content || '*No content to preview*'} /></div>
                        </div>
                    )}
                </div>
             </div>
             {isInsertModalOpen && <InsertWorksheetModal isOpen={true} onClose={() => setIsInsertModalOpen(false)} onInsert={insertText} matrices={availableMatrices} />}

             {onDeleteReport && (
                <ConfirmDeleteModal
                    isOpen={Boolean(pendingDeleteReportId)}
                    title="Delete report?"
                    description={`This will permanently delete "${
                        pendingDeleteReportId ? (reports?.find(r => r.id === pendingDeleteReportId)?.title || activeReport?.title || 'this report') : 'this report'
                    }". This cannot be undone.`}
                    confirmLabel="Delete report"
                    onCancel={() => setPendingDeleteReportId(null)}
                    onConfirm={() => {
                        if (!pendingDeleteReportId) return;
                        onDeleteReport(pendingDeleteReportId);
                        setPendingDeleteReportId(null);
                    }}
                />
             )}
        </div>
    );
};

export default ReportEditorView;
