import React, { useContext, useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { getTelemetryEvents } from '../../src/agentic/telemetry/telemetry';
import { getDebugState, getLastError } from '../../utils/safeAction';

// Import the context directly to check if it exists without throwing
import { UIContext } from '../../contexts/UIContext';

type DebugTab = 'state' | 'telemetry' | 'errors';

const DebugPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DebugTab>('state');
  const [copySuccess, setCopySuccess] = useState(false);
  
  const location = useLocation();
  const params = useParams();
  const events = getTelemetryEvents();
  const debugState = getDebugState();
  const lastError = getLastError();
  
  // Get UI context safely - useContext returns undefined if not in provider
  // This is safe because useContext doesn't throw when context is missing
  const uiContext = useContext(UIContext);

  // Parse URL params
  const urlParams = new URLSearchParams(location.search);
  const selectedFromUrl = urlParams.get('selected') || urlParams.get('record') || null;
  const intentFromUrl = urlParams.get('intent') || null;

  // Get localStorage session info
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('weflora.sessions.v1');
      if (raw) {
        const sessions = JSON.parse(raw);
        if (Array.isArray(sessions) && sessions.length > 0) {
          setLastSessionId(sessions[0]?.session?.session_id || null);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, [open]);

  if (!(import.meta as any).env?.DEV) return null;

  const handleCopyDebugState = async () => {
    const state = {
      route: {
        pathname: location.pathname,
        search: location.search,
        params,
        selectedId: selectedFromUrl,
        intent: intentFromUrl
      },
      ui: uiContext ? {
        selectedProjectId: uiContext.selectedProjectId,
        selectedChatId: uiContext.selectedChatId,
        isSidebarOpen: uiContext.isSidebarOpen
      } : null,
      debug: {
        lastTraceId: debugState.lastTraceId,
        lastError: debugState.lastError,
        lastSessionId
      },
      telemetry: {
        eventCount: events.length,
        recentEvents: events.slice(0, 5).map(e => ({ name: e.name, at: e.at }))
      },
      timestamp: new Date().toISOString()
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(state, null, 2));
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Ignore clipboard errors
    }
  };

  const errorEvents = events.filter(e => 
    e.name.includes('error') || 
    e.name.includes('failed') ||
    e.payload?.error
  );

  return (
    <div className="fixed bottom-4 right-4 z-[100]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`rounded-full px-4 py-2 text-xs font-semibold text-white transition-colors ${
          lastError ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-slate-800'
        }`}
      >
        {lastError ? 'Debug (Error)' : 'Debug'}
      </button>
      
      {open ? (
        <div className="mt-2 max-h-[480px] w-[420px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl flex flex-col">
          {/* Header */}
          <div className="border-b border-slate-200 px-3 py-2 flex items-center justify-between bg-slate-50">
            <div className="flex gap-1">
              {(['state', 'telemetry', 'errors'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                    activeTab === tab 
                      ? 'bg-slate-200 text-slate-900' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab === 'errors' && errorEvents.length > 0 && (
                    <span className="mr-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-rose-500 text-[10px] text-white">
                      {errorEvents.length}
                    </span>
                  )}
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleCopyDebugState}
              className="px-2 py-1 rounded text-[10px] font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            >
              {copySuccess ? 'Copied!' : 'Copy All'}
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-3 text-xs text-slate-600">
            {activeTab === 'state' && (
              <div className="space-y-3">
                {/* Route Info */}
                <div className="rounded-lg border border-slate-200 p-2">
                  <p className="font-semibold text-slate-700 text-[10px] uppercase tracking-wide mb-2">Route</p>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Path</span>
                      <span className="font-mono text-slate-700">{location.pathname}</span>
                    </div>
                    {location.search && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Search</span>
                        <span className="font-mono text-slate-700 truncate max-w-[200px]">{location.search}</span>
                      </div>
                    )}
                    {Object.keys(params).length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Params</span>
                        <span className="font-mono text-slate-700">{JSON.stringify(params)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Selected IDs */}
                <div className="rounded-lg border border-slate-200 p-2">
                  <p className="font-semibold text-slate-700 text-[10px] uppercase tracking-wide mb-2">Selected IDs</p>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">URL selected</span>
                      <span className="font-mono text-slate-700">{selectedFromUrl || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">URL intent</span>
                      <span className="font-mono text-slate-700">{intentFromUrl || '—'}</span>
                    </div>
                    {uiContext && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Project</span>
                          <span className="font-mono text-slate-700">{uiContext.selectedProjectId || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Chat</span>
                          <span className="font-mono text-slate-700">{uiContext.selectedChatId || '—'}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Last Session */}
                <div className="rounded-lg border border-slate-200 p-2">
                  <p className="font-semibold text-slate-700 text-[10px] uppercase tracking-wide mb-2">Sessions</p>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Last session</span>
                    <span className="font-mono text-slate-700 truncate max-w-[180px]">{lastSessionId || '—'}</span>
                  </div>
                </div>

                {/* Last Error */}
                {lastError && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-2">
                    <p className="font-semibold text-rose-700 text-[10px] uppercase tracking-wide mb-2">Last Error</p>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-rose-500">Trace ID</span>
                        <span className="font-mono text-rose-700">{lastError.traceId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-rose-500">At</span>
                        <span className="text-rose-700">{new Date(lastError.at).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-rose-700 mt-1 break-words">{lastError.message}</p>
                    </div>
                  </div>
                )}

                {/* Trace ID */}
                {debugState.lastTraceId && (
                  <div className="rounded-lg border border-slate-200 p-2">
                    <p className="font-semibold text-slate-700 text-[10px] uppercase tracking-wide mb-2">Last Action</p>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Trace ID</span>
                      <span className="font-mono text-slate-700">{debugState.lastTraceId}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'telemetry' && (
              <div className="space-y-2">
                {events.length === 0 ? (
                  <p className="text-slate-400">No telemetry events.</p>
                ) : (
                  events.slice(0, 20).map((event, index) => (
                    <div key={`${event.name}-${index}`} className="rounded-lg border border-slate-100 p-2">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-slate-700">{event.name}</p>
                        <p className="text-[10px] text-slate-400">{new Date(event.at).toLocaleTimeString()}</p>
                      </div>
                      {event.payload ? (
                        <pre className="mt-1 whitespace-pre-wrap text-[10px] text-slate-500 bg-slate-50 rounded p-1 max-h-20 overflow-auto">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  ))
                )}
                {events.length > 20 && (
                  <p className="text-[10px] text-slate-400 text-center">
                    Showing 20 of {events.length} events
                  </p>
                )}
              </div>
            )}

            {activeTab === 'errors' && (
              <div className="space-y-2">
                {errorEvents.length === 0 ? (
                  <p className="text-slate-400">No error events.</p>
                ) : (
                  errorEvents.map((event, index) => (
                    <div key={`${event.name}-${index}`} className="rounded-lg border border-rose-200 bg-rose-50 p-2">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-rose-700">{event.name}</p>
                        <p className="text-[10px] text-rose-400">{new Date(event.at).toLocaleTimeString()}</p>
                      </div>
                      {event.payload ? (
                        <pre className="mt-1 whitespace-pre-wrap text-[10px] text-rose-600 bg-rose-100 rounded p-1 max-h-24 overflow-auto">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DebugPanel;
