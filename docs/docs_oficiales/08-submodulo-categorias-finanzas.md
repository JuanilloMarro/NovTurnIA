# Submódulo de Categorías Dinámicas de Finanzas — Spec de implementación

> **Estado:** ✅ **IMPLEMENTADO Y VERIFICADO** (2026-07-06). Migraciones aplicadas (`finance_categories_and_entry_fk`, `backfill_manage_finance_categories_permission`), `onboard-tenant` redeployado (v12), los 13 archivos de frontend compilan limpio y los endpoints REST (incl. joins embebidos) responden correctamente. **Pendiente de verificación manual:** clic-a-clic autenticado en el dashboard (crear/editar/activar/borrar categoría, registrar ingreso/egreso con categoría) — no se probó por no disponer de credenciales de login en esta sesión.
> **Decisiones del usuario:** aplica a **ingresos Y egresos**; permiso nuevo **`manage_finance_categories`**; UI **idéntica a Servicios** dentro del módulo de **Finanzas**.

## Contexto
Hoy las categorías de finanzas son **hardcodeadas**: `EXPENSE_CATS` en `src/components/Finance/financeUi.jsx` (insumo/renta/salario/…) y `expense_entries.category` es texto libre con default `'general'`. Los **ingresos no tienen categoría** (se clasifican por `source`). El objetivo: que **cada negocio gestione sus propias categorías dinámicas** de ingreso y egreso, con la misma seguridad/robustez del resto (RLS, triggers, audit), y un submódulo en Finanzas con panel dividido (lista izq + buscador/añadir arriba + form inline a la derecha).

**Patrón general:** clonar el stack de `services`/`supplies` (tabla → RLS → triggers → service layer → hook → UI panel dividido) reutilizando lo existente. Referencias exactas de código en la tabla del final.

---

## 1. Base de datos (migración `finance_categories_and_entry_fk`)

### 1.1 Tabla `finance_categories` (patrón de `supplies`)
```sql
CREATE TABLE public.finance_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('income','expense')),
  name        text NOT NULL,
  color       text,                       -- opcional (hex para el pill), nullable
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_fincat_biz_kind_name ON public.finance_categories (business_id, kind, lower(name));
CREATE INDEX idx_fincat_biz_kind_active ON public.finance_categories (business_id, kind, active);
```

### 1.2 RLS + grants (idénticos a `supplies`; incluye el gating de dunning `is_business_active()`)
```sql
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_categories_select ON public.finance_categories FOR SELECT
  USING (business_id = (SELECT get_user_business_id()));
CREATE POLICY finance_categories_insert ON public.finance_categories FOR INSERT
  WITH CHECK ((business_id = (SELECT get_user_business_id())) AND (SELECT is_business_active()));
CREATE POLICY finance_categories_update ON public.finance_categories FOR UPDATE
  USING ((business_id = (SELECT get_user_business_id())) AND (SELECT is_business_active()))
  WITH CHECK ((business_id = (SELECT get_user_business_id())) AND (SELECT is_business_active()));
CREATE POLICY finance_categories_delete ON public.finance_categories FOR DELETE
  USING ((business_id = (SELECT get_user_business_id())) AND (SELECT is_business_active()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_categories TO authenticated, service_role;
```

### 1.3 Triggers (clonan `supplies`: `set_updated_at_*` + `audit_*`)
```sql
CREATE TRIGGER set_updated_at_finance_categories BEFORE UPDATE ON public.finance_categories
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER audit_finance_categories AFTER INSERT OR UPDATE OR DELETE ON public.finance_categories
  FOR EACH ROW EXECUTE FUNCTION public.trigger_audit_log();
```

