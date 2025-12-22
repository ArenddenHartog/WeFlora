
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';
import { FEATURES } from '../src/config/features';
import type { PinnedProject, ProjectFile, Matrix, Report, Task, TeamComment, ProjectData } from '../types';
import { FolderIcon, FileSheetIcon, FilePdfIcon, FileCodeIcon } from '../components/icons';
import { dbIdOrUndefined, isUuid } from '../utils/ids';

const emptyProjectData: ProjectData = {
    analytics: { costs: [], water: [], diversity: [] },
    map: { trees: [] }
};

// --- VALIDATION CONSTANTS ---
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
    'application/pdf', 
    'text/plain', 
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
    'application/vnd.ms-excel', // xls
    'application/msword', // doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
    'image/jpeg', 
    'image/png', 
    'image/webp'
];

interface ProjectContextType {
    projects: PinnedProject[];
    setProjects: React.Dispatch<React.SetStateAction<PinnedProject[]>>;
    createProject: (project: PinnedProject) => Promise<{ id: string } | null>;
    updateProject: (project: PinnedProject) => Promise<void>;
    deleteProject: (projectId: string) => Promise<void>;
    files: { [projectId: string]: ProjectFile[] };
    setFiles: React.Dispatch<React.SetStateAction<{ [projectId: string]: ProjectFile[] }>>;
    
    // Explicit Data Actions
    matrices: Matrix[];
    setMatrices: React.Dispatch<React.SetStateAction<Matrix[]>>; // Kept for loading/reset
    createMatrix: (matrix: Matrix) => Promise<{ id: string; projectId?: string; parentId?: string } | null>;
    updateMatrix: (matrix: Matrix) => Promise<void>;
    deleteMatrix: (matrixId: string) => Promise<void>;

    reports: Report[];
    setReports: React.Dispatch<React.SetStateAction<Report[]>>; // Kept for loading/reset
    createReport: (report: Report) => Promise<{ id: string; projectId?: string; parentId?: string } | null>;
    updateReport: (report: Report) => Promise<void>;
    deleteReport: (reportId: string) => Promise<void>;

    projectData: ProjectData;
    tasks: Task[];
    setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
    comments: TeamComment[];
    setComments: React.Dispatch<React.SetStateAction<TeamComment[]>>;
    
    // Storage Actions
    uploadProjectFile: (file: File, projectId: string) => Promise<void>;
    deleteProjectFile: (fileId: string, projectId: string) => Promise<void>;
    resolveProjectFile: (fileId: string) => Promise<File | null>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { showNotification } = useUI();
    const [projects, setProjects] = useState<PinnedProject[]>([]);
    const [matrices, setMatrices] = useState<Matrix[]>([]);
    const [reports, setReports] = useState<Report[]>([]);
    const [files, setFiles] = useState<{ [projectId: string]: ProjectFile[] }>({});
    
    const [tasks, setTasks] = useState<Task[]>([]);
    const [comments, setComments] = useState<TeamComment[]>([]);

    useEffect(() => {
        if (!user) {
            setProjects([]);
            setMatrices([]);
            setReports([]);
            setFiles({});
            setTasks([]);
            setComments([]);
            return;
        }

        const fetchData = async () => {
            const userId = (await supabase.auth.getUser()).data.user?.id;
            if (!userId) return;

            // 1. Projects
            const { data: projData } = await supabase
                .from('projects')
                .select('*')
                .eq('user_id', userId) 
                .order('created_at', { ascending: false });
                
            if (projData) {
                setProjects(projData.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    status: p.status,
                    date: p.date,
                    workspaceId: 'ws-default',
                    icon: FolderIcon,
                    members: [] 
                })));
            }

            // 2. Matrices
            const { data: mtxData } = await supabase.from('matrices').select('*').eq('user_id', userId);
            if (mtxData) {
                setMatrices(mtxData.map((m: any) => ({
                    id: m.id,
                    projectId: m.project_id,
                    title: m.title,
                    description: m.description,
                    columns: m.columns,
                    rows: m.rows,
                    parentId: m.parent_id,
                    updatedAt: m.updated_at
                })));
            }

            // 3. Reports
            const { data: repData } = await supabase.from('reports').select('*').eq('user_id', userId);
            if (repData) {
                setReports(repData.map((r: any) => ({
                    id: r.id,
                    projectId: r.project_id,
                    title: r.title,
                    content: r.content,
                    tags: r.tags,
                    parentId: r.parent_id,
                    lastModified: new Date(r.updated_at).toLocaleDateString()
                })));
            }

