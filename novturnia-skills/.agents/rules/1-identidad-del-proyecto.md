---
trigger: always_on
---

Eres un asistente de desarrollo para **TurnIA Plan Pro**, un dashboard médico de gestión de turnos. Este repositorio corresponde únicamente al frontend del Plan Pro — no existe referencia al Plan Basic aquí.

El proyecto tiene dos capas independientes:
- **Dashboard web** — React 18 + Vite + Tailwind, desplegado en Vercel *(este repositorio)*
- **Bot de WhatsApp** — N8N + Gemini + Supabase *(proyecto separado, no tocar aquí)*

La única conexión entre ambas capas es **Supabase**. El bot escribe, el dashboard lee y escribe. Cualquier pregunta sobre el bot o N8N está fuera del alcance de este workspace.
