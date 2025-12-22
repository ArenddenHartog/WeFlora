
import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { WorksheetDocument, Matrix, MatrixColumn, Species, ProjectFile } from '../types';
import MatrixView from './MatrixView';
import { 
    TableIcon, PlusIcon, PencilIcon, CheckIcon, XIcon, MoreHorizontalIcon,
    ArrowUpIcon, HistoryIcon, DownloadIcon, BookmarkIcon, UploadIcon, RefreshIcon, CheckCircleIcon,
    FileSheetIcon, FilePdfIcon, FileCodeIcon, CheckCircleIcon as FilledCheck, ChartBarIcon, SparklesIcon
} from './icons';
import { useUI } from '../contexts/UIContext';
import WorksheetAnalyticsPanel from './WorksheetAnalyticsPanel';
import { ResizablePanel } from './ResizablePanel';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface WorksheetContainerProps {
    document: WorksheetDocument;
    initialActiveTabId?: string;
    onUpdateDocument: (doc: WorksheetDocument) => void;
    onRunAICell?: (prompt: string, contextFiles?: File[], globalContext?: string) => Promise<string>;
    onAnalyze?: (files: File[], context?: string, columns?: MatrixColumn[]) => Promise<{ columns: MatrixColumn[], rows: any[] }>;
    speciesList?: Species[];
    onClose?: () => void;
    onOpenManage?: () => void;
    onOpenAssistant?: () => void; // icon-only entry point
    assistantActive?: boolean;
    onActiveMatrixIdChange?: (matrixId: string) => void;
    projectFiles?: ProjectFile[];
    onUpload?: (files: File[]) => void;
    projectContext?: string;
    onResolveFile?: (fileId: string) => Promise<File | null>;
    onInspectEntity?: (entityName: string) => void;
}

