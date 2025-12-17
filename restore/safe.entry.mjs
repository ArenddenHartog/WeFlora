/**
 * restore/safe.entry.mjs
 * Backup of the lightweight Safe Shell.
 */
export function mount(rootElement, React, createRoot) {
    console.log("[SAFE-BACKUP] mount() called");
    const e = React.createElement;
    
    function Sidebar() {
        const items = [
            { label: 'Research', icon: '🔍', active: true },
            { label: 'Projects', icon: '📁' },
            { label: 'Worksheets', icon: '📊' },
            { label: 'Reports', icon: '📄' },
        ];

        return e('aside', { className: 'w-64 bg-slate-50 border-r border-slate-200 h-full flex flex-col flex-shrink-0' },
            e('div', { className: 'h-16 flex items-center px-6 border-b border-slate-100' },
                e('div', { className: 'h-8 w-8 bg-teal-600 rounded-lg flex items-center justify-center text-white font-bold mr-3' }, 'W'),
                e('span', { className: 'font-bold text-slate-800' }, 'WeFlora Safe')
            ),
            e('nav', { className: 'flex-1 p-4 space-y-1' },
                items.map(item => 
                    e('button', { 
                        key: item.label,
                        className: `w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            item.active ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'
                        }`
                    }, 
                        e('span', {}, item.icon),
                        e('span', {}, item.label)
                    )
                )
            )
        );
    }

    function App() {
        return e('div', { className: 'flex h-screen w-full font-sans text-slate-900 bg-white overflow-hidden' },
            e(Sidebar),
            e('main', { className: 'flex-1 flex items-center justify-center' }, 'Safe Mode Backup')
        );
    }

    const root = createRoot(rootElement);
    root.render(e(App));
}