# Finanzas v2 — Evaluación y Roadmap (2026-07-17)

> ## ✅ IMPLEMENTADO (2026-07-18)
> Todo el roadmap quedó construido y en producción (respetando la lista "Qué NO hacer"):
> - **DB (8 migraciones `finance_v2_*`):** `finance_settings` (meta), `payment_methods` (code/label/fee_pct/is_cash, seed automático por negocio + trigger en businesses), `payment_plans` + `income_entries.plan_id` + RPCs `record_plan_payment`/`get_payment_plans`/`cancel_payment_plan`, `staff_users.commission_pct` + `income_entries.staff_id/commission_pct` (snapshot vía trigger `income_staff_snapshot`) + `get_staff_production`/`set_staff_commission`, `cash_sessions` + `open/close_cash_session`/`get_cash_session_status`/`get_cash_sessions` (una abierta por negocio, esperado por métodos `is_cash`), `supplies.stock/min_stock` + trigger `expense_stock_sync` (compra suma, void resta) + consumo de receta en `confirm_income_validation` (void revierte), `expense_entries.template_id` + `materialize_recurring_expenses` + cron `finance-recurring-monthly` (día 1, 06:00 GT), `get_finance_projection`, `get_finance_summary` v2 (labels/fees/total_fees), `get_finance_pack(p_business_id)` (contexto IA, solo service_role). CHECKs de payment_method eliminados (validación contra la tabla).
> - **Frontend:** 9 submódulos (Resumen · Por confirmar · Ingresos · Egresos · **Por cobrar** · **Caja** · **Producción** · Inventario · Ajustes). Resumen con comparativas vs período anterior, meta con barra, proyección de cierre, margen real por servicio y neto tras comisiones de pago. Export CSV del período (contador). Búsqueda + "mostrar más" en libros. Modales con métodos configurables, staff ("Atendido por") y compra de insumo. Acciones a la izquierda de los tabs (nota de improvments.md).
> - **IA:** scope `finance_narrative` ("Salud financiera") en ai-insights v5 + renderer + sugerido del Asistente global en `/finance`.
> - **Verificación:** build ✓ · advisors (helpers internos revocados en M8) ✓ · probe transaccional con impersonación y rollback: 12/12 (stock, abonos/reabrir plan, caja esperado/diferencia, snapshot de comisión, producción, proyección, aislamiento cross-tenant) ✓.
> - **Pendiente consciente:** `appointments.staff_id` (atribución hoy es al cobrar — sembrará agendas por profesional), vouchers/recibos, botón "Crear oferta" desde content_offer.

> Pedido del usuario: "es como un libro pero digital... qué cosas podemos hacer para verlo más completo
> y funcional para doctores, odontólogos, barberos, salones — o dime por qué dejarlo como está".
> Relacionado con su propia nota en `improvments.md` §Finanzas: "buscar otro enfoque de módulo financiero...
> no tan generalizado tomando en cuenta que es multitenant, algo más funcional".

## Veredicto

**No dejarlo como está — pero tampoco rehacerlo.** La base v1 (doc "Planification Finance") es de lo más
sólido del sistema: ledger inmutable con snapshots, soft-void con razón, RLS estricta, idempotencia por turno,
categorías propias, gates por plan. Ese era el 20% difícil y ya está pagado. Lo que falta es la capa que
convierte un registro del pasado en una herramienta de decisión: hoy el módulo responde **"¿cuánto entró y
salió?"** y nada más. Un negocio de servicios tiene tres trabajos financieros reales, y el módulo hoy cubre
medio:

1. **Cobrar bien** — deudas/abonos de clientes, caja diaria. ❌ hoy no existe
2. **Pagar bien** — comisiones/producción por profesional, gastos fijos automáticos. ❌ hoy no existe
3. **Decidir** — márgenes reales, comparativas, proyección, alertas. 🟡 a medias (los datos están, no se muestran)

La sensación de "libro digital" viene exactamente de ahí.

## Lo que ya está bien (no tocar)

