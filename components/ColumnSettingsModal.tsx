
import React, { useState, useEffect, useRef } from 'react';
import type { MatrixColumn, MatrixColumnType, SkillConfiguration, ProjectFile, ConditionalFormattingRule } from '../types';
import BaseModal from './BaseModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import { 
    FileSheetIcon, FilePdfIcon, FileCodeIcon, CheckIcon, 
    SparklesIcon, PlusIcon, XIcon, SearchIcon, UploadIcon,
    AdjustmentsHorizontalIcon
} from './icons';

interface ColumnSettingsModalProps {
    column: MatrixColumn;
    onSave: (col: MatrixColumn) => void;
    onDelete: (colId: string) => void;
    onClose: () => void;
    projectFiles?: ProjectFile[];
    onUpload?: (files: File[]) => void;
}

const FORMAT_OPTIONS = [
    { label: 'Free Text', value: 'text', description: 'Standard text response' },
    { label: 'Smart Badge', value: 'badge', description: "Status - Brief Rationale" },
    { label: 'Score (0-100)', value: 'score', description: "Score/100 - Key Reason" },
    { label: 'Currency', value: 'currency', description: "$Amount" },
];

const COLORS = [
    { value: 'green', bg: 'bg-weflora-success' },
    { value: 'amber', bg: 'bg-weflora-amber' },
    { value: 'red', bg: 'bg-weflora-red' },
    // NOTE: No WeFlora “info blue” token; use teal for selectable "blue" to avoid non-token colors.
    { value: 'blue', bg: 'bg-weflora-teal' },
    { value: 'slate', bg: 'bg-slate-400' },
];

