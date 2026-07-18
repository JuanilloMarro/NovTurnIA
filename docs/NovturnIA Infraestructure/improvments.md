# Versionado de la aplicacion - delimitar metas y features

To do:

# Modulo de turnos:
- Buscarle un mejor nombre al modulo de turnos, en una palabra tiene que decir lo que hace mi modulo.

Configuracion de citas:
- Dias festivos, darle esa excepciones para que la automatización no agende pacientes. parametros variables no solo horas y dias estrictos. Limitar cantidades por citas segun conveniencia del negocio.
- (feauture futura) re agendacion de citas futuras de otros clientes para citas con estado canceladas para aprovechar slots vacios agilizando y darle priorización a clientes.
- Eliminación completa no solo cambio de estado.
- Vouchers de pago: Crear un voucher de pago que se pueda compartir a los pacientes con un codigo unico para que paguen con el.

# Modulo de seguimiento 

- Enfoque mas como de re agendacion, seguimiento se entiende por todos los estados hasta confirmados y pendientes.
- Ventana emergente de detalle de turno por encima de botones de accion para la ficha del seguimiento.
- Filtracion por nombre y numero de cliente.
- Paginación problemas de rendimiento si no se implementa. tarda en cargar demasiados registros si no se realiza.
- Filtracion por periodos mas especificos (feature futura) y agregar periodo de 15 y hoy.

# Modulo de clientes

- Paginación problemas de rendimiento si no se implementa. tarda en cargar demasiados registros si no se realiza.
- GDPR eliminarlo
- Dentro de perfil del cliente el orden de los componentes priorizaremos el centro de IA luego notas y observaciones y por ultimo turnos.
- Tema de ultimos turnos dentro de perfil de cliente, mostrar ultimas 5 y boton de ver mas para mostrar historial completo de cliente. para el centro de IA podemos implementar un resumen de estados de todas sus citas. metadata que sirve demasiado.

# Modulo de conversaciones

- boton de menu de paneles cambiarlo al panel de ficha del cliente.
- Buscar un diferenciador de color de badge para las conversaciones de whatsapp entre mensajes de IA, negocio y cliente, tonos grises y el diferenciador con badge para no alterar el mensaje entero.
- Evaluar vaciado de chat, sirve para contexto o sirve mas para ux del negocio?
- Paginacion oculta, llegas al limite muestra mas, concatenando nuevos sin realizar una paginacion literal por numeros, apoyando al rendimiento de supabase mostrando data.
- implementacion del ojito con dialogo de detalle asi no perdemos el rastro del cliente y cambio de modulo drastrico, buscar solucion.

# Modulo de estadisticas

- Reevaluar sobre que cosas queremos mostrar, al negocio le interesa saber todo lo nuevo si totales pero plantear algo mas!
- Clientes totales o recurrentes y nuevos por mes y totales, todo tiene que ser mas dinámico. Que se actualicen dinámicamente los números según el mes en curso y el mes pasado.
- Buscar solucion de metrica por clientes que preguntaron y no agendaron para generar feedback y darle solución (feauture futura).

# Modulo Servicios

- Paginacion oculta, llegas al limite muestra mas, concatenando nuevos sin realizar una paginacion literal por numeros, apoyando al rendimiento de supabase mostrando data.
- Aprovechar mas el ancho de los modulos.
- Evitar scroll por ende sidebars redistribuir componentes para aprovechar mas los espacios.
- No hay feedback claro de edicion de servicios, esta a la mano pero no se especifica bien la edicion de apartados.tambien cambiar el enfoque de iconos en botones asi se ve la diferencia entre guardado y editado. 

# Modulo Ofertas

- Paginacion oculta, llegas al limite muestra mas, concatenando nuevos sin realizar una paginacion literal por numeros, apoyando al rendimiento de supabase mostrando data.
- Aprovechar mas el ancho de los modulos.
- Evitar scroll por ende sidebars redistribuir componentes para aprovechar mas los espacios.
- No hay feedback claro de edicion de servicios, esta a la mano pero no se especifica bien la edicion de apartados. tambien cambiar el enfoque de iconos en botones asi se ve la diferencia entre guardado y editado.
- jugar con el porcentaje de servicio en lugar de hacer el calculo manual.
- aproximacion exacta de cincos o evaluar para no dejar tantos decimales. dejarlo configurable por politicas de cada negocio.

