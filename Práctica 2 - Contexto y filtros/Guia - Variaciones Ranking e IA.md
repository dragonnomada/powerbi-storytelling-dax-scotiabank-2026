# Guía práctica de DAX avanzado: drivers, medidas dinámicas, rendimiento e IA

## Propósito

Esta guía desarrolla los temas finales del **Módulo II – DAX avanzado para análisis de negocio**. Continúa el caso de estudio bancario utilizado en las presentaciones y guías anteriores.

Los temas cubiertos son:

13. Contribución al cambio y drivers de variación.
14. Ranking y segmentación dinámica.
15. Medidas dinámicas con parámetros y tablas desconectadas.
16. Diseño de librerías DAX reutilizables.
17. Optimización y diagnóstico de rendimiento.
18. IA para código, documentación y explicación de DAX.

El objetivo consiste en pasar de medidas técnicamente correctas a soluciones que también sean:

- Explicables para usuarios de negocio.
- Reutilizables entre páginas e informes.
- Validadas mediante controles independientes.
- Eficientes al crecer el volumen de datos.
- Documentadas para mantenimiento y auditoría.

> **Nota regional:** los ejemplos utilizan comas como separadores. Si Power BI está configurado para usar punto y coma, sustituya cada coma por `;`.

---

# 0. Preparación del modelo

## 0.1 Tablas principales

| Tabla | Tipo | Granularidad | Uso en esta guía |
|---|---|---|---|
| `fact_transaccion` | Hechos | Una fila por transacción | Volumen, conteos, estados y comparaciones |
| `dim_fecha` | Dimensión | Una fila por fecha | Periodos actuales y anteriores |
| `dim_cliente` | Dimensión | Una fila por cliente | Segmentación y análisis por población |
| `dim_canal` | Dimensión | Una fila por canal | Drivers de variación y ranking |
| `dim_producto` | Dimensión | Una fila por producto | Ranking, Top N y segmentación |
| `dim_sucursal` | Dimensión | Una fila por sucursal | Contexto geográfico y organizacional |

## 0.2 Medidas base requeridas

```DAX
Transacciones intentadas =
COUNTROWS ( fact_transaccion )
```

```DAX
Volumen transaccional =
SUMX (
    fact_transaccion,
    ABS ( fact_transaccion[monto_usd] )
)
```

```DAX
Transacciones rechazadas =
CALCULATE (
    [Transacciones intentadas],
    fact_transaccion[estado] = "Rechazada"
)
```

```DAX
Tasa de rechazo =
DIVIDE (
    [Transacciones rechazadas],
    [Transacciones intentadas]
)
```

```DAX
Volumen año anterior =
CALCULATE (
    [Volumen transaccional],
    DATEADD ( dim_fecha[fecha], -1, YEAR )
)
```

```DAX
Cambio volumen =
[Volumen transaccional]
    - [Volumen año anterior]
```

## 0.3 Convenciones recomendadas

- Las medidas base no incluyen filtros de negocio innecesarios.
- Las medidas derivadas reutilizan medidas existentes.
- Las tablas desconectadas tienen nombres que indican su función, por ejemplo `selector_metrica` o `parametro_topn`.
- Las variables internas utilizan nombres descriptivos.
- Las columnas virtuales pueden usar el prefijo `@` para distinguirlas de columnas físicas.
- Los porcentajes documentan claramente su denominador.

---

# Tema 13. Contribución al cambio

## 13.1 De la variación al driver

Una variación total indica cuánto cambió un KPI. Un análisis de drivers explica qué miembros de una dimensión produjeron ese cambio.

Ejemplo:

```text
Cambio total del volumen
= cambio de App móvil
+ cambio de Sucursal
+ cambio de Banca web
+ cambio de los demás canales
```

Para que la reconciliación funcione:

1. Los miembros deben ser mutuamente excluyentes.
2. El conjunto debe cubrir todas las filas del total.
3. Cada driver debe usar el mismo periodo y filtros.
4. El KPI debe ser aditivo sobre la dimensión analizada.

## 13.2 Variación absoluta por canal

La medida base ya contiene la comparación:

```DAX
Cambio volumen =
[Volumen transaccional]
    - [Volumen año anterior]
```

Cuando se coloca en una matriz con `dim_canal[canal]`, la medida se recalcula para cada canal.

| Canal | Actual | Año anterior | Cambio |
|---|---:|---:|---:|
| App móvil | Volumen actual | Volumen anterior | Actual menos anterior |
| Sucursal | Volumen actual | Volumen anterior | Actual menos anterior |
| Banca web | Volumen actual | Volumen anterior | Actual menos anterior |

La misma medida sirve para el total y para cada driver porque el contexto de filtro cambia en cada fila.

## 13.3 Contribución porcentual al cambio

```DAX
Contribución % canal =
DIVIDE (
    [Cambio volumen],
    CALCULATE (
        [Cambio volumen],
        ALLSELECTED ( dim_canal[canal] )
    )
)
```

### Evaluación paso a paso

1. En cada fila, `[Cambio volumen]` representa el cambio del canal.
2. `ALLSELECTED` retira el filtro del canal generado por la fila.
3. Conserva los canales elegidos mediante segmentadores.
4. El denominador calcula el cambio total de los canales visibles.
5. `DIVIDE` expresa el aporte del canal respecto al cambio total.

## 13.4 Por qué una contribución puede superar 100 %

Suponga:

```text
App móvil:  +150
Sucursal:    -50
Cambio total: 100
```

Las contribuciones son:

```text
App móvil: 150 / 100 = 150 %
Sucursal:  -50 / 100 = -50 %
Total:                  100 %
```

