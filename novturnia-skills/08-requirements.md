# TurnIA — Especificaciones y Requerimientos del Proyecto

## Propósito de este archivo
Define **qué debe construirse** en cada módulo. La IA debe leer este archivo antes de desarrollar cualquier funcionalidad nueva para entender el comportamiento esperado, no solo la implementación técnica. recuerda que el diseño es flexible para mantener la estética deseada en el 02-design-system.md.

---

## 1. MÓDULO CALENDARIO (`/`)

### Vista general
Calendario estilo Google Calendar con 4 vistas: **Hoy, Semana, Mes y Día**.
Por defecto abre en vista Semana.

### Vistas disponibles

| Vista | Descripción |
|-------|-------------|
| Hoy | Solo columna del día actual con sus turnos |
| Día | Columna de un día específico navegable |
| Semana | 7 columnas Lun–Dom con franja horaria 09:00–18:00 |
| Mes | Grilla mensual con indicadores de turnos por día |

### Ficha de turno (tarjeta dentro del calendario)
Debe ser minimalista. Muestra solo:
- Nombre del paciente (`users.display_name` o `+{user_id}` si no tiene nombre)
- Hora de inicio (`date_start`)
- Indicador de color según estado:
  - 🔵 Azul navy → confirmado
  - 🟡 Amarillo → pendiente
  - 🔴 Rojo suave → cancelado (semitransparente)

### Panel de detalle del turno (al hacer clic en la ficha)
Drawer lateral derecho con:
- Nombre completo del paciente
- Teléfono (`user_id`)
- Fecha y hora inicio → fin
- Estado actual con badge (pendiente / confirmado / cancelado)
- Campo `notif_24hs` — si la notificación fue enviada (solo lectura)
- Campo `confirmed` — toggle para confirmar/desconfirmar
- Botón **Confirmar turno** (si está pendiente)
- Botón **Cancelar turno** (cambia `status` a `cancelled`, no elimina)
- Botón **Editar** — abre modal de edición con fecha y hora modificables

> ⚠️ Solo se muestran campos que existen en la tabla `appointments` y `users`. La IA no puede inventar ni mostrar datos que no están en la base de datos.

### Crear turno (botón "+" en el calendario)
Modal con:
- Buscador de paciente (busca en `users` por nombre o teléfono)
- Selector de fecha
- Selector hora inicio (slots de 1h: 09:00 a 17:00)
- Selector hora fin (auto: inicio + 1h, modificable)
- Validación de conflicto de horario antes de guardar
- Al guardar: INSERT en `appointments` con `status: active`, `confirmed: false`

### Editar turno
Modal igual al de crear pero con los campos pre-llenados.
Solo permite cambiar: fecha, hora inicio, hora fin.
Al guardar: UPDATE en `appointments`.

### Cancelar turno
No elimina el registro. Hace UPDATE `status = 'cancelled'`.
El turno cancelado sigue visible en el calendario pero con estilo atenuado.

### Filtros del calendario
- Botones de vista: Hoy / Día / Semana / Mes
- Navegación: ‹ anterior | Hoy | siguiente ›
- Indicador de rango actual: "4 – 10 de marzo 2026"

---

## 2. MÓDULO PACIENTES (`/patients`)

### Vista general
Tabla/grilla de pacientes con buscador superior. Cada paciente se muestra como una fila o card con su avatar de iniciales.

### Card de paciente
Muestra:
- Avatar circular con iniciales (`display_name`) y color de fondo único por índice
- Nombre completo (`display_name`) o `+{id}` si no tiene nombre
- Número de teléfono (`+{user_id}`)
- Fecha de registro (`created_at`)
- Cantidad de turnos activos

### Buscador
Filtra en tiempo real por nombre o teléfono (debounce 300ms).

### CRUD completo

**Crear paciente:**
- Modal con campos: nombre, teléfono (id), email opcional
- El teléfono es el `id` — debe ser único
- INSERT en `users` con `business_id`

**Ver detalle:**
- Drawer lateral con toda la información del paciente
- Lista de sus últimos 5 turnos (fecha, hora, estado)
- Botón "Ver conversación" → navega a `/history?user={id}`

