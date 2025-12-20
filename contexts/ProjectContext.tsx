
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';
import type { PinnedProject, ProjectFile, Matrix, Report, Task, TeamComment, ProjectData } from '../types';
import { FolderIcon, FileSheetIcon, FilePdfIcon, FileCodeIcon } from '../components/icons';

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
    updateProject: (project: PinnedProject) => Promise<void>;
    deleteProject: (projectId: string) => Promise<void>;
    files: { [projectId: string]: ProjectFile[] };
    setFiles: React.Dispatch<React.SetStateAction<{ [projectId: string]: ProjectFile[] }>>;
    
    // Explicit Data Actions
    matrices: Matrix[];
    setMatrices: React.Dispatch<React.SetStateAction<Matrix[]>>; // Kept for loading/reset
    createMatrix: (matrix: Matrix) => Promise<CreateEntityResult>;
    updateMatrix: (matrix: Matrix) => Promise<void>;
    deleteMatrix: (matrixId: string) => Promise<void>;

    reports: Report[];
    setReports: React.Dispatch<React.SetStateAction<Report[]>>; // Kept for loading/reset
    createReport: (report: Report) => Promise<CreateEntityResult>;
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

export type CreateEntityResult = {
    reportId?: string;
    matrixId?: string;
    projectId?: string;
    tabId?: string;
    withinProject: boolean;
};

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
                    workspaceId: p.workspace_id || 'ws-1', 
                    icon: FolderIcon,
                    members: p.members || [] 
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

            // 5. Tasks & Comments
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
        };

        fetchData();
    }, [user]);

    // --- Projects CRUD ---
    const handleSetProjects: React.Dispatch<React.SetStateAction<PinnedProject[]>> = (action) => {
        setProjects(prev => {
            const newVal = typeof action === 'function' ? action(prev) : action;
            // Legacy handling for direct setProjects calls from MainContent
            // Ideally we would migrate this too, but focusing on Matrices/Reports first
            const added = newVal.filter(p => !prev.find(old => old.id === p.id));
            added.forEach(async (p) => {
                const userId = (await supabase.auth.getUser()).data.user?.id;
                if (!userId) return;
                await supabase.from('projects').insert({
                    id: p.id.includes('new') ? undefined : p.id,
                    name: p.name,
                    status: p.status,
                    date: p.date,
                    user_id: userId,
                    members: p.members,
                    workspace_id: p.workspaceId
                });
            });
            return newVal;
        });
    };

    const updateProject = async (project: PinnedProject) => {
        setProjects(prev => prev.map(p => p.id === project.id ? project : p));
        await supabase.from('projects').update({
            name: project.name,
            status: project.status,
            members: project.members
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

    const createMatrix = async (matrix: Matrix): Promise<CreateEntityResult> => {
        const userId = (await supabase.auth.getUser()).data.user?.id;
        const withinProject = Boolean(matrix.projectId);
        if (!userId) return { withinProject, projectId: matrix.projectId };

        // Optimistic Update
        setMatrices(prev => [...prev, matrix]);

        const tempId = matrix.id;
        const shouldDbGenerateId = tempId.includes('new') || tempId.includes('mtx-'); // Let DB gen if temp ID

        const { data, error } = await supabase.from('matrices').insert({
            id: shouldDbGenerateId ? undefined : tempId,
            project_id: matrix.projectId,
            title: matrix.title,
            description: matrix.description,
            columns: matrix.columns,
            rows: matrix.rows,
            parent_id: matrix.parentId,
            user_id: userId
        }).select('id').single();

        if (error) {
            console.error("Failed to create matrix", error);
            showNotification("Failed to save worksheet.", 'error');
            setMatrices(prev => prev.filter(m => m.id !== tempId)); // Rollback
            return { withinProject, projectId: matrix.projectId };
        }

        const createdId = (data as any)?.id as string | undefined;
        if (createdId && createdId !== tempId) {
            setMatrices(prev => prev.map(m => m.id === tempId ? { ...m, id: createdId } : m));
        }

        return {
            withinProject,
            projectId: matrix.projectId,
            matrixId: createdId || tempId,
            tabId: withinProject ? (createdId || tempId) : undefined
        };
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

    const createReport = async (report: Report): Promise<CreateEntityResult> => {
        const userId = (await supabase.auth.getUser()).data.user?.id;
        const withinProject = Boolean(report.projectId);
        if (!userId) return { withinProject, projectId: report.projectId };

        setReports(prev => [...prev, report]);

        const tempId = report.id;
        const shouldDbGenerateId = tempId.includes('rep-') || tempId.includes('new');

        const { data, error } = await supabase.from('reports').insert({
            id: shouldDbGenerateId ? undefined : tempId,
            project_id: report.projectId,
            title: report.title,
            content: report.content,
            tags: report.tags,
            parent_id: report.parentId,
            user_id: userId
        }).select('id').single();

        if (error) {
            console.error("Failed to create report", error);
            showNotification("Failed to save report.", 'error');
            setReports(prev => prev.filter(r => r.id !== tempId));
            return { withinProject, projectId: report.projectId };
        }

        const createdId = (data as any)?.id as string | undefined;
        if (createdId && createdId !== tempId) {
            setReports(prev => prev.map(r => r.id === tempId ? { ...r, id: createdId } : r));
        }

        return {
            withinProject,
            projectId: report.projectId,
            reportId: createdId || tempId,
            tabId: withinProject ? (createdId || tempId) : undefined
        };
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
            newVal.forEach(async (t) => {
                const exists = prev.find(old => old.id === t.id);
                const userId = (await supabase.auth.getUser()).data.user?.id;
                if (!userId) return;

                if (!exists) {
                    await supabase.from('tasks').insert({
                        title: t.title,
                        status: t.status,
                        priority: t.priority,
                        due_date: t.dueDate,
                        assignee_id: t.assigneeId,
                        project_id: t.projectId,
                        user_id: userId
                    });
                } else if (JSON.stringify(exists) !== JSON.stringify(t)) {
                    await supabase.from('tasks').update({
                        status: t.status,
                        priority: t.priority,
                        title: t.title
                    }).eq('id', t.id);
                }
            });
            return newVal;
        });
    };

    const handleSetComments: React.Dispatch<React.SetStateAction<TeamComment[]>> = (action) => {
        setComments(prev => {
            const newVal = typeof action === 'function' ? action(prev) : action;
            const added = newVal.filter(c => !prev.find(old => old.id === c.id));
            added.forEach(async c => {
                const userId = (await supabase.auth.getUser()).data.user?.id;
                if (!userId) return;
                await supabase.from('comments').insert({
                    text: c.text,
                    member_id: c.memberId,
                    project_id: c.projectId,
                    user_id: userId
                });
            });
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
