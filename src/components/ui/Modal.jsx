export default function Modal({ children, isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-navy-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white/95 backdrop-blur-modal border border-white/90 rounded-2xl shadow-modal w-full max-w-md p-7 animate-fade-up relative">
                {onClose && (
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">✕</button>
                )}
                {children}
            </div>
        </div>
    );
}
