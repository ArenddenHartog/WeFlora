import { GoogleGenAI, Type, Schema } from "@google/genai";
import { MatrixColumn, DiscoveredStructure, ContextItem, MatrixRow, Matrix, MatrixColumnType, Report, ProjectInsights, MemorySummary } from '../types';
import { SkillOutputType, SkillValidationResult } from './skillTemplates';

// Initialize the SDK
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GOOGLE_API_KEY });

// -- Helper: File to Base64 --
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

// -- Helper: Robust JSON Parser --
const parseJSONSafely = (text: string) => {
    try {
        // Remove markdown code blocks if present
        const cleanText = text.replace(/```json\n?|```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (e) {
        console.error("JSON Parse Error", e);
        return {};
    }
};

// -- Helper: Simple Prompt Hash --
const hashPrompt = (prompt: string): string => {
    let hash = 0;
    if (prompt.length === 0) return hash.toString();
    for (let i = 0; i < prompt.length; i++) {
        const char = prompt.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
};

// --- Helper: Deterministic markdown pipe-table parsing (Copy → Worksheet) ---
export const MARKDOWN_TABLE_MAX_COLUMNS = 25;

const collapseWhitespace = (s: string) => s.replace(/\s+/g, ' ').trim();

const splitPipeRow = (line: string) => {
    // Tolerate missing leading/trailing pipes and uneven whitespace.
    const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    return trimmed.split('|').map((c) => collapseWhitespace(c));
};

const isSeparatorCell = (cell: string) => {
    const c = cell.trim();
    // Markdown allows alignment markers :---:, :---, ---:
    return /^:?-{3,}:?$/.test(c);
};

const isSeparatorRow = (line: string) => {
    if (!line.includes('|')) return false;
    const cells = splitPipeRow(line);
    if (cells.length < 2) return false;
    return cells.every((c) => c === '' || isSeparatorCell(c));
};

const findFirstMarkdownPipeTable = (text: string) => {
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length - 1; i++) {
        const headerLine = lines[i];
        const sepLine = lines[i + 1];
        if (!headerLine.includes('|')) continue;
        if (!isSeparatorRow(sepLine)) continue;

        const headerCells = splitPipeRow(headerLine).filter((c) => c !== '');
        if (headerCells.length < 2) continue;

        const rowLines: string[] = [];
        for (let j = i + 2; j < lines.length; j++) {
            const l = lines[j];
            if (!l.trim()) break;
            if (!l.includes('|')) break;
            rowLines.push(l);
        }

        if (rowLines.length === 0) continue;
        return { headerCells, rowLines };
    }
    return null;
};

export const hasMarkdownPipeTable = (text: string) => Boolean(findFirstMarkdownPipeTable(text));

export const parseMarkdownPipeTableAsMatrix = (
    text: string,
    opts?: { maxColumns?: number }
): { columns: MatrixColumn[]; rows: MatrixRow[] } | null => {
    const maxCols = opts?.maxColumns ?? MARKDOWN_TABLE_MAX_COLUMNS;
    const found = findFirstMarkdownPipeTable(text);
    if (!found) return null;

    const { headerCells, rowLines } = found;

    // Guardrail: require a real table.
    if (headerCells.length < 2 || rowLines.length === 0) return null;

    const now = Date.now();

    const needsNotesColumn = headerCells.length > maxCols;
    const effectiveHeaderCells = needsNotesColumn
        ? [...headerCells.slice(0, Math.max(1, maxCols - 1)), 'Notes']
        : headerCells.slice(0, maxCols);

    // Guardrail: still must be at least 2 columns.
    if (effectiveHeaderCells.length < 2) return null;

    const columns: MatrixColumn[] = effectiveHeaderCells.map((title, idx) => {
        const col: MatrixColumn = {
            id: `col-md-${idx}-${now}`,
            title: title || `Column ${idx + 1}`,
            type: 'text',
            width: idx === 0 ? 250 : idx === effectiveHeaderCells.length - 1 && needsNotesColumn ? 400 : 150,
            isPrimaryKey: idx === 0,
        };
        return col;
    });

    const rows: MatrixRow[] = rowLines.map((line, rowIdx) => {
        const rawCells = splitPipeRow(line);
        const cells: Record<string, { columnId: string; value: string }> = {};

        const baseCount = needsNotesColumn ? effectiveHeaderCells.length - 1 : effectiveHeaderCells.length;
        const baseValues = rawCells.slice(0, baseCount);
        while (baseValues.length < baseCount) baseValues.push('');

        const notesValue = needsNotesColumn ? rawCells.slice(baseCount).filter(Boolean).join(' | ') : '';

        columns.forEach((col, colIdx) => {
            let value = baseValues[colIdx] ?? '';
            if (needsNotesColumn && colIdx === columns.length - 1) value = notesValue;
            cells[col.id] = { columnId: col.id, value: String(value ?? '') };
        });

        return {
            id: `row-md-${rowIdx}-${now}`,
            entityName: baseValues[0] || `Item ${rowIdx + 1}`,
            cells: cells as any,
        };
    });

    // Final guardrail: don't claim table success if it's effectively empty.
    if (columns.length < 2 || rows.length === 0) return null;

    return { columns, rows };
};

// --- PR2: Species-first shaping (Copy → Worksheet) ---

const SPECIES_HEADER_ALIASES = [
    'species',
    'species name',
    'scientific name',
    'latin name',
    'botanical name',
    'taxon',
    'plant name',
    'plantnaam',
    'soort',
    'boomsoort',
    'tree species',
];

const CANONICAL_COLUMN_ORDER = [
    'Species (scientific)',
    'Cultivar',
    'Common name',
    'Notes',
    'Source',
] as const;

type CanonicalColumnTitle = typeof CANONICAL_COLUMN_ORDER[number];

const normalizeHeader = (s: string) =>
    collapseWhitespace(String(s || ''))
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s()_-]+/gu, '')
        .trim();

