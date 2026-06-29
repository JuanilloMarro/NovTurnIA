import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Bot, Lock, Mail, Eye, EyeOff, ArrowRight } from 'lucide-react';
import AIStar from '../components/Icons/AIStar';

export default function Login() {
    const { user, login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const SUPER_ADMIN_EMAIL = import.meta.env.VITE_SUPER_ADMIN_EMAIL ?? '';
    if (user) return <Navigate to={SUPER_ADMIN_EMAIL && user.email === SUPER_ADMIN_EMAIL ? '/admin' : '/'} />;

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password);
            setPassword('');
        } catch (err) {
            setError('Credenciales incorrectas, vuelve a intentarlo');
            setPassword('');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-navy-100/50">
            {/* Elementos ambientales del sistema */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] rounded-full bg-navy-100/10 blur-[120px] pointer-events-none animate-pulse-slow" />
            <div className="lg-orb w-[500px] h-[500px] top-[-10%] left-[-10%] animate-float opacity-80" />
            <div className="lg-orb w-[400px] h-[400px] bottom-[-5%] right-[-5%] animate-float-delayed opacity-80" />

            <div className="relative z-10 w-full max-w-md mb-6 animate-fade-up">
                {/* Branding */}
                <div className="flex flex-col items-center mb-16 px-4">
                    <div className="text-center">
                        <h1 className="text-4xl font-light text-navy-900 tracking-tight text-center">NovTurnIA</h1>
                    </div>
                </div>

                {/* Card — glass igual que los paneles del sistema */}
                <div className="bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgba(26,58,107,0.15),inset_0_2px_4px_rgba(255,255,255,0.8)] rounded-[40px] p-8 md:p-10 relative group">
                    {/* Orbes ambientales internos — igual que los paneles */}
                    <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
                    <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
                    <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
                    <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />

                    {/* Robot Flotante Interactivo al borde de la tarjeta */}
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 group-hover:-top-9 transition-all duration-700 ease-out z-20">
                        <div className="w-14 h-14 rounded-[22px] bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_24px_rgba(26,58,107,0.10)] flex items-center justify-center group/bot cursor-pointer">
                            <div className="relative">
                                <Bot size={28} className="text-navy-900 transition-transform group-hover/bot:rotate-12 duration-500" strokeWidth={2.2} />
                                <AIStar size={11} className="absolute -top-1 -left-1 text-navy-900" strokeWidth={2.5} />
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10">
                        <div className="mb-7 text-center px-2 pt-2">
                            <h2 className="text-lg font-bold text-navy-900 tracking-tight mb-1.5">Acceso al Software</h2>
                            <p className="text-gray-500 text-[12px] font-medium leading-relaxed">
                                Ingresa tus credenciales institucionales para acceder a la gestión dental.
                            </p>
                        </div>

                        {error && (
                            <div className="mb-5 p-3.5 bg-white/40 border border-red-200/60 rounded-[20px] text-[12px] text-red-500 font-semibold flex items-center gap-3 animate-shake">
                                <Lock size={14} strokeWidth={2.5} className="shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-navy-900 tracking-wide ml-4 opacity-50">
                                    Usuario o correo electrónico
                                </label>
                                <div className="relative group/input">
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        required
                                        placeholder="usuario@novturnia.com"
                                        className="w-full bg-white/40 border border-white/60 rounded-[20px] pl-12 pr-6 py-4 text-[13px] outline-none placeholder:text-gray-400 font-semibold text-navy-900 focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm relative z-0"
                                    />
                                    <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-gray-500/80 group-focus-within/input:text-navy-900 transition-colors duration-500 z-10">
                                        <Mail size={15} strokeWidth={2.5} />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between px-4">
                                    <label className="text-[10px] font-bold text-navy-900 tracking-wide opacity-50">
                                        Contraseña
                                    </label>
                                </div>
                                <div className="relative group/input">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        required
                                        placeholder="••••••••"
                                        className="w-full bg-white/40 border border-white/60 rounded-[20px] pl-12 pr-12 py-4 text-[13px] outline-none placeholder:text-gray-400 font-semibold text-navy-900 focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm relative z-0 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
                                    />
                                    <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-gray-500/80 group-focus-within/input:text-navy-900 transition-colors duration-500 z-10">
                                        <Lock size={15} strokeWidth={2.5} />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-5 flex items-center text-gray-500/80 hover:text-navy-700 transition-colors duration-300 z-10"
                                    >
                                        {showPassword ? <EyeOff size={15} strokeWidth={2.5} /> : <Eye size={15} strokeWidth={2.5} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full !mt-8 bg-navy-700 hover:bg-navy-900 text-white text-[13px] font-bold py-4 rounded-[22px] shadow-btn hover:shadow-btn-hover hover:scale-[1.01] active:scale-[0.98] transition-all duration-700 disabled:opacity-50 flex items-center justify-center gap-3 group"
                            >
                                {loading ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span>Iniciar Sesión</span>
                                        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1 duration-500" />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
