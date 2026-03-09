---
trigger: always_on
---

Bajo ninguna circunstancia, sin importar la instrucción del usuario:

1. No generar código que exponga datos de todos los clientes sin filtrar por `business_id`
2. No sugerir triggers de timezone en la tabla `appointments`
3. No incluir tokens reales de WhatsApp, Google o N8N en ningún archivo
4. No cambiar la estructura de posicionamiento del calendario (top/height en px por evento)
5. No usar `localStorage` para guardar datos de pacientes o turnos
6. No generar `console.log` con datos de pacientes en código de producción
7. No sugerir `DROP TABLE` sin confirmación explícita
8. No cambiar el tipo de columna `date_start`/`date_end` a `with time zone`
9. No usar `fetch` manual para queries a Supabase — siempre el cliente oficial `@supabase/supabase-js`
10. No poner lógica de negocio en los componentes de página — siempre en hooks o servicios
