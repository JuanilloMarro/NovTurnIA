Estrategia de Testing para NovTurnIA

  Stack recomendado

  ┌───────────────────────────┬─────────────────────────────────────────────────────────┐
  │        Herramienta        │                           Rol                           │
  ├───────────────────────────┼─────────────────────────────────────────────────────────┤
  │ Vitest                    │ Unit + integration (nativo de Vite, configuración cero) │
  ├───────────────────────────┼─────────────────────────────────────────────────────────┤
  │ React Testing Library     │ Componentes React                                       │
  ├───────────────────────────┼─────────────────────────────────────────────────────────┤
  │ MSW (Mock Service Worker) │ Mockar llamadas a Supabase                              │
  ├───────────────────────────┼─────────────────────────────────────────────────────────┤
  │ Playwright                │ E2E de flujos completos                                 │
  ├───────────────────────────┼─────────────────────────────────────────────────────────┤
  │ k6                        │ Carga y estrés sobre Supabase                           │
  ├───────────────────────────┼─────────────────────────────────────────────────────────┤
  │ Lighthouse CI             │ Rendimiento del bundle                                  │
  └───────────────────────────┴─────────────────────────────────────────────────────────┘

  ---
  1. Pruebas Unitarias (Prioridad: Alta)

  Son las más rápidas de escribir y con mayor ROI dado que el proyecto tiene 52+ funciones en el service layer.

  Qué cubrir:
  - src/utils/ — formatDate, toISO, getUTCOffset, cálculo de slots de calendario
  - src/services/supabaseService.js — lógica de transformación de datos (con Supabase mockeado)
  - usePermissions.js — derivación de permisos desde el rol (lógica pura, sin side effects)
  - usePlanLimits.js — cálculo de límites según plan

  Ejemplo concreto:
  // test: toISO con distintas zonas horarias no pierde el offset
  // test: getUTCOffset devuelve el valor correcto para America/Mexico_City
  // test: usePermissions con rol "admin" devuelve todos los permisos en true
  // test: usePermissions con rol "viewer" bloquea manage_users

  ---
  2. Pruebas de Integración (Prioridad: Alta)

  Son las más valiosas para este proyecto porque el corazón es el service layer + hooks.

  Qué cubrir con MSW mockeando Supabase:
  - useAppointments — carga semanal, navegación, crear/cancelar
  - usePatients — paginación, búsqueda, visibilidad por plan
  - useAuth — login correcto, login fallido, carga de perfil, expiración de sesión
  - Double-booking constraint — simular el error de Postgres y verificar que el servicio lo maneja
  - Multitenancy — que todas las queries incluyan el business_id correcto

  Escenarios críticos:
  - Login con usuario sin rol asignado → ¿qué pasa?
  - Crear cita en slot ya ocupado → debe mostrar error específico
  - Usuario con plan Free intenta ver paciente nº 51 → bloqueado por usePlanLimits
  - Realtime desconectado → app sigue funcional sin crashear

  ---
  3. Pruebas de Componentes (Prioridad: Media)

  Con React Testing Library, sin levantar toda la app.

  Qué cubrir:
  - AppointmentDrawer — formulario válido/inválido, estados de loading
  - PatientCard — muestra datos correctos, acciones según permisos
  - FeatureLock — bloquea UI cuando la feature está desactivada
  - AccountStatusModal — variantes: expirado, suspendido, activo
  - WheelColumn (selector de hora) — scroll produce el valor correcto

  ---
  4. Pruebas E2E (Prioridad: Media — posponer hasta estabilizar la app)

  Con Playwright contra un entorno de staging con Supabase real.

  Flujos críticos a cubrir:
  1. Login → ver calendario → crear cita → confirmar cita
  2. Login como viewer → intentar ir a /users → redirigido
  3. Crear paciente → buscarlo → ver su historial → eliminarlo (GDPR)
  4. Admin: cambiar permisos de un rol → verificar que el efecto se aplica
  5. Sesión expirada → redirige a login sin perder la URL de retorno

  ---
  5. Pruebas de Rendimiento (Prioridad: Media)

  Lighthouse CI en el pipeline de Vercel:
  - Bundle size: el objetivo razonable es < 500kb gzip
  - First Contentful Paint < 1.5s
  - Time to Interactive < 3s

  Qué vigilar específicamente:
  - Recharts es pesado — verificar que no se carga en páginas que no usan stats
  - El supabaseService.js con 52+ funciones puede generar un chunk grande → code splitting

  ---
  6. Pruebas de Carga y Estrés (Prioridad: Baja — solo si se escala)

  Con k6 contra Supabase directamente (no la UI):

  - Carga normal: 50 usuarios concurrentes leyendo el calendario
  - Pico: 200 usuarios simultáneos creando citas (el constraint de double-booking aguanta?)
  - Estrés: Realtime con 100 conexiones WS abiertas — ¿se degrada el dashboard?
  - Resistencia: 8 horas de tráfico normal — ¿hay memory leaks en los canales realtime?

  ---
  Plan de implementación sugerido

  Semana 1-2:  Vitest + MSW setup → utils + usePermissions + useAuth
  Semana 3-4:  Tests de integración para useAppointments + usePatients
  Semana 5:    Playwright E2E para los 5 flujos críticos
  Semana 6:    Lighthouse CI en Vercel + revisión de bundle
  Posterior:   k6 solo si hay planes de escalar a múltiples negocios

  ---
  Mi recomendación principal

  Empieza por Vitest + MSW porque:
  1. Configuración mínima al ser nativo de Vite (mismo config)
  2. El service layer sin tests es el riesgo más alto — 52 funciones sin cobertura
  3. El escenario de double-booking y multitenancy son bugs silenciosos que solo los tests de integración detectan antes de que    
  lleguen a producción

  ¿Quieres que configure el entorno base de Vitest + MSW con los primeros tests para los escenarios más críticos?