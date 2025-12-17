
import React, { useState } from 'react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import FilePreview from './components/FilePreview';
import { DataProvider, useData } from './contexts/DataContext';
import { ProjectProvider, useProject } from './contexts/ProjectContext';
import { ChatProvider, useChat } from './contexts/ChatContext';
import { UIProvider, useUI } from './contexts/UIContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthView from './components/AuthView';
import { XIcon, CheckCircleIcon, AlertTriangleIcon } from './components/icons';
import type { ProjectFile, KnowledgeItem } from './types';

// -- Global Toast Component --
const GlobalToast = () => {
    const { notification, closeNotification } = useUI();
    if (!notification) return null;

    return (
        <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border animate-slideUp ${
            notification.type === 'error' 
                ? 'bg-red-50 border-red-100 text-red-800' 
                : 'bg-slate-800 text-white border-slate-700'
        }`}>
            {notification.type === 'error' ? <AlertTriangleIcon className="h-5 w-5" /> : <CheckCircleIcon className="h-5 w-5 text-green-400" />}
            <span className="text-sm font-medium">{notification.message}</span>
            <button onClick={closeNotification} className="ml-2 opacity-70 hover:opacity-100">
                <XIcon className="h-4 w-4" />
            </button>
        </div>
    );
};

const AppContent: React.FC = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    
    // Hooks must be inside the component
    const uiContext = useUI();
    const dataContext = useData();
    const projectContext = useProject();
    const chatContext = useChat();

    if (loading) return <div className="h-[100dvh] w-full flex items-center justify-center bg-slate-50">Loading WeFlora...</div>;
    if (!user) return <AuthView />;

    // Destructure needed contexts for App Shell
    const { 
        isSidebarOpen, setIsSidebarOpen, isSidebarCollapsed, toggleSidebarCollapse,
        selectedProjectId, setSelectedProjectId,
        previewItem, closeFilePreview, openFilePreview
    } = uiContext;

    const {
        workspaces, currentWorkspace, setCurrentWorkspace,
        recentItems
    } = dataContext;

    const {
        projects, setProjects
    } = projectContext;

    const { 
        sendMessage: handleSendMessage 
    } = chatContext;

    const handleCreateProject = (newProject: any) => {
        setProjects([newProject, ...projects]);
        setSelectedProjectId(newProject.id);
        navigate(`/project/${newProject.id}`);
    };

    // Wrapper to handle viewMode fallback for global queries
    const onSendMessageWrapper = (
        text: string, 
        filesToSend?: File[], 
        instructions?: string, 
        model?: string, 
        contextItems?: any[], 
        viewModeArg?: string, 
        enableThinking?: boolean, 
        forceNewChat?: boolean
    ) => {
        handleSendMessage(text, filesToSend, instructions, model, contextItems, viewModeArg, enableThinking, forceNewChat);
    };

    return (
        <div className="flex h-[100dvh] w-full bg-white overflow-hidden font-sans text-slate-900">
            <GlobalToast />
            
            {/* Global File Preview Modal (Controlled by UI Context) */}
            {previewItem && (
                <FilePreview 
                    item={previewItem}
                    onClose={closeFilePreview}
                    onAskAI={(item) => {
                        const itemName = 'name' in item ? item.name : item.title;
                        const context = { id: `ctx-${item.id}`, name: itemName, source: 'upload' as const, itemId: item.id };
                        closeFilePreview();
                        navigate('/');
                        onSendMessageWrapper(`Analyze ${itemName}`, undefined, undefined, undefined, [context], 'home', false, true);
                    }}
                />
            )}

            <Sidebar 
                user={user}
                workspaces={workspaces}
                currentWorkspace={currentWorkspace}
                projects={projects}
                recentItems={recentItems}
                selectedProjectId={selectedProjectId}
                onSelectProject={(id) => { setSelectedProjectId(id); navigate(id ? `/project/${id}` : '/projects'); }}
                onSwitchWorkspace={(id) => { const w = workspaces.find(wk => wk.id === id); if(w) setCurrentWorkspace(w); }}
                onNavigate={(path) => navigate(path === 'home' ? '/' : `/${path}`)}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                onCreateProject={handleCreateProject}
                isCollapsed={isSidebarCollapsed}
                toggleCollapse={toggleSidebarCollapse}
            />

            {/* Main Layout Area - Header logic is now delegated to MainContent routes */}
            <div className="flex-1 flex flex-col h-full min-w-0 relative">
                <main className="flex-1 overflow-hidden relative">
                    <MainContent 
                        onNavigate={(path) => navigate(path === 'home' ? '/' : `/${path}`)}
                        onSelectProject={(id) => { setSelectedProjectId(id); navigate(`/project/${id}`); }}
                        onOpenMenu={() => setIsSidebarOpen(true)}
                    />
                </main>
            </div>
        </div>
    );
}

const App: React.FC = () => {
    return (
        <BrowserRouter>
            <AuthProvider>
                <UIProvider>
                    <DataProvider>
                        <ProjectProvider>
                            <ChatProvider>
                                <AppContent />
                            </ChatProvider>
                        </ProjectProvider>
                    </DataProvider>
                </UIProvider>
            </AuthProvider>
        </BrowserRouter>
    );
};

export default App;