# Modulo de Finanzas

- Permitir configurar sus propios metodos de pago para cada negocio como sus categorias.
- Botones de accion a la izquierda de botones submodulos para evitar mareo visual.
- - Evitar scroll por ende sidebars redistribuir componentes para aprovechar mas los espacios. dentro de registro de ingresos / egresos.
- Filtros y paginación para submodulos Ingresos, Egresos y Por confirmar.
- paginacion para recetas e insumos.
- formato decimales para insumos.
- unidades permitir configurar sus propias unidades o un select de unidades predefinidas. reevaluar si es necesario el submodulo de insumos. o darle otro enfoque de costos fijos y no insumos. enfoque actual inservible.
- Gastos fijos replicación mensual o por periodos.
- Gastos variables limpieza mensual sin embargo mantener el historial de gastos. marcar diferencia de automatizacion evitar procedimientos manuales.
- Buscar otro enfoque de modulo financiero, es tan grande que no debemos encerralo y dependerlo de un solo modulo, buscar un enfoque no tan generalizado tomando en cuenta que es multitenant, algo mas funcional no tan general y poco funcional.

# Modulo de actividad

reevaluar por temas de espacio y rendimiento en supabase

# Modulo de usuarios

select all de todas las secciones de roles y no una por una. pero por modulo.

# Modulo de centro de IA
- La idea es no encerrar a la IA dentro del centro de IA, me refiero a que me encantaria poder tener como a la mano a la IA en cada modulo aprovechando las herramientas que tenemos para cada uno, me refiero... dentro del modulo de clientes tener esa IA como si fuese el boton de notificaciones y si me encuentro dentro de clientes que me de la herramienta de poder hacerle resumen al cliente, estrategias por cliente y asi para poder tener a la IA en todo el modulo o simplemente del chat para algo general planifica algo bonito no es necesario que sea solo dentro del modulo puede ser todo el sistema pero cuando entremos en centro de ia que se oculte.

Dentro de actividad reciente no tiene datos detallados solo la respuesta, es decir si pido un resumen o alguna estrategia por cliente dentro de resumen deberia de salir los detalles de a que cliente se le realizo, no solo de la nada sacar la respuesta debe ser respaldada sobre quien se hizo la respuesta, en otros que son generales como KPIs explicados no pasa nada pero igual en los demas si. ademas la ventanta emergetne de la respuesta tiene demasiado espacio desaprovechado intenta aprovecharlo mucho mas.

- Me encantaria que propongas limite y conteo de tokens no solo en front si no que verdaderamente este conectado con mi key de gemini para poder llevar un control robusto y real sobre el consumo de tokens necesito que proporngas un plan detallado tanto para pro como para enterprise, la idea es tomar como referencia precisamente a claude que tiene dos planes el pro que tiene sus limites de tokens semanales, de esta forma el usuario puede ir viendo como gestionar el tema de tokens pero siempre con un limite, quiero proporcionar facilidad para que el usuario use el tema de la IA pero igual forma que no se coma mi costo dentro de la mensualidad sabes. propon una estrategia ideal con porcentajes de consumo / ganancia mia.

- Necesito que revises el modulo completo de como se gestiona la IA en cietos casos devuelve para un contenido u ofertas un "raw {"promos" cuando pedi una estrategia por cliente devolvio esto " raw Here is the JSON requested: ```" usa el mcp para verificar como se guardaron las respuestas y preguntas de la IA para poder verificar donde estuvo el error / bug y de esta forma poder mejorar y componer el modulo para que sea completamente funcional.

# Footer derechos de autor. testear el sistema.
# Recibos y formalización de pagos

mandan voucher antes que se venza suscripcion. recibo manual.


