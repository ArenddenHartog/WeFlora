
import React, { useState } from 'react';
import type { Task, Member, TeamComment, TaskPriority } from '../types';
import { 
    PlusIcon, CheckCircleIcon, CircleIcon, CalendarIcon, 
    UserPlusIcon, MessageSquareIcon, ClipboardCheckIcon, SendIcon, XIcon
} from './icons';
import BaseModal from './BaseModal';
import { useUI } from '../contexts/UIContext';

interface ProjectTeamViewProps {
    members: Member[];
    tasks: Task[];
    comments: TeamComment[];
    projectId: string;
    onCreateTask: (task: Task) => void;
    onToggleTaskStatus: (taskId: string) => void;
    onCreateComment: (text: string) => void;
    onInviteMember?: (email: string) => void;
}

const ProjectTeamView: React.FC<ProjectTeamViewProps> = ({ 
    members, tasks, comments, projectId, onCreateTask, onToggleTaskStatus, onCreateComment, onInviteMember
}) => {
    const { showNotification } = useUI();
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    
    // Task Form
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskAssignee, setNewTaskAssignee] = useState(members[0]?.id || '');
    const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('Medium');
    const [newTaskDue, setNewTaskDue] = useState('');
    const [commentText, setCommentText] = useState('');

    const handleCreateTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;

        const newTask: Task = {
            id: `t-${Date.now()}`,
            title: newTaskTitle,
            assigneeId: newTaskAssignee,
            dueDate: newTaskDue || 'No Date',
            status: 'Todo',
            priority: newTaskPriority,
            projectId: projectId
        };
        onCreateTask(newTask);
        setIsTaskModalOpen(false);
        setNewTaskTitle('');
    };

    const handleInvite = (e: React.FormEvent) => {
        e.preventDefault();
        if (inviteEmail) {
            if(onInviteMember) {
                onInviteMember(inviteEmail);
                showNotification(`Added ${inviteEmail} to the project`, 'success');
            } else {
                showNotification(`Invitation sent to ${inviteEmail}`, 'success');
            }
            setIsInviteModalOpen(false);
            setInviteEmail('');
        }
    };

    const handlePostComment = (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentText.trim()) return;
        onCreateComment(commentText);
        setCommentText('');
    };

    const getPriorityColor = (priority: TaskPriority) => {
        switch (priority) {
            case 'High': return 'bg-weflora-red/20 text-weflora-red border-weflora-red/20';
            case 'Medium': return 'bg-weflora-amber/10 text-weflora-amber border-weflora-amber/20';
            case 'Low': return 'bg-weflora-teal/10 text-weflora-dark border-weflora-teal/20';
        }
    };

    const sortedTasks = [...tasks].sort((a, b) => {
        if (a.status === 'Done' && b.status !== 'Done') return 1;
        if (a.status !== 'Done' && b.status === 'Done') return -1;
        return 0;
    });

    return (
        <div className="max-w-7xl mx-auto h-full flex flex-col lg:flex-row gap-8 p-6 lg:p-8 animate-fadeIn pb-24 lg:pb-8 bg-white">
            {/* Left Column: Tasks */}
            <div className="flex-1 flex flex-col h-full overflow-hidden min-h-[400px]">
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                        <div className="p-2 bg-weflora-mint/20 rounded-lg text-weflora-teal">
                            <ClipboardCheckIcon className="h-6 w-6" />
                        </div>
                        Plan & Execute
                    </h2>
                    <button 
                        onClick={() => setIsTaskModalOpen(true)} 
                        className="flex items-center gap-2 px-4 py-2 bg-weflora-teal text-white rounded-xl text-sm font-bold hover:bg-weflora-dark transition-colors shadow-sm"
                    >
                        <PlusIcon className="h-4 w-4" /> Add Task
                    </button>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex-1 flex flex-col shadow-sm">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Team Members</span>
                            <div className="flex -space-x-2">
                                {members.map(m => (
                                    <div key={m.id} className="h-8 w-8 rounded-full ring-2 ring-white bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 border border-slate-100" title={m.name}>
                                        {m.initials}
                                    </div>
                                ))}
                            </div>
                         </div>
                         <button onClick={() => setIsInviteModalOpen(true)} className="flex items-center gap-1 text-xs font-bold text-weflora-teal hover:text-weflora-dark bg-weflora-mint/10 hover:bg-weflora-mint/30 px-2 py-1 rounded-lg transition-colors" title="Invite Member">
                             <UserPlusIcon className="h-4 w-4" /> Invite
                         </button>
                    </div>

                    <div className="overflow-y-auto flex-1 p-3 custom-scrollbar">
                        {sortedTasks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                                <ClipboardCheckIcon className="h-10 w-10 opacity-20 mb-2" />
                                <p className="text-sm">No tasks yet. Create one to get started!</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {sortedTasks.map(task => {
                                    const assignee = members.find(m => m.id === task.assigneeId);
                                    return (
                                        <div key={task.id} className={`group flex items-center gap-3 p-3 rounded-xl border transition-all ${task.status === 'Done' ? 'bg-slate-50 border-slate-100 opacity-75' : 'bg-white border-slate-200 hover:border-weflora-teal hover:shadow-sm'}`}>
                                            <button onClick={() => onToggleTaskStatus(task.id)} className={`flex-shrink-0 transition-colors ${task.status === 'Done' ? 'text-weflora-teal' : 'text-slate-300 hover:text-weflora-teal'}`}>
                                                {task.status === 'Done' ? <CheckCircleIcon className="h-6 w-6" /> : <CircleIcon className="h-6 w-6" />}
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                <div className={`font-medium truncate ${task.status === 'Done' ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{task.title}</div>
                                                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                                    <span className={`px-1.5 py-0.5 rounded border font-medium ${getPriorityColor(task.priority)}`}>{task.priority}</span>
                                                    {task.dueDate && <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{task.dueDate}</span>}
                                                </div>
                                            </div>
                                            {assignee && <div className="h-6 w-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 flex-shrink-0 border border-slate-100" title={`Assigned to ${assignee.name}`}>{assignee.initials}</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Column: Discussion */}
            <div className="w-full lg:w-96 flex flex-col h-full min-h-[400px]">
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                        <div className="p-2 bg-weflora-teal/10 rounded-lg text-weflora-teal">
                            <MessageSquareIcon className="h-6 w-6" />
                        </div>
                        Discussion
                    </h2>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex-1 flex flex-col shadow-sm">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {comments.length === 0 ? <div className="text-center text-slate-400 text-sm py-12">No comments yet. Start the conversation!</div> : comments.map(comment => {
                            const author = members.find(m => m.id === comment.memberId);
                            return (
                                <div key={comment.id} className="flex gap-3">
                                    <div className="h-8 w-8 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center text-xs font-bold text-slate-600 border border-slate-100">{author?.initials || '?'}</div>
                                    <div className="bg-slate-50 p-3 rounded-lg rounded-tl-none border border-slate-100">
                                        <div className="flex items-baseline gap-2 mb-1"><span className="text-xs font-bold text-slate-800">{author?.name || 'Unknown'}</span><span className="text-[10px] text-slate-400">{comment.timestamp}</span></div>
                                        <p className="text-sm text-slate-700 leading-relaxed">{comment.text}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="p-3 border-t border-slate-100 bg-slate-50">
                        <form onSubmit={handlePostComment} className="flex gap-2">
                            <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write a comment..." className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal outline-none transition-shadow" />
                            <button type="submit" disabled={!commentText.trim()} className="p-2.5 bg-weflora-teal text-white rounded-xl disabled:opacity-50 hover:bg-weflora-dark transition-colors shadow-sm"><SendIcon className="h-5 w-5" /></button>
                        </form>
                    </div>
                </div>
            </div>

            <BaseModal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title="Add New Task" size="sm" footer={<><button onClick={() => setIsTaskModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors">Cancel</button><button onClick={handleCreateTask} className="px-4 py-2 bg-weflora-teal text-white rounded-lg text-sm font-medium hover:bg-weflora-dark shadow-sm transition-colors">Create Task</button></>}>
                <form onSubmit={handleCreateTask} className="space-y-4">
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Task Title</label><input autoFocus type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="e.g. Call Utility Co." className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal" /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assignee</label><select value={newTaskAssignee} onChange={(e) => setNewTaskAssignee(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal">{members.map(m => (<option key={m.id} value={m.id}>{m.name}</option>))}</select></div>
                        <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Priority</label><select value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal"><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option></select></div>
                    </div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date</label><input type="date" value={newTaskDue} onChange={(e) => setNewTaskDue(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal" /></div>
                </form>
            </BaseModal>

            <BaseModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} title="Invite Team Member" size="sm" footer={<><button onClick={() => setIsInviteModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors">Cancel</button><button onClick={handleInvite} className="px-4 py-2 bg-weflora-teal text-white rounded-lg text-sm font-medium hover:bg-weflora-dark shadow-sm transition-colors">Send Invite</button></>}>
                <form onSubmit={handleInvite} className="space-y-4">
                    <p className="text-sm text-slate-500">Invite a new member to collaborate on this project.</p>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label><input autoFocus type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@example.com" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal" /></div>
                </form>
            </BaseModal>
        </div>
    );
};

export default ProjectTeamView;
