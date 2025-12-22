
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ViewMode, ChatMessage, ProjectFile, KnowledgeItem } from '../types';

interface NotificationState {
    message: string;
    type: 'success' | 'error';
}

interface DestinationModalState {
    isOpen: boolean;
    type: 'report' | 'worksheet';
    message: ChatMessage | null;
}

export type EvidenceProvenance = {
    label: string;
    sources?: string[];
    generatedAt?: string;
};

interface UIContextType {
    // Sidebar State
    isSidebarOpen: boolean;
    setIsSidebarOpen: (isOpen: boolean) => void;
    isSidebarCollapsed: boolean;
    toggleSidebarCollapse: () => void;

    // Selection State
    selectedProjectId: string | null;
    setSelectedProjectId: (id: string | null) => void;
    selectedChatId: string | null;
    setSelectedChatId: (id: string | null) => void;
    
    // Notification State
    notification: NotificationState | null;
    showNotification: (message: string, type?: 'success' | 'error') => void;
    closeNotification: () => void;
    
    // Navigation Helpers
    navigateToProject: (id: string) => void;
    navigateToHome: () => void;

    // Sessions Navigation Intent
    sessionOpenOrigin: 'sessions' | 'other' | null;
    setSessionOpenOrigin: (origin: 'sessions' | 'other' | null) => void;

    // Destination Modal State
    destinationModal: DestinationModalState;
    openDestinationModal: (type: 'report' | 'worksheet', message: ChatMessage) => void;
    closeDestinationModal: () => void;

    // File Preview State (Global)
    previewItem: ProjectFile | KnowledgeItem | null;
    openFilePreview: (item: ProjectFile | KnowledgeItem) => void;
    closeFilePreview: () => void;

    // Evidence Panel (Global, right-side)
    activeEvidence: EvidenceProvenance | null;
    openEvidencePanel: (provenance: EvidenceProvenance) => void;
    closeEvidencePanel: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [notification, setNotification] = useState<NotificationState | null>(null);
    const [sessionOpenOrigin, setSessionOpenOrigin] = useState<'sessions' | 'other' | null>(null);

    const [destinationModal, setDestinationModal] = useState<DestinationModalState>({
        isOpen: false,
        type: 'report',
        message: null
    });

    const [previewItem, setPreviewItem] = useState<ProjectFile | KnowledgeItem | null>(null);
    const [activeEvidence, setActiveEvidence] = useState<EvidenceProvenance | null>(null);

    const toggleSidebarCollapse = () => setIsSidebarCollapsed(prev => !prev);

    const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    };

    const closeNotification = () => setNotification(null);

    const navigateToProject = (id: string) => {
        setSelectedProjectId(id);
        setSelectedChatId(null);
        navigate(`/project/${id}`);
        setIsSidebarOpen(false);
    };

    const navigateToHome = () => {
        setSelectedProjectId(null);
        setSelectedChatId(null);
        navigate('/');
        setIsSidebarOpen(false);
    };

    const openDestinationModal = (type: 'report' | 'worksheet', message: ChatMessage) => {
        setDestinationModal({ isOpen: true, type, message });
    };

    const closeDestinationModal = () => {
        setDestinationModal({ isOpen: false, type: 'report', message: null });
    };

    const openFilePreview = (item: ProjectFile | KnowledgeItem) => {
        setPreviewItem(item);
    };

    const closeFilePreview = () => {
        setPreviewItem(null);
    };

    const openEvidencePanel = (provenance: EvidenceProvenance) => {
        setActiveEvidence(provenance);
    };

    const closeEvidencePanel = () => {
        setActiveEvidence(null);
    };

    return (
        <UIContext.Provider value={{
            isSidebarOpen, setIsSidebarOpen,
            isSidebarCollapsed, toggleSidebarCollapse,
            selectedProjectId, setSelectedProjectId,
            selectedChatId, setSelectedChatId,
            notification, showNotification, closeNotification,
            navigateToProject, navigateToHome,
            sessionOpenOrigin, setSessionOpenOrigin,
            destinationModal, openDestinationModal, closeDestinationModal,
            previewItem, openFilePreview, closeFilePreview,
            activeEvidence, openEvidencePanel, closeEvidencePanel
        }}>
            {children}
        </UIContext.Provider>
    );
};

export const useUI = () => {
    const context = useContext(UIContext);
    if (!context) {
        throw new Error('useUI must be used within a UIProvider');
    }
    return context;
};
