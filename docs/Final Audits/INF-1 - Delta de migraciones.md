# INF-1 · Delta exacto de migraciones

> Generado el 2026-08-01 comparando `supabase_migrations.schema_migrations` de producción contra `supabase/migrations/` del repositorio.
> **Para qué sirve:** INF-1 decía "127 en producción contra 27 en el repo" sin decir *cuáles*. Con la lista nombrada, recuperarlas deja de ser un proyecto difuso y pasa a ser una tarea con final.

## El número real

| | |
|---|---|
| Migraciones en producción | **141** |
| Archivos en `supabase/migrations/` | **39** |
| Coinciden por nombre | **21** |
| **Producción sin contraparte en el repo** | **120** |
| Archivos del repo sin contraparte en producción | **18** |

## Cómo leer las dos direcciones del delta

**Las 120 que faltan** son el problema real: un `supabase db reset` desde este repositorio **no reconstruye producción**. Incluye Finanzas v2 entera, el módulo de Centro IA, los vouchers, el Pipeline, la agenda avanzada, el dunning y los triggers de límite de plan.

**Los 18 archivos que sobran** no son un error: son los `001_` a `023_` numerados a mano, de antes de que existiera el seguimiento de migraciones. Su contenido **sí está en producción**, aplicado por fuera del registro. No hay que borrarlos, pero tampoco cuentan como respaldo: no se pueden re-aplicar en orden.

## Por qué esto importa más que de costumbre acá

Sin branch ni PITR (free tier), el repositorio es la **única** red de seguridad que existe. Y ya causó un daño concreto: un diagnóstico de esta misma auditoría concluyó que `get_stats_dashboard` no devolvía dos campos, leyendo un archivo del repo que estaba ~100 migraciones atrasado. En producción **sí los devolvía**. La migración escrita para "arreglarlo" se eliminó antes de aplicarse; de haberse aplicado, habría sobrescrito la función buena.

## Cómo cerrarlo

Requiere el CLI de Supabase y la contraseña de la base — por eso sigue siendo `[TÚ]`:

```bash
supabase link --project-ref kwpaaqdkklwwfslhkqpb
supabase db pull            # trae el esquema real como una migración de línea base
supabase migration list     # confirma que local y remoto queden parejos
```

`db pull` genera **una** migración de línea base con el esquema completo, que es lo correcto acá: reconstruir 120 migraciones históricas una por una no aporta nada frente a un baseline que sí reproduce el sistema. Las 15 migraciones nuevas (de `20260728…` en adelante) ya están versionadas a mano y quedan encima de esa línea base.

## Escala de lo que hay que respaldar

Medido en producción: **50 tablas · 100 funciones · 116 políticas RLS · 52 triggers · 181 índices · 6 enums · 12 crons · 72 particiones**.

---

## Las 120 migraciones que faltan

### marzo 2026  (7)

- `20260324000255`  recreate_notification_triggers
- `20260324000359`  fix_notification_trigger_time
- `20260324002204`  fix_notification_trigger_timezone_v2
- `20260324003116`  add_bot_toggle_notifications
- `20260324003413`  fix_notification_types_for_toasts
- `20260324004354`  clean_and_readd_triggers_v3
- `20260324004702`  fix_rpc_and_trigger_conflict

### abril 2026  (24)

- `20260414165353`  tenant_lifecycle_plan_status
- `20260414182046`  fix_validate_appointment_trigger
- `20260416180811`  fix_audit_log_type_cast_and_remove_duplicate_trigger
- `20260416181027`  services_rls_write_policies
- `20260416181731`  appointments_add_rescheduled_at
- `20260416182322`  businesses_rls_update_policy
- `20260416231947`  fix_audit_log_trigger_extract_business_id
- `20260416232701`  t17_get_stats_dashboard_rpc
- `20260416232824`  t14_partition_history_by_month
- `20260416232835`  t14_partition_audit_log_by_month
- `20260425224650`  create_future_partitions_history_and_audit_log_2026
- `20260425224732`  harden_message_buffer_rls
- `20260425224751`  harden_history_partitions_rls
- `20260425224804`  harden_audit_log_partitions_rls
- `20260425224808`  fix_function_search_path
- `20260425225333`  drop_manual_partitions_2026_2027
- `20260425225352`  create_partition_management_functions
- `20260425225527`  unify_rls_policy_naming
- `20260428213911`  add_business_feature_flags
- `20260429031404`  bd01_api_rate_limits_policy
- `20260429031422`  bd03_bd04_cron_cleanup
- `20260429031429`  bd06_index_notifications_appointment_id
- `20260429031510`  bd02_revoke_admin_rpcs
- `20260429031643`  bd07_move_extensions_to_extensions_schema

### mayo 2026  (4)

- `20260502051822`  plan_soft_limits_consolidated
- `20260502201305`  013_offers_view_rls
- `20260502202652`  014_kanban_feature_flag
- `20260504223714`  017_intelligence_rpcs_date_range

### junio 2026  (23)

