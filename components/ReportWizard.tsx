
import React, { useState, useEffect } from 'react';
import type { Report, ReportTemplate } from '../types';
import { 
    FileTextIcon, UploadIcon, MagicWandIcon, PlusIcon, 
    RefreshIcon, SparklesIcon, SearchIcon, CheckCircleIcon
} from './icons';
import BaseModal from './BaseModal';
import { aiService } from '../services/aiService';
import FilePicker from './FilePicker';
import { FILE_VALIDATION } from '../services/fileService';

interface ReportWizardProps {
    onClose: () => void;
    onCreate: (report: Report) => Promise<{ id: string; projectId?: string; parentId?: string } | null>;
    templates: ReportTemplate[];
    initialFile?: File | null;
}

const ReportWizard: React.FC<ReportWizardProps> = ({ onClose, onCreate, templates, initialFile }) => {
    const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
    const [mode, setMode] = useState<'blank' | 'import' | 'template'>('blank');
    
    // Form Data
    const [title, setTitle] = useState('New Report');
    const [content, setContent] = useState('');
    const [tags, setTags] = useState('');
    
    // Import State
    const [importFile, setImportFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    
    // Template State
    const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
    const [templateSearch, setTemplateSearch] = useState('');

    useEffect(() => {
        if (initialFile) {
            setMode('import');
            setImportFile(initialFile);
            setStep(1); // Skip to analyze
            analyzeFile(initialFile);
        }
    }, [initialFile]);

    // --- Actions ---

    const handleFileChange = (files: File[]) => {
        if (files.length > 0) {
            const file = files[0];
            setMode('import');
            setImportFile(file);
            setStep(1);
            analyzeFile(file);
        }
    };

    const analyzeFile = async (file: File) => {
        setIsAnalyzing(true);
        try {
            // Simulate AI analysis or actually run it if needed
            // For now, we'll generate a title and some dummy structure
            const generatedTitle = await aiService.generateTitle(file.name, 'report');
            setTitle(generatedTitle);
            
            // Mock extraction
            setTimeout(() => {
                setContent(`# Analysis of ${file.name}\n\n## Executive Summary\n[AI extracted summary would appear here]\n\n## Key Findings\n- Point 1\n- Point 2\n\n## Recommendations\n...`);
                setIsAnalyzing(false);
                setStep(2); // Go to review
            }, 1500);
        } catch (e) {
            console.error(e);
            setIsAnalyzing(false);
        }
    };

    const selectTemplate = (tpl: ReportTemplate) => {
        setMode('template');
        setSelectedTemplate(tpl);
        setTitle(tpl.title);
        setContent(tpl.content);
        setStep(2); // Go to finalize
    };

    const handleBlank = () => {
        setMode('blank');
        setTitle('Untitled Report');
        setContent('');
        setStep(2); // Go to finalize
    };

    const handleCreate = async () => {
        const newReport: Report = {
            id: `rep-${Date.now()}`,
            title: title || 'Untitled Report',
            content: content,
            lastModified: new Date().toLocaleDateString(),
            tags: tags.split(',').map(t => t.trim()).filter(Boolean)
        };
        const created = await onCreate(newReport);
        if (!created) return;
        console.info('[create-flow] report wizard', {
            kind: 'report',
            withinProject: Boolean(created.projectId),
            projectId: created.projectId,
            reportId: created.id,
            tabId: Boolean(created.projectId) ? created.id : undefined
        });
    };

    // --- Renderers ---

    const renderOptionCards = () => (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <FilePicker accept={FILE_VALIDATION.ACCEPTED_FILE_TYPES} onPick={handleFileChange}>
                {({ open }) => (
                    <button 
                        onClick={open}
                        className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-xl hover:border-weflora-teal hover:shadow-md transition-all text-center group h-48"
                    >
                        <div className="h-12 w-12 bg-weflora-mint/20 rounded-full flex items-center justify-center text-weflora-teal mb-3 group-hover:scale-110 transition-transform">
                            <UploadIcon className="h-6 w-6" />
                        </div>
                        <div className="font-bold text-slate-900 mb-1">Import Document</div>
                        <div className="text-xs text-slate-500 px-2">Analyze a PDF or Doc to generate a report draft.</div>
                    </button>
                )}
            </FilePicker>

            <button 
                onClick={() => setStep(1)} 
                className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-xl hover:border-weflora-teal hover:shadow-md transition-all text-center group h-48"
            >
                <div className="h-12 w-12 bg-weflora-mint/20 rounded-full flex items-center justify-center text-weflora-teal mb-3 group-hover:scale-110 transition-transform">
                    <MagicWandIcon className="h-6 w-6" />
                </div>
                <div className="font-bold text-slate-900 mb-1">Use Template</div>
                <div className="text-xs text-slate-500 px-2">Start from a standard structure.</div>
            </button>

            <button 
                onClick={handleBlank}
                className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-xl hover:border-weflora-teal hover:shadow-md transition-all text-center group h-48"
            >
                <div className="h-12 w-12 bg-weflora-mint/20 rounded-full flex items-center justify-center text-weflora-teal mb-3 group-hover:scale-110 transition-transform">
                    <PlusIcon className="h-6 w-6" />
                </div>
                <div className="font-bold text-slate-900 mb-1">Blank Report</div>
                <div className="text-xs text-slate-500 px-2">Start from scratch with an empty editor.</div>
            </button>
        </div>
    );

    const renderImportAnalysis = () => (
        <div className="flex flex-col items-center justify-center h-64 text-center">
            {isAnalyzing ? (
                <>
                    <RefreshIcon className="h-12 w-12 text-weflora-teal animate-spin mb-4" />
                    <h3 className="text-lg font-bold text-slate-800">Analyzing Document...</h3>
                    <p className="text-sm text-slate-500 mt-2">Extracting key sections and summary.</p>
                </>
            ) : (
                <>
                    <CheckCircleIcon className="h-12 w-12 text-weflora-success mb-4" />
                    <h3 className="text-lg font-bold text-slate-800">Ready to Draft</h3>
                    <p className="text-sm text-slate-500 mt-2">Content extracted from {importFile?.name}</p>
                </>
            )}
        </div>
    );

    const renderTemplateSelection = () => {
        const filtered = templates.filter(t => t.title.toLowerCase().includes(templateSearch.toLowerCase()));
        return (
            <div className="flex flex-col h-[400px]">
                <div className="relative mb-4">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input 
                        type="text" 
                        value={templateSearch} 
                        onChange={(e) => setTemplateSearch(e.target.value)} 
                        placeholder="Search templates..." 
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border-0 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-weflora-teal"
                        autoFocus
                    />
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar p-1">
                    {filtered.map(t => (
                        <button 
                            key={t.id} 
                            onClick={() => selectTemplate(t)}
                            className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-weflora-teal hover:shadow-sm transition-all group"
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className="font-bold text-slate-800 group-hover:text-weflora-dark">{t.title}</span>
                                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{t.usageCount} uses</span>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-2">{t.description}</p>
                        </button>
                    ))}
                    {filtered.length === 0 && <div className="text-center py-10 text-slate-400">No templates found.</div>}
                </div>
            </div>
        );
    };

    const renderFinalize = () => (
        <div className="space-y-6 pt-2">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Report Title</label>
                <input 
                    type="text" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-weflora-teal outline-none transition-all"
                    autoFocus
                />
            </div>
            
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tags (comma separated)</label>
                <input 
                    type="text" 
                    value={tags} 
                    onChange={(e) => setTags(e.target.value)} 
                    placeholder="draft, q3, strategy"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-weflora-teal transition-all"
                />
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-500 uppercase">
                    <FileTextIcon className="h-4 w-4" />
                    Initial Content Preview
                </div>
                <div className="text-xs text-slate-600 font-mono line-clamp-6 bg-white p-3 rounded border border-slate-200">
                    {content || (
                        <span className="italic text-slate-400">Empty report...</span>
                    )}
                </div>
            </div>
        </div>
    );

    // --- Wizard Router ---
    let contentNode = renderOptionCards();
    let titleText = "Draft Report";
    let size: 'md' | 'lg' | '2xl' = 'lg';

    if (step === 1) {
        if (mode === 'import') {
            contentNode = renderImportAnalysis();
            titleText = "Analyzing Document";
        } else {
            contentNode = renderTemplateSelection();
            titleText = "Select Template";
        }
    } else if (step === 2) {
        contentNode = renderFinalize();
        titleText = "Finalize Report";
        size = 'md';
    }

    const renderFooter = () => (
        <div className="flex justify-between w-full">
            {step > 0 ? (
                <button 
                    onClick={() => {
                        if (step === 1 && mode === 'import') { setStep(0); setMode('blank'); }
                        else if (step === 1) setStep(0);
                        else if (step === 2) setStep(mode === 'template' ? 1 : 0);
                    }}
                    className="px-4 py-2 text-slate-500 hover:text-slate-800 text-sm font-medium transition-colors"
                >
                    Back
                </button>
            ) : <div />}
            
            {step === 2 && (
                <button 
                    onClick={handleCreate}
                    className="px-6 py-2 bg-weflora-teal text-white rounded-lg hover:bg-weflora-dark font-bold text-sm shadow-md transition-all flex items-center gap-2"
                >
                    <PlusIcon className="h-4 w-4" />
                    Create Report
                </button>
            )}
        </div>
    );

    return (
        <BaseModal 
            isOpen={true} 
            onClose={onClose} 
            title={titleText} 
            size={size}
            footer={renderFooter()}
        >
            {contentNode}
        </BaseModal>
    );
};

export default ReportWizard;
