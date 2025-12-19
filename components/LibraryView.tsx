
import React, { useState } from 'react';
import type { LibraryTemplate, TemplateType } from '../types';
import { 
    SearchIcon, MenuIcon, MagicWandIcon, PlusIcon, 
    FolderIcon, ChatBubbleIcon, LayoutGridIcon, LightningBoltIcon
} from './icons';

interface LibraryViewProps {
    items: LibraryTemplate[];
    onOpenMenu: () => void;
    onUseTemplate: (item: LibraryTemplate) => void;
}

const LibraryView: React.FC<LibraryViewProps> = ({ items, onOpenMenu, onUseTemplate }) => {
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'All' | TemplateType>('All');

    const filteredItems = items.filter(item => 
        (activeTab === 'All' || item.type === activeTab) &&
        (item.title.toLowerCase().includes(search.toLowerCase()) || item.description.toLowerCase().includes(search.toLowerCase()))
    );

    const tabs: ('All' | TemplateType)[] = ['All', 'Prompt', 'Project', 'Workflow'];

    const getIcon = (type: TemplateType) => {
        if (type === 'Prompt') return <ChatBubbleIcon className="h-5 w-5 text-purple-600" />;
        if (type === 'Project') return <FolderIcon className="h-5 w-5 text-blue-600" />;
        return <LayoutGridIcon className="h-5 w-5 text-orange-600" />;
    };

    const getColor = (type: TemplateType) => {
        if (type === 'Prompt') return 'bg-purple-50 border-purple-100 text-purple-700';
        if (type === 'Project') return 'bg-blue-50 border-blue-100 text-blue-700';
        return 'bg-orange-50 border-orange-100 text-orange-700';
    };

    return (
        <div className="h-full overflow-y-auto bg-white p-4 md:p-8">
            <header className="mb-8">
                <div className="flex items-center justify-between mb-6">
                     <div className="flex items-center gap-4">
                        <button onClick={onOpenMenu} className="md:hidden p-1 -ml-1 text-slate-600">
                            <MenuIcon className="h-6 w-6" />
                        </button>
                        <div className="h-10 w-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
                            <MagicWandIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">Library</h1>
                            <p className="text-slate-500 text-sm">Receipts, prompts, and reusable workflows.</p>
                        </div>
                     </div>
                     <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 font-medium shadow-sm">
                        <PlusIcon className="h-4 w-4" />
                        <span className="hidden sm:inline">Create Template</span>
                     </button>
                </div>

                {/* Navigation & Search */}
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar flex-1 border-b border-slate-100">
                        {tabs.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                                    activeTab === tab 
                                    ? 'border-weflora-teal text-weflora-dark' 
                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full md:w-72">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search receipts..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal outline-none"
                        />
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredItems.map(item => (
                    <div key={item.id} className="group flex flex-col bg-white border border-slate-200 rounded-xl hover:shadow-md hover:border-slate-300 transition-all duration-200">
                        <div className="p-5 flex-grow">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`h-10 w-10 rounded-lg flex items-center justify-center border ${getColor(item.type)}`}>
                                    {getIcon(item.type)}
                                </div>
                                <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                                    {item.usageCount} uses
                                </span>
                            </div>
                            
                            <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-weflora-dark transition-colors">{item.title}</h3>
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
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-weflora-teal hover:text-white hover:border-weflora-teal transition-all shadow-sm"
                            >
                                <LightningBoltIcon className="h-3.5 w-3.5" />
                                Use This
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {filteredItems.length === 0 && (
                <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <MagicWandIcon className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 font-medium">No receipts found matching your search.</p>
                </div>
            )}
        </div>
    );
};

export default LibraryView;