            // 4. Files
            const { data: fileData } = await supabase.from('files').select('*').eq('user_id', userId);
            if (fileData) {
                const groupedFiles: { [key: string]: ProjectFile[] } = {};
                fileData.forEach((f: any) => {
                    const pid = f.project_id || 'generic';
                    if (!groupedFiles[pid]) groupedFiles[pid] = [];
                    
                    let Icon = FileCodeIcon;
                    if (f.name.endsWith('.pdf')) Icon = FilePdfIcon;
                    if (f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.name.endsWith('.csv')) Icon = FileSheetIcon;

                    groupedFiles[pid].push({
                        id: f.id,
                        name: f.name,
                        size: f.size,
                        date: new Date(f.created_at).toLocaleDateString(),
                        category: f.category,
                        source: 'upload',
                        icon: Icon,
                        tags: f.tags,
                        file: undefined // Only loaded on resolve
                    });
                });
                setFiles(groupedFiles);
            }

            // 5. Tasks & Comments (feature-gated)
            if (FEATURES.tasks) {
                const { data: taskData } = await supabase.from('tasks').select('*').eq('user_id', userId);
                if (taskData) {
                    setTasks(taskData.map((t: any) => ({
                        id: t.id,
                        title: t.title,
                        status: t.status,
                        priority: t.priority,
                        dueDate: t.due_date,
                        assigneeId: t.assignee_id,
                        projectId: t.project_id
                    })));
                }
            } else {
                setTasks([]);
            }