El porcentaje superior a 100 % no representa un error. Significa que otro driver compensó parcialmente el aumento.

## 13.5 Control de reconciliación

```DAX
Suma cambios por canal =
SUMX (
    VALUES ( dim_canal[canal] ),
    [Cambio volumen]
)
```

```DAX
Diferencia control drivers =
[Cambio volumen]
    - [Suma cambios por canal]
```

La diferencia debe ser cero dentro de una tolerancia razonable.

Si no es cero, revise:

- Miembros en blanco.
- Claves sin correspondencia.
- Filtros distintos entre medidas.
- Canales ocultos o excluidos.
- KPIs no aditivos.
- Redondeo de resultados visuales.

## 13.6 Ordenar drivers por impacto

El driver con mayor impacto puede ser positivo o negativo. Para ordenar por magnitud:

```DAX
Impacto absoluto canal =
ABS ( [Cambio volumen] )
```

Utilice esta medida para ordenar el visual, pero muestre también `[Cambio volumen]` para conservar el signo.

## 13.7 Driver positivo y driver favorable

El signo matemático no determina por sí solo si el resultado es favorable.

| KPI | Cambio positivo puede significar |
|---|---|
| Volumen transaccional | Mayor actividad |
| Comisiones | Mayor ingreso |
| Tasa de rechazo | Deterioro operativo |
| Alertas de fraude | Mayor exposición o mayor detección |

La interpretación debe documentarse para cada KPI.

## 13.8 Tasas y KPIs no aditivos

La tasa de rechazo no se suma por canal:

```text
Tasa total ≠ suma de tasas de cada canal
```

Para analizar drivers de una tasa, conviene revisar por separado:

- Cambio en transacciones rechazadas.
- Cambio en transacciones intentadas.
- Efecto combinado sobre la tasa.

No utilice el patrón aditivo de volumen directamente sobre una tasa sin definir una metodología de descomposición.

## 13.9 Visual recomendado

Una matriz puede incluir:

- Canal.
- Volumen actual.
- Volumen del año anterior.
- Cambio absoluto.
- Contribución porcentual.
- Impacto absoluto para ordenamiento.

Un gráfico de cascada también puede presentar drivers, siempre que la suma de las barras reconcilie con el cambio total.

## 13.10 Errores frecuentes

- Confundir participación del volumen con contribución al cambio.
- Dividir entre el volumen total en vez del cambio total.
- Ocultar drivers negativos para simplificar la historia.
- Analizar una tasa como si fuera aditiva.
- Presentar porcentajes de contribución sin mostrar el cambio absoluto.
- No reconciliar la suma de drivers contra el total.

---

# Tema 14. Ranking y segmentación dinámica

## 14.1 Ranking dentro del contexto

```DAX
Ranking producto =
RANKX (
    ALLSELECTED ( dim_producto[producto] ),
    [Volumen transaccional],
    ,
    DESC,
    DENSE
)
```

### Componentes

| Argumento | Función |
|---|---|
| `ALLSELECTED(dim_producto[producto])` | Define los productos que participan |
| `[Volumen transaccional]` | Expresión utilizada para ordenar |
| `DESC` | El mayor volumen obtiene la posición 1 |
| `DENSE` | Los empates no dejan huecos |

## 14.2 ALL frente a ALLSELECTED

```DAX
Ranking producto global =
RANKX (
    ALL ( dim_producto[producto] ),
    [Volumen transaccional],
    ,
    DESC,
    DENSE
)
```

```DAX
Ranking producto visible =
RANKX (
    ALLSELECTED ( dim_producto[producto] ),
    [Volumen transaccional],
    ,
    DESC,
    DENSE
)
```

- `ALL` clasifica contra todos los productos permitidos por los demás filtros.
- `ALLSELECTED` clasifica dentro de la selección visible del usuario.

La medida debe indicar qué universo utiliza.

## 14.3 Empates

`RANKX` permite dos tratamientos:

- `DENSE`: después de un empate continúa con el siguiente número.
- `SKIP`: después de un empate deja posiciones sin asignar.

Ejemplo:

| Producto | Volumen | DENSE | SKIP |
|---|---:|---:|---:|
| A | 100 | 1 | 1 |
| B | 80 | 2 | 2 |
| C | 80 | 2 | 2 |
| D | 60 | 3 | 4 |

## 14.4 Tabla desconectada para Top N

```DAX
parametro_topn =
DATATABLE (
    "Top N", INTEGER,
    {
        { 3 },
        { 5 },
        { 10 },
        { 15 }
    }
)
```

La tabla no necesita relación con el modelo.

## 14.5 Bandera para mostrar Top N

```DAX
Mostrar Top N =
VAR Limite =
    SELECTEDVALUE ( parametro_topn[Top N], 10 )
RETURN
    IF (
        [Ranking producto] <= Limite,
        1,
        0
    )
```

Coloque `[Mostrar Top N]` en los filtros del visual y seleccione el valor 1.

La medida no elimina físicamente productos del modelo. Sólo controla cuáles aparecen en ese visual.

## 14.6 Volumen del resto

```DAX
Volumen fuera de Top N =
VAR Limite =
    SELECTEDVALUE ( parametro_topn[Top N], 10 )
RETURN
    CALCULATE (
        [Volumen transaccional],
        FILTER (
            ALLSELECTED ( dim_producto[producto] ),
            [Ranking producto] > Limite
        )
    )
```

Esta medida calcula el volumen fuera del Top N. No crea automáticamente una categoría visible llamada “Otros”.

Para mostrar “Otros” como una fila o barra se necesita un patrón adicional, normalmente mediante:

- Una tabla de eje desconectada.
- Una unión virtual de Top N y categoría Otros.
- Una medida que distribuya el resultado según la fila del eje.

## 14.7 Segmentación dinámica por posición

```DAX
Segmento dinámico producto =
VAR Posicion =
    [Ranking producto]
VAR Cantidad =
    COUNTROWS (
        ALLSELECTED ( dim_producto[producto] )
    )
VAR PercentilPosicion =
    DIVIDE ( Posicion, Cantidad )
RETURN
    SWITCH (
        TRUE (),
        PercentilPosicion <= 0.20, "A",
        PercentilPosicion <= 0.50, "B",
        "C"
    )
```

Interpretación:

- A: primer 20 % de posiciones.
- B: posiciones siguientes hasta 50 %.
- C: resto de productos.

Los segmentos cambian al cambiar los filtros.

## 14.8 Posición frente a contribución acumulada

La segmentación anterior clasifica por posición, no por porcentaje acumulado del volumen.

Un análisis ABC clásico suele preguntar:

```text
¿Qué productos explican el primer 80 % del volumen acumulado?
```

Eso requiere calcular el volumen acumulado de productos ordenados, no sólo dividir el ranking entre la cantidad de productos.

## 14.9 Patrón de participación acumulada

```DAX
Volumen acumulado productos =
VAR PosicionActual =
    [Ranking producto]
VAR ProductosConRanking =
    ADDCOLUMNS (
        ALLSELECTED ( dim_producto[producto] ),
        "@Ranking", [Ranking producto],
        "@Volumen", [Volumen transaccional]
    )
RETURN
    SUMX (
        FILTER (
            ProductosConRanking,
            [@Ranking] <= PosicionActual
        ),
        [@Volumen]
    )
```

```DAX
% acumulado productos =
DIVIDE (
    [Volumen acumulado productos],
    CALCULATE (
        [Volumen transaccional],
        ALLSELECTED ( dim_producto[producto] )
    )
)
```

```DAX
Segmento ABC por volumen =
SWITCH (
    TRUE (),
    [% acumulado productos] <= 0.80, "A",
    [% acumulado productos] <= 0.95, "B",
    "C"
)
```

Este patrón puede ser costoso con muchas entidades. Debe medirse antes de utilizarlo en varios visuales.

## 14.10 Errores frecuentes

- No definir el universo del ranking.
- Usar `ALL` cuando el usuario espera ranking dentro de la selección.
- Ignorar el tratamiento de empates.
- Confundir posición relativa con contribución acumulada.
- Calcular ranking sobre una dimensión con demasiados miembros sin evaluar rendimiento.
- Crear un Top N sin documentar el comportamiento del resto.

---

# Tema 15. Medidas dinámicas con parámetros y tablas desconectadas

## 15.1 Tabla desconectada de métricas

```DAX
selector_metrica =
DATATABLE (
    "Metrica", STRING,
    {
        { "Volumen" },
        { "Transacciones" },
        { "Tasa rechazo" }
    }
)
```

La tabla debe permanecer desconectada. Su propósito no es filtrar los hechos, sino indicar qué medida debe evaluarse.

## 15.2 Medida dinámica con SWITCH

```DAX
Métrica seleccionada =
VAR Opcion =
    SELECTEDVALUE (
        selector_metrica[Metrica],
        "Volumen"
    )
RETURN
    SWITCH (
        Opcion,
        "Volumen", [Volumen transaccional],
        "Transacciones", [Transacciones intentadas],
        "Tasa rechazo", [Tasa de rechazo],
        BLANK ()
    )
```

### Evaluación

1. El usuario selecciona una etiqueta.
2. `SELECTEDVALUE` recupera la etiqueta si existe una selección única.
3. Si no hay una selección única, devuelve “Volumen”.
4. `SWITCH` selecciona la medida correspondiente.
5. El visual muestra el resultado usando el mismo contexto de dimensiones.

## 15.3 Título dinámico

```DAX
Título métrica seleccionada =
VAR Opcion =
    SELECTEDVALUE (
        selector_metrica[Metrica],
        "Volumen"
    )
RETURN
    "Análisis de " & Opcion
```

Utilice la medida como título condicional del visual.

## 15.4 Problema de formato

Las opciones pueden tener formatos diferentes:

| Métrica | Formato |
|---|---|
| Volumen | Moneda |
| Transacciones | Número entero |
| Tasa de rechazo | Porcentaje |

Una medida dinámica con formato fijo puede mostrar una tasa como moneda o un conteo como porcentaje.

Opciones:

- Usar cadenas de formato dinámicas.
- Crear grupos de opciones con formatos compatibles.
- Utilizar parámetros de campos cuando el caso lo permita.
- Mantener visuales separados si la comparación de escalas resulta confusa.

## 15.5 Selector de comparación

```DAX
selector_comparacion =
DATATABLE (
    "Comparacion", STRING,
    {
        { "Actual" },
        { "Año anterior" },
        { "Cambio" },
        { "Cambio %" }
    }
)
```

```DAX
Volumen comparación seleccionada =
VAR Opcion =
    SELECTEDVALUE (
        selector_comparacion[Comparacion],
        "Actual"
    )
RETURN
    SWITCH (
        Opcion,
        "Actual", [Volumen transaccional],
        "Año anterior", [Volumen año anterior],
        "Cambio", [Cambio volumen],
        "Cambio %", DIVIDE ( [Cambio volumen], [Volumen año anterior] ),
        BLANK ()
    )
```

## 15.6 Parámetro de umbral

