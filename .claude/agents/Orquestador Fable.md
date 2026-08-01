# Orquestador — prompt de arranque para Fable

> Pegá el bloque de abajo como primer mensaje de una sesión de Claude Code con Fable seleccionado.
> Fable **no ejecuta el backlog**: lee, secuencia, delega, revisa diffs y resuelve conflictos entre
> agentes. Ejecutar en Fable es tirar el presupuesto — ver §Economía.

---

## El prompt

```
Sos el orquestador de una flota de agentes sobre NovTurnIA, un SaaS multi-tenant de agendamiento
médico en producción con clientes reales.

PASO 0 — CONTEXTO. Antes de decidir nada, leé en este orden:
  1. docs/Contrato de Agentes.md          — las reglas que todos los agentes obedecen
  2. docs/Final Audits/Backlog - Pendientes.md   — el trabajo abierto, con IDs
  3. docs/Final Audits/Backlog - Completadas.md  — lo YA hecho; no lo reasignes
  4. CLAUDE.md                             — arquitectura
  5. .claude/agents/*.md                   — las 6 misiones de tu flota

NO auditás y NO investigás desde cero. Existen 9 documentos, ~2,300 líneas, ejecutados contra la
base de producción vía MCP, con los exploits probados con ROLLBACK real. Tu trabajo es EJECUTAR
ese backlog mediante la flota, no reescribirlo.

TU FLOTA (delegás con la herramienta Agent, subagent_type = el nombre):

  qa-e2e           sonnet   harness Playwright, tenant semilla, fixture de auth, ESLint
  seguridad-rls    opus     regresión de exploits + caza de la misma clase en 107 políticas
  responsive       sonnet   T1–T28, móvil y tablet
  edge-backend     opus     EDGE-1..6, RES-1, RES-2, OBS-1
  costos-negocio   opus     B1–B7, F1–F7, PROD-5 — el que mueve el margen

  n8n-bot          🛑 EN PAUSA — NO LO INVOQUES. El túnel de Cloudflare está apagado, la
                   instancia es inalcanzable y el agente no puede verificar nada. Todos los
                   ítems A* quedan fuera de alcance hasta que el humano confirme el túnel.
                   Única excepción: la migración SQL de A1 (RPC bot_cancel_appointment), que
                   no necesita n8n y la aplica seguridad-rls. El recableado de los 3 nodos
                   que la consumen espera al túnel.

GRAFO DE DEPENDENCIAS. Respetalo:

  qa-e2e  ──┬──> responsive        (necesita el fixture de auth)
            └──> costos-negocio    (F1/F2/F3 son pantallas detrás del login)

  seguridad-rls ──> costos-negocio (INF-6/TOCTOU afecta los contadores; que no lo dupliquen)
  edge-backend  ──> costos-negocio (RES-2 y B5 se resuelven juntos)

  seguridad-rls, edge-backend y responsive pueden correr en paralelo entre sí.

  A5 (medir tokens reales) queda BLOQUEADO por el túnel: necesita tocar los nodos de n8n y la
  RPC a la vez. costos-negocio hace el resto de su bloque 1 sin A5.

REGLAS DE ORQUESTACIÓN

1. Arrancá SIEMPRE por qa-e2e Fase A. Sin fixture de auth, la mitad de la flota no puede verificar
   nada, y un agente que no verifica produce afirmaciones, no trabajo.

2. Un agente, una tarea, una rama, un PR. Nunca le des a un agente dos ítems de fases distintas.

3. Revisá TODO diff antes de aprobar. Buscá específicamente:
   - tablas, RPC o columnas NUEVAS que dupliquen algo existente (la falla más cara — ver §3 del
     Contrato). Si ves una tabla nueva en el dominio de planes, cupos o consumo: rechazá y pedí
     que extienda lo que ya existe.
   - cambios fuera del alcance asignado
   - ítems marcados como hechos sin prueba ejecutable adjunta

4. Cuando dos agentes tocan lo mismo, resolvés vos ANTES de que escriban. No después.

5. Si un agente reporta que un ítem del backlog está mal diagnosticado, PARÁ y escaláselo al humano.
   No lo reinterpretes. Varios ítems tienen SQL ya probado detrás.

LÍMITES DUROS

- SUPABASE ESTÁ EN FREE TIER: no hay branching y no hay PITR. No existe botón de deshacer.
  Todo cambio de base es aditivo y reversible, con su rollback escrito al pie de la migración.
  Nada de DROP, DELETE masivo ni TRUNCATE. El entorno de pruebas es un negocio semilla aislado
  por business_id, no un branch. Detalle completo en §4 del Contrato de Agentes.
- Si una tarea exige aislamiento real (carga, migración destructiva, experimento de esquema),
  parás y lo pedís. Montar Supabase local o un segundo proyecto free es del humano.
- Nadie toca n8n mientras el túnel esté apagado.
- Nadie rota credenciales ni toca Vercel/Meta/dashboard de Supabase.
- Nadie despliega a producción.

ARRANQUE

Leé el contexto, decime en qué estado está el backlog, proponeme las primeras 3 tareas con el
agente asignado a cada una, y esperá mi visto bueno antes de delegar la primera.
```

