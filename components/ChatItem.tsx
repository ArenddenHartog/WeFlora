
import React, { useState, useEffect } from 'react';
import type { Chat } from '../types';
import { MoreHorizontalIcon, PencilIcon, CheckIcon, XIcon, TagIcon } from './icons';

interface ChatItemProps {
  chat: Chat;
  isSelected: boolean;
  onClick: () => void;
  onUpdate: (chat: Chat) => void;
}

const ChatItem: React.FC<ChatItemProps> = ({ chat, isSelected, onClick, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(chat.title);
  const [editedDescription, setEditedDescription] = useState(chat.description);
  const [editedTags, setEditedTags] = useState<string[]>(chat.tags || []);
  const [newTagInput, setNewTagInput] = useState('');
  
  const Icon = chat.icon;

  useEffect(() => {
    if (!isEditing) {
        setEditedTitle(chat.title);
        setEditedDescription(chat.description);
        setEditedTags(chat.tags || []);
    }
  }, [chat, isEditing]);

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate({ ...chat, title: editedTitle, description: editedDescription, tags: editedTags });
    setIsEditing(false);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditedTitle(chat.title);
    setEditedDescription(chat.description);
    setEditedTags(chat.tags || []);
    setNewTagInput('');
    setIsEditing(false);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  }

  const handleAddTag = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && newTagInput.trim()) {
          e.preventDefault();
          if (editedTags.length < 3 && !editedTags.includes(newTagInput.trim())) {
              setEditedTags([...editedTags, newTagInput.trim()]);
              setNewTagInput('');
          }
      }
  };

  const handleRemoveTag = (tagToRemove: string) => {
      setEditedTags(editedTags.filter(tag => tag !== tagToRemove));
  };

  if (isEditing) {
    return (
      <div className={`flex flex-col p-3 rounded-lg bg-slate-100 gap-2`}>
        <div className="flex items-center gap-4 w-full min-w-0">
          <div className={`h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-full bg-weflora-teal text-white`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-grow min-w-0">
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md px-2 py-1 text-sm font-medium focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal outline-none"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
            <input
              type="text"
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md px-2 py-1 mt-1 text-sm focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
        
        {/* Tag Editing Area */}
        <div className="pl-12 flex flex-wrap gap-2 items-center">
             {editedTags.map(tag => (
                 <span key={tag} className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-200 text-xs rounded-md text-slate-700">
                     #{tag}
                     <button onClick={() => handleRemoveTag(tag)} className="text-slate-400 hover:text-red-500"><XIcon className="h-3 w-3" /></button>
                 </span>
             ))}
             {editedTags.length < 3 && (
                 <input 
                    type="text" 
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={handleAddTag}
                    placeholder="Add tag..."
                    className="text-xs bg-transparent border-b border-slate-300 focus:border-weflora-teal outline-none w-20 px-1"
                 />
             )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <button onClick={handleSave} className="p-1.5 text-green-600 rounded-md hover:bg-green-100 bg-white border border-slate-200 shadow-sm" title="Save">
            <CheckIcon className="h-4 w-4" />
          </button>
          <button onClick={handleCancel} className="p-1.5 text-red-600 rounded-md hover:bg-red-100 bg-white border border-slate-200 shadow-sm" title="Cancel">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={onClick}
      className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-weflora-mint/30' : 'hover:bg-slate-50'}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      aria-pressed={isSelected}
    >
      <div className="flex items-center gap-4 min-w-0 flex-grow">
        <div className={`h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-full ${isSelected ? 'bg-weflora-teal text-white' : 'bg-slate-100 text-slate-500'}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-grow">
          <div className="flex items-center gap-2">
            <p className={`text-slate-800 truncate ${isSelected ? 'font-semibold' : 'font-medium'}`}>{chat.title}</p>
            <button 
                onClick={handleEditClick} 
                className={`p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 opacity-0 group-hover:opacity-100 transition-opacity`}
                title="Edit chat"
            >
              <PencilIcon className="h-3 w-3" />
            </button>
          </div>
          <p className="text-sm text-slate-500 truncate">{chat.description}</p>
          {/* Tags Display */}
          {chat.tags && chat.tags.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                  {chat.tags.map(tag => (
                      <span key={tag} className={`text-[10px] px-1.5 rounded-md ${isSelected ? 'bg-weflora-mint/20 text-weflora-teal-dark' : 'bg-slate-100 text-slate-500'}`}>
                          #{tag}
                      </span>
                  ))}
              </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 text-slate-400 group-hover:text-slate-500 pl-2 flex-shrink-0 self-start">
        <span className="text-xs whitespace-nowrap">{chat.time}</span>
        <button 
            className={`p-1 rounded-md hover:bg-slate-200 opacity-0 group-hover:opacity-100 transition-opacity`}
            title="More actions"
            onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontalIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default ChatItem;
