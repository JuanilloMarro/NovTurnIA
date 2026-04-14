import { Component } from 'react';
import * as Sentry from '@sentry/react';

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('ErrorBoundary caught:', error, info);
        Sentry.captureException(error, { extra: info });
    }

    render() {
        if (!this.state.hasError) return this.props.children;

        return (
            <div className="min-h-screen bg-[#F4F5F9] flex items-center justify-center p-6">
                <div className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-[28px] shadow-lg p-10 max-w-md w-full text-center">
                    <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-5">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-bold text-navy-900 tracking-tight mb-2">Algo salió mal</h2>
                    <p className="text-sm text-navy-700/60 font-semibold mb-6">
                        Ocurrió un error inesperado. El equipo ha sido notificado.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2.5 bg-navy-900 text-white text-xs font-bold rounded-full hover:bg-navy-800 transition-colors"
                    >
                        Recargar página
                    </button>
                </div>
            </div>
        );
    }
}
