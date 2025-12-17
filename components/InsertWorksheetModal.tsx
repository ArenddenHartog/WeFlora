
import React, { useState, useMemo } from 'react';
import type { Matrix, MatrixColumn } from '../types';
import BaseModal from './BaseModal';
import { 
    TableIcon, ListIcon, FileTextIcon, ArrowUpIcon, CheckIcon, 
    SparklesIcon, RefreshIcon, LayoutGridIcon, ChevronRightIcon
} from './icons';
import { aiService } from '../services/aiService';

interface InsertWorksheetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onInsert: (text: string) => void;
    matrices: Matrix[];
}

type OutputMode = 'table' | 'narrative' | 'list' | 'comparison';

const InsertWorksheetModal: React.FC<InsertWorksheetModalProps> = ({ isOpen, onClose, onInsert, matrices }) => {
    const [step, setStep] = useState<1 | 2>(1);
    
    // Step 1 State: Source
    const [selectedMatrixId, setSelectedMatrixId] = useState<string>('');
    const [selectedColumnIds, setSelectedColumnIds] = useState<Set<string>>(new Set());
    
    // Step 2 State: Format
    const [mode, setMode] = useState<OutputMode>('table');
    const [prompt, setPrompt] = useState('');
    const [secondMatrixId, setSecondMatrixId] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Derived state
    const selectedMatrix = matrices.find(m => m.id === selectedMatrixId);
    
    // Auto-select first matrix and all columns on mount/change if none selected
    useMemo(() => {
        if (!selectedMatrixId && matrices.length > 0) {
            setSelectedMatrixId(matrices[0].id);
        }
    }, [matrices]);

    useMemo(() => {
        if (selectedMatrix) {
            // Default to all columns when a matrix is picked
            setSelectedColumnIds(new Set(selectedMatrix.columns.map(c => c.id)));
        }
    }, [selectedMatrixId]);

    const toggleColumn = (id: string) => {
        const next = new Set(selectedColumnIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedColumnIds(next);
    };

    const toggleAllColumns = () => {
        if (!selectedMatrix) return;
        if (selectedColumnIds.size === selectedMatrix.columns.length) {
            setSelectedColumnIds(new Set());
        } else {
            setSelectedColumnIds(new Set(selectedMatrix.columns.map(c => c.id)));
        }
    };

    const getMatrixDataAsString = (matrix: Matrix) => {
        const cols = matrix.columns.filter(c => selectedColumnIds.has(c.id));
        const data = matrix.rows.map(r => {
            const rowObj: any = {};
            cols.forEach(c => {
                rowObj[c.title] = r.cells[c.id]?.value || '';
            });
            return rowObj;
        });
        return JSON.stringify(data, null, 2);
    };

    const handleInsert = async () => {
        if (!selectedMatrix) return;

        setIsGenerating(true);
        try {
            let outputText = '';

            // Mode 1: Table (Client-side generation for speed/reliability)
            if (mode === 'table') {
                const cols = selectedMatrix.columns.filter(c => selectedColumnIds.has(c.id));
                const header = `| ${cols.map(c => c.title).join(' | ')} |`;
                const separator = `| ${cols.map(() => '---').join(' | ')} |`;
                const rows = selectedMatrix.rows.map(r => {
                    return `| ${cols.map(c => (r.cells[c.id]?.value || '').toString().replace(/\n/g, ' ')).join(' | ')} |`;
                }).join('\n');
                
                outputText = `\n\n${header}\n${separator}\n${rows}\n\n> Source: *${selectedMatrix.title}*\n`;
            } 
            // Modes 2-4: AI Generation
            else {
                const dataContext = getMatrixDataAsString(selectedMatrix);
                
                let comparisonContext = "";
                if (mode === 'comparison' && secondMatrixId) {
                    const matrix2 = matrices.find(m => m.id === secondMatrixId);
                    if (matrix2) {
                        const data2 = matrix2.rows.map(r => {
                            const rowObj: any = {};
                            matrix2.columns.forEach(c => rowObj[c.title] = r.cells[c.id]?.value || '');
                            return rowObj;
                        });
                        comparisonContext = `\n\nDATASET B (${matrix2.title}):\n${JSON.stringify(data2, null, 2)}`;
                    }
                }

                const fullContext = `DATASET A (${selectedMatrix.title}):\n${dataContext}${comparisonContext}`;
                
                const response = await aiService.generateReportContent(fullContext, mode, prompt);
                outputText = `\n\n> **FloraGPT Generation:** ${mode.charAt(0).toUpperCase() + mode.slice(1)} based on *${selectedMatrix.title}*\n\n${response}\n`;
            }

            onInsert(outputText);
            onClose();
        } catch (e) {
            console.error(e);
            alert("Failed to generate content.");
        } finally {
            setIsGenerating(false);
        }
    };

    const renderStep1 = () => (
        <div className="flex flex-col h-[400px]">
            <div className="mb-6">
                <label className="block text-xs font-bold text-slate-900 mb-2 uppercase tracking-wide">Select Source Worksheet</label>
                <select 
                    value={selectedMatrixId} 
                    onChange={(e) => setSelectedMatrixId(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-weflora-teal shadow-sm"
                >
                    <option value="" disabled>Select a sheet...</option>
                    {matrices.map(m => (
                        <option key={m.id} value={m.id} className="text-slate-900">{m.title}</option>
                    ))}
                </select>
            </div>

            {selectedMatrix && (
                <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold text-slate-900 uppercase tracking-wide">Columns to Include</label>
                        <button onClick={toggleAllColumns} className="text-[10px] text-weflora-teal hover:underline font-bold">Toggle All</button>
                    </div>
                    <div className="flex-1 bg-white border border-slate-200 rounded-xl p-3 overflow-y-auto custom-scrollbar shadow-inner">
                        <div className="space-y-1">
                            {selectedMatrix.columns.map(col => (
                                <label key={col.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer text-sm transition-colors border border-transparent hover:border-slate-100">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedColumnIds.has(col.id)} 
                                        onChange={() => toggleColumn(col.id)}
                                        className="rounded border-slate-300 text-weflora-teal focus:ring-weflora-teal w-4 h-4"
                                    />
                                    <span className="truncate text-slate-700 font-medium">{col.title}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="text-xs text-slate-400 mt-2 text-right">
                        {selectedMatrix.rows.length} rows selected
                    </div>
                </div>
            )}
        </div>
    );

    const renderStep2 = () => (
        <div className="flex flex-col h-[400px]">
            <div className="mb-6">
                <label className="block text-xs font-bold text-slate-900 mb-3 uppercase tracking-wide">Select Output Format</label>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => setMode('table')}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${mode === 'table' ? 'bg-weflora-mint/20 border-weflora-teal text-weflora-teal-dark' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                    >
                        <TableIcon className="h-5 w-5 mb-1" />
                        <span className="text-xs font-bold">Raw Table</span>
                    </button>
                    <button 
                        onClick={() => setMode('narrative')}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${mode === 'narrative' ? 'bg-weflora-mint/20 border-weflora-teal text-weflora-teal-dark' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                    >
                        <FileTextIcon className="h-5 w-5 mb-1" />
                        <span className="text-xs font-bold">Narrative</span>
                    </button>
                    <button 
                        onClick={() => setMode('list')}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${mode === 'list' ? 'bg-weflora-mint/20 border-weflora-teal text-weflora-teal-dark' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                    >
                        <ListIcon className="h-5 w-5 mb-1" />
                        <span className="text-xs font-bold">Spec List</span>
                    </button>
                    <button 
                        onClick={() => setMode('comparison')}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${mode === 'comparison' ? 'bg-weflora-mint/20 border-weflora-teal text-weflora-teal-dark' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                    >
                        <LayoutGridIcon className="h-5 w-5 mb-1" />
                        <span className="text-xs font-bold">Comparison</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
                {mode === 'table' && (
                    <div className="flex-1 flex items-center justify-center text-sm text-slate-500 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <p>Will insert a standard Markdown table with selected data.</p>
                    </div>
                )}

                {mode === 'comparison' && (
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-slate-900 mb-2 uppercase tracking-wide">Compare against...</label>
                        <select 
                            value={secondMatrixId} 
                            onChange={(e) => setSecondMatrixId(e.target.value)}
                            className="w-full p-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-weflora-teal shadow-sm"
                        >
                            <option value="" disabled>Select second worksheet...</option>
                            {matrices.filter(m => m.id !== selectedMatrixId).map(m => (
                                <option key={m.id} value={m.id} className="text-slate-900">{m.title}</option>
                            ))}
                        </select>
                    </div>
                )}

                {mode !== 'table' && (
                    <div className="flex-1 flex flex-col">
                        <label className="block text-xs font-bold text-slate-900 mb-2 uppercase tracking-wide flex justify-between">
                            <span>AI Instructions</span>
                            <SparklesIcon className="h-3 w-3 text-weflora-teal" />
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={
                                mode === 'narrative' ? "E.g., Summarize the design intent and key benefits..." :
                                mode === 'list' ? "E.g., Format as a planting specification annex for contractors..." :
                                "E.g., Compare costs and biodiversity metrics between the two options..."
                            }
                            className="w-full flex-1 p-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-weflora-teal resize-none shadow-sm placeholder:text-slate-400"
                        />
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title="Insert Worksheet Data"
            subtitle={step === 1 ? "Step 1: Select Data Source" : "Step 2: Configure Output"}
            size="lg"
            footer={
                <div className="flex justify-between w-full">
                    {step === 1 ? (
                        <>
                            <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors">
                                Cancel
                            </button>
                            <button 
                                onClick={() => setStep(2)} 
                                disabled={!selectedMatrix || selectedColumnIds.size === 0}
                                className="flex items-center gap-2 px-6 py-2 bg-weflora-teal text-white rounded-lg hover:bg-weflora-teal-dark font-bold text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next <ChevronRightIcon className="h-3 w-3" />
                            </button>
                        </>
                    ) : (
                        <>
                            <button 
                                onClick={() => setStep(1)} 
                                disabled={isGenerating}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                            >
                                Back
                            </button>
                            <button 
                                onClick={handleInsert} 
                                disabled={isGenerating}
                                className="flex items-center gap-2 px-6 py-2 bg-weflora-teal text-white rounded-lg hover:bg-weflora-teal-dark font-bold text-sm shadow-sm transition-colors disabled:opacity-50"
                            >
                                {isGenerating ? <RefreshIcon className="h-4 w-4 animate-spin" /> : <ArrowUpIcon className="h-4 w-4 rotate-90" />}
                                {isGenerating ? 'Generating...' : 'Insert'}
                            </button>
                        </>
                    )}
                </div>
            }
        >
            <div className="px-1 py-2">
                {step === 1 ? renderStep1() : renderStep2()}
            </div>
        </BaseModal>
    );
};

export default InsertWorksheetModal;
