Plan — Módulo Financiero (Finanzas) para NovTurnIA
Context
NovTurnIA es un dashboard SaaS multi-tenant de agendamiento. Hoy no existe módulo financiero, y el dato de "ingresos" en Stats es una suposición: los turnos (appointments) no guardan el precio; se infiere uniendo services.price (mutable) y además service_id se vuelve NULL al borrar un servicio (supabaseService.js:149). Esto hace el historial de ingresos poco confiable.

El objetivo es un módulo igual de robusto, seguro y bien estructurado que los demás (Pages → Hooks → Service → Supabase, con RLS, triggers, RPCs y todo interconectado), que cubra:

Ingresos reales confirmados por una persona ("el servicio se dio correctamente"), con monto-snapshot inmutable + ingresos manuales/ad-hoc.
Costos vía catálogo de insumos + receta por servicio (BOM) sector-agnóstica (barbero = dentista = doctor) + libro de egresos (incluye costos fijos).
Utilidad/márgenes calculados sobre datos guardados, no supuestos.
Decisiones del usuario: BOM sí (genérico para cualquier sector) · Ingresos = turnos confirmados + manuales · Acceso = Pro + Enterprise (gate por plan).

Convención reutilizada: multi-tenancy por business_id UUID + RLS business_id = get_user_business_id(); triggers trigger_set_updated_at() y trigger_audit_log()/handle_audit_log(); RPC de 1 round-trip estilo get_stats_dashboard; gate de plan vía plans.features JSONB + usePlanLimits().hasFeature() + FeatureLock (patrón de Ofertas).

1. Base de datos (Supabase) — DDL vía apply_migration
Todas las tablas: business_id uuid not null references businesses(id) on delete cascade, RLS habilitado, índice en business_id, triggers set_updated_at + audit. Registros financieros nunca se borran (integridad/auditoría): DELETE bloqueado en RLS → se usa status='void' (soft void). Catálogos (insumos, receta) sí permiten DELETE.

1.1 supplies (catálogo de insumos / ítems de costo — sector-agnóstico)
id, business_id, name, unit text default 'unidad' (unidad/ml/g/hora…), unit_cost numeric(12,2) default 0, category text (texto libre: insumo, material, medicamento…), active bool default true, notes, created_at, updated_at.

RLS: SELECT/INSERT/UPDATE/DELETE business-scoped. Índice (business_id, active).
1.2 service_supplies (receta/BOM — insumos que consume cada servicio)
id, business_id, service_id → services(id) on delete cascade, supply_id → supplies(id) on delete cascade, quantity numeric(12,3) default 1, created_at, updated_at. UNIQUE(service_id, supply_id).

Genérico: un servicio de dentista consume gasas/anestesia; uno de barbero, productos; una consulta médica, guantes (o nada → costo 0). Costo del servicio = Σ(quantity × supplies.unit_cost).
1.3 income_entries (libro de ingresos — snapshot inmutable)
id, business_id, source text default 'manual' check in ('appointment','manual','product'), appointment_id → appointments(id) on delete set null, service_id → services(id) on delete set null (solo referencia), patient_id → patients(id) on delete set null, description text not null (snapshot del nombre del servicio al momento), amount numeric(12,2) not null check (amount >= 0), quantity int default 1, payment_method text check in ('cash','card','transfer','other'), cost_snapshot numeric(12,2) (COGS calculado del BOM al confirmar → margen histórico), occurred_at timestamptz not null default now(), status text default 'confirmed' check in ('confirmed','void'), notes, created_by uuid → staff_users(id), voided_at, void_reason, created_at, updated_at.

Idempotencia: índice único parcial UNIQUE(appointment_id) WHERE source='appointment' AND status='confirmed' → un solo ingreso confirmado por turno.
RLS: SELECT/INSERT/UPDATE business-scoped; DELETE bloqueado. Índices (business_id, occurred_at), (business_id, status), (appointment_id).
1.4 expense_entries (libro de egresos/gastos — snapshot)
id, business_id, supply_id → supplies(id) on delete set null (referencia), category text default 'general' (insumo/renta/salario/servicios/marketing/otro), description text not null, amount numeric(12,2) check (amount>=0), quantity numeric(12,3) default 1, occurred_at timestamptz default now(), recurring bool default false, frequency text check in ('one_time','monthly') default 'one_time', payment_method, status text default 'confirmed' check in ('confirmed','void'), notes, created_by, voided_at, void_reason, timestamps.