### 1.4 FK en asientos (income + expense)
```sql
ALTER TABLE public.income_entries  ADD COLUMN category_id uuid REFERENCES public.finance_categories(id) ON DELETE SET NULL;
ALTER TABLE public.expense_entries ADD COLUMN category_id uuid REFERENCES public.finance_categories(id) ON DELETE SET NULL;
CREATE INDEX idx_income_category  ON public.income_entries  (category_id);
CREATE INDEX idx_expense_category ON public.expense_entries (category_id);
-- Se CONSERVA expense_entries.category (texto) por compatibilidad con reportes actuales
-- (get_finance_summary / ExpenseSection). Los modales escriben category_id y, para egresos,
-- también category = name (back-compat) hasta migrar los reportes a category_id.
```

### 1.5 Seed + backfill (que ningún negocio quede vacío)
- Sembrar por negocio un set inicial **editable** (dinámico, no bloqueado):
  - expense: Insumos, Renta, Salarios, Servicios, Marketing, General, Otro.
  - income: Consulta/Servicio, Producto, Otro.
- Backfill best-effort de egresos existentes:
  `UPDATE expense_entries e SET category_id = fc.id FROM finance_categories fc WHERE fc.business_id=e.business_id AND fc.kind='expense' AND lower(fc.name)=lower(e.category);`
- El mismo seed debe correr en el alta de tenant (ver §2.4).

**Verificación DB (probe rollback):** crear categoría en negocio activo ✓; bloqueada en suspended (RLS) ✓; unique impide duplicado mismo kind ✓; borrar categoría deja `category_id=NULL` en asientos ✓.

---

## 2. Permiso `manage_finance_categories` (RBAC DB-driven)
1. `src/hooks/usePermissions.js` (~L72): `canManageFinanceCategories: !!perms.manage_finance_categories`.
2. `src/pages/Users.jsx`: checkbox del permiso en la sección Finanzas de la matriz (patrón de `manage_supplies`).
3. Backfill DB (migración): `UPDATE staff_roles SET permissions = permissions || '{"manage_finance_categories": <bool>}'` (true owner/admin, false resto) + actualizar el `DEFAULT` de `staff_roles.permissions`.
4. Edge `supabase/functions/onboard-tenant/index.ts`: `manage_finance_categories: true` en `OWNER_PERMISSIONS`, `false` en `SECRETARY_PERMISSIONS`; **redeploy**.

---

## 3. Service layer — `src/services/supabaseService.js` (clona bloque `services`, L96–162)
```js
export async function getFinanceCategories()                         // select * where business_id=getBID() order by kind,name
export async function createFinanceCategory({ kind, name, color })   // insert business_id:getBID(), active:true
export async function updateFinanceCategory(id, { name, color })     // update ...eq id ...eq business_id
export async function toggleFinanceCategoryActive(id, active)        // update {active}
export async function deleteFinanceCategory(id)                      // delete ...eq id ...eq business_id (FK SET NULL limpia asientos)
```
`getBID = () => useAppStore.getState().businessId` (L4–6). Doble-scope por `id` + `business_id` en toda mutación.

## 4. Hook — `src/hooks/useFinanceCategories.js` (clona `useServices.js`)
Retorna `{ categories, loading, reload, create, update, toggle, remove }`. **Copiar el fallback graceful** de `useServices.load` para `PGRST116`/`42P01` (tabla ausente → `[]`) + re-sort local. `categories` trae ambos kinds; el componente filtra.

---

## 5. Front — submódulo dentro de Finanzas

### 5.1 Tab en `src/pages/Finance.jsx`
- Importar `Tags` de `lucide-react`.
- `TAB_DEFS` (L55): `{ id: 'categorias', label: 'Categorías', icon: Tags }`.
- Destructurar `canManageFinanceCategories` de `usePermissions()` (L111).
- Render (L254+): `tab === 'categorias' && <CategoriesSection canManage={canManageFinanceCategories} />`.

