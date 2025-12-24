
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Matrix, MatrixRow, MatrixColumn, MatrixColumnType, Species, ProjectFile, SkillConfiguration, ConditionalFormattingRule, MatrixCell } from '../types';
import { 
    PlusIcon, SparklesIcon, TableIcon, XIcon, RefreshIcon, 
    CheckCircleIcon, MoreHorizontalIcon, 
    GripVerticalIcon, MaximizeIcon, DownloadIcon, BookmarkIcon, HistoryIcon, ArrowUpIcon, EyeOffIcon, SearchIcon, MagicWandIcon, UploadIcon,
    LightningBoltIcon, InfoIcon, StarFilledIcon, CheckIcon, AlertTriangleIcon, PencilIcon, SettingsIcon, SlidersIcon,
    CopyIcon, FileTextIcon, AdjustmentsHorizontalIcon, LayoutGridIcon, LeafIcon
} from './icons';
import BaseModal from './BaseModal';
import { aiService } from '../services/aiService';
import ColumnSettingsModal from './ColumnSettingsModal';
import { MessageRenderer } from './MessageRenderer';
import { useUI } from '../contexts/UIContext';
import { SKILL_TEMPLATES } from '../services/skillTemplates';

interface MatrixViewProps {
    matrices: Matrix[];
    activeId?: string;
    onActiveIdChange?: (id: string) => void;
    onUpdateMatrix: (matrix: Matrix) => void;
    onCreateMatrix?: (matrix: Matrix) => void;
    onDeleteMatrix?: (matrixId: string) => void;
    onInspectEntity?: (entityName: string) => void;
    // Updated signature to support multiple context files and global context
    onRunAICell?: (prompt: string, contextFiles?: File[], globalContext?: string) => Promise<string>;
    onAnalyze?: (files: File[], context?: string, columns?: MatrixColumn[]) => Promise<{ columns: MatrixColumn[], rows: any[] }>;
    onOpenWizard?: () => void;
    onClose?: () => void;
    onOpenManage?: () => void; 
    hideToolbar?: boolean;
    speciesList?: Species[];
    projectFiles?: ProjectFile[];
    projectContext?: string; // New prop for global context awareness
    onUpload?: (files: File[]) => void;
    onResolveFile?: (fileId: string) => Promise<File | null>; // NEW: File resolver
}

// --- Constants ---
const ROW_HEIGHT = 48;
const OVERSCAN = 5;

const isAIDerivedColumn = (col: MatrixColumn) => {
    return col.type === 'ai' || Boolean(col.skillConfig) || col.title.toLowerCase().includes('ai');
};

// --- Helper: Get Format Instruction ---
const getFormatInstruction = (type?: 'text' | 'badge' | 'score' | 'currency') => {
    switch (type) {
        case 'badge':
            return "\n\nStrict Output Format Rule: You must return the answer in the format 'Status - Brief Rationale' (e.g., 'Suitable - Soil matches'). Keep the status under 3 words. Do not use markdown bolding.";
        case 'score':
            return "\n\nStrict Output Format Rule: You must return the answer in the format 'Score/100 - Key Reason' (e.g., '85/100 - High durability').";
        case 'currency':
            return "\n\nStrict Output Format Rule: You must return the answer in the format '€Amount' (e.g., '€150'). Include the currency symbol.";
        default:
            return ""; // Free text
    }
};

// --- Helper: Parse Reasoning ---
const parseCellContent = (text: string) => {
    const stringText = String(text || '');
    
    // 1. Check for Suitability Score Pattern (Specific case)
    const scoreMatch = stringText.match(/(\d{1,3}\/100(?:\s*-\s*[A-Za-z]+)?)/);
    if (scoreMatch) {
        return {
            reasoning: stringText, 
            value: scoreMatch[1], // Just the score part for display
            hasReasoning: true
        };
    }

    // 2. Robust Reasoning/Conclusion Parse
    const reasoningRegex = /^(?:\*\*?(?:Reasoning|Thinking|Analysis):?\*\*?)\s*([\s\S]*?)(?:\n\n|\n+)(?:(?:\*\*?(?:Conclusion|Answer|Recommendation):?\*\*?)\s*)?([\s\S]*)$/i;
    const match = stringText.match(reasoningRegex);
    
    if (match) {
        return {
            reasoning: match[1].trim(),
            value: match[2].trim(),
            hasReasoning: true
        };
    }

    return {
        reasoning: null,
        value: stringText,
        hasReasoning: false
    };
};

