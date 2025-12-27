
import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from './AuthContext';
import { useProject } from './ProjectContext';
import { useUI } from './UIContext';
import type { Chat, ChatMessage, Thread, ContextItem } from '../types';
import { aiService } from '../services/aiService';
import { serializeMatrix, serializeReport } from '../utils/serializers';
import { FileSheetIcon } from '../components/icons';

interface ChatContextType {
    chats: { [projectId: string]: Chat[] };
    setChats: React.Dispatch<React.SetStateAction<{ [projectId: string]: Chat[] }>>;
    threads: Thread[];
    setThreads: React.Dispatch<React.SetStateAction<Thread[]>>;
    activeThreadId: string | null;
    setActiveThreadId: (id: string | null) => void;
    messages: ChatMessage[]; 
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    isGenerating: boolean;
    
    // Main Chat Actions
    createThread: (initialMessage: string, contextSnapshot?: ContextItem[]) => Promise<string>;
    addMessageToThread: (threadId: string, message: ChatMessage) => void;
    sendMessage: (text: string, files?: File[], instructions?: string, model?: string, contextItems?: ContextItem[], viewMode?: string, enableThinking?: boolean, forceNewChat?: boolean) => Promise<void>;
    togglePinThread: (threadId: string) => void;
    deleteThread: (threadId: string) => void;

    // Entity Chat Actions (Sidebars)
    entityThreads: { [entityId: string]: ChatMessage[] };
    sendEntityMessage: (entityId: string, text: string, contextData?: string, files?: File[]) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { resolveProjectFile, matrices, reports } = useProject();
    const { showNotification } = useUI();
    
