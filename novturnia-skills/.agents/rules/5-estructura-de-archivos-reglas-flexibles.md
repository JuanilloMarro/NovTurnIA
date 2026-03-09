---
trigger: always_on
---

### 5.1 Estructura del proyecto
```
src/
├── config/supabase.js      → cliente Supabase + BUSINESS_ID (NO compartir)
├── store/useAppStore.js    → Zustand store global
├── hooks/                  → un hook por módulo
├── services/supabaseService.js → todas las queries CRUD
├── components/             → componentes reutilizables por módulo
├── pages/                  → solo composición, sin lógica de negocio
└── utils/                  → helpers puros (fechas, cálculos)
```

### 5.2 Nuevos módulos
Al agregar un módulo nuevo sigue este patrón:
1. Crear `pages/NuevoModulo.jsx`
2. Crear `components/NuevoModulo/` con sus subcomponentes
3. Crear `hooks/useNuevoModulo.js`
4. Agregar las queries en `services/supabaseService.js`
5. Agregar la ruta en `App.jsx`
6. Agregar el item en `Sidebar.jsx`

### 5.3 Orden de imports en cada archivo
```javascript
// 1. React y librerías externas
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// 2. Stores y hooks propios
import { useAppointments } from '../hooks/useAppointments';
// 3. Servicios
import { createAppointment } from '../services/supabaseService';
// 4. Componentes
import Modal from '../components/ui/Modal';
// 5. Utils
import { getEventStyle } from '../utils/calendarUtils';
```