**Editar paciente:**
- Modal pre-llenado
- Solo permite editar `display_name`
- El teléfono (`id`) no es editable una vez creado

**Eliminar paciente:**
- Confirmación con dialog: "¿Eliminar paciente? Esta acción no se puede deshacer."
- DELETE en `users`
- Solo disponible para rol **Dentista**

### Métricas superiores
- Total de pacientes
- Pacientes nuevos este mes

---

## 3. MÓDULO HISTORIAL CONVERSACIONAL (`/history`)

### Layout
Dos paneles lado a lado:
- **Panel izquierdo (30%)** — lista de pacientes con buscador
- **Panel derecho (70%)** — conversación del paciente seleccionado

### Panel izquierdo — Lista de pacientes
- Cada paciente: avatar de iniciales + nombre + último mensaje (preview de 30 chars) + hora del último mensaje
- Ordenado por `created_at` del último mensaje descendente
- Buscador por nombre o teléfono
- El paciente seleccionado tiene fondo destacado

### Panel derecho — Conversación
Replica la estructura visual de WhatsApp manteniendo el design system glass:
- Fondo: gris muy claro con textura suave
- Mensajes del **paciente** (`role: 'user'`): burbuja derecha, fondo azul navy, texto blanco
- Mensajes del **bot** (`role: 'assistant'`): burbuja izquierda, fondo blanco/glass, texto oscuro
- Cada burbuja muestra: contenido del mensaje + hora (`created_at`)
- Auto-scroll al último mensaje al cargar o al cambiar de paciente
- Si el mensaje fue transcripción de audio, mostrar ícono 🎤 antes del texto: `🎤 [transcripción]`

> Los audios no se reproducen — se muestra la transcripción guardada en `content` con el ícono de micrófono.

### Estado vacío
Si no hay paciente seleccionado: ilustración central con texto "Selecciona un paciente para ver su conversación".

---

## 4. MÓDULO ESTADÍSTICAS (`/stats`)

### Gráfica principal — Tendencia de turnos
Gráfica de línea o área que muestra turnos atendidos.
Tiene 3 modos seleccionables: **Semanal / Mensual / Anual**.

**Lógica de color (semáforo):**
- Se compara el período actual con el período anterior del mismo tipo
- Si el total actual **≥ período anterior** → línea/área **verde** (`emerald`)
- Si el total actual **< período anterior** → línea/área **roja** (`rose`)
- El umbral de comparación se muestra como línea de referencia punteada

**Datos por modo:**
- Semanal: 7 puntos (Lun–Dom), comparado con la semana anterior
- Mensual: puntos por semana del mes, comparado con el mes anterior
- Anual: 12 puntos (Ene–Dic), comparado con el año anterior

### KPI Cards (fila superior)
| KPI | Fuente | Descripción |
|-----|--------|-------------|
| Pacientes totales | `users` | COUNT total del business |
| Turnos este mes | `appointments` | COUNT con `date_start` del mes actual, `status: active` |
| Turnos esta semana | `appointments` | COUNT de la semana actual, `status: active` |
| Tasa de confirmación | `appointments` | % de turnos con `confirmed: true` del mes |
| Cancelaciones este mes | `appointments` | COUNT con `status: cancelled` del mes |
| Pacientes nuevos este mes | `users` | COUNT con `created_at` del mes actual |

### Gráfica secundaria — Estado de turnos (Donut)
PieChart con 3 sectores: Confirmados / Pendientes / Cancelados del mes actual.

### Gráfica terciaria — Pacientes nuevos por mes
BarChart con los últimos 6 meses. Barras azul navy.

---

## 5. ROLES Y PERMISOS

### Roles disponibles
| Rol | Descripción |
|-----|-------------|
| `dentist` | Acceso completo a todos los módulos |
| `secretary` | Acceso a Calendario, Pacientes e Historial. Sin acceso a Estadísticas ni Configuración |

