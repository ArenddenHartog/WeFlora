
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { Chat, ProjectFile } from '../types';
import { 
    SearchIcon, MenuIcon, SparklesIcon, FolderIcon, ChatBubbleIcon, FileSheetIcon, 
    FilePdfIcon, FileCodeIcon, BellIcon, HelpCircleIcon, UserCircleIcon, LogoIcon, DatabaseIcon
} from './icons';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { useProject } from '../contexts/ProjectContext';
import { useChat } from '../contexts/ChatContext';
import BaseModal from './BaseModal';

const Header: React.FC = () => {
    // Context Hooks
    const { user } = useAuth();
    const { projects, files } = useProject();
    const { chats, sendMessage } = useChat();
    const { 
        showNotification, setIsSidebarOpen, navigateToProject, 
        setSelectedChatId, openFilePreview 
    } = useUI();
    const navigate = useNavigate();
    const location = useLocation();
    const params = useParams();

    // Local State
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    const pathSegments = useMemo(() => location.pathname.split('/').filter(Boolean), [location.pathname]);
    const projectRoutePrefix = pathSegments[0] === 'projects' ? 'projects' : (pathSegments[0] === 'project' ? 'project' : null);
    const projectIdFromPath = projectRoutePrefix ? pathSegments[1] : undefined;
    const projectId = (params as any).projectId || projectIdFromPath;
    const isProjectContext = Boolean(projectRoutePrefix && projectId);

    const projectName = useMemo(() => {
        if (!projectId) return undefined;
        const found = projects.find(p => p.id === projectId);
        return found?.name || projectId;
    }, [projects, projectId]);

    const projectSection = useMemo(() => {
        if (!isProjectContext) return undefined;
        const section = pathSegments[2] || 'overview';
        // Title-case: overview -> Overview
        return section.charAt(0).toUpperCase() + section.slice(1);
    }, [isProjectContext, pathSegments]);

    const handleNavigateProject = (section: string) => {
        if (!projectId) return;
        const base = projectRoutePrefix === 'projects' ? '/projects' : '/project';
        if (section === 'overview') navigate(`${base}/${projectId}`);
        else navigate(`${base}/${projectId}/${section}`);
    };

    // Global Search Logic
    useEffect(() => {
        if (!searchQuery.trim()) {
            setResults([]);
            return;
        }

        const q = searchQuery.toLowerCase();
        const found: any[] = [];

        // 1. "Ask AI" Action
        found.push({
            id: 'action-ask',
            type: 'action',
            title: `Ask FloraGPT: "${searchQuery}"`,
            subtitle: 'Start a new AI session with this prompt',
            icon: SparklesIcon
        });

        // 2. Search Projects
        projects.forEach(p => {
            if (p.name.toLowerCase().includes(q)) {
                found.push({
                    id: p.id,
                    type: 'project',
                    title: p.name,
                    subtitle: `Project • ${p.status || 'Active'}`,
                    icon: FolderIcon
                });
            }
        });

        // 3. Search Chats
        (Object.values(chats).flat() as Chat[]).forEach((c) => {
            if (c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)) {
                found.push({
                    id: c.id,
                    type: 'chat',
                    title: c.title,
                    subtitle: `Chat • ${c.time}`,
                    icon: ChatBubbleIcon
                });
            }
        });

        // 4. Search Files
        (Object.values(files).flat() as ProjectFile[]).forEach((f) => {
            if (f.name.toLowerCase().includes(q)) {
                found.push({
                    id: f.id,
                    type: 'file',
                    title: f.name,
                    subtitle: 'File',
                    icon: f.name.includes('pdf') ? FilePdfIcon : f.name.includes('xls') ? FileSheetIcon : FileCodeIcon,
                    payload: f
                });
            }
        });

        setResults(found.slice(0, 8)); // Limit results
    }, [searchQuery, projects, chats, files]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsSearchFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleGlobalQuery = (query: string) => {
        navigate('/');
        // Trigger generic send message
        sendMessage(query, undefined, undefined, undefined, [], 'home', false, true);
    };

    const handleResultClick = (result: any) => {
        setIsSearchFocused(false);
        setSearchQuery('');
        
        if (result.type === 'action') {
            handleGlobalQuery(searchQuery);
        } else if (result.type === 'project') {
            navigateToProject(result.id);
        } else if (result.type === 'chat') {
            setSelectedChatId(result.id);
            navigate('/chat');
        } else if (result.type === 'file') {
            openFilePreview(result.payload);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (results.length > 0) {
                handleResultClick(results[0]);
            } else {
                handleGlobalQuery(searchQuery);
                setIsSearchFocused(false);
                setSearchQuery('');
            }
        }
    };

    const handleNotificationClick = () => {
        showNotification("No new notifications.", "success");
    };

    return (
        <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70 flex-none">
            <div className="h-14 px-4 flex items-center gap-4">
                <div className="flex items-center gap-3 flex-shrink-0">
                    <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                        <MenuIcon className="h-6 w-6" />
                    </button>

                    <button onClick={() => navigate('/')} className="flex items-center gap-2 font-bold text-slate-900">
                        <div className="h-8 w-8 bg-weflora-teal rounded-lg flex items-center justify-center">
                            <LogoIcon className="h-5 w-5 fill-white" />
                        </div>
                        <span className="hidden sm:inline">WeFlora</span>
                    </button>

                    <nav className="hidden md:flex items-center gap-2 text-sm text-slate-500">
                        <button onClick={() => navigate('/')} className="hover:text-weflora-dark transition-colors">WeFlora</button>
                        {isProjectContext && (
                            <>
                                <span className="text-slate-300">/</span>
                                <button onClick={() => navigate('/projects')} className="hover:text-weflora-dark transition-colors">Projects</button>
                                <span className="text-slate-300">/</span>
                                <span className="text-slate-700 font-medium truncate max-w-[180px]">{projectName}</span>
                                {projectSection && (
                                    <>
                                        <span className="text-slate-300">/</span>
                                        <span className="text-slate-500">{projectSection}</span>
                                    </>
                                )}
                            </>
                        )}
                    </nav>
                </div>

                {/* Center Search */}
                <div className="flex-1 relative" ref={searchRef}>
                    <div className="relative group">
                        <SearchIcon className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors ${isSearchFocused ? 'text-weflora-teal' : 'text-slate-400'}`} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setIsSearchFocused(true); }}
                            onFocus={() => setIsSearchFocused(true)}
                            onKeyDown={handleKeyDown}
                            placeholder="Search or Ask FloraGPT…"
                            className={`w-full pl-10 pr-16 py-2 bg-white border transition-all duration-200 rounded-xl outline-none text-slate-900 ${
                                isSearchFocused
                                    ? 'ring-2 ring-weflora-teal/30 border-weflora-teal shadow-sm'
                                    : 'border-slate-200 hover:border-slate-300'
                            }`}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                            <kbd className="hidden md:inline-flex items-center h-5 px-1.5 border border-slate-200 bg-white rounded text-[10px] font-sans font-medium text-slate-500">
                                ⌘K
                            </kbd>
                        </div>
                    </div>

                    {isSearchFocused && searchQuery && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn z-50 max-h-[70vh] overflow-y-auto">
                            {results.length > 0 ? (
                                <>
                                    <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">Suggested</div>
                                    <ul>
                                        {results.map((result, index) => (
                                            <li key={result.id + index}>
                                                <button
                                                    onClick={() => handleResultClick(result)}
                                                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-l-2 ${index === 0 ? 'bg-slate-50 border-weflora-teal' : 'border-transparent'}`}
                                                >
                                                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                                        result.type === 'action' ? 'bg-weflora-teal/10 text-weflora-dark' :
                                                        result.type === 'project' ? 'bg-weflora-mint/20 text-weflora-teal' :
                                                        result.type === 'file' ? 'bg-weflora-mint/20 text-weflora-teal' : 'bg-slate-100 text-slate-500'
                                                    }`}>
                                                        <result.icon className="h-4 w-4" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-medium text-slate-800 truncate">{result.title}</div>
                                                        <div className="text-xs text-slate-500 truncate">{result.subtitle}</div>
                                                    </div>
                                                    {index === 0 && <span className="text-xs text-slate-400">Enter</span>}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            ) : (
                                <div className="p-6 text-center text-slate-500">
                                    <p>No results for “{searchQuery}”</p>
                                    <button
                                        onClick={() => handleGlobalQuery(searchQuery)}
                                        className="mt-2 text-weflora-teal font-medium hover:text-weflora-dark hover:underline"
                                    >
                                        Ask FloraGPT &rarr;
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {isProjectContext && (
                        <button
                            onClick={() => handleNavigateProject('files')}
                            className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                        >
                            <DatabaseIcon className="h-4 w-4 text-weflora-teal" />
                            Project Files
                        </button>
                    )}

                    <button
                        onClick={() => navigate('/chat')}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold bg-weflora-teal text-white hover:bg-weflora-dark transition-colors shadow-sm"
                    >
                        <SparklesIcon className="h-4 w-4" />
                        <span className="hidden sm:inline">Ask FloraGPT</span>
                    </button>

                    <button
                        onClick={() => setIsHelpOpen(true)}
                        className="p-2 text-slate-500 hover:text-weflora-dark hover:bg-weflora-mint/20 rounded-lg transition-colors"
                        title="Help & Support"
                    >
                        <HelpCircleIcon className="h-5 w-5" />
                    </button>
                    <button
                        onClick={handleNotificationClick}
                        className="p-2 text-slate-500 hover:text-weflora-dark hover:bg-weflora-mint/20 rounded-lg transition-colors"
                        title="Notifications"
                    >
                        <BellIcon className="h-5 w-5" />
                    </button>
                    <button
                        onClick={() => showNotification(user?.email ? `Signed in as ${user.email}` : 'Account', 'success')}
                        className="p-2 text-slate-500 hover:text-weflora-dark hover:bg-weflora-mint/20 rounded-lg transition-colors"
                        title={user?.email || 'Account'}
                    >
                        <UserCircleIcon className="h-6 w-6" />
                    </button>
                </div>
            </div>

            {/* Project tabs row */}
            {isProjectContext && (
                <div className="px-4 h-10 flex items-end gap-6">
                    {(['overview', 'worksheets', 'reports', 'team'] as const).map((tab) => {
                        const active = (pathSegments[2] || 'overview') === tab;
                        return (
                            <button
                                key={tab}
                                onClick={() => handleNavigateProject(tab)}
                                className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                                    active
                                        ? 'text-weflora-dark border-weflora-teal'
                                        : 'text-slate-600 border-transparent hover:text-weflora-dark'
                                }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Help Modal */}
            <BaseModal
                isOpen={isHelpOpen}
                onClose={() => setIsHelpOpen(false)}
                title="Help & Shortcuts"
                size="md"
            >
                <div className="space-y-6">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h4 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wide">Keyboard Shortcuts</h4>
                        <div className="space-y-2 text-sm text-slate-600">
                            <div className="flex justify-between">
                                <span>Global Search</span>
                                <kbd className="bg-white border border-slate-200 px-1.5 rounded text-xs font-mono">⌘K</kbd>
                            </div>
                            <div className="flex justify-between">
                                <span>Send Message</span>
                                <kbd className="bg-white border border-slate-200 px-1.5 rounded text-xs font-mono">Enter</kbd>
                            </div>
                        </div>
                    </div>
                </div>
            </BaseModal>
        </header>
    );
};

export default Header;