const headerMatchesSpecies = (header: string) => {
    const h = normalizeHeader(header);
    // Exact match for short aliases, contains-match for longer variants.
    return SPECIES_HEADER_ALIASES.some((a) => {
        const aa = normalizeHeader(a);
        if (!aa) return false;
        if (aa.length <= 7) return h === aa;
        return h.includes(aa);
    });
};

const looksMostlyNumeric = (values: string[]) => {
    const nonEmpty = values.map((v) => String(v ?? '').trim()).filter(Boolean);
    if (nonEmpty.length === 0) return false;
    const numericCount = nonEmpty.filter((v) => /^[-+]?[\d.,]+$/.test(v.replace(/\s/g, ''))).length;
    return numericCount / nonEmpty.length >= 0.7;
};

const binomialRe = /^[A-Z][a-z]+ [a-z][a-z-]+$/;
const cultivarHintsRe = /(\bcv\.\b)|['"][^'"]+['"]|(?:\s+[A-Z][a-z]+ [a-z][a-z-]+\s+['"][^'"]+['"])/;

const scoreSpeciesColumnByContent = (rows: MatrixRow[], colId: string, maxRows: number) => {
    let score = 0;
    const sample = rows.slice(0, maxRows);
    const values = sample.map((r) => String(r.cells?.[colId]?.value ?? '').trim());

    if (looksMostlyNumeric(values)) score -= 8;

    for (const raw of values) {
        const v = collapseWhitespace(raw);
        if (!v) continue;

        if (binomialRe.test(v)) score += 3;
        else if (cultivarHintsRe.test(v)) score += 2;
        else if (/^[A-Za-z]{3,}$/.test(v) && v.length <= 24) score += 1;

        // Penalize sentence-y / punctuation heavy values
        if (v.length > 40 && /[.,;:()]/.test(v)) score -= 2;
    }

    return score;
};

const titleCase = (s: string) =>
    collapseWhitespace(s)
        .split(' ')
        .map((w) => (w.length ? w.charAt(0).toUpperCase() + w.slice(1) : w))
        .join(' ');

const parseSpeciesCell = (raw: string) => {
    const v = collapseWhitespace(String(raw ?? ''));
    if (!v) return { scientific: '', cultivar: '', common: '', needsConfirmation: false };

    // Binomial + optional cultivar forms.
    // Examples:
    // - Acer campestre
    // - Acer campestre 'Elsrijk'
    // - Acer campestre cv. Elsrijk
    const parts = v.split(' ');
    if (parts.length >= 2 && /^[A-Z][a-z]+$/.test(parts[0]) && /^[a-z][a-z-]+$/.test(parts[1])) {
        const scientific = `${parts[0]} ${parts[1]}`;
        const remainder = v.slice(scientific.length).trim();

        let cultivar = '';
        const quoted = remainder.match(/['"]([^'"]+)['"]/);
        if (quoted?.[1]) cultivar = quoted[1].trim();
        else {
            const cv = remainder.match(/\bcv\.\s*([A-Za-z0-9-]+(?:\s+[A-Za-z0-9-]+)*)/i);
            if (cv?.[1]) cultivar = collapseWhitespace(cv[1]);
        }

        return { scientific, cultivar, common: '', needsConfirmation: false };
    }

    // Otherwise treat as a common name needing confirmation.
    return { scientific: '', cultivar: '', common: v, needsConfirmation: true };
};

const getCanonicalTitle = (t: string): CanonicalColumnTitle | null => {
    const n = normalizeHeader(t);
    if (n === 'species (scientific)' || n === 'species scientific') return 'Species (scientific)';
    if (n === 'cultivar') return 'Cultivar';
    if (n === 'common name' || n === 'commonname') return 'Common name';
    if (n === 'notes' || n === 'note') return 'Notes';
    if (n === 'source' || n === 'sources') return 'Source';
    return null;
};

