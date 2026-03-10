import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Bot, Lock, Mail, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function Login() {
    const { user, login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (user) return <Navigate to="/" />;

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password);
        } catch (err) {
            setError('Credenciales incorrectas, vuelve a intentarlo');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen animate-liquid flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-navy-100/50">
            {/* Elementos ambientales del sistema - Azul Marino y Gris */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[70%] rounded-full bg-navy-100/10 blur-[200px] pointer-events-none animate-pulse duration-[10s]" />
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-navy-200/10 blur-[150px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-navy-300/10 blur-[150px] pointer-events-none" />

            <div className="relative z-10 w-full max-w-xl mb-12 animate-fade-up">
                {/* Branding Dental Sistemático - Espaciado incrementado para evitar solapamiento */}
                <div className="flex flex-col items-center mb-24 px-4">
                    <div className="text-center space-y-2">
                        <h1 className="text-5xl font-light text-navy-900 tracking-[-0.04em]">NovTurnIA <span className="font-extrabold text-navy-900">Plan Pro</span></h1>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.6em] pt-1">Gestión Odontológica Integral</p>
                    </div>
                </div>

                {/* Tarjeta de Login Glass-Premium Reforzada */}
                <div className="glass-premium rounded-[56px] p-12 md:p-16 relative group">
                    {/* Robot Flotante Interactivo al borde de la tarjeta */}
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 group-hover:-top-12 transition-all duration-700 ease-out z-20">
                        <div className="w-20 h-20 rounded-[32px] bg-white border border-navy-50 flex items-center justify-center shadow-[0_15px_40px_rgba(26,58,107,0.12)] group/bot cursor-pointer">
                            <div className="relative">
                                <Bot size={40} className="text-navy-900 transition-transform group-hover/bot:rotate-12 duration-500" strokeWidth={2.2} />
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-navy-500 rounded-full animate-pulse border-2 border-white shadow-sm" />
                            </div>
                        </div>
                    </div>
                    <div className="relative z-10">
                        <div className="mb-14 text-center px-4">
                            <h2 className="text-2xl font-bold text-navy-900 tracking-tight mb-3">Acceso al Software</h2>
                            <p className="text-gray-500 text-[14px] font-medium leading-relaxed">
                                Ingresa tus credenciales institucionales para acceder a la gestión dental.
                            </p>
                        </div>

                        {error && (
                            <div className="mb-10 p-5 bg-red-50/50 border border-red-100 rounded-[32px] text-[13px] text-red-600 font-semibold flex items-center gap-4 animate-shake">
                                <Lock size={16} strokeWidth={2.5} className="shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-10">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-navy-900 uppercase tracking-[0.4em] ml-6 opacity-40">
                                    Usuario o correo electrónico
                                </label>
                                <div className="relative group/input">
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        required
                                        placeholder="usuario@novturnia.com"
                                        className="w-full glass-input rounded-[28px] pl-16 pr-8 py-6 text-[15px] outline-none placeholder:text-gray-400 font-semibold relative z-0"
                                    />
                                    <div className="absolute inset-y-0 left-7 flex items-center pointer-events-none text-gray-500/80 group-focus-within/input:text-navy-900 transition-colors duration-500 z-10">
                                        <Mail size={18} strokeWidth={2.5} />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-6">
                                    <label className="text-[10px] font-black text-navy-900 uppercase tracking-[0.4em] opacity-40">
                                        Contraseña
                                    </label>
                                    <button type="button" className="text-[10px] font-bold text-navy-700 hover:text-navy-900 transition-colors uppercase tracking-widest duration-300 underline underline-offset-4 decoration-navy-200">
                                        ¿Nueva clave?
                                    </button>
                                </div>
                                <div className="relative group/input">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        required
                                        placeholder="••••••••"
                                        className="w-full glass-input rounded-[28px] pl-16 pr-16 py-6 text-[15px] outline-none placeholder:text-gray-400 font-semibold relative z-0"
                                    />
                                    <div className="absolute inset-y-0 left-7 flex items-center pointer-events-none text-gray-500/80 group-focus-within/input:text-navy-900 transition-colors duration-500 z-10">
                                        <Lock size={18} strokeWidth={2.5} />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-7 flex items-center text-gray-500/80 hover:text-navy-700 transition-colors duration-300 z-10"
                                    >
                                        {showPassword ? <EyeOff size={18} strokeWidth={2.5} /> : <Eye size={18} strokeWidth={2.5} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full !mt-16 bg-navy-900 text-white text-[15px] font-bold py-6 rounded-[32px] shadow-[0_20px_40px_rgba(15,32,68,0.2)] hover:shadow-[0_25px_50px_rgba(15,32,68,0.3)] hover:scale-[1.01] active:scale-[0.98] transition-all duration-700 disabled:opacity-50 flex items-center justify-center gap-4 group"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span>Iniciar Sesión</span>
                                        <ArrowRight size={20} className="transition-transform group-hover:translate-x-1 duration-500" />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Footer Institucional */}
                <div className="mt-20 text-center space-y-6">
                    <div className="flex items-center justify-center gap-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.8em]">
                        <div className="w-12 h-[1.5px] bg-gray-400/40" />
                        Potenciado con Inteligencia Artificial
                        <div className="w-12 h-[1.5px] bg-gray-400/40" />
                    </div>
                </div>
            </div>

            {/* Decoraciones Estilo Dashboard */}
            <div className="absolute top-[20%] right-[-5%] w-[40rem] h-[40rem] border-[1px] border-navy-900/5 rounded-full animate-float-delayed pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[50rem] h-[50rem] border-[1px] border-navy-900/5 rounded-full animate-float pointer-events-none" />
        </div>
    );
}
