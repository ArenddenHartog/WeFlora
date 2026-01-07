
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import type { 
    PinnedProject, Chat, ProjectFile, Matrix, Report, 
    ChatMessage, DiscoveredStructure, FloraGPTResponseEnvelope
} from '../types';
import GlobalWorkspace from './GlobalWorkspace';
import ProjectWorkspace from './ProjectWorkspace';
import WorksheetsRoute from './routes/WorksheetsRoute';
import ReportsRoute from './routes/ReportsRoute';
import PlanningRoute from './routes/PlanningRoute';
import GlobalLayout from './GlobalLayout';
import BaseModal from './BaseModal';
import { DatabaseIcon, FolderIcon, PlusIcon, CheckIcon, SparklesIcon, RefreshIcon } from './icons';
import { aiService, hasMarkdownPipeTable, parseMarkdownPipeTableAsMatrix } from '../services/aiService';
import { useProject } from '../contexts/ProjectContext';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import { navigateToCreatedEntity } from '../utils/navigation';

// Props reduced to minimal handlers if any
interface MainContentProps {
    onNavigate: (view: string) => void;
    onSelectProject: (id: string) => void;
    onOpenMenu: () => void;
}

const MainContent: React.FC<MainContentProps> = ({ 
    onNavigate, onSelectProject, onOpenMenu 
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    // Hooks for data access
    const { projects, matrices, createProject, createMatrix, createReport, updateMatrix } = useProject();
    const { currentWorkspace } = useData();
    const { showNotification, destinationModal, openDestinationModal, closeDestinationModal } = useUI();

    const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    // Only show persisted projects (UUID ids). Temp ids (e.g. proj-*) are never valid FKs.
    const persistedProjects = projects.filter(p => isUuid(p.id));

    // Wrappers to handle logic for Destination Modal
    const handleCreateMatrix = async (newM: Matrix, dest?: { type: 'project' | 'standalone' | 'new_project', projectId?: string, newProjectName?: string }) => {
        let finalProjectId = dest?.projectId || newM.projectId;
        
        if (dest?.type === 'new_project' && dest.newProjectName) {
            const tempId = `proj-${Date.now()}`;
            const created = await createProject({
                id: tempId,
                name: dest.newProjectName,
                icon: FolderIcon,
                status: 'Active',
                date: new Date().toISOString().split('T')[0],
                workspaceId: currentWorkspace.id,
                members: []
            });
            if (!created) return null;
            console.info('[project-created]', { source: 'destination-modal', id: created.id });
            finalProjectId = created.id;
        } else if (dest?.type === 'project') {
            // Do NOT navigate/select project here. Navigation happens only after successful create.
        }

        const matrixWithProject = { ...newM, projectId: finalProjectId };
        return await createMatrix(matrixWithProject);
    };

    const handleCreateReport = async (newR: Report, dest?: { type: 'project' | 'standalone' | 'new_project', projectId?: string, newProjectName?: string }) => {
        let finalProjectId = dest?.projectId || newR.projectId;

        if (dest?.type === 'new_project' && dest.newProjectName) {
            const tempId = `proj-${Date.now()}`;
            const created = await createProject({
                id: tempId,
                name: dest.newProjectName,
                icon: FolderIcon,
                status: 'Active',
                date: new Date().toISOString().split('T')[0],
                workspaceId: currentWorkspace.id,
                members: []
            });
            if (!created) return null;
            console.info('[project-created]', { source: 'destination-modal', id: created.id });
            finalProjectId = created.id;
        } else if (dest?.type === 'project') {
            // Do NOT navigate/select project here. Navigation happens only after successful create.
        }

        const reportWithProject = { ...newR, projectId: finalProjectId };
        return await createReport(reportWithProject);
    };

    const buildMatrixFromFloraGPT = (payload: FloraGPTResponseEnvelope, citationsText: string): Matrix | null => {
        if (payload.responseType !== 'answer') return null;

        const now = Date.now();
        const makeColumns = (titles: string[]) =>
            titles.map((title, idx) => ({
                id: `col-flora-${idx}-${now}`,
                title,
                type: 'text' as const,
                width: idx === 0 ? 220 : 180,
                isPrimaryKey: idx === 0
            }));

        if (payload.mode === 'general_research') {
            if (payload.tables && payload.tables.length > 0) {
                const table = payload.tables[0];
                const columns = makeColumns(table.columns);
                const rows = table.rows.map((row, idx) => {
                    const cells: Record<string, { columnId: string; value: string }> = {};
                    columns.forEach((col, colIdx) => {
                        cells[col.id] = { columnId: col.id, value: row[colIdx] ?? '' };
                    });
                    return { id: `row-flora-${now}-${idx}`, cells };
                });
                return {
                    id: `mtx-chat-${now}`,
                    title: 'FloraGPT Research',
                    description: 'Generated from FloraGPT',
                    columns,
                    rows
                };
            }

            const columns = makeColumns(['Summary', 'Highlights', 'Citations']);
            const highlights = Array.isArray(payload.data.highlights) ? payload.data.highlights.join('; ') : '';
            const rows = [
                {
                    id: `row-flora-${now}-0`,
                    cells: {
                        [columns[0].id]: { columnId: columns[0].id, value: payload.data.summary || '' },
                        [columns[1].id]: { columnId: columns[1].id, value: highlights },
                        [columns[2].id]: { columnId: columns[2].id, value: citationsText }
                    }
                }
            ];
            return {
                id: `mtx-chat-${now}`,
                title: 'FloraGPT Research',
                description: 'Generated from FloraGPT',
                columns,
                rows
            };
        }

        if (payload.mode === 'suitability_scoring') {
            const columns = makeColumns(['Name', 'Suitability_Score', 'Risk_Flags', 'Rationale', 'Citations']);
            const results = Array.isArray(payload.data.results) ? payload.data.results : [];
            const rows = results.map((result: any, idx: number) => ({
                id: `row-flora-${now}-${idx}`,
                cells: {
                    [columns[0].id]: { columnId: columns[0].id, value: result.name ?? '' },
                    [columns[1].id]: { columnId: columns[1].id, value: String(result.score ?? '') },
                    [columns[2].id]: { columnId: columns[2].id, value: Array.isArray(result.riskFlags) ? result.riskFlags.join('; ') : '' },
                    [columns[3].id]: { columnId: columns[3].id, value: result.rationale ?? '' },
                    [columns[4].id]: { columnId: columns[4].id, value: Array.isArray(result.citations) && result.citations.length > 0 ? result.citations.join('; ') : citationsText }
                }
            }));
            return {
                id: `mtx-chat-${now}`,
                title: 'FloraGPT Suitability',
                description: 'Generated from FloraGPT',
                columns,
                rows
            };
        }

        if (payload.mode === 'spec_writer') {
            const columns = makeColumns(['Spec_Title', 'Field', 'Value', 'Assumptions', 'Citations']);
            const assumptions = Array.isArray(payload.data.assumptions) ? payload.data.assumptions.join('; ') : '';
            const fields = Array.isArray(payload.data.specFields) ? payload.data.specFields : [];
            const rows = fields.map((field: any, idx: number) => ({
                id: `row-flora-${now}-${idx}`,
                cells: {
                    [columns[0].id]: { columnId: columns[0].id, value: payload.data.specTitle ?? '' },
                    [columns[1].id]: { columnId: columns[1].id, value: field.label ?? '' },
                    [columns[2].id]: { columnId: columns[2].id, value: field.value ?? '' },
                    [columns[3].id]: { columnId: columns[3].id, value: assumptions },
                    [columns[4].id]: { columnId: columns[4].id, value: Array.isArray(payload.data.citations) && payload.data.citations.length > 0 ? payload.data.citations.join('; ') : citationsText }
                }
            }));
            return {
                id: `mtx-chat-${now}`,
                title: payload.data.specTitle || 'FloraGPT Spec',
                description: 'Generated from FloraGPT',
                columns,
                rows
            };
        }

        if (payload.mode === 'policy_compliance') {
            const columns = makeColumns(['Compliance_Status', 'Issues', 'Citations']);
            const issues = Array.isArray(payload.data.issues)
                ? payload.data.issues.map((issue: any) => issue.issue).filter(Boolean).join('; ')
                : '';
            const rows = [
                {
                    id: `row-flora-${now}-0`,
                    cells: {
                        [columns[0].id]: { columnId: columns[0].id, value: payload.data.status ?? '' },
                        [columns[1].id]: { columnId: columns[1].id, value: issues },
                        [columns[2].id]: { columnId: columns[2].id, value: Array.isArray(payload.data.citations) && payload.data.citations.length > 0 ? payload.data.citations.join('; ') : citationsText }
                    }
                }
            ];
            return {
                id: `mtx-chat-${now}`,
                title: 'FloraGPT Compliance',
                description: 'Generated from FloraGPT',
                columns,
                rows
            };
        }

        return null;
    };

    // --- Modal Logic (using UI Context state) ---
    
    const [destMode, setDestMode] = useState<'general' | 'project' | 'new'>('general');
    const [selectedDestProject, setSelectedDestProject] = useState('');
    const [newDestProjectName, setNewDestProjectName] = useState('');
    const [isExtracting, setIsExtracting] = useState(false);
    const [runSpeciesCorrectionPass, setRunSpeciesCorrectionPass] = useState(false);
    const [worksheetStep, setWorksheetStep] = useState<'configure' | 'preview'>('configure');
    const [worksheetPreview, setWorksheetPreview] = useState<Matrix | null>(null);

    // Effect to reset state when modal opens
    useEffect(() => {
        if (destinationModal.isOpen) {
            setDestMode('general');
            setSelectedDestProject('');
            setNewDestProjectName('');
            setIsExtracting(false);
            setRunSpeciesCorrectionPass(false);
            setWorksheetStep('configure');
            setWorksheetPreview(null);
        }
    }, [destinationModal.isOpen]);

    const updatePreviewColumnTitle = (columnId: string, title: string) => {
        setWorksheetPreview(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                columns: prev.columns.map(col => col.id === columnId ? { ...col, title } : col)
            };
        });
    };

    const removePreviewColumn = (columnId: string) => {
        setWorksheetPreview(prev => {
            if (!prev) return prev;
            const nextColumns = prev.columns.filter(col => col.id !== columnId);
            const nextRows = prev.rows.map(row => {
                const { [columnId]: _removed, ...rest } = row.cells;
                return { ...row, cells: rest };
            });
            return { ...prev, columns: nextColumns, rows: nextRows };
        });
    };

    const handleOpenDestinationModal = (type: 'report' | 'worksheet', message: ChatMessage) => {
        openDestinationModal(type, message);
    };

    const handleConfirmDest = async () => {
        const { type, message } = destinationModal;
        if (!message) return;

        // PR2: If user is currently inside a standalone worksheet editor (/worksheets/:matrixId),
        // "Copy → Worksheet" should append rows into that worksheet (no new routes/UI).
        const appendTargetMatrixId = (() => {
            const m = location.pathname.match(/^\/worksheets\/([^/]+)$/);
            return m?.[1] || null;
        })();

        let destination: { type: 'project' | 'standalone' | 'new_project', projectId?: string, newProjectName?: string };

        if (destMode === 'project') {
            if (!selectedDestProject) {
                alert("Please select a project.");
                return;
            }
            destination = { type: 'project', projectId: selectedDestProject };
        } else if (destMode === 'new') {
            if (!newDestProjectName.trim()) {
                alert("Please enter a project name.");
                return;
            }
            destination = { type: 'new_project', newProjectName: newDestProjectName.trim() };
        } else {
            destination = { type: 'standalone' };
        }

        if (type === 'report') {
            const report: Report = {
                id: `rep-chat-${Date.now()}`,
                title: 'AI Chat Report',
                content: message.text,
                lastModified: new Date().toLocaleDateString(),
                tags: ['ai-import']
            };
            const created = await handleCreateReport(report, destination);
            if (!created) return;
            console.info('[create-flow] copy to report', {
                kind: 'report',
                withinProject: Boolean(created.projectId),
                projectId: created.projectId,
                reportId: created.id,
                tabId: Boolean(created.projectId) ? created.id : undefined
            });
            navigateToCreatedEntity({
                navigate,
                kind: 'report',
                withinProject: Boolean(created.projectId),
                projectId: created.projectId,
                reportId: created.id,
                focusTabId: created.id
            });
            closeDestinationModal();
            showNotification('Report created from chat');
        } else {
            if (worksheetStep === 'configure') {
                setIsExtracting(true);
                try {
                    const citationsText = Array.isArray(message.citations) && message.citations.length > 0
                        ? message.citations.map(c => c.sourceId || c.source).join('; ')
                        : '';
                    const floraMatrix = message.floraGPT ? buildMatrixFromFloraGPT(message.floraGPT, citationsText) : null;
                    const result = floraMatrix ?? await aiService.structureTextAsMatrix(message.text, { runSpeciesCorrectionPass });
                    setWorksheetPreview(result);
                    setWorksheetStep('preview');
                } catch (error) {
                    console.error("Extraction failed", error);
                    showNotification("Failed to extract worksheet data.", 'error');
                } finally {
                    setIsExtracting(false);
                }
                return;
            }

            if (!worksheetPreview) {
                showNotification("No worksheet preview available.", 'error');
                return;
            }

            setIsExtracting(true);
            try {
                const result = worksheetPreview;

                // Append mode: only when in standalone worksheet editor AND the user chose General Library.
                if (appendTargetMatrixId && destination.type === 'standalone') {
                    const target = matrices.find(m => m.id === appendTargetMatrixId);
                    if (target) {
                        // Merge columns (map by title) and append rows.
                        const normalize = (s: string) => String(s || '').trim().toLowerCase();
                        const existingCols = [...target.columns];
                        const existingByTitle = new Map(existingCols.map(c => [normalize(c.title), c]));

                        // Canonical columns should not be duplicated if they already exist.
                        const canonicalTitles = new Set([
                            'species (scientific)',
                            'cultivar',
                            'common name',
                            'notes',
                            'source'
                        ]);

                        const ensureColumn = (incomingCol: any) => {
                            const key = normalize(incomingCol.title);
                            const found = existingByTitle.get(key);
                            if (found) return found;
                            // Avoid duplicate canonicals by title
                            if (canonicalTitles.has(key) && existingByTitle.has(key)) return existingByTitle.get(key)!;
                            const newCol = { ...incomingCol, id: `col-app-${Date.now()}-${Math.random().toString(16).slice(2)}`, visible: true };
                            existingCols.push(newCol);
                            existingByTitle.set(key, newCol);
                            return newCol;
                        };

                        // Build mapping for incoming columns -> existing columns (creating as needed).
                        // Guardrail: cap newly-added attribute columns; overflow goes into Notes.
                        const ATTR_CAP = 30;
                        const isCanonical = (title: string) => canonicalTitles.has(normalize(title));
                        const existingAttrCount = existingCols.filter(c => !isCanonical(c.title)).length;
                        let remainingAttrSlots = Math.max(0, ATTR_CAP - existingAttrCount);

                        // Find/ensure Notes column (only if needed).
                        const notesKey = normalize('Notes');
                        const getNotesCol = () => existingByTitle.get(notesKey) || null;

                        const colMap = new Map<string, { id: string; title: string } | null>();
                        for (const col of result.columns) {
                            if (isCanonical(col.title)) {
                                const ensured = ensureColumn(col);
                                colMap.set(col.id, { id: ensured.id, title: ensured.title });
                                continue;
                            }
                            if (remainingAttrSlots > 0) {
                                const ensured = ensureColumn(col);
                                colMap.set(col.id, { id: ensured.id, title: ensured.title });
                                remainingAttrSlots -= normalize(col.title) === normalize(ensured.title) ? 0 : 0;
                            } else {
                                colMap.set(col.id, null);
                            }
                        }

                        // Duplicate detection (scientific)
                        const speciesCol = existingByTitle.get(normalize('Species (scientific)')) || existingByTitle.get(normalize('Species')) || null;
                        const existingSpecies = new Set<string>();
                        if (speciesCol) {
                            target.rows.forEach(r => {
                                const v = String(r.cells?.[speciesCol.id]?.value ?? '').trim();
                                if (v) existingSpecies.add(v);
                            });
                        }

                        const now = Date.now();
                        let duplicateCount = 0;
                        let firstDup: string | null = null;

                        const appendedRows = result.rows.map((r, idx) => {
                            const newId = `row-app-${now}-${idx}`;
                            const newCells: any = {};
                            const extras: string[] = [];

                            for (const inCol of result.columns) {
                                const mapping = colMap.get(inCol.id) || null;
                                const v = String(r.cells?.[inCol.id]?.value ?? '');
                                if (mapping) {
                                    newCells[mapping.id] = { columnId: mapping.id, value: v };
                                } else {
                                    const vv = v.trim();
                                    if (vv) extras.push(`${inCol.title}=${vv}`);
                                }
                            }

                            // Notes for missing species and overflow extras
                            const speciesVal = speciesCol ? String(newCells[speciesCol.id]?.value ?? '').trim() : '';
                            if (speciesVal && existingSpecies.has(speciesVal)) {
                                duplicateCount += 1;
                                if (!firstDup) firstDup = speciesVal;
                            }

                            if (extras.length > 0 || !speciesVal) {
                                const notesCol = getNotesCol() || ensureColumn({ id: 'notes', title: 'Notes', type: 'text', width: 400 });
                                const existingNote = String(newCells[notesCol.id]?.value ?? '').trim();
                                const parts = [];
                                if (existingNote) parts.push(existingNote);
                                if (!speciesVal) parts.push('Missing species');
                                if (extras.length > 0) parts.push(`Extra: ${extras.join('; ')}`);
                                newCells[notesCol.id] = { columnId: notesCol.id, value: parts.join(' • ') };
                            }

                            return { ...r, id: newId, cells: newCells };
                        });

                        const updated: Matrix = {
                            ...target,
                            columns: existingCols,
                            rows: [...target.rows, ...appendedRows],
                            updatedAt: new Date().toISOString()
                        };

                        await updateMatrix(updated);

                        if (duplicateCount > 0) {
                            showNotification(
                                duplicateCount === 1 && firstDup
                                    ? `Note: ${firstDup} already exists in this worksheet — added as a new row.`
                                    : `Note: ${duplicateCount} species already exist in this worksheet — added as new rows.`
                            );
                        } else {
                            showNotification('Added rows to worksheet');
                        }

                        closeDestinationModal();
                        return;
                    }
                    // If target matrix not found, fall through to "create new worksheet" behavior.
                }

                const newMatrix: Matrix = {
                    id: `mtx-chat-${Date.now()}`,
                    title: 'Extracted Data',
                    description: 'Generated from chat analysis',
                    columns: result.columns,
                    rows: result.rows
                };
                const created = await handleCreateMatrix(newMatrix, destination);
                if (!created) {
                    // Keep the user in place on failure (do not close modal or navigate).
                    return;
                }
                console.info('[create-flow] copy to worksheet', {
                    kind: 'worksheet',
                    withinProject: Boolean(created.projectId),
                    projectId: created.projectId,
                    matrixId: created.id,
                    tabId: Boolean(created.projectId) ? created.id : undefined
                });
                navigateToCreatedEntity({
                    navigate,
                    kind: 'worksheet',
                    withinProject: Boolean(created.projectId),
                    projectId: created.projectId,
                    matrixId: created.id,
                    focusTabId: created.id
                });
                showNotification('Worksheet created from chat');
                closeDestinationModal();
            } catch (error) {
                console.error("Extraction failed", error);

                // PR1: If the input contains a markdown pipe table, try deterministic parsing
                // before falling back to "single cell raw content".
                if (hasMarkdownPipeTable(message.text)) {
                    try {
                        const shaped = await aiService.structureTextAsMatrix(message.text, { runSpeciesCorrectionPass });
                        const newMatrix: Matrix = {
                            id: `mtx-chat-${Date.now()}`,
                            title: 'Extracted Data',
                            description: 'Generated from chat analysis',
                            columns: shaped.columns,
                            rows: shaped.rows
                        };
                        const created = await handleCreateMatrix(newMatrix, destination);
                        if (!created) {
                            // Keep the user in place on failure (do not close modal or navigate).
                            return;
                        }
                        console.info('[create-flow] copy to worksheet', {
                            kind: 'worksheet',
                            withinProject: Boolean(created.projectId),
                            projectId: created.projectId,
                            matrixId: created.id,
                            tabId: Boolean(created.projectId) ? created.id : undefined
                        });
                        navigateToCreatedEntity({
                            navigate,
                            kind: 'worksheet',
                            withinProject: Boolean(created.projectId),
                            projectId: created.projectId,
                            matrixId: created.id,
                            focusTabId: created.id
                        });
                        showNotification('Worksheet created from chat');
                        closeDestinationModal();
                        return;
                    } catch (e) {
                        console.info('[species-correction] failed, continuing without correction');
                        const parsed = parseMarkdownPipeTableAsMatrix(message.text);
                        if (parsed) {
                            const newMatrix: Matrix = {
                                id: `mtx-chat-${Date.now()}`,
                                title: 'Extracted Data',
                                description: 'Generated from chat analysis',
                                columns: parsed.columns,
                                rows: parsed.rows
                            };
                            const created = await handleCreateMatrix(newMatrix, destination);
                            if (!created) return;
                            navigateToCreatedEntity({
                                navigate,
                                kind: 'worksheet',
                                withinProject: Boolean(created.projectId),
                                projectId: created.projectId,
                                matrixId: created.id,
                                focusTabId: created.id
                            });
                            showNotification('Worksheet created from chat');
                            closeDestinationModal();
                            return;
                        }
                    }
                }

                const fallbackMatrix = {
                    id: `mtx-chat-${Date.now()}`,
                    title: 'Raw Content',
                    columns: [{ id: 'c1', title: 'Content', type: 'text' as const, width: 600, isPrimaryKey: true }],
                    rows: [{ id: 'r1', cells: { c1: { columnId: 'c1', value: message.text } } }]
                };
                const created = await handleCreateMatrix(fallbackMatrix, destination);
                if (!created) {
                    // Keep the user in place on failure (do not close modal or navigate).
                    return;
                }
                console.info('[create-flow] copy to worksheet', {
                    kind: 'worksheet',
                    withinProject: Boolean(created.projectId),
                    projectId: created.projectId,
                    matrixId: created.id,
                    tabId: Boolean(created.projectId) ? created.id : undefined
                });
                navigateToCreatedEntity({
                    navigate,
                    kind: 'worksheet',
                    withinProject: Boolean(created.projectId),
                    projectId: created.projectId,
                    matrixId: created.id,
                    focusTabId: created.id
                });
                showNotification('Worksheet created (raw mode)');
                closeDestinationModal();
            } finally {
                setIsExtracting(false);
            }
        }
    };

    const sharedProps = {
        onNavigate,
        onSelectProject,
        onOpenMenu,
        onOpenDestinationModal: handleOpenDestinationModal,
    };

    return (
        <>
            <Routes>
                {/* Global Routes wrapped in Global Layout */}
                <Route element={<GlobalLayout />}>
                    <Route path="/" element={<GlobalWorkspace view="home" {...sharedProps} />} />
                    <Route path="/projects" element={<GlobalWorkspace view="projects" {...sharedProps} />} />
                    <Route path="/sessions" element={<GlobalWorkspace view="research_history" {...sharedProps} />} />
                    <Route path="/chat" element={<GlobalWorkspace view="chat" {...sharedProps} />} />
                    <Route path="/planning" element={<PlanningRoute />} />
                    <Route path="/planning/run/:runId" element={<PlanningRoute />} />
                    <Route path="/files" element={<GlobalWorkspace view="knowledge_base" {...sharedProps} />} />
                    <Route path="/prompts" element={<GlobalWorkspace view="prompts" {...sharedProps} />} />
                </Route>
                
                {/* Standalone Editors (Have their own headers) */}
                <Route path="/worksheets/*" element={<WorksheetsRoute onOpenDestinationModal={handleOpenDestinationModal} />} />
                <Route path="/worksheets/:matrixId" element={<WorksheetsRoute onOpenDestinationModal={handleOpenDestinationModal} />} />
                <Route path="/reports/*" element={<ReportsRoute onOpenDestinationModal={handleOpenDestinationModal} />} />
                <Route path="/reports/:reportId" element={<ReportsRoute onOpenDestinationModal={handleOpenDestinationModal} />} />
                
                {/* Project Workspace */}
                <Route path="/project/:projectId/*" element={<ProjectWorkspace />} />
                
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            {/* Destination Picker Modal */}
            <BaseModal
                isOpen={destinationModal.isOpen}
                onClose={() => !isExtracting && closeDestinationModal()}
                title={
                    destinationModal.type === 'worksheet'
                        ? (worksheetStep === 'preview' ? 'Submit Worksheet' : 'Preview Worksheet')
                        : 'Save to Report'
                }
                size="sm"
                footer={
                    <>
                        {destinationModal.type === 'worksheet' && worksheetStep === 'preview' && (
                            <button
                                onClick={() => setWorksheetStep('configure')}
                                disabled={isExtracting}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                            >
                                Back
                            </button>
                        )}
                        <button 
                            onClick={() => closeDestinationModal()}
                            disabled={isExtracting}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleConfirmDest}
                            disabled={isExtracting}
                            className="px-6 py-2 bg-weflora-teal text-white rounded-lg hover:bg-weflora-dark font-bold text-sm shadow-sm transition-colors flex items-center gap-2 disabled:opacity-70"
                        >
                            {isExtracting ? (
                                <>
                                    <RefreshIcon className="h-4 w-4 animate-spin" />
                                    {destinationModal.type === 'worksheet'
                                        ? (worksheetStep === 'preview' ? 'Submitting...' : 'Preparing preview...')
                                        : 'Saving...'}
                                </>
                            ) : (
                                <span>
                                    {destinationModal.type === 'worksheet'
                                        ? (worksheetStep === 'preview' ? 'Submit Worksheet' : 'Preview Worksheet')
                                        : 'Save Content'}
                                </span>
                            )}
                        </button>
                    </>
                }
            >
                <div className="space-y-4 pt-2">
                    {isExtracting ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <SparklesIcon className="h-10 w-10 text-weflora-teal mb-4 animate-pulse" />
                            <h3 className="text-sm font-bold text-slate-800">Analyzing Content</h3>
                            <p className="text-xs text-slate-500 mt-1">FloraGPT is structuring the data into columns and rows...</p>
                        </div>
                    ) : destinationModal.type === 'worksheet' && worksheetStep === 'preview' ? (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-500">
                                Review the worksheet structure below. You can rename or remove columns before submitting.
                            </p>
                            {worksheetPreview ? (
                                <>
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold text-slate-600 uppercase">Columns</p>
                                        {worksheetPreview.columns.map(col => (
                                            <div key={col.id} className="flex items-center gap-2">
                                                <input
                                                    value={col.title}
                                                    onChange={(e) => updatePreviewColumnTitle(col.id, e.target.value)}
                                                    className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700"
                                                />
                                                <button
                                                    onClick={() => removePreviewColumn(col.id)}
                                                    className="text-[10px] font-bold text-slate-500 hover:text-weflora-red uppercase"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-slate-50 border-b border-slate-200">
                                                <tr>
                                                    {worksheetPreview.columns.map(col => (
                                                        <th key={col.id} className="p-2 whitespace-nowrap border-r border-slate-200 last:border-0">
                                                            {col.title}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {worksheetPreview.rows.slice(0, 5).map(row => (
                                                    <tr key={row.id}>
                                                        {worksheetPreview.columns.map(col => (
                                                            <td key={col.id} className="p-2 border-r border-slate-100 last:border-0 text-slate-600">
                                                                {String(row.cells?.[col.id]?.value ?? '')}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {worksheetPreview.rows.length > 5 && (
                                        <div className="text-[10px] text-slate-400">Showing first 5 rows.</div>
                                    )}
                                </>
                            ) : (
                                <p className="text-sm text-slate-400">No preview available.</p>
                            )}
                        </div>
                    ) : (
                        <>
                            <p className="text-sm text-slate-500">
                                Choose where you want to save this content.
                                {destinationModal.type === 'worksheet' && " FloraGPT will intelligently extract and structure tabular data for you."}
                            </p>

                            <div className="space-y-3">
                                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${destMode === 'general' ? 'border-weflora-teal bg-weflora-mint/10' : 'border-slate-200 hover:bg-slate-50'}`}>
                                    <input type="radio" name="destMode" className="hidden" checked={destMode === 'general'} onChange={() => setDestMode('general')} />
                                    <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                        <DatabaseIcon className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm font-bold text-slate-800">General Library</div>
                                        <div className="text-xs text-slate-500">Create as standalone item</div>
                                    </div>
                                    {destMode === 'general' && <CheckIcon className="h-4 w-4 text-weflora-teal" />}
                                </label>

                                <label className={`flex flex-col gap-3 p-3 border rounded-lg cursor-pointer transition-all ${destMode === 'project' ? 'border-weflora-teal bg-weflora-mint/10' : 'border-slate-200 hover:bg-slate-50'}`}>
                                    <div className="flex items-center gap-3 w-full">
                                        <input type="radio" name="destMode" className="hidden" checked={destMode === 'project'} onChange={() => setDestMode('project')} />
                                        <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                            <FolderIcon className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-slate-800">Existing Project</div>
                                            <div className="text-xs text-slate-500">Add to an active project</div>
                                        </div>
                                        {destMode === 'project' && <CheckIcon className="h-4 w-4 text-weflora-teal" />}
                                    </div>
                                    
                                    {destMode === 'project' && (
                                        <select 
                                            value={selectedDestProject}
                                            onChange={(e) => setSelectedDestProject(e.target.value)}
                                            className="w-full mt-2 p-2 bg-white border border-weflora-teal/30 rounded-lg text-sm text-slate-900 outline-none focus:ring-1 focus:ring-weflora-teal"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <option value="" disabled>Select Project...</option>
                                            {persistedProjects.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </label>

                                <label className={`flex flex-col gap-3 p-3 border rounded-lg cursor-pointer transition-all ${destMode === 'new' ? 'border-weflora-teal bg-weflora-mint/10' : 'border-slate-200 hover:bg-slate-50'}`}>
                                    <div className="flex items-center gap-3 w-full">
                                        <input type="radio" name="destMode" className="hidden" checked={destMode === 'new'} onChange={() => setDestMode('new')} />
                                        <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                                            <PlusIcon className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-slate-800">New Project</div>
                                            <div className="text-xs text-slate-500">Create a new project container</div>
                                        </div>
                                        {destMode === 'new' && <CheckIcon className="h-4 w-4 text-weflora-teal" />}
                                    </div>

                                    {destMode === 'new' && (
                                        <input 
                                            type="text" 
                                            placeholder="Project Name..." 
                                            value={newDestProjectName}
                                            onChange={(e) => setNewDestProjectName(e.target.value)}
                                            className="w-full mt-2 p-2 bg-white border border-weflora-teal/30 rounded-lg text-sm text-slate-900 outline-none focus:ring-1 focus:ring-weflora-teal"
                                            onClick={(e) => e.stopPropagation()}
                                            autoFocus
                                        />
                                    )}
                                </label>
                            </div>

                            {destinationModal.type === 'worksheet' && (
                                <div className="pt-2">
                                    <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg bg-white">
                                        <input
                                            type="checkbox"
                                            checked={runSpeciesCorrectionPass}
                                            onChange={(e) => setRunSpeciesCorrectionPass(e.target.checked)}
                                            className="mt-1 h-4 w-4 rounded border-slate-300 text-weflora-teal focus:ring-weflora-teal/30"
                                        />
                                        <div className="min-w-0">
                                            <div className="text-sm font-bold text-slate-800">Run species correction (optional)</div>
                                            <div className="text-xs text-slate-500">
                                                Suggest scientific names and flag uncertain species. Creation will not be blocked.
                                            </div>
                                        </div>
                                    </label>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </BaseModal>
        </>
    );
};

export default MainContent;
