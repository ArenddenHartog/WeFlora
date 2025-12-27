
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { LogoIcon, SparklesIcon } from './icons';

const AuthView: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'signin' | 'signup'>('signin');
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (mode === 'signup') {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                if (data.session) {
                    // Signed in immediately
                    navigate('/');
                } else {
                    setMessage('Account created — check your email to confirm.');
                }
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                navigate('/');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-weflora-mint/30 rounded-full blur-3xl"></div>
                <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-weflora-teal/20 rounded-full blur-3xl"></div>
            </div>

            <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-slate-100 relative z-10">
                <div className="flex flex-col items-center mb-8">
                    <div className="h-14 w-14 bg-weflora-teal rounded-2xl flex items-center justify-center text-white shadow-lg mb-4">
                        <LogoIcon className="h-8 w-8 fill-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">Welcome to WeFlora</h1>
                    <p className="text-slate-500 text-sm mt-1">Knowledge work starts here</p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-weflora-teal outline-none transition-all"
                            placeholder="you@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-weflora-teal outline-none transition-all"
                            placeholder="••••••••"
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-weflora-red/10 text-weflora-red text-sm rounded-lg border border-weflora-red/20">
                            {error}
                        </div>
                    )}

                    {message && (
                        <div className="p-3 bg-weflora-success/10 text-weflora-success text-sm rounded-lg border border-weflora-success/20">
                            {message}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-weflora-teal text-white rounded-xl font-bold hover:bg-weflora-dark transition-all shadow-lg shadow-weflora-teal/20 flex items-center justify-center gap-2"
                    >
                        {loading ? 'Processing...' : (mode === 'signin' ? 'Sign In' : 'Sign Up')}
                        {!loading && <SparklesIcon className="h-4 w-4" />}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-slate-500">
                    {mode === 'signin' ? "Don't have an account? " : "Already have an account? "}
                    <button
                        onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                        className="text-weflora-teal font-bold hover:underline"
                    >
                        {mode === 'signin' ? 'Sign Up' : 'Sign In'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthView;