- `20260623155637`  finance_tables
- `20260623155654`  finance_rls
- `20260623160015`  finance_triggers
- `20260623160057`  finance_rpcs
- `20260623160149`  finance_permissions_and_plan
- `20260623160348`  finance_revoke_anon_rpcs
- `20260623201857`  finance_trend_rpc
- `20260630024644`  income_validation_pending_status
- `20260630024727`  income_validation_rpcs
- `20260630071412`  patient_search_extensions_index
- `20260630071435`  search_patients_rpc
- `20260630072152`  search_patients_text_cast_fix
- `20260630153658`  rbac_granular_actions_backfill
- `20260630154832`  revoke_anon_new_rpcs
- `20260630154935`  revoke_public_new_rpcs_v2
- `20260630155504`  drop_duplicate_trgm_index
- `20260630205638`  usage_counters_table_and_ai_pause
- `20260630205657`  record_usage_rpc
- `20260630205710`  get_plan_limits_add_usage
- `20260630205726`  cron_reset_usage_ai_pause
- `20260630210000`  record_usage_lockdown_service_role
- `20260630211421`  admin_limit_overrides_and_feature_merge
- `20260630212023`  get_plan_limits_tenant_guard

### julio 2026  (62)

- `20260703160149`  app_super_admins_table
- `20260703160158`  secure_businesses_column_level_update
- `20260703160236`  rbac_permission_gate_on_staff_rls
- `20260703160306`  revoke_anon_execute_on_sensitive_rpcs
- `20260703161857`  harden_security_definer_view_and_fn_search_path
- `20260703161914`  fix_reactivate_bot_uuid_and_schema
- `20260703162135`  revoke_public_execute_on_sensitive_rpcs
- `20260705210655`  history_retention_per_plan
- `20260705210829`  partition_horizon_and_maintenance
- `20260705210852`  composite_indexes_multi_tenant
- `20260705211039`  aux_retention_and_permissions_default
- `20260705211055`  drop_dead_functions
- `20260706041506`  drop_empty_clutter_partitions_user_approved
- `20260706041527`  rls_initplan_wrap_user_approved
- `20260706043003`  pricing_v2_limits_and_server_enforcement
- `20260706184619`  limits_visualization_only_and_profile_and_revokes
- `20260707201505`  harden_plans_revoke_write_grants
- `20260708012238`  audit1_least_privilege_execute_grants
- `20260708012505`  audit2a_dunning_foundation
- `20260708012603`  audit2b_rls_suspend_writes
- `20260708155508`  finance_categories_and_entry_fk
- `20260708155620`  backfill_manage_finance_categories_permission
- `20260711192927`  pricing_v3_basic_and_drop_unused_overloads
- `20260711192948`  ownership_check_get_visible_ids
- `20260711194249`  silent_churn_alert_cron
- `20260712155218`  search_global_usage_history_exports_bucket
- `20260714020754`  ai_module_foundation
- `20260714021211`  ai_module_at_risk_patients_rpc
- `20260715032449`  ai_chat_messages_owner_delete
- `20260717175608`  ai_token_metering
- `20260717231638`  finance_v2_settings_payment_methods
- `20260717231733`  finance_v2_receivables
- `20260717231850`  finance_v2_staff_production
- `20260717231934`  finance_v2_cash_sessions
- `20260717232017`  finance_v2_inventory
- `20260717232139`  finance_v2_recurring_projection_summary
- `20260718034910`  finance_v2_ai_scope
- `20260718035404`  finance_v2_harden_helpers
- `20260718145900`  split_business_intelligence_flag
- `20260718151903`  finance_v2_fix_summary_group_by
- `20260718201707`  get_payment_plans_pagination
- `20260718202308`  get_cash_sessions_pagination
- `20260718202638`  finance_monthly_goals
- `20260719005109`  ai_insights_add_agenda_narrative_scope
- `20260719014229`  stats_dashboard_clients_and_inquiry
- `20260719141659`  rbac_finance_v2_and_ai_hub_permissions
- `20260719142256`  schedule_exceptions_and_daily_cap
- `20260719142331`  get_available_slots_v2_and_validate_v2
- `20260719142500`  grant_max_appointments_per_day_update
- `20260719142959`  real_deletion_history_delete_policy_and_notif_fk
- `20260719143524`  payment_vouchers
- `20260719143559`  voucher_rpcs_create_redeem_cancel
- `20260719143645`  income_source_add_voucher
- `20260720010420`  voucher_fusion_appointment_flow
- `20260720065448`  business_price_rounding_policy
- `20260725060132`  pipeline_crm_least_privilege
- `20260726005018`  pipeline_all_steps_human_overridable
- `20260726011938`  pipeline_reopen_discovery_and_no_orphan_future_appt
- `20260726013104`  pipeline_strong_signals_reopen_discovery
- `20260726043313`  pipeline_strong_signal_reopens_from_any_stage
- `20260726050914`  pipeline_feedback_requires_all_checks_and_past
- `20260728041943`  inf2_revoke_public_execute_fix
