-- Agrega dos nuevos feature flags al JSONB de plans:
--   stats_intelligence: acceso a métricas avanzadas (LTV, retención, servicios, predicción)
--   ai_agent_name:      personalización del nombre del agente IA en el custom_prompt

UPDATE plans
SET features = features || '{"stats_intelligence": false, "ai_agent_name": false}'::jsonb
WHERE tier IN ('basic', 'pro');

UPDATE plans
SET features = features || '{"stats_intelligence": true, "ai_agent_name": true}'::jsonb
WHERE tier = 'enterprise';