const shapeSpeciesFirst = (
    base: { columns: MatrixColumn[]; rows: MatrixRow[] },
    _opts?: { runSpeciesCorrectionPass?: boolean }
): { columns: MatrixColumn[]; rows: MatrixRow[] } => {
    const { columns, rows } = base;
    if (!columns || columns.length === 0) return base;

    // Step B1: header match
    let speciesColIdx = columns.findIndex((c) => headerMatchesSpecies(c.title));
    let headerTrusted = speciesColIdx !== -1;

    // Step B2: content scoring
    if (speciesColIdx === -1) {
        const maxRows = 50;
        const scored = columns
            .map((c, idx) => ({ idx, id: c.id, score: scoreSpeciesColumnByContent(rows, c.id, maxRows) }))
            .sort((a, b) => b.score - a.score);
        const best = scored[0];
        if (best && best.score >= 8) {
            speciesColIdx = best.idx;
            headerTrusted = false;
        }
    }

    // Step B3: fail-safe
    if (speciesColIdx === -1) {
        console.info('[species-shape] no species column detected; leaving table unchanged');
        return base;
    }

    const speciesCol = columns[speciesColIdx];

    // Build canonical column values
    const shapedRowsIntermediate = rows.map((r) => {
        const speciesRaw = String(r.cells?.[speciesCol.id]?.value ?? '');
        const parsed = parseSpeciesCell(speciesRaw);
        return { row: r, parsed };
    });

    const anyCultivar = shapedRowsIntermediate.some((x) => Boolean(x.parsed.cultivar));
    const anyCommon = shapedRowsIntermediate.some((x) => Boolean(x.parsed.common));

    // Notes is conditional but will often be needed (missing species / overflow).
    // We'll compute per-row notes and then decide if any is non-empty.
    const canonicalNotes: string[] = [];

    // Prepare attribute columns (all non-species original columns)
    const canonicalTitlesSet = new Set<string>(CANONICAL_COLUMN_ORDER.map((t) => normalizeHeader(t)));
    const attributeColumnsRaw = columns
        .filter((_, idx) => idx !== speciesColIdx)
        .map((c) => {
            const maybeCanonical = getCanonicalTitle(c.title);
            // Treat these titles as attributes if they collide with canonicals.
            const baseTitle = titleCase(c.title || '');
            const normalized = normalizeHeader(baseTitle);
            const safeTitle = canonicalTitlesSet.has(normalized) ? `${baseTitle} (original)` : baseTitle;
            return { col: c, title: safeTitle };
        });

    // Column cap (attributes): keep first 30, push extras to Notes.
    const ATTRIBUTE_CAP = 30;
    const keptAttributes = attributeColumnsRaw.slice(0, ATTRIBUTE_CAP);
    const droppedAttributes = attributeColumnsRaw.slice(ATTRIBUTE_CAP);

    // Canonical columns (created conditionally per spec)
    const now = Date.now();
    const outColumns: MatrixColumn[] = [];
    const colIdByCanonical: Partial<Record<CanonicalColumnTitle, string>> = {};

    // Species (scientific) required
    colIdByCanonical['Species (scientific)'] = `col-sp-${now}`;
    outColumns.push({
        id: colIdByCanonical['Species (scientific)']!,
        title: 'Species (scientific)',
        type: 'text',
        width: 250,
        isPrimaryKey: true,
    });

    if (anyCultivar) {
        colIdByCanonical['Cultivar'] = `col-cv-${now}`;
        outColumns.push({ id: colIdByCanonical['Cultivar']!, title: 'Cultivar', type: 'text', width: 180 });
    }
    if (anyCommon) {
        colIdByCanonical['Common name'] = `col-cn-${now}`;
        outColumns.push({ id: colIdByCanonical['Common name']!, title: 'Common name', type: 'text', width: 180 });
    }

    // Attribute columns next (preserve type/options where possible)
    const outAttributeColumns: MatrixColumn[] = [];
    const usedTitles = new Set<string>(outColumns.map((c) => normalizeHeader(c.title)));
    for (const a of keptAttributes) {
        let t = a.title || 'Attribute';
        let n = normalizeHeader(t);
        let k = 2;
        while (usedTitles.has(n)) {
            t = `${a.title} (${k})`;
            n = normalizeHeader(t);
            k += 1;
        }
        usedTitles.add(n);
        outAttributeColumns.push({
            ...a.col,
            id: `col-attr-${outColumns.length + outAttributeColumns.length}-${now}`,
            title: t,
            isPrimaryKey: false,
        });
    }

    // Notes column is conditional; we'll decide after building rows (but need id reserved for mapping).
    const notesColId = `col-notes-${now}`;
    colIdByCanonical['Notes'] = notesColId;

    // Source column exists only if any non-empty; we do not populate it in this PR.

    // Build rows and map values
    const outRows: MatrixRow[] = shapedRowsIntermediate.map(({ row, parsed }, idx) => {
        const cells: any = {};

        const speciesVal = parsed.scientific;
        const cultivarVal = parsed.cultivar;
        const commonVal = parsed.common;

        // Canonicals
        cells[colIdByCanonical['Species (scientific)']!] = { columnId: colIdByCanonical['Species (scientific)']!, value: speciesVal };
        if (anyCultivar && colIdByCanonical['Cultivar']) {
            cells[colIdByCanonical['Cultivar']] = { columnId: colIdByCanonical['Cultivar'], value: cultivarVal };
        }
        if (anyCommon && colIdByCanonical['Common name']) {
            cells[colIdByCanonical['Common name']] = { columnId: colIdByCanonical['Common name'], value: commonVal };
        }

        let notes = '';
        if (!speciesVal) {
            notes = collapseWhitespace([notes, parsed.needsConfirmation ? 'Needs confirmation' : '', 'Missing species'].filter(Boolean).join(' • '));
        } else if (parsed.needsConfirmation && !headerTrusted) {
            notes = collapseWhitespace([notes, 'Needs confirmation'].filter(Boolean).join(' • '));
        }

        // Attributes
        keptAttributes.forEach((a, colIdx) => {
            const outCol = outAttributeColumns[colIdx];
            const v = row.cells?.[a.col.id]?.value;
            cells[outCol.id] = { columnId: outCol.id, value: String(v ?? '') };
        });

        // Dropped attributes go into notes
        if (droppedAttributes.length > 0) {
            const extras = droppedAttributes
                .map((a) => {
                    const v = String(row.cells?.[a.col.id]?.value ?? '').trim();
                    if (!v) return '';
                    return `${a.title}=${v}`;
                })
                .filter(Boolean)
                .join('; ');
            if (extras) {
                notes = collapseWhitespace([notes, `Extra: ${extras}`].filter(Boolean).join(' • '));
            }
        }

        canonicalNotes.push(notes);
        // We'll attach notes later only if needed.

        return {
            id: `row-sp-${idx}-${now}`,
            entityName: speciesVal || commonVal || row.entityName || `Item ${idx + 1}`,
            cells,
        };
    });

    const anyNotes = canonicalNotes.some((n) => Boolean(n));
    if (anyNotes) {
        outColumns.push(...outAttributeColumns);
        outColumns.push({ id: notesColId, title: 'Notes', type: 'text', width: 400 });
        outRows.forEach((r, i) => {
            r.cells[notesColId] = { columnId: notesColId, value: canonicalNotes[i] || '' };
        });
    } else {
        outColumns.push(...outAttributeColumns);
    }

    return { columns: outColumns, rows: outRows };
};

