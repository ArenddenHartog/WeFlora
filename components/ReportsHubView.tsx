
import React, { useState, useMemo } from 'react';
import type { Report, ReportTemplate } from '../types';
import { 
    SearchIcon, MenuIcon, PlusIcon, FileTextIcon, FolderIcon, TagIcon, XIcon,
    MagicWandIcon, LightningBoltIcon
} from './icons';
import BaseModal from './BaseModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';

interface ReportsHubViewProps {
    reports: Report[];
    templates?: ReportTemplate[];
    onOpenMenu: () => void;
    onOpenReport: (report: Report) => void;
    onCreateReport: () => void; 
    onUseTemplate?: (template: ReportTemplate) => void;
    onCreateTemplate?: (template: ReportTemplate) => void;
    onDeleteReport?: (id: string) => void;
}

const ReportsHubView: React.FC<ReportsHubViewProps> = ({ 
    reports, templates = [], onOpenMenu, onOpenReport, onCreateReport, onUseTemplate, onCreateTemplate, onDeleteReport
}) => {
    const [activeTab, setActiveTab] = useState<'myreports' | 'templates'>('myreports');
    const [search, setSearch] = useState('');
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [isCreateTemplateModalOpen, setIsCreateTemplateModalOpen] = useState(false);
    
    // New Template Form
    const [newTemplateTitle, setNewTemplateTitle] = useState('');
    const [newTemplateDesc, setNewTemplateDesc] = useState('');
    const [newTemplateTags, setNewTemplateTags] = useState('');
    const [newTemplateContent, setNewTemplateContent] = useState('');
    const [pendingDeleteReportId, setPendingDeleteReportId] = useState<string | null>(null);

    // Display reports passed from parent (filtered by parent logic). 
    // Only exclude sections (parentId) to ensure we show documents.
    const displayReports = reports.filter(report => !report.parentId);

    // Extract unique tags
    const allTags = useMemo(() => {
        const tags = new Set<string>();
        displayReports.forEach(report => {
            report.tags?.forEach(tag => tags.add(tag));
        });
        return Array.from(tags).sort();
    }, [displayReports]);

    const filteredReports = displayReports.filter(report => {
        const matchesSearch = report.title.toLowerCase().includes(search.toLowerCase()) || 
                              report.tags?.some(tag => tag.toLowerCase().includes(search.toLowerCase()));
        const matchesTag = selectedTag ? report.tags?.includes(selectedTag) : true;
        return matchesSearch && matchesTag;
    });

    const filteredTemplates = templates.filter(template => 
        template.title.toLowerCase().includes(search.toLowerCase()) ||
        template.description.toLowerCase().includes(search.toLowerCase()) ||
        template.tags?.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
    );

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setPendingDeleteReportId(id);
    };

    const handleCreateTemplate = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTemplateTitle && onCreateTemplate) {
            const newTemplate: ReportTemplate = {
                id: `rt-${Date.now()}`,
                title: newTemplateTitle,
                description: newTemplateDesc,
                content: newTemplateContent,
                tags: newTemplateTags.split(',').map(t => t.trim()).filter(Boolean),
                usageCount: 0,
                lastUsed: 'Never',
                isSystem: false
            };
            onCreateTemplate(newTemplate);
            setIsCreateTemplateModalOpen(false);
            setNewTemplateTitle('');
            setNewTemplateDesc('');
            setNewTemplateTags('');
            setNewTemplateContent('');
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
                        {/* Updated to Teal Theme */}
                        <div className="h-10 w-10 bg-weflora-mint/20 rounded-xl flex items-center justify-center text-weflora-teal">
                            <FileTextIcon className="h-6 w-6" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800">Reports Hub</h1>
                    </div>
                    <div className="flex gap-2">
                        {onCreateTemplate && (
                            <button 
                                onClick={() => setIsCreateTemplateModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium border border-slate-200 hover:border-slate-300 transition-colors shadow-sm"
                            >
                                <PlusIcon className="h-4 w-4" />
                                <span className="hidden sm:inline">Draft Template</span>
                            </button>
                        )}
                        <button 
                            onClick={onCreateReport}
                            className="flex items-center gap-2 px-4 py-2 bg-weflora-teal text-white rounded-lg hover:bg-weflora-dark font-medium shadow-sm transition-colors"
                        >
                            <PlusIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">Draft Report</span>
                        </button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-6 items-center mb-4">
                    <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar flex-1 border-b border-slate-100 w-full">
                        <button
                            onClick={() => setActiveTab('myreports')}
                            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                                activeTab === 'myreports' 
                                ? 'border-weflora-teal text-weflora-teal' 
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            My Reports
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
                            placeholder={activeTab === 'myreports' ? "Search reports..." : "Search templates..."}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal outline-none text-slate-900"
                        />
                    </div>
                </div>

                {/* Tag Filter Bar (Only for My Reports) */}
                {activeTab === 'myreports' && allTags.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar items-center">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2 flex-shrink-0">Filter by:</span>
                        <button
                            onClick={() => setSelectedTag(null)}
                            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors border flex-shrink-0 ${
                                selectedTag === null
                                ? 'bg-slate-800 text-white border-slate-800'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            All
                        </button>
                        {allTags.map(tag => (
                            <button
                                key={tag}
                                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors border flex-shrink-0 flex items-center gap-1 ${
                                    selectedTag === tag
                                    ? 'bg-slate-800 text-white border-slate-800'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                {tag}
                                {selectedTag === tag && <XIcon className="h-3 w-3 ml-1" />}
                            </button>
                        ))}
                    </div>
                )}
            </header>

            {activeTab === 'myreports' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredReports.map(report => (
                        <div key={report.id} onClick={() => onOpenReport(report)} className="group flex flex-col bg-white border border-slate-200 rounded-xl hover:shadow-md hover:border-weflora-teal transition-all duration-200 cursor-pointer relative">
                            <div className="p-5 flex-grow">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="h-10 w-10 rounded-lg flex items-center justify-center border bg-weflora-mint/10 border-weflora-mint text-weflora-teal">
                                        <FileTextIcon className="h-5 w-5" />
                                    </div>
                                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                                        {report.projectId ? 'Project Report' : 'General Report'}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-weflora-teal transition-colors pr-6">{report.title}</h3>
                                <div className="text-xs text-slate-400 mb-4">
                                    Last modified: {report.lastModified}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {report.tags?.map(tag => (
                                        <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded border border-slate-200 flex items-center gap-1">
                                            <TagIcon className="h-2.5 w-2.5 opacity-50" />
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            {/* Delete Button */}
                            {onDeleteReport && (
                                <button 
                                    onClick={(e) => handleDelete(e, report.id)}
                                    className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center cursor-pointer text-slate-300 hover:text-weflora-red hover:bg-weflora-red/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                    title="Delete Report"
                                >
                                    <XIcon className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    ))}
                    {filteredReports.length === 0 && (
                        <div className="col-span-full py-20 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <FolderIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p>No reports found matching your criteria.</p>
                            {selectedTag && <button onClick={() => setSelectedTag(null)} className="text-sm text-weflora-teal hover:underline mt-2">Clear filter</button>}
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
                                        <FileTextIcon className="h-5 w-5" />
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
                                {onUseTemplate && (
                                    <button 
                                        onClick={() => onUseTemplate(item)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-weflora-mint/10 hover:text-weflora-teal hover:border-weflora-teal transition-all shadow-sm"
                                    >
                                        <LightningBoltIcon className="h-3.5 w-3.5" />
                                        Use Template
                                    </button>
                                )}
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

            {/* Create Template Modal */}
            <BaseModal
                isOpen={isCreateTemplateModalOpen}
                onClose={() => setIsCreateTemplateModalOpen(false)}
                title="Create Report Template"
                size="lg"
                footer={
                    <>
                        <button 
                            type="button" 
                            onClick={() => setIsCreateTemplateModalOpen(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleCreateTemplate}
                            className="px-4 py-2 bg-weflora-teal text-white rounded-lg text-sm font-medium hover:bg-weflora-dark shadow-sm transition-colors"
                        >
                            Create Template
                        </button>
                    </>
                }
            >
                <form onSubmit={handleCreateTemplate} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Template Title</label>
                        <input
                            autoFocus
                            type="text"
                            required
                            value={newTemplateTitle}
                            onChange={(e) => setNewTemplateTitle(e.target.value)}
                            placeholder="e.g., Site Inspection Standard"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal text-slate-900"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                        <input
                            type="text"
                            value={newTemplateDesc}
                            onChange={(e) => setNewTemplateDesc(e.target.value)}
                            placeholder="What is this report for?"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal text-slate-900"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tags (comma separated)</label>
                        <input
                            type="text"
                            value={newTemplateTags}
                            onChange={(e) => setNewTemplateTags(e.target.value)}
                            placeholder="standard, site, inspection"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal text-slate-900"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Default Content (Markdown)</label>
                        <textarea
                            value={newTemplateContent}
                            onChange={(e) => setNewTemplateContent(e.target.value)}
                            rows={10}
                            placeholder="# Report Title\n\n## Section 1\n..."
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal resize-none font-mono text-slate-900"
                        />
                    </div>
                </form>
            </BaseModal>

            <ConfirmDeleteModal
                isOpen={Boolean(pendingDeleteReportId)}
                title="Delete report?"
                description={`This will permanently delete "${
                    pendingDeleteReportId ? (reports.find(r => r.id === pendingDeleteReportId)?.title || 'this report') : 'this report'
                }". This cannot be undone.`}
                confirmLabel="Delete report"
                onCancel={() => setPendingDeleteReportId(null)}
                onConfirm={() => {
                    if (!pendingDeleteReportId) return;
                    onDeleteReport && onDeleteReport(pendingDeleteReportId);
                    setPendingDeleteReportId(null);
                }}
            />
        </div>
    );
};

export default ReportsHubView;
