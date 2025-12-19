
import React, { useState } from 'react';
import type { WorksheetTemplate, Matrix } from '../types';
import { 
    SearchIcon, MenuIcon, PlusIcon, TableIcon, LightningBoltIcon, MagicWandIcon, XIcon, FolderIcon, TrashIcon
} from './icons';
import BaseModal from './BaseModal';

interface WorksheetTemplatesViewProps {
    items: WorksheetTemplate[];
    standaloneMatrices: Matrix[];
    onOpenMenu: () => void;
    onUseTemplate: (item: WorksheetTemplate) => void;
    onCreateTemplate: (template: WorksheetTemplate) => void;
    onOpenMatrix: (matrix: Matrix) => void;
    onOpenCreateWorksheet: () => void;
    onDeleteMatrix?: (id: string) => void;
}

const WorksheetTemplatesView: React.FC<WorksheetTemplatesViewProps> = ({ items, standaloneMatrices, onOpenMenu, onUseTemplate, onCreateTemplate, onOpenMatrix, onOpenCreateWorksheet, onDeleteMatrix }) => {
    const [activeTab, setActiveTab] = useState<'mysheets' | 'templates'>('mysheets');
    const [search, setSearch] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newTags, setNewTags] = useState('');

    const filteredTemplates = items.filter(item => 
        item.title.toLowerCase().includes(search.toLowerCase()) || 
        item.description.toLowerCase().includes(search.toLowerCase())
    );

    // Only show root matrices (Worksheet Documents)
    const filteredSheets = standaloneMatrices.filter(item => 
        !item.parentId && 
        item.title.toLowerCase().includes(search.toLowerCase())
    );

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        // Use setTimeout to avoid UI freeze
        setTimeout(() => {
            if (window.confirm("Are you sure you want to delete this worksheet?")) {
                onDeleteMatrix && onDeleteMatrix(id);
            }
        }, 0);
    };

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTitle) {
            const newTemplate: WorksheetTemplate = {
                id: `wt-${Date.now()}`,
                title: newTitle,
                description: newDescription,
                tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
                columns: [
                    { id: 'wtc-1', title: 'Item', type: 'text', width: 200 }
                ],
                rows: [
                    { id: 'wtr-1', cells: {} }
                ],
                usageCount: 0,
                lastUsed: 'Never',
                isSystem: false
            };
            onCreateTemplate(newTemplate);
            setIsCreateModalOpen(false);
            setNewTitle('');
            setNewDescription('');
            setNewTags('');
        }
    };

    return (
        <div className="h-full overflow-y-auto bg-white p-4 md:p-8">
            <header className="mb-8">
                <div className="flex items-center justify-between mb-6">
                     <div className="flex items-center gap-4">
                        <button onClick={onOpenMenu} className="md:hidden p-1 -ml-1 text-slate-600">
                            <MenuIcon className="h-6 w-6" />
                        </button>
                        {/* Updated to Teal theme */}
                        <div className="h-10 w-10 bg-weflora-mint/20 rounded-xl flex items-center justify-center text-weflora-teal">
                            <TableIcon className="h-6 w-6" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800">Worksheet Hub</h1>
                     </div>
                     <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsCreateModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium border border-slate-200 hover:border-slate-300 transition-colors shadow-sm"
                        >
                            <PlusIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">Create Template</span>
                        </button>
                        <button 
                            onClick={onOpenCreateWorksheet}
                            className="flex items-center gap-2 px-4 py-2 bg-weflora-teal text-white rounded-lg hover:bg-weflora-dark font-medium shadow-sm transition-colors"
                        >
                            <PlusIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">Build Worksheet</span>
                        </button>
                     </div>
                </div>

                <div className="flex flex-col md:flex-row gap-6 items-center">
                    <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar flex-1 border-b border-slate-100 w-full">
                        <button
                            onClick={() => setActiveTab('mysheets')}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                                activeTab === 'mysheets' 
                                ? 'border-weflora-teal text-weflora-teal' 
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            My Worksheets
                        </button>
                        <button
                            onClick={() => setActiveTab('templates')}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                                activeTab === 'templates' 
                                ? 'border-weflora-teal text-weflora-teal' 
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            Templates
                        </button>
                    </div>
                    <div className="relative w-full md:w-96">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={activeTab === 'mysheets' ? "Search my sheets..." : "Search templates..."}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal outline-none text-slate-900"
                        />
                    </div>
                </div>
            </header>

            {activeTab === 'mysheets' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredSheets.map(sheet => (
                        <div key={sheet.id} onClick={() => onOpenMatrix(sheet)} className="group flex flex-col bg-white border border-slate-200 rounded-xl hover:shadow-md hover:border-weflora-teal transition-all duration-200 cursor-pointer relative">
                            <div className="p-5 flex-grow">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="h-10 w-10 rounded-lg flex items-center justify-center border bg-weflora-mint/10 border-weflora-mint text-weflora-teal">
                                        <TableIcon className="h-5 w-5" />
                                    </div>
                                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                                        General Worksheet
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-weflora-teal transition-colors pr-6">{sheet.title}</h3>
                                <p className="text-sm text-slate-500 line-clamp-2 mb-4">{sheet.description || 'No description'}</p>
                                <div className="text-xs text-slate-400">
                                    Last updated: {sheet.updatedAt || 'Recently'}
                                </div>
                            </div>
                            {/* Delete Button */}
                            {onDeleteMatrix && (
                                <button 
                                    onClick={(e) => handleDelete(e, sheet.id)}
                                    className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-weflora-red hover:bg-weflora-red/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                    title="Delete Worksheet"
                                >
                                    <TrashIcon className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    ))}
                    {filteredSheets.length === 0 && (
                        <div className="col-span-full py-20 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <FolderIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p>No independent worksheets found.</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'templates' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTemplates.map(item => (
                        <div key={item.id} className="group flex flex-col bg-white border border-slate-200 rounded-xl hover:shadow-md hover:border-weflora-teal transition-all duration-200">
                            <div className="p-5 flex-grow">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="h-10 w-10 rounded-lg flex items-center justify-center border bg-weflora-mint/10 border-weflora-mint text-weflora-teal">
                                        <TableIcon className="h-5 w-5" />
                                    </div>
                                    <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                                        {item.usageCount} uses
                                    </span>
                                </div>
                                
                                <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-weflora-teal transition-colors">{item.title}</h3>
                                <p className="text-sm text-slate-500 line-clamp-2 mb-4">{item.description}</p>
                                
                                <div className="flex flex-wrap gap-2">
                                    {item.tags.map(tag => (
                                        <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded border border-slate-200">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="p-4 border-t border-slate-100 bg-slate-50/30 rounded-b-xl flex justify-between items-center">
                                <span className="text-xs text-slate-400">Used {item.lastUsed}</span>
                                <button 
                                    onClick={() => onUseTemplate(item)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-weflora-mint/10 hover:text-weflora-teal hover:border-weflora-teal transition-all shadow-sm"
                                >
                                    <LightningBoltIcon className="h-3.5 w-3.5" />
                                    Use Template
                                </button>
                            </div>
                        </div>
                    ))}
                    {filteredTemplates.length === 0 && (
                        <div className="col-span-full text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <MagicWandIcon className="h-12 w-12 mx-auto text-slate-300 mb-4 opacity-50" />
                            <p className="text-slate-500 font-medium">No templates found.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Create Template Modal (BaseModal) */}
            <BaseModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Create Worksheet Template"
                size="lg"
                footer={
                    <>
                        <button 
                            type="button" 
                            onClick={() => setIsCreateModalOpen(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleCreate}
                            className="px-4 py-2 bg-weflora-teal text-white rounded-lg text-sm font-medium hover:bg-weflora-dark shadow-sm transition-colors"
                        >
                            Create Template
                        </button>
                    </>
                }
            >
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Title</label>
                        <input
                            autoFocus
                            type="text"
                            required
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder="e.g., Soil Analysis Standard"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal text-slate-900"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                        <input
                            type="text"
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                            placeholder="Briefly describe this worksheet's purpose..."
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal text-slate-900"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tags (comma separated)</label>
                        <input
                            type="text"
                            value={newTags}
                            onChange={(e) => setNewTags(e.target.value)}
                            placeholder="soil, analysis, standard"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal text-slate-900"
                        />
                    </div>
                </form>
            </BaseModal>
        </div>
    );
};

export default WorksheetTemplatesView;