const getColumnByNormalizedTitle = (columns: MatrixColumn[], title: string) => {
    const key = normalizeHeader(title);
    return columns.find((c) => normalizeHeader(c.title) === key) || null;
};

const ensureColumn = (
    matrix: { columns: MatrixColumn[]; rows: MatrixRow[] },
    title: CanonicalColumnTitle,
    colId: string,
    width: number
) => {
    const existing = getColumnByNormalizedTitle(matrix.columns, title);
    if (existing) return existing;
    const col: MatrixColumn = {
        id: colId,
        title,
        type: 'text',
        width,
        isPrimaryKey: title === 'Species (scientific)',
    };
    matrix.columns.push(col);
    return col;
};

const withTimeout = async <T,>(p: Promise<T>, ms: number): Promise<{ ok: true; value: T } | { ok: false }> => {
    let timeoutId: any = null;
    const timeout = new Promise<{ ok: false }>((resolve) => {
        timeoutId = setTimeout(() => resolve({ ok: false }), ms);
    });
    const result = await Promise.race([p.then((value) => ({ ok: true as const, value })), timeout]);
    if (timeoutId) clearTimeout(timeoutId);
    return result as any;
};

const applySpeciesCorrectionPass = async (
    shaped: { columns: MatrixColumn[]; rows: MatrixRow[] }
): Promise<{ columns: MatrixColumn[]; rows: MatrixRow[] }> => {
    const speciesCol = getColumnByNormalizedTitle(shaped.columns, 'Species (scientific)') || getColumnByNormalizedTitle(shaped.columns, 'Species');
    if (!speciesCol) return shaped; // only run after species-column detection

    const cultivarCol = getColumnByNormalizedTitle(shaped.columns, 'Cultivar');
    const commonCol = getColumnByNormalizedTitle(shaped.columns, 'Common name');
    const notesCol = getColumnByNormalizedTitle(shaped.columns, 'Notes');

    const MAX_ROWS = 50;
    const sample = shaped.rows.slice(0, MAX_ROWS).map((r, idx) => {
        const scientific = String(r.cells?.[speciesCol.id]?.value ?? '').trim();
        const cultivar = cultivarCol ? String(r.cells?.[cultivarCol.id]?.value ?? '').trim() : '';
        const commonName = commonCol ? String(r.cells?.[commonCol.id]?.value ?? '').trim() : '';
        return { index: idx, scientific, cultivar, commonName };
    });

    // If nothing to correct, skip.
    const hasAnyInput = sample.some((x) => Boolean(x.scientific || x.cultivar || x.commonName));
    if (!hasAnyInput) return shaped;

    const schema: Schema = {
        type: Type.OBJECT,
        properties: {
            items: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        index: { type: Type.NUMBER },
                        scientific: { type: Type.STRING },
                        cultivar: { type: Type.STRING },
                        commonName: { type: Type.STRING },
                        needsConfirmation: { type: Type.BOOLEAN },
                        note: { type: Type.STRING }
                    },
                    required: ['index', 'scientific', 'needsConfirmation']
                }
            }
        },
        required: ['items']
    };

    const prompt = `You are a botanist and data normalizer.
Given rows with (scientific, cultivar, commonName), normalize scientific names (Genus species) and cultivar.
If only a common name is present, suggest the most likely scientific name, but set needsConfirmation=true if uncertain.
Return JSON only, matching the schema. Preserve order using the provided index.

Rows:
${JSON.stringify(sample)}`;

    const correctionPromise = ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: schema
        }
    });

    const timed = await withTimeout(correctionPromise, 4500);
    if (!timed.ok) {
        console.info('[species-correction] failed, continuing without correction');
        return shaped;
    }

    let data: any;
    try {
        data = JSON.parse((timed.value as any).text || '{}');
    } catch {
        console.info('[species-correction] failed, continuing without correction');
        return shaped;
    }

    const items: any[] = Array.isArray(data?.items) ? data.items : [];
    if (items.length === 0) return shaped;

    // Apply corrections into a shallow-cloned matrix (avoid mutating caller unexpectedly).
    const out: { columns: MatrixColumn[]; rows: MatrixRow[] } = {
        columns: [...shaped.columns],
        rows: shaped.rows.map((r) => ({ ...r, cells: { ...r.cells } }))
    };

    // Ensure canonical columns only if they will have values.
    const anyCultivar = items.some((i) => Boolean(String(i?.cultivar ?? '').trim()));
    const anyCommon = items.some((i) => Boolean(String(i?.commonName ?? '').trim()));
    const anyNote = items.some((i) => Boolean(String(i?.note ?? '').trim()) || i?.needsConfirmation === true);

    const now = Date.now();
    const ensuredSpecies = ensureColumn(out, 'Species (scientific)', speciesCol.id, 250);
    const ensuredCultivar = anyCultivar ? ensureColumn(out, 'Cultivar', cultivarCol?.id || `col-cv-corr-${now}`, 180) : null;
    const ensuredCommon = anyCommon ? ensureColumn(out, 'Common name', commonCol?.id || `col-cn-corr-${now}`, 180) : null;
    const ensuredNotes = anyNote ? ensureColumn(out, 'Notes', notesCol?.id || `col-notes-corr-${now}`, 400) : null;

    const byIndex = new Map<number, any>();
    items.forEach((i) => {
        const idx = typeof i?.index === 'number' ? i.index : NaN;
        if (Number.isFinite(idx)) byIndex.set(idx, i);
    });

    for (let i = 0; i < Math.min(out.rows.length, MAX_ROWS); i++) {
        const corr = byIndex.get(i);
        if (!corr) continue;

        const scientific = String(corr?.scientific ?? '').trim();
        const cultivar = String(corr?.cultivar ?? '').trim();
        const commonName = String(corr?.commonName ?? '').trim();
        const needsConfirmation = Boolean(corr?.needsConfirmation);
        const note = String(corr?.note ?? '').trim();

        if (scientific) {
            out.rows[i].cells[ensuredSpecies.id] = { columnId: ensuredSpecies.id, value: scientific };
        }
        if (ensuredCultivar && cultivar) {
            out.rows[i].cells[ensuredCultivar.id] = { columnId: ensuredCultivar.id, value: cultivar };
        }
        if (ensuredCommon && commonName) {
            out.rows[i].cells[ensuredCommon.id] = { columnId: ensuredCommon.id, value: commonName };
        }
        if (ensuredNotes && (note || needsConfirmation)) {
            const prev = String(out.rows[i].cells?.[ensuredNotes.id]?.value ?? '').trim();
            const parts = [];
            if (prev) parts.push(prev);
            if (needsConfirmation) parts.push('Needs confirmation');
            if (note) parts.push(note);
            out.rows[i].cells[ensuredNotes.id] = { columnId: ensuredNotes.id, value: parts.join(' • ') };
        }
    }

    return out;
};

