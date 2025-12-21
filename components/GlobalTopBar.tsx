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
} from './icons';
import { useUI } from '../contexts/UIContext';
import { useProject } from '../contexts/ProjectContext';
import { useChat } from '../contexts/ChatContext';
import BaseModal from './BaseModal';

type SearchResult =
  | { id: string; type: 'action'; title: string; subtitle: string; icon: any }
  | { id: string; type: 'project'; title: string; subtitle: string; icon: any }
  | { id: string; type: 'chat'; title: string; subtitle: string; icon: any }
  | { id: string; type: 'file'; title: string; subtitle: string; icon: any; payload: ProjectFile };

const GlobalTopBar: React.FC = () => {
  const navigate = useNavigate();
  const { projects, files } = useProject();
  const { chats, sendMessage } = useChat();
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

    // 1) "Ask AI" action (global)
    found.push({
      id: 'action-ask',
      type: 'action',
      title: `Ask FloraGPT: "${searchQuery}"`,
      subtitle: 'Start a new AI session with this prompt',
      icon: SparklesIcon,
    });

    // 2) Projects
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

    // 3) Chats
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

    // 4) Files
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
    sendMessage(query, undefined, undefined, undefined, [], 'home', false, true);
  };

  const handleResultClick = (result: SearchResult) => {
    setIsSearchFocused(false);
    const query = searchQuery;
    setSearchQuery('');

    if (result.type === 'action') {
      handleGlobalQuery(query);
      return;
    }
    if (result.type === 'project') {
      navigate(`/project/${result.id}`);
      return;
    }
    if (result.type === 'chat') {
      navigate('/chat');
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
      else handleGlobalQuery(searchQuery);
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
              placeholder="Search for anything or Ask FloraGPT…"
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
              {results.length > 0 ? (
                <>
                  <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">Suggested</div>
                  <ul>
                    {results.map((r, idx) => (
                      <li key={r.id + idx}>
                        <button
                          onClick={() => handleResultClick(r)}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-l-2 ${
                            idx === 0 ? 'bg-slate-50 border-weflora-teal' : 'border-transparent'
                          }`}
                        >
                          <div
                            className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              r.type === 'action'
                                ? 'bg-weflora-teal/10 text-weflora-dark'
                                : r.type === 'project'
                                  ? 'bg-weflora-mint/20 text-weflora-teal'
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
                  </ul>
                </>
              ) : (
                <div className="p-6 text-center text-slate-500">
                  <p>No results for “{searchQuery}”</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => {
              if (!searchQuery.trim()) {
                setIsSearchFocused(true);
                return;
              }
              handleGlobalQuery(searchQuery);
              setSearchQuery('');
              setIsSearchFocused(false);
            }}
            className="p-2 text-slate-600 hover:text-weflora-dark hover:bg-white/60 rounded-lg transition-colors"
            title="Ask FloraGPT"
          >
            <SparklesIcon className="h-5 w-5" />
          </button>
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