```DAX
parametro_umbral =
DATATABLE (
    "Umbral USD", INTEGER,
    {
        { 500 },
        { 1000 },
        { 5000 },
        { 10000 }
    }
)
```

```DAX
Volumen sobre umbral seleccionado =
VAR Umbral =
    SELECTEDVALUE ( parametro_umbral[Umbral USD], 1000 )
RETURN
    CALCULATE (
        [Volumen transaccional],
        FILTER (
            fact_transaccion,
            ABS ( fact_transaccion[monto_usd] ) >= Umbral
        )
    )
```

## 15.7 Control de selección múltiple

Si el usuario puede seleccionar varias métricas, `SELECTEDVALUE` devuelve el valor alternativo.

Puede mostrar un mensaje:

```DAX
Estado selector métrica =
IF (
    HASONEVALUE ( selector_metrica[Metrica] ),
    "Selección válida",
    "Seleccione una sola métrica"
)
```

La configuración más sencilla es activar selección única en el segmentador.

## 15.8 Tabla desconectada frente a parámetro de campos

Una tabla desconectada con `SWITCH` ofrece control explícito sobre la lógica.

Un parámetro de campos puede cambiar medidas o dimensiones de un visual con menor cantidad de DAX.

Elija según la necesidad:

- `SWITCH`: reglas personalizadas, medidas compuestas y lógica de negocio.
- Parámetro de campos: cambio directo de campos o medidas en el visual.

## 15.9 Diseño de selectores

Cada selector debe documentar:

- Propósito.
- Opciones permitidas.
- Selección predeterminada.
- Comportamiento sin selección.
- Comportamiento con selección múltiple.
- Formato del resultado.
- Título del visual.

## 15.10 Errores frecuentes

- Crear una relación física para una tabla que debe estar desconectada.
- Mezclar métricas con formatos incompatibles sin formato dinámico.
- No definir una opción predeterminada.
- Permitir selección múltiple cuando la medida espera una sola opción.
- Crear demasiados selectores que vuelven impredecible el informe.
- Usar parámetros sin explicar qué decisión analítica modifican.

---

# Tema 16. Diseño de librerías DAX reutilizables

## 16.1 Capas recomendadas

```text
Medidas base
↓
Medidas de negocio
↓
Medidas de comparación
↓
Medidas de presentación
```

### Medidas base

Expresan agregaciones simples:

```DAX
Transacciones intentadas =
COUNTROWS ( fact_transaccion )
```

```DAX
Volumen transaccional =
SUMX (
    fact_transaccion,
    ABS ( fact_transaccion[monto_usd] )
)
```

### Medidas de negocio

Aplican una definición gobernada:

```DAX
Volumen digital =
CALCULATE (
    [Volumen transaccional],
    dim_canal[digital] = 1,
    fact_transaccion[estado] = "Contabilizada"
)
```

### Medidas de comparación

Cambian periodo o referencia:

```DAX
Volumen digital año anterior =
CALCULATE (
    [Volumen digital],
    DATEADD ( dim_fecha[fecha], -1, YEAR )
)
```

### Medidas de presentación

Combinan resultados para un KPI final:

```DAX
Variación % volumen digital =
DIVIDE (
    [Volumen digital] - [Volumen digital año anterior],
    [Volumen digital año anterior]
)
```

## 16.2 Dirección de dependencias

Una capa superior puede depender de una capa inferior.

Evite que una medida base dependa de una medida de presentación. Esto dificulta la lectura y puede crear dependencias circulares.

```text
Correcto:
Base → Negocio → Comparación → Presentación

Problemático:
Base → Presentación → Base
```

## 16.3 Convención de nombres

Un nombre útil comunica:

- Qué mide.
- Sobre qué población.
- Qué periodo o comparación utiliza.
- Qué unidad representa, cuando no resulta evidente.

Ejemplos:

```text
Volumen transaccional
Volumen digital
Volumen digital año anterior
Variación % volumen digital
Clientes digitales activos
Tasa de rechazo
```

Evite nombres como:

```text
Medida 1
Total nuevo
KPI final 2
Cálculo prueba
```

## 16.4 Carpetas de visualización

Una estructura posible:

```text
01 Base
02 Clientes
03 Transacciones
04 Canales
05 Tiempo
06 Variaciones
07 Rankings
08 Presentación
```

Las carpetas ayudan a descubrir medidas, pero no sustituyen nombres y descripciones claras.

## 16.5 Descripción de una medida

Una descripción útil puede seguir este formato:

```text
Definición:
Suma del valor absoluto de monto_usd para las transacciones visibles.

Unidad:
USD.

Filtros incorporados:
Ninguno. Respeta el contexto del informe.

Dependencias:
fact_transaccion[monto_usd].

Validación:
Debe ser igual o superior al valor absoluto del monto neto.
```

## 16.6 Contrato de una medida

Antes de publicar una medida, documente:

| Elemento | Pregunta |
|---|---|
| Nombre | ¿Qué resultado comunica? |
| Definición | ¿Qué población, periodo y unidad utiliza? |
| Granularidad | ¿A qué nivel tiene sentido interpretarla? |
| Dependencias | ¿Qué medidas y columnas utiliza? |
| Contexto | ¿Qué filtros agrega, conserva o retira? |
| Formato | ¿Moneda, entero, decimal o porcentaje? |
| Validación | ¿Con qué control se reconcilia? |
| Responsable | ¿Quién aprueba la definición? |

## 16.7 Reutilización mediante variables

```DAX
Variación % volumen controlada =
VAR Actual =
    [Volumen transaccional]
VAR Base =
    [Volumen año anterior]
VAR Cambio =
    Actual - Base
RETURN
    IF (
        ISBLANK ( Base ) || Base = 0,
        BLANK (),
        DIVIDE ( Cambio, Base )
    )
```

