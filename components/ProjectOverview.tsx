
import React, { useState, useEffect } from 'react';
import type { PinnedProject, Matrix, Report, ProjectInsights, ProjectFile } from '../types';
import { 
    RefreshIcon, SparklesIcon, ChartPieIcon, CheckCircleIcon, 
    AlertTriangleIcon, FolderIcon, ClockIcon, ArrowUpIcon, DatabaseIcon 
} from './icons';
import { aiService } from '../services/aiService';

interface ProjectOverviewProps {
    project: PinnedProject;
    matrices: Matrix[];
    reports: Report[];
    files: ProjectFile[];
}

const ProjectOverview: React.FC<ProjectOverviewProps> = ({ project, matrices, reports, files }) => {
    const [insights, setInsights] = useState<ProjectInsights | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const generateInsights = async () => {
        setIsLoading(true);
        try {
            const data = await aiService.generateProjectInsights(matrices, reports);
            setInsights(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!insights && (matrices.length > 0 || reports.length > 0)) {
            generateInsights();
        }
    }, []);

    const getIcon = (type?: string) => {
        switch (type) {
            case 'chart': return <ChartPieIcon className="h-5 w-5 text-blue-500" />;
            case 'alert': return <AlertTriangleIcon className="h-5 w-5 text-amber-500" />;
            case 'check': return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
            default: return <DatabaseIcon className="h-5 w-5 text-slate-500" />;
        }
    };

    return (
        <div className="flex flex-col lg:flex-row h-full overflow-hidden bg-slate-50">
            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
                
                {/* Hero Section */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <SparklesIcon className="h-32 w-32 text-weflora-teal" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 mb-2">{project.name}</h1>
                                <p className="text-slate-500 text-sm">Project Overview</p>
                            </div>
                            <button 
                                onClick={generateInsights} 
                                disabled={isLoading}
                                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                            >
                                <RefreshIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                Refresh Insights
                            </button>
                        </div>
                        
                        <div className="bg-weflora-mint/10 border border-weflora-teal/20 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <SparklesIcon className="h-4 w-4 text-weflora-teal" />
                                <span className="text-xs font-bold text-weflora-teal-dark uppercase tracking-wider">AI Executive Summary</span>
                            </div>
                            <p className="text-sm text-slate-700 leading-relaxed">
                                {isLoading ? "Analyzing project data..." : (insights?.summary || "No insights generated yet. Add worksheets or reports to get started.")}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Metrics Grid */}
                <div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Key Metrics</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Static Hardcoded Metrics as Fallback/Base */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                                <DatabaseIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-slate-900">{matrices.length}</div>
                                <div className="text-xs text-slate-500 font-medium">Worksheets</div>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="h-10 w-10 bg-orange-50 rounded-lg flex items-center justify-center text-orange-600">
                                <FolderIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-slate-900">{files.length}</div>
                                <div className="text-xs text-slate-500 font-medium">Files</div>
                            </div>
                        </div>

                        {/* Dynamic AI Metrics */}
                        {insights?.metrics.map((m, i) => (
                            <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 animate-fadeIn">
                                <div className="h-10 w-10 bg-slate-50 rounded-lg flex items-center justify-center">
                                    {getIcon(m.icon)}
                                </div>
                                <div>
                                    <div className="text-xl font-bold text-slate-900 truncate">{m.value}</div>
                                    <div className="text-xs text-slate-500 font-medium truncate" title={m.label}>{m.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Action Plan */}
                <div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Recommended Actions</h3>
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        {insights?.actions && insights.actions.length > 0 ? (
                            <div className="divide-y divide-slate-100">
                                {insights.actions.map((action, i) => (
                                    <div key={i} className="p-4 flex gap-4 hover:bg-slate-50 transition-colors">
                                        <div className={`mt-0.5 ${action.type === 'missing_data' ? 'text-red-500' : 'text-blue-500'}`}>
                                            {action.type === 'missing_data' ? <AlertTriangleIcon className="h-5 w-5" /> : <ArrowUpIcon className="h-5 w-5" />}
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-800 font-medium">{action.text}</p>
                                            <p className="text-xs text-slate-400 mt-1 capitalize">{action.type.replace('_', ' ')}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-slate-400">
                                <CheckCircleIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">No pending actions detected.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Sidebar - Activity */}
            <div className="w-full lg:w-80 bg-white border-l border-slate-200 overflow-y-auto p-6">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Recent Activity</h3>
                <div className="space-y-4 relative">
                    <div className="absolute top-2 bottom-2 left-2.5 w-px bg-slate-100"></div>
                    
                    {[...matrices, ...reports, ...files]
                        .sort((a, b) => {
                            const getDate = (item: typeof a) => {
                                if ('updatedAt' in item) return item.updatedAt;
                                if ('lastModified' in item) return item.lastModified;
                                if ('date' in item) return item.date;
                                return '';
                            };
                            const dateA = getDate(a);
                            const dateB = getDate(b);
                            return new Date(dateB || '').getTime() - new Date(dateA || '').getTime();
                        })
                        .slice(0, 10)
                        .map((item, i) => {
                            const isReport = 'content' in item;
                            const isMatrix = 'rows' in item;
                            const name = 'name' in item ? item.name : item.title;
                            
                            const date = 'updatedAt' in item ? item.updatedAt : 
                                         'lastModified' in item ? item.lastModified : 
                                         'date' in item ? item.date : 'Just now';
                            
                            return (
                                <div key={i} className="flex gap-3 relative">
                                    <div className={`w-5 h-5 rounded-full border-2 border-white shadow-sm flex-shrink-0 z-10 ${isMatrix ? 'bg-weflora-teal' : isReport ? 'bg-orange-400' : 'bg-blue-500'}`}></div>
                                    <div>
                                        <div className="text-sm font-medium text-slate-800 truncate w-48">{name}</div>
                                        <div className="text-xs text-slate-400 flex items-center gap-1">
                                            <ClockIcon className="h-3 w-3" /> {new Date(date || '').toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    }
                </div>
            </div>
        </div>
    );
};

export default ProjectOverview;