### 5.2 `src/components/Finance/CategoriesSection.jsx` (clon de `src/pages/Settings.jsx`)
Panel dividido idéntico a Servicios:
- **Izquierda:** segmented control **Ingreso | Egreso** (filtra `kind`), buscador ("Buscar categoría..."), botón **Nuevo** (gated `canManage`), lista del kind activo (avatar inicial, nombre, dot activo/inactivo, color pill). Clases glass: `bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[24px] shadow-md`, pills `rounded-full`, focus `focus:ring-1 focus:ring-white`, glows de esquina `rgba(64,98,200,0.05)`.
- **Derecha:** form inline (no modal) con **Nombre** (`TextInput` de financeUi), **Tipo** (fijo al crear, badge al editar), **Color** (opcional), footer **Guardar** / **Activar-Desactivar** / **Eliminar** (confirm por `createPortal`, como Settings L537). Vacío = icono `Tags` + "Gestión de Categorías".
- Handlers como Settings L120–175 (`handleSave` branch new/update, `handleDelete`, `handleToggle`). Toasts: reusar `showSuccessToast`/`showErrorToast` o crear `showCategory*Toast` en `useToastStore`.

### 5.3 Integrar en los modales de registro
- `RecordExpenseModal.jsx`: reemplazar el `OptionWheel` de `EXPENSE_CATS` (L46–49) por uno con `useFinanceCategories()` filtrado `kind='expense' && active`. Enviar `category_id` (+ back-compat `category = <name>`). Manejar lista vacía ("Crea categorías en la pestaña Categorías").
- `RecordIncomeModal.jsx`: **agregar** campo Categoría (`OptionWheel`, `kind='income' && active`) → enviar `category_id` (hoy no envía, L22).
- **Display:** `ExpenseSection.jsx` (L4 `CAT_LABEL`, L30 pill) e `IncomeSection.jsx` → resolver nombre desde la categoría dinámica (join en query o mapa `id→{name,color}`). Pill puede usar `color`.
- `FinanceSummary.jsx`: el desglose `expense_by_category` sigue con el texto `category` (conservado); migrarlo a `category_id` (join en `get_finance_summary`) es **follow-up opcional**, no bloqueante.

---

## 6. Orden de implementación (para Sonnet)
1. Migración DB (§1) + verificación MCP. 2. Permiso en toda la pila (§2). 3. Service layer (§3) + hook (§4). 4. `CategoriesSection` + tab (§5.1–5.2). 5. Modales + display (§5.3). 6. Seed en onboard-tenant.

## 7. Verificación end-to-end
- **DB:** probes de rollback (§1.5) + advisor de seguridad sin nuevos ERROR.
- **App (preview):** tab Categorías → crear/editar/activar/borrar categorías de ingreso y egreso; verlas en los `OptionWheel` de los modales; registrar un ingreso y un egreso con categoría y verlos con su pill; negocio suspendido NO crea categorías (RLS); sin `manage_finance_categories` no aparece el botón Nuevo.
- **RBAC:** rol sin permiso ve la lista pero no gestiona; owner sí.

## Archivos
| Acción | Archivo |
|---|---|
| **Crear** | `src/hooks/useFinanceCategories.js`, `src/components/Finance/CategoriesSection.jsx` |
| **Modificar** | `src/services/supabaseService.js`, `src/hooks/usePermissions.js`, `src/pages/Users.jsx`, `src/pages/Finance.jsx`, `src/components/Finance/RecordExpenseModal.jsx`, `RecordIncomeModal.jsx`, `ExpenseSection.jsx`, `IncomeSection.jsx`, (opcional `FinanceSummary.jsx` + RPC `get_finance_summary`) |
| **DB** | 1 migración (tabla+RLS+triggers+FK+seed+backfill) + backfill permiso + redeploy `onboard-tenant` |
| **Referencia UI** | `src/pages/Settings.jsx` (split-panel), `src/components/Finance/financeUi.jsx` (ModalShell/TextInput/OptionWheel/ModalButtons), `src/hooks/useServices.js` (hook), `supabaseService.js` L96–162 (CRUD) |
