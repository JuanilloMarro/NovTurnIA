---
trigger: always_on
---

### 7.1 Tablas del Plan Pro

| Tabla | Uso |
|-------|-----|
| businesses | Datos del negocio, configuración |
| users | Pacientes (id = número de teléfono) |
| appointments | Turnos activos y cancelados |
| conversation_history | Historial del bot (solo lectura desde dashboard) |
| message_buffer | Buffer de mensajes (solo lectura desde dashboard) |

La tabla `appointments_basic` pertenece al Plan Basic — no existe en este proyecto y no debe referenciarse.

### 7.2 Columnas críticas
- `appointments.date_start` y `date_end` → `timestamp WITHOUT time zone`
- `users.id` → número de teléfono completo (ej: `50247989357`)
- Nunca crear triggers de timezone — causan conflictos con el dashboard

### 7.3 Migraciones
- Antes de sugerir un `ALTER TABLE`, avisa al usuario del impacto.
- Antes de sugerir un `DROP COLUMN`, confirma que ningún código lo referencia.
- Nunca sugiere `DROP TABLE` sin confirmación explícita del usuario.
