
import React, { useState, useEffect } from 'react';
import type { Species } from '../types';
import { 
    XIcon, SparklesIcon, LeafIcon, DropletIcon, SunIcon, RulerIcon, 
    AlertTriangleIcon, CheckCircleIcon, MapIcon, TelescopeIcon, RefreshIcon,
    GlobeIcon, SearchIcon, PlusIcon, BookmarkIcon
} from './icons';
import { aiService } from '../services/aiService';

interface SpeciesIntelligencePanelProps {
    speciesName: string;
    speciesList?: Species[];
    onClose: () => void;
    onAskAI: (query: string) => void;
    onAddToWorksheet?: (speciesData: any) => void;
    onSaveToLibrary?: (speciesData: Partial<Species>) => void; // New prop
}

interface SpeciesProfileData {
    scientificName: string;
    commonName: string;
    family: string;
    isNative: boolean;
    height: string;
    spread: string;
    soilPreference: string;
    sunExposure: string;
    waterNeeds: string;
    hardinessZone: string;
    risks: string[];
    designUses: string[];
    alternatives: string[];
    insight: string;
}

const SpeciesIntelligencePanel: React.FC<SpeciesIntelligencePanelProps> = ({ speciesName, speciesList, onClose, onAskAI, onAddToWorksheet, onSaveToLibrary }) => {
    const [activeTab, setActiveTab] = useState<'Cultivation' | 'Risks' | 'Design'>('Cultivation');
    const [data, setData] = useState<SpeciesProfileData | null>(null);
    const [sources, setSources] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSaved, setIsSaved] = useState(false);

    // Fetch live data on mount
    useEffect(() => {
        const fetchProfile = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const { data: profile, sources: groundingSources } = await aiService.getSpeciesProfile(speciesName);
                if (!profile || Object.keys(profile).length === 0) {
                    throw new Error("No data returned");
                }
                setData(profile);
                setSources(groundingSources);
                
                // Check if already in library
                if (speciesList && speciesList.some(s => s.scientificName.toLowerCase() === profile.scientificName?.toLowerCase())) {
                    setIsSaved(true);
                }
            } catch (err) {
                console.error(err);
                setError("Failed to load species data.");
            } finally {
                setIsLoading(false);
            }
        };

        if (speciesName) {
            fetchProfile();
        }
    }, [speciesName, speciesList]);

    const handleSave = () => {
        if (!data || !onSaveToLibrary) return;
        onSaveToLibrary({
            scientificName: data.scientificName,
            commonName: data.commonName,
            family: data.family,
            tags: [data.hardinessZone, ...data.designUses] // Use AI data as tags
        });
        setIsSaved(true);
    };

    const handleAdd = () => {
        if (onAddToWorksheet) {
            onAddToWorksheet(data);
            // Auto-save to library if not already saved
            if (!isSaved && onSaveToLibrary) {
                handleSave();
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 border-l border-slate-200">
            {/* Header / Hero */}
            <div className="relative bg-weflora-teal text-white p-6 pb-8 shrink-0 transition-all duration-300">
                <div className="absolute top-4 right-4 flex items-center gap-2">
                    {data && onSaveToLibrary && (
                        <button 
                            onClick={handleSave} 
                            disabled={isSaved}
                            className={`p-1.5 rounded-full transition-colors ${isSaved ? 'bg-white/20 text-white cursor-default' : 'hover:bg-white/20 text-white/70 hover:text-white'}`}
                            title={isSaved ? "Saved to Library" : "Save to Library"}
                        >
                            {isSaved ? <CheckCircleIcon className="h-5 w-5" /> : <BookmarkIcon className="h-5 w-5" />}
                        </button>
                    )}
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-black/10 transition-colors">
                        <XIcon className="h-5 w-5 text-white" />
                    </button>
                </div>
                
                {isLoading ? (
                    <div className="animate-pulse space-y-3">
                        <div className="h-4 bg-white/20 rounded w-1/3"></div>
                        <div className="h-8 bg-white/20 rounded w-2/3"></div>
                        <div className="h-4 bg-white/20 rounded w-1/2"></div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 text-white px-2 py-0.5 rounded border border-white/30">
                                {data?.family || 'Family'}
                            </span>
                            {data?.isNative && (
                                <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 text-white px-2 py-0.5 rounded border border-white/30">
                                    Native
                                </span>
                            )}
                        </div>
                        <h1 className="text-2xl font-serif italic font-bold mb-1">{data?.scientificName || speciesName}</h1>
                        <p className="text-sm text-weflora-mint-light">{data?.commonName || 'Common Name'}</p>
                    </>
                )}
            </div>

            <div className="flex-1 overflow-y-auto -mt-4 rounded-t-2xl bg-slate-50 relative z-10 custom-scrollbar">
                
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <RefreshIcon className="h-8 w-8 animate-spin mb-3 text-weflora-teal" />
                        <p className="text-sm font-medium">Generating Botanical Profile...</p>
                        <p className="text-xs text-slate-300 mt-2">Checking Google Search...</p>
                    </div>
                ) : error ? (
                    <div className="p-8 text-center text-slate-500">
                        <AlertTriangleIcon className="h-10 w-10 mx-auto mb-2 text-weflora-amber" />
                        <p>{error}</p>
                        <button onClick={() => window.location.reload()} className="mt-4 text-weflora-teal hover:underline text-sm">Retry</button>
                    </div>
                ) : data && (
                    <>
                        {/* Action Bar */}
                        <div className="px-4 py-2 mt-2">
                            {onAddToWorksheet && (
                                <button 
                                    onClick={handleAdd}
                                    className="w-full flex items-center justify-center gap-2 py-2 bg-white border border-weflora-teal text-weflora-teal rounded-lg text-sm font-bold hover:bg-weflora-mint/10 transition-colors shadow-sm"
                                >
                                    <PlusIcon className="h-4 w-4" /> Add to Worksheet
                                </button>
                            )}
                        </div>

                        {/* Vitality Grid */}
                        <div className="grid grid-cols-3 gap-2 p-4 pb-2">
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center text-center">
                                <RulerIcon className="h-5 w-5 text-slate-400 mb-1" />
                                <span className="text-xs font-bold text-slate-800">{data.height}</span>
                                <span className="text-[10px] text-slate-400">Height</span>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center text-center">
                                <SunIcon className="h-5 w-5 text-weflora-amber mb-1" />
                                <span className="text-xs font-bold text-slate-800 truncate w-full" title={data.sunExposure}>{data.sunExposure}</span>
                                <span className="text-[10px] text-slate-400">Exposure</span>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center text-center">
                                <DropletIcon className="h-5 w-5 text-weflora-teal mb-1" />
                                <span className="text-xs font-bold text-slate-800 truncate w-full" title={data.waterNeeds}>{data.waterNeeds}</span>
                                <span className="text-[10px] text-slate-400">Water</span>
                            </div>
                        </div>

                        {/* FloraGPT Insights */}
                        <div className="px-4 py-2">
                            <div className="p-4 bg-weflora-teal/10 border border-weflora-teal/20 rounded-xl relative overflow-hidden">
                                <div className="flex items-center gap-2 mb-2">
                                    <SparklesIcon className="h-4 w-4 text-weflora-dark" />
                                    <span className="text-xs font-bold text-weflora-dark uppercase">FloraGPT Insight</span>
                                </div>
                                <p className="text-sm text-slate-700 leading-relaxed">
                                    {data.insight}
                                </p>
                            </div>
                        </div>

                        {/* Grounding Sources */}
                        {sources.length > 0 && (
                            <div className="px-4 mt-2">
                                <div className="flex items-center gap-2 mb-2 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                    <GlobeIcon className="h-3 w-3" />
                                    Verified Sources
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {sources.map((source: any, i: number) => {
                                        const web = source.web;
                                        if (!web) return null;
                                        return (
                                            <a 
                                                key={i} 
                                                href={web.uri} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded-md text-weflora-teal hover:text-weflora-dark hover:underline truncate max-w-[150px] block"
                                            >
                                                {web.title}
                                            </a>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Deep Dive Tabs */}
                        <div className="px-4 mt-4">
                            <div className="flex border-b border-slate-200 mb-4">
                                {(['Cultivation', 'Risks', 'Design'] as const).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`flex-1 pb-2 text-sm font-medium transition-colors ${
                                            activeTab === tab 
                                            ? 'border-b-2 border-weflora-teal text-weflora-dark' 
                                            : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-4 pb-8 min-h-[200px]">
                                {activeTab === 'Cultivation' && (
                                    <div className="space-y-3 animate-fadeIn">
                                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                                            <h3 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                                                <LeafIcon className="h-4 w-4" /> Soil Preference
                                            </h3>
                                            <p className="text-sm text-slate-700">{data.soilPreference}</p>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                                            <h3 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                                                <MapIcon className="h-4 w-4" /> Hardiness
                                            </h3>
                                            <p className="text-sm text-slate-700">{data.hardinessZone}</p>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'Risks' && (
                                    <div className="space-y-3 animate-fadeIn">
                                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                                            <h3 className="text-xs font-bold text-weflora-red uppercase mb-2 flex items-center gap-2">
                                                <AlertTriangleIcon className="h-4 w-4" /> Known Issues
                                            </h3>
                                            <ul className="space-y-2">
                                                {data.risks.length > 0 ? data.risks.map((risk, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-weflora-red mt-1.5 shrink-0" />
                                                        {risk}
                                                    </li>
                                                )) : <li className="text-sm text-slate-400 italic">No major risks identified.</li>}
                                            </ul>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'Design' && (
                                    <div className="space-y-3 animate-fadeIn">
                                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                                            <h3 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                                                <TelescopeIcon className="h-4 w-4" /> Recommended Uses
                                            </h3>
                                            <div className="flex flex-wrap gap-2">
                                                {data.designUses.length > 0 ? data.designUses.map((use, i) => (
                                                    <span key={i} className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-xs">
                                                        {use}
                                                    </span>
                                                )) : <span className="text-sm text-slate-400 italic">No specific uses listed.</span>}
                                            </div>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                                            <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Similar Species</h3>
                                            <div className="space-y-2">
                                                {data.alternatives.length > 0 ? data.alternatives.map((alt, i) => (
                                                    <div key={i} className="flex items-center justify-between text-sm p-2 hover:bg-slate-50 rounded cursor-pointer transition-colors" onClick={() => onAskAI(`Compare ${speciesName} with ${alt}`)}>
                                                        <span className="italic text-slate-700">{alt}</span>
                                                        <span className="text-xs text-weflora-teal">Compare &rarr;</span>
                                                    </div>
                                                )) : <div className="text-sm text-slate-400 italic">No alternatives suggested.</div>}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-white border-t border-slate-200 shrink-0">
                <button 
                    onClick={() => onAskAI(`Create a detailed report for ${speciesName} regarding...`)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-weflora-teal text-white rounded-xl text-sm font-bold hover:bg-weflora-dark transition-all shadow-lg"
                >
                    <SparklesIcon className="h-4 w-4 text-weflora-teal/20" />
                    Ask FloraGPT about this
                </button>
            </div>
        </div>
    );
};

export default SpeciesIntelligencePanel;