const ColumnHeader: React.FC<any> = ({ column, onUpdate, onDelete, onRunColumnAI, onEditSettings }) => {
    const buttonRef = useRef(null);
    return (
        <div className={`flex-shrink-0 border-r border-b text-left relative group select-none flex items-center justify-between px-3 py-2 h-10 transition-colors ${
            isAIDerivedColumn(column)
                ? 'bg-weflora-teal/10 border-weflora-teal/20 hover:bg-weflora-teal/20 ring-inset ring-1 ring-weflora-teal/20'
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
        }`} style={{ width: column.width }}>
            <div className="flex items-center gap-2 truncate font-bold text-sm text-slate-700">{column.title}</div>
            <button ref={buttonRef} onClick={() => { onEditSettings(column.id); }} className="p-1 rounded hover:bg-slate-200 text-slate-400 opacity-0 group-hover:opacity-100 transition-all"><MoreHorizontalIcon className="h-4 w-4" /></button>
        </div>
    );
};

const MatrixInput: React.FC<{ value: string|number; type: MatrixColumnType; options?: string[]; suggestions?: string[]; onSave: (val: any) => void; onCancel: () => void; isActive: boolean; disabled?: boolean }> = ({ value, type, options, suggestions = [], onSave, onCancel, isActive, disabled }) => {
    const [localValue, setLocalValue] = useState(String(value));
    const inputRef = useRef<any>(null);
    const datalistId = useRef(`dl-${Date.now()}-${Math.random()}`).current;

    useEffect(() => { if(isActive && inputRef.current && !disabled) inputRef.current.focus(); }, [isActive, disabled]);
    
    if(!isActive) return null;
    if(disabled) return <div className="w-full h-full px-2 py-1.5 text-sm bg-slate-100 text-slate-400 italic">Processing...</div>;

    const commonClasses = "w-full h-full px-2 py-1.5 text-sm bg-white outline-none border-2 border-weflora-teal rounded shadow-lg z-50 absolute top-0 left-0 leading-relaxed text-slate-900";
    if (type === 'select') return <select ref={inputRef} value={localValue} onChange={e => setLocalValue(e.target.value)} onBlur={() => onSave(localValue)} className={commonClasses}><option value="">Select...</option>{options?.map(o => <option key={o} value={o}>{o}</option>)}</select>;
    
    return (
        <>
            <input 
                ref={inputRef} 
                type={type==='number'?'number':'text'} 
                value={localValue} 
                onChange={e => setLocalValue(e.target.value)} 
                onBlur={() => onSave(localValue)} 
                onKeyDown={e => { if(e.key === 'Enter') onSave(localValue); if(e.key === 'Escape') onCancel(); }} 
                className={commonClasses}
                list={suggestions.length > 0 ? datalistId : undefined}
            />
            {suggestions.length > 0 && (
                <datalist id={datalistId}>
                    {suggestions.map((s, i) => <option key={i} value={s} />)}
                </datalist>
            )}
        </>
    );
};

