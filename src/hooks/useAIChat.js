import { useState, useCallback, useEffect } from 'react';
import { askBusinessAI, getAIChatMessages, deleteAIChatMessage, deleteAllAIChatMessages } from '../services/supabaseService';

// Chat de negocio (Centro IA · doc "Automatización Agente IA" Parte B §B.1.2).
// El historial del hilo lo mantiene el backend (tabla ai_chat_messages, un
// hilo por staff_user_id) — reload() lo trae al abrir el módulo; send() solo
// manda el mensaje nuevo y gasta IA. Cada mensaje trae su `id` real (la Edge
// Function lo devuelve al insertarlo) para poder borrarlo individualmente.
export function useAIChat(enabled = true) {
    const [messages, setMessages] = useState([]);
    const [sending, setSending] = useState(false);

    const reload = useCallback(async () => {
        if (!enabled) return;
        try {
            const rows = await getAIChatMessages();
            setMessages(rows.map(r => ({ id: r.id, role: r.role, text: r.content, created_at: r.created_at })));
        } catch {
            // Backend pendiente o error de red: el hilo arranca vacío, sin bloquear el módulo.
        }
    }, [enabled]);

    useEffect(() => { reload(); }, [reload]);

    const send = useCallback(async (text) => {
        const q = text.trim();
        if (!q || sending) return;
        setMessages(m => [...m, { id: null, role: 'user', text: q, created_at: new Date().toISOString() }]);
        setSending(true);
        try {
            const { answer, userMessageId, assistantMessageId } = await askBusinessAI(q);
            setMessages(m => {
                const next = [...m];
                for (let i = next.length - 1; i >= 0; i--) {
                    if (next[i].role === 'user' && next[i].id == null && next[i].text === q) {
                        next[i] = { ...next[i], id: userMessageId };
                        break;
                    }
                }
                next.push({ id: assistantMessageId, role: 'assistant', text: answer || 'No tengo una respuesta para eso todavía.', created_at: new Date().toISOString() });
                return next;
            });
        } catch (err) {
            setMessages(m => [...m, { id: null, role: 'assistant', text: err.message || 'No se pudo responder.', error: true, created_at: new Date().toISOString() }]);
        } finally {
            setSending(false);
        }
    }, [sending]);

    // Borra un mensaje puntual (los que no tienen id real, p. ej. un error de
    // red que nunca se guardó, solo se quitan de la vista).
    const remove = useCallback(async (id) => {
        if (id == null) return;
        setMessages(m => m.filter(msg => msg.id !== id));
        try {
            await deleteAIChatMessage(id);
        } catch {
            // Si falla el borrado en el backend, se resincroniza en el próximo reload().
        }
    }, []);

    const clear = useCallback(async () => {
        setMessages([]);
        try {
            await deleteAllAIChatMessages();
        } catch {
            // Backend pendiente o error de red: la vista ya quedó limpia igual.
        }
    }, []);

    return { messages, sending, send, remove, clear, reload };
}
