
import React, { useState } from 'react';
import { 
    SparklesIcon, XIcon, CheckCircleIcon, RefreshIcon, 
    CopyIcon, TrashIcon, SendIcon, LightningBoltIcon, TelescopeIcon
} from './icons';
import { aiService } from '../services/aiService';

interface WritingAssistantPanelProps {
    content: string;
    onApply: (newText: string) => void;
    onClose: () => void;
}

const WritingAssistantPanel: React.FC<WritingAssistantPanelProps> = ({ content, onApply, onClose }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [customPrompt, setCustomPrompt] = useState('');
    const [mode, setMode] = useState<'menu' | 'result'>('menu');

    const handleRefine = async (instruction: string) => {
        setIsLoading(true);
        setMode('result');
        setResult(null);
        try {
            const refined = await aiService.refineText(content, instruction);
            setResult(refined);
        } catch (e) {
            setResult("An error occurred while refining the text.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCustomSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (customPrompt.trim()) {
            handleRefine(customPrompt);
        }
    };

    const handleApply = () => {
        if (result) {
            onApply(result);
            onClose();
        }
    };

    const handleCopy = () => {
        if (result) {
            navigator.clipboard.writeText(result);
        }
    };

    const quickActions = [
        { label: 'Fix Grammar', instruction: 'Correct all grammar, spelling, and punctuation errors.', icon: CheckCircleIcon },
        { label: 'Professional', instruction: 'Rewrite to sound more professional, objective, and authoritative.', icon: LightningBoltIcon },
        { label: 'Simplify', instruction: 'Simplify the language to make it easier to read (lower reading grade level).', icon: RefreshIcon },
        { label: 'Enhance Findings', instruction: 'Strengthen the presentation of key findings, making them more impactful and evidence-based.', icon: TelescopeIcon },
        { label: 'Shorten', instruction: 'Make the text concise and remove redundancy without losing key information.', icon: TrashIcon },
        { label: 'Expand', instruction: 'Elaborate on the key points and provide more detail.', icon: SparklesIcon }
    ];

    return (
        <div className="flex flex-col h-full bg-slate-50 border-l border-slate-200">
            <header className="p-4 border-b border-slate-200 bg-white flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                    <SparklesIcon className="h-5 w-5 text-weflora-teal" />
                    Writing Assistant
                </div>
                <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600">
                    <XIcon className="h-5 w-5" />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                
                {mode === 'menu' && (
                    <div className="space-y-6 animate-fadeIn">
                        {/* Quick Actions */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Quick Actions</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {quickActions.map((action) => (
                                    <button
                                        key={action.label}
                                        onClick={() => handleRefine(action.instruction)}
                                        className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 rounded-xl hover:border-weflora-teal hover:bg-weflora-mint/10 transition-all group shadow-sm hover:shadow-md"
                                    >
                                        <action.icon className="h-5 w-5 mb-2 text-slate-400 group-hover:text-weflora-teal transition-colors" />
                                        <span className="text-xs font-medium text-slate-700 group-hover:text-weflora-dark">{action.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom Instruction */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Custom Instruction</h3>
                            <form onSubmit={handleCustomSubmit} className="relative">
                                <input
                                    type="text"
                                    value={customPrompt}
                                    onChange={(e) => setCustomPrompt(e.target.value)}
                                    placeholder="e.g. Translate to Dutch..."
                                    className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal shadow-sm"
                                />
                                <button 
                                    type="submit" 
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-weflora-mint/20 text-weflora-dark rounded-lg hover:bg-weflora-mint/40 transition-colors"
                                    disabled={!customPrompt.trim()}
                                >
                                    <SendIcon className="h-3.5 w-3.5" />
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {mode === 'result' && (
                    <div className="h-full flex flex-col animate-slideUp">
                        <div className="flex-1 flex flex-col">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-xs font-bold text-slate-500 uppercase">Suggested Edit</h3>
                                {isLoading && <div className="text-[10px] text-weflora-teal font-bold animate-pulse">Processing...</div>}
                            </div>
                            
                            <div className={`flex-1 bg-white border border-slate-200 rounded-xl p-4 text-sm leading-relaxed text-slate-800 shadow-sm overflow-y-auto min-h-[200px] ${isLoading ? 'opacity-50' : ''}`}>
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                                        <RefreshIcon className="h-8 w-8 animate-spin text-weflora-teal" />
                                        <span>Refining your text...</span>
                                    </div>
                                ) : (
                                    result
                                )}
                            </div>
                        </div>

                        {!isLoading && (
                            <div className="mt-4 space-y-3">
                                <button 
                                    onClick={handleApply}
                                    className="w-full py-2.5 bg-weflora-teal text-white rounded-xl text-sm font-bold hover:bg-weflora-dark shadow-md transition-all flex items-center justify-center gap-2"
                                >
                                    <CheckCircleIcon className="h-4 w-4" />
                                    Replace Original
                                </button>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleCopy}
                                        className="flex-1 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <CopyIcon className="h-3.5 w-3.5" /> Copy
                                    </button>
                                    <button 
                                        onClick={() => setMode('menu')}
                                        className="flex-1 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-weflora-red/10 hover:text-weflora-red hover:border-weflora-red/20 transition-colors"
                                    >
                                        Discard
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WritingAssistantPanel;