Las variables:

- Evitan repetir expresiones.
- Explican las etapas del cálculo.
- Facilitan cambios posteriores.
- Permiten revisar valores intermedios durante el desarrollo.

## 16.8 Grupos de cálculo

Cuando muchas medidas necesitan las mismas transformaciones temporales, un grupo de cálculo puede centralizar patrones como:

- Actual.
- Año anterior.
- Cambio absoluto.
- Cambio porcentual.
- YTD.

Los grupos de cálculo requieren diseño y herramientas compatibles. No deben incorporarse únicamente para reducir el número visible de medidas. Primero confirme:

- Compatibilidad del entorno.
- Precedencia entre grupos.
- Cadenas de formato.
- Comportamiento con medidas que no deben transformarse.
- Capacidad del equipo para mantenerlos.

## 16.9 Medidas ocultas

Una medida técnica puede ocultarse de la vista de informe cuando:

- Sirve únicamente como dependencia.
- Su uso directo podría causar interpretaciones incorrectas.
- Existe una medida visible con la definición aprobada.

Ocultar no elimina la medida. Otras medidas pueden seguir utilizándola.

## 16.10 Errores frecuentes

- Copiar la misma lógica dentro de muchas medidas.
- Mezclar agregación, filtro, comparación y formato en una sola expresión extensa.
- Crear dependencias circulares.
- Usar nombres técnicos como nombres visibles.
- Ocultar medidas sin documentar sus dependencias.
- Introducir grupos de cálculo sin una política de mantenimiento.

---

# Tema 17. Optimización y diagnóstico de rendimiento

## 17.1 Rendimiento como parte del diseño

Una medida puede devolver el resultado correcto y aun así producir una experiencia lenta.

El rendimiento depende de:

- Tamaño y cardinalidad del modelo.
- Relaciones.
- Número de visuales.
- Contexto de cada consulta.
- Funciones DAX utilizadas.
- Cantidad de filas recorridas.
- Complejidad de las tablas virtuales.

## 17.2 Motor de almacenamiento y motor de fórmulas

Conceptualmente, DAX utiliza dos tipos de trabajo:

| Componente | Trabajo típico |
|---|---|
| Motor de almacenamiento | Escaneo de columnas comprimidas, filtros y agregaciones simples |
| Motor de fórmulas | Coordinación de la expresión, iteradores y lógica compleja |

Las medidas suelen mejorar cuando las operaciones simples pueden resolverse como filtros y agregaciones de columnas.

## 17.3 Filtro directo frente a FILTER innecesario

Versión preferida:

```DAX
Transacciones rechazadas =
CALCULATE (
    [Transacciones intentadas],
    fact_transaccion[estado] = "Rechazada"
)
```

Versión más costosa sin necesidad:

```DAX
Transacciones rechazadas con recorrido =
CALCULATE (
    [Transacciones intentadas],
    FILTER (
        fact_transaccion,
        fact_transaccion[estado] = "Rechazada"
    )
)
```

La segunda expresión recorre una tabla para resolver una igualdad que puede expresarse directamente como filtro de columna.

`FILTER` sigue siendo correcto cuando la condición realmente requiere evaluación por fila.

## 17.4 Iterador frente a agregación simple

Si sólo necesita sumar una columna:

```DAX
Monto neto USD =
SUM ( fact_transaccion[monto_usd] )
```

Evite:

```DAX
Monto neto USD con iterador =
SUMX (
    fact_transaccion,
    fact_transaccion[monto_usd]
)
```

Las dos medidas pueden devolver el mismo resultado, pero `SUM` expresa mejor la intención y permite una ejecución más directa.

Use `SUMX` cuando deba evaluar una expresión por fila, como `ABS(monto_usd)`.

## 17.5 Reducir la tabla recorrida

En vez de iterar una tabla amplia o toda la dimensión, construya la lista mínima necesaria:

```DAX
Promedio por canal =
AVERAGEX (
    VALUES ( dim_canal[canal_id] ),
    [Volumen transaccional]
)
```

La tabla iterada contiene sólo los canales visibles, no todas las transacciones.

## 17.6 Variables y reutilización interna

```DAX
Variación % optimizada =
VAR Actual =
    [Volumen transaccional]
VAR Base =
    [Volumen año anterior]
RETURN
    DIVIDE ( Actual - Base, Base )
```

Las variables pueden evitar reevaluaciones y facilitan la lectura. No garantizan por sí solas una mejora. El rendimiento debe medirse.

## 17.7 Cardinalidad

Columnas con muchos valores distintos requieren más recursos.

Ejemplos de alta cardinalidad:

- Identificadores únicos.
- Marcas de tiempo con segundos o milisegundos.
- Textos largos.
- Importes con demasiada precisión.

Buenas prácticas:

- Eliminar columnas no utilizadas.
- Separar fecha y hora sólo cuando el análisis lo requiera.
- Evitar usar identificadores únicos como ejes de visuales masivos.
- Mantener tipos de datos adecuados.
- Reducir precisión cuando la definición de negocio lo permita.

## 17.8 Analizador de rendimiento

En Power BI Desktop:

1. Abra el Analizador de rendimiento.
2. Inicie la grabación.
3. Actualice los visuales.
4. Identifique los visuales más lentos.
5. Copie la consulta cuando necesite un análisis adicional.
6. Cambie una medida a la vez.
7. Repita la medición.

Registre:

- Visual.
- Medida principal.
- Duración inicial.
- Cambio realizado.
- Duración posterior.
- Resultado de validación.

