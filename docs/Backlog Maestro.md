# Backlog Maestro NovTurnIA — Índice

> **2026-07-25 — reestructurado.** Este documento dejó de acumular tareas: se partió en dos para que "completado" y "pendiente" nunca vuelvan a mezclarse ni a quedar desactualizados dentro de un mismo archivo gigante.

- 👉 **[Backlog Maestro - Completadas.md](Backlog%20Maestro%20-%20Completadas.md)** — todo lo que ya está hecho y verificado.
- 👉 **[Backlog Maestro - Pendientes.md](Backlog%20Maestro%20-%20Pendientes.md)** — todo lo que sigue abierto, priorizado P0→Futuras.

Ambos consolidan y reemplazan las secciones de tareas que estaban dispersas en `docs/audit_performance/` y en el resto de `docs/NovturnIA Infraestructure/` — cada ítem se verificó contra el código/DB real antes de clasificarse, así que un documento de auditoría viejo que decía "pendiente" pero ya estaba resuelto quedó movido a Completadas, no copiado a ciegas.

**Los documentos de auditoría por sector siguen siendo la fuente de detalle/evidencia** (no se duplican aquí): [Modelo de Negocio](Modelo%20de%20Negocio.md) · [WhatsApp Api](WhatsApp%20Api.md) · [Automatización Agente IA](Automatización%20Agente%20IA.md) · [Infraestructura Supabase](Infraestructura%20Supabase.md) · [Frontend](Frontend.md) · [Auditoria Tecnica Multi-Tenant](Auditoria%20Tecnica%20Multi-Tenant.md) · [Bot n8n - Puesta al Dia](Bot%20n8n%20-%20Puesta%20al%20Dia.md). El histórico de abril 2026 (pre-UUID, pre-Finanzas) vive aparte en [Completed_Tasks.md](../audit_performance/Completed_Tasks.md).

**Responsable:** **[IA]** = lo puede aplicar el asistente por MCP/API · **[TÚ]** = requiere Vercel/Supabase Studio/Meta/UI manual · **[MIXTO]** = ambos.

**Cadencia sugerida (semanal):** revisar advisors de Supabase (security+performance, 5 min) · confirmar que los crons corren sin error (`cron.job_run_details`) · repasar Pendientes.md y mover lo cerrado a Completadas.md con fecha y evidencia.
