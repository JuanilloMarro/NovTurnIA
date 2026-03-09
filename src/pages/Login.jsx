import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Bot, Lock, Mail, Eye, EyeOff } from 'lucide-react';

export default function Login() {
    const { user, login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Si ya está autenticado, redirigir al dashboard
    if (user) return <Navigate to="/" />;

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-[#F4F5F9] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Orbes de fondo dinámicos */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-navy-200/20 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-navy-300/10 blur-[120px]" />
            </div>

            <div className="relative z-10 w-full max-w-md animate-fade-in">
                {/* Logo Section */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-[22px] bg-navy-900 border border-white/20 flex items-center justify-center mx-auto mb-4 shadow-[0_20px_40px_rgba(26,58,107,0.25)] transition-transform hover:scale-105 duration-300">
                        <Bot size={32} className="text-white" strokeWidth={2.5} />
                    </div>
                    <h1 className="text-3xl font-bold text-navy-900 tracking-tight">NovTurnIA</h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-[0.2em]">Management System</p>
                </div>

                {/* Login Card */}
                <div className="bg-white/70 backdrop-blur-xl border border-white/90 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.06)] p-10 relative">
                    <div className="mb-8">
                        <h2 className="text-xl font-bold text-navy-900">Bienvenido</h2>
                        <p className="text-sm text-gray-500 mt-1">Ingresa tus credenciales para continuar</p>
                    </div>

                    {error && (
                        <div className="mb-6 px-4 py-3 bg-red-50/50 backdrop-blur-sm border border-red-100 rounded-2xl text-[13px] text-red-600 font-medium flex items-center gap-3 animate-shake">
                            <Lock size={16} />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-1">
                                Email
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-navy-500 transition-colors">
                                    <Mail size={18} />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                    placeholder="tu@email.com"
                                    className="w-full bg-white/50 border border-gray-200/60 rounded-2xl pl-12 pr-4 py-3.5 text-sm outline-none focus:bg-white focus:border-navy-500 focus:ring-4 focus:ring-navy-500/10 transition-all placeholder:text-gray-300"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest pl-1">
                                Contraseña
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-navy-500 transition-colors">
                                    <Lock size={18} />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    placeholder="••••••••"
                                    className="w-full bg-white/50 border border-gray-200/60 rounded-2xl pl-12 pr-12 py-3.5 text-sm outline-none focus:bg-white focus:border-navy-500 focus:ring-4 focus:ring-navy-500/10 transition-all placeholder:text-gray-300"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-4 flex items-center text-gray-400 hover:text-navy-500 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full !mt-10 bg-navy-900 text-white text-sm font-bold py-4 rounded-2xl shadow-[0_10px_25px_rgba(26,58,107,0.2)] hover:shadow-[0_15px_30px_rgba(26,58,107,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-3">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Entrando...</span>
                                </div>
                            ) : 'Entrar al Dashboard'}
                        </button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-gray-100 flex items-center justify-center gap-4">
                        <div className="text-[11px] font-bold text-gray-300 uppercase tracking-widest">TurnIA Plan Pro</div>
                        <div className="w-1 h-1 rounded-full bg-gray-200" />
                        <div className="text-[11px] font-bold text-gray-300 uppercase tracking-widest">Medical Glass UI</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
