
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import BaseModal from './BaseModal';

interface AccountSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({ isOpen, onClose }) => {
    const { user, signOut } = useAuth();
    const { showNotification } = useUI();
    const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'org'>('profile');
    const [loading, setLoading] = useState(false);
    
    // Profile State
    const [fullName, setFullName] = useState('');
    
    // Password State
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    useEffect(() => {
        if (isOpen && user) {
            setFullName(user.name); 
        }
    }, [isOpen, user]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({
                data: { full_name: fullName }
            });
            if (error) throw error;
            showNotification('Profile updated successfully.');
        } catch (error: any) {
            showNotification(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            showNotification("Passwords don't match.", 'error');
            return;
        }
        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            });
            if (error) throw error;
            showNotification('Password updated successfully.');
            setPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            showNotification(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title="Account Settings"
            size="lg"
        >
            <div className="flex flex-col md:flex-row gap-6 min-h-[400px]">
                {/* Sidebar */}
                <div className="w-full md:w-1/4 flex flex-col gap-1 border-r border-slate-100 pr-4">
                    <button 
                        onClick={() => setActiveTab('profile')}
                        className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'profile' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Profile
                    </button>
                    <button 
                        onClick={() => setActiveTab('security')}
                        className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'security' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Security
                    </button>
                    <button 
                        onClick={() => setActiveTab('org')}
                        className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'org' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Organization
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1">
                    {activeTab === 'profile' && (
                        <form onSubmit={handleUpdateProfile} className="space-y-4">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Personal Information</h3>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
                                <input 
                                    type="email" 
                                    disabled 
                                    value={user?.email || ''} 
                                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed text-sm" 
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Email cannot be changed.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                                <input 
                                    type="text" 
                                    required
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal outline-none text-sm" 
                                />
                            </div>

                            <div className="pt-4">
                                <button type="submit" disabled={loading} className="px-4 py-2 bg-weflora-teal text-white rounded-lg hover:bg-weflora-dark font-medium text-sm transition-colors disabled:opacity-50 shadow-sm">
                                    {loading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    )}

                    {activeTab === 'security' && (
                        <form onSubmit={handleUpdatePassword} className="space-y-4">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Security</h3>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">New Password</label>
                                <input 
                                    type="password" 
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal outline-none text-sm" 
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirm New Password</label>
                                <input 
                                    type="password" 
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-weflora-teal focus:border-weflora-teal outline-none text-sm" 
                                />
                            </div>

                            <div className="pt-4">
                                <button type="submit" disabled={loading} className="px-4 py-2 bg-weflora-teal text-white rounded-lg hover:bg-weflora-dark font-medium text-sm transition-colors disabled:opacity-50 shadow-sm">
                                    {loading ? 'Updating...' : 'Update Password'}
                                </button>
                            </div>
                        </form>
                    )}

                    {activeTab === 'org' && (
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Organization Settings</h3>
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                <p className="text-sm text-slate-600 mb-2">
                                    You are currently part of <strong>WeFlora Inc.</strong>
                                </p>
                                <p className="text-xs text-slate-500">
                                    Workspace settings, billing, and advanced team roles are managed by your administrator. Contact support for assistance.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-6 pt-6 border-t border-slate-200">
                    <button 
                        onClick={signOut}
                        className="w-full px-4 py-2 bg-weflora-red/10 text-weflora-red rounded-lg hover:bg-weflora-red/20 font-medium text-sm transition-colors border border-weflora-red/20"
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        </BaseModal>
    );
};

export default AccountSettingsModal;
