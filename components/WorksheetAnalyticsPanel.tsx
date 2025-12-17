
import React, { useMemo } from 'react';
import type { Matrix, MatrixColumn } from '../types';
import { ChartPieIcon, XIcon, BarChartIcon, DatabaseIcon } from './icons';

interface WorksheetAnalyticsPanelProps {
    matrix: Matrix;
    onClose: () => void;
}

const WorksheetAnalyticsPanel: React.FC<WorksheetAnalyticsPanelProps> = ({ matrix, onClose }) => {
    
    // Compute stats only when matrix data changes
    const analysis = useMemo(() => {
        return matrix.columns.map(col => {
            const values = matrix.rows
                .map(r => r.cells[col.id]?.value)
                .filter(v => v !== undefined && v !== '')
                .map(v => String(v));

            if (values.length === 0) return null;

            // Numeric Analysis
            if (col.type === 'number') {
                const nums = values.map(v => parseFloat(v)).filter(n => !isNaN(n));
                if (nums.length === 0) return null;
                const sum = nums.reduce((a, b) => a + b, 0);
                const avg = sum / nums.length;
                const min = Math.min(...nums);
                const max = Math.max(...nums);
                
                return {
                    colId: col.id,
                    title: col.title,
                    type: 'number',
                    stats: { sum, avg: avg.toFixed(1), min, max, count: nums.length }
                };
            }

            // Categorical Analysis (Select, Text, AI)
            // For text/AI, only analyze if cardinality is somewhat low (< 20 unique values) to avoid noise
            const uniqueValues = new Set(values);
            if (col.type !== 'select' && uniqueValues.size > 20) return null;

            const freqMap: Record<string, number> = {};
            values.forEach(v => {
                // Clean AI output like "Suitable - Reason" -> "Suitable"
                let key = v;
                if (col.type === 'ai') {
                    key = v.split('-')[0].split('(')[0].trim();
                }
                freqMap[key] = (freqMap[key] || 0) + 1;
            });

            const sortedDistribution = Object.entries(freqMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8); // Top 8 only

            return {
                colId: col.id,
                title: col.title,
                type: 'categorical',
                total: values.length,
                distribution: sortedDistribution
            };
        }).filter(Boolean);
    }, [matrix]);

    const colors = ['bg-blue-500', 'bg-weflora-teal', 'bg-purple-500', 'bg-orange-400', 'bg-red-400', 'bg-slate-500', 'bg-indigo-400', 'bg-pink-400'];

    if (!matrix) return null;

    return (
        <div className="flex flex-col h-full bg-slate-50 border-l border-slate-200">
            <header className="p-4 border-b border-slate-200 bg-white flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                    <ChartPieIcon className="h-5 w-5 text-weflora-teal" />
                    Data Visualizer
                </div>
                <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600">
                    <XIcon className="h-5 w-5" />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                {matrix.rows.length === 0 ? (
                    <div className="text-center text-slate-400 py-10">
                        <DatabaseIcon className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        <p className="text-sm">Add data to see insights.</p>
                    </div>
                ) : analysis.length === 0 ? (
                    <div className="text-center text-slate-400 py-10">
                        <BarChartIcon className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        <p className="text-sm">No visualizeable columns found.</p>
                    </div>
                ) : (
                    analysis.map((item: any) => (
                        <div key={item.colId} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-fadeIn">
                            <h3 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">{item.title}</h3>
                            
                            {item.type === 'number' ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 p-2 rounded-lg text-center">
                                        <div className="text-[10px] text-slate-500 uppercase">Average</div>
                                        <div className="text-lg font-bold text-slate-800">{item.stats.avg}</div>
                                    </div>
                                    <div className="bg-slate-50 p-2 rounded-lg text-center">
                                        <div className="text-[10px] text-slate-500 uppercase">Total</div>
                                        <div className="text-lg font-bold text-slate-800">{item.stats.sum}</div>
                                    </div>
                                    <div className="bg-slate-50 p-2 rounded-lg text-center">
                                        <div className="text-[10px] text-slate-500 uppercase">Min</div>
                                        <div className="text-lg font-bold text-slate-800">{item.stats.min}</div>
                                    </div>
                                    <div className="bg-slate-50 p-2 rounded-lg text-center">
                                        <div className="text-[10px] text-slate-500 uppercase">Max</div>
                                        <div className="text-lg font-bold text-slate-800">{item.stats.max}</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {item.distribution.map(([label, count]: [string, number], idx: number) => {
                                        const percentage = Math.round((count / item.total) * 100);
                                        return (
                                            <div key={label}>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="font-medium text-slate-700 truncate max-w-[70%]">{label}</span>
                                                    <span className="text-slate-500">{count} ({percentage}%)</span>
                                                </div>
                                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full rounded-full ${colors[idx % colors.length]}`} 
                                                        style={{ width: `${percentage}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default WorksheetAnalyticsPanel;
