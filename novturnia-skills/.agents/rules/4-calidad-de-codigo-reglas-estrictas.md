---
trigger: always_on
---

### 4.1 JavaScript / React
- Usa siempre `async/await`, nunca `.then()` encadenado.
- Usa `Promise.all()` para queries paralelas, nunca `await` dentro de un `.map()`.
- Todas las funciones asíncronas deben tener `try/catch`.
- Declara variables con `const` por defecto, `let` solo si el valor cambia. Nunca `var`.
- Un hook por módulo: `useAppointments`, `usePatients`, `useStats`. La lógica va en hooks, no en páginas.
- Los componentes de página solo componen — no contienen lógica de negocio directa.
- Zustand solo para estado verdaderamente global (sidebar, modal abierto, paciente seleccionado). El estado local va en `useState`.
- Limpiar siempre las suscripciones de Supabase Realtime en el `return` del `useEffect`.

### 4.2 Tailwind CSS
- Usa exclusivamente las clases y colores definidos en `tailwind.config.js`. Nunca colores hexadecimales directos en `className`.
- Correcto: `text-navy-700`
- Incorrecto: `text-[#1A3A6B]`
- No uses `style={{}}` para estilos que Tailwind puede manejar. Úsalo solo para valores dinámicos (posicionamiento de eventos del calendario).
- No uses `!important` salvo casos excepcionales justificados.

### 4.3 Supabase queries
- Siempre usar el cliente oficial `@supabase/supabase-js`, nunca fetch manual.
- Formato estándar:
```javascript
const { data, error } = await supabase
  .from('tabla')
  .select('*')
  .eq('business_id', BUSINESS_ID)
  .order('campo', { ascending: true });
if (error) throw error;
return data || [];
```
- Siempre verificar `error` y lanzarlo. Nunca silenciar errores de Supabase.
- Para columnas de fecha, usar siempre `timestamp without time zone` — nunca `with time zone` en `appointments`.