export class AIService {
  
  constructor() {
    console.log(`WeFlora AI Service Initialized. Mode: Client-Side Gemini SDK`);
  }

  // --- Core Capabilities ---

  async generateTitle(content: string, type: 'report' | 'worksheet'): Promise<string> {
      try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a short, professional title (max 5 words) for a ${type} containing the following content: \n\n${content.substring(0, 500)}...`,
            config: {
                responseMimeType: 'text/plain',
            }
        });
        return response.text?.trim().replace(/^"|"$/g, '') || (type === 'report' ? 'New Report' : 'New Worksheet');
      } catch (e) {
          console.error("Title generation failed", e);
          return type === 'report' ? 'New Report' : 'New Worksheet';
      }
  }

  async refineText(text: string, instruction: string): Promise<string> {
      try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Original Text: "${text}"\n\nInstruction: ${instruction}\n\nReturn ONLY the refined text.`,
        });
        return response.text || text;
      } catch (e) {
          console.error("Refine text failed", e);
          return text; 
      }
  }

  async summarizeUserMemory(history: string): Promise<MemorySummary> {
      const prompt = `
You are extracting stable, long-term user memory from chat history.
Summarize ONLY durable facts, preferences, and user profile details that are explicitly stated.
Do NOT infer or hallucinate.

Return strict JSON with:
{
  "profile": ["string", ...],
  "preferences": ["string", ...],
  "stableFacts": ["string", ...],
  "summary": "short paragraph"
}

If nothing is available, use empty arrays and an empty summary string.

Conversation History:
${history}
      `;

      try {
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: prompt,
              config: { responseMimeType: 'application/json' }
          });

          const parsed = parseJSONSafely(response.text || '');
          const profile = Array.isArray(parsed.profile) ? parsed.profile.filter(Boolean) : [];
          const preferences = Array.isArray(parsed.preferences) ? parsed.preferences.filter(Boolean) : [];
          const stableFacts = Array.isArray(parsed.stableFacts) ? parsed.stableFacts.filter(Boolean) : [];
          const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';

          return { profile, preferences, stableFacts, summary };
      } catch (e) {
          console.error('Memory summary failed', e);
          return { profile: [], preferences: [], stableFacts: [], summary: '' };
      }
  }

  async structureTextAsMatrix(
      text: string,
      opts?: { runSpeciesCorrectionPass?: boolean }
  ): Promise<{ columns: MatrixColumn[], rows: MatrixRow[] }> {
        // PR1: If input contains a real markdown pipe table, prefer deterministic parsing
        // to avoid collapsing the entire table into a single cell.
        const parsed = parseMarkdownPipeTableAsMatrix(text);
        if (parsed) {
            const shaped = shapeSpeciesFirst(parsed, opts);
            if (opts?.runSpeciesCorrectionPass) {
                try {
                    return await applySpeciesCorrectionPass(shaped);
                } catch {
                    console.info('[species-correction] failed, continuing without correction');
                }
            }
            return shaped;
        }

        try {
            const schema: Schema = {
                type: Type.OBJECT,
                properties: {
                    columns: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING, description: "Column header name" },
                                dataType: {
                                    type: Type.STRING,
                                    description: "Inferred data type. Use 'number' for numeric/currency/percentage, 'select' for categorical/enum data, 'text' for everything else.",
                                    enum: ["text", "number", "select"]
                                }
                            },
                            required: ["title", "dataType"]
                        },
                        description: "List of column definitions including inferred data types."
                    },
                    rows: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                values: {
                                    type: Type.ARRAY,
                                    items: { type: Type.STRING },
                                    description: "List of cell values corresponding to the columns order."
                                }
                            }
                        }
                    }
                }
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Extract the data from the following text into a structured table format.
                
                CRITICAL INSTRUCTION: Infer the specific data type for each column based on the data patterns.
                - If values are numbers, currency, or percentages -> use 'number'.
                - If values are repeating categories (e.g. High/Med/Low, Species Types, Yes/No, Status) -> use 'select'.
                - Otherwise use 'text'.
                
                Text: \n\n${text}`,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: schema
                }
            });

            const result = JSON.parse(response.text || "{}");
            
            const rawColumns = result.columns || []; // Array of {title, dataType}
            const rawRows = result.rows || [];

            if (rawColumns.length === 0) throw new Error("No columns found");

            // First pass: Extract values to arrays to help with processing
            const rowsData = rawRows.map((row: any) => row.values || []);

            const columns: MatrixColumn[] = rawColumns.map((colDef: any, i: number) => {
                let type: MatrixColumnType = 'text';
                if (colDef.dataType === 'number') type = 'number';
                if (colDef.dataType === 'select') type = 'select';

                const col: MatrixColumn = {
                    id: `col-${i}-${Date.now()}`,
                    title: colDef.title || `Column ${i + 1}`,
                    type: type,
                    width: i === 0 ? 250 : 150,
                    isPrimaryKey: i === 0
                };

                // Logic to populate options for 'select' columns based on extracted data
                if (type === 'select') {
                    const uniqueVals = new Set<string>();
                    rowsData.forEach((rowVals: string[]) => {
                        const val = rowVals[i];
                        if (val) uniqueVals.add(String(val).trim());
                    });
                    
                    // If reasonable cardinality, set options. Otherwise revert to text.
                    if (uniqueVals.size > 0 && uniqueVals.size <= 20) {
                        col.options = Array.from(uniqueVals).sort();
                    } else {
                        col.type = 'text';
                    }
                }

                return col;
            });

            const rows: MatrixRow[] = rowsData.map((values: string[], i: number) => {
                const cells: any = {};
                
                columns.forEach((col, colIdx) => {
                    let val = values[colIdx] || '';
                    cells[col.id] = { columnId: col.id, value: String(val) };
                });
                
                return {
                    id: `row-${i}-${Date.now()}`,
                    entityName: values[0] || `Item ${i}`,
                    cells
                };
            });

            // If the model returns a degenerate table (e.g., single column / most rows single value),
            // but the input looks table-ish, re-try the deterministic markdown parser.
            const degenerate =
                columns.length <= 1 ||
                (rowsData.length > 0 && rowsData.filter((v: any[]) => (v?.length || 0) <= 1).length / rowsData.length >= 0.6);
            if (degenerate && hasMarkdownPipeTable(text)) {
                const retryParsed = parseMarkdownPipeTableAsMatrix(text);
                if (retryParsed) {
                    const shaped = shapeSpeciesFirst(retryParsed, opts);
                    if (opts?.runSpeciesCorrectionPass) {
                        try {
                            return await applySpeciesCorrectionPass(shaped);
                        } catch {
                            console.info('[species-correction] failed, continuing without correction');
                        }
                    }
                    return shaped;
                }
            }

            {
                const shaped = shapeSpeciesFirst({ columns, rows }, opts);
                if (opts?.runSpeciesCorrectionPass) {
                    try {
                        return await applySpeciesCorrectionPass(shaped);
                    } catch {
                        console.info('[species-correction] failed, continuing without correction');
                    }
                }
                return shaped;
            }

        } catch (e) {
            console.error("Structuring failed:", e);
            const colId = `col-note-${Date.now()}`;
            return {
                columns: [{ id: colId, title: 'Extracted Content', type: 'text', width: 400, isPrimaryKey: true }],
                rows: [{ id: `row-1`, entityName: 'Note', cells: { [colId]: { columnId: colId, value: text.substring(0, 500) } } }]
            };
        }
  }

  // Changed to Generator for Streaming
  async *generateChatStream(
      text: string, 
      files: File[] = [], 
      systemInstruction: string, 
      model: string = 'gemini-2.5-flash',
      contextItems: ContextItem[] = [],
      enableThinking: boolean = false
  ): AsyncGenerator<{ text?: string, grounding?: any }, void, unknown> {
      
      try {
        const parts: any[] = [];

        parts.push({ text: text });

        for (const file of files) {
            const base64Data = await fileToBase64(file);
            parts.push({
                inlineData: {
                    mimeType: file.type,
                    data: base64Data
                }
            });
        }

        // NEW: Inject internal asset content (Reports/Worksheets) directly into context
        if (contextItems.length > 0) {
             let contextFullText = "";
             contextItems.forEach(c => {
                 if (c.content) {
                     // Robust separator for internal context injection
                     contextFullText += `\n\n--- INTERNAL SOURCE START: ${c.name} (${c.source.toUpperCase()}) ---\n${c.content}\n--- INTERNAL SOURCE END ---\n`;
                 }
             });
             if (contextFullText) {
                 parts.push({ text: `\n\nThe following internal project data is provided for context:\n${contextFullText}` });
             }
        }

        const config: any = {
            systemInstruction: systemInstruction,
            tools: contextItems.some(i => i.source === 'web') ? [{ googleSearch: {} }] : undefined
        };

        if (enableThinking) {
            config.thinkingConfig = { thinkingBudget: 2048 }; 
        }

        const stream = await ai.models.generateContentStream({
            model: model,
            contents: { parts },
            config: config
        });

        for await (const chunk of stream) {
            yield { 
                text: chunk.text, 
                grounding: chunk.candidates?.[0]?.groundingMetadata 
            };
        }

      } catch (e) {
          console.error("Chat generation failed:", e);
          yield { 
              text: "⚠️ **Error**: Could not connect to Gemini API. Please check your API key and connection." 
          };
      }
  }

  // Kept for backward compat or single-shot tools
  async generateChatResponse(
      text: string, 
      files: File[] = [], 
      systemInstruction: string, 
      model: string = 'gemini-2.5-flash',
      contextItems: ContextItem[] = []
  ): Promise<{ text: string, grounding?: any }> {
      // Simple wrapper around stream for legacy calls
      let fullText = "";
      let lastGrounding = undefined;
      for await (const chunk of this.generateChatStream(text, files, systemInstruction, model, contextItems)) {
          if (chunk.text) fullText += chunk.text;
          if (chunk.grounding) lastGrounding = chunk.grounding;
      }
      return { text: fullText, grounding: lastGrounding };
  }

  async runAICell(prompt: string, contextFiles: File[] = [], globalContext?: string): Promise<string> {
       try {
           const parts: any[] = [];
           
           if (globalContext) {
               parts.push({ text: `Global Project Context:\n${globalContext}\n---\n` });
           }

           parts.push({ text: prompt });
           
           for (const file of contextFiles) {
                const base64Data = await fileToBase64(file);
                parts.push({
                    inlineData: {
                        mimeType: file.type,
                        data: base64Data
                    }
                });
           }

           const response = await ai.models.generateContent({
               model: 'gemini-2.5-flash',
               contents: { parts }
           });
           
           return response.text?.trim() || "";
       } catch (e) {
           console.error("Skill execution failed", e);
           return "Error";
       }
  }

  // --- NEW: Structured Skill Execution with Retry ---
  async runSkillCell(args: {
    prompt: string;
    outputType: SkillOutputType;
    validator: (raw: string) => SkillValidationResult;
    contextFiles: File[];
    globalContext?: string;
    evidenceRequired?: boolean;
    noGuessing?: boolean;
  }): Promise<{
    rawText: string;
    displayValue: string;
    reasoning: string;
    normalized: any;
    outputType: SkillOutputType;
    ok: boolean;
    error?: string;
    model?: string;
    promptHash?: string;
  }> {
    const { prompt, outputType, validator, contextFiles, globalContext, evidenceRequired, noGuessing } = args;
    const model = 'gemini-2.5-flash';
    
    // Construct System Instruction based on policy
    let systemInstruction = "You are an expert analyst.";
    if (evidenceRequired) {
        systemInstruction += " You must cite specific evidence from the provided documents. Do not hallucinate.";
    }
    if (noGuessing) {
        systemInstruction += " If the answer is not explicitly found in the context, state that data is insufficient. Do not guess.";
    }

    const runAttempt = async (currentPrompt: string): Promise<string> => {
        const parts: any[] = [];
        if (globalContext) {
            parts.push({ text: `Global Project Context:\n${globalContext}\n---\n` });
        }
        parts.push({ text: currentPrompt });
        
        for (const file of contextFiles) {
            const base64Data = await fileToBase64(file);
            parts.push({
                inlineData: {
                    mimeType: file.type,
                    data: base64Data
                }
            });
        }

        const response = await ai.models.generateContent({
            model: model,
            contents: { parts },
            config: { systemInstruction }
        });
        
        return response.text?.trim() || "";
    };

    try {
        // Attempt 1
        let rawText = await runAttempt(prompt);
        let validation = validator(rawText);

        // Attempt 2 (Retry) if validation fails
        if (!validation.ok) {
            console.warn(`Skill validation failed (Type: ${outputType}). Retrying with strict format instruction...`);
            
            // Append explicit format reminder based on error or generic requirement
            const retryInstruction = `
            Previous output was invalid: "${validation.error}".
            CRITICAL: Your output MUST match the format exactly.
            Include '— reason' at the end.
            Do NOT include markdown blocks, preambles, or extra text.
            Just the value and the reason.
            `;
            
            rawText = await runAttempt(prompt + "\n\n" + retryInstruction);
            validation = validator(rawText);
        }

        return {
            rawText,
            displayValue: validation.displayValue || rawText, // Fallback to raw if display missing but normalized might exist? Actually if !ok displayValue might be undefined.
            reasoning: validation.reasoning || "",
            normalized: validation.normalized,
            outputType,
            ok: validation.ok,
            error: validation.error,
            model: model,
            promptHash: hashPrompt(prompt)
        };

    } catch (e: any) {
        console.error("runSkillCell failed completely", e);
        return {
            rawText: "",
            displayValue: "Error",
            reasoning: e.message || "Unknown error during execution",
            normalized: null,
            outputType,
            ok: false,
            error: e.message,
            model: model,
            promptHash: hashPrompt(prompt)
        };
    }
  }

  async discoverStructures(files: File[]): Promise<DiscoveredStructure[]> {
      if (files.length === 0) return [];

      try {
        const file = files[0];
        const base64 = await fileToBase64(file);
        
        const schema: Schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    suggestedColumns: { type: Type.ARRAY, items: { type: Type.STRING } },
                    confidence: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] }
                }
            }
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: file.type, data: base64 } },
                    { text: "Analyze this document. Identify distinct tables or lists that could be converted into a worksheet. Return a list of suggested structures." }
                ]
            },
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema
            }
        });

        return JSON.parse(response.text || "[]");
      } catch (e) {
          console.error("Discovery failed", e);
          return [];
      }
  }

  async analyzeDocuments(files: File[], extractionContext?: string, targetColumns?: MatrixColumn[]): Promise<{ columns: MatrixColumn[], rows: any[] }> {
      if (files.length === 0) return { columns: [], rows: [] };
      
      try {
        const file = files[0];
        const base64 = await fileToBase64(file);
        
        let responseSchema: Schema | undefined;
        
        if (targetColumns && targetColumns.length > 0) {
             const properties: any = {};
             targetColumns.forEach(col => {
                 properties[col.id] = { type: Type.STRING, description: col.title };
             });
             
             responseSchema = {
                 type: Type.OBJECT,
                 properties: {
                     rows: {
                         type: Type.ARRAY,
                         items: {
                             type: Type.OBJECT,
                             properties: properties
                         }
                     }
                 }
             };
        }

        const prompt = `
            Extract data from this document.
            Context: ${extractionContext || 'General data extraction'}
            ${targetColumns ? `Map data strictly to these columns: ${targetColumns.map(c => c.title).join(', ')}` : ''}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: file.type, data: base64 } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema
            }
        });
        
        const result = JSON.parse(response.text || "{}");
        const rawRows = result.rows || [];
        
        const rows = rawRows.map((r: any, i: number) => ({
            id: `row-${i}-${Date.now()}`,
            entityName: targetColumns ? r[targetColumns[0].id] : (Object.values(r)[0] as string),
            cells: Object.keys(r).reduce((acc: any, key) => {
                acc[key] = { columnId: key, value: String(r[key]) };
                return acc;
            }, {})
        }));

        return { columns: targetColumns || [], rows };

      } catch (e) {
          console.error("Extraction failed", e);
          return { columns: [], rows: [] };
      }
  }

  async generateReportContent(
      dataContext: string, 
      mode: 'narrative' | 'list' | 'comparison', 
      userPrompt: string
  ): Promise<string> {
      try {
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: `
                Data Context: ${dataContext}
                
                Task: Generate a ${mode} based on the data above.
                User Instruction: ${userPrompt}
              `
          });
          return response.text || "";
      } catch (e) {
          console.error("Report generation failed", e);
          return "Error generating report content.";
      }
  }

  async getSpeciesProfile(speciesName: string): Promise<{ data: any, sources: any[] }> {
      try {
          // Use Google Search Grounding for real-time, accurate data
          // Schema is removed because Search tool + JSON schema is incompatible in strict mode
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash', // Flash supports grounding efficiently
              contents: `
                Research the tree species "${speciesName}" using Google Search.
                Return a valid JSON object describing it. 
                Do NOT use markdown code blocks (e.g. \`\`\`json). Just return the raw JSON string.
                
                JSON Structure:
                {
                  "scientificName": "string",
                  "commonName": "string",
                  "family": "string",
                  "isNative": boolean,
                  "height": "string (e.g. 15-20m)",
                  "spread": "string (e.g. 8-10m)",
                  "soilPreference": "string",
                  "sunExposure": "string",
                  "waterNeeds": "string",
                  "hardinessZone": "string",
                  "risks": ["string"],
                  "designUses": ["string"],
                  "alternatives": ["string"],
                  "insight": "string (a brief 2-sentence summary)"
                }
              `,
              config: {
                  tools: [{ googleSearch: {} }],
              }
          });
          
          const text = response.text || "{}";
          const data = parseJSONSafely(text);
          const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

          return { data, sources };

      } catch (e) {
          console.error("Species profile generation failed", e);
          return { data: null, sources: [] };
      }
  }

  async generateProjectInsights(matrices: Matrix[], reports: Report[]): Promise<ProjectInsights> {
        try {
            // Aggregate simplified context
            const worksheetSummaries = matrices.map(m => `Worksheet: "${m.title}" (${m.rows.length} rows). Columns: ${m.columns.map(c => c.title).join(', ')}.`).join('\n');
            const reportSummaries = reports.map(r => `Report: "${r.title}" (Last updated: ${r.lastModified}).`).join('\n');
            
            const context = `
            Project Data Overview:
            ${worksheetSummaries}
            ${reportSummaries}
            
            Instruction:
            Analyze this project structure and content.
            1. Generate a 50-word executive summary of the project status.
            2. Extract 3 key metrics (e.g. Total Species, Worksheets count, etc).
            3. Suggest 3 actionable next steps or missing data points.
            `;

            const schema: Schema = {
                type: Type.OBJECT,
                properties: {
                    summary: { type: Type.STRING },
                    metrics: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                label: { type: Type.STRING },
                                value: { type: Type.STRING },
                                icon: { type: Type.STRING, enum: ['chart', 'tree', 'alert', 'check'] }
                            }
                        }
                    },
                    actions: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING },
                                type: { type: Type.STRING, enum: ['missing_data', 'suggestion'] }
                            }
                        }
                    }
                }
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: context,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: schema
                }
            });

            const data = JSON.parse(response.text || "{}");
            return {
                summary: data.summary || "No insights available.",
                metrics: data.metrics || [],
                actions: data.actions || [],
                updatedAt: new Date().toISOString()
            };

        } catch (e) {
            console.error("Insights generation failed", e);
            return {
                summary: "Could not generate insights.",
                metrics: [],
                actions: [],
                updatedAt: new Date().toISOString()
            };
        }
  }
}

export const aiService = new AIService();
