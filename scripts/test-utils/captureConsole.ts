export interface ConsoleEntry {
  level: 'log' | 'warn' | 'error';
  args: unknown[];
}

export const captureConsole = async <T>(callback: () => Promise<T> | T) => {
  const entries: ConsoleEntry[] = [];
  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error
  };

  console.log = (...args: unknown[]) => {
    entries.push({ level: 'log', args });
  };
  console.warn = (...args: unknown[]) => {
    entries.push({ level: 'warn', args });
  };
  console.error = (...args: unknown[]) => {
    entries.push({ level: 'error', args });
  };

  try {
    const result = await callback();
    return { result, entries };
  } finally {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  }
};
