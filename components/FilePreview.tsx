
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ProjectFile, KnowledgeItem } from '../types';
import { 
    FilePdfIcon, FileSheetIcon, FileCodeIcon, BookIcon, DownloadIcon, 
    XIcon, SparklesIcon, CalendarIcon, UserCircleIcon, DatabaseIcon, TagIcon, EyeIcon,
    SearchIcon
} from './icons';

interface FilePreviewProps {
    item: ProjectFile | KnowledgeItem;
    onClose: () => void;
    onAskAI: (item: ProjectFile | KnowledgeItem) => void;
    verificationContext?: {
        snippet?: string;
        page?: number;
    } | null;
}

const FilePreview: React.FC<FilePreviewProps> = ({ item, onClose, onAskAI, verificationContext }) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [fileType, setFileType] = useState<string>('');

    const isKnowledgeItem = (i: ProjectFile | KnowledgeItem): i is KnowledgeItem => 'category' in i;
    
    useEffect(() => {
        if ('file' in item && item.file) {
            const url = URL.createObjectURL(item.file);
            setPreviewUrl(url);
            setFileType(item.file.type);
            return () => URL.revokeObjectURL(url);
        }
        return undefined;
    }, [item]);

    const getIcon = (className = "h-10 w-10") => {
        const name = isKnowledgeItem(item) ? item.title : item.name;
        if (name.endsWith('.pdf')) return <FilePdfIcon className={`${className} text-weflora-red`} />;
        if (name.endsWith('.xlsx')) return <FileSheetIcon className={`${className} text-weflora-success`} />;
        if (name.endsWith('.docx')) return <BookIcon className={`${className} text-weflora-teal`} />;
        return <FileCodeIcon className={`${className} text-slate-500`} />;
    };

    const name = isKnowledgeItem(item) ? item.title : item.name;
    const size = isKnowledgeItem(item) ? item.size : item.size || 'Unknown';
    const date = isKnowledgeItem(item) ? item.date : item.date || 'Just now';
    const author = isKnowledgeItem(item) ? item.author : 'You';
    const tags = isKnowledgeItem(item) ? item.tags : [];
    const typeLabel = isKnowledgeItem(item) ? 'File' : 'Project File';

    const handleDownload = () => {
        if (previewUrl) {
            const link = document.createElement('a');
            link.href = previewUrl;
            link.download = name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            alert("To download, please upload a real file. This is a reference item.");
        }
    };

    const renderContent = () => {
        if (previewUrl) {
            if (fileType.includes('pdf')) {
                return <iframe src={previewUrl} className="w-full h-full rounded-lg border border-slate-200" title="PDF Preview" />;
            }
            if (fileType.includes('image')) {
                return (
                    <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-lg overflow-hidden">
                        <img src={previewUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
                    </div>
                );
            }
        }

        // Clean fallback for un-previewable content
        return (
             <div className="w-full h-full bg-white border border-slate-200 shadow-sm rounded-lg p-8 md:p-12 overflow-y-auto flex flex-col items-center justify-center">
                 <div className="text-center">
                     <div className="h-20 w-20 bg-slate-100 rounded-2xl mx-auto flex items-center justify-center mb-6">
                        {getIcon("h-10 w-10")}
                     </div>
                     <h3 className="text-lg font-bold text-slate-800 mb-2">Preview Unavailable</h3>
                     <p className="text-slate-500 max-w-sm mx-auto mb-6">
                         {previewUrl ? "This file type cannot be previewed directly." : "This file is stored in the database. Download to view content."}
                     </p>
                     {previewUrl && (
                        <button onClick={handleDownload} className="px-4 py-2 bg-slate-800 text-white hover:bg-slate-900 rounded-lg font-medium transition-colors shadow-sm">
                            Download File
                        </button>
                     )}
                 </div>
            </div>
        );
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex justify-end bg-black/20 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
            <div 
                className="w-full md:w-[85vw] lg:w-[75vw] max-w-6xl bg-slate-100 h-full shadow-2xl flex flex-col animate-slideInRight"
                onClick={e => e.stopPropagation()}
            >
                <div className="h-16 flex items-center justify-between px-6 bg-white border-b border-slate-200 shrink-0">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-1.5 bg-slate-100 rounded-lg shrink-0">
                             {getIcon("h-6 w-6")}
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base font-bold text-slate-800 truncate">{name}</h2>
                            <p className="text-xs text-slate-500">{typeLabel}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleDownload} className="flex items-center gap-2 px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors">
                            <DownloadIcon className="h-4 w-4" /> 
                            <span className="hidden sm:inline">Download</span>
                        </button>
                        <button 
                            onClick={() => onAskAI(item)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-weflora-teal text-white rounded-lg text-sm font-medium hover:bg-weflora-dark shadow-sm transition-colors"
                        >
                            <SparklesIcon className="h-4 w-4" /> 
                            <span className="hidden sm:inline">Ask FloraGPT</span>
                        </button>
                        <div className="h-6 w-px bg-slate-200 mx-2"></div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-weflora-red transition-colors">
                            <XIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    <div className="flex-1 p-6 md:p-8 overflow-hidden flex flex-col bg-slate-100/50">
                        {renderContent()}
                    </div>

                    <aside className="w-80 bg-white border-l border-slate-200 overflow-y-auto shrink-0 flex flex-col">
                        <div className="p-5 border-b border-slate-100 bg-weflora-teal/10">
                            <div className="flex items-center gap-2 mb-3 text-weflora-dark font-bold text-sm">
                                <SparklesIcon className="h-4 w-4" /> FloraGPT Insights
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Ready to analyze <strong>{name}</strong>. 
                                <br/><br/>
                                <span className="text-slate-400 italic">Click "Ask FloraGPT" to generate a summary or extract data.</span>
                            </p>
                        </div>

                        <div className="p-5 border-b border-slate-100">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">File Details</h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
                                        <CalendarIcon className="h-3.5 w-3.5" /> Date Modified
                                    </div>
                                    <div className="text-sm font-medium text-slate-800 pl-5">{date}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
                                        <UserCircleIcon className="h-3.5 w-3.5" /> Author
                                    </div>
                                    <div className="text-sm font-medium text-slate-800 pl-5">{author}</div>
                                </div>
                                 {isKnowledgeItem(item) && (
                                     <div>
                                        <div className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
                                            <DatabaseIcon className="h-3.5 w-3.5" /> Category
                                        </div>
                                        <div className="pl-5">
                                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                                // NOTE: Conservative mapping: treat "Internal" as a neutral/brand surface label (no separate info-blue token yet).
                                                item.category === 'Internal' ? 'bg-weflora-mint/20 text-weflora-dark' :
                                                item.category === 'Policy' ? 'bg-weflora-teal/20 text-weflora-dark' :
                                                item.category === 'Research' ? 'bg-weflora-success/20 text-weflora-success' :
                                                'bg-weflora-amber/10 text-weflora-amber'
                                            }`}>
                                                {item.category}
                                            </span>
                                        </div>
                                     </div>
                                )}
                            </div>
                        </div>

                        <div className="p-5 flex-1">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <TagIcon className="h-3.5 w-3.5" /> Tags
                            </h3>
                            {tags.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {tags.map(tag => (
                                        <span key={tag} className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-xs border border-slate-200">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic">No tags added.</p>
                            )}
                        </div>
                    </aside>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default FilePreview;
