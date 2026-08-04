# Nivel general del sistema

Filtros: en los paneles emergentes que muestras las opciones de filtros agregar un poco mas de blur hacia el fondo porque a veces queda info atras y no es tan notorio las demas opciones un poco de blur para que blurree las opciones dentras del panel.

Investiga por que algunas opciones como la búsqueda o botones de accion dentro del celular activan como un zoom y hay que alejar mira si es tema de codigo o si ya es tema de navegador omitelo.

## Dimensiones de celular

Sidebar Menú:
    - El icono del menu se traslapa con el logo y nombre del sistema, creo que es mejor ocultarlo y al seleccionar un modulo se oculte o apachando afuera.
    - No se identifican como mas opciones explicitas, tendría que adivinar el cliente si existen mas modulos, se le puede poner algun identificador sutil para ayuda al usuario.

Modulo de citas: 
    - Verificar si el boton de actualizar funciona en terminos generales del sistema no tema de dimensiones.
    - Dentro del nuevo turno cuando decido elegir un cliente sigue saliendo con icono azul y no los blancos que decidimos tomar en cuenta para representación de iconos a nivel general del sistema.
    
    Ventana emergente configuración de citas:
        - Existe un componente hasta el final de la ventana emergente aparece una linea blanca abajo del boton de agregar excepcion y arriba de cerrar, elimina el componente.
        - Agrega un icono en el boton de cancelar a nivel general del boton sin importar dimensiones.
    
    Ventana emergente detalle del turno:
        - Los componentes de los botones de acción se encuentran corridas hacia la derecha siempre se tienen que encontrar en medio de la ficha, imagino que en reagendacion esta igual porque se reutiliza el componente.

Módulo de seguimiento:
    - Reviza el boton de actualizar no sirve eso a nivel general del sistema.
    - Dentro de las fichas los botones de ver chat, ver perfil y los demas botones de accion en ese menu de 3 puntos ninguno redirige a ningun lado compon eso.

Módulo de clientes:
    Ventanta emergente perfil del cliente:
        - Los botones de accion estan corridos hacia la derecha creo que debes revisar a nivel general que en esas fichas emergentes los botones esten en medio las emergentes als del modulo estan bien.

Módulo de conversaciones:

    - El texto dentro de la barra de escritura del mensaje es algo grande por lo que se ve cortado el texto, creo que es mejor un tooltip a nivel general como identificación que esta cerrada la ventana que un texto dentro de esa barra.
    
    Ventana emergente de paneles:
        - Aca no tiene implementado una barra deslizante verticalmente lo que no permite ver todo el componente de ofertas activas. 

Módulos de servicios y ofertas:
    - Las descripciones al crear un servicio u oferta como el text place holder excede el tamaño del text area y se active una barra deslizante el texto tiene que ser visible sin necesidad de accionar puedes disminuir el texto a modo de seguir una sola linea de tamaños de textos y tomar en cuenta esto que te comento.

Módulo de finanzas:

- A nivel general tienes que ver los componetnes del monto por el formato de ingreso de unidades no activa el teclado del telefono buscale una solución estricta asi el usuario tiene menos error humano al ingresar numeros.

    Submódulo de resumen:
        - Te dejo la tarea a ti, problema: los 4 paneles de ingresos, egresos, utilidad neta y margen son muy pequeños y los badge de porcentajes se comen gran parte de los espacios, ahora mismo tiene distribución 2*2 si logras poner los 4 en fila a modo de tenerlo como una pila visto gráficamente claro esta si no se puede unicamente en dimensiones de celular ocultas el badge de porcentajes en otras dimensiones se muestra.

    Submódulo de ajustes:

        - Subsubmódulo de Categorias:
            - Dentro del subsubsubmódulo de egresos el listado se intena compactar, arruinando las dimensiones estandar de las fichas ahi activa una barra deslizante en lugar de compactarlas para que quepan en la vista.
        - Subsubsubmódulo de metodos de pago: en el ingreso de porcentaje de comision el mismo problema con el ingreso del monto o la cantidad por unidades no activa el teclado.
        - Subsubsubmódulo de meta mensual el mismo problema para la cantidad de meta no activa el teclado.

Módulo Centro de IA:

- Dentro de las ventanas emergentes de generacion de un analisis o consulta de un análisis el boton no me gusta tanto que sea azul lo estamos evitando un poco, buscale la armonia y ponle un estilo tipo blanco como los botones de los modulos asi no se ve como componentes distintos.
- Panel de en medio orbe grande con ls fichas de accionamiento rápido tienen activado tanto un horizontal como un vertical barra desolizante, el vertical no esta mal pero el horizontal prohibido se acciona de un lado para el otro y no es para nada comodo, lo ideal seria quitar el horizontal. 

Módulo configuración de IA:
- Solo en dimension del celular me gustaria un grid continuo es decir, esta re bien el panel del orbe y sus caracteristicas pero el problema biene en la siguiente fila de los dos paneles me pasa lo mismo que con los componentes del resumen de finanzas prefiero que esos dos paneles esten uno encima de otro asi todos los paneles son gráficamente como una pila PERO SOLO EN DIMENSIONES DE TELEFONO luego en las demas esta re bien.

## Dimensiones de Tablet Horizontal

- Existe un margen inferior bastante grande en todo el sistema quitaselo.