## 17.9 DAX Studio

Cuando el entorno lo permita, DAX Studio puede ayudar a revisar:

- Server Timings.
- Planes de consulta.
- Trabajo del motor de almacenamiento.
- Trabajo del motor de fórmulas.
- Consultas generadas por los visuales.

La herramienta aporta evidencia. No sustituye la comprensión del modelo ni la validación de negocio.

## 17.10 Proceso de optimización

```text
1. Medir
2. Identificar el visual lento
3. Aislar la medida
4. Formular una hipótesis
5. Cambiar una parte
6. Validar el resultado
7. Volver a medir
8. Documentar
```

## 17.11 Riesgos de optimizar sin medir

- Reescribir una medida rápida sin beneficio.
- Introducir una fórmula difícil de mantener.
- Cambiar resultados en totales.
- Perder comportamiento ante filtros.
- Mover el costo a otra parte de la consulta.
- Confundir menor longitud con mayor rendimiento.

## 17.12 Lista de revisión

- ¿Existe una agregación simple en lugar de un iterador?
- ¿La condición puede expresarse como filtro de columna?
- ¿La tabla virtual contiene sólo las columnas necesarias?
- ¿El iterador recorre la entidad correcta?
- ¿La medida se evalúa demasiadas veces dentro de otra iteración?
- ¿El visual muestra demasiadas categorías?
- ¿El modelo contiene columnas de alta cardinalidad no utilizadas?
- ¿La mejora fue medida antes y después?

---

# Tema 18. IA para código, documentación y explicación de DAX

## 18.1 Qué puede aportar la IA

La IA puede apoyar en:

- Proponer una primera versión de una medida.
- Explicar una fórmula existente.
- Documentar dependencias y filtros.
- Crear casos de prueba.
- Comparar dos alternativas.
- Identificar posibles problemas de contexto.
- Sugerir nombres y descripciones.

La IA no conoce automáticamente la semántica real del modelo.

## 18.2 Contexto mínimo de una solicitud

Una solicitud útil debe incluir:

### Modelo

- Tablas relevantes.
- Columnas exactas.
- Relaciones.
- Dirección de filtros.
- Granularidad de la tabla de hechos.

### Pregunta de negocio

- Definición del KPI.
- Numerador y denominador.
- Periodo.
- Filtros que deben conservarse.
- Comportamiento esperado en totales.

### Salida solicitada

- Medida o tabla calculada.
- Explicación paso a paso.
- Supuestos.
- Casos de prueba.
- Consideraciones de rendimiento.

## 18.3 Plantilla de solicitud

```text
Objetivo:
Calcular la contribución de cada canal al cambio interanual del volumen.

Modelo:
fact_transaccion se relaciona con dim_fecha y dim_canal mediante relaciones
uno a muchos. dim_fecha filtra por fecha_operacion_id.

Medidas disponibles:
[Volumen transaccional]
[Volumen año anterior]

Contexto:
Conservar filtros de año, país y producto. Comparar únicamente los canales
visibles para el usuario.

Salida:
Una medida DAX, explicación del denominador y tres pruebas de validación.

Restricciones:
No crear columnas calculadas ni relaciones bidireccionales.
No utilizar nombres de tablas o columnas que no existan.
```

## 18.4 Solicitar explicación de una medida

```text
Explica esta medida DAX en cinco partes:

1. Contexto inicial.
2. Tabla o entidad iterada.
3. Filtros agregados o retirados.
4. Significado del numerador y denominador.
5. Comportamiento esperado en filas y total.

Después propone tres pruebas con resultados esperados.
```

Este formato obliga a revisar semántica, no sólo sintaxis.

## 18.5 Solicitar documentación

```text
Genera documentación para la siguiente medida con estos campos:

- Nombre
- Definición de negocio
- Unidad
- Granularidad
- Dependencias
- Filtros incorporados
- Filtros que conserva
- Tratamiento de blancos y ceros
- Formato
- Casos de prueba
- Consideraciones de rendimiento
```

## 18.6 Solicitar optimización

Una solicitud de optimización debe incluir evidencia:

```text
La medida tarda 1.8 segundos en una matriz con 25 productos y 24 meses.
El modelo contiene 120,000 transacciones.
El Analizador de rendimiento identifica esta medida como el principal costo.

Propón alternativas que conserven exactamente el mismo contexto y resultado.
Explica qué parte podría reducir trabajo del motor de fórmulas.
Incluye una prueba de reconciliación.
```

Sin datos de rendimiento, la IA sólo puede sugerir hipótesis.

## 18.7 Revisión humana obligatoria

| Revisión | Pregunta |
|---|---|
| Nombres | ¿Las tablas, columnas y medidas existen? |
| Semántica | ¿La fórmula responde la definición de negocio? |
| Contexto | ¿Conserva y retira los filtros correctos? |
| Granularidad | ¿Itera la entidad adecuada? |
| Totales | ¿El total se recalcula correctamente? |
| Blancos | ¿Distingue ausencia, cero y no aplicable? |
| Rendimiento | ¿Evita recorridos innecesarios? |
| Seguridad | ¿El ejemplo excluye información sensible? |

## 18.8 Casos de prueba

Para una medida de contribución:

```text
Caso 1: un solo canal visible
Esperado: contribución igual a 100 %, si el cambio total no es cero.

Caso 2: dos canales con cambios +150 y -50
Esperado: contribuciones 150 % y -50 %.

Caso 3: cambio total igual a cero
Esperado: resultado en blanco o tratamiento documentado.
```

Para una medida dinámica:

```text
Caso 1: Volumen seleccionado
Esperado: formato monetario y valor igual a [Volumen transaccional].

Caso 2: Tasa rechazo seleccionada
Esperado: formato porcentual y valor igual a [Tasa de rechazo].

Caso 3: selección múltiple
Esperado: valor predeterminado o mensaje documentado.
```

## 18.9 Datos sensibles

No comparta con un servicio externo:

- Nombres reales de clientes.
- Números de cuenta.
- Identificadores personales.
- Importes asociados a personas identificables.
- Credenciales.
- Información interna restringida.

Para solicitar ayuda con DAX suelen ser suficientes:

- Esquema anonimizado.
- Nombres genéricos o aprobados.
- Relaciones.
- Granularidad.
- Ejemplos sintéticos.
- Resultados esperados.

## 18.10 Flujo recomendado

```text
1. Definir la pregunta
2. Proporcionar el esquema
3. Solicitar supuestos explícitos
4. Revisar el código
5. Ejecutar en Power BI
6. Probar filtros, filas y totales
7. Medir rendimiento
8. Documentar correcciones
9. Publicar sólo después de aprobación
```

## 18.11 Señales de una respuesta insuficiente

- Inventa nombres de columnas.
- Omite el denominador.
- No explica el total.
- Recomienda relaciones bidireccionales sin justificar.
- Utiliza `FILTER` sobre tablas grandes para condiciones simples.
- Convierte todos los blancos en cero.
- No incluye pruebas.
- Afirma que una medida está optimizada sin mediciones.

## 18.12 IA para explicar código existente

La explicación debe contrastarse con el modelo. Una descripción clara no garantiza que la fórmula sea correcta.

Solicite dos niveles:

```text
Explicación para desarrollador:
Contextos, tablas virtuales, filtros y dependencias.

Explicación para negocio:
Qué mide, sobre qué población, contra qué base y cómo interpretar el signo.
```

---

# Ejercicio integrador final

## Objetivo

Construir una página ejecutiva que permita:

- Elegir una métrica.
- Mostrar su comparación interanual.
- Identificar productos principales.
- Explicar drivers por canal.
- Documentar y validar las medidas.

## Paso 1. Selector de métricas

```DAX
selector_metrica =
DATATABLE (
    "Metrica", STRING,
    {
        { "Volumen" },
        { "Transacciones" },
        { "Tasa rechazo" }
    }
)
```

## Paso 2. Medida actual dinámica

```DAX
Métrica actual =
VAR Opcion =
    SELECTEDVALUE ( selector_metrica[Metrica], "Volumen" )
RETURN
    SWITCH (
        Opcion,
        "Volumen", [Volumen transaccional],
        "Transacciones", [Transacciones intentadas],
        "Tasa rechazo", [Tasa de rechazo],
        BLANK ()
    )
```

## Paso 3. Medida anterior dinámica

```DAX
Métrica año anterior =
VAR Opcion =
    SELECTEDVALUE ( selector_metrica[Metrica], "Volumen" )
RETURN
    SWITCH (
        Opcion,
        "Volumen", [Volumen año anterior],
        "Transacciones",
            CALCULATE (
                [Transacciones intentadas],
                DATEADD ( dim_fecha[fecha], -1, YEAR )
            ),
        "Tasa rechazo",
            CALCULATE (
                [Tasa de rechazo],
                DATEADD ( dim_fecha[fecha], -1, YEAR )
            ),
        BLANK ()
    )
```

## Paso 4. Variación dinámica

```DAX
Cambio métrica =
[Métrica actual]
    - [Métrica año anterior]
```

```DAX
Cambio % métrica =
VAR Base =
    [Métrica año anterior]
RETURN
    IF (
        ISBLANK ( Base ) || Base = 0,
        BLANK (),
        DIVIDE ( [Cambio métrica], Base )
    )
```

> Para una tasa, la diferencia absoluta representa puntos porcentuales si ambas medidas se expresan como proporciones. El título debe comunicarlo correctamente.

## Paso 5. Ranking de productos

```DAX
Ranking producto métrica =
RANKX (
    ALLSELECTED ( dim_producto[producto] ),
    [Métrica actual],
    ,
    DESC,
    DENSE
)
```

Antes de utilizar esta medida, confirme que la métrica seleccionada tiene sentido para ordenar productos. Una tasa puede requerir un volumen mínimo para evitar posiciones dominadas por muestras pequeñas.

## Paso 6. Top N

```DAX
Mostrar Top N métrica =
VAR Limite =
    SELECTEDVALUE ( parametro_topn[Top N], 10 )
RETURN
    IF (
        [Ranking producto métrica] <= Limite,
        1,
        0
    )
```

## Paso 7. Driver por canal

Para métricas aditivas:

```DAX
Contribución % canal métrica =
DIVIDE (
    [Cambio métrica],
    CALCULATE (
        [Cambio métrica],
        ALLSELECTED ( dim_canal[canal] )
    )
)
```

Para la tasa de rechazo, no utilice automáticamente esta contribución. Muestre el cambio por canal y analice numerador y denominador.

## Paso 8. Diseño de la página

- Segmentador de métrica.
- Segmentador Top N.
- Tarjeta de métrica actual.
- Tarjeta del año anterior.
- Tarjeta de cambio absoluto.
- Tarjeta de cambio porcentual.
- Barras por producto con ranking y filtro Top N.
- Matriz de drivers por canal.
- Título dinámico.
- Texto de selección activa.

## Paso 9. Validaciones