### Tabla de permisos por módulo
| Módulo | Dentista | Secretaria |
|--------|----------|-----------|
| Calendario — ver | ✅ | ✅ |
| Calendario — crear turno | ✅ | ✅ |
| Calendario — editar turno | ✅ | ✅ |
| Calendario — cancelar turno | ✅ | ✅ |
| Pacientes — ver | ✅ | ✅ |
| Pacientes — crear | ✅ | ✅ |
| Pacientes — editar | ✅ | ✅ |
| Pacientes — eliminar | ✅ | ❌ |
| Historial — ver | ✅ | ✅ |
| Estadísticas | ✅ | ❌ |
| Configuración / Roles | ✅ | ❌ |

### Implementación
- El rol del usuario activo se guarda en `localStorage` como `turnia_role` al hacer login (futuro módulo de auth).
- Mientras no haya auth implementado, el rol se simula desde la URL: `?bid=1&role=secretary`
- Los elementos sin permiso deben ocultarse del sidebar y mostrar redirect a `/` si se accede por URL directa.
- La lógica de permisos va en un hook `usePermissions()` que retorna booleanos: `canDelete`, `canViewStats`, etc.

```javascript
// hooks/usePermissions.js
export function usePermissions() {
  const role = new URLSearchParams(window.location.search).get('role') || 'dentist';
  return {
    canDelete:    role === 'dentist',
    canViewStats: role === 'dentist',
    canManageRoles: role === 'dentist',
    role,
  };
}
```

---

## 6. FLUJOS IMPORTANTES

### Flujo: Crear turno desde el dashboard
1. Usuario hace clic en "+" o en un slot vacío del calendario
2. Se abre modal con fecha pre-llenada si hizo clic en un slot
3. Usuario busca y selecciona paciente
4. Sistema verifica disponibilidad del slot en Supabase
5. Si hay conflicto → muestra error "Ya existe un turno en ese horario"
6. Si está libre → INSERT en `appointments`
7. Supabase Realtime dispara actualización → el turno aparece en el calendario sin recargar la página

### Flujo: Cancelar turno
1. Usuario abre el drawer de detalle del turno
2. Hace clic en "Cancelar turno"
3. Aparece dialog de confirmación
4. Al confirmar → UPDATE `status = 'cancelled'`
5. El turno permanece visible en el calendario con estilo atenuado (no desaparece)
6. Realtime actualiza el calendario automáticamente

### Flujo: Ver conversación de un paciente
1. Desde el módulo Pacientes, usuario hace clic en "Ver conversación" en el drawer del paciente
2. Navega a `/history?user={id}`
3. El módulo historial carga con ese paciente pre-seleccionado en el panel izquierdo
4. La conversación se muestra automáticamente en el panel derecho

### Flujo: Realtime en calendario
1. El bot de WhatsApp crea un turno en Supabase (desde N8N)
2. Supabase Realtime emite evento `INSERT` en la tabla `appointments`
3. El hook `useAppointments` recibe el evento y recarga los turnos del período visible
4. El nuevo turno aparece en el calendario del dashboard sin que el usuario tenga que recargar

### Flujo: Permisos — acceso denegado
1. Usuario con rol `secretary` intenta acceder a `/stats` directamente por URL
2. El componente de la página verifica `canViewStats` del hook `usePermissions()`
3. Si es `false` → redirige a `/` con React Router `<Navigate>`
4. El ítem de Estadísticas no aparece en el sidebar para ese rol

---

## 7. RESTRICCIONES GLOBALES

- **Datos mostrados:** Solo se muestra información que existe en las tablas `appointments`, `users` y `conversation_history`. La IA no debe inventar campos ni asumir datos externos.
- **Sin eliminación física de turnos:** Cancelar = UPDATE status. Nunca DELETE en appointments.
- **Zona horaria:** Siempre `America/Guatemala` (UTC-6) para mostrar fechas y horas al usuario.
- **Paciente sin nombre:** Si `display_name` es null, mostrar `+{user_id}` en todos los módulos.
- **Transcripciones de audio:** Se muestran con ícono 🎤 en el historial. No hay reproductor de audio.
- **Multi-cliente:** Todo siempre filtrado por `business_id` desde la URL `?bid=`.
