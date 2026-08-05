# Observaciones y Decisiones

> **Qué vive acá y qué no.**
> Este documento existe para que [Backlog - Pendientes](Backlog%20-%20Pendientes.md) contenga
> **solo tareas pendientes** y [Backlog - Completadas](Backlog%20-%20Completadas.md) **solo cosas hechas**.
> Acá van tres cosas que no son ninguna de las dos: **decisiones tomadas** (riesgos
> aceptados a conciencia), **trampas operativas** (cosas que muerden si no se saben) y
> **diseños propuestos** que todavía no son tarea porque falta elegir un camino.
> Si una entrada de acá se convierte en trabajo, se mueve a Pendientes y se borra de acá.

---

## 1. Decisiones tomadas — no son deuda, no son pendientes

### D1 · `service_role` en texto plano en 20 nodos de n8n (ex-A2)
**Decisión del dueño, 2026-08-05: riesgo aceptado. No se hará.**

n8n vive en Elestio, en un servidor aparte del dashboard y sin acceso externo. El dueño
evalúa impacto alto pero probabilidad muy baja, y no quiere complicarle a n8n el acceso a
la base. **No se tocan credenciales ni infraestructura.**

Matiz técnico, por si algún día se revisita: el vector real no es que alguien entre al
servidor, sino que **cualquiera con el API token de n8n obtiene la clave**, porque
`GET /workflows` devuelve el workflow completo con los headers en texto plano. Si ese token
se comparte o se filtra, la `service_role` se va con él. Si alguna vez se decide cerrarlo,
el orden es obligatorio: migrar los 20 nodos a credencial *Header Auth* **primero**, rotar
la clave **después**. Al revés deja el bot muerto.

---

### D2 · A6 · El modelo de Pro y Enterprise lo elige el dueño
**Decisión del dueño, 2026-08-05: retirada del backlog.** Hoy los tres planes corren sobre
Gemini (`2.5-flash-lite` en Basic, `2.5-flash` en Pro y Enterprise), así que la feature
`ai_reasoning` vende una escalera de tres niveles que en el bot son dos. Subir Enterprise a
un modelo superior **sube el costo por mensaje**, y con la facturación por mensaje entrando
el 1 de octubre esa es una decisión comercial, no técnica. El dueño elegirá los modelos.

### D3 · A15 · Rate limit en 10 mensajes/hora
**Decisión del dueño, 2026-08-05.** Estaba en 20/h por usuario+negocio. Se bajó a **10**
(`Flow - ¿API Limit Ok?`, condición `> 10`, bloquea del 11º). Aplicado.

---

## 2. Trampas operativas — cuestan caro si no se saben

### O1 · El `PUT` del API público de n8n resetea `availableInMCP`
Al actualizar un workflow por `PUT /api/v1/workflows/:id`:

- El API **rechaza** `settings` con propiedades fuera de su esquema
  (`binaryMode`, `timeSavedMode`, `availableInMCP` dan `400 must NOT have additional properties`).
- Pero si mandás solo las aceptadas, n8n **conserva** `binaryMode` y `timeSavedMode`… y
  **pone `availableInMCP` en `false`**.

Es decir: un `PUT` inocente **desconecta el workflow del servidor MCP** sin avisar. Hay que
reenviar `availableInMCP: true` explícitamente en cada `PUT`. Detectado y restaurado el
2026-08-05.

Combinación que sí funciona:
`{ executionOrder, timezone, callerPolicy, availableInMCP }`.

### O1-bis · ⚠️ Guardar el bot desde la UI le borra el modelo a Pro y Enterprise
**Reproducido dos veces el 2026-08-05.** Cada vez que el workflow del bot se guarda desde el
editor de n8n, `Modelo - Pro` y `Modelo - Enterprise` **pierden `modelName`** y quedan sin
modelo configurado, con el bot activo. Rastreado archivo por archivo: el valor estaba en los
payloads enviados por API y ya no estaba en la copia bajada minutos después.

