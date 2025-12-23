
import React, { useState, useEffect, useRef } from 'react';
import type { ReportDocument, Report, Matrix } from '../types';
import ReportEditorView from './ReportEditorView';
import { 
    FileTextIcon, PlusIcon, PencilIcon, CheckIcon, XIcon, 
    ArrowUpIcon, HistoryIcon, DownloadIcon, BookmarkIcon, CheckCircleIcon, RefreshIcon,
    FilePdfIcon, FileCodeIcon, BookIcon
} from './icons';

interface ReportContainerProps {
    document: ReportDocument;
    onUpdateDocument: (doc: ReportDocument) => void;
    onClose?: () => void;
    availableMatrices?: Matrix[]; 
    onToggleAssistant?: () => void; // New Prop
    hideHeader?: boolean;
    hideAssistantButton?: boolean;
}

const ReportContainer: React.FC<ReportContainerProps> = ({ 
    document: reportDoc, onUpdateDocument, onClose, availableMatrices, onToggleAssistant, hideHeader = false, hideAssistantButton = false
}) => {
    const [activeTabId, setActiveTabId] = useState<string>(reportDoc.tabs[0]?.id || '');
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [titleInput, setTitleInput] = useState(reportDoc.title);
    
    // Tab Renaming
    const [editingTabId, setEditingTabId] = useState<string | null>(null);
    const [tabNameInput, setTabNameInput] = useState('');

    const [isSaving, setIsSaving] = useState(false);

    // Download State
    const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
    const downloadMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!reportDoc.tabs.find(t => t.id === activeTabId) && reportDoc.tabs.length > 0) {
            setActiveTabId(reportDoc.tabs[0].id);
        }
    }, [reportDoc.tabs, activeTabId]);

    // Close download menu on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
                setIsDownloadMenuOpen(false);
            }
        };
        if (isDownloadMenuOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isDownloadMenuOpen]);

    const activeReport = reportDoc.tabs.find(t => t.id === activeTabId);

    // --- Handlers ---

    const handleTitleSave = () => {
        if (titleInput.trim()) {
            onUpdateDocument({ ...reportDoc, title: titleInput.trim() });
        } else {
            setTitleInput(reportDoc.title);
        }
        setIsEditingTitle(false);
    };

    const handleAddTab = () => {
        const newTab: Report = {
            id: `sec-${Date.now()}`,
            parentId: reportDoc.id,
            projectId: reportDoc.projectId,
            title: `Section ${reportDoc.tabs.length + 1}`,
            content: '',
            lastModified: new Date().toLocaleDateString(),
            tags: []
        };
        
        onUpdateDocument({
            ...reportDoc,
            tabs: [...reportDoc.tabs, newTab]
        });
        setActiveTabId(newTab.id);
    };

    const handleReportUpdate = (updatedReport: Report) => {
        const newTabs = reportDoc.tabs.map(t => t.id === updatedReport.id ? updatedReport : t);
        onUpdateDocument({ ...reportDoc, tabs: newTabs });
    };

    const handleDeleteTab = (e: React.MouseEvent, tabId: string) => {
        e.stopPropagation();
        if (reportDoc.tabs.length <= 1) {
            alert("A document must have at least one section.");
            return;
        }
        
        setTimeout(() => {
            if (window.confirm("Delete this section?")) {
                const newTabs = reportDoc.tabs.filter(t => t.id !== tabId);
                // Preemptively switch if we are deleting the active tab
                if (activeTabId === tabId) {
                    setActiveTabId(newTabs[0].id);
                }
                onUpdateDocument({ ...reportDoc, tabs: newTabs });
            }
        }, 0);
    };

    // Tab Renaming
    const startRenamingTab = (tab: Report) => {
        setEditingTabId(tab.id);
        // Prefer tabTitle if root node, else title
        setTabNameInput(tab.tabTitle || tab.title);
    };

    const saveTabName = () => {
        if (editingTabId && tabNameInput.trim()) {
            const newTabs = reportDoc.tabs.map(t => {
                if (t.id === editingTabId) {
                    if (t.id === reportDoc.id) {
                        return { ...t, tabTitle: tabNameInput.trim() };
                    } else {
                        return { ...t, title: tabNameInput.trim() };
                    }
                }
                return t;
            });
            onUpdateDocument({ ...reportDoc, tabs: newTabs });
        }
        setEditingTabId(null);
    };

    const handleTabKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') saveTabName();
        if (e.key === 'Escape') setEditingTabId(null);
    };

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => setIsSaving(false), 500);
    };

    const handleDownload = (format: 'md' | 'pdf' | 'docx') => {
        if (!activeReport) return;
        
        if (format === 'md') {
            const blob = new Blob([activeReport.content], { type: 'text/markdown;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `${activeReport.title}.md`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else if (format === 'docx') {
            // Generate valid HTML for Word
            // Simple markdown-to-html conversion for basic structure
            const htmlContent = `
                <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                <head><meta charset='utf-8'><title>${activeReport.title}</title>
                <style>body { font-family: 'Calibri', sans-serif; }</style>
                </head><body>
                <h1>${activeReport.title}</h1>
                <pre style="white-space: pre-wrap; font-family: 'Calibri', sans-serif;">${activeReport.content}</pre>
                </body></html>
            `;
            const blob = new Blob(['\ufeff', htmlContent], {
                type: 'application/msword'
            });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `${activeReport.title}.doc`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            // For PDF, we fallback to browser print dialog which creates PDFs natively
            window.print();
        }
        setIsDownloadMenuOpen(false);
    };

    if (!activeReport) return <div className="p-10 text-center text-slate-400">No document sections available.</div>;

    return (
        <div className="flex flex-col h-full bg-white relative">
            
            {/* 1. Document Header */}
            {!hideHeader && (
                <header className="flex-none h-14 border-b border-slate-200 bg-white flex items-center justify-between px-4 z-40 print:hidden">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-weflora-mint/20 rounded-lg flex items-center justify-center text-weflora-teal">
                            <FileTextIcon className="h-5 w-5" />
                        </div>
                        
                        {isEditingTitle ? (
                            <div className="flex items-center gap-1">
                                <input 
                                    type="text" 
                                    value={titleInput}
                                    onChange={(e) => setTitleInput(e.target.value)}
                                    onBlur={handleTitleSave}
                                    onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
                                    className="px-2 py-1 border border-weflora-teal rounded text-lg font-bold text-slate-900 outline-none focus:ring-2 focus:ring-weflora-mint/50 bg-white"
                                    autoFocus
                                />
                                <button onClick={handleTitleSave} className="p-1 text-green-600 hover:bg-green-50 rounded"><CheckIcon className="h-4 w-4" /></button>
                            </div>
                        ) : (
                            <div className="group flex items-center gap-2 cursor-pointer" onClick={() => setIsEditingTitle(true)}>
                                <h1 className="text-lg font-bold text-slate-900 group-hover:text-weflora-teal transition-colors">
                                    {reportDoc.title}
                                </h1>
                                <PencilIcon className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        )}
                        
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Report</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 mr-4">
                            <button className="p-2 text-slate-400 hover:text-weflora-teal hover:bg-weflora-mint/10 rounded-lg transition-colors" title="Share"><ArrowUpIcon className="h-4 w-4 rotate-45" /></button>
                            <button className="p-2 text-slate-400 hover:text-weflora-teal hover:bg-weflora-mint/10 rounded-lg transition-colors" title="History"><HistoryIcon className="h-4 w-4" /></button>
                            
                            {/* Download Menu */}
                            <div className="relative" ref={downloadMenuRef}>
                                <button 
                                    onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
                                    className={`p-2 rounded-lg transition-colors ${isDownloadMenuOpen ? 'bg-weflora-mint/20 text-weflora-teal' : 'text-slate-400 hover:text-weflora-teal hover:bg-weflora-mint/10'}`}
                                    title="Download"
                                >
                                    <DownloadIcon className="h-4 w-4" />
                                </button>
                                {isDownloadMenuOpen && (
                                    <div className="absolute top-full right-0 mt-2 w-40 bg-white rounded-lg shadow-xl border border-slate-200 z-[100] animate-fadeIn overflow-hidden">
                                        <button onClick={() => handleDownload('md')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                            <FileCodeIcon className="h-4 w-4 text-blue-600" /> Markdown
                                        </button>
                                        <button onClick={() => handleDownload('docx')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                            <BookIcon className="h-4 w-4 text-blue-600" /> Word
                                        </button>
                                        <button onClick={() => handleDownload('pdf')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                            <FilePdfIcon className="h-4 w-4 text-red-600" /> PDF (Print)
                                        </button>
                                    </div>
                                )}
                            </div>

                            <button className="p-2 text-slate-400 hover:text-weflora-teal hover:bg-weflora-mint/10 rounded-lg transition-colors" title="Bookmark"><BookmarkIcon className="h-4 w-4" /></button>
                        </div>
                        <div className="h-6 w-px bg-slate-200 mr-2"></div>
                        <button onClick={handleSave} className={`flex items-center justify-center p-2 rounded-lg transition-colors ${isSaving ? 'bg-weflora-mint/20 text-weflora-teal' : 'text-slate-400 hover:text-weflora-teal hover:bg-weflora-mint/10'}`}>
                            {isSaving ? (<RefreshIcon className="h-5 w-5 animate-spin" />) : (<CheckCircleIcon className="h-5 w-5" />)}
                        </button>
                        {onClose && (
                            <button onClick={onClose} className="ml-2 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                                <XIcon className="h-5 w-5" />
                            </button>
                        )}
                    </div>
                </header>
            )}

            {/* 2. Content Area (ReportEditorView - Toolbar Hidden) */}
            <div className="flex-1 overflow-hidden relative">
                <ReportEditorView 
                    report={activeReport}
                    onUpdate={handleReportUpdate}
                    onClose={() => {}} 
                    hideToolbar={true}
                    availableMatrices={availableMatrices}
                    onToggleAssistant={onToggleAssistant} // Passed down
                    hideAssistantButton={hideAssistantButton}
                />
            </div>

            {/* 3. Bottom Tab Bar (Renamable) */}
            <div className="flex-none h-10 bg-slate-50 border-t border-slate-200 flex items-center px-2 gap-1 overflow-x-auto custom-scrollbar z-50 print:hidden">
                
                <button 
                    onClick={handleAddTab}
                    className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-200 text-slate-500 transition-colors mr-2 flex-shrink-0"
                    title="Add Section"
                >
                    <PlusIcon className="h-4 w-4" />
                </button>

                {reportDoc.tabs.map(tab => (
                    <div 
                        key={tab.id}
                        onClick={() => setActiveTabId(tab.id)}
                        onDoubleClick={() => startRenamingTab(tab)}
                        className={`
                            group flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-t-md cursor-pointer select-none min-w-[100px] max-w-[200px] border-b-2 transition-colors relative flex-shrink-0
                            ${activeTabId === tab.id 
                                ? 'bg-white text-weflora-teal border-weflora-teal shadow-sm' 
                                : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-100 hover:text-slate-700'
                            }
                        `}
                    >
                        {editingTabId === tab.id ? (
                            <input
                                type="text"
                                value={tabNameInput}
                                onChange={(e) => setTabNameInput(e.target.value)}
                                onBlur={saveTabName}
                                onKeyDown={handleTabKeyDown}
                                className="w-full bg-white border border-weflora-teal rounded px-1 outline-none text-xs font-bold"
                                autoFocus
                                onClick={(e) => e.stopPropagation()} 
                            />
                        ) : (
                            <span className="truncate flex-1">{tab.title}</span>
                        )}
                        
                        {!editingTabId && (
                            <button 
                                onClick={(e) => handleDeleteTab(e, tab.id)}
                                className={`p-0.5 rounded hover:bg-red-100 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ${activeTabId === tab.id ? 'text-slate-300' : 'text-slate-400'}`}
                            >
                                <XIcon className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ReportContainer;