RLS business-scoped; DELETE bloqueado. Índices (business_id, occurred_at), (business_id, category).
1.5 Alter appointments
Agregar delivered_at timestamptz (NULL = aún no confirmado como entregado). No se toca el enum status ni la validación anti-doble-booking. "Entregado" = delivered_at IS NOT NULL (y existe income confirmado vía appointment_id).

2. Triggers, validaciones y RPCs (procedimientos)
Triggers (reusar funciones existentes): set_updated_at en las 4 tablas; audit (trigger_audit_log) en income_entries, expense_entries, supplies, service_supplies → los cambios financieros aparecen automáticamente en el módulo Actividad. Trigger de validación BEFORE INSERT/UPDATE: amount >= 0, no permitir "des-anular" (void→confirmed), business_id coherente.

RPCs (PL/pgSQL, SECURITY DEFINER, scope forzado con get_user_business_id() — nunca confiar en param de business):

confirm_service_delivery(p_appointment_id, p_amount, p_payment_method, p_notes) — atómico: SELECT … FOR UPDATE del turno, verifica que sea del negocio, no cancelled/no_show, y delivered_at IS NULL; calcula cost_snapshot del BOM; inserta income_entries(source='appointment', …, description = nombre del servicio snapshot); setea appointments.delivered_at = now(); devuelve la fila. Lock evita doble-registro por carrera.
void_income_entry(p_id, p_reason) / void_expense_entry(p_id, p_reason) — soft void + voided_at/void_reason; si el income venía de turno, limpia appointments.delivered_at para permitir reconfirmar.
get_finance_summary(p_start, p_end, p_granularity) — 1 round-trip (estilo get_stats_dashboard): total_income, total_expenses, net_profit, margin_pct, serie temporal (día/semana/mes), income_by_method, expense_by_category, top_services_by_revenue (con margen usando cost_snapshot). Solo cuenta status='confirmed'.
Ingresos/egresos manuales y CRUD de catálogo/receta: inserts/updates directos protegidos por RLS desde el service layer (no requieren RPC).
"Por confirmar" (lista): query RLS en service layer — turnos con delivered_at IS NULL, status IN ('scheduled','confirmed'), date_start <= now(), sin income confirmado.
(Opcional) vista v_service_cost(service_id, business_id, total_cost) = Σ BOM, para mostrar costo/margen por servicio en el catálogo.
3. Permisos (RBAC) y gate por plan
Permisos (claves nuevas en staff_roles.permissions JSONB, siguiendo la convención de usePermissions.js): view_finance, confirm_delivery, record_income, record_expense, manage_supplies, void_finance, view_finance_reports.

Migración: agregar claves (default false) a roles existentes + otorgarlas al rol owner/admin.
Extender usePermissions.js: canViewFinance, canConfirmDelivery, canRecordIncome, canRecordExpense, canManageSupplies, canVoidFinance.
Agregar los toggles nuevos al editor de roles del módulo Usuarios (updateRolePermissions ya existe).
Gate por plan: migración que setea plans.features.finance = true para Pro y Enterprise. Front: usePlanLimits().hasFeature('finance'); envolver la página en FeatureLock feature="finance" requiredPlan="Pro" (patrón idéntico a Ofertas con dynamic_pricing). Ruta /finance en App.jsx protegida por canViewFinance.

4. Service layer — nuevas funciones en src/services/supabaseService.js
Todas usan getBID() + el patrón existente. Insumos: getSupplies/createSupply/updateSupply/deleteSupply/toggleSupplyActive. BOM: getServiceRecipe(serviceId), setServiceRecipe(serviceId, items[]). Ingresos: getIncomeEntries({start,end,filters}), recordIncome({...}) (manual), confirmServiceDelivery(...) (RPC), voidIncome(id, reason) (RPC), getUnconfirmedDeliveries(). Egresos: getExpenseEntries({...}), recordExpense({...}), voidExpense(id, reason) (RPC). Resumen: getFinanceSummary(start, end, granularity) (RPC).

