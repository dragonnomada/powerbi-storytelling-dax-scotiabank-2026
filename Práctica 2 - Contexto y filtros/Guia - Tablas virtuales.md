# Guía práctica de DAX avanzado: tablas virtuales, relaciones y comparaciones temporales

## Propósito

Esta guía desarrolla paso a paso los ejemplos de la presentación **DAX avanzado — temas 7 al 12**. Continúa el trabajo realizado con contextos, `CALCULATE` y modificación de filtros.

Los temas cubiertos son:

7. `SUMMARIZE`, `ADDCOLUMNS` y `GROUPBY`.
8. `CALCULATETABLE` y tablas virtuales.
9. `TREATAS` y relaciones virtuales.
10. Inteligencia temporal avanzada.
11. Análisis YoY, MoM y YTD.
12. Variaciones absolutas y porcentuales.

El objetivo consiste en construir medidas que puedan explicar:

- Qué tabla intermedia producen.
- Cuál es la granularidad de esa tabla.
- Qué filtros modifican.
- Qué relación o fecha utilizan.
- Contra qué periodo o base realizan una comparación.

> **Nota regional:** los ejemplos utilizan comas como separadores de argumentos. Si Power BI está configurado para usar punto y coma, sustituya cada coma por `;`.

---

# 0. Preparación del modelo

## 0.1 Tablas utilizadas

| Tabla | Tipo | Granularidad | Uso en esta guía |
|---|---|---|---|
| `fact_transaccion` | Hechos | Una fila por transacción | Conteos, volumen, estados y fechas del movimiento |
| `dim_fecha` | Dimensión | Una fila por fecha | Periodos comparables, ventanas móviles y calendario corporativo |
| `dim_cliente` | Dimensión | Una fila por cliente | Iteración por cliente y aplicación de filtros virtuales |
| `dim_canal` | Dimensión | Una fila por canal | Agrupamiento, tasas y análisis digital |
| `dim_producto` | Dimensión | Una fila por producto | Contexto adicional para validar las medidas |
| `dim_sucursal` | Dimensión | Una fila por sucursal | País, región y contexto organizacional |

## 0.2 Relaciones necesarias

```text
dim_fecha[fecha_id]       1 ──── * fact_transaccion[fecha_operacion_id]
dim_cliente[cliente_id]   1 ──── * fact_transaccion[cliente_principal_id]
dim_canal[canal_id]       1 ──── * fact_transaccion[canal_id]
dim_producto[producto_id] 1 ──── * fact_transaccion[producto_id]
dim_sucursal[sucursal_id] 1 ──── * fact_transaccion[sucursal_id]
```

La relación entre `dim_fecha[fecha_id]` y `fact_transaccion[fecha_operacion_id]` debe estar activa.

Agregue también una relación inactiva:

```text
dim_fecha[fecha_id]       1 ─ ─ ─ * fact_transaccion[fecha_contabilizacion_id]
```

Esta segunda relación permitirá elegir entre fecha de operación y fecha de contabilización sin duplicar la dimensión de fechas.

## 0.3 Revisión de la dimensión de fechas

Antes de trabajar con inteligencia temporal, confirme que `dim_fecha`:

- Contiene una fila por día.
- No tiene fechas duplicadas.
- No tiene huecos dentro del intervalo utilizado.
- Está marcada como tabla de fechas.
- Usa `dim_fecha[fecha]` como columna de fecha.
- Cubre todo el rango de las fechas de operación y contabilización.

Los campos corporativos disponibles incluyen:

```text
fecha
anio
trimestre
mes_numero
mes_nombre
anio_mes
semana_iso
es_fin_semana
es_feriado_corporativo
es_dia_habil
anio_fiscal
periodo_fiscal
trimestre_fiscal
cierre_mes
```

## 0.4 Medidas base

Las medidas siguientes se reutilizan en todos los ejemplos:

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

El volumen utiliza el valor absoluto para representar dinero movilizado. No debe confundirse con el monto neto:

```DAX
Monto neto USD =
SUM ( fact_transaccion[monto_usd] )
```

---

# Tema 7. SUMMARIZE, ADDCOLUMNS y GROUPBY

## 7.1 La idea central

Las tres funciones producen tablas, pero responden a necesidades diferentes.

| Función | Acción principal | Pregunta que responde |
|---|---|---|
| `SUMMARIZE` | Agrupar filas | ¿Qué combinaciones únicas definen el resumen? |
| `ADDCOLUMNS` | Añadir expresiones a una tabla existente | ¿Qué cálculo corresponde a cada fila de esta tabla? |
| `GROUPBY` | Agrupar una tabla y agregar sus filas con `CURRENTGROUP` | ¿Cómo agrego una tabla intermedia por cada grupo? |

Una tabla virtual existe durante la evaluación de una expresión. No agrega filas almacenadas al modelo, salvo cuando la expresión se utiliza expresamente para crear una tabla calculada.

## 7.2 Granularidad antes de cálculo

Antes de escribir una función de tabla, complete esta frase:

```text
Cada fila de la tabla resultante representa __________________________.
```

Ejemplos:

- Un canal visible.
- Una combinación de año y canal.
- Un cliente dentro del contexto actual.
- Una combinación de año y mes elegida en una tabla desconectada.

La granularidad determina cuántas veces se evaluarán las expresiones posteriores.

## 7.3 Resumen por canal con SUMMARIZE

La expresión siguiente crea una **tabla calculada**:

```DAX
Resumen por canal =
SUMMARIZE (
    fact_transaccion,
    dim_canal[canal],
    "Transacciones", [Transacciones intentadas],
    "Volumen", [Volumen transaccional]
)
```

