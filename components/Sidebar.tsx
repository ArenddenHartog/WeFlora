
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { User, PinnedProject, RecentItem, ViewMode, Workspace, Thread } from '../types';
import {
    PlusIcon, FolderIcon, HomeIcon, XIcon, CheckIcon, 
    SettingsIcon, UsersIcon, LogOutIcon, ChevronUpIcon,
    DatabaseIcon, TableIcon, SidebarCloseIcon, LogoIcon, FileTextIcon, HistoryIcon,
        SparklesIcon, UserPlusIcon, BookIcon
} from './icons';
import BaseModal from './BaseModal';
import { useData } from '../contexts/DataContext';
import { useChat } from '../contexts/ChatContext';
import { useAuth } from '../contexts/AuthContext';
import AccountSettingsModal from './AccountSettingsModal';
import { useUI } from '../contexts/UIContext';

interface SidebarProps {
    user: User;
    workspaces: Workspace[];
    currentWorkspace: Workspace;
    projects: PinnedProject[];
    recentItems: RecentItem[];
    selectedProjectId: string | null;
    onSelectProject: (id: string) => void;
    onSwitchWorkspace: (id: string) => void;
    onNavigate: (view: string) => void; // Changed from ViewMode to string for flexibility
    isOpen: boolean;
    onClose: () => void;
    onCreateProject: (project: PinnedProject) => Promise<{ id: string } | null>;
    isCollapsed: boolean;
    toggleCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
    user, workspaces, currentWorkspace, projects, recentItems, selectedProjectId,
    onSelectProject, onSwitchWorkspace, onNavigate, isOpen, onClose, onCreateProject,
    isCollapsed, toggleCollapse
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    
    const { activeThreadId, setActiveThreadId } = useChat();
    const { signOut } = useAuth();
    const { showNotification } = useUI();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Invite Member State
    const [isInviteFormOpen, setIsInviteFormOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');

  // Modal state for Create Project
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectStatus, setNewProjectStatus] = useState<'Active' | 'Archived'>('Active');
  const [newProjectDate, setNewProjectDate] = useState(new Date().toISOString().split('T')[0]);

