
export const extractMarkdownTableBlock = (text: string): string | null => {
    // Regex to find a markdown table structure:
    // Looks for a line with pipes |, followed by a separator line |---|
    // captures until the lines stop looking like table rows.
    const tableRegex = /((?:\|.*\|(?:\r?\n|$))+)/g;
    const matches = text.match(tableRegex);
    
    if (matches && matches.length > 0) {
        // Return the longest match (most likely the main data table)
        return matches.reduce((a, b) => a.length > b.length ? a : b);
    }
    return null;
};

export const parseMarkdownTable = (text: string) => {
    if (!text) return null;

    // 1. Clean and normalize text
    let lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // 2. Identify the separator line (contains --- and | or just ---)
    let separatorIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Must contain at least 3 dashes and (optional) pipes
        if (line.match(/^\|?[\s-:]+\|[\s-:|]+\|?$/) || (line.includes('---') && line.includes('|'))) {
            separatorIndex = i;
            break;
        }
    }

    if (separatorIndex === -1) {
        // Fallback: If no markdown table structure found, try CSV detection or return null
        return null;
    }

    // 3. Parse Header
    // The header is usually the line immediately before the separator
    if (separatorIndex === 0) return null;
    
    const splitRow = (line: string) => {
        let content = line;
        // Trim outer pipes if they exist
        if (content.startsWith('|')) content = content.substring(1);
        if (content.endsWith('|')) content = content.substring(0, content.length - 1);
        
        // Split by pipe
        return content.split('|').map(cell => 
            cell.trim()
                .replace(/^[*_]+|[*_]+$/g, '') // Remove simple bold/italic markers from ends
                .replace(/<br\/?>/g, '\n') // Handle line breaks
        );
    };

    const headerLine = lines[separatorIndex - 1];
    const headers = splitRow(headerLine);

    // 4. Parse Rows
    // Rows are everything after the separator
    const rowLines = lines.slice(separatorIndex + 1);
    const rows: string[][] = [];

    for (const line of rowLines) {
        // Stop if we hit a line that doesn't look like a table row (no pipes)
        // unless it's a very simple table where pipes are implied? No, strict to pipes for now.
        if (!line.includes('|')) break;
        
        const cells = splitRow(line);
        
        // Align cell count with header count if possible
        if (cells.length > 0) {
            // Pad if short
            while (cells.length < headers.length) cells.push('');
            // Trim if long (or keep? usually keep extra data)
            rows.push(cells);
        }
    }

    if (rows.length === 0) return null;

    return { headers, rows };
};
