
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from './AuthContext';
import { FEATURES } from '../src/config/features';
import type { 
    Workspace, RecentItem, KnowledgeItem, WorksheetTemplate, 
    PromptTemplate, ReportTemplate, Species
} from '../types';

interface DataContextType {
    workspaces: Workspace[];
    currentWorkspace: Workspace;
    setCurrentWorkspace: (w: Workspace) => void;
    
    // Knowledge Base
    knowledgeItems: KnowledgeItem[];
    setKnowledgeItems: React.Dispatch<React.SetStateAction<KnowledgeItem[]>>;
    deleteKnowledgeItem: (id: string) => void;
    
    // Templates
    worksheetTemplates: WorksheetTemplate[];
    promptTemplates: PromptTemplate[];
    reportTemplates: ReportTemplate[];
    
    // Actions
    saveWorksheetTemplate: (tpl: WorksheetTemplate) => Promise<void>;
    savePromptTemplate: (tpl: PromptTemplate) => Promise<void>;
    saveReportTemplate: (tpl: ReportTemplate) => Promise<void>;

    species: Species[]; 
    addSpecies: (speciesData: Partial<Species>) => Promise<void>;
    recentItems: RecentItem[];
    addRecentItem: (item: RecentItem) => void;
    resetState: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    // Default fallback workspace if none found
    const defaultWorkspace: Workspace = { id: 'ws-default', name: 'Personal Workspace', type: 'Personal', avatar: 'ME' };
    
    const [workspaces, setWorkspaces] = useState<Workspace[]>([defaultWorkspace]);
    const [currentWorkspace, setCurrentWorkspace] = useState<Workspace>(defaultWorkspace);
    const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
    
    const [worksheetTemplates, setWorksheetTemplates] = useState<WorksheetTemplate[]>([]);
    const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
    const [reportTemplates, setReportTemplates] = useState<ReportTemplate[]>([]);
    const [species, setSpecies] = useState<Species[]>([]);
    
    const [recentItems, setRecentItems] = useState<RecentItem[]>(() => {
        const saved = localStorage.getItem('weflora_recent_items');
        return saved ? JSON.parse(saved) : [{ id: 'r1', name: 'Urban heat island mitigation', group: 'Searches' }];
    });

    useEffect(() => {
        localStorage.setItem('weflora_recent_items', JSON.stringify(recentItems));
    }, [recentItems]);

    const addRecentItem = (item: RecentItem) => {
        setRecentItems(prev => {
            const filtered = prev.filter(i => i.id !== item.id);
            return [item, ...filtered].slice(0, 10);
        });
    };

    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            const userId = (await supabase.auth.getUser()).data.user?.id;
            if (!userId) return;

            // 1. Workspaces
            if (FEATURES.workspaces) {
                try {
                    const { data: wsData } = await supabase.from('workspaces').select('*').eq('user_id', userId);
                    if (wsData && wsData.length > 0) {
                        setWorkspaces(wsData);
                        setCurrentWorkspace(wsData[0]);
                    }
                } catch (e) { console.error("Error fetching workspaces", e); }
            }

            // 2. Templates (System + User)
            try {
                const { data: userTpls } = await supabase.from('templates').select('*').eq('user_id', userId);
                
                const w: WorksheetTemplate[] = [];
                const p: PromptTemplate[] = [];
                const r: ReportTemplate[] = [];

                const processTemplate = (row: any, isSystem: boolean) => {
                    if (row.type === 'worksheet') {
                        w.push({
                            id: row.id,
                            title: row.title,
                            description: row.description,
                            tags: row.tags || [],
                            columns: row.content?.columns || [],
                            rows: row.content?.rows || [],
                            usageCount: 0,
                            lastUsed: 'Recently',
                            isSystem
                        });
                    } else if (row.type === 'prompt') {
                        p.push({
                            id: row.id,
                            title: row.title,
                            description: row.description,
                            tags: row.tags || [],
                            templateText: row.content?.templateText || '',
                            systemInstruction: row.content?.systemInstruction || '',
                            usageCount: 0,
                            lastUsed: 'Recently',
                            isSystem
                        });
                    } else if (row.type === 'report') {
                        r.push({
                            id: row.id,
                            title: row.title,
                            description: row.description,
                            tags: row.tags || [],
                            content: row.content?.markdown || '',
                            usageCount: 0,
                            lastUsed: 'Recently',
                            isSystem
                        });
                    }
                };

                if (userTpls) userTpls.forEach(t => processTemplate(t, false));
                
                // Add default system templates
                if (w.length === 0) {
                    w.push({ id: 'sys-wt-1', title: 'Site Compliance Analysis', description: 'Evaluate species against policies.', tags: ['compliance'], usageCount: 128, lastUsed: 'System', isSystem: true, columns: [{ id: 'c1', title: 'Species', type: 'text', isPrimaryKey: true }, { id: 'c2', title: 'Status', type: 'ai', aiPrompt: 'Check compliance' }], rows: [] });
                }
                if (p.length === 0) {
                    p.push({ id: 'sys-pt-1', title: 'Species Comparison', description: 'Compare multiple species.', templateText: 'Compare: {Input}', tags: ['design'], usageCount: 156, lastUsed: 'System', isSystem: true });
                }

                setWorksheetTemplates(w);
                setPromptTemplates(p);
                setReportTemplates(r);

            } catch (e) { console.error("Error fetching templates", e); }

