
import React, { useEffect, useRef } from 'react';
import type { ChatMessage, Citation, ProjectFile } from '../types';
import { FileSheetIcon, FilePdfIcon, BookIcon, FileCodeIcon, SearchIcon } from './icons';
import { useUI } from '../contexts/UIContext';
import { useProject } from '../contexts/ProjectContext';

interface CitationsSidebarProps {
    messages: ChatMessage[];
    onCitationClick?: (messageId: string) => void;
    onSourceClick?: (source: string) => void;
    highlightedFileName?: string | null;
    onCitationHover?: (messageId: string | null) => void;
}

// Helper type to include message context
interface EnrichedCitation extends Citation {
    messageId: string;
}

const CitationsSidebar: React.FC<CitationsSidebarProps> = ({ messages, onCitationClick, onSourceClick, highlightedFileName, onCitationHover }) => {
    // Access global contexts
    const { openFilePreview, citationsFilter, setCitationsFilter } = useUI();
    const { files: projectFiles } = useProject();

    // Flatten messages to citations while keeping track of which message they came from
    const allCitations: EnrichedCitation[] = messages.flatMap((m) => {
        if (m.citations && m.citations.length > 0) {
            return m.citations.map((c) => ({ ...c, messageId: m.id }));
        }
        if (m.floraGPT?.meta?.sources_used?.length) {
            return m.floraGPT.meta.sources_used.map((entry) => ({
                source: entry.source_id,
                text: entry.source_id,
                type: 'project_file' as const,
                sourceId: entry.source_id,
                messageId: m.id
            }));
        }
        return [];
    });

    const filteredCitations = citationsFilter?.sourceIds?.length
        ? allCitations.filter((citation) => citation.sourceId && citationsFilter.sourceIds.includes(citation.sourceId))
        : allCitations;

    const projectFileCitations = filteredCitations.filter(c => c.type === 'project_file');
    const researchCitations = filteredCitations.filter(c => c.type === 'research');
    const selectedProjectCitations = projectFileCitations.filter(c => c.group === 'selected');
    const otherProjectCitations = projectFileCitations.filter(c => c.group !== 'selected');
    
    // Extract Web Sources
    const webSources = citationsFilter
        ? []
        : messages.flatMap(m =>
            (m.grounding?.webSources || []).map(s => ({ ...s, messageId: m.id }))
        );
    const mapSources = citationsFilter
        ? []
        : messages.flatMap(m =>
            (m.grounding?.mapSources || []).map(s => ({ ...s, messageId: m.id }))
        );

    const highlightedRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (highlightedFileName && highlightedRef.current) {
            highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [highlightedFileName]);

    const getIconForSource = (sourceName: string) => {
        if (sourceName.endsWith('.xlsx')) return <FileSheetIcon className="h-4 w-4 text-weflora-success" />;
        if (sourceName.endsWith('.pdf')) return <FilePdfIcon className="h-4 w-4 text-weflora-red" />;
        if (sourceName.endsWith('.json')) return <FileCodeIcon className="h-4 w-4 text-weflora-teal" />;
        return <BookIcon className="h-4 w-4 text-slate-500" />;
    };

    const handleCitationClick = (citation: EnrichedCitation) => {
        if (onCitationClick) {
            onCitationClick(citation.messageId);
        }
        if (onSourceClick) {
            onSourceClick(citation.source);
        }
        if (citation.type === 'project_file') {
            // Find the file object in available project files
            // Flatten the projectFiles map
            const allFiles: ProjectFile[] = Object.values(projectFiles).flat();
            const fileObj = allFiles.find(f => f.name === citation.source);
            
            if (fileObj) {
                openFilePreview(fileObj);
            } else {
                alert("File not found in active projects.");
            }
        }
    };

     const handleWebSourceClick = (messageId: string) => {
        if (onCitationClick) {
            onCitationClick(messageId);
        }
    };

    return (
        <aside className="w-80 flex-shrink-0 border-l border-slate-200 bg-slate-50 h-full overflow-y-auto">
            <div className="p-4">
                <h2 className="text-lg font-semibold text-slate-800 mb-4 sticky top-0 bg-slate-50 py-2 -mt-4 z-10 border-b border-slate-200 -mx-4 px-4">Citations</h2>
                {citationsFilter && (
                    <div className="mb-4 p-3 bg-white border border-weflora-teal/20 rounded-lg flex items-center justify-between">
                        <div className="text-xs font-semibold text-slate-700">Filtered to selected row</div>
                        <button
                            className="text-xs font-bold text-weflora-teal hover:underline"
                            onClick={() => setCitationsFilter(null)}
                        >
                            Clear filter
                        </button>
                    </div>
                )}
                
                {filteredCitations.length === 0 && webSources.length === 0 && mapSources.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">No citations found in this conversation.</p>
                ) : (
                    <>
                        {/* External Sources Section */}
                        {(webSources.length > 0 || mapSources.length > 0) && (
                             <div className="mb-6">
                                <h3 className="text-sm font-semibold text-weflora-teal uppercase mb-3 flex items-center gap-2">
                                    <SearchIcon className="h-3.5 w-3.5" />
                                    External Knowledge
                                </h3>
                                <ul className="space-y-2">
                                    {webSources.map((source, index) => (
                                        <li key={`web-${index}`}>
                                             <div 
                                                className="w-full text-left p-2 rounded-lg bg-weflora-teal/10 hover:bg-weflora-teal/10 border border-weflora-teal/20 transition-colors group cursor-pointer"
                                                onClick={() => handleWebSourceClick(source.messageId)}
                                            >
                                                <a href={source.uri} target="_blank" rel="noopener noreferrer" className="block">
                                                    <div className="text-xs text-weflora-teal mb-1">Web Result</div>
                                                    <div className="font-medium text-slate-700 text-sm hover:underline decoration-weflora-teal/30">
                                                        {source.title}
                                                    </div>
                                                </a>
                                            </div>
                                        </li>
                                    ))}
                                    {mapSources.map((source, index) => (
                                        <li key={`map-${index}`}>
                                             <div 
                                                className="w-full text-left p-2 rounded-lg bg-weflora-success/10 hover:bg-weflora-success/10 border border-weflora-success/20 transition-colors group cursor-pointer"
                                                onClick={() => handleWebSourceClick(source.messageId)}
                                            >
                                                <a href={source.uri} target="_blank" rel="noopener noreferrer" className="block">
                                                    <div className="text-xs text-weflora-success mb-1">Map Location</div>
                                                    <div className="font-medium text-slate-700 text-sm hover:underline decoration-weflora-success/30">
                                                        {source.title}
                                                    </div>
                                                </a>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Internal File Sources */}
                        {selectedProjectCitations.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Selected docs</h3>
                                <ul className="space-y-2">
                                    {selectedProjectCitations.map((citation, index) => {
                                        const isHighlighted = citation.source === highlightedFileName;
                                        return (
                                            <li key={`proj-selected-${index}`}>
                                                <button 
                                                    ref={isHighlighted ? highlightedRef : null}
                                                    onClick={() => handleCitationClick(citation)}
                                                    onMouseEnter={() => onCitationHover?.(citation.messageId)}
                                                    onMouseLeave={() => onCitationHover?.(null)}
                                                    className={`w-full text-left p-2 rounded-lg transition-all duration-300 group ${
                                                        isHighlighted 
                                                            ? 'bg-weflora-amber/10 ring-2 ring-weflora-amber shadow-sm' 
                                                            : 'hover:bg-slate-200'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 font-medium text-slate-700 mb-1 text-sm">
                                                        {getIconForSource(citation.source)}
                                                        <span className="truncate">{citation.source}</span>
                                                    </div>
                                                    <blockquote className={`pl-4 text-slate-600 border-l-2 ml-2 py-1 text-sm ${
                                                        isHighlighted ? 'border-weflora-amber' : 'border-slate-200 group-hover:border-slate-400'
                                                    }`}>
                                                    "{citation.text}"
                                                    </blockquote>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}

                        {otherProjectCitations.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Other sources</h3>
                                <ul className="space-y-2">
                                    {otherProjectCitations.map((citation, index) => {
                                        const isHighlighted = citation.source === highlightedFileName;
                                        return (
                                            <li key={`proj-other-${index}`}>
                                                <button 
                                                    ref={isHighlighted ? highlightedRef : null}
                                                    onClick={() => handleCitationClick(citation)}
                                                    onMouseEnter={() => onCitationHover?.(citation.messageId)}
                                                    onMouseLeave={() => onCitationHover?.(null)}
                                                    className={`w-full text-left p-2 rounded-lg transition-all duration-300 group ${
                                                        isHighlighted 
                                                            ? 'bg-weflora-amber/10 ring-2 ring-weflora-amber shadow-sm' 
                                                            : 'hover:bg-slate-200'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 font-medium text-slate-700 mb-1 text-sm">
                                                        {getIconForSource(citation.source)}
                                                        <span className="truncate">{citation.source}</span>
                                                    </div>
                                                    <blockquote className={`pl-4 text-slate-600 border-l-2 ml-2 py-1 text-sm ${
                                                        isHighlighted ? 'border-weflora-amber' : 'border-slate-200 group-hover:border-slate-400'
                                                    }`}>
                                                    "{citation.text}"
                                                    </blockquote>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}

                        {researchCitations.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Other sources</h3>
                                <ul className="space-y-4">
                                    {researchCitations.map((citation, index) => (
                                        <li key={`res-${index}`}>
                                            <button 
                                                onClick={() => handleCitationClick(citation)}
                                                onMouseEnter={() => onCitationHover?.(citation.messageId)}
                                                onMouseLeave={() => onCitationHover?.(null)}
                                                className="w-full text-left p-2 rounded-lg hover:bg-slate-200 transition-colors group"
                                            >
                                                <div className="flex items-center gap-2 font-medium text-slate-700 mb-1 text-sm">
                                                    <BookIcon className="h-4 w-4 text-slate-500" />
                                                    <span>{citation.source}</span>
                                                </div>
                                                <blockquote className="pl-4 text-slate-600 border-l-2 border-slate-200 group-hover:border-slate-400 ml-2 py-1 text-sm">
                                                    "{citation.text}"
                                                </blockquote>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </>
                )}
            </div>
        </aside>
    );
};

export default CitationsSidebar;
