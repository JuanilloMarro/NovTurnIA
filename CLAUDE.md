# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Start dev server (hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

There is no test suite in this project.

## Architecture

**NovTurnIA** is a multi-tenant medical appointment scheduling dashboard. The stack: React 19 + Vite, Tailwind CSS (glass morphism design), Zustand for global state, Supabase (Postgres + Auth + Realtime).

### Multi-tenancy

All data is scoped by `business_id`, extracted from the URL query parameter `?bid=1`. The `BUSINESS_ID` constant is set in `src/config/supabase.js` and must be passed to every service call.

### Data flow

```
Pages → Components → Custom Hooks → supabaseService.js → Supabase
                                  ↘ useAppStore (Zustand)
```

- **Pages** (`src/pages/`) compose components and pass props down.
- **Custom Hooks** (`src/hooks/`) encapsulate all business logic and data fetching. Each domain has its own hook: `useAppointments`, `usePatients`, `useStats`, `useAuth`, `useRealtime`, `usePermissions`, `useNotifications`, `useUsers`.
- **Service layer** (`src/services/supabaseService.js`) contains all 52+ Supabase CRUD functions. All DB access goes here — never call the Supabase client directly from components or pages.
- **Global store** (`src/store/useAppStore.js`) holds only UI state (sidebar toggle, theme) and auth state (user, profile).

### Real-time

`useRealtime.js` sets up Supabase WebSocket channels for live appointment and patient updates, filtered by `business_id`. Real-time hooks are initialized at the page level and pass callbacks to refresh local state.

### Auth & permissions

- `useAuth.js` handles Supabase Auth (email/password). On sign-in it fetches the staff profile from `staff_users` (with `staff_roles` join).
- `usePermissions.js` derives a permissions object (`view_stats`, `manage_users`, etc.) from the role. Routes `/stats` and `/users` redirect if the user lacks the required permission.

### Database

Key tables: `appointments`, `patients`, `staff_users`, `staff_roles`, `phone_numbers`, `notifications`.
Materialized views `mv_business_stats` and `mv_patient_stats` are used for KPIs/charts (never aggregate raw tables for stats).
Appointments use ISO 8601 with timezone offset. Double-booking is prevented by a DB constraint — the service handles the violation error.

### Design system

The visual language is glass morphism inspired by iOS. Key CSS classes defined in `src/index.css`:
- `.glass-premium` — strong blur (32px) + saturate, for modals/drawers
- `.glass-morphism` — medium blur (12px), for cards
- `.glass-input` — input fields with focus state
- `.lg-orb` — decorative floating bubble

Tailwind is extended in `tailwind.config.js` with a `navy` color palette and `glass` semantic tokens (card, border, input, hover). Always use these tokens rather than raw colors.

### Deployment

Vercel. Config in `vercel.json`. Build output goes to `dist/`.