Los que usan `models/gemini-2.5-flash-lite` (Basic y los tres de embedding) **nunca se
rompen**. Los que se rompen son justo los dos que usan `models/gemini-2.5-flash`: ese valor
no figura en el desplegable de esa versión del nodo, la UI lo muestra vacío y el guardado
persiste el vacío.

**Mitigación temporal:** re-afirmar `modelName` después de cada guardado desde la UI.
**Solución de raíz:** ver qué modelos ofrece realmente el desplegable con esa credencial y
mover Pro/Enterprise a uno que sí figure (enlaza con D2, que es del dueño).

### O2 · La ruta del CLI se rompe en Git Bash
`node scripts/n8n-api.mjs GET /workflows/<id>` falla con un 404 raro
(`Cannot GET /api/v1C:/Program%20Files/Git/workflows/...`): MSYS convierte el path que
empieza con `/`. Anteponer `MSYS_NO_PATHCONV=1`.

### O3 · `bot_cancel_appointment` **debe** llamarse por POST
Por GET, PostgREST ejecuta la función en una transacción de solo-lectura y el `UPDATE`
se descarta **en silencio** (200 OK sin efecto). Aplica a cualquier RPC que escriba.

---

## 3. Diseños propuestos — falta elegir camino, todavía no son tarea

### P1 · A5 · Medición de tokens — **camino elegido: reconciliación diferida**

**Decidido 2026-08-05.** Construido como `Tokens - Reconciliación (A5)` (`T44G3h5zETwtXJd2`),
creado **inactivo** a la espera de validación manual.

**La magnitud del error, medida (ejecución 403):**

| | tokens |
|---|---|
| Estimación que se registró en vivo | **441** |
| Consumo real (5 llamadas al modelo) | **9,245** |
| Subconteo | **8,804 — un factor de 21x** |

No es "~450 tokens por mensaje" como decía la auditoría: es **21 veces**.

**Cómo funciona el reconciliador** (6 nodos ejecutables):
`Cron 03:00` → lista ejecuciones exitosas del bot → filtra por cursor → pide cada ejecución
con `includeData=true` → suma el `tokenUsage` de **todos** los runs de los nodos `Modelo - *`
agrupado por negocio → `record_usage` con `p_messages: 0` (los mensajes ya se contaron en vivo)
y `p_direction: 'out'`.

- **Idempotencia:** cursor en `staticData.ultimaEjecucion`; solo procesa ids mayores, y el
  cursor avanza recién al final. Sin esto, una segunda corrida duplicaría los tokens.
- **URL base `http://localhost:5678`**, no el túnel: verificado que n8n corre local y se
  alcanza a sí mismo ahí. El túnel de Cloudflare rota por sesión y habría roto el workflow.
- **Reparto de responsabilidades:** el camino en vivo cuenta **mensajes** (inmediato, es lo
  que alimenta el corte de N3); el cron cuenta **tokens** (tolera retraso, solo sirve para margen).

⚠️ **A5a y A5b tienen que pasar juntos.** Mientras el bot siga estimando y el reconciliador
esté activo, los tokens se cuentan dos veces. Y si se pone la estimación en 0 antes de activar
el cron, se dejan de contar del todo.

---

### P1-bis · Los tres caminos que se evaluaron (histórico de la decisión)
**Lo medido (ejecución real id 403):** en **un solo turno**, `Modelo - Enterprise` se
ejecutó **4 veces** (el bucle del agente), con `tokenUsage` real de **8,208 prompt + 353
completion = 8,561 tokens**. La fórmula actual `(historial + mensaje + 1200)/4` modela
**una** llamada: no subcuenta ~450 tokens como decía la auditoría, **subcuenta un múltiplo**.

**El dato existe**, en
`runData[nodo].{run}.data.ai_languageModel[0][0].json.tokenUsage` → `{promptTokens, completionTokens, totalTokens}`.