  const handleCreateProject = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newProjectName.trim()) return;

      const newProject: PinnedProject = {
          id: `new-${Date.now()}`,
          name: newProjectName,
          icon: FolderIcon,
          status: newProjectStatus,
          date: newProjectDate,
          workspaceId: currentWorkspace.id, 
          members: [{ id: 'me', name: user.name, initials: user.avatar }]
      };
      
      const created = await onCreateProject(newProject);
      if (!created) return;
      setIsProjectModalOpen(false);
      setNewProjectName('');
      setNewProjectStatus('Active');
      setNewProjectDate(new Date().toISOString().split('T')[0]);
  };

  const handleInviteMember = (e: React.FormEvent) => {
      e.preventDefault();
      if (inviteEmail.trim()) {
          showNotification(`Invitation sent to ${inviteEmail}`, 'success');
          setInviteEmail('');
          setIsInviteFormOpen(false);
      }
  };

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
            setIsMenuOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (path: string) => {
      if (path === '/') return location.pathname === '/';
      // Normalize project domain routes so sidebar selection reflects the active domain.
      // - /projects (hub) and /project/:id/* (workspace) both count as "Projects"
      if (path === '/projects') return location.pathname.startsWith('/projects') || location.pathname.startsWith('/project/');
      if (path === '/sessions') return location.pathname.startsWith('/sessions');
      return location.pathname.startsWith(path);
  }

  const NavItem = ({ 
      icon: Icon, 
      label, 
      path,
      onClick, 
      color = 'teal',
      activeOverride
  }: { 
      icon: any, 
      label: string, 
      path: string,
      onClick: () => void,
      color?: 'teal' | 'purple',
      activeOverride?: boolean
  }) => {
      const active = typeof activeOverride === 'boolean' ? activeOverride : isActive(path);
      const colorStyles = {
          teal: {
              activeBg: 'bg-weflora-mint/30',
              activeText: 'text-weflora-dark',
              activeIcon: 'text-weflora-teal'
          },
          purple: {
              activeBg: 'bg-weflora-teal/10',
              activeText: 'text-weflora-dark',
              activeIcon: 'text-weflora-dark'
          }
      };

      const style = color === 'purple' ? colorStyles.purple : colorStyles.teal;

      return (
          <button 
              onClick={onClick}
              className={`
                  w-full flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl transition-all duration-200 group
                  ${active 
                      ? `${style.activeBg} ${style.activeText}` 
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }
              `}
              title={label}
          >
              <Icon className={`h-6 w-6 ${active ? style.activeIcon : 'text-slate-400 group-hover:text-slate-600 transition-colors'}`} />
              <span className="text-[10px] font-bold leading-none tracking-wide text-center">{label}</span>
          </button>
      );
  };

  return (
    <>
        {/* Mobile Backdrop */}
        {isOpen && (
            <div 
                className="fixed inset-0 bg-black/50 z-40 md:hidden"
                onClick={onClose}
            />
        )}
        
        <div className={`
            fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 flex flex-col h-full transform transition-all duration-300 ease-in-out
            ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            md:translate-x-0 md:static md:inset-auto
            w-[88px] flex-shrink-0
        `}>
          {/* Header with Logo */}
          <div className="h-20 flex items-center justify-center flex-shrink-0">
              <div className="h-10 w-10 bg-weflora-teal rounded-xl flex items-center justify-center text-white font-bold">
                  <LogoIcon className="h-6 w-6 fill-white" />
              </div>
          </div>

          <nav className="flex-grow overflow-y-auto overflow-x-hidden px-3 py-2 flex flex-col gap-2 no-scrollbar">
               <NavItem 
                  icon={HomeIcon} 
                  label="Research" 
                  path="/"
                  onClick={() => { 
                      setActiveThreadId(null);
                      navigate('/'); 
                      if(window.innerWidth < 768) onClose(); 
                  }} 
               />
               <NavItem 
                  icon={FolderIcon} 
                  label="Projects" 
                  path="/projects"
                  onClick={() => { navigate('/projects'); if(window.innerWidth < 768) onClose(); }} 
               />
            <NavItem 
                icon={BookIcon} 
                label="Skills" 
                path="/skills"
                onClick={() => { navigate('/skills'); if(window.innerWidth < 768) onClose(); }} 
            />
            <NavItem 
                icon={SparklesIcon} 
                label="Flows" 
                path="/flows"
                onClick={() => { navigate('/flows'); if(window.innerWidth < 768) onClose(); }} 
            />
            <NavItem 
                icon={HistoryIcon} 
                label="Sessions" 
                path="/sessions"
                onClick={() => { navigate('/sessions'); if(window.innerWidth < 768) onClose(); }} 
            />
               <NavItem 
                  icon={TableIcon} 
                  label="Worksheets" 
                  path="/worksheets"
                  onClick={() => { navigate('/worksheets'); if(window.innerWidth < 768) onClose(); }} 
               />
               <NavItem 
                  icon={FileTextIcon} 
                  label="Reports" 
                  path="/reports"
                  onClick={() => { navigate('/reports'); if(window.innerWidth < 768) onClose(); }} 
               />
               <NavItem 
                    icon={DatabaseIcon} 
                    label="Files" 
                    path="/files"
                    onClick={() => { navigate('/files'); if(window.innerWidth < 768) onClose(); }} 
               />
          </nav>
          
          {/* Bottom Mega Menu Button */}
          <div className="p-4 flex flex-col gap-4 items-center border-t border-slate-100" ref={menuRef}>
              <button 
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="h-10 w-10 bg-slate-800 rounded-full flex items-center justify-center text-white text-xs font-bold ring-4 ring-slate-50 hover:ring-slate-100 transition-all shadow-sm"
                  title="User Menu"
              >
                  {user.avatar}
              </button>

              {/* Flyout Menu */}
              {isMenuOpen && (
                  <div className="absolute bottom-4 left-full ml-3 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-fadeIn z-[60]">
                      {/* User Identity Header */}
                      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                          <div className="font-semibold text-slate-800">{user.name}</div>
                          <div className="text-xs text-slate-500">{user.email}</div>
                      </div>

                      {/* Organization Context */}
                      <div className="p-2">
                          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                              <span>Organization</span>
                              <span className="bg-slate-100 text-slate-600 px-1.5 rounded">{currentWorkspace.type}</span>
                          </div>
                          <div className="px-3 py-1 mb-2 font-medium text-slate-800 flex items-center gap-2">
                              <div className="w-5 h-5 bg-weflora-teal rounded flex items-center justify-center text-[10px] text-white font-bold">
                                  {currentWorkspace.avatar}
                              </div>
                              {currentWorkspace.name}
                          </div>
                          
                          <button 
                              onClick={() => { setIsSettingsModalOpen(true); setIsMenuOpen(false); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                          >
                              <SettingsIcon className="h-4 w-4" />
                              Settings
                          </button>

                          <button 
                              onClick={() => { setIsMembersModalOpen(true); setIsMenuOpen(false); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                          >
                              <UsersIcon className="h-4 w-4" />
                              Manage Team
                          </button>
                      </div>

                      <div className="h-px bg-slate-100 mx-2"></div>

                      {/* Footer */}
                      <div className="p-2">
                          <button 
                            onClick={signOut}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-weflora-red hover:bg-weflora-red/10 rounded-lg transition-colors"
                          >
                              <LogOutIcon className="h-4 w-4" />
                              Log out
                          </button>
                      </div>
                  </div>
              )}
          </div>

          <AccountSettingsModal 
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
          />

          <BaseModal
            isOpen={isProjectModalOpen}
            onClose={() => setIsProjectModalOpen(false)}
            title="Create New Project"
            size="md"
            footer={
                <>
                    <button
                        type="button"
                        onClick={() => setIsProjectModalOpen(false)}
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
                    <label htmlFor="sidebarProjectName" className="block text-xs font-bold text-slate-500 uppercase mb-1">Project Name</label>
                    <input
                        id="sidebarProjectName"
                        type="text"
                        required
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="e.g., AMS-West Site Analysis"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal outline-none text-slate-900"
                        autoFocus
                    />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="sidebarProjectStatus" className="block text-xs font-bold text-slate-500 uppercase mb-1">Initial Status</label>
                        <select
                            id="sidebarProjectStatus"
                            value={newProjectStatus}
                            onChange={(e) => setNewProjectStatus(e.target.value as 'Active' | 'Archived')}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal outline-none text-slate-900"
                        >
                            <option value="Active">Active</option>
                            <option value="Archived">Archived</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="sidebarProjectDate" className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                        <input
                            id="sidebarProjectDate"
                            type="date"
                            required
                            value={newProjectDate}
                            onChange={(e) => setNewProjectDate(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal outline-none text-slate-900"
                        />
                    </div>
                </div>
            </form>
          </BaseModal>

          <BaseModal
            isOpen={isMembersModalOpen}
            onClose={() => setIsMembersModalOpen(false)}
            title="Team Management"
            subtitle={currentWorkspace.name}
            size="lg"
            footer={
                <button
                    onClick={() => setIsMembersModalOpen(false)}
                    className="px-4 py-2 bg-weflora-teal text-white rounded-lg hover:bg-weflora-dark font-medium text-sm transition-colors shadow-sm"
                >
                    Done
                </button>
            }
          >
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase">Active Members</h3>
                  <button 
                    onClick={() => setIsInviteFormOpen(!isInviteFormOpen)}
                    className="flex items-center gap-1 text-sm text-weflora-teal hover:underline font-medium"
                  >
                      <UserPlusIcon className="h-4 w-4" /> Invite Member
                  </button>
              </div>

              {isInviteFormOpen && (
                  <form onSubmit={handleInviteMember} className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 animate-fadeIn">
                      <input 
                        type="email" 
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="colleague@example.com" 
                        className="flex-1 px-3 py-1.5 text-sm bg-white border border-slate-300 rounded outline-none focus:border-weflora-teal focus:ring-1 focus:ring-weflora-teal"
                        autoFocus
                      />
                      <button 
                        type="submit" 
                        disabled={!inviteEmail.trim()}
                        className="px-3 py-1.5 bg-weflora-teal text-white text-sm font-medium rounded hover:bg-weflora-dark disabled:opacity-50 transition-colors"
                      >
                          Send
                      </button>
                  </form>
              )}

              <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-100 transition-colors">
                      <div className="flex items-center gap-3">
                          <div className="h-8 w-8 bg-slate-800 text-white rounded-full flex items-center justify-center text-xs font-bold">{user.avatar}</div>
                          <div>
                              <div className="text-sm font-medium text-slate-800">{user.name} (You)</div>
                              <div className="text-xs text-slate-500">{user.email}</div>
                          </div>
                      </div>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">Admin</span>
                  </div>
              </div>
          </BaseModal>

        </div>
    </>
  );
};

export default Sidebar;
