
import React, { useState, useEffect, useRef } from 'react';
import type { Matrix, MatrixColumn, MatrixRow, MatrixColumnType, DiscoveredStructure, WorksheetTemplate, Species, ProjectFile } from '../types';
import { 
    TelescopeIcon, LayoutGridIcon, MagicWandIcon, TableIcon, UploadIcon, 
    SparklesIcon, RefreshIcon, CheckIcon, SearchIcon, XIcon, FileSheetIcon, FilePdfIcon
} from './icons';
import BaseModal from './BaseModal';

const WizardStepper = ({ step }: { step: number }) => {
    let activeIdx = 0;
    if (step === 0) activeIdx = 0;
    else if (step === 4) activeIdx = 2; 
    else activeIdx = 1;

    const labels = ["Start", "Configure", "Create"];
    
    return (
        <div className="flex items-center justify-center mb-8 px-8">
            {labels.map((label, idx) => (
                <div key={idx} className="flex items-center">
                    <div className={`flex flex-col items-center gap-2 group`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                            idx <= activeIdx 
                            ? 'bg-weflora-teal text-white scale-110 shadow-md' 
                            : 'bg-slate-100 text-slate-400'
                        }`}>
                            {idx + 1}
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${
                            idx <= activeIdx ? 'text-weflora-teal' : 'text-slate-300'
                        }`}>{label}</span>
                    </div>
                    {idx < labels.length - 1 && (
                        <div className="flex items-center mx-2 mb-5">
                            <div className={`w-12 h-0.5 transition-colors duration-500 ${
                                idx < activeIdx ? 'bg-weflora-teal' : 'bg-slate-100'
                            }`} />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const WorksheetWizard: React.FC<{
    onClose: () => void;
    onCreate: (matrix: Matrix) => Promise<{ id: string; projectId?: string; parentId?: string } | null>;
    onDiscover: (files: File[]) => Promise<DiscoveredStructure[]>;
    onAnalyze: (files: File[], context?: string, columns?: MatrixColumn[]) => Promise<{ columns: MatrixColumn[], rows: any[] }>;
    onFileSave?: (file: ProjectFile) => void; // New prop for saving files
    templates?: WorksheetTemplate[];
    speciesList?: Species[];
    initialFile?: File | null;
}> = ({ onClose, onCreate, onDiscover, onAnalyze, onFileSave, templates = [], speciesList = [], initialFile }) => {
    const [step, setStep] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(0);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [discoveredStructures, setDiscoveredStructures] = useState<DiscoveredStructure[]>([]);
    const [templateSearch, setTemplateSearch] = useState('');
    
    // Schema Definition State
    const [selectedStructureId, setSelectedStructureId] = useState<string | null>(null);
    const [schemaColumns, setSchemaColumns] = useState<MatrixColumn[]>([]);
    const [sheetTitle, setSheetTitle] = useState('New Worksheet');
    
    // Extraction State
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractionResult, setExtractionResult] = useState<{ columns: MatrixColumn[], rows: any[] } | null>(null);
    
    // Species Selection State
    const [selectedSpeciesIds, setSelectedSpeciesIds] = useState<Set<string>>(new Set());
    const [speciesSearch, setSpeciesSearch] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (initialFile && step === 0) {
            startScanning(initialFile);
        }
    }, [initialFile]);

    const startScanning = async (file: File) => {
        setUploadedFile(file);
        setSheetTitle(file.name.split('.')[0]);
        setStep(2);
        setIsScanning(true);
        
        // Auto-save the file for traceability
        if (onFileSave) {
            const isPdf = file.name.toLowerCase().endsWith('.pdf');
            const newProjectFile: ProjectFile = {
                id: `wiz-file-${Date.now()}`,
                name: file.name,
                icon: isPdf ? FilePdfIcon : FileSheetIcon,
                file: file,
                size: `${(file.size / 1024).toFixed(1)} KB`,
                date: new Date().toLocaleDateString(),
                source: 'worksheet-input',
                category: 'Input Data',
                tags: ['worksheet-source', 'auto-saved']
            };
            onFileSave(newProjectFile);
        }

        try {
            const structures = await onDiscover([file]);
            setDiscoveredStructures(structures);
            
            if (structures.length > 0) {
                 handleStructureSelect(structures[0]);
            } else {
                setSchemaColumns([{ id: 'c1', title: 'Item Name', type: 'text', isPrimaryKey: true, width: 200 }]);
            }
        } catch (error) {
            console.error(error);
            setSchemaColumns([{ id: 'c1', title: 'Item Name', type: 'text', isPrimaryKey: true, width: 200 }]);
        } finally {
            setIsScanning(false);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            startScanning(file);
        }
    };

    const handleStructureSelect = (structure: DiscoveredStructure) => {
        setSelectedStructureId(structure.id);
        const cols: MatrixColumn[] = structure.suggestedColumns.map((title, i) => ({
            id: `sc-${i}`,
            title: title,
            type: 'text', 
            width: i === 0 ? 250 : 150,
            isPrimaryKey: i === 0 
        }));
        setSchemaColumns(cols);
    };

    const updateSchemaColumn = (id: string, updates: Partial<MatrixColumn>) => {
        setSchemaColumns(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    const addSchemaColumn = (type: MatrixColumnType = 'text') => {
        const newCol: MatrixColumn = {
            id: `sc-new-${Date.now()}`,
            title: type === 'ai' ? 'AI Insight' : 'New Column',
            type: type,
            width: 200,
            aiPrompt: type === 'ai' ? 'Analyze {Entity}...' : undefined
        };
        setSchemaColumns(prev => [...prev, newCol]);
    };

    const removeSchemaColumn = (id: string) => {
        setSchemaColumns(prev => prev.filter(c => c.id !== id));
    };

    const setPrimaryKey = (id: string) => {
        setSchemaColumns(prev => prev.map(c => ({
            ...c,
            isPrimaryKey: c.id === id
        })));
    };

    const handleExtract = async () => {
        if (!uploadedFile) return;
        setStep(3);
        setIsExtracting(true);
        try {
            const structure = discoveredStructures.find(s => s.id === selectedStructureId);
            const context = structure ? 
                `Extract entities matching this structure: "${structure.title}". Description: ${structure.description}.` : 
                "Extract the main list of entities.";
            
            const result = await onAnalyze([uploadedFile], context, schemaColumns);
            setExtractionResult(result);
            setStep(4);
        } catch (error) {
            console.error(error);
        } finally {
            setIsExtracting(false);
        }
    };

    const handleFinalCreate = async () => {
        if (!extractionResult) return;
        const newMatrix: Matrix = {
            id: `mtx-${Date.now()}`,
            title: sheetTitle,
            columns: extractionResult.columns,
            rows: extractionResult.rows
        };
        const created = await onCreate(newMatrix);
        if (!created) return;
        console.info('[create-flow] worksheet wizard', {
            kind: 'worksheet',
            withinProject: Boolean(created.projectId),
            projectId: created.projectId,
            matrixId: created.id,
            tabId: Boolean(created.projectId) ? created.id : undefined
        });
        onClose();
    };

    const handleCreateSpeciesSheet = async () => {
        const standardColumns: MatrixColumn[] = [
            { id: 'sc-1', title: 'Scientific Name', type: 'text', width: 220, isPrimaryKey: true },
            { id: 'sc-2', title: 'Common Name', type: 'text', width: 180 },
            { id: 'sc-3', title: 'Family', type: 'text', width: 150 },
            { id: 'sc-4', title: 'Mature Height (m)', type: 'number', width: 140 },
            { id: 'sc-5', title: 'Crown Spread (m)', type: 'number', width: 140 },
            { id: 'sc-6', title: 'Water Needs', type: 'ai', width: 200, aiPrompt: 'Rate the water needs for {Scientific Name} (Low/Medium/High)' },
            { id: 'sc-7', title: 'Soil Preference', type: 'ai', width: 250, aiPrompt: 'Describe soil preference for {Scientific Name}' }
        ];

        const selectedSpecies = speciesList.filter(s => selectedSpeciesIds.has(s.id));
        const rows: MatrixRow[] = selectedSpecies.map((s, i) => ({
            id: `s-row-${i}`,
            entityName: s.scientificName,
            linkedSpeciesId: s.id,
            cells: {
                'sc-1': { columnId: 'sc-1', value: s.scientificName },
                'sc-2': { columnId: 'sc-2', value: s.commonName },
                'sc-3': { columnId: 'sc-3', value: s.family },
                'sc-4': { columnId: 'sc-4', value: '' }, 
                'sc-5': { columnId: 'sc-5', value: '' },
                'sc-6': { columnId: 'sc-6', value: '', status: 'idle' },
                'sc-7': { columnId: 'sc-7', value: '', status: 'idle' }
            }
        }));

        const newMatrix: Matrix = {
            id: `mtx-species-${Date.now()}`,
            title: 'Species Comparison',
            columns: standardColumns,
            rows: rows
        };
        const created = await onCreate(newMatrix);
        if (!created) return;
        console.info('[create-flow] worksheet wizard', {
            kind: 'worksheet',
            withinProject: Boolean(created.projectId),
            projectId: created.projectId,
            matrixId: created.id,
            tabId: Boolean(created.projectId) ? created.id : undefined
        });
        onClose();
    };

    const renderStep0 = () => (
        <div className="grid grid-cols-2 gap-4 pt-2">
            <button onClick={() => { setStep(6); }} className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-xl hover:border-weflora-teal hover:shadow-md transition-all text-center group h-40">
                <div className="h-12 w-12 bg-weflora-mint/20 rounded-full flex items-center justify-center text-weflora-teal mb-3 group-hover:scale-110 transition-transform"><TelescopeIcon className="h-6 w-6" /></div>
                <div className="font-bold text-slate-900 mb-1">Compare Species</div>
                <div className="text-xs text-slate-500 px-4">Select trees from database & auto-generate columns.</div>
            </button>
            <button onClick={() => { setStep(1); }} className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-xl hover:border-weflora-teal hover:shadow-md transition-all text-center group h-40">
                <div className="h-12 w-12 bg-weflora-mint/20 rounded-full flex items-center justify-center text-weflora-teal mb-3 group-hover:scale-110 transition-transform"><LayoutGridIcon className="h-6 w-6" /></div>
                <div className="font-bold text-slate-900 mb-1">Import Document</div>
                <div className="text-xs text-slate-500 px-4">Extract structured data from PDF or Excel files.</div>
            </button>
            <button onClick={() => { setStep(5); }} className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-xl hover:border-weflora-teal hover:shadow-md transition-all text-center group h-40">
                <div className="h-12 w-12 bg-weflora-mint/20 rounded-full flex items-center justify-center text-weflora-teal mb-3 group-hover:scale-110 transition-transform"><MagicWandIcon className="h-6 w-6" /></div>
                <div className="font-bold text-slate-900 mb-1">Use Template</div>
                <div className="text-xs text-slate-500 px-4">Start with a pre-defined structure.</div>
            </button>
            <button onClick={async () => { const newMatrix: Matrix = { id: `mtx-${Date.now()}`, title: 'Untitled Worksheet', columns: [{id:'c1', title:'Column 1', type:'text', width: 200}], rows: [] }; const created = await onCreate(newMatrix); if (!created) return; console.info('[create-flow] worksheet wizard', { kind: 'worksheet', withinProject: Boolean(created.projectId), projectId: created.projectId, matrixId: created.id, tabId: Boolean(created.projectId) ? created.id : undefined }); onClose(); }} className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-xl hover:border-weflora-teal hover:shadow-md transition-all text-center group h-40">
                <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 mb-3 group-hover:scale-110 transition-transform"><TableIcon className="h-6 w-6" /></div>
                <div className="font-bold text-slate-900 mb-1">Empty Sheet</div>
                <div className="text-xs text-slate-500 px-4">Start from scratch with a blank grid.</div>
            </button>
        </div>
    );
    const renderStep1 = () => (
        <div className="space-y-4 h-[300px] flex flex-col justify-center">
             <div className="border-2 border-dashed border-slate-300 rounded-2xl p-10 hover:bg-slate-50 hover:border-weflora-teal cursor-pointer transition-colors flex flex-col items-center justify-center text-center bg-white flex-1" onClick={() => fileInputRef.current?.click()}>
                <div className="p-4 bg-weflora-mint/20 rounded-full mb-4"><UploadIcon className="h-8 w-8 text-weflora-teal" /></div>
                <div className="font-bold text-slate-700 text-sm">Click to upload document</div>
                <div className="text-xs text-slate-400 mt-1">PDF, Excel, CSV, or Word</div>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
        </div>
    );

    const renderStep2 = () => (
        <div className="flex flex-col h-[65vh] overflow-hidden space-y-4">
            {isScanning ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-10">
                    <SparklesIcon className="h-12 w-12 animate-spin text-weflora-teal mb-6" />
                    <p className="text-sm font-bold text-slate-900">Scanning document structure...</p>
                </div>
            ) : (
                <div className="flex flex-col md:flex-row gap-6 h-full min-h-0">
                    <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-100 pb-4 md:pb-0 md:pr-4 flex flex-col min-h-[150px] md:min-h-0">
                        <h4 className="text-xs font-bold text-slate-900 uppercase mb-3 tracking-widest">Detected Structures</h4>
                        <div className="space-y-2 overflow-y-auto flex-1 custom-scrollbar pr-2">
                            {discoveredStructures.length === 0 && <p className="text-sm text-slate-400 italic p-2">No structures found automatically.</p>}
                            {discoveredStructures.map(structure => (
                                <div key={structure.id} onClick={() => handleStructureSelect(structure)} className={`p-4 rounded-xl cursor-pointer transition-all ${selectedStructureId === structure.id ? 'bg-weflora-teal text-white shadow-lg' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                                    <div className="font-bold text-sm mb-1">{structure.title}</div>
                                    <div className={`text-xs line-clamp-2 ${selectedStructureId === structure.id ? 'text-weflora-mint-light' : 'text-slate-500'}`}>{structure.description}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Refine Schema</h4>
                            <div className="flex gap-2"><button onClick={() => addSchemaColumn('text')} className="text-[10px] px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold rounded transition-colors">+ Text</button><button onClick={() => addSchemaColumn('ai')} className="text-[10px] px-2 py-1 bg-weflora-teal/10 hover:bg-weflora-teal/20 text-weflora-dark font-bold rounded transition-colors flex items-center gap-1"><SparklesIcon className="h-3 w-3"/> + AI</button></div>
                        </div>
                        <div className="bg-slate-50 rounded-xl flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {schemaColumns.map((col, idx) => (
                                <div key={col.id} className="flex items-start gap-3 bg-white p-3 rounded-lg shadow-sm border border-transparent focus-within:border-slate-300 transition-colors">
                                     <div className="pt-3"><input type="radio" name="primaryKey" checked={!!col.isPrimaryKey} onChange={() => setPrimaryKey(col.id)} className="accent-weflora-teal cursor-pointer w-4 h-4" title="Set as Entity Name (Primary Key)" /></div>
                                     <div className="flex-1 space-y-2">
                                         <div className="flex gap-2"><input type="text" value={col.title} onChange={(e) => updateSchemaColumn(col.id, { title: e.target.value })} className="flex-1 text-sm font-bold text-slate-900 border-b border-transparent focus:border-slate-300 outline-none pb-1 bg-transparent placeholder-slate-300" placeholder="Column Name" /><select value={col.type} onChange={(e) => updateSchemaColumn(col.id, { type: e.target.value as MatrixColumnType })} className="text-xs bg-slate-100 rounded px-2 py-1 border-none outline-none text-slate-900 font-medium cursor-pointer hover:bg-slate-200"><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="select">Select</option><option value="ai">FloraGPT Gen</option></select></div>
                                         {col.type === 'ai' && <input type="text" value={col.aiPrompt || ''} onChange={(e) => updateSchemaColumn(col.id, { aiPrompt: e.target.value })} className="w-full text-xs bg-weflora-teal/10 text-weflora-dark border-0 rounded px-3 py-2 outline-none placeholder:text-weflora-teal/40" placeholder="AI Prompt: e.g. Analyze {Entity Name}..." />}
                                     </div>
                                     <button onClick={() => removeSchemaColumn(col.id)} className="text-slate-300 hover:text-weflora-red pt-2 transition-colors"><XIcon className="h-4 w-4" /></button>
                                </div>
                            ))}
                            {schemaColumns.length === 0 && <div className="text-center py-10 text-slate-400 text-sm">No columns defined.</div>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
    const renderStep3 = () => (
         <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-10 h-[65vh]">
            <RefreshIcon className="h-12 w-12 animate-spin text-weflora-teal mb-6" />
            <p className="text-lg font-bold text-slate-900 mb-2">FloraGPT Extracting Entities...</p>
            <div className="text-sm text-slate-500 space-y-1 text-center"><p>Analyzing document...</p><p>Applying schema...</p><p>Formatting data...</p></div>
        </div>
    );
    const renderStep4 = () => (
        <div className="flex flex-col h-[65vh] overflow-hidden space-y-4">
            <div><label className="block text-xs font-bold text-slate-900 uppercase tracking-widest mb-2">Worksheet Name</label><input type="text" value={sheetTitle} onChange={(e) => setSheetTitle(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border-0 rounded-xl text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-weflora-teal transition-all outline-none"/></div>
            <div className="flex-1 border border-slate-200 rounded-xl bg-slate-50 overflow-hidden flex flex-col min-h-0">
                <div className="bg-white px-4 py-3 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase flex justify-between items-center"><span>Preview</span><span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-900">{extractionResult?.rows.length} Entities</span></div>
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10"><tr><th className="p-3 font-bold text-slate-700 bg-slate-50 border-r border-slate-100 w-10 text-center">#</th>{extractionResult?.columns.map(col => <th key={col.id} className="p-3 font-medium text-slate-600 border-r border-slate-100 last:border-0 whitespace-nowrap bg-slate-50">{col.title}</th>)}</tr></thead>
                        <tbody>
                            {extractionResult?.rows.slice(0, 8).map((row, i) => (
                                <tr key={i} className="border-b border-slate-100 bg-white hover:bg-slate-50">
                                    <td className="p-3 text-slate-400 text-xs text-center border-r border-slate-100">{i+1}</td>
                                    {extractionResult?.columns.map(col => <td key={col.id} className="p-3 border-r border-slate-100 last:border-0 text-slate-900 truncate max-w-[150px]">{row.cells[col.id]?.value}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
    const renderStep5 = () => {
        const filteredTemplates = templates.filter(t => t.title.toLowerCase().includes(templateSearch.toLowerCase()) || t.description.toLowerCase().includes(templateSearch.toLowerCase()));
        return (
            <div className="flex flex-col h-[60vh]">
                <div className="relative mb-4"><SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><input type="text" autoFocus placeholder="Search templates..." value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)} className="w-full pl-9 pr-4 py-3 bg-slate-50 border-0 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-weflora-teal transition-all outline-none"/></div>
                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar p-1">
                    {filteredTemplates.length === 0 && <div className="text-center py-10 text-slate-400"><MagicWandIcon className="h-8 w-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No templates found.</p></div>}
                    {filteredTemplates.map(template => (
                         <button key={template.id} onClick={() => { const newMatrix: Matrix = { id: `mtx-${Date.now()}`, title: template.title, description: template.description, columns: template.columns, rows: template.rows || [] }; onCreate(newMatrix); onClose(); }} className="w-full flex flex-col items-start p-4 bg-white border border-slate-100 rounded-xl hover:border-weflora-teal hover:shadow-md transition-all text-left group">
                            <div className="flex items-center justify-between w-full mb-1"><span className="font-bold text-slate-900 text-sm group-hover:text-weflora-dark transition-colors">{template.title}</span><span className="text-[10px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full">{template.usageCount} uses</span></div>
                            <p className="text-xs text-slate-500 line-clamp-2 mb-2">{template.description}</p>
                            <div className="flex flex-wrap gap-1">{template.tags.slice(0, 3).map(tag => <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded">#{tag}</span>)}</div>
                        </button>
                    ))}
                </div>
            </div>
        );
    };
    const renderStep6 = () => {
        const filteredSpecies = speciesList.filter(s => s.scientificName.toLowerCase().includes(speciesSearch.toLowerCase()) || s.commonName.toLowerCase().includes(speciesSearch.toLowerCase()));
        return (
            <div className="flex h-[500px] border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="w-5/12 bg-slate-50 border-r border-slate-200 flex flex-col">
                    <div className="p-4 border-b border-slate-200 bg-slate-100"><div className="relative"><SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" /><input type="text" autoFocus placeholder="Search species..." value={speciesSearch} onChange={(e) => setSpeciesSearch(e.target.value)} className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-1 focus:ring-weflora-teal focus:border-weflora-teal outline-none"/></div></div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {filteredSpecies.map(species => {
                            const isSelected = selectedSpeciesIds.has(species.id);
                            return (
                                <button key={species.id} onClick={() => { const next = new Set(selectedSpeciesIds); if (next.has(species.id)) next.delete(species.id); else next.add(species.id); setSelectedSpeciesIds(next); }} className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left group ${isSelected ? 'bg-weflora-mint/10 border-weflora-teal text-weflora-dark' : 'bg-white border-transparent hover:border-slate-200 hover:shadow-sm text-slate-700'}`}>
                                    <div><div className="font-bold text-sm text-slate-900">{species.scientificName}</div><div className="text-xs opacity-70 text-slate-600">{species.commonName}</div></div>
                                    <div className={`h-5 w-5 rounded-full border flex items-center justify-center transition-colors ${isSelected ? 'bg-weflora-teal border-weflora-teal text-white' : 'border-slate-300 bg-white group-hover:border-weflora-teal'}`}>{isSelected && <CheckIcon className="h-3 w-3" />}</div>
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="w-7/12 bg-white flex flex-col">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white"><h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Selected Items</h4><span className="text-xs font-bold bg-weflora-mint/20 text-weflora-dark px-2 py-0.5 rounded-full">{selectedSpeciesIds.size}</span></div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {Array.from(selectedSpeciesIds).map(id => {
                            const sp = speciesList.find(s => s.id === id);
                            if (!sp) return null;
                            return (
                                <div key={id} className="flex items-center justify-between text-sm bg-slate-50 p-3 rounded-lg border border-slate-100 animate-fadeIn">
                                    <div className="flex items-center gap-3"><div className="h-8 w-8 bg-white rounded flex items-center justify-center border border-slate-200 text-weflora-teal font-bold text-xs">{sp.scientificName.charAt(0)}</div><div><div className="font-medium text-slate-900">{sp.scientificName}</div><div className="text-xs text-slate-500">{sp.commonName}</div></div></div>
                                    <button onClick={() => { const next = new Set(selectedSpeciesIds); next.delete(id); setSelectedSpeciesIds(next); }} className="text-slate-400 hover:text-weflora-red p-2 hover:bg-white rounded transition-colors"><XIcon className="h-4 w-4" /></button>
                                </div>
                            );
                        })}
                        {selectedSpeciesIds.size === 0 && <div className="flex flex-col items-center justify-center h-full text-slate-300"><TelescopeIcon className="h-10 w-10 mb-2 opacity-20" /><p className="text-sm">Select species from the left to compare.</p></div>}
                    </div>
                </div>
            </div>
        );
    };

    const renderFooter = () => (
        <>
            {step > 0 && step !== 3 ? <button onClick={() => setStep(s => (s === 5 || s === 6 ? 0 : Math.max(0, s - 1)) as any)} className="mr-auto px-6 py-3 text-slate-500 hover:text-slate-800 text-sm font-bold transition-colors">Back</button> : <div className="mr-auto" />}
            {step === 2 && <button onClick={handleExtract} disabled={schemaColumns.length === 0} className="px-8 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black disabled:opacity-50 shadow-lg transition-all flex items-center gap-2"><SparklesIcon className="h-4 w-4" />Extract Data</button>}
            {step === 4 && <button onClick={handleFinalCreate} className="px-8 py-3 bg-weflora-teal text-white rounded-xl text-sm font-bold hover:bg-weflora-dark shadow-lg shadow-weflora-mint/50 transition-all">Create Worksheet</button>}
            {step === 6 && <button onClick={handleCreateSpeciesSheet} disabled={selectedSpeciesIds.size === 0} className="px-8 py-3 bg-weflora-teal text-white rounded-xl text-sm font-bold hover:bg-weflora-dark shadow-lg shadow-weflora-mint/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed">Create Worksheet ({selectedSpeciesIds.size})</button>}
        </>
    );

    return (
        <BaseModal isOpen={true} onClose={onClose} title="Build Worksheet" size={(step === 2 || step === 3 || step === 4 || step === 6) ? '2xl' : 'lg'} footer={renderFooter()}>
            <div className="h-full"><WizardStepper step={step} />{step === 0 && renderStep0()}{step === 1 && renderStep1()}{step === 2 && renderStep2()}{step === 3 && renderStep3()}{step === 4 && renderStep4()}{step === 5 && renderStep5()}{step === 6 && renderStep6()}</div>
        </BaseModal>
    );
};

export default WorksheetWizard;