1. La métrica actual coincide con la medida base elegida.
2. La métrica anterior utiliza el mismo periodo desplazado un año.
3. El cambio equivale a actual menos base.
4. El porcentaje utiliza la base como denominador.
5. El ranking cambia con los segmentadores.
6. Top N conserva exactamente el número esperado, considerando empates.
7. Los drivers aditivos reconcilian con el cambio total.
8. La tasa de rechazo no se presenta como driver aditivo sin advertencia.
9. Cada métrica utiliza el formato correcto.
10. Los totales se recalculan en vez de sumar porcentajes visibles.

---

# Lista de validación del módulo

## Drivers

- La suma de drivers reconcilia con la variación total.
- El denominador de contribución representa el cambio total visible.
- Los aportes negativos permanecen visibles.
- Los KPIs no aditivos utilizan una metodología apropiada.

## Ranking

- El universo del ranking está definido.
- El tratamiento de empates está documentado.
- Top N responde al parámetro.
- La categoría Otros tiene una definición clara, si se utiliza.
- La segmentación distingue posición de contribución acumulada.

## Medidas dinámicas

- Las tablas selectoras permanecen desconectadas.
- Existe una opción predeterminada.
- La selección múltiple tiene un tratamiento definido.
- El título y el formato cambian con la métrica.
- Las opciones representan una decisión analítica clara.

## Librería

- Las medidas siguen capas de dependencia.
- La lógica base no se repite innecesariamente.
- Nombres, descripciones y carpetas son consistentes.
- Cada medida tiene un contrato y un control de validación.
- Las medidas técnicas ocultas permanecen documentadas.

## Rendimiento

- Las condiciones simples utilizan filtros de columna.
- Los iteradores se reservan para expresiones por fila.
- Las tablas virtuales contienen únicamente columnas necesarias.
- El modelo evita columnas de alta cardinalidad sin uso.
- Las mejoras se miden antes y después.
- El resultado permanece idéntico tras optimizar.

## IA

- La solicitud incluye modelo, definición y salida esperada.
- Los nombres generados existen en el modelo.
- La fórmula se prueba en filas, totales y filtros.
- La respuesta incluye supuestos y casos límite.
- No se comparten datos sensibles.
- El equipo conserva responsabilidad sobre el resultado.

---

# Tabla de diagnóstico

| Síntoma | Causa probable | Revisión |
|---|---|---|
| Las contribuciones no suman 100 % | El total del cambio es cero o faltan drivers | Revisar reconciliación y denominador |
| Una contribución supera 100 % | Existen drivers compensatorios | Revisar signos antes de considerarlo error |
| El ranking no cambia con segmentadores | Se utilizó `ALL` en vez de `ALLSELECTED` | Confirmar el universo requerido |
| Top N muestra más elementos | Existen empates | Definir tratamiento de empates |
| Una medida dinámica muestra formato incorrecto | Las opciones tienen unidades distintas | Usar formato dinámico o separar opciones |
| SELECTEDVALUE devuelve la opción predeterminada | No existe selección única | Configurar selección única o mostrar mensaje |
| Muchas medidas contienen la misma expresión | Falta una medida base reutilizable | Reorganizar la librería por capas |
| La página responde lentamente | Iteradores, alta cardinalidad o demasiados visuales | Medir con Analizador de rendimiento |
| Una optimización cambia los totales | La nueva expresión modificó el contexto | Comparar filas, total y filtros |
| La IA propone columnas inexistentes | No recibió el esquema exacto | Proporcionar nombres y relaciones reales |
| El código generado funciona, pero el KPI es incorrecto | Falta definición de negocio | Documentar población, periodo y denominador |

---

# Mapa de decisión

```text
¿Necesito explicar una variación aditiva?
└── Cambio por miembro
    ├── Reconciliar con el cambio total
    └── Contribución = cambio del miembro / cambio total

¿Necesito ordenar entidades?
└── RANKX
    ├── ALL para universo global
    └── ALLSELECTED para universo visible

¿El usuario debe elegir el límite?
└── Tabla desconectada Top N + SELECTEDVALUE

¿El usuario debe elegir la métrica?
└── Tabla desconectada + SWITCH
    ├── Título dinámico
    └── Formato dinámico o métricas compatibles

¿La misma lógica aparece varias veces?
└── Crear una medida base y organizar por capas

¿La medida es lenta?
├── Medir primero
├── Aislar visual y medida
├── Simplificar filtros e iteraciones
└── Validar y volver a medir

¿Se utilizará IA?
├── Proporcionar esquema y definición
├── Solicitar supuestos y pruebas
├── Excluir datos sensibles
└── Validar código, contexto y rendimiento
```

---

# Resultado de aprendizaje esperado

Al finalizar los temas 13 al 18, el alumno debe poder:

- Reconciliar una variación total con sus drivers.
- Interpretar contribuciones positivas, negativas y superiores a 100 %.
- Construir rankings globales y visibles con `RANKX`.
- Implementar Top N y segmentaciones dinámicas.
- Crear selectores desconectados para métricas, comparaciones y umbrales.
- Gestionar selección predeterminada, selección múltiple, títulos y formatos.
- Organizar una librería DAX mediante capas y contratos de medidas.
- Identificar expresiones que generan trabajo innecesario.
- Utilizar evidencia para optimizar y verificar resultados.
- Solicitar ayuda a una IA proporcionando contexto suficiente.
- Revisar código generado antes de incorporarlo al modelo.
- Documentar medidas para usuarios, desarrolladores y responsables de gobierno.

Una medida avanzada se considera terminada cuando ofrece un resultado correcto, explica su contexto, reconcilia con un control, responde con rendimiento adecuado y cuenta con documentación suficiente para que otra persona pueda mantenerla.