const RichCellRenderer: React.FC<{ value: string|number, column: MatrixColumn, cell?: MatrixCell, onInspect?: () => void }> = ({ value, column, cell, onInspect }) => {
    const stringVal = String(value || '');
    const isAI = isAIDerivedColumn(column);
    const hasError = cell?.status === 'error';
    
    // Prefer displayValue if available (new Skills runner)
    // Fallback to parseCellContent logic for legacy
    let displayValue = cell?.displayValue || stringVal;
    let hasReasoning = Boolean(cell?.reasoning);

    if (!cell?.displayValue && isAI) {
        // Fallback parsing for legacy free-form outputs
        const parsed = parseCellContent(stringVal);
        displayValue = parsed.value;
        hasReasoning = parsed.hasReasoning;
    }

    if (hasError) {
        displayValue = "Error"; // Or keep old value?
    }
    
    const inner = (
        <div className={`truncate w-full px-3 text-sm flex items-center gap-2 group/cell relative h-full ${!value ? 'text-slate-300 italic' : 'text-slate-700'}`}>
            <span className={`truncate flex-1 ${hasError ? 'text-weflora-red' : ''}`}>{displayValue || 'Empty'}</span>
            
            {hasReasoning && !hasError && <InfoIcon className="h-3 w-3 text-weflora-teal flex-shrink-0"/>}
            {hasError && <AlertTriangleIcon className="h-3 w-3 text-weflora-red flex-shrink-0" title={cell?.reasoning || "Error executing skill"}/>}
            
            {/* Quick Look / Inspect Button for Primary Keys */}
            {column.isPrimaryKey && value && onInspect && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onInspect(); }}
                    className="absolute right-2 opacity-0 group-hover/cell:opacity-100 p-1 bg-white hover:bg-weflora-mint/20 text-slate-400 hover:text-weflora-teal rounded transition-all shadow-sm border border-slate-200"
                    title="Quick Look: Verify Species Data"
                >
                    <LeafIcon className="h-3 w-3" />
                </button>
            )}
        </div>
    );
    return inner;
};

