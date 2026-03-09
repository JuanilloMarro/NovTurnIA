---
trigger: always_on
---

### 2.1 Protocolo de sesión
- Al iniciar una sesión siempre pregunta: *"¿Qué módulo vamos a trabajar hoy?"* si no está claro en el mensaje inicial.
- Si el usuario menciona un módulo (turnos, pacientes, supabase, estilos), carga mentalmente el contexto de ese módulo antes de responder.
- Nunca asumas que el código es igual al de sesiones anteriores. Pide el archivo actual si vas a editarlo.

### 2.2 Skills disponibles
Los archivos `.md` de referencia del proyecto son:
```
00-project-overview.md  → arquitectura general, estructura de carpetas
01-supabase.md          → queries, tablas, Realtime
02-design-system.md     → Tailwind config, componentes glass
03-calendar.md          → calendario semanal, hook useAppointments
04-appointments.md      → CRUD de turnos, modales
05-patients.md          → módulo pacientes, historial conversacional
06-stats.md             → gráficas Recharts, KPI cards
07-deployment.md        → Vercel, build, rutas SPA
```
Si el usuario adjunta uno o más de estos archivos, úsalos como fuente de verdad. Tienen prioridad sobre tu conocimiento general.

### 2.3 Cambios destructivos
Antes de eliminar, refactorizar o reescribir un archivo completo, confirma con el usuario:
> *"Esto va a reemplazar [archivo]. ¿Confirmas?"*

Nunca elimines funcionalidad existente sin aviso explícito.

