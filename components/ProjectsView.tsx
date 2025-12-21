
import React, { useState, useEffect } from 'react';
import type { PinnedProject, Member } from '../types';
import { SearchIcon, PlusIcon, FolderIcon, FilterIcon, SortAscendingIcon, MoreHorizontalIcon, XIcon, ChevronDownIcon, MenuIcon } from './icons';
import BaseModal from './BaseModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import { useProject } from '../contexts/ProjectContext';

interface ProjectsViewProps {
    projects: PinnedProject[];
    onSelectProject: (id: string) => void;
    onOpenMenu: () => void;
    onCreateProject: (project: PinnedProject) => Promise<{ id: string } | null>;
    onUpdateProject?: (project: PinnedProject) => void;
}

const ProjectsView: React.FC<ProjectsViewProps> = ({ projects, onSelectProject, onOpenMenu, onCreateProject, onUpdateProject }) => {
    const { deleteProject } = useProject();
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Archived'>('Active');
    const [sortOrder, setSortOrder] = useState<'name' | 'date'>('name');
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    
    // Expansion and Invite States
    const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
    const [inviteInputs, setInviteInputs] = useState<{[key: string]: string}>({});
    const [pendingDeleteProjectId, setPendingDeleteProjectId] = useState<string | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectStatus, setNewProjectStatus] = useState<'Active' | 'Archived'>('Active');
    const [newProjectDate, setNewProjectDate] = useState(new Date().toISOString().split('T')[0]);

    const toggleProjectStatus = (e: React.MouseEvent, project: PinnedProject) => {
        e.stopPropagation(); // Prevent card click
        if (onUpdateProject) {
            onUpdateProject({ 
                ...project, 
                status: project.status === 'Active' ? 'Archived' : 'Active' 
            });
        }
        setActiveMenuId(null);
    };

    const handleDeleteProject = (e: React.MouseEvent, projectId: string) => {
        e.stopPropagation();
        setPendingDeleteProjectId(projectId);
        setActiveMenuId(null);
    };

    const toggleMenu = (e: React.MouseEvent, projectId: string) => {
        e.stopPropagation();
        setActiveMenuId(activeMenuId === projectId ? null : projectId);
    };

    const toggleExpand = (e: React.MouseEvent, projectId: string) => {
        e.stopPropagation();
        setExpandedProjects(prev => {
            const next = new Set(prev);
            if (next.has(projectId)) {
                next.delete(projectId);
            } else {
                next.add(projectId);
            }
            return next;
        });
    };

    const handleInviteInputChange = (projectId: string, value: string) => {
        setInviteInputs(prev => ({ ...prev, [projectId]: value }));
    };

    const handleInviteMember = (e: React.FormEvent, project: PinnedProject) => {
        e.preventDefault();
        e.stopPropagation();
        const name = inviteInputs[project.id];
        if (!name || !name.trim()) return;

        const newMember: Member = {
            id: `new-m-${Date.now()}`,
            name: name,
            initials: name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
        };

        if (onUpdateProject) {
            onUpdateProject({
                ...project,
                members: [...(project.members || []), newMember]
            });
        }

        setInviteInputs(prev => ({ ...prev, [project.id]: '' }));
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setActiveMenuId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProjectName.trim()) return;

        const newProject: PinnedProject = {
            id: `new-${Date.now()}`,
            name: newProjectName,
            icon: FolderIcon,
            status: newProjectStatus,
            date: newProjectDate,
            workspaceId: '', // placeholder, will be set by parent
            members: [{ id: 'me', name: 'Arend den Hartog', initials: 'AH' }]
        };
        
        const created = await onCreateProject(newProject);
        if (!created) return;
        setIsModalOpen(false);
        
        // Reset form
        setNewProjectName('');
        setNewProjectStatus('Active');
        setNewProjectDate(new Date().toISOString().split('T')[0]);
    };

    const filteredProjects = projects
        .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
        .filter(p => filterStatus === 'All' || p.status === filterStatus)
        .sort((a, b) => {
            if (sortOrder === 'name') return a.name.localeCompare(b.name);
            // Fallback to 0 if date is missing to avoid NaN issues
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateB - dateA;
        });

    return (
        <div className="h-full overflow-y-auto bg-white p-4 md:p-8 relative">
            <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 relative z-10">
                <div className="flex items-center gap-4">
                    <button onClick={onOpenMenu} className="md:hidden p-1 -ml-1 text-slate-600">
                        <MenuIcon className="h-6 w-6" />
                    </button>
                    <div className="h-10 w-10 bg-weflora-mint/20 rounded-xl flex items-center justify-center text-weflora-teal">
                        <FolderIcon className="h-6 w-6" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">Projects Hub</h1>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-weflora-teal text-white rounded-lg hover:bg-weflora-dark font-medium transition-colors shadow-sm"
                >
                    <PlusIcon className="h-5 w-5" />
                    New Project
                </button>
            </header>

            <div className="flex flex-col md:flex-row gap-4 mb-8 relative z-20">
                <div className="relative flex-grow">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search projects..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal text-slate-900"
                    />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative group">
                        <button className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:border-weflora-teal hover:text-weflora-teal transition-colors">
                            <div className="flex items-center gap-2">
                                <FilterIcon className="h-4 w-4" />
                                <span>Filter: {filterStatus}</span>
                            </div>
                        </button>
                        <div className="absolute right-0 mt-1 w-full sm:w-32 bg-white border border-slate-200 rounded-lg shadow-lg hidden group-hover:block z-50">
                            {['All', 'Active', 'Archived'].map(status => (
                                <button 
                                    key={status}
                                    onClick={() => setFilterStatus(status as any)}
                                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg"
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button 
                        onClick={() => setSortOrder(sortOrder === 'name' ? 'date' : 'name')}
                        className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:border-weflora-teal hover:text-weflora-teal transition-colors"
                    >
                         <div className="flex items-center gap-2">
                            <SortAscendingIcon className="h-4 w-4" />
                            <span>Sort: {sortOrder === 'name' ? 'Name' : 'Date'}</span>
                        </div>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-8 relative z-0">
                {filteredProjects.map(project => {
                    const isExpanded = expandedProjects.has(project.id);
                    return (
                        <div 
                            key={project.id}
                            onClick={() => onSelectProject(project.id)}
                            className="group bg-white border border-slate-200 rounded-xl p-5 cursor-pointer hover:border-weflora-teal hover:shadow-md transition-all relative flex flex-col"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${project.status === 'Archived' ? 'bg-slate-100 text-slate-400' : 'bg-weflora-mint/20 text-weflora-teal'}`}>
                                    <FolderIcon className="h-6 w-6" />
                                </div>
                                <div className="relative">
                                    <button 
                                        onClick={(e) => toggleMenu(e, project.id)}
                                        className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <MoreHorizontalIcon className="h-5 w-5" />
                                    </button>
                                    {activeMenuId === project.id && (
                                        <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                                            <button
                                                onClick={(e) => toggleProjectStatus(e, project)}
                                                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 first:rounded-t-lg"
                                            >
                                                {project.status === 'Active' ? 'Archive' : 'Restore'}
                                            </button>
                                            <button
                                                onClick={(e) => handleDeleteProject(e, project.id)}
                                                className="w-full text-left px-4 py-2 text-sm text-weflora-red hover:bg-weflora-red/10 last:rounded-b-lg flex items-center gap-2"
                                            >
                                                <XIcon className="h-3.5 w-3.5" /> Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <h3 className={`text-lg font-bold mb-1 transition-colors ${project.status === 'Archived' ? 'text-slate-500' : 'text-slate-800 group-hover:text-weflora-teal'}`}>
                                {project.name}
                            </h3>
                            <p className="text-sm text-slate-500 mb-4 line-clamp-2 flex-grow">
                                 {project.name.includes('AMS') ? 'Urban forestry analysis for Amsterdam district Z.' : 
                                  project.name.includes('UT') ? 'University terrain layout and species selection.' : 
                                  'Residential development complex planning.'}
                            </p>

                            <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs font-medium text-slate-500 mt-auto">
                                <div className="flex items-center gap-1">
                                    <span>{project.status}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={(e) => toggleExpand(e, project.id)}
                                        className="flex items-center gap-1 hover:text-slate-800 transition-colors"
                                        title="View members"
                                    >
                                        <span>{project.members?.length || 0} members</span>
                                        <ChevronDownIcon className={`h-3 w-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                    <span>{project.date}</span>
                                </div>
                            </div>

                            {/* Expanded Members Section */}
                            {isExpanded && (
                                <div className="mt-4 pt-4 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3 tracking-wider">Team Members</h4>
                                    <div className="space-y-2 mb-4 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                                        {project.members?.map(member => (
                                            <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50">
                                                <div className="h-6 w-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                                    {member.initials}
                                                </div>
                                                <span className="text-xs font-medium text-slate-700">{member.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <form onSubmit={(e) => handleInviteMember(e, project)} className="flex gap-2">
                                        <input 
                                            type="text" 
                                            placeholder="Invite..." 
                                            value={inviteInputs[project.id] || ''}
                                            onChange={(e) => handleInviteInputChange(project.id, e.target.value)}
                                            className="flex-grow px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-weflora-teal focus:border-weflora-teal outline-none text-slate-900"
                                        />
                                        <button 
                                            type="submit"
                                            className="px-2 py-1.5 bg-weflora-teal text-white text-xs font-medium rounded-lg hover:bg-weflora-dark transition-colors"
                                        >
                                            Add
                                        </button>
                                    </form>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            
            {filteredProjects.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                    No {filterStatus === 'All' ? '' : filterStatus.toLowerCase()} projects found matching your criteria.
                </div>
            )}

            {/* New Project Modal (BaseModal) */}
            <BaseModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Create New Project"
                size="md"
                footer={
                    <>
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium text-sm transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreateProject}
                            className="px-4 py-2 bg-weflora-teal text-white rounded-lg hover:bg-weflora-dark font-medium text-sm shadow-sm transition-colors"
                        >
                            Create Project
                        </button>
                    </>
                }
            >
                <form onSubmit={handleCreateProject} className="space-y-4">
                    <div>
                        <label htmlFor="projectName" className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Name</label>
                        <input
                            id="projectName"
                            type="text"
                            required
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            placeholder="e.g., AMS-West Site Analysis"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal outline-none text-slate-900"
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="projectStatus" className="block text-xs font-bold text-slate-500 uppercase mb-1">Initial Status</label>
                            <select
                                id="projectStatus"
                                value={newProjectStatus}
                                onChange={(e) => setNewProjectStatus(e.target.value as 'Active' | 'Archived')}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal outline-none text-slate-900"
                            >
                                <option value="Active">Active</option>
                                <option value="Archived">Archived</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="projectDate" className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                            <input
                                id="projectDate"
                                type="date"
                                required
                                value={newProjectDate}
                                onChange={(e) => setNewProjectDate(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal outline-none text-slate-900"
                            />
                        </div>
                    </div>
                </form>
            </BaseModal>

            <ConfirmDeleteModal
                isOpen={Boolean(pendingDeleteProjectId)}
                title="Delete project?"
                description={`This will permanently delete "${
                    pendingDeleteProjectId ? (projects.find(p => p.id === pendingDeleteProjectId)?.name || pendingDeleteProjectId) : 'this project'
                }" and remove all associated files, worksheets, and reports. This cannot be undone.`}
                confirmLabel="Delete project"
                onCancel={() => setPendingDeleteProjectId(null)}
                onConfirm={() => {
                    if (!pendingDeleteProjectId) return;
                    deleteProject(pendingDeleteProjectId);
                    setPendingDeleteProjectId(null);
                }}
            />
        </div>
    );
};

export default ProjectsView;
