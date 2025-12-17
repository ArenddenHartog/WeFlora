
import React, { useState } from 'react';
import { SparklesIcon, ChevronUpIcon, ChevronDownIcon } from './icons';
import { parseMarkdownTable } from '../utils/markdown';

const ReasoningBlock = ({ text }: { text: string }) => {
    const [isOpen, setIsOpen] = useState(true);
    if (!text) return null;
    return (
        <div className="border border-purple-200 bg-purple-50 rounded-lg mb-3 overflow-hidden">
            {/* Header: Click bubbles to parent (Edit) except for the toggle button */}
            <div className="w-full flex items-center justify-between p-2 text-xs font-bold text-purple-700 hover:bg-purple-100 transition-colors select-none">
                <div className="flex items-center gap-2 cursor-pointer flex-1">
                    <SparklesIcon className="h-3 w-3" />
                    AI Reasoning & Context
                </div>
                <button 
                    onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                    className="p-1 hover:bg-purple-200 rounded text-purple-600 focus:outline-none"
                    title={isOpen ? "Collapse" : "Expand"}
                >
                    {isOpen ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
                </button>
            </div>
            {isOpen && (
                <div className="p-3 text-xs text-purple-900 border-t border-purple-100 whitespace-pre-wrap leading-relaxed cursor-text">
                    {text}
                </div>
            )}
        </div>
    );
};

const renderInlineStyles = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
        }
        return part;
    });
};

export const MessageRenderer = ({ text }: { text: string }) => {
    let content = text;
    let reasoning = null;

    // Robust parsing to separate Reasoning from Conclusion
    // Regex matches Reasoning Block -> Newline separator -> Optional Conclusion Label -> Conclusion Body
    const reasoningRegex = /^(?:\*\*?(?:Reasoning|Thinking|Analysis):?\*\*?)\s*([\s\S]*?)(?:\n\n|\n+)(?:(?:\*\*?(?:Conclusion|Answer|Recommendation):?\*\*?)\s*)?([\s\S]*)$/i;
    const match = text.match(reasoningRegex);

    if (match) {
        reasoning = match[1].trim();
        content = match[2].trim();
    } else {
        // Fallback for simple "Reasoning:" at start without clear conclusion block structure
        // This handles streaming chunks or older format responses
        const simpleMatch = text.match(/^(\*\*Reasoning:?\*\*|Reasoning:|Thinking:)([\s\S]*?)(\n\n|$)/i);
        if (simpleMatch) {
             reasoning = simpleMatch[2].trim();
             content = text.replace(simpleMatch[0], '').trim();
        }
    }

    const tableRegex = /((?:\|.*\|(?:\r?\n|$))+)/g;
    const parts = content.split(tableRegex);

    return (
        <div className="text-sm leading-relaxed text-slate-700">
            {reasoning && <ReasoningBlock text={reasoning} />}
            
            <div className="space-y-3">
                {parts.map((part, index) => {
                    const trimmedPart = part.trim();
                    if (trimmedPart.startsWith('|')) {
                        const tableData = parseMarkdownTable(trimmedPart);
                        if (tableData) {
                            return (
                                <div key={index} className="overflow-x-auto border border-slate-200 rounded-lg my-2 bg-white shadow-sm">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                                            <tr>{tableData.headers.map((h, i) => <th key={i} className="p-2 whitespace-nowrap border-r border-slate-200 last:border-0 bg-slate-100">{h}</th>)}</tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {tableData.rows.map((row, rI) => (
                                                <tr key={rI} className="hover:bg-slate-50 transition-colors">
                                                    {row.map((cell, cI) => <td key={cI} className="p-2 border-r border-slate-100 last:border-0 align-top text-slate-600">{cell.replace(/\*\*/g, '')}</td>)}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        }
                    }
                    if (!trimmedPart) return null;

                    return (
                        <div key={index}>
                            {trimmedPart.split('\n').map((line, lIdx) => {
                                // Headlines
                                if (line.startsWith('###')) return <h3 key={lIdx} className="font-bold text-slate-800 mt-2 mb-1">{line.replace(/^###\s*/, '')}</h3>;
                                if (line.startsWith('##')) return <h2 key={lIdx} className="font-bold text-lg text-slate-800 mt-3 mb-2">{line.replace(/^##\s*/, '')}</h2>;
                                
                                // Lists
                                if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                                    return (
                                        <div key={lIdx} className="flex gap-2 ml-1">
                                            <span className="text-slate-400">•</span>
                                            <span>{renderInlineStyles(line.replace(/^[-*]\s+/, ''))}</span>
                                        </div>
                                    );
                                }
                                if (/^\d+\.\s/.test(line.trim())) {
                                    return (
                                        <div key={lIdx} className="flex gap-2 ml-1">
                                            <span className="text-slate-400 font-mono text-xs pt-0.5">{line.match(/^\d+\./)?.[0]}</span>
                                            <span>{renderInlineStyles(line.replace(/^\d+\.\s+/, ''))}</span>
                                        </div>
                                    );
                                }
                                
                                if (!line.trim()) return <br key={lIdx} />;
                                return <p key={lIdx}>{renderInlineStyles(line)}</p>;
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