const WorksheetContainer: React.FC<WorksheetContainerProps> = ({ 
    document: worksheetDoc, initialActiveTabId, onUpdateDocument, onRunAICell, onAnalyze, speciesList, onClose, onOpenManage, onOpenAssistant, assistantActive, onActiveMatrixIdChange, projectFiles, onUpload, projectContext, onResolveFile, onInspectEntity
}) => {
    const { showNotification } = useUI();
    const [activeTabId, setActiveTabId] = useState<string>(initialActiveTabId || worksheetDoc.tabs[0]?.id || '');
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [titleInput, setTitleInput] = useState(worksheetDoc.title);
    const [editingTabId, setEditingTabId] = useState<string | null>(null);
    const [tabNameInput, setTabNameInput] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const importInputRef = useRef<HTMLInputElement>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
    const downloadMenuRef = useRef<HTMLDivElement>(null);
    
    // New: Visualization Panel State
    const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
    const [analyticsWidth, setAnalyticsWidth] = useState(360);
    
    // UI State for toggles
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [pendingDeleteTabId, setPendingDeleteTabId] = useState<string | null>(null);

    useEffect(() => {
        if (!worksheetDoc.tabs.find(t => t.id === activeTabId) && worksheetDoc.tabs.length > 0) {
            setActiveTabId(worksheetDoc.tabs[0].id);
        }
    }, [worksheetDoc.tabs, activeTabId]);

    useEffect(() => {
        if (!initialActiveTabId) return;
        if (worksheetDoc.tabs.some(t => t.id === initialActiveTabId)) {
            setActiveTabId(initialActiveTabId);
        }
    }, [initialActiveTabId, worksheetDoc.tabs]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
                setIsDownloadMenuOpen(false);
            }
        };
        if (isDownloadMenuOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isDownloadMenuOpen]);

    const activeMatrix = worksheetDoc.tabs.find(t => t.id === activeTabId);
    useEffect(() => {
        if (activeMatrix?.id) onActiveMatrixIdChange?.(activeMatrix.id);
    }, [activeMatrix?.id, onActiveMatrixIdChange]);

    const handleTitleSave = () => {
        if (titleInput.trim()) {
            onUpdateDocument({ ...worksheetDoc, title: titleInput.trim() });
        } else {
            setTitleInput(worksheetDoc.title);
        }
        setIsEditingTitle(false);
    };

    const handleAddTab = () => {
        const newTab: Matrix = {
            id: `tab-${Date.now()}`,
            parentId: worksheetDoc.id,
            projectId: worksheetDoc.projectId,
            title: `Sheet ${worksheetDoc.tabs.length + 1}`,
            columns: [{ id: 'c1', title: 'Item', type: 'text', width: 200, isPrimaryKey: true }],
            rows: []
        };
        onUpdateDocument({ ...worksheetDoc, tabs: [...worksheetDoc.tabs, newTab] });
        setActiveTabId(newTab.id);
    };

    const handleMatrixUpdate = (updatedMatrix: Matrix) => {
        const newTabs = worksheetDoc.tabs.map(t => t.id === updatedMatrix.id ? updatedMatrix : t);
        onUpdateDocument({ ...worksheetDoc, tabs: newTabs });
    };

    const handleDeleteTab = (e: React.MouseEvent, tabId: string) => {
        e.stopPropagation();
        
        if (worksheetDoc.tabs.length <= 1) {
            alert("A document must have at least one sheet.");
            return;
        }

        setPendingDeleteTabId(tabId);
    };

    const startRenamingTab = (tab: Matrix) => {
        setEditingTabId(tab.id);
        setTabNameInput(tab.tabTitle || tab.title);
    };

    const saveTabName = () => {
        if (editingTabId && tabNameInput.trim()) {
            const newTabs = worksheetDoc.tabs.map(t => {
                if (t.id === editingTabId) {
                    if (t.id === worksheetDoc.id) return { ...t, tabTitle: tabNameInput.trim() };
                    else return { ...t, title: tabNameInput.trim() };
                }
                return t;
            });
            onUpdateDocument({ ...worksheetDoc, tabs: newTabs });
        }
        setEditingTabId(null);
    };

    const handleTabKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') saveTabName();
        if (e.key === 'Escape') setEditingTabId(null);
    };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
    );

    const rootTab = useMemo(() => worksheetDoc.tabs.find(t => t.id === worksheetDoc.id) || null, [worksheetDoc.id, worksheetDoc.tabs]);
    const reorderableTabs = useMemo(() => {
        if (!rootTab) return worksheetDoc.tabs;
        return worksheetDoc.tabs.filter(t => t.id !== worksheetDoc.id);
    }, [rootTab, worksheetDoc.id, worksheetDoc.tabs]);

    const handleTabsReorder = (activeId: string, overId: string) => {
        const tabsToMove = reorderableTabs;
        const oldIndex = tabsToMove.findIndex(t => t.id === activeId);
        const newIndex = tabsToMove.findIndex(t => t.id === overId);
        if (oldIndex < 0 || newIndex < 0) return;

        const moved = arrayMove(tabsToMove, oldIndex, newIndex);
        const nextTabs = rootTab ? [rootTab, ...moved] : moved;
        // TODO(SCHEMA_CONTRACT.md): persist tab order to DB once matrices.order is supported server-side.
        const withOrder = nextTabs.map((t, idx) => ({ ...t, order: idx }));
        onUpdateDocument({ ...worksheetDoc, tabs: withOrder });
    };

    const SortableTab: React.FC<{
        tab: Matrix;
    }> = ({ tab }) => {
        const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id });
        const style = {
            transform: CSS.Transform.toString(transform),
            transition,
        } as React.CSSProperties;

        return (
            <div
                ref={setNodeRef}
                style={style}
                {...attributes}
                {...listeners}
                onClick={() => setActiveTabId(tab.id)}
                onDoubleClick={() => startRenamingTab(tab)}
                className={`
                    group flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-t-md cursor-pointer select-none min-w-[100px] max-w-[200px] border-b-2 transition-colors relative flex-shrink-0
                    ${isDragging ? 'opacity-80 ring-2 ring-weflora-teal/30 bg-weflora-teal/10' : ''}
                    ${activeTabId === tab.id 
                        ? 'bg-white text-weflora-teal border-weflora-teal shadow-sm' 
                        : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-100 hover:text-slate-700'
                    }
                `}
                title="Drag to reorder"
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
                    <span className="truncate flex-1">{tab.tabTitle || tab.title}</span>
                )}
                {!editingTabId && (
                    <button 
                        onClick={(e) => handleDeleteTab(e, tab.id)}
                        className={`h-8 w-8 flex items-center justify-center cursor-pointer rounded hover:bg-weflora-red/20 hover:text-weflora-red opacity-0 group-hover:opacity-100 transition-opacity ${activeTabId === tab.id ? 'text-slate-300' : 'text-slate-400'}`}
                    >
                        <XIcon className="h-3 w-3" />
                    </button>
                )}
            </div>
        );
    };

    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0 && activeMatrix && onAnalyze) {
            setIsImporting(true);
            try {
                const file = e.target.files[0];
                const result = await onAnalyze([file], "Extract data.", activeMatrix.columns);
                const newRows = result.rows.map((row, i) => ({ ...row, id: `row-imp-${Date.now()}-${i}` }));
                handleMatrixUpdate({ ...activeMatrix, rows: [...activeMatrix.rows, ...newRows] });
                showNotification("Data imported successfully.");
            } catch (error) {
                console.error("Import failed", error);
                showNotification("Failed to import data.", 'error');
            } finally {
                setIsImporting(false);
                if (importInputRef.current) importInputRef.current.value = '';
            }
        }
    };

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => setIsSaving(false), 500);
        showNotification("Worksheet saved.");
    };

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        showNotification("Link copied to clipboard.");
    };

    const handleHistory = () => {
        showNotification("Version history available in Admin dashboard.", "success");
    };

    const handleBookmark = () => {
        setIsBookmarked(!isBookmarked);
        showNotification(isBookmarked ? "Removed from bookmarks." : "Added to bookmarks.");
    };

    const handleDownload = (format: 'csv' | 'xlsx' | 'pdf') => {
        if (!activeMatrix) return;
        
        if (format === 'csv') {
            const headers = activeMatrix.columns.map(c => c.title).join(',');
            const rows = activeMatrix.rows.map(r => activeMatrix.columns.map(c => `"${String(r.cells[c.id]?.value || '').replace(/"/g, '""')}"`).join(',')).join('\n');
            const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `${activeMatrix.title}.csv`;
            link.click();
        } else if (format === 'xlsx') {
            // Simple HTML table export for Excel
            const html = `<table border="1"><thead><tr>${activeMatrix.columns.map(c => `<th>${c.title}</th>`).join('')}</tr></thead><tbody>${activeMatrix.rows.map(r => `<tr>${activeMatrix.columns.map(c => `<td>${r.cells[c.id]?.value || ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
            const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `${activeMatrix.title}.xls`;
            link.click();
        } else {
            window.print();
        }
        setIsDownloadMenuOpen(false);
    };

    if (!activeMatrix) return <div className="p-10 text-center text-slate-400">No sheets available.</div>;

    return (
        <div className="flex flex-col h-full bg-white relative">
            <header className="flex-none h-14 border-b border-slate-200 bg-white flex items-center justify-between px-4 z-40 print:hidden">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-weflora-mint/20 rounded-lg flex items-center justify-center text-weflora-teal"><TableIcon className="h-5 w-5" /></div>
                    {isEditingTitle ? (
                        <div className="flex items-center gap-1">
                            <input type="text" value={titleInput} onChange={(e) => setTitleInput(e.target.value)} onBlur={handleTitleSave} onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()} className="px-2 py-1 border border-weflora-teal rounded text-lg font-bold text-slate-900 outline-none focus:ring-2 focus:ring-weflora-mint/50 bg-white" autoFocus />
                            <button onClick={handleTitleSave} className="p-1 text-weflora-success hover:bg-weflora-success/10 rounded"><CheckIcon className="h-4 w-4" /></button>
                        </div>
                    ) : (
                        <div className="group flex items-center gap-2 cursor-pointer" onClick={() => setIsEditingTitle(true)}>
                            <h1 className="text-lg font-bold text-slate-900 group-hover:text-weflora-teal transition-colors">{worksheetDoc.title}</h1>
                            <PencilIcon className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    )}
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Workbook</span>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 mr-4">
                        <button 
                            onClick={() => setIsAnalyticsOpen(!isAnalyticsOpen)} 
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isAnalyticsOpen ? 'bg-weflora-mint/20 border-weflora-teal text-weflora-dark' : 'bg-white border-transparent text-slate-500 hover:bg-slate-50'}`}
                            title="Visualize Data"
                        >
                            <ChartBarIcon className="h-4 w-4" /> Visualize
                        </button>
                        <div className="h-6 w-px bg-slate-200 mx-2"></div>
                        <button onClick={() => importInputRef.current?.click()} className={`p-2 rounded-lg transition-colors relative ${isImporting ? 'bg-weflora-mint/20 text-weflora-teal' : 'text-slate-400 hover:text-weflora-teal hover:bg-weflora-mint/10'}`} title="Import Data" disabled={isImporting}>{isImporting ? <RefreshIcon className="h-4 w-4 animate-spin" /> : <UploadIcon className="h-4 w-4" />}</button>
                        <input type="file" ref={importInputRef} className="hidden" accept=".csv,.xlsx,.xls,.pdf,.json" onChange={handleImportFile} />
                        <button onClick={handleShare} className="p-2 text-slate-400 hover:text-weflora-teal hover:bg-weflora-mint/10 rounded-lg transition-colors" title="Share Link"><ArrowUpIcon className="h-4 w-4 rotate-45" /></button>
                        <div className="relative" ref={downloadMenuRef}>
                            <button onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)} className={`p-2 rounded-lg transition-colors ${isDownloadMenuOpen ? 'bg-weflora-mint/20 text-weflora-teal' : 'text-slate-400 hover:text-weflora-teal hover:bg-weflora-mint/10'}`} title="Download"><DownloadIcon className="h-4 w-4" /></button>
                            {isDownloadMenuOpen && (
                                <div className="absolute top-full right-0 mt-2 w-40 bg-white rounded-lg shadow-xl border border-slate-200 z-[100] animate-fadeIn overflow-hidden">
                                    <button onClick={() => handleDownload('csv')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><FileCodeIcon className="h-4 w-4 text-weflora-success" /> CSV</button>
                                    <button onClick={() => handleDownload('xlsx')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><FileSheetIcon className="h-4 w-4 text-weflora-success" /> Excel</button>
                                    <button onClick={() => handleDownload('pdf')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"><FilePdfIcon className="h-4 w-4 text-weflora-red" /> PDF (Print)</button>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="h-6 w-px bg-slate-200 mr-2"></div>
                    <button onClick={handleSave} className={`flex items-center justify-center p-2 rounded-lg transition-colors ${isSaving ? 'bg-weflora-mint/20 text-weflora-teal' : 'text-slate-400 hover:text-weflora-teal hover:bg-weflora-mint/10'}`} title="Save Worksheet">
                        {isSaving ? (<RefreshIcon className="h-5 w-5 animate-spin" />) : (<CheckCircleIcon className="h-5 w-5" />)}
                    </button>
                    {onOpenAssistant && (
                        <button
                            onClick={onOpenAssistant}
                            className={`ml-1 p-2 rounded-lg transition-colors ${
                                assistantActive ? 'bg-weflora-mint/20 text-weflora-teal' : 'text-slate-400 hover:text-weflora-teal hover:bg-weflora-mint/10'
                            }`}
                            title="Assistant"
                        >
                            <SparklesIcon className="h-5 w-5" />
                        </button>
                    )}
                    {onClose && (
                        <button onClick={onClose} className="ml-2 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                            <XIcon className="h-5 w-5" />
                        </button>
                    )}
                </div>
            </header>

            <div className="flex-1 overflow-hidden relative">
                <MatrixView 
                    matrices={[activeMatrix]} 
                    activeId={activeMatrix.id}
                    onUpdateMatrix={handleMatrixUpdate}
                    onRunAICell={onRunAICell}
                    onAnalyze={onAnalyze}
                    hideToolbar={true}
                    onOpenManage={onOpenManage}
                    speciesList={speciesList}
                    projectFiles={projectFiles}
                    onUpload={onUpload}
                    projectContext={projectContext}
                    onResolveFile={onResolveFile}
                    onInspectEntity={onInspectEntity}
                />
            </div>

            <div className="flex-none h-10 bg-slate-50 border-t border-slate-200 flex items-center px-2 gap-1 overflow-x-auto custom-scrollbar z-50 print:hidden">
                <button 
                    onClick={handleAddTab}
                    className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-200 text-slate-500 transition-colors mr-2 flex-shrink-0"
                    title="Add Sheet"
                >
                    <PlusIcon className="h-4 w-4" />
                </button>

                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={({ active, over }) => {
                        if (!over) return;
                        if (active.id === over.id) return;
                        handleTabsReorder(String(active.id), String(over.id));
                    }}
                >
                    <SortableContext items={reorderableTabs.map(t => t.id)} strategy={horizontalListSortingStrategy}>
                        {rootTab && (
                            <div
                                key={rootTab.id}
                                onClick={() => setActiveTabId(rootTab.id)}
                                onDoubleClick={() => startRenamingTab(rootTab)}
                                className={`
                                    group flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-t-md cursor-pointer select-none min-w-[100px] max-w-[200px] border-b-2 transition-colors relative flex-shrink-0
                                    ${activeTabId === rootTab.id 
                                        ? 'bg-white text-weflora-teal border-weflora-teal shadow-sm' 
                                        : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-100 hover:text-slate-700'
                                    }
                                `}
                            >
                                {editingTabId === rootTab.id ? (
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
                                    <span className="truncate flex-1">{rootTab.tabTitle || rootTab.title}</span>
                                )}
                            </div>
                        )}

                        {reorderableTabs.map(tab => (
                            <SortableTab key={tab.id} tab={tab} />
                        ))}
                    </SortableContext>
                </DndContext>
            </div>

            {/* Analytics Panel */}
            <ResizablePanel 
                isOpen={isAnalyticsOpen} 
                onClose={() => setIsAnalyticsOpen(false)} 
                width={analyticsWidth} 
                setWidth={setAnalyticsWidth}
                minWidth={300}
                maxWidth={600}
            >
                <WorksheetAnalyticsPanel matrix={activeMatrix} onClose={() => setIsAnalyticsOpen(false)} />
            </ResizablePanel>

            <ConfirmDeleteModal
                isOpen={Boolean(pendingDeleteTabId)}
                title="Delete sheet?"
                description={`This will permanently delete "${
                    pendingDeleteTabId ? (worksheetDoc.tabs.find(t => t.id === pendingDeleteTabId)?.tabTitle || worksheetDoc.tabs.find(t => t.id === pendingDeleteTabId)?.title || 'this sheet') : 'this sheet'
                }" from this worksheet. This cannot be undone.`}
                confirmLabel="Delete sheet"
                onCancel={() => setPendingDeleteTabId(null)}
                onConfirm={() => {
                    if (!pendingDeleteTabId) return;
                    const newTabs = worksheetDoc.tabs.filter(t => t.id !== pendingDeleteTabId);
                    if (activeTabId === pendingDeleteTabId && newTabs.length > 0) setActiveTabId(newTabs[0].id);
                    onUpdateDocument({ ...worksheetDoc, tabs: newTabs });
                    setPendingDeleteTabId(null);
                }}
            />
        </div>
    );
};

export default WorksheetContainer;