5. Frontend (mismo patrón que los demás módulos, estilo glass de Ofertas)
src/pages/Finance.jsx ("Finanzas") con secciones/tabs: Resumen (KPIs ingresos/egresos/utilidad/margen + gráfico por período + top servicios + desglose por método/categoría), Por confirmar (turnos entregables → modal "Confirmar servicio" con monto editable [default = precio efectivo, offer-aware vía services_with_active_offer], método de pago, notas), Ingresos (ledger + registrar manual + anular), Egresos/Costos (ledger + registrar + recurrentes + anular), Insumos (catálogo CRUD + editor de receta/BOM por servicio). Envuelto en FeatureLock.
Hooks: src/hooks/useFinance.js (resumen + ingresos + egresos + acciones), src/hooks/useSupplies.js (catálogo + receta).
Componentes en src/components/Finance/: FinanceSummary, IncomeList, ExpenseList, SupplyCatalog, ServiceRecipeEditor, ConfirmDeliveryModal, RecordIncomeModal, RecordExpenseModal — reutilizando el lenguaje glass (paneles 4-esquinas, botones pill, dropdowns) ya establecido.
Integración con Turnos: en AppointmentDrawer.jsx agregar acción "Confirmar servicio / Registrar ingreso" cuando delivered_at es NULL y el turno no está cancelado/no_show; mostrar "Entregado · Q—" cuando ya está confirmado. Gated por canConfirmDelivery.
Navegación: NavItem nuevo en Sidebar.jsx (con Lock si !financeUnlocked).
6. Escenarios límite y riesgos (analizados)
Borrar un servicio: el income guarda description + amount (snapshot) y service_id ON DELETE SET NULL → el historial NO se corrompe. (Hoy sí se corrompe.)
Doble conteo: índice único parcial por appointment_id + delivered_at + lock en el RPC.
Anular vs borrar: financiero nunca se borra (DELETE bloqueado por RLS) → void + razón + voided_at; anular un income de turno libera delivered_at para reconfirmar.
Cross-tenant leak: todas las policies business_id = get_user_business_id() (sin USING(true)); RPCs SECURITY DEFINER re-verifican el negocio; test SQL de aislamiento entre 2 negocios.
Precio efectivo: el monto sugerido respeta ofertas activas (services_with_active_offer) pero es editable y se guarda el monto final real.
Moneda: GTQ única por negocio (numeric, sin multimoneda) — supuesto v1.
Backfill permisos: roles existentes obtienen las claves en false; sin permiso, el módulo no aparece y la ruta redirige.
Sector-agnóstico: insumos y receta son genéricos (unidad + costo unitario + cantidad), válidos igual para barbero/dentista/doctor; un servicio sin receta = costo 0 (sin romper márgenes).
Concurrencia/idempotencia: FOR UPDATE en el turno dentro del RPC.
Devoluciones/pagos parciales: v1 = anular y re-registrar (entrada de ajuste); multi-pago queda fase 2.
N8N/bot: no toca finanzas (solo humanos confirman) → sin cambios en el workflow.
Performance: índices (business_id, occurred_at, status); agregados por RPC con rango de fechas. MV mv_finance_monthly solo si hace falta a escala (fase 2; existe maquinaria ensure_future_partitions para reutilizar).
7. Secuencia de migraciones (al implementar)
Tablas + constraints + índices (supplies, service_supplies, income_entries, expense_entries) + appointments.delivered_at.
ALTER TABLE … ENABLE ROW LEVEL SECURITY + policies (DELETE bloqueado en ledgers).
Triggers set_updated_at + audit + función de validación.
RPCs confirm_service_delivery, void_income_entry, void_expense_entry, get_finance_summary (+ vista v_service_cost opcional).
Backfill staff_roles.permissions (claves nuevas) + grant al admin.
plans.features.finance = true para Pro/Enterprise.
get_advisors (security + performance) post-migración para validar 0 hallazgos.
8. Verificación end-to-end
Gate de plan: en Básico → FeatureLock (blur + upsell); en Pro/Enterprise → módulo completo.
Flujo ingreso: confirmar entrega de un turno → crea income_entries (status confirmed, snapshot), setea delivered_at, aparece en Resumen y en "Ingresos"; reconfirmar el mismo turno → bloqueado por idempotencia.
Robustez de snapshot: borrar el servicio del turno confirmado → el income conserva monto y descripción.
Costos/BOM: crear insumos, asignar receta a un servicio, ver costo y margen por servicio; registrar un egreso recurrente.
Anular: void de un income/egreso → sale del total y queda con razón; el turno vuelve a "por confirmar".
RLS: vía SQL (execute_sql) simular 2 negocios y confirmar que ninguno ve datos del otro.
Auditoría: los cambios financieros aparecen en el módulo Actividad (audit_log).
Permisos: un rol sin view_finance no ve el módulo ni la ruta; sin void_finance no puede anular.
Correr npm run build + get_advisors (sin hallazgos nuevos).
Alcance / Fases
Fase 1 (core): todo lo anterior excepto MV de escala y multi-pago.
Fase 2 (profundidad): mv_finance_monthly para escala, materialización mensual de egresos recurrentes vía pg_cron, exportación CSV, realtime (useRealtime), pagos parciales/devoluciones.