**El obstáculo es de arquitectura, no de acceso:** ese dato viaja por la conexión
`ai_languageModel`, no por `main`. Las expresiones de n8n solo alcanzan salidas `main`
(`$('Modelo - X')` no lo ve), y el nodo Agente **no agrega** el consumo — corrió 1 vez
mientras el modelo corrió 4.

| # | Camino | A favor | En contra |
|---|---|---|---|
| **1** | **Reconciliación diferida** (recomendado) — workflow por cron que lea `GET /executions/:id?includeData=true`, sume el `tokenUsage` de todos los runs y corrija con `record_usage` | Números **exactos**; **cero latencia** para el cliente | El consumo se conoce con retraso |
| 2 | Auto-consulta en línea — tras el agente, un HTTP node contra `/executions/{{$execution.id}}` | Al día | Una llamada extra por turno; lee una ejecución aún en curso |
| 3 | Seguir estimando, pero corregir el factor sabiendo que el promedio real ronda 4 llamadas/turno | Trivial | Sigue siendo una estimación |

### P2 · A7 · Criterio para los 65 nodos que faltan
Los 28 aplicados salieron de una regla clara: `continueRegularOutput` **solo** donde es
estrictamente mejor que morir.

- **20 `httpRequestTool`** — el error vuelve al agente como resultado de la tool, así el
  modelo puede decir "no pude cancelar" en vez de que la ejecución muera y el cliente no
  reciba nada.
- **8 `supabase` terminales** — nadie consume su salida, así que continuar no puede
  corromper datos aguas abajo.

**Los 65 restantes alimentan a otros nodos**, y ahí la regla se invierte. Caso testigo:
`Paciente - Crear` — su `id` lo consumen los tools de crear y cancelar turno; continuar
tras un fallo agendaría contra un paciente `undefined`. Poner `continueRegularOutput` en
bloque cambia **un fallo ruidoso por corrupción silenciosa**.

Va de la mano con **A8**: mientras no exista Error Trigger, "continuar" también significa
"nadie se entera". El orden sensato es A8 primero, después el resto de A7.

---

### O4 · `plans.max_conversations` NO son conversaciones: es el presupuesto de mensajes salientes
Verificado leyendo la tabla `plans` en producción (2026-08-05). Los tres planes tienen el
**mismo ratio exacto**:

| Plan | `max_patients` | `max_conversations` | msg/cliente |
|---|---|---|---|
| basic | 70 | 1,050 | **15** |
| pro | 200 | 3,000 | **15** |
| enterprise | 450 | 6,750 | **15** |

`max_conversations = max_patients × 15`, que es el dimensionamiento del modelo de negocio
("máximo de mensajes para agendar a un cliente" × "máximo de clientes en el mes"). **No
existe ninguna columna de mensajes aparte**: `get_plan_limits` deriva de acá el techo de
salientes. El nombre de la columna engaña; el número es correcto. Renombrarla algún día
sería higiene, pero toca `get_plan_limits`, el gate de n8n y el frontend a la vez.

Confirmado también que existen en producción `businesses.extra_messages` y
`usage_counters.messages_out`, y que `Negocio - Obtener` hace `getAll` sin selección de
columnas — así que el gate de N3 recibe `extra_messages` de verdad, no un `undefined`
silencioso.

---

## 4. Correcciones a cifras de las auditorías

| Dónde decía | Cifra publicada | Cifra real | Por qué |
|---|---|---|---|
| A7 | 92 de 151 nodos sin `onError` | **93 de 137** | Los 151 incluyen 14 sticky notes, que no ejecutan nada |
| A1 | "los otros 17 tools sí acotan" | **Correcto** | Un barrido por URL da falso positivo (7 de 20): los demás pasan `business_id` en el *body* vía RPCs `bot_*`. Verificado por procedencia de parámetros |
| T21b | 226 `title=` nativos | 54 en ~25 archivos | 104 eran props de componentes propios |
