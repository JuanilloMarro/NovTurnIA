-- ============================================================================
-- DEC-1 · INF-3 · INF-4 (particiones) — endurecimiento de `history` y del
-- generador de particiones.
-- ----------------------------------------------------------------------------
-- DEC-1 (decisión del humano: ENDURECER). El detector de asimetría de verbos
--   (supabase/tests/security/verb_asymmetry_detector.sql) encontró que `history`
--   exige `is_business_active()` en DELETE pero NO en INSERT, y que
--   `history_insert` es alcanzable por REST autenticado.
--   Verificado antes de tocar nada:
--     · `src/` no hace NI UN INSERT a `history` (solo SELECT y DELETE).
--     · Ninguna función de la base inserta en `history`.
--     · El único escritor real es `wa-human-reply` (y el bot n8n), que usan
--       service_role y por lo tanto SALTAN la RLS.
--   Conclusión: la política INSERT para `authenticated` es superficie muerta.
--   Se retira (deny-by-default), que es más fuerte que agregarle un gate.
--
-- INF-3 (hacerlo ANTES que INF-4, y por eso va acá). `create_monthly_partition`
--   generaba cada mes 2 políticas con el patrón VIEJO —
--   `business_id = public.get_user_business_id()` sin envolver— así que arreglar
--   solo las políticas existentes se deshacía a los 30 días. Se corrige el
--   generador para emitir `(SELECT public.get_user_business_id())` (InitPlan:
--   se evalúa una vez por consulta, no una vez por fila) y para NO volver a
--   crear la política INSERT en las particiones de `history`.
--
-- INF-4 (parte prioritaria). Se re-emiten con InitPlan las políticas de las
--   particiones YA existentes de `history` y `audit_log` — las 6 que la
--   auditoría marcó como prioridad real por crecer sin techo.
--
-- NOTA sobre `audit_log`: se le CONSERVA la política INSERT de `authenticated`.
--   Sus escritores (`handle_audit_log`, `trigger_audit_log`) son SECURITY
--   DEFINER y saltan RLS, así que probablemente también sea superficie muerta —
--   pero si esa lectura fuera errónea, quitarla rompería el rastro de auditoría
--   en silencio. Queda anotado como candidato a endurecer en otra sesión, con
--   su propio probe. Acá solo se le mejora el InitPlan.
--
-- Free tier (Contrato §4): sin branch ni PITR. Cambio reversible; rollback al
-- pie. No se borran datos: solo se retiran/re-emiten políticas y se reemplaza
-- una función por su versión corregida.
-- ============================================================================

-- ─── INF-3 + DEC-1: corregir el GENERADOR ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_monthly_partition(parent_table text, target_date timestamp with time zone)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  start_date timestamptz := date_trunc('month', target_date);
  end_date   timestamptz := start_date + interval '1 month';
  part_name  text := parent_table || '_y'
                  || to_char(start_date, 'YYYY')
                  || 'm' || to_char(start_date, 'MM');
BEGIN
  -- Crear la partición si no existe
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.%I FOR VALUES FROM (%L) TO (%L)',
    part_name, parent_table, start_date, end_date
  );

  -- Habilitar RLS (idempotente)
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', part_name);

  -- Política SELECT: scoped por business_id. INF-3: el gate va envuelto en
  -- (SELECT ...) para que Postgres lo evalúe una sola vez por consulta
  -- (InitPlan) en vez de una vez por fila.
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                 part_name || '_select', part_name);
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (business_id = (SELECT public.get_user_business_id()))',
    part_name || '_select', part_name
  );

  -- Política INSERT: DEC-1 — ya NO se crea para las particiones de `history`.
  -- Nadie inserta en history como `authenticated` (el bot y wa-human-reply usan
  -- service_role y saltan RLS), así que la política era superficie innecesaria.
  -- Se conserva para `audit_log` por prudencia (ver nota de cabecera).
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                 part_name || '_insert', part_name);
  IF parent_table <> 'history' THEN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (business_id = (SELECT public.get_user_business_id()))',
      part_name || '_insert', part_name
    );
  END IF;

  RETURN part_name;
END;
$function$;

-- ─── DEC-1: retirar el INSERT de `authenticated` en history (padre + hijas) ──
-- El padre lleva la política `history_insert`; cada partición, la suya
-- `<particion>_insert`. Sin política, el verbo queda denegado por defecto para
-- `authenticated`, mientras service_role (que salta RLS) sigue escribiendo.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables
     WHERE schemaname = 'public'
       AND (tablename = 'history' OR tablename LIKE 'history\_%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.tablename || '_insert', r.tablename);
  END LOOP;
END $$;

-- ─── INF-4 (particiones): re-emitir las políticas existentes con InitPlan ────
DO $$
DECLARE r record;
BEGIN
  -- SELECT en particiones de history y audit_log
  FOR r IN
    SELECT tablename FROM pg_tables
     WHERE schemaname = 'public'
       AND (tablename LIKE 'history\_%' OR tablename LIKE 'audit\_log\_%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.tablename || '_select', r.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (business_id = (SELECT public.get_user_business_id()))',
      r.tablename || '_select', r.tablename
    );
  END LOOP;

  -- INSERT solo en particiones de audit_log (history ya no lleva; ver DEC-1)
  FOR r IN
    SELECT tablename FROM pg_tables
     WHERE schemaname = 'public' AND tablename LIKE 'audit\_log\_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.tablename || '_insert', r.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (business_id = (SELECT public.get_user_business_id()))',
      r.tablename || '_insert', r.tablename
    );
  END LOOP;
END $$;

-- ============================================================================
-- ROLLBACK (aplicar manualmente solo si es necesario; lo decide el humano):
-- ----------------------------------------------------------------------------
-- -- 1. Devolver la política INSERT de `authenticated` al padre y a las hijas:
-- CREATE POLICY history_insert ON public.history FOR INSERT TO authenticated
--   WITH CHECK (business_id = (SELECT public.get_user_business_id()));
-- DO $rb$ DECLARE r record; BEGIN
--   FOR r IN SELECT tablename FROM pg_tables
--            WHERE schemaname='public' AND tablename LIKE 'history\_%' LOOP
--     EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
--       WITH CHECK (business_id = (SELECT public.get_user_business_id()))',
--       r.tablename||'_insert', r.tablename);
--   END LOOP; END $rb$;
--
-- -- 2. Restaurar el generador con el patrón viejo (crea INSERT para history y
-- --    sin InitPlan): ver la definición previa en el historial de esta migración
-- --    o en `git show` de este archivo.
-- ============================================================================
