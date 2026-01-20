
import React, { useState } from 'react';
import type { PromptTemplate } from '../types';
import { 
    SearchIcon, MenuIcon, PlusIcon, ChatBubbleIcon, LightningBoltIcon, XIcon,
    EyeIcon, EyeOffIcon
} from './icons';
import BaseModal from './BaseModal';

interface PromptTemplatesViewProps {
    items: PromptTemplate[];
    onOpenMenu: () => void;
    onUseTemplate: (item: PromptTemplate) => void;
    onCreateTemplate?: (template: PromptTemplate) => void;
}

const PromptTemplatesView: React.FC<PromptTemplatesViewProps> = ({ items, onOpenMenu, onUseTemplate, onCreateTemplate }) => {
    const [search, setSearch] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [viewingTemplate, setViewingTemplate] = useState<PromptTemplate | null>(null);
    
    // Create Form State
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newTemplateText, setNewTemplateText] = useState('');
    const [newSystemInstruction, setNewSystemInstruction] = useState('');
    const [newTags, setNewTags] = useState('');

    const filteredItems = items.filter(item => 
        item.title.toLowerCase().includes(search.toLowerCase()) || 
        item.description.toLowerCase().includes(search.toLowerCase())
    );

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (onCreateTemplate && newTitle && newTemplateText) {
            const newTemplate: PromptTemplate = {
                id: `pt-${Date.now()}`,
                title: newTitle,
                description: newDescription,
                templateText: newTemplateText,
                systemInstruction: newSystemInstruction,
                tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
                usageCount: 0,
                lastUsed: 'Never',
                isSystem: false
            };
            onCreateTemplate(newTemplate);
            setIsCreateModalOpen(false);
            setNewTitle('');
            setNewDescription('');
            setNewTemplateText('');
            setNewSystemInstruction('');
            setNewTags('');
        }
    };

    return (
        <div className="bg-white p-4 md:p-8" data-layout-root>
            <header className="mb-8">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={onOpenMenu} className="md:hidden p-1 -ml-1 text-slate-600">
                        <MenuIcon className="h-6 w-6" />
                    </button>
                    <div className="h-10 w-10 bg-weflora-mint/20 rounded-xl flex items-center justify-center text-weflora-teal">
                        <ChatBubbleIcon className="h-6 w-6" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">Prompts Hub</h1>
                </div>

                <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
                    <div className="relative w-full md:w-96">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search prompts..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal outline-none text-slate-900"
                        />
                    </div>
                    <button 
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-weflora-teal text-white rounded-lg hover:bg-weflora-dark font-medium shadow-sm transition-colors"
                    >
                        <PlusIcon className="h-4 w-4" />
                        <span className="hidden sm:inline">Create Prompt</span>
                        <span className="sm:hidden">New</span>
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredItems.map(item => (
                    <div key={item.id} className="group flex flex-col bg-white border border-slate-200 rounded-xl hover:shadow-md hover:border-weflora-teal transition-all duration-200">
                        <div className="p-5 flex-grow">
                            <div className="flex justify-between items-start mb-4">
                                <div className="h-10 w-10 rounded-lg flex items-center justify-center border bg-weflora-mint/10 border-weflora-mint text-weflora-teal">
                                    <ChatBubbleIcon className="h-5 w-5" />
                                </div>
                                <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                                    {item.usageCount} uses
                                </span>
                            </div>
                            
                            <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-weflora-dark transition-colors">{item.title}</h3>
                            <p className="text-sm text-slate-500 line-clamp-2 mb-4">{item.description}</p>
                            
                            {/* Preview Area */}
                            <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-600 font-mono mb-4 border border-slate-100 overflow-hidden group-hover:border-weflora-mint/30 transition-colors">
                                <div className="font-bold text-slate-700 mb-1 flex items-center gap-1"><EyeIcon className="h-3 w-3"/> User Prompt</div>
                                <div className="line-clamp-2 mb-2">{item.templateText}</div>
                                
                                {item.systemInstruction && (
                                    <>
                                        <div className="font-bold text-slate-700 mt-2 mb-1 border-t border-slate-200 pt-2 flex items-center gap-1"><EyeOffIcon className="h-3 w-3"/> Hidden Instructions</div>
                                        <div className="text-slate-500 line-clamp-2 italic">{item.systemInstruction}</div>
                                    </>
                                )}
                            </div>

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
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setViewingTemplate(item); }}
                                    className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-weflora-teal hover:border-weflora-teal transition-all shadow-sm"
                                    title="Inspect Prompt Details"
                                >
                                    <EyeIcon className="h-4 w-4" />
                                </button>
                                <button 
                                    onClick={() => onUseTemplate(item)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-weflora-teal hover:text-white hover:border-weflora-teal transition-all shadow-sm"
                                >
                                    <ChatBubbleIcon className="h-3.5 w-3.5" />
                                    Use Prompt
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredItems.length === 0 && (
                <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <ChatBubbleIcon className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 font-medium">No prompts found.</p>
                </div>
            )}

            {/* Inspect Modal */}
            {viewingTemplate && (
                <BaseModal
                    isOpen={true}
                    onClose={() => setViewingTemplate(null)}
                    title="Inspect Prompt"
                    size="lg"
                    footer={
                        <button
                            onClick={() => setViewingTemplate(null)}
                            className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
                        >
                            Close
                        </button>
                    }
                >
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">{viewingTemplate.title}</h3>
                            <p className="text-sm text-slate-500">{viewingTemplate.description}</p>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    <EyeIcon className="h-4 w-4" /> User Prompt Template
                                </div>
                                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono bg-white p-3 rounded-lg border border-slate-200">
                                    {viewingTemplate.templateText}
                                </pre>
                            </div>

                            {viewingTemplate.systemInstruction && (
                                <div className="p-4 bg-weflora-teal/10 rounded-xl border border-weflora-teal/20">
                                    <div className="flex items-center gap-2 mb-2 text-xs font-bold text-weflora-dark uppercase tracking-wider">
                                        <EyeOffIcon className="h-4 w-4" /> System Instruction (Hidden)
                                    </div>
                                    <pre className="text-sm text-weflora-dark whitespace-pre-wrap font-mono bg-white/50 p-3 rounded-lg border border-weflora-teal/20">
                                        {viewingTemplate.systemInstruction}
                                    </pre>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex gap-2">
                            {viewingTemplate.tags.map(tag => (
                                <span key={tag} className="px-2 py-1 bg-slate-100 text-slate-500 text-xs rounded border border-slate-200">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    </div>
                </BaseModal>
            )}

            {/* Create Template Modal */}
            <BaseModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Create Prompt Template"
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
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Title</label>
                            <input
                                autoFocus
                                type="text"
                                required
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                placeholder="e.g., Soil Analysis Query"
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal text-slate-900"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tags (comma separated)</label>
                            <input
                                type="text"
                                value={newTags}
                                onChange={(e) => setNewTags(e.target.value)}
                                placeholder="soil, analysis, active"
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal text-slate-900"
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                        <input
                            type="text"
                            value={newDescription}
                            onChange={(e) => setNewDescription(e.target.value)}
                            placeholder="Briefly describe what this prompt does..."
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal text-slate-900"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div className="flex items-center gap-2 mb-2">
                                <EyeIcon className="h-4 w-4 text-slate-500" />
                                <label className="block text-xs font-bold text-slate-700 uppercase">User Prompt (Visible)</label>
                            </div>
                            <p className="text-[10px] text-slate-500 mb-2">This is what appears in the chat input. Use <code>{`{Placeholder}`}</code> for dynamic parts.</p>
                            <textarea
                                required
                                value={newTemplateText}
                                onChange={(e) => setNewTemplateText(e.target.value)}
                                rows={6}
                                placeholder="Analyze the following list: {List}"
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal resize-none font-mono text-slate-900"
                            />
                        </div>

                        <div className="bg-weflora-teal/10 p-4 rounded-xl border border-weflora-teal/20">
                            <div className="flex items-center gap-2 mb-2">
                                <EyeOffIcon className="h-4 w-4 text-weflora-dark" />
                                <label className="block text-xs font-bold text-weflora-dark uppercase">System Instruction (Invisible)</label>
                            </div>
                            <p className="text-[10px] text-weflora-dark/70 mb-2">Technical rules passed silently to FloraGPT. Define output formats here.</p>
                            <textarea
                                value={newSystemInstruction}
                                onChange={(e) => setNewSystemInstruction(e.target.value)}
                                rows={6}
                                placeholder="Output format: Return JSON with keys..."
                                className="w-full px-3 py-2 bg-white border border-weflora-teal/20 rounded-lg text-sm outline-none focus:ring-2 focus:ring-weflora-teal/30 focus:border-weflora-teal resize-none font-mono text-slate-900"
                            />
                        </div>
                    </div>
                </form>
            </BaseModal>
        </div>
    );
};

export default PromptTemplatesView;
