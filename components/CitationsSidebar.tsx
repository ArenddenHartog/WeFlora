
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
    const { openFilePreview } = useUI();
    const { files: projectFiles } = useProject();

    // Flatten messages to citations while keeping track of which message they came from
    const allCitations: EnrichedCitation[] = messages.flatMap(m => 
        (m.citations || []).map(c => ({ ...c, messageId: m.id }))
    );

    const projectFileCitations = allCitations.filter(c => c.type === 'project_file');
    const researchCitations = allCitations.filter(c => c.type === 'research');
    
    // Extract Web Sources
    const webSources = messages.flatMap(m => 
        (m.grounding?.webSources || []).map(s => ({ ...s, messageId: m.id }))
    );
     const mapSources = messages.flatMap(m => 
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
                <h2 className="text-lg font-semibold text-slate-800 mb-4 sticky top-0 bg-slate-50 py-2 -mt-4 z-10 border-b border-slate-200 -mx-4 px-4">References</h2>
                
                {allCitations.length === 0 && webSources.length === 0 && mapSources.length === 0 ? (
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
                        {projectFileCitations.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">From Project Files</h3>
                                <ul className="space-y-2">
                                    {projectFileCitations.map((citation, index) => {
                                        const isHighlighted = citation.source === highlightedFileName;
                                        return (
                                            <li key={`proj-${index}`}>
                                                <button 
                                                    ref={isHighlighted ? highlightedRef : null}
                                                    onClick={() => handleCitationClick(citation)}
                                                    onMouseEnter={() => onCitationHover?.(citation.messageId)}
                                                    onMouseLeave={() => onCitationHover?.(null)}
                                                    className={`w-full text-left p-2 rounded-lg transition-all duration-300 group ${
                                                        isHighlighted 
                                                            ? 'bg-yellow-100 ring-2 ring-yellow-400 shadow-sm' 
                                                            : 'hover:bg-slate-200'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 font-medium text-slate-700 mb-1 text-sm">
                                                        {getIconForSource(citation.source)}
                                                        <span className="truncate">{citation.source}</span>
                                                    </div>
                                                    <blockquote className={`pl-4 text-slate-600 border-l-2 ml-2 py-1 text-sm ${
                                                        isHighlighted ? 'border-yellow-400' : 'border-slate-200 group-hover:border-slate-400'
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
                                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">General Research</h3>
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
