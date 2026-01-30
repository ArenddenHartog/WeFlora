import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { FEATURES } from '../src/config/features';

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
  const { showNotification, openAssistantPanel, setSessionOpenOrigin } = useUI();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0); // keyboard nav within dropdown
  const searchRef = useRef<HTMLDivElement>(null);

  const normalizedQuery = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

  useEffect(() => {
    if (!normalizedQuery) {
      setResults([]);
      return;
    }

    const q = normalizedQuery;

    const scoreText = (text: string) => {
      const t = (text || '').toLowerCase();
      if (!t) return 0;
      if (t === q) return 120;
      if (t.startsWith(q)) return 100;
      if (t.includes(q)) return 60;
      return 0;
    };

    const scored: Array<{ score: number; hit: SearchResult }> = [];

    // 1) Projects
    projects.forEach((p) => {
      const score = scoreText(p.name) + scoreText(p.status || '');
      if (score <= 0) return;
      scored.push({
        score,
        hit: { id: p.id, type: 'project', title: p.name, subtitle: `Project • ${p.status || 'Active'}`, icon: FolderIcon },
      });
    });

    // 2) Worksheets
    matrices.forEach((m) => {
      const score = scoreText(m.title || '') + scoreText(m.description || '');
      if (score <= 0) return;
      scored.push({
        score,
        hit: { id: m.id, type: 'worksheet', title: m.title || 'Worksheet', subtitle: 'Worksheet', icon: TableIcon },
      });
    });

    // 3) Reports
    reports.forEach((r) => {
      const score = scoreText(r.title || '') + (r.content ? 10 : 0) + scoreText(r.content || '');
      if (score <= 0) return;
      scored.push({
        score,
        hit: { id: r.id, type: 'report', title: r.title || 'Report', subtitle: 'Report', icon: FileTextIcon },
      });
    });

    // 4) Sessions (Chats)
    (Object.values(chats).flat() as Chat[]).forEach((c) => {
      const score = scoreText(c.title) + scoreText(c.description);
      if (score <= 0) return;
      scored.push({
        score,
        hit: { id: c.id, type: 'chat', title: c.title, subtitle: `Session • ${c.time}`, icon: ChatBubbleIcon },
      });
    });

    // 5) Files
    (Object.values(files).flat() as ProjectFile[]).forEach((f) => {
      const score = scoreText(f.name);
      if (score <= 0) return;
      scored.push({
        score,
        hit: {
          id: f.id,
          type: 'file',
          title: f.name,
          subtitle: 'File',
          icon: f.name.includes('pdf') ? FilePdfIcon : f.name.includes('xls') ? FileSheetIcon : FileCodeIcon,
          payload: f,
        },
      });
    });

    const MAX_RESULTS = 5;
    const ordered = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((s) => s.hit);

    setResults(ordered);
    setActiveIndex(0);
  }, [normalizedQuery, projects, matrices, reports, chats, files]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openAskPanelWithDraft = (query: string) => {
    // Start a new research: clear active thread, open global panel, and prefill input (no navigation).
    setActiveThreadId(null);
    openAssistantPanel(query);
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
      setSessionOpenOrigin('other');
      navigate('/research-history');
      return;
    }
    if (result.type === 'file') {
      // Keep behavior conservative: go to knowledge base for files
      navigate('/files');
      return;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isSearchFocused) return;

    const q = searchQuery.trim();
    const hasQuery = Boolean(q);
    const maxIndex = results.length + (hasQuery ? 1 : 0) - 1; // +1 for Ask row

    if (e.key === 'Escape') {
      setIsSearchFocused(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (maxIndex < 0) return;
      setActiveIndex((i) => (i >= maxIndex ? 0 : i + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (maxIndex < 0) return;
      setActiveIndex((i) => (i <= 0 ? maxIndex : i - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!hasQuery) return;
      if (activeIndex < results.length) {
        handleResultClick(results[activeIndex]);
        return;
      }
      openAskPanelWithDraft(q);
      setIsSearchFocused(false);
      setSearchQuery('');
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
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-weflora-teal/10 overflow-hidden animate-fadeIn z-50 max-h-[70vh] overflow-y-auto">
              <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">Search WeFlora</div>
              <ul>
                {results.slice(0, 5).map((r, idx) => (
                  <li key={r.id + idx}>
                    <button
                      onClick={() => handleResultClick(r)}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left border-l-2 ${
                        activeIndex === idx ? 'bg-weflora-teal/10 border-weflora-teal' : 'border-transparent hover:bg-slate-50'
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
                      <div className="flex-shrink-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                          {r.type}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}

                <li className="border-t border-slate-100">
                  <button
                    onClick={() => {
                      const q = searchQuery.trim();
                      if (!q) return;
                      openAskPanelWithDraft(q);
                      setIsSearchFocused(false);
                      setSearchQuery('');
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                      activeIndex === results.length ? 'bg-weflora-teal/10' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-weflora-teal/10 text-weflora-dark">
                      <SparklesIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-800 truncate">Ask FloraGPT: '{searchQuery.trim()}'</div>
                      <div className="text-xs text-slate-500 truncate">Start a new research with this prompt</div>
                    </div>
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {FEATURES.quickAskPanel && (
            <button
              onClick={() => {
                setActiveThreadId(null);
                openAssistantPanel('');
              }}
              className="p-2 text-slate-600 hover:text-weflora-dark hover:bg-white/60 rounded-lg transition-colors"
              title="Quick Ask"
            >
              <SparklesIcon className="h-5 w-5" />
            </button>
          )}
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