            // 3. Species
            if (FEATURES.species) {
                try {
                    const { data: spData } = await supabase.from('species').select('*').limit(50);
                    if (spData) {
                        setSpecies(spData.map(s => ({
                            id: s.id,
                            scientificName: s.scientific_name,
                            commonName: s.common_name,
                            family: s.family,
                            tags: s.tags || []
                        })));
                    }
                } catch (e) { console.error("Error fetching species", e); }
            }
            
            // 4. Knowledge Items
            try {
                const { data: kData } = await supabase.from('files').select('*')
                    .eq('user_id', userId)
                    .in('category', ['Policy', 'Research', 'Internal', 'Reference']);
                
                if (kData) {
                     setKnowledgeItems(kData.map(f => ({
                         id: f.id,
                         title: f.name,
                         category: f.category as any,
                         tags: f.tags || [],
                         date: new Date(f.created_at).toLocaleDateString(),
                         size: f.size,
                         type: f.name.split('.').pop() as any,
                         author: 'You'
                     })));
                }
            } catch (e) { console.error("Error fetching knowledge items", e); }
        };

        fetchData();
    }, [user]);

    const deleteKnowledgeItem = async (id: string) => {
        setKnowledgeItems(prev => prev.filter(item => item.id !== id));
        await supabase.from('files').delete().eq('id', id);
    };

    const saveWorksheetTemplate = async (tpl: WorksheetTemplate) => {
        const userId = (await supabase.auth.getUser()).data.user?.id;
        const { data } = await supabase.from('templates').insert({
            user_id: userId,
            type: 'worksheet',
            title: tpl.title,
            description: tpl.description,
            tags: tpl.tags,
            content: { columns: tpl.columns, rows: tpl.rows }
        }).select().single();

        if (data) {
            setWorksheetTemplates(prev => [...prev, { ...tpl, id: data.id }]);
        }
    };

    const savePromptTemplate = async (tpl: PromptTemplate) => {
        const userId = (await supabase.auth.getUser()).data.user?.id;
        const { data } = await supabase.from('templates').insert({
            user_id: userId,
            type: 'prompt',
            title: tpl.title,
            description: tpl.description,
            tags: tpl.tags,
            content: { templateText: tpl.templateText, systemInstruction: tpl.systemInstruction }
        }).select().single();

        if (data) {
            setPromptTemplates(prev => [...prev, { ...tpl, id: data.id }]);
        }
    };

    const saveReportTemplate = async (tpl: ReportTemplate) => {
        const userId = (await supabase.auth.getUser()).data.user?.id;
        const { data } = await supabase.from('templates').insert({
            user_id: userId,
            type: 'report',
            title: tpl.title,
            description: tpl.description,
            tags: tpl.tags,
            content: { markdown: tpl.content }
        }).select().single();

        if (data) {
            setReportTemplates(prev => [...prev, { ...tpl, id: data.id }]);
        }
    };

    const addSpecies = async (speciesData: Partial<Species>) => {
        if (!speciesData.scientificName) return;
        
        // Check for duplicates in local state
        const exists = species.some(s => s.scientificName.toLowerCase() === speciesData.scientificName!.toLowerCase());
        if (exists) return;

        const userId = (await supabase.auth.getUser()).data.user?.id;
        if (!FEATURES.species) {
            const local: Species = {
                id: `sp-local-${Date.now()}`,
                scientificName: speciesData.scientificName,
                commonName: speciesData.commonName || '',
                family: speciesData.family || '',
                tags: speciesData.tags || []
            };
            setSpecies(prev => [...prev, local]);
            return;
        }
        
        const newSpecies = {
            scientific_name: speciesData.scientificName,
            common_name: speciesData.commonName,
            family: speciesData.family,
            tags: speciesData.tags || [],
            user_id: userId
        };

        const { data } = await supabase.from('species').insert(newSpecies).select().single();

        if (data) {
            setSpecies(prev => [...prev, {
                id: data.id,
                scientificName: data.scientific_name,
                commonName: data.common_name,
                family: data.family,
                tags: data.tags || []
            }]);
        }
    };
    
    const resetState = () => {
        localStorage.removeItem('weflora_recent_items');
        window.location.reload();
    };

    return (
        <DataContext.Provider value={{
            workspaces,
            currentWorkspace, setCurrentWorkspace,
            knowledgeItems, setKnowledgeItems,
            deleteKnowledgeItem,
            worksheetTemplates,
            promptTemplates,
            reportTemplates,
            saveWorksheetTemplate,
            savePromptTemplate,
            saveReportTemplate,
            species,
            addSpecies,
            recentItems,
            addRecentItem,
            resetState
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) throw new Error('useData must be used within a DataProvider');
    return context;
};