### Evaluación paso a paso

1. `SUMMARIZE` parte de `fact_transaccion`.
2. Usa la relación con `dim_canal` para acceder a `dim_canal[canal]`.
3. Forma una fila por cada canal existente en los datos.
4. Evalúa `[Transacciones intentadas]` para cada grupo.
5. Evalúa `[Volumen transaccional]` para el mismo grupo.
6. Devuelve una tabla con canal, transacciones y volumen.

Resultado conceptual:

| Canal | Transacciones | Volumen |
|---|---:|---:|
| App móvil | Conteo del canal | Volumen del canal |
| Banca web | Conteo del canal | Volumen del canal |
| Sucursal | Conteo del canal | Volumen del canal |

### Tabla calculada frente a tabla virtual

Si utiliza el código anterior desde **Modelado → Nueva tabla**, Power BI almacena el resultado durante la actualización. La tabla no cambia dinámicamente con los segmentadores del informe.

Si utiliza la misma lógica dentro de una variable de medida, la tabla sólo existe durante la evaluación y sí responde al contexto de la medida.

Ejemplo dentro de una medida:

```DAX
Canales con actividad =
VAR Resumen =
    SUMMARIZE (
        fact_transaccion,
        dim_canal[canal],
        "@Transacciones", [Transacciones intentadas]
    )
RETURN
    COUNTROWS (
        FILTER ( Resumen, [@Transacciones] > 0 )
    )
```

El prefijo `@` en columnas virtuales es una convención útil. Permite reconocer que la columna existe solamente dentro de la expresión.

## 7.4 Enriquecer una lista con ADDCOLUMNS

```DAX
Canales con tasa =
ADDCOLUMNS (
    VALUES ( dim_canal[canal] ),
    "@Tasa rechazo", [Tasa de rechazo]
)
```

### Qué ocurre

1. `VALUES` crea una lista con los canales visibles.
2. `ADDCOLUMNS` recorre la lista.
3. Cada canal se convierte en la fila actual.
4. La medida `[Tasa de rechazo]` activa una transición de contexto implícita.
5. La tasa se calcula para el canal actual.
6. La tabla conserva la columna `canal` y añade `@Tasa rechazo`.

`ADDCOLUMNS` no agrupa nuevamente la tabla. Mantiene la granularidad de la tabla que recibe.

## 7.5 Medida construida con ADDCOLUMNS

Una tabla virtual puede alimentar un cálculo escalar:

```DAX
Promedio simple de tasa por canal =
VAR CanalesConTasa =
    ADDCOLUMNS (
        VALUES ( dim_canal[canal] ),
        "@Tasa rechazo", [Tasa de rechazo]
    )
RETURN
    AVERAGEX (
        CanalesConTasa,
        [@Tasa rechazo]
    )
```

Esta medida asigna el mismo peso a cada canal. No equivale a la tasa de rechazo global.

Compare:

```DAX
Tasa de rechazo global =
DIVIDE (
    [Transacciones rechazadas],
    [Transacciones intentadas]
)
```

La tasa global pondera implícitamente por el número de transacciones. El promedio simple por canal otorga el mismo peso a un canal pequeño y a uno grande.

## 7.6 GROUPBY y CURRENTGROUP

`GROUPBY` resulta útil cuando necesita agrupar una tabla intermedia y recorrer las filas de cada grupo.

```DAX
Volumen por canal agrupado =
VAR Base =
    SELECTCOLUMNS (
        fact_transaccion,
        "CanalID", fact_transaccion[canal_id],
        "MontoAbs", ABS ( fact_transaccion[monto_usd] )
    )
RETURN
    GROUPBY (
        Base,
        [CanalID],
        "Volumen", SUMX ( CURRENTGROUP (), [MontoAbs] )
    )
```

### Evaluación paso a paso

1. `SELECTCOLUMNS` crea una tabla con canal y monto absoluto.
2. `GROUPBY` forma un grupo por `CanalID`.
3. `CURRENTGROUP()` representa las filas del grupo actual.
4. `SUMX` recorre esas filas y suma `MontoAbs`.
5. El resultado contiene una fila por canal.

`CURRENTGROUP()` sólo se utiliza dentro de expresiones de extensión de `GROUPBY`. No es una tabla general que pueda invocarse en cualquier medida.

## 7.7 Cuándo elegir cada función

```text
¿Necesito definir grupos a partir de columnas del modelo?
└── SUMMARIZE

¿Ya tengo la tabla con el grano correcto y quiero añadir cálculos?
└── ADDCOLUMNS

¿Tengo una tabla intermedia y necesito agregar las filas de cada grupo?
└── GROUPBY + CURRENTGROUP
```

En medidas de negocio, `ADDCOLUMNS` sobre `VALUES` o `SUMMARIZE` suele hacer explícita la granularidad y facilitar la lectura.

## 7.8 Errores frecuentes

- Crear una tabla calculada y esperar que cambie con los segmentadores.
- Añadir columnas antes de definir correctamente la granularidad.
- Promediar tasas por grupo sin decidir si el promedio debe ser simple o ponderado.
- Utilizar `GROUPBY` cuando una medida sobre `SUMMARIZE` o `ADDCOLUMNS` expresa la intención con mayor claridad.
- Confundir una columna virtual con una columna física del modelo.

---

# Tema 8. CALCULATETABLE y tablas virtuales

## 8.1 Diferencia entre CALCULATE y CALCULATETABLE

```DAX
CALCULATE (
    <expresión escalar>,
    <filtros>
)
```

```DAX
CALCULATETABLE (
    <expresión de tabla>,
    <filtros>
)
```