- Inmutabilidad y auditoría: snapshot de monto/descripción, `cost_snapshot`, void con razón, DELETE bloqueado.
- Flujo "Por confirmar" (`submit_income_validation` → `confirm_income_validation`) — humano confirma, nunca el bot.
- `finance_categories` por negocio (kind income/expense + color) — ya es multitenant-friendly.
- Los 4 KPIs + tendencia + desgloses con el lenguaje glass. La estética no es el problema.

## La brecha por vertical (job-to-be-done que hoy NO se puede hacer)

| Vertical | Su necesidad financiera #1 | ¿Hoy se puede? |
|---|---|---|
| **Odontólogo** | Tratamientos largos pagados en **abonos** (ortodoncia = 12+ cuotas): saldo por paciente, cuánto le deben | ❌ — el ingreso solo existe si ya se pagó completo |
| **Doctor/clínica** | **Producción por profesional** y reporte mensual limpio para su contador | ❌ producción / ❌ export |
| **Barbería** | **Caja diaria** (efectivo, apertura/cierre/diferencia) + **comisión por barbero** (40–60% por servicio) | ❌ / ❌ |
| **Salón de belleza** | Comisiones + **stock de productos** (venden retail) + caja | ❌ / 🟡 insumos sin stock / ❌ |
| Todos | "¿Cómo voy este mes vs el pasado? ¿Voy a llegar?" en 10 segundos | ❌ sin comparativas ni meta ni proyección |

Nota técnica clave: **`appointments` no tiene profesional asignado** (no hay `staff_id`). Toda la familia
"comisiones/producción por profesional" tiene ese prerequisito. Agregarlo además desbloquea a futuro la agenda
por profesional (multi-silla/multi-doctor), que es otra brecha del producto completo.

---

## Roadmap propuesto

### Nivel 1 — Quick wins (días c/u, sin migraciones grandes; suben la percepción de "completo" ya)

1. **Margen real por servicio.** `cost_snapshot` ya se guarda en cada ingreso confirmado y NO se muestra en
   ningún lado. "Servicios más rentables" debería mostrar ingreso *y* utilidad (amount − cost). Es el insight
   más valioso del módulo y ya está en la base. Cero migración.
2. **Comparativas en los KPIs.** Flecha ±% "vs período anterior" en Ingresos/Egresos/Utilidad/Margen
   (2ª llamada al RPC con el rango previo, o extender `get_finance_summary`). Coherente con lo que pediste
   para Stats ("todo más dinámico, mes en curso vs pasado").
3. **Meta mensual de ingresos.** Un número configurable por negocio + barra de progreso en Resumen
   ("Q34,500 de Q50,000 · 69% y quedan 9 días"). Barato y adictivo para el dueño.
4. **Gastos fijos automáticos.** Materialización mensual de `expense_entries.recurring` vía `pg_cron`
   (ya estaba en Fase 2 del plan original y en tu improvments.md). Sin esto la utilidad de cada mes nace mentirosa
   hasta que alguien recuerda registrar la renta.
5. **Exportar para el contador.** Botón "Exportar período" → CSV de ingresos+egresos (fecha, descripción,
   categoría, método, monto, estado). En GT casi todos tienen contador externo; hoy transcriben a mano.
   (El PDF bonito puede venir después; el CSV resuelve el 90%.)
6. **Métodos de pago configurables por negocio** (tu nota) + **fee % por método**: la comisión del POS (~5%)
   convierte "ingresos por método" en bruto vs neto real. Tabla `payment_methods` espejo de `finance_categories`.
7. **UX ya anotado en improvments.md:** filtros + paginación en Ingresos/Egresos/Por confirmar, acciones a la
   izquierda de los tabs, decimales/unidades de insumos.
8. **IA financiera en contexto.** El Asistente IA global ya sugiere KPIs/digest en `/finance`; agregar un scope
   `finance_narrative` (o enriquecer `kpi_narrative` con `get_finance_summary` completo) para "explicá mis
   finanzas del mes" con margen, categoría que más creció, etc. La infraestructura del Centro IA ya está lista.

### Nivel 2 — Las features que cambian la categoría del módulo (1–2 sprints c/u)

