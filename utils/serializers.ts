
import type { Matrix, Report } from '../types';

/**
 * Converts a Matrix (Worksheet) into a Markdown Table string for AI context.
 */
export const serializeMatrix = (matrix: Matrix): string => {
    if (!matrix || !matrix.columns || !matrix.rows) return "";

    // Filter out hidden columns if you want, or keep all for AI context
    // Here we use all columns to give AI full visibility
    const columns = matrix.columns;
    
    // Create Header Row
    const headers = columns.map(c => c.title.replace(/\|/g, '\\|')).join(' | ');
    const separators = columns.map(() => '---').join(' | ');
    
    // Create Data Rows
    const rows = matrix.rows.map(row => {
        return columns.map(col => {
            const cellVal = row.cells[col.id]?.value || '';
            // Escape pipes to prevent breaking markdown table
            return String(cellVal).replace(/\|/g, '\\|').replace(/\n/g, ' ');
        }).join(' | ');
    }).join('\n');

    return `### Worksheet: ${matrix.title}\n\n| ${headers} |\n| ${separators} |\n${rows}`;
};

/**
 * Converts a Report into a structured string for AI context.
 */
export const serializeReport = (report: Report): string => {
    if (!report) return "";
    return `### Report: ${report.title}\n\n${report.content}`;
};