Las dos funciones modifican el contexto con reglas equivalentes. La diferencia es el tipo de resultado:

- `CALCULATE` devuelve un valor escalar.
- `CALCULATETABLE` devuelve una tabla.

La tabla resultante puede utilizarse en `COUNTROWS`, `SUMX`, `FILTER`, `INTERSECT`, `EXCEPT`, `CONCATENATEX` u otras funciones que acepten tablas.

## 8.2 Clientes con alto volumen

```DAX
Clientes alto volumen =
VAR ClientesConVolumen =
    ADDCOLUMNS (
        VALUES ( dim_cliente[cliente_id] ),
        "@Volumen", [Volumen transaccional]
    )
VAR Seleccion =
    FILTER (
        ClientesConVolumen,
        [@Volumen] >= 10000
    )
RETURN
    COUNTROWS ( Seleccion )
```

### Evaluación paso a paso

1. `VALUES` obtiene los clientes visibles.
2. `ADDCOLUMNS` evalúa el volumen de cada cliente.
3. La tabla `ClientesConVolumen` tiene una fila por cliente.
4. `FILTER` conserva clientes cuyo volumen agregado alcanza 10,000 USD.
5. `COUNTROWS` cuenta los clientes seleccionados.

La condición no busca transacciones individuales superiores a 10,000 USD. Busca clientes cuyo volumen agregado dentro del contexto alcanza ese umbral.

Compare con esta medida, que responde otra pregunta:

```DAX
Transacciones de alto importe =
CALCULATE (
    [Transacciones intentadas],
    FILTER (
        fact_transaccion,
        ABS ( fact_transaccion[monto_usd] ) >= 10000
    )
)
```

| Medida | Granularidad evaluada |
|---|---|
| `Clientes alto volumen` | Cliente agregado |
| `Transacciones de alto importe` | Transacción individual |

## 8.3 Clientes digitales activos con CALCULATETABLE

```DAX
Clientes digitales activos =
VAR Clientes =
    CALCULATETABLE (
        VALUES ( fact_transaccion[cliente_principal_id] ),
        dim_canal[digital] = 1,
        fact_transaccion[estado] = "Contabilizada"
    )
RETURN
    COUNTROWS ( Clientes )
```

### Contexto de evaluación

La medida conserva filtros externos como:

- Fecha.
- País.
- Producto.
- Segmento.
- Sucursal.

Después agrega:

- `dim_canal[digital] = 1`.
- `fact_transaccion[estado] = "Contabilizada"`.

La tabla virtual contiene los identificadores de clientes que cumplen la intersección completa.

## 8.4 Versión desde la dimensión cliente

También puede construir la lista desde la dimensión:

```DAX
Clientes digitales activos desde dimensión =
VAR Clientes =
    CALCULATETABLE (
        VALUES ( dim_cliente[cliente_id] ),
        dim_canal[digital] = 1,
        fact_transaccion[estado] = "Contabilizada"
    )
RETURN
    COUNTROWS ( Clientes )
```

Sin embargo, esta versión requiere atención. En un modelo con filtros unidireccionales desde dimensiones hacia hechos, filtrar el hecho no necesariamente reduce la lista visible de la dimensión cliente.

Para contar clientes con actividad, la versión basada en la clave del hecho resulta más directa:

```DAX
VALUES ( fact_transaccion[cliente_principal_id] )
```

Esta diferencia muestra por qué la dirección de las relaciones importa incluso dentro de tablas virtuales.

## 8.5 Tabla virtual para diagnóstico

Durante el desarrollo puede convertir temporalmente una tabla virtual en texto:

```DAX
Muestra clientes digitales =
VAR Clientes =
    CALCULATETABLE (
        VALUES ( fact_transaccion[cliente_principal_id] ),
        dim_canal[digital] = 1,
        fact_transaccion[estado] = "Contabilizada"
    )
VAR PrimerosClientes =
    TOPN (
        5,
        Clientes,
        fact_transaccion[cliente_principal_id],
        ASC
    )
RETURN
    CONCATENATEX (
        PrimerosClientes,
        fact_transaccion[cliente_principal_id],
        ", "
    )
```

Esta medida no constituye un KPI final. Sirve para verificar qué identificadores forman el conjunto.

## 8.6 Variables de tabla

Las variables ayudan a separar etapas:

```text
Lista inicial
↓
Enriquecimiento
↓
Selección
↓
Agregación final
```

Ventajas:

- Facilitan la lectura.
- Evitan repetir expresiones.
- Permiten inspeccionar cada etapa durante el desarrollo.
- Hacen visible la granularidad de la lógica.

## 8.7 Errores frecuentes

- Aplicar el umbral al nivel equivocado.
- Contar filas de una dimensión cuando la pregunta exige clientes con actividad.
- Esperar que una variable de tabla aparezca físicamente en el modelo.
- Construir una tabla muy amplia cuando sólo se necesitan una clave y una expresión.
- Repetir la misma tabla virtual varias veces en vez de guardarla en una variable.

---

# Tema 9. TREATAS y relaciones virtuales

## 9.1 Qué problema resuelve

Una tabla desconectada puede alimentar segmentadores, parámetros o escenarios sin introducir una relación física en el modelo.

Suponga esta tabla:

```DAX
selector_pais =
SELECTCOLUMNS (
    DISTINCT ( dim_cliente[pais_residencia] ),
    "pais", dim_cliente[pais_residencia]
)
```

Para fines didácticos, mantenga `selector_pais` sin relación con el resto del modelo.

Un segmentador basado en `selector_pais[pais]` no filtrará automáticamente las transacciones. `TREATAS` puede proyectar esa selección sobre una columna relacionada.