9. **Cuentas por cobrar + planes de pago (abonos).** LA feature dental, también sirve a salones (paquetes) y
   doctores (tratamientos). Tabla `payment_plans` (paciente, descripción, total, saldo, estado) + los abonos son
   `income_entries` ligados al plan. Vista "Por cobrar": saldo por paciente, "registrar abono", y borrador de
   WhatsApp de recordatorio (draft copiable, NUNCA envío automático — coherente con la filosofía del sistema).
   La recomiendo **primera** del nivel 2: es la brecha más dolorosa y no depende del prerequisito de staff.
10. **Comisiones / producción por profesional.** Prerequisito: `appointments.staff_id` (y/o `income_entries.staff_id`
    al confirmar). Config: % de comisión por staff (Enterprise: por staff×servicio). Reporte "Producción del
    período": por profesional → servicios, ingresos generados, comisión a pagar; un clic genera el egreso de
    pago. Killer para barberías/salones; en clínicas es "producción por doctor". Además siembra la agenda
    por profesional a futuro.
11. **Caja diaria (cierre de caja).** Tabla `cash_sessions`: apertura (monto inicial), movimientos en efectivo
    del día (ya están en los ledgers), cierre con conteo real y diferencia. El ritual diario #1 de barberías y
    salones; también ordena clínicas con recepción.
12. **Proyección desde la agenda** (el diferenciador que un ERP genérico no puede tener): ingresos proyectados =
    turnos futuros × precio efectivo (offer-aware) × tasa histórica de asistencia (Stats ya la tiene) − gastos
    fijos del mes → "cerrarías el mes en ~Q42,000". Nadie más tiene la agenda + el historial de no-show.

### Nivel 3 — Reenfoque de Insumos (tu nota: "enfoque actual inservible")

13. Reposicionar **Insumos → Inventario**: `stock` actual + `stock mínimo` + alerta de reposición; una compra es
    un egreso que suma stock; el consumo descuenta (vía receta si existe, o manual). Para salones (venden
    producto) y dentales (material caro) el stock es tangible; la receta BOM queda como refinamiento Enterprise
    para margen fino, no como el centro del submódulo.
    - Alternativa mínima si no quieren inventario: colapsar a "costo estimado por servicio" (un solo número
      editable por servicio) — mantiene el margen sin la fricción del catálogo.

## Qué NO hacer (a propósito)

- **Contabilidad formal** (partida doble, balance general, facturación electrónica FEL/SAT): es otro producto,
  regulado, y el contador del cliente ya lo resuelve. Este módulo es "las finanzas del dueño", no "la
  contabilidad del contador". El export CSV es el puente entre ambos.
- **Multi-moneda:** GTQ único. Complejidad alta, valor casi nulo en el mercado objetivo.
- **Conciliación bancaria / integraciones bancarias:** no hay APIs viables en GT para este segmento.
- **Nómina legal** (IGSS, ISR, aguinaldo): comisiones/producción sí; planilla legal no.
- **Pasarela de pagos online:** los vouchers manuales (nota "Recibos y formalización de pagos") cubren el 80%
  con 5% del esfuerzo; revisar más adelante.

## Gating por plan sugerido (coherente con Q599 / Q1,999 / Q3,999)

- **Pro:** comparativas, meta mensual, export CSV, métodos de pago configurables, gastos fijos automáticos,
  por cobrar básico (saldo por paciente + abonos).
- **Enterprise:** comisiones por profesional, caja diaria, proyección de cierre, inventario con alertas,
  IA financiera. (Las features "de equipo/escala" justifican el salto de precio.)

## Orden recomendado

**Fase A** = Nivel 1 completo (percepción de módulo vivo, esfuerzo bajo) →
**Fase B** = Por cobrar/abonos (#9) →
**Fase C** = `staff_id` en turnos + comisiones (#10) y caja diaria (#11) →
**Fase D** = proyección (#12) e inventario (#13).

Con Fase A+B, un odontólogo ya puede llevar TODO su flujo real en NovTurnIA; con C, barberías y salones
tienen su operación diaria completa. Ahí el módulo deja de ser "un libro digital" y pasa a ser el motivo
por el que alguien paga Pro.
