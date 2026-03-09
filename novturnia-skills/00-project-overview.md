# TurnIA — Visión General del Proyecto (v2)

## ¿Qué es TurnIA?
Dashboard web para gestión de turnos médicos. Se conecta al bot de WhatsApp únicamente a través de Supabase.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite |
| Estilos | Tailwind CSS |
| Navegación | React Router v6 |
| Estado global | Zustand |
| Gráficas | Recharts |
| Base de datos | Supabase (PostgreSQL) |
| Tiempo real | Supabase Realtime (websockets) |
| Hosting | Vercel (detecta Vite automáticamente) |

---

## Módulos del Dashboard

| Módulo | Ruta | Archivo |
|--------|------|---------|
| Turnos + Calendario | `/` | `pages/Calendar.jsx` |
| Pacientes | `/patients` | `pages/Patients.jsx` |
| Historial conversacional | `/patients/:id/history` | `pages/PatientHistory.jsx` |
| Estadísticas | `/stats` | `pages/Stats.jsx` |

---

## Estructura de Carpetas

```
turnia-dashboard/
├── index.html
├── vite.config.js
├── tailwind.config.js
├── package.json
└── src/
    ├── main.jsx              → entrada, Router
    ├── App.jsx               → layout global, sidebar
    ├── config/
    │   └── supabase.js       → cliente Supabase + BUSINESS_ID
    ├── store/
    │   └── useAppStore.js    → Zustand store global
    ├── hooks/
    │   ├── useAppointments.js → datos + realtime de turnos
    │   ├── usePatients.js     → datos + realtime de pacientes
    │   └── useStats.js        → métricas y estadísticas
    ├── services/
    │   └── supabaseService.js → todas las queries CRUD
    ├── components/
    │   ├── Sidebar.jsx
    │   ├── Topbar.jsx
    │   ├── Calendar/
    │   │   ├── CalendarWeek.jsx
    │   │   ├── CalendarEvent.jsx
    │   │   └── AppointmentDrawer.jsx
    │   ├── Patients/
    │   │   ├── PatientCard.jsx
    │   │   ├── PatientDrawer.jsx
    │   │   └── PatientSearch.jsx
    │   ├── Stats/
    │   │   ├── KpiCard.jsx
    │   │   └── ChartCard.jsx
    │   └── ui/
    │       ├── Modal.jsx
    │       ├── Badge.jsx
    │       ├── Button.jsx
    │       └── Skeleton.jsx
    └── pages/
        ├── Calendar.jsx
        ├── Patients.jsx
        ├── PatientHistory.jsx
        └── Stats.jsx
```

---

## Principios del Proyecto

1. **Multi-cliente** — `business_id` siempre desde la URL: `?bid=1`
2. **Tiempo real** — Supabase Realtime en turnos y pacientes, sin polling
3. **Sin lógica en páginas** — las páginas solo componen componentes, la lógica va en hooks
4. **Un hook por módulo** — `useAppointments`, `usePatients`, `useStats`
5. **Zustand para estado compartido** — sidebar abierto, modales, paciente seleccionado
6. **Tailwind puro** — sin CSS custom salvo variables de diseño en `index.css`

---

## Skills Disponibles

| Archivo | Cuándo leerlo |
|---------|--------------|
| `00-project-overview.md` | Siempre, antes de cualquier tarea |
| `01-supabase.md` | Al tocar queries, tablas, realtime |
| `02-design-system.md` | Al tocar estilos o componentes UI |
| `03-calendar.md` | Al tocar el calendario semanal |
| `04-appointments.md` | Al tocar CRUD de turnos |
| `05-patients.md` | Al tocar módulo de pacientes |
| `06-stats.md` | Al tocar gráficas y estadísticas |
| `07-deployment.md` | Al preparar deploy a Vercel |