## 9.2 País seleccionado con TREATAS

```DAX
Volumen país seleccionado =
CALCULATE (
    [Volumen transaccional],
    TREATAS (
        VALUES ( selector_pais[pais] ),
        dim_cliente[pais_residencia]
    )
)
```

### Evaluación paso a paso

1. El usuario selecciona uno o varios países en `selector_pais`.
2. `VALUES` obtiene esa lista.
3. `TREATAS` interpreta los valores como filtros de `dim_cliente[pais_residencia]`.
4. La relación física de cliente propaga el filtro hacia `fact_transaccion`.
5. `[Volumen transaccional]` se evalúa en el nuevo contexto.

La relación virtual existe solamente durante la evaluación de la medida.

## 9.3 Prueba visual

Construya una página con:

- Segmentador: `selector_pais[pais]`.
- Tarjeta: `[Volumen transaccional]`.
- Tarjeta: `[Volumen país seleccionado]`.
- Matriz por `dim_canal[canal]`.

Resultado esperado:

- La medida base no responde al selector desconectado.
- La medida con `TREATAS` sí responde.
- Los filtros de canal, fecha y producto continúan aplicándose.

## 9.4 Selección múltiple

`TREATAS` acepta una tabla con varios valores:

```text
selector_pais = {México, Chile}
```

La función proyecta ambos países sobre `dim_cliente[pais_residencia]`. El resultado equivale a aplicar un filtro que permite México o Chile.

## 9.5 TREATAS con varias columnas

Una relación virtual puede utilizar una clave compuesta.

Suponga una tabla desconectada `selector_periodo` con:

```text
anio
mes_numero
```

La medida puede proyectar ambas columnas:

```DAX
Volumen periodo objetivo =
CALCULATE (
    [Volumen transaccional],
    TREATAS (
        SUMMARIZE (
            selector_periodo,
            selector_periodo[anio],
            selector_periodo[mes_numero]
        ),
        dim_fecha[anio],
        dim_fecha[mes_numero]
    )
)
```

Reglas:

1. La cantidad de columnas de origen y destino debe coincidir.
2. El orden debe coincidir.
3. Los tipos de datos deben ser compatibles.
4. Las combinaciones inexistentes producen un conjunto vacío.

Por tanto:

```text
selector_periodo[anio]       → dim_fecha[anio]
selector_periodo[mes_numero] → dim_fecha[mes_numero]
```

## 9.6 TREATAS frente a una relación física

Use una relación física cuando:

- La relación forma parte estable del modelo.
- Muchas medidas dependen de ella.
- La navegación y propagación deben ser naturales para todos los usuarios.
- La cardinalidad y dirección pueden definirse sin ambigüedad.

Considere `TREATAS` cuando:

- La tabla funciona como selector o parámetro.
- La relación se necesita sólo en ciertas medidas.
- La relación física introduciría una ruta ambigua.
- La selección debe proyectarse sobre distintas columnas según la medida.

`TREATAS` no debe utilizarse para ocultar un diseño deficiente del modelo. Una relación estable y legítima pertenece normalmente al modelo físico.

## 9.7 Intersección o reemplazo

Como argumento de `CALCULATE`, `TREATAS` puede reemplazar filtros existentes sobre las columnas destino. Si necesita conservarlos e intersectar, utilice `KEEPFILTERS`:

```DAX
Volumen país seleccionado visible =
CALCULATE (
    [Volumen transaccional],
    KEEPFILTERS (
        TREATAS (
            VALUES ( selector_pais[pais] ),
            dim_cliente[pais_residencia]
        )
    )
)
```

La elección depende de la intención de negocio:

- Reemplazo: el selector desconectado controla el país de la medida.
- Intersección: el selector sólo puede reducir la selección ya existente.

## 9.8 Errores frecuentes

- Proyectar texto sobre una columna numérica.
- Invertir el orden en una proyección de varias columnas.
- Esperar que todas las medidas respondan al selector desconectado.
- Crear relaciones virtuales diferentes sin documentar qué selector controla cada KPI.
- Usar `TREATAS` donde una relación física sería más clara y reutilizable.

---

# Tema 10. Inteligencia temporal avanzada

## 10.1 Roles de fecha

Una transacción puede tener varias fechas:

- Fecha de operación: cuándo solicitó o ejecutó el cliente el movimiento.
- Fecha de contabilización: cuándo quedó registrado contablemente.

Ambas fechas son válidas, pero responden preguntas diferentes.

| Pregunta | Fecha apropiada |
|---|---|
| ¿Cuándo realizó el cliente la operación? | Fecha de operación |
| ¿Cuándo afectó el movimiento los registros contables? | Fecha de contabilización |
| ¿Cuánto tardó la contabilización? | Ambas fechas |

La medida debe dejar claro qué rol utiliza.

## 10.2 Relación inactiva con USERELATIONSHIP

La relación activa utiliza `fecha_operacion_id`. Para analizar la fecha de contabilización:

```DAX
Transacciones por contabilización =
CALCULATE (
    [Transacciones intentadas],
    USERELATIONSHIP (
        fact_transaccion[fecha_contabilizacion_id],
        dim_fecha[fecha_id]
    )
)
```

### Qué ocurre

1. El visual filtra `dim_fecha`.
2. `USERELATIONSHIP` activa la relación de contabilización durante la medida.
3. El filtro de fecha alcanza `fact_transaccion` mediante esa relación.
4. La medida cuenta transacciones por fecha de contabilización.

La relación del modelo permanece inactiva fuera de la medida.

## 10.3 Comparación entre roles de fecha

Cree una matriz con:

- Filas: `dim_fecha[anio_mes]`.
- Valores: `[Transacciones intentadas]` y `[Transacciones por contabilización]`.

Las medidas pueden diferir cerca de cierres mensuales. Una operación realizada al final de un mes puede contabilizarse durante el mes siguiente.

No interprete la diferencia como un error sin revisar primero el rol de fecha.

## 10.4 Ventana móvil de 90 días

```DAX
Volumen últimos 90 días =
VAR FechaMaxima =
    MAX ( dim_fecha[fecha] )
RETURN
    CALCULATE (
        [Volumen transaccional],
        DATESINPERIOD (
            dim_fecha[fecha],
            FechaMaxima,
            -90,
            DAY
        )
    )
```

### Evaluación paso a paso

1. `MAX(dim_fecha[fecha])` obtiene la última fecha del contexto actual.
2. `DATESINPERIOD` construye un conjunto de fechas hacia atrás.
3. `CALCULATE` reemplaza el filtro temporal por esa ventana.
4. `[Volumen transaccional]` se calcula para las fechas de la ventana.

En una gráfica, la fecha máxima cambia en cada punto. Por ello, la ventana se desplaza.

## 10.5 Noventa días frente a tres meses

Estas ventanas no siempre son equivalentes:

```DAX
Volumen últimos 3 meses =
VAR FechaMaxima =
    MAX ( dim_fecha[fecha] )
RETURN
    CALCULATE (
        [Volumen transaccional],
        DATESINPERIOD (
            dim_fecha[fecha],
            FechaMaxima,
            -3,
            MONTH
        )
    )
```

- Noventa días representa una duración fija.
- Tres meses sigue límites y longitudes de meses del calendario.

La definición debe elegirse según la pregunta de negocio.

## 10.6 Días hábiles corporativos

```DAX
Volumen días hábiles =
CALCULATE (
    [Volumen transaccional],
    KEEPFILTERS ( dim_fecha[es_dia_habil] = 1 )
)
```

La dimensión de fechas ya contiene fines de semana y feriados corporativos. La medida no necesita reconstruir esas reglas.

`KEEPFILTERS` intersecta la condición de día hábil con la selección del usuario.

Puede construir la contraparte:

```DAX
Volumen días no hábiles =
CALCULATE (
    [Volumen transaccional],
    KEEPFILTERS ( dim_fecha[es_dia_habil] = 0 )
)
```

## 10.7 YTD fiscal

Si el año fiscal termina el 31 de octubre, una medida ilustrativa es:

```DAX
Volumen YTD fiscal =
CALCULATE (
    [Volumen transaccional],
    DATESYTD (
        dim_fecha[fecha],
        "10/31"
    )
)
```

> **Importante:** confirme la fecha real de cierre fiscal y el comportamiento regional del literal de fecha antes de llevar la medida a producción.

Cuando el calendario ya contiene atributos fiscales corporativos, otra opción consiste en trabajar directamente con `anio_fiscal` y `periodo_fiscal`, especialmente si el calendario fiscal no puede expresarse mediante una sola fecha de cierre.

## 10.8 Medida de días de contabilización

Una columna calculada didáctica puede mostrar la diferencia entre las dos fechas:

```DAX
Días hasta contabilización =
VAR FechaOperacion =
    RELATED ( dim_fecha[fecha] )
VAR FechaContabilizacion =
    LOOKUPVALUE (
        dim_fecha[fecha],
        dim_fecha[fecha_id],
        fact_transaccion[fecha_contabilizacion_id]
    )
RETURN
    DATEDIFF (
        FechaOperacion,
        FechaContabilizacion,
        DAY
    )
```

Esta columna se calcula al refrescar. Para un modelo grande, también puede prepararse en Power Query.

## 10.9 Errores frecuentes

- Aplicar inteligencia temporal sobre la fecha del hecho sin una dimensión continua.
- No marcar la tabla de fechas.
- Confundir fecha de operación con fecha de contabilización.
- Comparar una ventana fija de días con meses de calendario como si fueran equivalentes.
- Codificar feriados directamente en cada medida.
- Usar una regla fiscal sin validar la política corporativa.

---

# Tema 11. Análisis YoY, MoM y YTD

## 11.1 Definiciones

| Sigla | Nombre | Comparación |
|---|---|---|
| YoY | Year over Year | Periodo actual frente al mismo periodo del año anterior |
| MoM | Month over Month | Mes actual frente al mes inmediatamente anterior |
| YTD | Year to Date | Acumulado desde el inicio del año hasta la fecha visible |

Estas comparaciones requieren una medida base y una dimensión de fechas correcta.

## 11.2 Año anterior

```DAX
Volumen año anterior =
CALCULATE (
    [Volumen transaccional],
    DATEADD (
        dim_fecha[fecha],
        -1,
        YEAR
    )
)
```

Lectura:

> Evalúa el volumen usando el conjunto de fechas situado un año antes del contexto actual.

Si una fila de la matriz representa marzo de un año, la medida busca marzo del año anterior.

## 11.3 Mes anterior

```DAX
Volumen mes anterior =
CALCULATE (
    [Volumen transaccional],
    DATEADD (
        dim_fecha[fecha],
        -1,
        MONTH
    )
)
```

En una matriz por mes, cada fila recibe el volumen del mes inmediatamente anterior.

En el primer mes disponible, la medida debe permanecer en blanco porque no existe una base comparable dentro del modelo.

## 11.4 Acumulado YTD

```DAX
Volumen YTD =
TOTALYTD (
    [Volumen transaccional],
    dim_fecha[fecha]
)
```

`TOTALYTD` acumula desde el inicio del año hasta la última fecha del contexto.

