# NovTurnAI — Tareas Pendientes n8n
> Actualizado: 2026-04-19 (v41 — BUG-18 resuelto; audio transcription + auto-cancel + dashboard notifications incorporados; BUG-21/22 detectados)
> Prioridades: 🔴 Crítico · 🟠 Alto · 🟡 Medio · ⏭ Decisión tomada
> Completadas → ver historial al final del documento

---

## Pendientes activos

| # | Bug | Prioridad | Estado |
|---|-----|-----------|--------|
| BUG-21 | `Groq Chat Model2` sin `model` — Text Classifier O falla en runtime | 🔴 | Pendiente |
| BUG-22 | Notificaciones URGENCIA/QUEJA/PIDE_HUMANO/DOMICILIO con `type: error_ia` — indistinguibles en dashboard | 🟠 | Pendiente |
| BUG-15 | `Add History` (x12) sin `onError` — fallo silencioso si Supabase rechaza INSERT | 🟡 | Sin confirmar en v41 |
| N-06 | Billing Gemini/Groq compartido | 🟡 | Futuro |

---

## 🔴 Críticos
---

## 🟠 Altos


## 🟡 Medios

### N-06 🟡 Billing Gemini/Groq compartido — sin visibilidad por cliente

**Problema:** Todos los negocios usan las mismas credenciales. No hay forma de saber cuánto consume cada cliente.  
**Ventana:** Cuando haya 5+ clientes activos.

---

## ⏭ Decisiones tomadas — no aplica

| Item | Decisión |
|------|----------|
| BUG-4 `Activate Handoff` sin `onError` | Aceptado — UPDATE simple boolean false→true, riesgo de fallo prácticamente nulo. |
| BUG-16 `Number($json) > 5` en rate limit | Aceptado — comportamiento depende de si RPC retorna escalar; threshold=5 msg/hora es conservador. |
| Limit historial en 6 items | Aceptado — 6 es suficiente para el contexto del agente; 10 no aporta mejora significativa. |
| `Google Gemini Chat Model1` sin `modelName` | Mismo comportamiento que BUG-04 — n8n no serializa el modelo default; funciona en runtime. |
| N-05 Gmail OAuth2 | Descartado — notificación al dashboard (`error_ia`) cubre el aviso al operador. |

| Item | Decisión |
|------|----------|
| Recordatorios 24hs deshabilitados | Costo de WhatsApp templates. Nodos `disabled` intencionalmente. |
| Tokens Meta/Groq hardcodeados | Sin dashboard público, no hay vector de ataque real. |
| Billing separado por negocio | Futuro, no urgente para MVP. |
| BUG-09 doble historial en handoff | **No es bug.** `Human Takeover?` y `Add History` son paths mutuamente excluyentes. Correcto. |

---

## ✅ Historial de bugs resueltos

### v41 — 2026-04-19

| Bug | Fix | Verificado |
|-----|-----|-----------|
| BUG-18 `Update Cancel` `business_id` en SET no WHERE | `business_id` movido a filtros WHERE + nodo repurposado para auto-cancelación programada | ✅ JSON v41 |
| N-07 URGENCIA/QUEJA/PIDE_HUMANO/DOMICILIO sin notificación ni handoff | `Create Notification Dashboard` + `Activate Handoff` agregados al path de los 4 casos | ✅ JSON v41 |

### v38/v39 — 2026-04-19

| Bug | Fix | Verificado |
|-----|-----|-----------|
| BUG-17 `Update Cancel` sin `cancelled_at` | Campo `cancelled_at: $now.toISO()` agregado | ✅ JSON v38 |
| BUG-20 `Update Event` sin `cancelled_at` | Campo `cancelled_at: $now.toISO()` en S/B/O | ✅ JSON v39 |
| BUG-19 `Schedule Trigger` + `Get many rows` huérfanos | `Schedule Trigger` deshabilitado hasta completar la feature | ✅ JSON v38 |

### v37 — 2026-04-19

| Bug | Fix | Verificado |
|-----|-----|-----------|
| BUG-1 Sort historial por `id` (no cronológico) | Nodo `Sort` cambiado a `fieldName: created_at` | ✅ JSON v37 |
| BUG-2 `Get 3hs History` sin límite en query | `limit: 20` configurado en el nodo Supabase | ✅ JSON v37 |
| BUG-4 `Activate Handoff` sin `onError` | ⏭ Decisión: no handlearlo — UPDATE booleano de riesgo mínimo | ⏭ Aceptado |

### v32 — 2026-04-19

| Bug | Fix | Verificado |
|-----|-----|-----------|
| BUG-04 Agentes Gemini sin `modelName` | Confirmado operativo en producción. n8n no serializa `modelName` cuando es el valor por defecto del plugin LangChain — comportamiento esperado, no bug de runtime. JSON seguirá sin mostrarlo. | ✅ Bot funcional |
| N-04 Rate limiting deshabilitado | Nodos `Supabase Request API LR`, `Limit`, `Response API Limit Range` habilitados (`disabled: false`) en v32 | ✅ JSON v32 |

### v28 — 2026-04-18

| Bug | Fix | Verificado |
|-----|-----|-----------|
| BUG-01 `Get Business` operation incorrecta | Cambiado a `getAll` + `limit: 1` + filtro `phone_number_id` | ✅ JSON v28 |
| BUG-02 `message_buffer` sin RLS SELECT/INSERT | Políticas creadas en Supabase | ✅ MCP confirmado |
| BUG-03 `history` sin RLS INSERT | Política `history_insert` creada | ✅ MCP confirmado |
| BUG-05 `appointment_id` número vs UUID | `$fromAI` cambiado a `string` con descripción UUID | ✅ JSON v28 |
| BUG-06 Switch2 lowercase vs title case | `rightValue` corregidos a "Salud y Bienestar" etc. | ✅ JSON v28 |
| BUG-07 `gemini-2.5-flash-lite` inexistente | Cambiado a `gemini-2.0-flash-lite-001` | ✅ JSON v28 |
| BUG-08 `notif_24hs` string vs boolean | `keyValue` cambiado a `={{ true }}` | ✅ JSON v28 |
| BUG-09 Doble guardado en handoff | No era bug — paths mutuamente excluyentes | ✅ Aclarado |
| BUG-10 `useCustomSchema` sin schema | Desactivado | ✅ Confirmado |
| BUG-11 `business_id` nullable en buffer | `NOT NULL` + FK ejecutado en Supabase | ✅ Confirmado |
| BUG-12 `expires_at` no filtrado en buffer | `pg_cron` job activo (schedule ID 5) — limpia cada minuto | ✅ 2026-04-18 |
| BUG-13 Switch catch-all frágil | Corregido con fallback explícito | ✅ Confirmado |

### v27 — anteriores

| Fix | Descripción |
|-----|-------------|
| `message_buffer.id` BIGSERIAL | `Math.max(id)` funciona correctamente |
| Política `buffer_delete` | DELETE en buffer operativo |
| `status: "active"` en Create Event | Alineado con enum `appt_status` |
| `patient_phones` incluye `business_id` | Evita cruce entre negocios |
| Revenue protection | `They pay?` verifica `plan`, `active`, `plan_expires_at` |
| 3 AI Agents multi-sector | Salud, Belleza, Otro con prompts dinámicos |
| Handoff controlado | URGENCIA/QUEJA/PIDE_HUMANO/DOMICILIO notifican Gmail |
| Historial 10 mensajes | `Limit maxItems = 10` |
| Buffer multi-tenant | `business_id` en Create/Get/Delete del buffer |
