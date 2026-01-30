import React, { useState } from 'react';
import { getTelemetryEvents } from '../../src/agentic/telemetry/telemetry';

const DebugPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const events = getTelemetryEvents();

  if (!(import.meta as any).env?.DEV) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
      >
        Debug
      </button>
      {open ? (
        <div className="mt-2 max-h-[360px] w-[360px] overflow-auto rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-xl">
          <p className="font-semibold text-slate-700">Telemetry</p>
          <div className="mt-2 space-y-2">
            {events.length === 0 ? (
              <p>No telemetry events.</p>
            ) : (
              events.map((event, index) => (
                <div key={`${event.name}-${index}`} className="rounded-lg border border-slate-100 p-2">
                  <p className="font-semibold text-slate-700">{event.name}</p>
                  <p className="mt-1 text-[10px] text-slate-400">{event.at}</p>
                  {event.payload ? (
                    <pre className="mt-1 whitespace-pre-wrap text-[10px] text-slate-500">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DebugPanel;