Versión equivalente y más explícita:

```DAX
Volumen YTD con DATESYTD =
CALCULATE (
    [Volumen transaccional],
    DATESYTD ( dim_fecha[fecha] )
)
```

## 11.5 YTD del año anterior

```DAX
Volumen YTD año anterior =
CALCULATE (
    [Volumen YTD],
    DATEADD (
        dim_fecha[fecha],
        -1,
        YEAR
    )
)
```

La medida reutiliza `[Volumen YTD]` y desplaza el contexto un año.

Si el periodo actual llega hasta cierta fecha, el comparable debe representar el mismo avance del año anterior. Esto evita comparar un año parcial con un año completo.

## 11.6 Medidas para transacciones

El patrón puede reutilizarse con cualquier medida base:

```DAX
Transacciones año anterior =
CALCULATE (
    [Transacciones intentadas],
    DATEADD ( dim_fecha[fecha], -1, YEAR )
)
```

```DAX
Tasa de rechazo año anterior =
CALCULATE (
    [Tasa de rechazo],
    DATEADD ( dim_fecha[fecha], -1, YEAR )
)
```

En el segundo caso, DAX recalcula tanto numerador como denominador dentro del periodo anterior. No desplaza una tasa almacenada.

## 11.7 Selección de la comparación

| Pregunta | Comparación recomendada | Visual sugerido |
|---|---|---|
| ¿Cómo cambia el comportamiento estructural? | YoY | Serie mensual o tabla por año |
| ¿Qué cambió recientemente? | MoM | Serie o matriz mensual |
| ¿Cómo avanza el año? | YTD y YTD anterior | Línea acumulada o tarjetas comparables |
| ¿Cómo cambia la calidad operativa? | Tasa actual y tasa anterior | Matriz por canal o producto |

No utilice una comparación sólo porque está disponible. El periodo comparable debe coincidir con la pregunta.

## 11.8 Matriz de validación temporal

Construya una matriz con:

- Filas: `dim_fecha[anio]` y `dim_fecha[mes_numero]`.
- Valores:
  - `[Volumen transaccional]`.
  - `[Volumen mes anterior]`.
  - `[Volumen año anterior]`.
  - `[Volumen YTD]`.
  - `[Volumen YTD año anterior]`.

Valide:

1. El mes anterior de enero corresponde a diciembre del año previo.
2. El año anterior conserva el mismo mes.
3. YTD aumenta o permanece igual conforme avanza el año si el volumen nunca es negativo.
4. El acumulado se reinicia al comenzar un año.
5. Los periodos sin base histórica permanecen en blanco.

## 11.9 Contextos parciales

Si el usuario selecciona días incompletos dentro de un mes, `DATEADD` desplaza el conjunto de fechas seleccionado. Esto puede generar una comparación parcial.

Antes de publicar un KPI mensual, determine si la selección debe comparar:

- Días transcurridos equivalentes.
- Meses cerrados completos.
- Última fecha disponible en cada periodo.

La función DAX no sustituye la definición del corte de negocio.

## 11.10 Errores frecuentes

- Comparar un periodo parcial con uno completo.
- Usar el nombre del mes sin el año y mezclar varios años.
- Ordenar `mes_nombre` alfabéticamente en vez de usar `mes_numero`.
- Interpretar un blanco del primer periodo como cero.
- Aplicar `DATEADD` sobre una columna que no pertenece a una tabla de fechas válida.

---

# Tema 12. Variaciones absolutas y porcentuales

## 12.1 Variación absoluta

```DAX
Variación vs año anterior =
[Volumen transaccional]
    - [Volumen año anterior]
```

La medida conserva la unidad del KPI base. En este caso, expresa dólares de volumen.

Interpretación:

```text
Resultado positivo → el volumen actual supera la base.
Resultado negativo → el volumen actual se encuentra por debajo de la base.
Resultado cero     → ambos periodos tienen el mismo volumen.
Resultado en blanco → falta el valor actual o comparable.
```

## 12.2 Variación porcentual

```DAX
Variación % vs año anterior =
DIVIDE (
    [Variación vs año anterior],
    [Volumen año anterior]
)
```

La medida responde:

> ¿Qué tamaño tiene el cambio respecto al volumen del año anterior?

Ejemplo conceptual:

```text
Volumen actual:       120
Volumen anterior:     100
Variación absoluta:    20
Variación porcentual:  20 %
```

## 12.3 Medidas MoM

```DAX
Variación vs mes anterior =
[Volumen transaccional]
    - [Volumen mes anterior]
```

```DAX
Variación % vs mes anterior =
DIVIDE (
    [Variación vs mes anterior],
    [Volumen mes anterior]
)
```

El patrón permanece igual. Sólo cambia la medida que representa la base.

## 12.4 Variaciones de tasas

Para tasas, conviene distinguir puntos porcentuales de cambio relativo.

```DAX
Cambio tasa rechazo pp =
[Tasa de rechazo]
    - [Tasa de rechazo año anterior]
```

Si la tasa pasa de 4 % a 5 %:

- Cambio en puntos porcentuales: 1 punto porcentual.
- Cambio relativo: 25 %.

El cambio relativo puede calcularse como:

```DAX
Cambio relativo tasa rechazo =
DIVIDE (
    [Tasa de rechazo] - [Tasa de rechazo año anterior],
    [Tasa de rechazo año anterior]
)
```

No presente ambos resultados con la misma etiqueta.

## 12.5 Bases vacías y bases iguales a cero

Una versión controlada puede distinguir comparaciones no disponibles:

