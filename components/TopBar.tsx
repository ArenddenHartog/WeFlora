import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ProjectFile } from '../types';
import {
  BellIcon,
  ChevronRightIcon,
  DatabaseIcon,
  FolderIcon,
  HelpCircleIcon,
  MenuIcon,
  SearchIcon,
  SlidersIcon,
  SparklesIcon,
  TableIcon,
} from './icons';
import BaseModal from './BaseModal';
import { useChat } from '../contexts/ChatContext';
import { useProject } from '../contexts/ProjectContext';
import { useUI } from '../contexts/UIContext';

type SearchResult =
  | { id: string; type: 'project'; title: string; subtitle: string; icon: any }
  | { id: string; type: 'chat'; title: string; subtitle: string; icon: any }
  | { id: string; type: 'file'; title: string; subtitle: string; icon: any; payload: ProjectFile };

const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { projects, matrices, reports, files } = useProject();
  const { threads, activeThreadId, setActiveThreadId } = useChat();
  const { showNotification, setIsSidebarOpen, sessionOpenOrigin, setSessionOpenOrigin, emitTopBarCommand } = useUI();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const pathname = location.pathname;

  const ctx = useMemo(() => {
    const projectMatch = pathname.match(/^\/project\/([^/]+)(?:\/(.*))?$/);
    if (projectMatch) {
      const projectId = projectMatch[1];
      const sub = (projectMatch[2] || 'overview').split('/')[0] || 'overview';
      const project = projects.find(p => p.id === projectId);
      return {
        kind: 'project' as const,
        projectId,
        title: project?.name || projectId,
        section: (['overview', 'files', 'worksheets', 'reports', 'team'].includes(sub) ? sub : 'overview') as
          | 'overview' | 'files' | 'worksheets' | 'reports' | 'team',
      };
    }

    const wsMatch = pathname.match(/^\/worksheets\/([^/]+)$/);
    if (wsMatch) {
      const matrixId = wsMatch[1];
      const matrix = matrices.find(m => m.id === matrixId);
      return { kind: 'worksheet' as const, matrixId, title: matrix?.title || 'Worksheet' };
    }

    const repMatch = pathname.match(/^\/reports\/([^/]+)$/);
    if (repMatch) {
      const reportId = repMatch[1];
      const report = reports.find(r => r.id === reportId);
      return { kind: 'report' as const, reportId, title: report?.title || 'Report' };
    }

    if (pathname.startsWith('/sessions')) return { kind: 'hub' as const, hub: 'sessions' as const, title: 'Sessions' };
    if (pathname.startsWith('/files')) return { kind: 'hub' as const, hub: 'files' as const, title: 'Files' };
    if (pathname.startsWith('/prompts')) return { kind: 'hub' as const, hub: 'prompts' as const, title: 'Prompts' };
    if (pathname.startsWith('/projects')) return { kind: 'hub' as const, hub: 'projects' as const, title: 'Projects' };
    if (pathname.startsWith('/worksheets')) return { kind: 'hub' as const, hub: 'worksheets' as const, title: 'Worksheets' };
    if (pathname.startsWith('/reports')) return { kind: 'hub' as const, hub: 'reports' as const, title: 'Reports' };
    if (pathname.startsWith('/chat')) return { kind: 'hub' as const, hub: 'chat' as const, title: 'Chat' };

    if (pathname === '/' && activeThreadId) {
      const t = threads.find(th => th.id === activeThreadId);
      return {
        kind: 'session' as const,
        title: t?.title || 'Session',
        fromSessions: sessionOpenOrigin === 'sessions',
      };
    }

    return { kind: 'hub' as const, hub: 'home' as const, title: 'Research' };
  }, [pathname, projects, matrices, reports, threads, activeThreadId, sessionOpenOrigin]);

  // Global search results
  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const found: SearchResult[] = [];

    projects.forEach((p) => {
      if (p.name.toLowerCase().includes(q)) {
        found.push({ id: p.id, type: 'project', title: p.name, subtitle: `Project • ${p.status || 'Active'}`, icon: FolderIcon });
      }
    });

    (Object.values(files).flat() as ProjectFile[]).forEach((f) => {
      if (f.name.toLowerCase().includes(q)) {
        found.push({ id: f.id, type: 'file', title: f.name, subtitle: 'File', icon: DatabaseIcon, payload: f });
      }
    });

    // Keep chat result conservative: just navigate to /chat (does not deep-link a thread)
    (threads as any[]).forEach((t) => {
      if ((t.title || '').toLowerCase().includes(q)) {
        found.push({ id: t.id, type: 'chat', title: t.title, subtitle: 'Session', icon: SparklesIcon });
      }
    });

    setResults(found.slice(0, 8));
  }, [searchQuery, projects, files, threads]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResultClick = (r: SearchResult) => {
    setIsSearchFocused(false);
    setSearchQuery('');
    if (r.type === 'project') navigate(`/project/${r.id}`);
    else if (r.type === 'file') navigate('/files');
    else if (r.type === 'chat') navigate('/sessions');
  };

  const leftNode = (() => {
    if (ctx.kind === 'project') {
      const sectionTitle = ctx.section.charAt(0).toUpperCase() + ctx.section.slice(1);
      return (
        <div className="min-w-0 flex items-center gap-2 text-sm text-slate-600">
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-1 text-slate-500 hover:text-weflora-dark transition-colors"
            title="Back to Projects"
          >
            <ChevronRightIcon className="h-4 w-4 rotate-180" />
            <span className="hidden sm:inline">Projects</span>
          </button>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-slate-900 truncate">{ctx.title}</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-600 truncate">{sectionTitle}</span>

          <div className="hidden lg:flex items-center gap-1 ml-3">
            {(['overview', 'files', 'worksheets', 'reports', 'team'] as const).map((t) => (
              <button
                key={t}
                onClick={() => navigate(`/project/${ctx.projectId}/${t === 'overview' ? 'overview' : t}`)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                  ctx.section === t
                    ? 'bg-weflora-mint/30 border-weflora-teal text-weflora-dark'
                    : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {t === 'overview' ? 'Overview' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (ctx.kind === 'worksheet') {
      return (
        <div className="min-w-0 flex items-center gap-2 text-sm text-slate-600">
          <button onClick={() => navigate('/worksheets')} className="flex items-center gap-1 text-slate-500 hover:text-weflora-dark transition-colors" title="Back to Worksheets">
            <ChevronRightIcon className="h-4 w-4 rotate-180" />
            <span className="hidden sm:inline">Worksheets</span>
          </button>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-slate-900 truncate">{ctx.title}</span>
        </div>
      );
    }

    if (ctx.kind === 'report') {
      return (
        <div className="min-w-0 flex items-center gap-2 text-sm text-slate-600">
          <button onClick={() => navigate('/reports')} className="flex items-center gap-1 text-slate-500 hover:text-weflora-dark transition-colors" title="Back to Reports">
            <ChevronRightIcon className="h-4 w-4 rotate-180" />
            <span className="hidden sm:inline">Reports</span>
          </button>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-slate-900 truncate">{ctx.title}</span>
        </div>
      );
    }

    if (ctx.kind === 'session') {
      return (
        <div className="min-w-0 flex items-center gap-2 text-sm text-slate-600">
          {ctx.fromSessions && (
            <button
              onClick={() => {
                setSessionOpenOrigin(null);
                setActiveThreadId(null);
                navigate('/sessions');
              }}
              className="flex items-center gap-1 text-slate-500 hover:text-weflora-dark transition-colors"
              title="Back to Sessions"
            >
              <ChevronRightIcon className="h-4 w-4 rotate-180" />
              <span className="hidden sm:inline">Sessions</span>
            </button>
          )}
          {ctx.fromSessions && <span className="text-slate-300">/</span>}
          <span className="font-semibold text-slate-900 truncate">{ctx.title}</span>
        </div>
      );
    }

    return (
      <div className="min-w-0 flex items-center gap-2 text-sm">
        <span className="font-semibold text-slate-900 truncate">{ctx.title}</span>
      </div>
    );
  })();

  const contextActions = (() => {
    if (ctx.kind === 'hub') {
      if (ctx.hub === 'projects') {
        return (
          <button
            onClick={() => emitTopBarCommand({ type: 'openProjectsCreateModal' })}
            className="px-3 py-1.5 rounded-lg text-sm font-bold bg-weflora-teal text-white hover:bg-weflora-dark transition-colors shadow-sm"
          >
            <span className="inline-flex items-center gap-2">
              <PlusIconCompat />
              New Project
            </span>
          </button>
        );
      }
      if (ctx.hub === 'worksheets') {
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => emitTopBarCommand({ type: 'openWorksheetsTemplateModal' })}
              className="px-3 py-1.5 rounded-lg text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-weflora-dark transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <PlusIconCompat />
                Create Template
              </span>
            </button>
            <button
              onClick={() => emitTopBarCommand({ type: 'openWorksheetsWizard' })}
              className="px-3 py-1.5 rounded-lg text-sm font-bold bg-weflora-teal text-white hover:bg-weflora-dark transition-colors shadow-sm"
            >
              <span className="inline-flex items-center gap-2">
                <PlusIconCompat />
                Build Worksheet
              </span>
            </button>
          </div>
        );
      }
      if (ctx.hub === 'reports') {
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => emitTopBarCommand({ type: 'openReportsTemplateModal' })}
              className="px-3 py-1.5 rounded-lg text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-weflora-dark transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <PlusIconCompat />
                Draft Template
              </span>
            </button>
            <button
              onClick={() => emitTopBarCommand({ type: 'openReportsWizard' })}
              className="px-3 py-1.5 rounded-lg text-sm font-bold bg-weflora-teal text-white hover:bg-weflora-dark transition-colors shadow-sm"
            >
              <span className="inline-flex items-center gap-2">
                <PlusIconCompat />
                Draft Report
              </span>
            </button>
          </div>
        );
      }
      return null;
    }

    if (ctx.kind === 'project') {
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/project/${ctx.projectId}/files`)}
            className="px-3 py-1.5 rounded-lg text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-weflora-dark transition-colors"
          >
            <span className="inline-flex items-center gap-2">
              <DatabaseIcon className="h-4 w-4 text-weflora-teal" />
              Files
            </span>
          </button>
          <button
            onClick={() => emitTopBarCommand({ type: 'projectToggleSettings' })}
            className="px-3 py-1.5 rounded-lg text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-weflora-dark transition-colors"
          >
            <span className="inline-flex items-center gap-2">
              <SlidersIcon className="h-4 w-4 text-weflora-teal" />
              Settings
            </span>
          </button>
          <button
            onClick={() => emitTopBarCommand({ type: 'projectToggleAsk' })}
            className="px-3 py-1.5 rounded-lg text-sm font-bold bg-weflora-teal text-white hover:bg-weflora-dark transition-colors shadow-sm"
          >
            <span className="inline-flex items-center gap-2">
              <SparklesIcon className="h-4 w-4" />
              Ask FloraGPT
            </span>
          </button>
        </div>
      );
    }

    if (ctx.kind === 'worksheet') {
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={() => emitTopBarCommand({ type: 'worksheetTogglePanel', panel: 'species' })}
            className="px-3 py-1.5 rounded-lg text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-weflora-dark transition-colors"
          >
            <span className="inline-flex items-center gap-2">
              <TableIcon className="h-4 w-4 text-weflora-teal" />
              Species
            </span>
          </button>
          <button
            onClick={() => emitTopBarCommand({ type: 'worksheetTogglePanel', panel: 'files' })}
            className="px-3 py-1.5 rounded-lg text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-weflora-dark transition-colors"
          >
            <span className="inline-flex items-center gap-2">
              <DatabaseIcon className="h-4 w-4 text-weflora-teal" />
              Files
            </span>
          </button>
          <button
            onClick={() => emitTopBarCommand({ type: 'worksheetTogglePanel', panel: 'settings' })}
            className="px-3 py-1.5 rounded-lg text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-weflora-dark transition-colors"
          >
            <span className="inline-flex items-center gap-2">
              <SlidersIcon className="h-4 w-4 text-weflora-teal" />
              Settings
            </span>
          </button>
          <button
            onClick={() => emitTopBarCommand({ type: 'worksheetTogglePanel', panel: 'ask' })}
            className="px-3 py-1.5 rounded-lg text-sm font-bold bg-weflora-teal text-white hover:bg-weflora-dark transition-colors shadow-sm"
          >
            <span className="inline-flex items-center gap-2">
              <SparklesIcon className="h-4 w-4" />
              Ask FloraGPT
            </span>
          </button>
        </div>
      );
    }

    if (ctx.kind === 'report') {
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={() => emitTopBarCommand({ type: 'reportTogglePanel', panel: 'settings' })}
            className="px-3 py-1.5 rounded-lg text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-weflora-dark transition-colors"
          >
            <span className="inline-flex items-center gap-2">
              <SlidersIcon className="h-4 w-4 text-weflora-teal" />
              Settings
            </span>
          </button>
          <button
            onClick={() => emitTopBarCommand({ type: 'reportTogglePanel', panel: 'ask' })}
            className="px-3 py-1.5 rounded-lg text-sm font-bold bg-weflora-teal text-white hover:bg-weflora-dark transition-colors shadow-sm"
          >
            <span className="inline-flex items-center gap-2">
              <SparklesIcon className="h-4 w-4" />
              Ask FloraGPT
            </span>
          </button>
        </div>
      );
    }

    return null;
  })();

  return (
    <div className="flex-none sticky top-0 z-40 border-b border-slate-200 bg-weflora-mintLight">
      <div className="h-12 px-4 flex items-center gap-3">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="md:hidden p-2 -ml-2 text-slate-600 hover:text-weflora-dark hover:bg-white/60 rounded-lg transition-colors"
          title="Menu"
        >
          <MenuIcon className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1 flex items-center gap-3">
          {leftNode}

          <div className="hidden lg:block flex-1" />

          <div className="hidden md:flex flex-1 justify-center">
            <div className="w-full max-w-md relative" ref={searchRef}>
              <SearchIcon className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isSearchFocused ? 'text-weflora-teal' : 'text-slate-400'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchFocused(true);
                }}
                onFocus={() => setIsSearchFocused(true)}
                placeholder="Search…"
                className={`w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none border transition-colors ${
                  isSearchFocused ? 'bg-white border-weflora-teal ring-2 ring-weflora-teal/30' : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              />
              {isSearchFocused && searchQuery && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 max-h-[60vh] overflow-y-auto">
                  {results.length > 0 ? (
                    <ul>
                      {results.map((r, idx) => (
                        <li key={r.id + idx}>
                          <button
                            onClick={() => handleResultClick(r)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                          >
                            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-slate-100 text-slate-500">
                              <r.icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-slate-800 truncate">{r.title}</div>
                              <div className="text-xs text-slate-500 truncate">{r.subtitle}</div>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-4 text-sm text-slate-500">No results.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setIsHelpOpen(true)}
            className="p-2 text-slate-600 hover:text-weflora-dark hover:bg-white/60 rounded-lg transition-colors"
            title="Help"
          >
            <HelpCircleIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => showNotification('No new notifications.', 'success')}
            className="p-2 text-slate-600 hover:text-weflora-dark hover:bg-white/60 rounded-lg transition-colors"
            title="Notifications"
          >
            <BellIcon className="h-5 w-5" />
          </button>

          {contextActions && <div className="hidden sm:flex items-center gap-2 pl-2">{contextActions}</div>}
        </div>
      </div>

      <BaseModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="Help" size="sm">
        <div className="text-sm text-slate-600">
          <p className="font-semibold text-slate-800 mb-2">WeFlora shortcuts</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Use the search box to jump to Projects, Files, and Sessions.</li>
            <li>Use contextual actions (Files/Settings/Ask) when you are in a Project, Worksheet, or Report.</li>
          </ul>
        </div>
      </BaseModal>
    </div>
  );
};

// Minimal inline icon to avoid pulling in extra components
const PlusIconCompat = () => (
  <span className="inline-flex items-center justify-center h-4 w-4 rounded bg-white/20 text-white text-xs font-bold">
    +
  </span>
);

export default TopBar;

