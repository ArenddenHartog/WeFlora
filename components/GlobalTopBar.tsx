import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Chat, ProjectFile } from '../types';
import {
  SearchIcon,
  BellIcon,
  HelpCircleIcon,
  SparklesIcon,
  FolderIcon,
  ChatBubbleIcon,
  FileSheetIcon,
  FilePdfIcon,
  FileCodeIcon,
  TableIcon,
  FileTextIcon,
} from './icons';
import { useUI } from '../contexts/UIContext';
import { useProject } from '../contexts/ProjectContext';
import { useChat } from '../contexts/ChatContext';
import BaseModal from './BaseModal';

type SearchResult =
  | { id: string; type: 'project'; title: string; subtitle: string; icon: any }
  | { id: string; type: 'worksheet'; title: string; subtitle: string; icon: any }
  | { id: string; type: 'report'; title: string; subtitle: string; icon: any }
  | { id: string; type: 'chat'; title: string; subtitle: string; icon: any }
  | { id: string; type: 'file'; title: string; subtitle: string; icon: any; payload: ProjectFile };

const GlobalTopBar: React.FC = () => {
  const navigate = useNavigate();
  const { projects, files, matrices, reports } = useProject();
  const { chats, setActiveThreadId } = useChat();
  const { showNotification } = useUI();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    const q = searchQuery.toLowerCase();
    const found: SearchResult[] = [];

    // 1) Projects
    projects.forEach((p) => {
      if (p.name.toLowerCase().includes(q)) {
        found.push({
          id: p.id,
          type: 'project',
          title: p.name,
          subtitle: `Project • ${p.status || 'Active'}`,
          icon: FolderIcon,
        });
      }
    });

    // 2) Worksheets
    matrices.forEach((m) => {
      if ((m.title || '').toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q)) {
        found.push({
          id: m.id,
          type: 'worksheet',
          title: m.title || 'Worksheet',
          subtitle: 'Worksheet',
          icon: TableIcon,
        });
      }
    });

    // 3) Reports
    reports.forEach((r) => {
      if ((r.title || '').toLowerCase().includes(q) || (r.content || '').toLowerCase().includes(q)) {
        found.push({
          id: r.id,
          type: 'report',
          title: r.title || 'Report',
          subtitle: 'Report',
          icon: FileTextIcon,
        });
      }
    });

    // 4) Sessions (Chats)
    (Object.values(chats).flat() as Chat[]).forEach((c) => {
      if (c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)) {
        found.push({
          id: c.id,
          type: 'chat',
          title: c.title,
          subtitle: `Chat • ${c.time}`,
          icon: ChatBubbleIcon,
        });
      }
    });

    // 5) Files
    (Object.values(files).flat() as ProjectFile[]).forEach((f) => {
      if (f.name.toLowerCase().includes(q)) {
        found.push({
          id: f.id,
          type: 'file',
          title: f.name,
          subtitle: 'File',
          icon: f.name.includes('pdf') ? FilePdfIcon : f.name.includes('xls') ? FileSheetIcon : FileCodeIcon,
          payload: f,
        });
      }
    });

    setResults(found.slice(0, 8));
  }, [searchQuery, projects, matrices, reports, chats, files]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const prefillNewResearch = (query: string) => {
    // Force "new session" UI (dashboard) and prefill the primary composer.
    setActiveThreadId(null);
    localStorage.setItem('weflora-home-draft', query);
    window.dispatchEvent(new CustomEvent('weflora:draft', { detail: { draftKey: 'weflora-home-draft', value: query } }));
    navigate('/');
  };

  const handleResultClick = (result: SearchResult) => {
    setIsSearchFocused(false);
    setSearchQuery('');

    if (result.type === 'project') {
      navigate(`/project/${result.id}`);
      return;
    }
    if (result.type === 'worksheet') {
      navigate(`/worksheets/${result.id}`);
      return;
    }
    if (result.type === 'report') {
      navigate(`/reports/${result.id}`);
      return;
    }
    if (result.type === 'chat') {
      navigate('/sessions');
      return;
    }
    if (result.type === 'file') {
      // Keep behavior conservative: go to knowledge base for files
      navigate('/files');
      return;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (results.length > 0) handleResultClick(results[0]);
      else if (searchQuery.trim()) {
        prefillNewResearch(searchQuery.trim());
        setIsSearchFocused(false);
        setSearchQuery('');
      }
    }
  };

  return (
    <div className="flex-none sticky top-0 z-40 border-b border-slate-200/30 bg-weflora-mintLight">
      <div className="h-14 px-4 flex items-center gap-3">
        <div className="flex-1 relative" ref={searchRef}>
          <div className="relative">
            <SearchIcon className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${isSearchFocused ? 'text-weflora-teal' : 'text-slate-400'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchFocused(true);
              }}
              onFocus={() => setIsSearchFocused(true)}
              onKeyDown={handleKeyDown}
              placeholder="Search WeFlora…"
              className={`w-full pl-9 pr-14 py-2 rounded-lg text-sm outline-none border transition-colors ${
                isSearchFocused ? 'bg-white border-weflora-teal ring-2 ring-weflora-teal/30' : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <kbd className="hidden md:inline-flex items-center h-5 px-1.5 border border-slate-200 bg-white rounded text-[10px] font-sans font-medium text-slate-500">
                ⌘K
              </kbd>
            </div>
          </div>

          {isSearchFocused && searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn z-50 max-h-[70vh] overflow-y-auto">
              <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">Search WeFlora</div>
              <ul>
                {results.slice(0, 5).map((r, idx) => (
                  <li key={r.id + idx}>
                    <button
                      onClick={() => handleResultClick(r)}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-l-2 ${
                        idx === 0 ? 'bg-slate-50 border-weflora-teal' : 'border-transparent'
                      }`}
                    >
                      <div
                        className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          r.type === 'project'
                            ? 'bg-weflora-mint/20 text-weflora-teal'
                            : r.type === 'worksheet'
                              ? 'bg-weflora-mint/20 text-weflora-teal'
                              : r.type === 'report'
                                ? 'bg-weflora-teal/10 text-weflora-teal'
                                : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <r.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-800 truncate">{r.title}</div>
                        <div className="text-xs text-slate-500 truncate">{r.subtitle}</div>
                      </div>
                    </button>
                  </li>
                ))}

                <li className="border-t border-slate-100">
                  <button
                    onClick={() => {
                      const q = searchQuery.trim();
                      if (!q) return;
                      prefillNewResearch(q);
                      setIsSearchFocused(false);
                      setSearchQuery('');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-weflora-teal/10 text-weflora-dark">
                      <SparklesIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-800 truncate">Ask FloraGPT: “{searchQuery}”</div>
                      <div className="text-xs text-slate-500 truncate">Start a new research session with this prompt</div>
                    </div>
                  </button>
                </li>
              </ul>
            </div>
          )}
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
        </div>
      </div>

      <BaseModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="Help & Shortcuts" size="md">
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Global Search</span>
              <kbd className="bg-white border border-slate-200 px-1.5 rounded text-xs font-mono">⌘K</kbd>
            </div>
          </div>
        </div>
      </BaseModal>
    </div>
  );
};

export default GlobalTopBar;