```DAX
Variación % controlada =
VAR Base =
    [Volumen año anterior]
VAR Cambio =
    [Volumen transaccional] - Base
RETURN
    IF (
        ISBLANK ( Base ) || Base = 0,
        BLANK (),
        DIVIDE ( Cambio, Base )
    )
```

### Por qué no devolver cero automáticamente

- Base vacía significa que no existe periodo comparable.
- Base igual a cero hace que el porcentaje no tenga una interpretación estable.
- Variación igual a cero significa que el valor actual y la base son iguales.

Estos tres estados no son equivalentes.

## 12.6 El cambio absoluto puede seguir siendo útil

Si la base es cero y el valor actual es 1,000:

```text
Variación absoluta = 1,000
Variación porcentual = no aplicable
```

El cambio absoluto comunica el incremento. La variación porcentual no puede expresar un crecimiento desde una base igual a cero de forma estable.

## 12.7 Formato condicional

Después de validar la lógica, puede aplicar color a la variación:

- Rojo para deterioro.
- Gris para cambios pequeños o neutrales.
- Otro tono permitido por el diseño para mejora.

Sin embargo, el significado del signo depende del KPI:

| KPI | Positivo suele significar |
|---|---|
| Volumen | Mayor actividad |
| Comisiones | Mayor ingreso, aunque requiere contexto |
| Tasa de rechazo | Deterioro operativo |
| Alertas de fraude | Mayor exposición o mayor detección |

No aplique una regla universal donde positivo siempre sea favorable.

## 12.8 Matriz de desempeño temporal

Construya una matriz con:

| Columna | Medida |
|---|---|
| Actual | `[Volumen transaccional]` |
| Base | `[Volumen año anterior]` |
| Cambio | `[Variación vs año anterior]` |
| Cambio % | `[Variación % controlada]` |

Filas recomendadas:

```text
dim_fecha[anio]
dim_fecha[mes_numero]
dim_fecha[mes_nombre]
```

Ordene `mes_nombre` mediante `mes_numero`.

## 12.9 Variación YTD

```DAX
Variación YTD =
[Volumen YTD]
    - [Volumen YTD año anterior]
```

```DAX
Variación % YTD =
DIVIDE (
    [Variación YTD],
    [Volumen YTD año anterior]
)
```

Estas medidas comparan avances acumulados equivalentes, no años completos.

## 12.10 Errores frecuentes

- Dividir por el valor actual en vez de la base.
- Etiquetar puntos porcentuales como porcentaje relativo.
- Reemplazar blancos por cero sin revisar la causa.
- Aplicar el mismo significado de color a todos los KPIs.
- Calcular la variación antes de validar que los periodos son comparables.

---

# Ejercicio integrador

## Objetivo

Construir una página de análisis temporal que combine tablas virtuales, una relación virtual y medidas de comparación.

La página debe responder:

1. ¿Cómo cambia el volumen respecto al año anterior?
2. ¿Cuántos clientes superan el umbral de volumen?
3. ¿Cómo cambia el resultado al seleccionar un país desde una tabla desconectada?
4. ¿Qué diferencia existe entre fecha de operación y contabilización?

## Paso 1. Crear la tabla desconectada

```DAX
selector_pais =
SELECTCOLUMNS (
    DISTINCT ( dim_cliente[pais_residencia] ),
    "pais", dim_cliente[pais_residencia]
)
```

No cree una relación física para esta tabla.

## Paso 2. Aplicar el país seleccionado

```DAX
Volumen país seleccionado =
CALCULATE (
    [Volumen transaccional],
    TREATAS (
        VALUES ( selector_pais[pais] ),
        dim_cliente[pais_residencia]
    )
)
```

## Paso 3. Crear los comparables

```DAX
Volumen país año anterior =
CALCULATE (
    [Volumen país seleccionado],
    DATEADD ( dim_fecha[fecha], -1, YEAR )
)
```

```DAX
Variación país vs año anterior =
[Volumen país seleccionado]
    - [Volumen país año anterior]
```

```DAX
Variación % país vs año anterior =
DIVIDE (
    [Variación país vs año anterior],
    [Volumen país año anterior]
)
```

## Paso 4. Construir el segmento de clientes

```DAX
Clientes alto volumen país =
VAR ClientesConVolumen =
    ADDCOLUMNS (
        VALUES ( fact_transaccion[cliente_principal_id] ),
        "@Volumen", [Volumen país seleccionado]
    )
VAR Seleccion =
    FILTER (
        ClientesConVolumen,
        [@Volumen] >= 10000
    )
RETURN
    COUNTROWS ( Seleccion )
```

Durante la revisión, confirme que el filtro virtual del país participa en la medida evaluada para cada cliente.

## Paso 5. Comparar roles de fecha

```DAX
Volumen por contabilización =
CALCULATE (
    [Volumen transaccional],
    USERELATIONSHIP (
        fact_transaccion[fecha_contabilizacion_id],
        dim_fecha[fecha_id]
    )
)
```

```DAX
Diferencia operación vs contabilización =
[Volumen transaccional]
    - [Volumen por contabilización]
```

La diferencia mensual puede ser distinta de cero aunque el total general coincida.

## Paso 6. Diseñar la página

- Segmentador: `selector_pais`.
- Segmentador: año.
- Tarjeta: `[Volumen país seleccionado]`.
- Tarjeta: `[Variación % país vs año anterior]`.
- Tarjeta: `[Clientes alto volumen país]`.
- Matriz mensual:
  - Volumen actual.
  - Volumen año anterior.
  - Variación absoluta.
  - Variación porcentual.
- Gráfica mensual:
  - Volumen por fecha de operación.
  - Volumen por fecha de contabilización.