    // Global/Main Chat State
    const [chats, setChats] = useState<{ [projectId: string]: Chat[] }>({});
    const [threads, setThreads] = useState<Thread[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]); 
    const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
    
    // Entity Chat State (Ephemeral for session, could be persisted later)
    const [entityThreads, setEntityThreads] = useState<{ [entityId: string]: ChatMessage[] }>({});
    
    const [isGenerating, setIsGenerating] = useState(false);

    // Fetch Threads & Handle Logout Clearing
    useEffect(() => {
        if (!user) {
            setThreads([]);
            setMessages([]);
            setActiveThreadId(null);
            setChats({});
            setEntityThreads({});
            return;
        }
        const fetchThreads = async () => {
            const userId = (await supabase.auth.getUser()).data.user?.id;
            if (!userId) return;

            const { data } = await supabase
                .from('threads')
                .select('*')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false });
            
            if (data) {
                const threadsWithMsgs = await Promise.all(data.map(async (t: any) => {
                    const { data: msgs } = await supabase.from('messages').select('*').eq('thread_id', t.id).order('created_at', { ascending: true });
                    return {
                        id: t.id,
                        title: t.title,
                        isPinned: t.is_pinned,
                        createdAt: t.created_at,
                        updatedAt: t.updated_at,
                        contextSnapshot: t.context_snapshot || [],
                        messages: msgs?.map((m: any) => ({
                            id: m.id,
                            sender: m.sender,
                            text: m.text
                        })) || []
                    };
                }));
                setThreads(threadsWithMsgs);
            }
        };
        fetchThreads();
    }, [user]);

    useEffect(() => {
        if (activeThreadId) {
            const thread = threads.find(t => t.id === activeThreadId);
            if (thread) {
                setMessages(thread.messages);
            }
        } else {
            // Do NOT clear messages if we are in the middle of generating a new thread (isGenerating=true)
            if (!isGenerating) {
                setMessages([]);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeThreadId, threads]); // Intentionally exclude isGenerating to avoid circular logic.

    const createThread = useCallback(async (initialMessage: string, contextSnapshot: ContextItem[] = []): Promise<string> => {
        if (!user) return '';
        const title = initialMessage.length > 40 ? initialMessage.substring(0, 40) + '...' : initialMessage;
        
        const { data, error } = await supabase.from('threads').insert({
            user_id: (await supabase.auth.getUser()).data.user?.id,
            title: title,
            context_snapshot: contextSnapshot
        }).select().single();

        if (error || !data) {
            console.error("Failed to create thread", error);
            showNotification("Failed to save chat session.", 'error');
            return '';
        }

        const newThread: Thread = {
            id: data.id,
            title: data.title,
            createdAt: data.created_at,
            updatedAt: data.created_at,
            messages: [],
            contextSnapshot
        };
        
        setThreads(prev => [newThread, ...prev]);
        setActiveThreadId(newThread.id);
        return newThread.id;
    }, [user, showNotification]);

    const addMessageToThread = useCallback(async (threadId: string, message: ChatMessage) => {
        setMessages(prev => [...prev, message]);
        setThreads(prev => prev.map(t => t.id === threadId ? { ...t, messages: [...t.messages, message] } : t));

        await supabase.from('messages').insert({
            thread_id: threadId,
            sender: message.sender,
            text: message.text
        });
        
        await supabase.from('threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId);
    }, []);

    const togglePinThread = useCallback(async (threadId: string) => {
        const thread = threads.find(t => t.id === threadId);
        if (thread) {
            const newPinned = !thread.isPinned;
            setThreads(prev => prev.map(t => t.id === threadId ? { ...t, isPinned: newPinned } : t));
            await supabase.from('threads').update({ is_pinned: newPinned }).eq('id', threadId);
        }
    }, [threads]);

    const deleteThread = useCallback(async (threadId: string) => {
        const { error } = await supabase.from('threads').delete().eq('id', threadId);
        if (error) {
            console.error("Failed to delete thread", error);
            showNotification("Failed to delete thread.", 'error');
            return;
        }
        setThreads(prev => prev.filter(t => t.id !== threadId));
        if (activeThreadId === threadId) {
            setActiveThreadId(null);
            setMessages([]);
        }
    }, [activeThreadId, showNotification]);

    // --- Main Global Chat ---
    const sendMessage = async (
        text: string, 
        filesToSend?: File[], 
        instructions?: string, 
        model?: string, 
        contextItems?: ContextItem[], 
        viewMode?: string, 
        enableThinking?: boolean,
        forceNewChat?: boolean
    ) => {
        // 1. INSTANT FEEDBACK: Set loading immediately so UI switches view
        setIsGenerating(true);

        try {
            let currentThreadId = forceNewChat ? null : activeThreadId;

            if (forceNewChat) {
                setActiveThreadId(null);
                setMessages([]); 
            }

            // 2. Add User Message to Local State (Optimistic Update)
            const userMsg: ChatMessage = {
                id: `msg-${Date.now()}`,
                sender: 'user',
                text: text,
                attachments: filesToSend?.map(f => ({ id: `temp-${f.name}`, name: f.name, icon: FileSheetIcon, file: f })),
                contextSnapshot: contextItems
            };
            setMessages(prev => [...prev, userMsg]);

            // 3. Ensure Thread Exists (Async)
            if (!currentThreadId) {
                currentThreadId = await createThread(text, contextItems);
                if (!currentThreadId) throw new Error("Failed to initialize conversation.");
            }

            // 4. Save User Message to DB
            if (currentThreadId) {
                supabase.from('messages').insert({ thread_id: currentThreadId, sender: 'user', text: text });
            }

            // 5. HYDRATE CONTEXT (LIVE UPDATE)
            // Clone context items to avoid mutation, then fill content
            const hydratedContext: ContextItem[] = [];
            const allFilesForAI: File[] = [...(filesToSend || [])];

            if (contextItems) {
                for (const item of contextItems) {
                    const newItem = { ...item };
                    
                    if (item.source === 'worksheet' && item.itemId) {
                        const matrix = matrices.find(m => m.id === item.itemId);
                        if (matrix) {
                            newItem.content = serializeMatrix(matrix);
                        }
                    } else if (item.source === 'report' && item.itemId) {
                        const report = reports.find(r => r.id === item.itemId);
                        if (report) {
                            newItem.content = serializeReport(report);
                        }
                    } else if (item.source === 'project' && item.itemId) {
                        const alreadyExists = allFilesForAI.some(f => f.name === item.name);
                        if (!alreadyExists) {
                            try {
                                const resolvedFile = await resolveProjectFile(item.itemId);
                                if (resolvedFile) allFilesForAI.push(resolvedFile);
                            } catch (err) { console.warn(`Could not resolve file ${item.name}`, err); }
                        }
                    }
                    hydratedContext.push(newItem);
                }
            }

            // 6. Stream Response
            const aiMsgId = `ai-${Date.now()}`;
            const initialAiMsg: ChatMessage = { id: aiMsgId, sender: 'ai', text: '', grounding: undefined };
            setMessages(prev => [...prev, initialAiMsg]);

            let accumulatedText = "";
            let finalGrounding = undefined;

            const stream = aiService.generateChatStream(text, allFilesForAI, instructions || '', model, hydratedContext, enableThinking);

            for await (const chunk of stream) {
                if (chunk.text) accumulatedText += chunk.text;
                if (chunk.grounding) finalGrounding = chunk.grounding;

                setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: accumulatedText, grounding: finalGrounding } : m));
            }

            if (currentThreadId) {
                await addMessageToThread(currentThreadId, { id: aiMsgId, sender: 'ai', text: accumulatedText, grounding: finalGrounding });
            }

        } catch (e: any) {
            console.error("AI Generation Error:", e);
            const errorText = "I encountered an error while processing your request. Please try again.";
            setMessages(prev => [...prev, { id: `err-${Date.now()}`, sender: 'ai', text: errorText }]);
            showNotification(e.message || "Failed to connect to AI Service.", 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    // --- Entity (Side-Panel) Chat ---
    const sendEntityMessage = async (entityId: string, text: string, contextData: string = '', files?: File[]) => {
        setIsGenerating(true);
        
        const userMsg: ChatMessage = { id: `msg-${Date.now()}`, sender: 'user', text: text };
        setEntityThreads(prev => ({
            ...prev,
            [entityId]: [...(prev[entityId] || []), userMsg]
        }));

        try {
            const previousMsgs = entityThreads[entityId] || [];
            let prompt = `Current Document Context:\n${contextData}\n\n`;
            
            if (previousMsgs.length > 0) {
                prompt += `Conversation History:\n${previousMsgs.slice(-5).map(m => `${m.sender === 'user' ? 'User' : 'AI'}: ${m.text}`).join('\n')}\n\n`;
            }
            
            prompt += `User Query: ${text}`;

            const aiMsgId = `ai-${Date.now()}`;
            const initialAiMsg: ChatMessage = { id: aiMsgId, sender: 'ai', text: '' };
            setEntityThreads(prev => ({
                ...prev,
                [entityId]: [...(prev[entityId] || []), initialAiMsg]
            }));

            const stream = aiService.generateChatStream(prompt, files || [], 'You are a helpful assistant analyzing this document.', undefined, []);

            let accumulatedText = "";
            for await (const chunk of stream) {
                if (chunk.text) accumulatedText += chunk.text;
                
                setEntityThreads(prev => ({
                    ...prev,
                    [entityId]: prev[entityId].map(m => m.id === aiMsgId ? { ...m, text: accumulatedText } : m)
                }));
            }

        } catch (e: any) {
            console.error("Entity Chat Error:", e);
            const errorText = "Error generating response.";
            setEntityThreads(prev => ({
                ...prev,
                [entityId]: [...(prev[entityId] || []), { id: `err-${Date.now()}`, sender: 'ai', text: errorText }]
            }));
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <ChatContext.Provider value={{
            chats, setChats,
            threads, setThreads,
            activeThreadId, setActiveThreadId,
            messages, setMessages,
            isGenerating,
            createThread, addMessageToThread, sendMessage, togglePinThread, deleteThread,
            entityThreads, sendEntityMessage
        }}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChat = () => {
    const context = useContext(ChatContext);
    if (!context) throw new Error('useChat must be used within ChatProvider');
    return context;
};