const MatrixView: React.FC<MatrixViewProps> = ({ 
    matrices, activeId, onActiveIdChange, 
    onUpdateMatrix, onCreateMatrix, onDeleteMatrix, onInspectEntity, 
    onRunAICell, onAnalyze, onOpenWizard, onClose, onOpenManage, hideToolbar,
    speciesList = [], projectFiles = [], projectContext, onUpload, onResolveFile
}) => {
    const { openEvidencePanel } = useUI();
    const activeMatrix = matrices.find(m => m.id === activeId);
    const activeMatrixRef = useRef(activeMatrix);
    useEffect(() => { activeMatrixRef.current = activeMatrix; }, [activeMatrix]);

    const [editingCell, setEditingCell] = useState<{ rowId: string, colId: string } | null>(null);
    const [editingColumnSettings, setEditingColumnSettings] = useState<MatrixColumn | null>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    const [addMenuPos, setAddMenuPos] = useState<{top: number, left: number} | null>(null);
    const addColumnBtnRef = useRef<HTMLButtonElement>(null);
    const [batchProgress, setBatchProgress] = useState<{ current: number, total: number } | null>(null);
    const stopBatchRef = useRef(false);
    const importInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            const resizeObserver = new ResizeObserver(entries => { for (let entry of entries) setContainerHeight(entry.contentRect.height); });
            resizeObserver.observe(containerRef.current);
            return () => resizeObserver.disconnect();
        }
    }, []);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => { setScrollTop(e.currentTarget.scrollTop); if(headerRef.current) headerRef.current.scrollLeft = e.currentTarget.scrollLeft; };
    
    const handleAddColumnClick = (e: React.MouseEvent) => { 
        e.stopPropagation(); 
        if (addColumnBtnRef.current) { 
            const rect = addColumnBtnRef.current.getBoundingClientRect(); 
            setAddMenuPos({ top: rect.bottom + 5, left: rect.left }); 
            setIsAddMenuOpen(!isAddMenuOpen); 
        } 
    };

    const handleInitiateAddColumn = (type: 'text' | 'ai') => {
        const newColId = `col-${type}-${Date.now()}`;
        const newCol: MatrixColumn = {
            id: newColId,
            title: type === 'ai' ? 'New Skill' : 'New Column',
            type: type,
            width: 200,
            visible: true
        };
        setEditingColumnSettings(newCol);
        setIsAddMenuOpen(false);
    };

    const handleCellChange = (rowId: string, colId: string, value: string|number) => {
        const currentMatrix = activeMatrixRef.current;
        if (!currentMatrix) return;
        const newRows = currentMatrix.rows.map(row => row.id === rowId ? { ...row, cells: { ...row.cells, [colId]: { ...row.cells[colId], columnId: colId, value } } } : row);
        onUpdateMatrix({ ...currentMatrix, rows: newRows });
        setEditingCell(null);
    };

    const updateRowSafe = (rowId: string, colId: string, status: 'loading' | 'success' | 'error', cellData?: Partial<MatrixCell>) => {
         const currentMatrix = activeMatrixRef.current;
         if (!currentMatrix) return;
         const newRows = currentMatrix.rows.map(r => r.id === rowId ? {
             ...r,
             cells: { 
                ...r.cells, 
                [colId]: { 
                    ...r.cells[colId], 
                    columnId: colId, 
                    status,
                    ...cellData
                } 
             }
         } : r);
         onUpdateMatrix({ ...currentMatrix, rows: newRows });
    };

    const runSingleCellAI = async (rowId: string, colId: string, promptTemplate: string, rowName: string, rowData: MatrixRow, skillConfig?: SkillConfiguration) => {
        updateRowSafe(rowId, colId, 'loading');
        
        // Resolving Context Files
        const contextFiles: File[] = [];
        const fileNames: string[] = []; // For template promptBuilder

        if (skillConfig && skillConfig.attachedContextIds.length > 0) {
            // Use local projectFiles cache if available, else use resolver
            for (const fileId of skillConfig.attachedContextIds) {
                const localFile = projectFiles?.find(f => f.id === fileId);
                if (localFile && localFile.file) {
                    contextFiles.push(localFile.file);
                    fileNames.push(localFile.name);
                } else if (onResolveFile) {
                    try {
                        const resolved = await onResolveFile(fileId);
                        if (resolved) {
                            contextFiles.push(resolved);
                            fileNames.push(resolved.name);
                        }
                    } catch (err) {
                        console.warn(`Failed to resolve file ${fileId}`, err);
                    }
                }
            }
        }

        try {
            // Path 1: Locked Template (Skills DSL)
            if (skillConfig?.templateId && SKILL_TEMPLATES[skillConfig.templateId]) {
                const template = SKILL_TEMPLATES[skillConfig.templateId];
                
                // Build robust row context
                const rowContext: Record<string, any> = { 'Entity': rowName };
                // Add canonical columns if they exist in the matrix
                const currentMatrix = activeMatrixRef.current;
                if (currentMatrix) {
                    const speciesCol = currentMatrix.columns.find(c => c.title.toLowerCase().includes('species') || c.isPrimaryKey);
                    const cultivarCol = currentMatrix.columns.find(c => c.title.toLowerCase() === 'cultivar');
                    const commonCol = currentMatrix.columns.find(c => c.title.toLowerCase().includes('common'));
                    
                    if (speciesCol) rowContext['Species'] = rowData.cells[speciesCol.id]?.value;
                    if (cultivarCol) rowContext['Cultivar'] = rowData.cells[cultivarCol.id]?.value;
                    if (commonCol) rowContext['Common Name'] = rowData.cells[commonCol.id]?.value;
                    
                    // Add all other columns too just in case
                    currentMatrix.columns.forEach(c => {
                         if (!rowContext[c.title]) rowContext[c.title] = rowData.cells[c.id]?.value;
                    });
                }

                // Build params
                const params: Record<string, any> = {};
                template.parameters.forEach(p => {
                    params[p.id] = skillConfig.params?.[p.id] !== undefined ? skillConfig.params[p.id] : p.defaultValue;
                });

                // Compile Prompt
                const compiledPrompt = template.promptBuilder(rowContext, params, fileNames);

                // Run Skill
                const result = await aiService.runSkillCell({
                    prompt: compiledPrompt,
                    outputType: template.outputType,
                    validator: template.validator,
                    contextFiles: contextFiles,
                    globalContext: projectContext,
                    evidenceRequired: template.evidencePolicy.evidenceRequired,
                    noGuessing: template.evidencePolicy.noGuessing
                });

                updateRowSafe(rowId, colId, result.ok ? 'success' : 'error', {
                    value: result.rawText,
                    displayValue: result.displayValue,
                    reasoning: result.reasoning,
                    normalized: result.normalized,
                    outputType: result.outputType,
                    provenance: {
                        skillTemplateId: template.id,
                        model: result.model,
                        ranAt: new Date().toISOString(),
                        contextFileIds: skillConfig.attachedContextIds,
                        promptHash: result.promptHash
                    }
                });
                return result.ok;

            } else {
                // Path 2: Legacy Free-Form Prompt
                let prompt = promptTemplate.replace('{Row}', rowName || '');
                const currentMatrix = activeMatrixRef.current;
                if(currentMatrix) {
                    currentMatrix.columns.forEach(c => {
                        const cellVal = rowData.cells[c.id]?.value || '';
                        prompt = prompt.replace(`{${c.title}}`, String(cellVal));
                    });
                }

                if (skillConfig?.outputType) {
                    prompt += getFormatInstruction(skillConfig.outputType);
                }

                if(onRunAICell) {
                    const res = await onRunAICell(prompt, contextFiles, projectContext);
                    updateRowSafe(rowId, colId, 'success', { value: res });
                    return true;
                }
            }
        } catch (e: any) {
            console.error("Skill Execution Error", e);
            updateRowSafe(rowId, colId, 'error', { reasoning: e.message || "Execution Failed" });
        }
        return false;
    };

    const handleRunAICell = async (rowId: string, colId: string) => {
        const startMatrix = activeMatrixRef.current;
        if (!startMatrix) return;
        const col = startMatrix.columns.find(c => c.id === colId);
        const row = startMatrix.rows.find(r => r.id === rowId);
        
        // Determine prompt source: legacy vs template
        const promptTemplate = col?.skillConfig?.promptTemplate || col?.aiPrompt || '';
        const isTemplate = !!col?.skillConfig?.templateId;

        if (!col || !row) return;
        if (!promptTemplate && !isTemplate) return;

        await runSingleCellAI(rowId, colId, promptTemplate, row.entityName || '', row, col.skillConfig);
    };

    const handleRunColumnAI = async (colId: string) => {
        const matrix = activeMatrixRef.current;
        if (!matrix) return;
        const col = matrix.columns.find(c => c.id === colId);
        const promptTemplate = col?.skillConfig?.promptTemplate || col?.aiPrompt || '';
        const isTemplate = !!col?.skillConfig?.templateId;
        
        if (!col) return;
        if (!promptTemplate && !isTemplate) return;
        
        // Default Policy: Run only on empty or error cells (matching previous behavior request, though spec says "prompt user", we default to smart fill for now)
        const targetRows = matrix.rows.filter(r => {
            const cell = r.cells[colId];
            return !cell?.value || cell.status === 'error' || cell.value === '';
        });
        
        if(targetRows.length === 0) { 
            // If full, maybe ask? For now just alert.
            alert("No empty cells found."); 
            return; 
        }
        
        setBatchProgress({ current: 0, total: targetRows.length });
        stopBatchRef.current = false;
        
        for (let i = 0; i < targetRows.length; i++) {
            if (stopBatchRef.current) break;
            const row = targetRows[i];
            await runSingleCellAI(row.id, colId, promptTemplate, row.entityName || '', row, col.skillConfig);
            setBatchProgress({ current: i + 1, total: targetRows.length });
        }
        setBatchProgress(null);
        stopBatchRef.current = false;
    };

    const visibleColumns = activeMatrix?.columns.filter(c => c.visible !== false) || [];
    const totalRows = activeMatrix?.rows.length || 0;
    const totalHeight = totalRows * ROW_HEIGHT + ROW_HEIGHT; 
    const totalWidth = 40 + visibleColumns.reduce((acc, col) => acc + (col.width || 200), 0) + 128;
    let startIndex = Math.floor(scrollTop / ROW_HEIGHT);
    let endIndex = Math.min(totalRows, Math.floor((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN);
    if (startIndex < 0) startIndex = 0;
    const visibleRows = activeMatrix?.rows.slice(startIndex, endIndex) || [];
    const offsetY = startIndex * ROW_HEIGHT;

    if (!activeMatrix) return <div>No Matrix</div>;

    const handleColumnSave = (newCol: MatrixColumn) => {
        const exists = activeMatrix.columns.find(c => c.id === newCol.id);
        let newCols;
        if (exists) {
            newCols = activeMatrix.columns.map(c => c.id === newCol.id ? newCol : c);
        } else {
            newCols = [...activeMatrix.columns, newCol];
        }
        onUpdateMatrix({ ...activeMatrix, columns: newCols });
        setEditingColumnSettings(null);
    };

    return (
        <div className="flex flex-col h-full bg-white relative overflow-hidden outline-none" tabIndex={0}>
            {/* Toolbar */}
            {!hideToolbar && (
                <div className="flex-none h-12 bg-slate-50 border-b border-slate-200 flex items-center px-4 justify-between z-30">
                    <div className="flex items-center gap-4 h-full">
                        {matrices.map(m => (<div key={m.id} onClick={() => onActiveIdChange && onActiveIdChange(m.id)} className={`cursor-pointer font-bold text-sm ${activeMatrix.id === m.id ? 'text-slate-800' : 'text-slate-500'}`}>{m.title}</div>))}
                        <button onClick={() => onCreateMatrix && onCreateMatrix({ id: `new-${Date.now()}`, title: 'New Sheet', columns: [], rows: [] })}><PlusIcon className="h-4 w-4"/></button>
                    </div>
                    <div className="flex items-center gap-2">
                        {batchProgress && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-weflora-mint/10 text-weflora-dark rounded-lg text-xs font-bold mr-2 border border-weflora-teal/20 animate-fadeIn"><RefreshIcon className="h-3 w-3 animate-spin text-weflora-teal" /> Processing {batchProgress.current}/{batchProgress.total}<button onClick={() => stopBatchRef.current = true} className="ml-2 p-1 bg-weflora-red/20 hover:bg-weflora-red/30 text-weflora-red rounded-full transition-colors"><div className="w-2 h-2 bg-weflora-red rounded-sm"></div></button></div>
                        )}
                        <button onClick={() => importInputRef.current?.click()} className="p-2"><UploadIcon className="h-4 w-4"/></button>
                        <input type="file" ref={importInputRef} className="hidden" />
                    </div>
                </div>
            )}

            {/* Grid */}
            <div className="flex-1 overflow-hidden relative flex flex-col min-h-0">
                {/* Header */}
                <div ref={headerRef} className="flex bg-slate-50 border-b border-slate-200 z-20 overflow-x-hidden" style={{ minWidth: totalWidth }}>
                    <div className="w-10 border-r border-slate-200 p-2 text-center text-xs font-bold text-slate-400">#</div>
                    {visibleColumns.map(col => (
                        <ColumnHeader key={col.id} column={col} onUpdate={(c:any)=>onUpdateMatrix({...activeMatrix, columns: activeMatrix.columns.map(o=>o.id===c.id?c:o)})} onDelete={(id:string)=>onDeleteMatrix && onDeleteMatrix(id)} onRunColumnAI={handleRunColumnAI} onEditSettings={(id:string)=>setEditingColumnSettings(activeMatrix.columns.find(c=>c.id===id)||null)} />
                    ))}
                    <button ref={addColumnBtnRef} onClick={handleAddColumnClick} className="w-32 border-r border-slate-200 flex items-center justify-center text-slate-400 hover:text-weflora-teal"><PlusIcon className="h-4 w-4"/> Add</button>
                </div>

                {/* Rows */}
                <div ref={containerRef} className="flex-1 overflow-auto bg-white custom-scrollbar outline-none relative min-h-0" onScroll={handleScroll}>
                    <div style={{ height: totalHeight, position: 'relative', minWidth: `${totalWidth}px` }}>
                        {visibleRows.map((row, i) => {
                            const actualIndex = startIndex + i;
                            const top = offsetY + (i * ROW_HEIGHT);
                            return (
                                <div key={row.id} className="flex absolute left-0 border-b border-slate-100 hover:bg-slate-50 group" style={{ top, height: ROW_HEIGHT, width: '100%' }}>
                                    <div className="w-10 border-r border-slate-200 flex items-center justify-center text-xs text-slate-400">{actualIndex + 1}</div>
                                    {visibleColumns.map((col, cIndex) => {
                                        const cell = row.cells[col.id];
                                        const isEditing = editingCell?.rowId === row.id && editingCell?.colId === col.id;
                                        const isProcessing = cell?.status === 'loading';
                                        const isError = cell?.status === 'error';
                                        const isAIDerived = isAIDerivedColumn(col);
                                        
                                        // AUTOCOMPLETE LOGIC: Check if this is a species column
                                        const isSpeciesColumn = col.title.toLowerCase().includes('species') || col.title.toLowerCase().includes('scientific') || col.isPrimaryKey;
                                        const suggestions = isSpeciesColumn ? speciesList.map(s => s.scientificName) : [];

                                        return (
                                            <div
                                                key={col.id}
                                                className={`border-r border-slate-100 relative p-0 transition-colors 
                                                    ${isEditing ? 'z-10 ring-2 ring-weflora-teal' : ''} 
                                                    ${isAIDerived && !isEditing 
                                                        ? (isError ? 'bg-red-50 hover:bg-red-100 hover:ring-1 hover:ring-red-200' : 'bg-weflora-teal/10 hover:bg-weflora-teal/20 hover:ring-1 hover:ring-weflora-teal/20')
                                                        : ''
                                                    }
                                                `}
                                                style={{ width: col.width }}
                                                onClick={() => !isProcessing && setEditingCell({ rowId: row.id, colId: col.id })}
                                                onDoubleClick={() => {
                                                    if (!isAIDerived) return;
                                                    if (!cell) return;
                                                    if (!(cell.citations?.length || cell.status === 'error' || cell.reasoning)) return;
                                                    
                                                    openEvidencePanel({
                                                        label: `Skill Evidence • ${col.title}`,
                                                        sources: cell.citations?.map(c => c.source).filter(Boolean),
                                                        generatedAt: cell.provenance?.ranAt || new Date().toLocaleString(),
                                                        reasoning: cell.reasoning,
                                                        displayValue: cell.displayValue,
                                                        outputType: cell.outputType,
                                                        templateId: cell.provenance?.skillTemplateId,
                                                        model: cell.provenance?.model,
                                                        promptHash: cell.provenance?.promptHash,
                                                    });
                                                }}
                                            >
                                                {isProcessing && <div className="absolute inset-0 bg-white/50 z-20 flex items-center justify-center"><RefreshIcon className="h-4 w-4 animate-spin text-weflora-teal" /></div>}
                                                {isEditing ? (
                                                    <MatrixInput 
                                                        value={cell?.value ?? ''} 
                                                        type={col.type} 
                                                        onSave={(val) => handleCellChange(row.id, col.id, val)} 
                                                        onCancel={() => setEditingCell(null)} 
                                                        isActive={true} 
                                                        disabled={isProcessing}
                                                        suggestions={suggestions} // Pass suggestions here
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center">
                                                        {col.type === 'ai' && !cell?.value && !isProcessing ? (
                                                            <button onClick={() => handleRunAICell(row.id, col.id)} className="mx-2 px-2 py-0.5 bg-weflora-mint/20 text-weflora-dark rounded text-[10px] font-bold flex items-center gap-1"><SparklesIcon className="h-3 w-3"/> Run AI</button>
                                                        ) : (
                                                            <RichCellRenderer 
                                                                value={cell?.value ?? ''} 
                                                                column={col} 
                                                                cell={cell}
                                                                onInspect={
                                                                    (col.isPrimaryKey && onInspectEntity) 
                                                                    ? () => onInspectEntity(String(cell?.value || '')) 
                                                                    : undefined
                                                                }
                                                            />
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Portals */}
            {isAddMenuOpen && addMenuPos && createPortal(
                <div 
                    className="fixed bg-white border border-slate-200 shadow-xl rounded-lg z-[9999] flex flex-col w-40 overflow-hidden animate-fadeIn" 
                    style={{ top: addMenuPos.top, left: addMenuPos.left }}
                >
                    <button 
                        onClick={() => handleInitiateAddColumn('text')} 
                        className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 text-slate-700 transition-colors"
                    >
                        <LayoutGridIcon className="h-4 w-4 text-slate-400" />
                        Create Column
                    </button>
                    <button 
                        onClick={() => handleInitiateAddColumn('ai')} 
                        className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm hover:bg-weflora-mint/10 text-slate-700 hover:text-weflora-dark transition-colors border-t border-slate-100"
                    >
                        <SparklesIcon className="h-4 w-4 text-weflora-teal" />
                        Select Skill
                    </button>
                </div>, 
                document.body
            )}
            
            {editingColumnSettings && (
                <ColumnSettingsModal 
                    column={editingColumnSettings} 
                    onSave={handleColumnSave} 
                    onDelete={() => { /* Not dealing with deletion of new un-added cols */ setEditingColumnSettings(null); }} 
                    onClose={() => setEditingColumnSettings(null)} 
                    projectFiles={projectFiles} 
                    onUpload={onUpload} 
                />
            )}
        </div>
    );
};

export default MatrixView;