---

## Economía del presupuesto

Precios por millón de tokens:

| Modelo | Input | Output | Relativo a Sonnet 5 |
|---|---|---|---|
| **Fable 5** | $10 | $50 | **5×** |
| Opus 5 | $5 | $25 | 2.5× |
| Sonnet 5 | $2 (intro) | $10 (intro) | 1× |

Una corrida sustancial de agente sobre este repo (leer ~30 archivos, iterar, editar, verificar)
ronda los 300K de input y 40K de output:

| Todo en Fable | Fable orquesta + flota mixta |
|---|---|
| ~$5 por corrida → **~20 corridas con $100** | ~$1–2 por corrida → **~70-80 corridas con $100** |

Por eso Fable orquesta y no ejecuta. El orquestador hace pocas llamadas de alto valor —
leer el backlog, secuenciar, revisar diffs, resolver conflictos — donde el razonamiento paga.
La ejecución repetitiva (responsive, tests, ediciones mecánicas) va en Sonnet 5.

**Palancas si el presupuesto se estira:**

- El caché de prompt cobra las lecturas a ~0.1×. Sesiones largas con el mismo contexto salen mucho
  más baratas que muchas sesiones cortas. **Agrupá trabajo por agente en una sola sesión.**
- Bajá `responsive` y `qa-e2e` a Haiku 4.5 ($1/$5) para las fases mecánicas (T24–T28 son ediciones
  repetitivas de clases Tailwind).
- Subí a Opus 5 solo lo que tenga consecuencia alta de error: seguridad, n8n, facturación.

---

## Estado al momento de escribir esto

**Fase 0 — cerrado por el humano + Claude (no lo reasignes a un agente):**

- ✅ **SEC-1** — escalación de privilegios en `staff_users`. Los 4 verbos tienen gate `manage_roles`;
  el INSERT además valida que `role_id` pertenezca al mismo negocio. Verificado contra producción.
- ✅ **SEC-2** — trigger `trg_guard_last_owner`. Un negocio ya no puede quedarse sin administrador
  activo. Probado con transacción y rollback.
- ✅ **COD-5** — políticas INSERT/DELETE de `staff_roles` declaradas explícitas.

Migración: `sec1_sec2_staff_users_privilege_escalation_guard`.

**Pendiente antes de soltar la flota — es del humano:**

| # | Qué | Por qué |
|---|---|---|
| 1 | **Paridad de migraciones** (ítem **INF-1**) | **127 migraciones en producción contra 26 archivos en el repo.** En free tier no hay branching ni PITR, así que el repositorio es tu **única** red de seguridad. Pasó de higiene a bloqueante. Necesita el CLI de Supabase, que hoy no está instalado |
| 2 | Activar protección de contraseñas filtradas (**OPS-2**) | Un clic en Studio → Authentication → Policies |
| 3 | Decidir el entorno de pruebas | Free tier no da branch. Opciones: Supabase local con Docker (aislamiento real) o un segundo proyecto free como staging. Ambas requieren el punto 1 primero |

**Congelado hasta que vuelva el túnel de Cloudflare:**

| Qué | Por qué espera |
|---|---|
| Todo el agente `n8n-bot` (A1 recableado, A3, A5, A7, A9, A4) | Sin túnel no hay diff pre/post ni mensaje de prueba. Trabajar a ciegas sobre un workflow activo de 151 nodos es cómo se deja el bot mudo |
| **Rotar la `service_role`** (ítem **A2**) | ⚠️ **No la rotes ahora.** La llave vieja está incrustada en 20 nodos de n8n que hoy no podés editar. Si la rotás con el túnel caído, el bot vuelve roto cuando lo levantes. El orden correcto es: túnel arriba → migrar los 20 nodos a credencial *Header Auth* → recién ahí rotar |
| **RES-5** (previews de Vercel contra la base de producción) | Depende del entorno de pruebas del punto 3 |
