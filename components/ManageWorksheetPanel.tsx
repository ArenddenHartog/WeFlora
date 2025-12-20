
import React, { useState } from 'react';
import type { Matrix, MatrixColumn, MatrixColumnType, SkillConfiguration } from '../types';
import { 
    SlidersIcon, XIcon, GripVerticalIcon, AdjustmentsHorizontalIcon, 
    EyeIcon, EyeOffIcon, PlusIcon, CheckIcon,
    ShieldCheckIcon, ToolIcon, CurrencyDollarIcon, BarChartIcon, SparklesIcon
} from './icons';
import ColumnSettingsModal from './ColumnSettingsModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';

const ManageWorksheetPanel: React.FC<{
    matrix?: Matrix;
    onUpdate: (matrix: Matrix) => void;
    onClose: () => void;
    onUpload?: (files: File[]) => void;
}> = ({ matrix, onUpdate, onClose, onUpload }) => {
    const [draggedColId, setDraggedColId] = useState<string | null>(null);
    const [editingColumn, setEditingColumn] = useState<MatrixColumn | null>(null);
    const [pendingDeleteColumnId, setPendingDeleteColumnId] = useState<string | null>(null);

    // --- TEMPLATE DATA ---
    interface SkillTemplate {
        id: string;
        category: 'Compliance' | 'Maintenance' | 'Finance' | 'Analysis';
        name: string;
        description: string;
        promptTemplate: string;
        outputType: 'text' | 'badge' | 'score' | 'currency';
    }

    const SKILL_TEMPLATES: SkillTemplate[] = [
        {
            id: 'st-zoning',
            category: 'Compliance',
            name: 'Zoning Check',
            description: 'Checks if species complies with standard urban zoning.',
            promptTemplate: 'Analyze {Row} against standard urban zoning requirements. Output format: "Status - Key Factor" (e.g. "Approved - Non-invasive").',
            outputType: 'badge'
        },
        {
            id: 'st-native',
            category: 'Compliance',
            name: 'Native Status',
            description: 'Verifies native status for the region.',
            promptTemplate: 'Determine if {Row} is native to [Insert Region]. Output format: "Status - Origin" (e.g. "Native - Local Ecotype").',
            outputType: 'badge'
        },
        {
            id: 'st-maint-sched',
            category: 'Maintenance',
            name: 'Maintenance Schedule',
            description: 'Generates a brief pruning/watering summary.',
            promptTemplate: 'Create a 1-sentence maintenance summary for {Row} focusing on pruning and watering needs.',
            outputType: 'text'
        },
        {
            id: 'st-urgency',
            category: 'Maintenance',
            name: 'Pruning Urgency',
            description: 'Estimates urgency based on growth rate.',
            promptTemplate: 'Estimate pruning urgency for {Row} based on typical growth rate. Output format: "Score/100 - Frequency" (e.g. "80/100 - Annual").',
            outputType: 'score'
        },
        {
            id: 'st-cost-est',
            category: 'Finance',
            name: 'Cost Estimator',
            description: 'Estimates average market unit cost.',
            promptTemplate: 'Estimate the average market unit cost for {Row} (standard size). Output format: "$Amount".',
            outputType: 'currency'
        },
        {
            id: 'st-resilience',
            category: 'Analysis',
            name: 'Resilience Score',
            description: 'Scores urban resilience (drought/pollution).',
            promptTemplate: 'Rate the urban resilience of {Row} considering drought and pollution. Output format: "Score/100 - Key Trait".',
            outputType: 'score'
        }
    ];

    if (!matrix) return (
        <div className="flex flex-col h-full bg-slate-50 border-l border-slate-200 p-6 text-center text-slate-400">
            <SlidersIcon className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No active worksheet to manage.</p>
        </div>
    );

    const toggleColumnVisibility = (colId: string) => {
        const newCols = matrix.columns.map(c => 
            c.id === colId ? { ...c, visible: !c.visible } : c
        );
        onUpdate({ ...matrix, columns: newCols });
    };

    const handleColumnNameChange = (colId: string, newName: string) => {
        const newCols = matrix.columns.map(c => 
            c.id === colId ? { ...c, title: newName } : c
        );
        onUpdate({ ...matrix, columns: newCols });
    };

    const handleDeleteColumn = (colId: string) => {
        setPendingDeleteColumnId(colId);
    };

    const handleUpdateColumn = (updatedCol: MatrixColumn) => {
        const newCols = matrix.columns.map(c => c.id === updatedCol.id ? updatedCol : c);
        onUpdate({ ...matrix, columns: newCols });
        setEditingColumn(null);
    };

    // Standard Column Adder
    const handleAddPredefined = (title: string, type: MatrixColumnType = 'text', width: number = 180) => {
        if (matrix.columns.some(c => c.title === title)) return;

        const newCol: MatrixColumn = {
            id: `col-pre-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title,
            type,
            width,
            visible: true
        };
        onUpdate({ ...matrix, columns: [...matrix.columns, newCol] });
    };

    // Skill Adder
    const handleAddSkill = (template: SkillTemplate) => {
        if (matrix.columns.some(c => c.title === template.name)) return;

        const skillConfig: SkillConfiguration = {
            id: `skill-${Date.now()}`,
            name: template.name,
            description: template.description,
            promptTemplate: template.promptTemplate,
            attachedContextIds: [], // User can add later in modal
            outputType: template.outputType
        };

        const newCol: MatrixColumn = {
            id: `col-skill-${Date.now()}`,
            title: template.name,
            type: 'ai',
            width: 220,
            visible: true,
            skillConfig: skillConfig,
            aiPrompt: template.promptTemplate // Legacy fallback
        };

        onUpdate({ ...matrix, columns: [...matrix.columns, newCol] });
    };

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedColId(id);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggedColId || draggedColId === targetId) return;

        const oldIndex = matrix.columns.findIndex(c => c.id === draggedColId);
        const newIndex = matrix.columns.findIndex(c => c.id === targetId);
        
        if (oldIndex === -1 || newIndex === -1) return;

        const newCols = [...matrix.columns];
        const [movedCol] = newCols.splice(oldIndex, 1);
        newCols.splice(newIndex, 0, movedCol);

        onUpdate({ ...matrix, columns: newCols });
        setDraggedColId(null);
    };

    const getCategoryIcon = (cat: string) => {
        switch(cat) {
            case 'Compliance': return <ShieldCheckIcon className="h-4 w-4" />;
            case 'Maintenance': return <ToolIcon className="h-4 w-4" />;
            case 'Finance': return <CurrencyDollarIcon className="h-4 w-4" />;
            case 'Analysis': return <BarChartIcon className="h-4 w-4" />;
            default: return <SparklesIcon className="h-4 w-4" />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 border-l border-slate-200">
            <header className="p-4 border-b border-slate-200 bg-white flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                    <SlidersIcon className="h-5 w-5 text-weflora-teal" />
                    Worksheet Settings
                </div>
                <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600">
                    <XIcon className="h-5 w-5" />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                
                {/* 1. Worksheet Settings */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Worksheet Title</label>
                    <input 
                        type="text" 
                        value={matrix.title}
                        onChange={(e) => onUpdate({ ...matrix, title: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-weflora-teal/30 focus:border-weflora-teal text-slate-900"
                        placeholder="Worksheet Title"
                    />
                </div>

                <hr className="border-slate-200" />

                {/* 2. Column Management */}
                <section>
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Columns</h3>
                        <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{matrix.columns.length}</span>
                    </div>
                    <div className="space-y-2">
                        {matrix.columns.map((col) => (
                            <div 
                                key={col.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, col.id)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, col.id)}
                                className={`flex items-center gap-2 p-2 bg-white border rounded-lg group shadow-sm transition-all ${
                                    draggedColId === col.id ? 'opacity-50 ring-2 ring-blue-400' : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <div className="cursor-grab text-slate-300 hover:text-slate-500 flex-shrink-0">
                                    <GripVerticalIcon className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <input 
                                        type="text" 
                                        value={col.title}
                                        onChange={(e) => handleColumnNameChange(col.id, e.target.value)}
                                        className="w-full text-sm font-medium text-slate-900 bg-transparent border-none focus:ring-0 p-0 hover:bg-slate-50 rounded px-1 transition-colors truncate"
                                    />
                                    <div className="text-[10px] text-slate-400 px-1 capitalize flex items-center gap-1">
                                        {col.type === 'ai' ? <SparklesIcon className="h-3 w-3 text-weflora-teal"/> : null}
                                        {col.type === 'ai' ? 'Skill' : col.type}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => setEditingColumn(col)}
                                        className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                                        title="Column Settings"
                                    >
                                        <AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
                                    </button>
                                    <button 
                                        onClick={() => toggleColumnVisibility(col.id)}
                                        className={`p-1.5 rounded hover:bg-slate-100 ${col.visible !== false ? 'text-slate-400 hover:text-slate-600' : 'text-slate-300'}`}
                                        title={col.visible !== false ? "Hide Column" : "Show Column"}
                                    >
                                        {col.visible !== false ? <EyeIcon className="h-3.5 w-3.5" /> : <EyeOffIcon className="h-3.5 w-3.5" />}
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteColumn(col.id)}
                                        className="p-1.5 rounded hover:bg-weflora-red/10 text-slate-300 hover:text-weflora-red"
                                        title="Delete Column"
                                    >
                                        <XIcon className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <hr className="border-slate-200" />

                {/* 3. FloraGPT Skill Library */}
                <section>
                    <h3 className="text-xs font-bold text-weflora-dark uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
                        <SparklesIcon className="h-4 w-4" /> FloraGPT Skills
                    </h3>
                    <div className="space-y-2">
                        {SKILL_TEMPLATES.map((tmpl) => {
                            const exists = matrix.columns.some(c => c.title === tmpl.name);
                            return (
                                <button
                                    key={tmpl.id}
                                    onClick={() => !exists && handleAddSkill(tmpl)}
                                    disabled={exists}
                                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                                        exists 
                                        ? 'bg-weflora-mint/10 border-weflora-teal/20 opacity-70 cursor-default' 
                                        : 'bg-white border-weflora-teal/20 hover:border-weflora-teal hover:shadow-sm cursor-pointer group'
                                    }`}
                                >
                                    <div className={`p-2 rounded-lg ${exists ? 'bg-weflora-mint/30 text-weflora-teal' : 'bg-weflora-mint/10 text-weflora-teal group-hover:bg-weflora-mint/30 group-hover:text-weflora-dark'}`}>
                                        {getCategoryIcon(tmpl.category)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-sm font-bold ${exists ? 'text-weflora-dark' : 'text-slate-800'}`}>{tmpl.name}</div>
                                        <div className="text-[10px] text-slate-500 line-clamp-1">{tmpl.description}</div>
                                    </div>
                                    {exists ? (
                                        <CheckIcon className="h-4 w-4 text-weflora-teal" />
                                    ) : (
                                        <PlusIcon className="h-4 w-4 text-slate-300 group-hover:text-weflora-teal" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </section>

                <hr className="border-slate-200" />

                {/* 4. Basic Columns */}
                <section>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-1">Basic Columns</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <button 
                            onClick={() => handleAddPredefined('New Text', 'text')}
                            className="p-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors text-center"
                        >
                            + Text
                        </button>
                        <button 
                            onClick={() => handleAddPredefined('New Number', 'number')}
                            className="p-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors text-center"
                        >
                            + Number
                        </button>
                        <button 
                            onClick={() => handleAddPredefined('New Select', 'select')}
                            className="p-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors text-center"
                        >
                            + Select
                        </button>
                        <button 
                            onClick={() => handleAddPredefined('Custom AI', 'ai')}
                            className="p-2 bg-weflora-mint/10 border border-weflora-teal/20 rounded-lg text-xs font-medium text-weflora-teal hover:border-weflora-teal hover:bg-weflora-mint/30 transition-colors text-center"
                        >
                            + Custom Skill
                        </button>
                    </div>
                </section>

                {/* 5. Details */}
                <div className="pt-4 border-t border-slate-200 mt-2">
                    <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Details</h3>
                    <div className="text-xs text-slate-500 space-y-2">
                        <div className="flex justify-between">
                            <span>ID:</span>
                            <span className="font-mono">{matrix.id}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Last Updated:</span>
                            <span>{matrix.updatedAt || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Rows:</span>
                            <span>{matrix.rows.length}</span>
                        </div>
                    </div>
                </div>
            </div>

            {editingColumn && (
                <ColumnSettingsModal 
                    column={editingColumn} 
                    onSave={handleUpdateColumn} 
                    onDelete={handleDeleteColumn}
                    onClose={() => setEditingColumn(null)}
                    onUpload={onUpload} 
                />
            )}

            <ConfirmDeleteModal
                isOpen={Boolean(pendingDeleteColumnId)}
                title="Delete column?"
                description={`This will permanently delete "${
                    pendingDeleteColumnId ? (matrix.columns.find(c => c.id === pendingDeleteColumnId)?.title || 'this column') : 'this column'
                }" from this worksheet. This cannot be undone.`}
                confirmLabel="Delete column"
                onCancel={() => setPendingDeleteColumnId(null)}
                onConfirm={() => {
                    if (!pendingDeleteColumnId) return;
                    const newCols = matrix.columns.filter(c => c.id !== pendingDeleteColumnId);
                    onUpdate({ ...matrix, columns: newCols });
                    setEditingColumn(null);
                    setPendingDeleteColumnId(null);
                }}
            />
        </div>
    );
};

export default ManageWorksheetPanel;
