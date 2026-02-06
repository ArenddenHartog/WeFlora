import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { getTelemetryEvents } from '../../src/agentic/telemetry/telemetry';
import { getDebugState, getLastError, getLastRpcCall } from '../../utils/safeAction';
import { supabase } from '../../services/supabaseClient';

// Import the context directly to check if it exists without throwing
import { UIContext } from '../../contexts/UIContext';

// Build stamp (injected by Vite at build time)
declare const __BUILD_SHA__: string;
declare const __BUILD_TIME__: string;

type DebugTab = 'state' | 'backend' | 'telemetry' | 'errors';

/**
 * List of critical RPCs that must be deployed for the app to function
 */
const REQUIRED_RPCS = [
  { name: 'vault_claim_next_review', description: 'Review queue claim' },
  { name: 'vault_update_review', description: 'Review updates' },
  { name: 'planner_bootstrap_intervention', description: 'Planner init' },
  { name: 'pciv_bootstrap_scope', description: 'PCIV scope init' },
] as const;

type RpcHealthStatus = 'checking' | 'ok' | 'missing' | 'error';

interface RpcHealth {
  name: string;
  description: string;
  status: RpcHealthStatus;
  error?: string;
}

interface BackendInfo {
  supabaseUrl: string;
  supabaseHost: string;
  schemaVersion: string | null;
  featureFlags: Record<string, boolean>;
  rpcHealth: RpcHealth[];
  checkedAt: string | null;
}

const DebugPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DebugTab>('state');
  const [copySuccess, setCopySuccess] = useState(false);
  const [authStatus, setAuthStatus] = useState<{
    authenticated: boolean;
    userId: string | null;
    email: string | null;
  } | null>(null);
  
  const [backendInfo, setBackendInfo] = useState<BackendInfo>(() => {
    // Extract Supabase URL from the client
    const url = (supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL || '';
    const host = url ? new URL(url).host : 'unknown';
    
    return {
      supabaseUrl: url,
      supabaseHost: host,
      schemaVersion: null,
      featureFlags: {
        DEV: (import.meta as any).env?.DEV ?? false,
        PROD: (import.meta as any).env?.PROD ?? false,
      },
      rpcHealth: REQUIRED_RPCS.map(rpc => ({
        name: rpc.name,
        description: rpc.description,
        status: 'checking' as RpcHealthStatus,
      })),
      checkedAt: null,
    };
  });
  
  const location = useLocation();
  const params = useParams();
  const events = getTelemetryEvents();
  const debugState = getDebugState();
  const lastError = getLastError();
  const lastRpcCall = getLastRpcCall();
  
  // Get UI context safely - useContext returns undefined if not in provider
  // This is safe because useContext doesn't throw when context is missing
  const uiContext = useContext(UIContext);

  // Parse URL params
  const urlParams = new URLSearchParams(location.search);
  const selectedFromUrl = urlParams.get('selected') || urlParams.get('record') || urlParams.get('id') || null;
  const intentFromUrl = urlParams.get('intent') || null;

  // Get localStorage session info
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);
  
  /**
   * Check if an RPC exists by calling it with invalid params
   * PGRST202 = function not found
   * Any other error = function exists but params wrong (which is fine)
   */
  const checkRpcExists = useCallback(async (rpcName: string): Promise<{ exists: boolean; error?: string }> => {
    try {
      // Call with empty params - we expect it to fail, but HOW it fails tells us if it exists
      const { error } = await supabase.rpc(rpcName, {});
      
      if (error) {
        // PGRST202 = function not found in schema cache
        if (error.code === 'PGRST202') {
          return { exists: false, error: 'Function not deployed' };
        }
        // Any other error means the function exists but params are wrong
        return { exists: true };
      }
      
      // No error means it worked (unlikely with empty params, but ok)
      return { exists: true };
    } catch (err) {
      return { exists: false, error: String(err) };
    }
  }, []);

  /**
   * Check all required RPCs
   */
  const checkAllRpcs = useCallback(async () => {
    const results: RpcHealth[] = [];
    
    for (const rpc of REQUIRED_RPCS) {
      const result = await checkRpcExists(rpc.name);
      results.push({
        name: rpc.name,
        description: rpc.description,
        status: result.exists ? 'ok' : 'missing',
        error: result.error,
      });
    }
    
    setBackendInfo(prev => ({
      ...prev,
      rpcHealth: results,
      checkedAt: new Date().toISOString(),
    }));
  }, [checkRpcExists]);

  /**
   * Fetch schema version from app_meta table (if exists)
   */
  const fetchSchemaVersion = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('app_meta')
        .select('value')
        .eq('key', 'schema_version')
        .single();
      
      if (!error && data) {
        setBackendInfo(prev => ({
          ...prev,
          schemaVersion: data.value,
        }));
      }
    } catch {
      // Table doesn't exist or other error - leave as null
    }
  }, []);
  
  // Check auth status when panel opens
  useEffect(() => {
    if (!open) return;
    
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setAuthStatus({
          authenticated: !!user,
          userId: user?.id || null,
          email: user?.email || null
        });
      } catch {
        setAuthStatus({ authenticated: false, userId: null, email: null });
      }
    };
    
    checkAuth();
  }, [open]);
  
  // Check backend health when backend tab is opened
  useEffect(() => {
    if (!open || activeTab !== 'backend') return;
    
    // Only check if we haven't checked in the last 30 seconds
    const lastCheck = backendInfo.checkedAt ? new Date(backendInfo.checkedAt).getTime() : 0;
    const now = Date.now();
    if (now - lastCheck < 30000) return;
    
    checkAllRpcs();
    fetchSchemaVersion();
  }, [open, activeTab, backendInfo.checkedAt, checkAllRpcs, fetchSchemaVersion]);

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
  
  // Build info
  const buildInfo = {
    sha: typeof __BUILD_SHA__ !== 'undefined' ? __BUILD_SHA__ : 'dev',
    time: typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString(),
    mode: (import.meta as any).env?.MODE || 'development'
  };

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
      auth: authStatus,
      backend: {
        supabaseHost: backendInfo.supabaseHost,
        schemaVersion: backendInfo.schemaVersion,
        rpcHealth: backendInfo.rpcHealth.map(r => ({ name: r.name, status: r.status })),
        checkedAt: backendInfo.checkedAt,
      },
      debug: {
        lastTraceId: debugState.lastTraceId,
        lastError: debugState.lastError,
        lastRpcCall: debugState.lastRpcCall,
        lastSessionId
      },
      build: buildInfo,
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
              {(['state', 'backend', 'telemetry', 'errors'] as const).map((tab) => (
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
                {/* Auth Status - Critical for RLS */}
                <div className={`rounded-lg border p-2 ${authStatus?.authenticated ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                  <p className={`font-semibold text-[10px] uppercase tracking-wide mb-2 ${authStatus?.authenticated ? 'text-emerald-700' : 'text-rose-700'}`}>Auth Status</p>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className={authStatus?.authenticated ? 'text-emerald-600' : 'text-rose-600'}>Authenticated</span>
                      <span className={`font-semibold ${authStatus?.authenticated ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {authStatus?.authenticated ? 'Yes' : 'No'}
                      </span>
                    </div>
                    {authStatus?.userId && (
                      <div className="flex justify-between">
                        <span className="text-emerald-600">User ID</span>
                        <span className="font-mono text-emerald-700 truncate max-w-[180px]">{authStatus.userId}</span>
                      </div>
                    )}
                    {!authStatus?.authenticated && (
                      <p className="text-rose-600 text-[10px] mt-1">
                        Warning: RPC calls using auth.uid() will return empty results.
                      </p>
                    )}
                  </div>
                </div>

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

                {/* Last RPC Call */}
                {lastRpcCall && (
                  <div className={`rounded-lg border p-2 ${lastRpcCall.status && lastRpcCall.status >= 400 ? 'border-amber-200 bg-amber-50' : 'border-slate-200'}`}>
                    <p className="font-semibold text-slate-700 text-[10px] uppercase tracking-wide mb-2">Last RPC Call</p>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Name</span>
                        <span className="font-mono text-slate-700">{lastRpcCall.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Status</span>
                        <span className={`font-mono ${lastRpcCall.status && lastRpcCall.status >= 400 ? 'text-amber-700' : 'text-slate-700'}`}>
                          {lastRpcCall.status ?? '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Latency</span>
                        <span className="font-mono text-slate-700">{lastRpcCall.latencyMs}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Auth Header</span>
                        <span className={`font-semibold ${lastRpcCall.hasAuthHeader ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {lastRpcCall.hasAuthHeader ? 'Present' : 'Missing'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">API Key</span>
                        <span className={`font-semibold ${lastRpcCall.hasApiKey ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {lastRpcCall.hasApiKey ? 'Present' : 'Missing'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Build Info */}
                <div className="rounded-lg border border-slate-200 p-2">
                  <p className="font-semibold text-slate-700 text-[10px] uppercase tracking-wide mb-2">Build Stamp</p>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">SHA</span>
                      <span className="font-mono text-slate-700 truncate max-w-[180px]">{buildInfo.sha}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Time</span>
                      <span className="font-mono text-slate-700 text-[10px]">{buildInfo.time}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Mode</span>
                      <span className="font-mono text-slate-700">{buildInfo.mode}</span>
                    </div>
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

            {activeTab === 'backend' && (
              <div className="space-y-3">
                {/* Supabase Connection */}
                <div className="rounded-lg border border-slate-200 p-2">
                  <p className="font-semibold text-slate-700 text-[10px] uppercase tracking-wide mb-2">Supabase Connection</p>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Host</span>
                      <span className="font-mono text-slate-700 truncate max-w-[200px]">{backendInfo.supabaseHost}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Schema Version</span>
                      <span className="font-mono text-slate-700">{backendInfo.schemaVersion || 'unknown'}</span>
                    </div>
                  </div>
                </div>

                {/* Feature Flags */}
                <div className="rounded-lg border border-slate-200 p-2">
                  <p className="font-semibold text-slate-700 text-[10px] uppercase tracking-wide mb-2">Environment</p>
                  <div className="flex gap-2">
                    {Object.entries(backendInfo.featureFlags).map(([flag, enabled]) => (
                      <span
                        key={flag}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          enabled 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* RPC Health Checks */}
                <div className="rounded-lg border border-slate-200 p-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-slate-700 text-[10px] uppercase tracking-wide">RPC Health</p>
                    <button
                      type="button"
                      onClick={() => {
                        setBackendInfo(prev => ({ ...prev, checkedAt: null }));
                        checkAllRpcs();
                      }}
                      className="text-[10px] text-slate-500 hover:text-slate-700"
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {backendInfo.rpcHealth.map((rpc) => (
                      <div key={rpc.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            rpc.status === 'ok' ? 'bg-emerald-500' :
                            rpc.status === 'missing' ? 'bg-rose-500' :
                            rpc.status === 'checking' ? 'bg-amber-500 animate-pulse' :
                            'bg-slate-300'
                          }`} />
                          <span className="font-mono text-[10px] text-slate-700">{rpc.name}</span>
                        </div>
                        <span className={`text-[10px] ${
                          rpc.status === 'ok' ? 'text-emerald-600' :
                          rpc.status === 'missing' ? 'text-rose-600' :
                          'text-slate-500'
                        }`}>
                          {rpc.status === 'ok' ? '✓ Deployed' :
                           rpc.status === 'missing' ? '✗ Missing' :
                           rpc.status === 'checking' ? 'Checking...' :
                           'Unknown'}
                        </span>
                      </div>
                    ))}
                  </div>
                  {backendInfo.checkedAt && (
                    <p className="text-[10px] text-slate-400 mt-2">
                      Last checked: {new Date(backendInfo.checkedAt).toLocaleTimeString()}
                    </p>
                  )}
                </div>

                {/* Missing RPC Warning */}
                {backendInfo.rpcHealth.some(r => r.status === 'missing') && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-2">
                    <p className="font-semibold text-rose-700 text-[10px] uppercase tracking-wide mb-1">⚠️ Backend Mismatch</p>
                    <p className="text-rose-600 text-[10px]">
                      Some required RPCs are not deployed. Run migrations or check Supabase project.
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {backendInfo.rpcHealth
                        .filter(r => r.status === 'missing')
                        .map(r => (
                          <li key={r.name} className="text-[10px] text-rose-700 font-mono">
                            • {r.name}
                          </li>
                        ))}
                    </ul>
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