            if (FEATURES.comments) {
                const { data: commData } = await supabase.from('comments').select('*').eq('user_id', userId);
                if (commData) {
                    setComments(commData.map((c: any) => ({
                        id: c.id,
                        text: c.text,
                        memberId: c.member_id,
                        projectId: c.project_id,
                        timestamp: new Date(c.created_at).toLocaleString()
                    })));
                }
            } else {
                setComments([]);
            }
        };

        fetchData();
    }, [user]);

    // --- Projects CRUD ---
    const handleSetProjects: React.Dispatch<React.SetStateAction<PinnedProject[]>> = (action) => {
        setProjects(action as any);
    };

    const createProject = async (project: PinnedProject): Promise<{ id: string } | null> => {
        const userId = (await supabase.auth.getUser()).data.user?.id;
        if (!userId) return null;

        const tempId = project.id;
        setProjects(prev => [project, ...prev]);

        const shouldDbGenerateId = tempId.startsWith('proj-') || tempId.startsWith('new-') || tempId.includes('new');

        const { data, error } = await supabase.from('projects').insert({
            id: shouldDbGenerateId ? undefined : tempId,
            name: project.name,
            status: project.status,
            date: project.date,
            user_id: userId
        }).select('*').single();

        if (error || !data) {
            console.info('[createProject:error]', {
                code: (error as any)?.code,
                message: (error as any)?.message,
                details: (error as any)?.details,
                hint: (error as any)?.hint
            });
            showNotification('Failed to create project.', 'error');
            setProjects(prev => prev.filter(p => p.id !== tempId));
            return null;
        }

        const members = project.members ?? [];
        const mappedProject: PinnedProject = {
            id: (data as any).id,
            name: (data as any).name,
            status: (data as any).status,
            date: (data as any).date,
            workspaceId: project.workspaceId,
            icon: FolderIcon,
            members
        };

        setProjects(prev => prev.map(p => p.id === tempId ? mappedProject : p));
        console.info('[createProject] inserted', { tempId, dbId: mappedProject.id });
        return { id: mappedProject.id };
    };

    const updateProject = async (project: PinnedProject) => {
        setProjects(prev => prev.map(p => p.id === project.id ? project : p));
        await supabase.from('projects').update({
            name: project.name,
            status: project.status
        }).eq('id', project.id);
    };

    const deleteProject = async (projectId: string) => {
        const { error } = await supabase.from('projects').delete().eq('id', projectId);
        if (error) {
            console.error("Error deleting project", error);
            showNotification("Failed to delete project.", 'error');
            return;
        }
        setProjects(prev => prev.filter(p => p.id !== projectId));
        setMatrices(prev => prev.filter(m => m.projectId !== projectId));
        setReports(prev => prev.filter(r => r.projectId !== projectId));
        setTasks(prev => prev.filter(t => t.projectId !== projectId));
        setComments(prev => prev.filter(c => c.projectId !== projectId));
        setFiles(prev => {
            const next = { ...prev };
            delete next[projectId];
            return next;
        });
        showNotification("Project deleted successfully.");
    };

    // --- Explicit Matrix Actions ---

    const createMatrix = async (matrix: Matrix): Promise<{ id: string; projectId?: string; parentId?: string } | null> => {
        const userId = (await supabase.auth.getUser()).data.user?.id;
        if (!userId) return null;

        if (matrix.projectId && !isUuid(matrix.projectId)) {
            console.error('[createMatrix:error]', {
                id: matrix.id,
                projectId: matrix.projectId,
                parentId: matrix.parentId,
                isUuid: {
                    id: Boolean(matrix.id && isUuid(matrix.id)),
                    projectId: Boolean(matrix.projectId && isUuid(matrix.projectId)),
                    parentId: Boolean(matrix.parentId && isUuid(matrix.parentId))
                }
            });
            showNotification("Cannot save: project not yet persisted.", 'error');
            return null;
        }

        const title = (matrix.title || '').trim() || 'Worksheet';
        const columnsIsArray = Array.isArray((matrix as any).columns);
        const rowsIsArray = Array.isArray((matrix as any).rows);
        const columns = columnsIsArray ? matrix.columns : [{
            id: 'c1',
            title: 'Item',
            type: 'text',
            width: 200,
            isPrimaryKey: true
        }];
        const rows = rowsIsArray ? matrix.rows : [];

        // Optimistic Update
        const optimisticMatrix: Matrix = {
            ...matrix,
            title,
            columns,
            rows
        };
        setMatrices(prev => [...prev, optimisticMatrix]);

        const tempId = optimisticMatrix.id;
        if (tempId && !isUuid(tempId)) {
            console.info('[id:temp]', { tempId });
        }

        const insertPayload = {
            // IDs are UUID in DB; UI may use temp IDs; DB must generate UUID.
            id: dbIdOrUndefined(tempId),
            project_id: dbIdOrUndefined(optimisticMatrix.projectId),
            title: optimisticMatrix.title,
            description: optimisticMatrix.description,
            columns: optimisticMatrix.columns,
            rows: optimisticMatrix.rows,
            parent_id: dbIdOrUndefined(optimisticMatrix.parentId),
            user_id: userId
        };

        const { data, error } = await supabase.from('matrices').insert(insertPayload).select('*').single();

        if (error) {
            console.info('[createMatrix:error]', {
                message: error.message,
                code: (error as any).code,
                details: (error as any).details,
                hint: (error as any).hint,
                payload: {
                    projectId: optimisticMatrix.projectId,
                    title: optimisticMatrix.title,
                    parentId: optimisticMatrix.parentId,
                    columnsCount: Array.isArray(optimisticMatrix.columns) ? optimisticMatrix.columns.length : 0,
                    rowsCount: Array.isArray(optimisticMatrix.rows) ? optimisticMatrix.rows.length : 0,
                    columnsIsArray: Array.isArray(optimisticMatrix.columns),
                    rowsIsArray: Array.isArray(optimisticMatrix.rows),
                    isUuid: {
                        id: Boolean(tempId && isUuid(tempId)),
                        projectId: Boolean(optimisticMatrix.projectId && isUuid(optimisticMatrix.projectId)),
                        parentId: Boolean(optimisticMatrix.parentId && isUuid(optimisticMatrix.parentId))
                    }
                }
            });
            showNotification("Failed to save worksheet.", 'error');
            setMatrices(prev => prev.filter(m => m.id !== tempId)); // Rollback
            return null;
        }

        const mappedMatrix: Matrix = {
            id: (data as any).id,
            projectId: (data as any).project_id ?? optimisticMatrix.projectId,
            parentId: (data as any).parent_id ?? optimisticMatrix.parentId,
            title: (data as any).title,
            description: (data as any).description ?? optimisticMatrix.description,
            columns: (data as any).columns ?? optimisticMatrix.columns,
            rows: (data as any).rows ?? optimisticMatrix.rows,
            tabTitle: optimisticMatrix.tabTitle,
            order: (data as any).order ?? optimisticMatrix.order,
            updatedAt: (data as any).updated_at ?? new Date().toISOString()
        };

        setMatrices(prev => prev.map(m => m.id === tempId ? mappedMatrix : m));
        return { id: mappedMatrix.id, projectId: mappedMatrix.projectId, parentId: mappedMatrix.parentId };
    };

    const updateMatrix = async (matrix: Matrix) => {
        const userId = (await supabase.auth.getUser()).data.user?.id;
        if (!userId) return;

        // Optimistic Update
        const originalMatrices = [...matrices];
        setMatrices(prev => prev.map(m => m.id === matrix.id ? { ...matrix, updatedAt: new Date().toISOString() } : m));

        const { error } = await supabase.from('matrices').update({
            title: matrix.title,
            description: matrix.description,
            columns: matrix.columns,
            rows: matrix.rows,
            updated_at: new Date().toISOString()
        }).eq('id', matrix.id);

        if (error) {
            console.error("Failed to update matrix", error);
            showNotification("Failed to save changes.", 'error');
            setMatrices(originalMatrices); // Rollback
        }
    };

    const deleteMatrix = async (matrixId: string) => {
        // Optimistic Update
        const originalMatrices = [...matrices];
        setMatrices(prev => prev.filter(m => m.id !== matrixId));

        const { error } = await supabase.from('matrices').delete().eq('id', matrixId);

        if (error) {
            console.error("Failed to delete matrix", error);
            showNotification("Failed to delete worksheet.", 'error');
            setMatrices(originalMatrices); // Rollback
        } else {
            showNotification("Worksheet deleted.");
        }
    };

    // --- Explicit Report Actions ---

    const createReport = async (report: Report): Promise<{ id: string; projectId?: string; parentId?: string } | null> => {
        const userId = (await supabase.auth.getUser()).data.user?.id;
        if (!userId) return null;

        if (report.projectId && !isUuid(report.projectId)) {
            console.error('[createReport:error]', {
                id: report.id,
                projectId: report.projectId,
                parentId: report.parentId,
                isUuid: {
                    id: Boolean(report.id && isUuid(report.id)),
                    projectId: Boolean(report.projectId && isUuid(report.projectId)),
                    parentId: Boolean(report.parentId && isUuid(report.parentId))
                }
            });
            showNotification("Cannot save: project not yet persisted.", 'error');
            return null;
        }

        setReports(prev => [...prev, report]);

        const tempId = report.id;
        if (tempId && !isUuid(tempId)) {
            console.info('[id:temp]', { tempId });
        }

        const { data, error } = await supabase.from('reports').insert({
            // IDs are UUID in DB; UI may use temp IDs; DB must generate UUID.
            id: dbIdOrUndefined(tempId),
            project_id: dbIdOrUndefined(report.projectId),
            title: report.title,
            content: report.content,
            tags: report.tags,
            parent_id: dbIdOrUndefined(report.parentId),
            user_id: userId
        }).select('*').single();

        if (error) {
            console.error("Failed to create report", error);
            showNotification("Failed to save report.", 'error');
            setReports(prev => prev.filter(r => r.id !== tempId));
            return null;
        }

        const mappedReport: Report = {
            id: (data as any).id,
            projectId: (data as any).project_id ?? report.projectId,
            parentId: (data as any).parent_id ?? report.parentId,
            title: (data as any).title,
            content: (data as any).content,
            tags: (data as any).tags ?? report.tags,
            tabTitle: report.tabTitle,
            order: (data as any).order ?? report.order,
            lastModified: (data as any).updated_at ?? (data as any).last_modified ?? new Date().toISOString()
        };

        setReports(prev => prev.map(r => r.id === tempId ? mappedReport : r));
        return { id: mappedReport.id, projectId: mappedReport.projectId, parentId: mappedReport.parentId };
    };

    const updateReport = async (report: Report) => {
        const originalReports = [...reports];
        setReports(prev => prev.map(r => r.id === report.id ? { ...report, lastModified: new Date().toLocaleDateString() } : r));

        const { error } = await supabase.from('reports').update({
            title: report.title,
            content: report.content,
            tags: report.tags,
            updated_at: new Date().toISOString()
        }).eq('id', report.id);

        if (error) {
            console.error("Failed to update report", error);
            showNotification("Failed to save changes.", 'error');
            setReports(originalReports);
        }
    };

    const deleteReport = async (reportId: string) => {
        const originalReports = [...reports];
        setReports(prev => prev.filter(r => r.id !== reportId));

        const { error } = await supabase.from('reports').delete().eq('id', reportId);

        if (error) {
            console.error("Failed to delete report", error);
            showNotification("Failed to delete report.", 'error');
            setReports(originalReports);
        } else {
            showNotification("Report deleted.");
        }
    };

    // --- Tasks & Comments (Legacy Pattern, can be refactored later) ---
    const handleSetTasks: React.Dispatch<React.SetStateAction<Task[]>> = (action) => {
        setTasks(prev => {
            const newVal = typeof action === 'function' ? action(prev) : action;
            return newVal;
        });
    };

    const handleSetComments: React.Dispatch<React.SetStateAction<TeamComment[]>> = (action) => {
        setComments(prev => {
            const newVal = typeof action === 'function' ? action(prev) : action;
            return newVal;
        });
    };

    const uploadProjectFile = async (file: File, projectId: string) => {
        const userId = (await supabase.auth.getUser()).data.user?.id;
        if (!userId) return;

        if (file.size > MAX_FILE_SIZE) {
            showNotification(`File too large. Max size is 10MB.`, 'error');
            return;
        }
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            showNotification(`Invalid file type: ${file.type}.`, 'error');
            return;
        }

        const { data: fileRecord, error: dbError } = await supabase.from('files').insert({
            project_id: projectId === 'generic' ? null : projectId,
            user_id: userId,
            name: file.name,
            size: `${(file.size / 1024).toFixed(1)} KB`,
            category: 'Input Data',
            tags: []
        }).select().single();

        if (dbError || !fileRecord) {
            showNotification("Database error during upload.", 'error');
            return;
        }

        const securePath = `${userId}/${fileRecord.id}`;
        const { error: storageError } = await supabase.storage.from('project_files').upload(securePath, file);

        if (storageError) {
            await supabase.from('files').delete().eq('id', fileRecord.id);
            showNotification("Storage upload failed.", 'error');
            return;
        }

        let Icon = FileCodeIcon;
        if (file.name.endsWith('.pdf')) Icon = FilePdfIcon;
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xlsx') || file.name.endsWith('.csv')) Icon = FileSheetIcon;

        const newFile: ProjectFile = {
            id: fileRecord.id,
            name: file.name,
            size: fileRecord.size,
            date: new Date().toLocaleDateString(),
            category: 'Input Data',
            source: 'upload',
            icon: Icon,
            tags: [],
            file: file 
        };

        setFiles(prev => ({
            ...prev,
            [projectId]: [...(prev[projectId] || []), newFile]
        }));
        
        showNotification("File uploaded successfully.");
    };

    const deleteProjectFile = async (fileId: string, projectId: string) => {
        const userId = (await supabase.auth.getUser()).data.user?.id;
        if (!userId) return;

        const securePath = `${userId}/${fileId}`;
        await supabase.storage.from('project_files').remove([securePath]);
        const { error: dbError } = await supabase.from('files').delete().eq('id', fileId);
        
        if (dbError) {
            showNotification("Failed to delete file record.", 'error');
            return;
        }

        setFiles(prev => {
            const currentList = prev[projectId] || [];
            return {
                ...prev,
                [projectId]: currentList.filter(f => f.id !== fileId)
            };
        });
        showNotification("File deleted successfully.");
    };

    const resolveProjectFile = async (fileId: string): Promise<File | null> => {
        const flatFiles: ProjectFile[] = Object.values(files).flat();
        const local = flatFiles.find(f => f.id === fileId);
        if (local && local.file) return local.file;

        const userId = (await supabase.auth.getUser()).data.user?.id;
        if (!userId) return null;

        const securePath = `${userId}/${fileId}`;
        const { data, error } = await supabase.storage.from('project_files').download(securePath);
        
        if (error || !data) return null;

        const metadata = flatFiles.find(f => f.id === fileId);
        const fileName = metadata ? metadata.name : 'downloaded_file';
        return new File([data], fileName, { type: data.type });
    };

    return (
        <ProjectContext.Provider value={{
            projects, setProjects: handleSetProjects,
            createProject,
            updateProject, deleteProject,
            files, setFiles, 
            
            matrices, setMatrices, // Exposed setters for reset/load, NOT for CRUD
            createMatrix, updateMatrix, deleteMatrix,
            
            reports, setReports, // Exposed setters for reset/load, NOT for CRUD
            createReport, updateReport, deleteReport,
            
            projectData: emptyProjectData,
            tasks, setTasks: handleSetTasks,
            comments, setComments: handleSetComments,
            uploadProjectFile,
            deleteProjectFile,
            resolveProjectFile
        }}>
            {children}
        </ProjectContext.Provider>
    );
};

export const useProject = () => {
    const context = useContext(ProjectContext);
    if (!context) throw new Error('useProject must be used within ProjectProvider');
    return context;
};