## Paso 7. Validaciones

1. El selector desconectado sólo afecta las medidas que utilizan `TREATAS`.
2. La suma de los países seleccionados coincide con el resultado de la medida virtual.
3. El primer periodo sin historia devuelve blanco en la comparación.
4. La variación absoluta equivale a actual menos base.
5. La variación porcentual utiliza la base como denominador.
6. El conteo de clientes aplica el umbral al agregado por cliente.
7. La medida de contabilización usa la relación inactiva.

---

# Lista de validación técnica

## Tablas virtuales

- Cada variable de tabla tiene una granularidad explicable.
- `ADDCOLUMNS` parte de una tabla con el grano correcto.
- `GROUPBY` utiliza `CURRENTGROUP()` solamente dentro de su agregación.
- Las columnas virtuales tienen nombres claros.
- Una tabla calculada no se presenta como si respondiera a segmentadores.

## CALCULATETABLE

- La expresión inicial devuelve una tabla.
- Los filtros añadidos están documentados.
- La lista se construye desde la dimensión o el hecho según la pregunta.
- La agregación final utiliza la tabla virtual correcta.

## TREATAS

- La tabla de origen permanece desconectada por diseño.
- Los tipos de datos de origen y destino coinciden.
- El orden de columnas coincide en relaciones virtuales compuestas.
- La medida define si debe reemplazar o intersectar filtros existentes.
- La relación virtual no sustituye innecesariamente una relación física estable.

## Tiempo

- `dim_fecha` contiene fechas únicas y continuas.
- La tabla está marcada como tabla de fechas.
- La relación activa utiliza fecha de operación.
- La relación inactiva utiliza fecha de contabilización.
- Los atributos fiscales y días hábiles provienen del calendario corporativo.
- Las ventanas se definen como días o meses de forma explícita.

## Comparaciones y variaciones

- El periodo actual y la base tienen cortes comparables.
- La variación absoluta conserva la unidad del KPI.
- La variación porcentual divide entre la base.
- Los blancos y las bases iguales a cero reciben un tratamiento deliberado.
- Los cambios de tasas distinguen porcentaje relativo y puntos porcentuales.
- El formato condicional respeta el significado de cada KPI.

---

# Tabla de diagnóstico

| Síntoma | Causa probable | Revisión recomendada |
|---|---|---|
| La tabla calculada no cambia con los segmentadores | Se materializó durante la actualización | Utilizar una variable de tabla dentro de una medida |
| El promedio por canal no coincide con la tasa global | Se está calculando un promedio simple de tasas | Confirmar si se necesita ponderación |
| El conteo de clientes incluye clientes sin actividad | La lista se construyó desde la dimensión | Construir la lista desde la clave del hecho |
| El selector desconectado no cambia el resultado | La medida no utiliza `TREATAS` | Revisar la proyección hacia la columna destino |
| `TREATAS` devuelve vacío | Tipos, orden o valores incompatibles | Comparar columnas de origen y destino |
| YoY devuelve blancos inesperados | Falta historial o la tabla de fechas no es válida | Revisar cobertura, continuidad y relación |
| YTD compara contra un año completo | La medida comparable no conserva el mismo corte | Usar YTD del año anterior |
| La variación porcentual es infinita o poco interpretable | La base es cero | Devolver blanco y conservar el cambio absoluto |
| La medida mensual cambia según el rol de fecha | Operación y contabilización caen en meses distintos | Confirmar la fecha que responde la pregunta |
| El orden de meses es incorrecto | Se ordenó texto alfabéticamente | Ordenar `mes_nombre` por `mes_numero` |

---

# Mapa de decisión

```text
¿Necesito una tabla resumida?
├── Definir grupos con columnas del modelo
│   └── SUMMARIZE
├── Añadir cálculos a una lista existente
│   └── ADDCOLUMNS
└── Agregar una tabla intermedia por grupo
    └── GROUPBY + CURRENTGROUP

¿Necesito modificar filtros y devolver una tabla?
└── CALCULATETABLE

¿Necesito aplicar una selección desconectada?
└── TREATAS
    └── KEEPFILTERS si debe intersectarse con el filtro existente

¿El hecho tiene más de una fecha?
└── USERELATIONSHIP para activar el rol inactivo

¿Necesito comparar periodos?
├── Año anterior
│   └── DATEADD con YEAR
├── Mes anterior
│   └── DATEADD con MONTH
├── Acumulado anual
│   └── TOTALYTD o DATESYTD
└── Ventana móvil
    └── DATESINPERIOD

¿Necesito expresar el cambio?
├── Impacto en unidades
│   └── Actual menos base
└── Magnitud relativa
    └── Cambio dividido entre base
```

---

# Resultado de aprendizaje esperado

Al terminar estos temas, el alumno debe poder:

- Construir tablas virtuales con una granularidad explícita.
- Elegir entre `SUMMARIZE`, `ADDCOLUMNS` y `GROUPBY`.
- Utilizar `CALCULATETABLE` para producir conjuntos filtrados.
- Aplicar selecciones desconectadas mediante `TREATAS`.
- Trabajar con varios roles de fecha mediante `USERELATIONSHIP`.
- Construir ventanas móviles y acumulados corporativos.
- Crear medidas YoY, MoM y YTD sobre una tabla de fechas válida.
- Calcular variaciones absolutas y porcentuales con una base correcta.
- Distinguir cero, blanco y resultado no aplicable.
- Explicar cada medida desde la granularidad, el contexto y el periodo comparable.

Una solución DAX se considera completa cuando el autor puede describir la tabla intermedia, el filtro aplicado, la fecha utilizada y el significado exacto del denominador.
