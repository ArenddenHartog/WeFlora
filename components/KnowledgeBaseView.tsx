
import React, { useState, useMemo, useRef } from 'react';
import type { KnowledgeItem, ProjectFile, PinnedProject } from '../types';
import { 
    SearchIcon, MenuIcon, UploadIcon, DatabaseIcon, 
    FileTextIcon, FileSheetIcon, FilePdfIcon, XIcon, SparklesIcon,
    FolderIcon, CheckIcon, ChevronRightIcon, ArrowUpIcon
} from './icons';
import BaseModal from './BaseModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';

interface KnowledgeBaseViewProps {
    items: KnowledgeItem[];
    projectFiles: { [projectId: string]: ProjectFile[] };
    projects: PinnedProject[];
    onOpenMenu: () => void;
    onUpload: (files: File[], projectId?: string) => void;
    onDelete: (item: any) => void; 
    onAskAI: (item: KnowledgeItem | ProjectFile) => void;
}

const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({ 
    items, projectFiles, projects, onOpenMenu, onUpload, onDelete, onAskAI 
}) => {
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'knowledge' | 'project'>('all');
    
    // Project Drilling State
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Upload Modal State
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [targetProjectId, setTargetProjectId] = useState<string>('');
    const [pendingDeleteItem, setPendingDeleteItem] = useState<any | null>(null);

    // Prepare unified file list for 'All' and 'Knowledge' modes, and for searching
    const unifiedItems = useMemo(() => {
        const unified: Array<any> = [];
        
        // 1. Add Knowledge Items (Global Refs)
        items.forEach(k => {
            unified.push({
                ...k,
                source: 'knowledge',
                icon: k.type === 'pdf' ? FilePdfIcon : k.type === 'xlsx' ? FileSheetIcon : FileTextIcon
            });
        });

        // 2. Add Project Files
        Object.entries(projectFiles).forEach(([pid, pFiles]) => {
            const project = projects.find(p => p.id === pid);
            const projectName = project ? project.name : 'General';
            
            (pFiles as ProjectFile[]).forEach(f => {
                unified.push({
                    id: f.id,
                    title: f.name,
                    category: f.category || 'Project Assets',
                    tags: f.tags || [],
                    date: f.date,
                    size: f.size,
                    type: f.name.split('.').pop()?.toLowerCase() || 'file',
                    author: 'Team',
                    source: 'project',
                    projectName: projectName,
                    projectId: pid,
                    icon: f.icon || FileTextIcon,
                    original: f
                });
            });
        });

        return unified;
    }, [items, projectFiles, projects]);

    const filteredItems = unifiedItems.filter(item => {
        // Tab Filtering logic
        if (activeTab === 'knowledge' && item.source !== 'knowledge') return false;
        if (activeTab === 'project' && item.source !== 'project') return false;
        
        // Specific Project Filtering logic
        if (activeTab === 'project' && selectedProjectId && item.projectId !== selectedProjectId) return false;

        // Search logic
        return item.title.toLowerCase().includes(search.toLowerCase()) || 
               item.tags.some((t: string) => t.toLowerCase().includes(search.toLowerCase()));
    });

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setPendingFiles(Array.from(e.target.files));
            // Default to currently selected project if we are in drilling mode
            setTargetProjectId(selectedProjectId || ''); 
            setIsUploadModalOpen(true);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const confirmUpload = () => {
        onUpload(pendingFiles, targetProjectId || undefined);
        setIsUploadModalOpen(false);
        setPendingFiles([]);
    };

    const handleDelete = (e: React.MouseEvent, item: any) => {
        e.stopPropagation();
        setPendingDeleteItem(item);
    };

    const renderProjectCards = () => {
        const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProjects.map(project => {
                    const fileCount = projectFiles[project.id]?.length || 0;
                    return (
                        <div 
                            key={project.id}
                            onClick={() => setSelectedProjectId(project.id)}
                            className="group bg-white border border-slate-200 rounded-xl p-6 cursor-pointer hover:border-weflora-teal hover:shadow-md transition-all relative flex flex-col h-40"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="h-12 w-12 bg-weflora-mint/20 rounded-xl flex items-center justify-center text-weflora-teal">
                                    <FolderIcon className="h-6 w-6" />
                                </div>
                                <div className="text-xs font-bold bg-slate-50 text-slate-500 px-2 py-1 rounded-full group-hover:bg-weflora-mint/10 group-hover:text-weflora-dark transition-colors">
                                    {fileCount} Files
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-weflora-teal transition-colors truncate">
                                {project.name}
                            </h3>
                            <div className="mt-auto flex items-center text-xs font-medium text-slate-400 group-hover:text-weflora-teal transition-colors">
                                View Files <ChevronRightIcon className="h-3 w-3 ml-1" />
                            </div>
                        </div>
                    );
                })}
                {filteredProjects.length === 0 && (
                    <div className="col-span-full py-20 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <FolderIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p>No projects match your search.</p>
                    </div>
                )}
            </div>
        );
    };

    const renderFilesGrid = () => {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((item, index) => (
                    <div key={index} className="group p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md hover:border-weflora-teal transition-all relative flex flex-col">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${item.source === 'knowledge' ? 'bg-weflora-teal/10 text-weflora-dark' : 'bg-slate-100 text-slate-500'}`}>
                                    <item.icon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-slate-800 text-sm truncate" title={item.title}>{item.title}</h3>
                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                        {item.source === 'project' && <FolderIcon className="h-3 w-3" />}
                                        <span className="truncate">{item.source === 'project' ? item.projectName : item.category}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-1 mb-4 flex-1 content-start">
                            {item.tags.slice(0, 3).map((tag: string) => (
                                <span key={tag} className="px-2 py-0.5 bg-slate-50 text-slate-500 text-[10px] rounded border border-slate-100">
                                    #{tag}
                                </span>
                            ))}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-50 mt-auto">
                            <div className="text-[10px] text-slate-400">
                                {item.size} • {item.date}
                            </div>
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={() => onAskAI(item.original || item)}
                                    className="p-1.5 text-weflora-dark bg-weflora-teal/10 rounded-lg hover:bg-weflora-teal/20 transition-colors"
                                    title="Ask AI about this file"
                                >
                                    <SparklesIcon className="h-3.5 w-3.5" />
                                </button>
                                <button 
                                    onClick={(e) => handleDelete(e, item)}
                                    className="p-1.5 text-slate-300 hover:text-weflora-red hover:bg-weflora-red/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <XIcon className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
                {filteredItems.length === 0 && (
                    <div className="col-span-full py-20 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <DatabaseIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p className="text-sm">No files found.</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="h-full overflow-y-auto bg-white p-4 md:p-8">
            <header className="mb-8">
                <div className="flex items-center justify-between mb-6">
                     <div className="flex items-center gap-4">
                        <button onClick={onOpenMenu} className="md:hidden p-1 -ml-1 text-slate-600">
                            <MenuIcon className="h-6 w-6" />
                        </button>
                        <div className="h-10 w-10 bg-weflora-mint/20 rounded-xl flex items-center justify-center text-weflora-teal">
                            <DatabaseIcon className="h-6 w-6" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800">Files Hub</h1>
                     </div>
                     <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 bg-weflora-teal text-white rounded-lg hover:bg-weflora-dark font-medium shadow-sm transition-colors"
                     >
                        <UploadIcon className="h-4 w-4" />
                        <span className="hidden sm:inline">Upload Files</span>
                     </button>
                     <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileSelect} />
                </div>

                <div className="flex flex-col md:flex-row gap-6 items-center">
                    <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar flex-1 border-b border-slate-100 w-full">
                        <button
                            onClick={() => { setActiveTab('all'); setSelectedProjectId(null); }}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap capitalize ${
                                activeTab === 'all' 
                                ? 'border-weflora-teal text-weflora-teal' 
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            All Files
                        </button>
                        <button
                            onClick={() => { setActiveTab('knowledge'); setSelectedProjectId(null); }}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap capitalize ${
                                activeTab === 'knowledge' 
                                ? 'border-weflora-teal text-weflora-teal' 
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            Reference Library
                        </button>
                        <button
                            onClick={() => { setActiveTab('project'); setSelectedProjectId(null); }}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap capitalize ${
                                activeTab === 'project' 
                                ? 'border-weflora-teal text-weflora-teal' 
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            Project Files
                        </button>
                    </div>
                    <div className="relative w-full md:w-96">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={activeTab === 'project' && !selectedProjectId ? "Search projects..." : "Search files..."}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal outline-none text-slate-900"
                        />
                    </div>
                </div>
            </header>

            {/* If in Project Tab AND viewing specific project */}
            {activeTab === 'project' && selectedProjectId && (
                <div className="mb-4 flex items-center gap-2">
                    <button onClick={() => setSelectedProjectId(null)} className="text-slate-500 hover:text-slate-800 text-sm font-bold flex items-center gap-1">
                        <FolderIcon className="h-4 w-4" /> Projects
                    </button>
                    <ChevronRightIcon className="h-3 w-3 text-slate-300" />
                    <span className="text-sm font-bold text-weflora-teal">{projects.find(p => p.id === selectedProjectId)?.name}</span>
                </div>
            )}

            {/* Conditionally Render Cards or File Grid */}
            {activeTab === 'project' && !selectedProjectId ? renderProjectCards() : renderFilesGrid()}

            {/* Upload Modal */}
            <BaseModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                title="Select Upload Destination"
                size="sm"
                footer={
                    <>
                        <button 
                            type="button" 
                            onClick={() => setIsUploadModalOpen(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={confirmUpload}
                            className="px-4 py-2 bg-weflora-teal text-white rounded-lg text-sm font-medium hover:bg-weflora-dark shadow-sm transition-colors"
                        >
                            Upload Files
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    {/* File List Preview */}
                    {pendingFiles.length > 0 && (
                        <div className="mb-4 p-3 bg-slate-50 border border-slate-100 rounded-lg">
                            <div className="text-xs font-bold text-slate-500 uppercase mb-2">Files to Upload</div>
                            <ul className="text-xs text-slate-700 space-y-1">
                                {pendingFiles.map((f, i) => (
                                    <li key={i} className="truncate flex items-center gap-2">
                                        <div className="w-1 h-1 rounded-full bg-slate-400"></div> {f.name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="space-y-2">
                        {/* General Option */}
                        <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${targetProjectId === '' ? 'border-weflora-teal bg-weflora-mint/10' : 'border-slate-200 hover:bg-slate-50'}`}>
                            <input type="radio" name="uploadTarget" className="hidden" checked={targetProjectId === ''} onChange={() => setTargetProjectId('')} />
                            <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                <DatabaseIcon className="h-4 w-4" />
                            </div>
                            <div className="flex-1">
                                <div className="text-sm font-bold text-slate-800">General / Library</div>
                                <div className="text-xs text-slate-500">Available to all projects</div>
                            </div>
                            {targetProjectId === '' && <CheckIcon className="h-4 w-4 text-weflora-teal" />}
                        </label>

                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-4 mb-2 pl-1">Projects</div>
                        
                        {/* Project Options */}
                        <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {projects.map(p => (
                                <label key={p.id} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${targetProjectId === p.id ? 'border-weflora-teal bg-weflora-mint/10' : 'border-slate-200 hover:bg-slate-50'}`}>
                                    <input type="radio" name="uploadTarget" className="hidden" checked={targetProjectId === p.id} onChange={() => setTargetProjectId(p.id)} />
                                    <div className="h-8 w-8 rounded-lg bg-weflora-mint/20 flex items-center justify-center text-weflora-teal">
                                        <FolderIcon className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm font-bold text-slate-800">{p.name}</div>
                                    </div>
                                    {targetProjectId === p.id && <CheckIcon className="h-4 w-4 text-weflora-teal" />}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </BaseModal>

            <ConfirmDeleteModal
                isOpen={Boolean(pendingDeleteItem)}
                title="Delete file?"
                description={`This will permanently delete "${
                    pendingDeleteItem ? (pendingDeleteItem.title || pendingDeleteItem.name || 'this file') : 'this file'
                }". This cannot be undone.`}
                confirmLabel="Delete file"
                onCancel={() => setPendingDeleteItem(null)}
                onConfirm={() => {
                    if (!pendingDeleteItem) return;
                    onDelete(pendingDeleteItem);
                    setPendingDeleteItem(null);
                }}
            />
        </div>
    );
};

export default KnowledgeBaseView;