const CONDITIONS = [
    { value: 'contains', label: 'Contains' },
    { value: 'equals', label: 'Equals' },
    { value: 'starts_with', label: 'Starts With' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' },
];

const ColumnSettingsModal: React.FC<ColumnSettingsModalProps> = ({ column, onSave, onDelete, onClose, projectFiles = [], onUpload }) => {
    const [editedCol, setEditedCol] = useState({ ...column });
    const [activeTab, setActiveTab] = useState<'logic' | 'files' | 'display'>('logic');
    
    // Initialize Skill Config if missing
    const [skillConfig, setSkillConfig] = useState<SkillConfiguration>(column.skillConfig || {
        id: `skill-${Date.now()}`,
        name: 'New Skill',
        promptTemplate: column.aiPrompt || '',
        attachedContextIds: [],
        outputType: 'text',
        conditionalFormatting: []
    });

    // New Rule State
    const [newRuleCondition, setNewRuleCondition] = useState<ConditionalFormattingRule['condition']>('contains');
    const [newRuleValue, setNewRuleValue] = useState('');
    const [newRuleStyle, setNewRuleStyle] = useState<ConditionalFormattingRule['style']>('green');
    const [pendingRemoveRuleId, setPendingRemoveRuleId] = useState<string | null>(null);

    // File Search State
    const [fileSearch, setFileSearch] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sync editedCol with Skill Config on Save
    const handleSave = () => {
        let finalCol = { ...editedCol };
        if (editedCol.type === 'ai') {
            finalCol.skillConfig = skillConfig;
            // Legacy compat: Keep aiPrompt somewhat synced for older viewers, 
            // but the engine will now prioritize skillConfig + runtime format injection.
            finalCol.aiPrompt = skillConfig.promptTemplate; 
        }
        onSave(finalCol);
    };

    const handleFormatChange = (newFormat: string) => {
        // We no longer modify the promptTemplate text here.
        // We only update the configuration state.
        setSkillConfig(prev => ({ ...prev, outputType: newFormat as any }));
    };

    const toggleFileAttachment = (fileId: string) => {
        setSkillConfig(prev => {
            const newIds = new Set(prev.attachedContextIds);
            if (newIds.has(fileId)) newIds.delete(fileId);
            else newIds.add(fileId);
            return { ...prev, attachedContextIds: Array.from(newIds) };
        });
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0 && onUpload) {
            onUpload(Array.from(e.target.files));
        }
    };

    const handleAddRule = () => {
        if (!newRuleValue.trim()) return;
        const rule: ConditionalFormattingRule = {
            id: `rule-${Date.now()}`,
            condition: newRuleCondition,
            value: newRuleValue,
            style: newRuleStyle
        };
        setSkillConfig(prev => ({
            ...prev,
            conditionalFormatting: [...(prev.conditionalFormatting || []), rule]
        }));
        setNewRuleValue('');
    };

    const handleRemoveRule = (id: string) => {
        setPendingRemoveRuleId(id);
    };

    const getFileIcon = (name: string) => {
        if (name.endsWith('.pdf')) return <FilePdfIcon className="h-4 w-4 text-weflora-red" />;
        if (name.endsWith('.xlsx') || name.endsWith('.csv')) return <FileSheetIcon className="h-4 w-4 text-weflora-success" />;
        return <FileCodeIcon className="h-4 w-4 text-slate-500" />;
    };

    const filteredFiles = projectFiles.filter(f => 
        f.name.toLowerCase().includes(fileSearch.toLowerCase())
    );

    const activeFormat = FORMAT_OPTIONS.find(f => f.value === skillConfig.outputType);

    return (
        <>
        <BaseModal 
            isOpen={true} 
            onClose={onClose} 
            title={editedCol.type === 'ai' ? 'Configure Skill' : 'Column Settings'}
            subtitle={editedCol.type === 'ai' ? skillConfig.name : undefined}
            size="md" 
            footer={
                <>
                    <button onClick={() => onDelete(column.id)} className="flex-1 py-2 text-weflora-red hover:bg-weflora-red/10 rounded-lg text-sm font-medium transition-colors">Delete</button>
                    <button onClick={handleSave} className="flex-1 py-2 bg-weflora-teal text-white hover:bg-weflora-dark rounded-lg text-sm font-medium shadow-sm transition-colors">Save</button>
                </>
            }
        >
            <div className="space-y-4">
                {/* Basic Settings */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Column Title</label>
                        <input type="text" value={editedCol.title} onChange={e => setEditedCol({...editedCol, title: e.target.value})} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-weflora-teal outline-none"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Type</label>
                        <select value={editedCol.type} onChange={e => setEditedCol({...editedCol, type: e.target.value as MatrixColumnType})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-weflora-teal outline-none bg-white">
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="select">Dropdown (Select)</option>
                            <option value="ai">Skill (FloraGPT)</option>
                        </select>
                    </div>
                </div>

                {editedCol.type !== 'ai' && (
                    <>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="isPk" checked={!!editedCol.isPrimaryKey} onChange={(e) => setEditedCol({...editedCol, isPrimaryKey: e.target.checked})} className="accent-weflora-teal cursor-pointer"/>
                            <label htmlFor="isPk" className="text-sm text-slate-700 cursor-pointer">Use as Key Item</label>
                        </div>
                        {editedCol.type === 'select' && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Options (comma separated)</label>
                                <input type="text" value={editedCol.options?.join(', ') || ''} onChange={e => setEditedCol({...editedCol, options: e.target.value.split(',').map(s => s.trim())})} placeholder="High, Medium, Low" className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-weflora-teal outline-none"/>
                            </div>
                        )}
                    </>
                )}

                {/* Skill Configuration Section */}
                {editedCol.type === 'ai' && (
                    <div className="bg-weflora-mint/20 border border-weflora-teal/20 rounded-xl overflow-hidden mt-4">
                        <div className="flex border-b border-weflora-teal/20 bg-weflora-mint/20">
                            <button onClick={() => setActiveTab('logic')} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'logic' ? 'bg-white text-weflora-dark border-b-2 border-weflora-teal' : 'text-slate-500 hover:text-weflora-teal'}`}>Logic</button>
                            <button onClick={() => setActiveTab('files')} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'files' ? 'bg-white text-weflora-dark border-b-2 border-weflora-teal' : 'text-slate-500 hover:text-weflora-teal'}`}>Files <span className="bg-weflora-mint text-weflora-dark text-[10px] px-1.5 rounded-full ml-1">{skillConfig.attachedContextIds.length}</span></button>
                            <button onClick={() => setActiveTab('display')} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'display' ? 'bg-white text-weflora-dark border-b-2 border-weflora-teal' : 'text-slate-500 hover:text-weflora-teal'}`}>Format</button>
                        </div>

                        <div className="p-4">
                            {/* LOGIC TAB */}
                            {activeTab === 'logic' && (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-weflora-dark mb-1">Skill Name</label>
                                        <input type="text" value={skillConfig.name} onChange={e => setSkillConfig({...skillConfig, name: e.target.value})} className="w-full bg-white border border-weflora-teal/30 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-weflora-teal outline-none"/>
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-xs font-bold text-weflora-dark">Instruction (Prompt)</label>
                                            {skillConfig.outputType !== 'text' && (
                                                <span className="text-[10px] bg-weflora-teal text-white px-2 py-0.5 rounded-full flex items-center gap-1" title="Output format is controlled by the Format tab">
                                                    <AdjustmentsHorizontalIcon className="h-3 w-3" />
                                                    Format: {activeFormat?.label}
                                                </span>
                                            )}
                                        </div>
                                        <textarea 
                                            value={skillConfig.promptTemplate} 
                                            onChange={e => setSkillConfig({...skillConfig, promptTemplate: e.target.value})} 
                                            placeholder="Analyze {Row} for..." 
                                            rows={5} 
                                            className="w-full bg-white border border-weflora-teal/30 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-weflora-teal outline-none resize-none"
                                        />
                                        <div className="flex justify-between items-start mt-1">
                                            <p className="text-[10px] text-weflora-teal">
                                                Tip: Use <code>{`{Column Name}`}</code> to reference other cells.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* FILES TAB */}
                            {activeTab === 'files' && (
                                <div className="space-y-3">
                                    <p className="text-xs text-slate-600">
                                        Attach files that this Skill should reference. The AI will look at these documents when processing rows.
                                    </p>
                                    
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                                            <input 
                                                type="text" 
                                                placeholder="Search files..." 
                                                value={fileSearch}
                                                onChange={(e) => setFileSearch(e.target.value)}
                                                className="w-full pl-7 pr-2 py-1.5 bg-white border border-weflora-teal/30 rounded-lg text-xs outline-none focus:border-weflora-teal"
                                            />
                                        </div>
                                        <button 
                                            onClick={() => fileInputRef.current?.click()} 
                                            className="px-3 py-1.5 bg-weflora-mint/30 text-weflora-dark rounded-lg text-xs font-bold hover:bg-weflora-mint/50 transition-colors flex items-center gap-1"
                                        >
                                            <UploadIcon className="h-3 w-3" /> Upload
                                        </button>
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            className="hidden" 
                                            multiple 
                                            onChange={handleFileUpload}
                                        />
                                    </div>

                                    <div className="max-h-[200px] overflow-y-auto space-y-1 border border-weflora-teal/20 rounded-lg bg-white p-1 custom-scrollbar">
                                        {projectFiles.length === 0 && <div className="text-center py-4 text-xs text-slate-400">No files in project.</div>}
                                        {filteredFiles.map(file => {
                                            const isSelected = skillConfig.attachedContextIds.includes(file.id);
                                            return (
                                                <div 
                                                    key={file.id} 
                                                    onClick={() => toggleFileAttachment(file.id)}
                                                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-all ${isSelected ? 'bg-weflora-mint/20 border-weflora-teal ring-1 ring-weflora-teal' : 'bg-white border-transparent hover:bg-slate-50'}`}
                                                >
                                                    <div className="shrink-0">{getFileIcon(file.name)}</div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-bold text-slate-700 truncate">{file.name}</div>
                                                        <div className="text-[10px] text-slate-400">{file.size}</div>
                                                    </div>
                                                    {isSelected && <CheckIcon className="h-4 w-4 text-weflora-teal" />}
                                                </div>
                                            );
                                        })}
                                        {filteredFiles.length === 0 && projectFiles.length > 0 && (
                                            <div className="text-center py-2 text-xs text-slate-400">No matching files.</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* DISPLAY TAB */}
                            {activeTab === 'display' && (
                                <div className="space-y-4">
                                    {/* 1. Output Style */}
                                    <div>
                                        <label className="block text-xs font-bold text-weflora-dark mb-1">Output Style</label>
                                        <select 
                                            value={skillConfig.outputType} 
                                            onChange={(e) => handleFormatChange(e.target.value)}
                                            className="w-full border border-weflora-teal/30 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:border-weflora-teal outline-none bg-white"
                                        >
                                            {FORMAT_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                        <p className="text-[10px] text-slate-500 mt-1">
                                            {activeFormat?.description}
                                        </p>
                                    </div>

                                    {/* 2. Visual Rules Engine */}
                                    <div>
                                        <label className="block text-xs font-bold text-weflora-dark mb-2">Visual Rules (Conditional Formatting)</label>
                                        <div className="space-y-2 mb-3">
                                            {skillConfig.conditionalFormatting?.map((rule, idx) => (
                                                <div key={rule.id} className="flex items-center gap-2 text-xs bg-weflora-mint/20 p-2 rounded border border-weflora-teal/20">
                                                    <span className="text-weflora-teal font-mono text-[10px] w-4">{idx + 1}.</span>
                                                    <span className="text-slate-600">If</span>
                                                    <span className="font-bold text-slate-800 capitalize">{rule.condition.replace('_', ' ')}</span>
                                                    <span className="bg-white px-1.5 py-0.5 rounded border border-weflora-teal/30 text-slate-800 font-mono max-w-[80px] truncate" title={rule.value}>"{rule.value}"</span>
                                                    <span className="text-slate-600">then</span>
                                                    <div className={`w-4 h-4 rounded-full ${COLORS.find(c => c.value === rule.style)?.bg}`}></div>
                                                    <button
                                                        onClick={() => handleRemoveRule(rule.id)}
                                                        className="ml-auto h-8 w-8 flex items-center justify-center cursor-pointer text-slate-400 hover:text-weflora-red hover:bg-weflora-red/10 rounded"
                                                        title="Delete rule"
                                                    >
                                                        <XIcon className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                            {(!skillConfig.conditionalFormatting || skillConfig.conditionalFormatting.length === 0) && (
                                                <div className="text-[10px] text-slate-400 italic p-2 border border-dashed border-slate-200 rounded text-center">
                                                    No rules defined. Default AI coloring will be used.
                                                </div>
                                            )}
                                        </div>

                                        {/* Rule Builder Form */}
                                        <div className="flex items-center gap-2 p-2 bg-white border border-weflora-teal/30 rounded-lg shadow-sm">
                                            <select 
                                                value={newRuleCondition}
                                                onChange={(e) => setNewRuleCondition(e.target.value as any)}
                                                className="text-xs border border-slate-200 rounded px-1 py-1.5 bg-white text-slate-900 outline-none w-24"
                                            >
                                                {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                            </select>
                                            <input 
                                                type="text" 
                                                placeholder="Value..." 
                                                value={newRuleValue}
                                                onChange={(e) => setNewRuleValue(e.target.value)}
                                                className="flex-1 text-xs border border-slate-200 bg-white text-slate-900 rounded px-2 py-1.5 outline-none"
                                            />
                                            <div className="flex gap-1">
                                                {COLORS.map(c => (
                                                    <button 
                                                        key={c.value}
                                                        onClick={() => setNewRuleStyle(c.value as any)}
                                                        className={`w-5 h-5 rounded-full ${c.bg} ${newRuleStyle === c.value ? 'ring-2 ring-weflora-teal ring-offset-1' : 'opacity-60 hover:opacity-100'}`}
                                                        title={c.value}
                                                    />
                                                ))}
                                            </div>
                                            <button 
                                                onClick={handleAddRule}
                                                disabled={!newRuleValue.trim()}
                                                className="p-1.5 bg-weflora-teal text-white rounded hover:bg-weflora-dark disabled:opacity-50"
                                            >
                                                <PlusIcon className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </BaseModal>

        <ConfirmDeleteModal
            isOpen={Boolean(pendingRemoveRuleId)}
            title="Delete rule?"
            description="This will permanently delete this conditional formatting rule. This cannot be undone."
            confirmLabel="Delete rule"
            onCancel={() => setPendingRemoveRuleId(null)}
            onConfirm={() => {
                if (!pendingRemoveRuleId) return;
                setSkillConfig(prev => ({
                    ...prev,
                    conditionalFormatting: (prev.conditionalFormatting || []).filter(r => r.id !== pendingRemoveRuleId)
                }));
                setPendingRemoveRuleId(null);
            }}
        />
        </>
    );
};

export default ColumnSettingsModal;
