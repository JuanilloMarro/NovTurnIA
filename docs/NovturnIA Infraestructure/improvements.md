# NovTurnIA

- El icono del usuario en la sesion debe ser blanco como los listados de clientes igual, la info esta genial sale el nombre del negocio pero sale como prueba enterprise deberia de ser plan enterprise, la apariencia el boiton no debe ser azul debe ser blanco como los botones de los modulos con sombreado y el degradado.
- Implementar el modo oscuro SIN TOCAR NADA DEL MODO CLARO ESO JAMAS SE TOCA SE QUEDA COMO ESTA SOLO EL OSCURO SE INTENTA IMPLEMENTAR COMO ALGUN PANEL GENERAL QUE SE VEA OBSCURO CON LOS MISMOS COLORES O BUSCA OTRA ALTERNATIVA PARA NO TOCAR NADA DEL CLARO.
- Evalua todos los modulso y mira si siguen el formato de botones, paneles con degradados y sombreados todo igual para no tener diferencias. Todo debe ser igual y fluido.
- Footer derechos de autor.
- Futuro eso no realizar: testear el sistema.
- Futuro eso no realizar: Recibos y formalización de pagos: mandan voucher antes que se venza suscripcion. recibo manual.
- Futuro eso no realizar: Versionado de la aplicacion - delimitar metas y features.

# Modulo de turnos:
- Buscarle un mejor nombre al modulo de turnos, en una palabra tiene que decir lo que hace mi modulo. Como CITAS

Configuracion de citas:
- Dias festivos, darle esa excepciones para que la automatización no agende pacientes. parametros variables no solo horas y dias estrictos. Limitar cantidades por citas segun conveniencia del negocio.
- (feauture futura) re agendacion de citas futuras de otros clientes para citas con estado canceladas para aprovechar slots vacios agilizando y darle priorización a clientes.
- Eliminación completa no solo cambio de estado.
- Vouchers de pago: Crear un voucher de pago que se pueda compartir a los pacientes con un codigo unico para que paguen con el.

# Modulo de seguimiento 

- Ventana emergente de detalle de turno por encima de botones de accion para la ficha del seguimiento.
- Filtracion por nombre y numero de cliente.
- Paginación problemas de rendimiento si no se implementa puede ser oculta como los demas. tarda en cargar demasiados registros si no se realiza.
- Filtracion por periodos mas especificos (feature futura) y agregar periodo de 15 y hoy.

# Modulo de clientes

- Paginación problemas de rendimiento si no se implementa ouede ser oculta como todos los demas que implementamos. tarda en cargar demasiados registros si no se realiza.
- GDPR eliminarlo
- Dentro de perfil del cliente el orden de los componentes priorizaremos el centro de IA luego notas y observaciones y por ultimo turnos y las fichas de centro de IA tiene que tener el icono de todos los demas, gris con borde y solo el titulo.
- Tema de ultimos turnos dentro de perfil de cliente, mostrar ultimas 5 y boton de ver mas para mostrar historial completo de cliente. para el centro de IA podemos implementar un resumen de estados de todas sus citas. metadata que sirve demasiado.

# Modulo de conversaciones

- Evaluar vaciado de chat quitalo, quita los 3 puntos y directamente el basurero ponle ahi.
- Implementar esa eliminacion de mensajes individuales como lo tenemos dentro de la conversación de la IA.
- Paginacion oculta, llegas al limite muestra mas, concatenando nuevos sin realizar una paginacion literal por numeros, apoyando al rendimiento de supabase mostrando data.
- implementacion del ojito con dialogo de detalle como algo emergente sin necesidad de cambiar por completo al modulo asi no perdemos el rastro del cliente y cambio de modulo drastrico, buscar solucion.
- el alto del panel donde se encuetnra ficha del cliente, servicios activos hazlo igual de alto que el panel de conversacion y listado, ademas el titulo ficha del cliente esta reducido todo puedes ampliarlo mas pero sin sobrepasar el alto estandar del modulo.

# Modulo Servicios

- Paginacion oculta, llegas al limite muestra mas, concatenando nuevos sin realizar una paginacion literal por numeros, apoyando al rendimiento de supabase mostrando data.
- No hay feedback claro de edicion de servicios, me refiero a que dentro del panel no hay algo claro como diciendo estas en modo de edición como reutilizamos el panel para crear y editar debe de especificar mejor, esta a la mano pero no se especifica bien la edicion de apartados. tambien cambiar el enfoque de iconos en botones asi se ve la diferencia entre guardado y editado, me refiero a que si estamos en modo de creacion el boton de la carpeta esta bien pero si es edicion debe tener boton de lapicito

# Modulo Ofertas

- Paginacion oculta, llegas al limite muestra mas, concatenando nuevos sin realizar una paginacion literal por numeros, apoyando al rendimiento de supabase mostrando data.
- Aprovechar mas el ancho de los modulos, redsitribuye ciertos componentes que sigan siendo secuenciales hacia abajo pero sin necesidad de que exista un sidebar, me encantaria solo que reduzcas los componentes a modo de dejarlos asi tal cual pero si no se lgora desactivar el sidebar y se ven muy pequeños prefiero que amplies y redistribuyas asi no superan el alto y no es necesario el scroll.
- No hay feedback claro de edicion de ofertas, me refiero a que dentro del panel no hay algo claro como diciendo estas en modo de edición como reutilizamos el panel para crear y editar debe de especificar mejor, esta a la mano pero no se especifica bien la edicion de apartados. tambien cambiar el enfoque de iconos en botones asi se ve la diferencia entre guardado y editado, me refiero a que si estamos en modo de creacion el boton de la carpeta esta bien pero si es edicion debe tener boton de lapicito.
- jugar con el porcentaje de servicio en lugar de hacer el calculo manual de igual forma permitir editar el precio promocional.
- aproximacion exacta de cincos o evaluar para no dejar tantos decimales. dejarlo configurable por politicas de cada negocio.

# Modulo de actividad

reevaluar por temas de espacio y rendimiento en supabase

# UI cambios en markdowns
Existen ciertos markdowns que tienen aun cambios de UI especificados dentro de la carpeta de NovTurnIA, revisalos e implementalos.