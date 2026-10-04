# Guía práctica de DAX avanzado: contextos y modificación de filtros

## Propósito

Esta guía desarrolla paso a paso los ejemplos de la presentación **DAX avanzado — temas 1 al 6**. El objetivo no es memorizar funciones, sino aprender a explicar por qué una medida devuelve cierto resultado.

Los ejemplos utilizan el caso de estudio de transacciones bancarias y cubren:

1. Contexto de fila y contexto de filtro.
2. Transición de contexto.
3. `CALCULATE` como motor analítico.
4. `FILTER` y modificación de contexto.
5. `ALL`, `ALLEXCEPT` y `ALLSELECTED`.
6. `VALUES`, `DISTINCT` y manejo de filtros.

> **Nota regional:** los ejemplos utilizan comas como separadores de argumentos. Si Power BI está configurado para usar punto y coma, sustituya cada coma por `;`.

---

## 0. Preparación del modelo

### Tablas utilizadas

| Tabla | Tipo | Grano | Campos principales |
|---|---|---|---|
| `fact_transaccion` | Hechos | Una fila por transacción | `transaccion_id`, fechas, claves dimensionales, `monto_usd`, `comision_usd`, `estado` |
| `dim_fecha` | Dimensión | Una fila por fecha | `fecha_id`, `fecha`, `anio`, `mes_nombre`, atributos fiscales |
| `dim_cliente` | Dimensión | Una fila por cliente | `cliente_id`, país, segmento, riesgo, nivel digital |
| `dim_canal` | Dimensión | Una fila por canal | `canal_id`, `canal`, `grupo_canal`, `digital` |
| `dim_producto` | Dimensión | Una fila por producto | `producto_id`, producto, familia y riesgo |
| `dim_sucursal` | Dimensión | Una fila por sucursal | `sucursal_id`, país, región, ciudad y formato |
| `dim_cuenta` | Dimensión | Una fila por cuenta | `cuenta_id`, estado, moneda y fecha de apertura |

### Relaciones mínimas

Configure relaciones de **uno a muchos**, con filtro en una sola dirección, desde cada dimensión hacia `fact_transaccion`:

```text
dim_fecha[fecha_id]       1 ──── * fact_transaccion[fecha_operacion_id]
dim_cliente[cliente_id]   1 ──── * fact_transaccion[cliente_principal_id]
dim_canal[canal_id]       1 ──── * fact_transaccion[canal_id]
dim_producto[producto_id] 1 ──── * fact_transaccion[producto_id]
dim_sucursal[sucursal_id] 1 ──── * fact_transaccion[sucursal_id]
dim_cuenta[cuenta_id]     1 ──── * fact_transaccion[cuenta_id]
```

La relación con `fecha_operacion_id` debe estar activa. La fecha de contabilización puede mantenerse como una relación inactiva para ejercicios posteriores de inteligencia temporal.

### Convención monetaria

El campo `monto_usd` conserva el signo del movimiento:

- Valores positivos: entradas, abonos o movimientos a favor.
- Valores negativos: salidas, cargos o movimientos en contra.
- **Monto neto:** suma con signo; permite observar el efecto financiero neto.
- **Volumen transaccional:** suma del valor absoluto; representa dinero movilizado sin cancelar entradas contra salidas.

Por ello, estas medidas responden preguntas diferentes:

```DAX
Monto neto USD =
SUM ( fact_transaccion[monto_usd] )
```

```DAX
Volumen transaccional =
SUMX (
    fact_transaccion,
    ABS ( fact_transaccion[monto_usd] )
)
```

### Medidas base

Cree primero una tabla exclusiva para medidas, si esa es la convención del modelo. Después agregue:

```DAX
Transacciones intentadas =
COUNTROWS ( fact_transaccion )
```

```DAX
Transacciones contabilizadas =
CALCULATE (
    [Transacciones intentadas],
    fact_transaccion[estado] = "Contabilizada"
)
```

```DAX
Comisiones USD =
SUM ( fact_transaccion[comision_usd] )
```

Formato recomendado:

- Cantidades: número entero con separador de miles.
- Importes: moneda USD con dos decimales.
- Tasas y participaciones: porcentaje con uno o dos decimales.

---

# Tema 1. Contexto de fila y contexto de filtro

## 1.1 La idea central

DAX nunca evalúa una expresión “en el vacío”. El resultado depende del contexto que exista en el momento de evaluación.

| Contexto | Pregunta útil | Aparece normalmente en |
|---|---|---|
| Fila | ¿Cuál es la fila actual? | Columnas calculadas e iteradores como `SUMX` y `FILTER` |
| Filtro | ¿Qué subconjunto del modelo está visible? | Medidas, visuales, segmentadores, relaciones y `CALCULATE` |

Una fila actual no equivale automáticamente a un filtro sobre otras tablas. Esta distinción será indispensable para entender la transición de contexto.

## 1.2 Contexto de fila en una columna calculada

En `fact_transaccion`, cree una **columna calculada**:

```DAX
Monto absoluto USD =
ABS ( fact_transaccion[monto_usd] )
```

### Evaluación paso a paso

1. Power BI se posiciona en una fila de `fact_transaccion`.
2. La expresión lee `fact_transaccion[monto_usd]` de esa fila.
3. `ABS` elimina el signo.
4. El resultado se almacena físicamente en la nueva columna.
5. El proceso se repite para todas las transacciones.

Ejemplo conceptual:

| Transacción | `monto_usd` | `Monto absoluto USD` |
|---|---:|---:|
| TX00000001 | -9,770.22 | 9,770.22 |
| TX00000002 | -619.07 | 619.07 |

La fórmula cambia de resultado porque existe una fila actual distinta en cada evaluación.

> **Decisión de modelado:** esta columna es didáctica. Para reducir el tamaño del modelo, normalmente conviene calcular el valor absoluto dentro de una medida con `SUMX`, salvo que la columna sea necesaria para segmentar, relacionar o reutilizarse intensamente.

## 1.3 Contexto de fila creado por un iterador

`SUMX` recibe una tabla, recorre sus filas y evalúa una expresión en cada una:

```DAX
Volumen transaccional =
SUMX (
    fact_transaccion,
    ABS ( fact_transaccion[monto_usd] )
)
```

Lectura en lenguaje natural:

> Recorre las transacciones visibles, obtiene el valor absoluto de cada monto y suma los resultados.

El contexto de filtro decide qué filas de `fact_transaccion` llegan al iterador; el contexto de fila permite leer el monto de cada una.

## 1.4 Contexto de filtro en una medida

```DAX
Transacciones contabilizadas =
CALCULATE (
    COUNTROWS ( fact_transaccion ),
    fact_transaccion[estado] = "Contabilizada"
)
```

Suponga una tarjeta colocada en una página con estas selecciones:

- Año: un año específico.
- País: México.
- Canal: App móvil.

La medida se evalúa así:

1. El segmentador de año filtra `dim_fecha`.
2. La relación lleva ese filtro a `fact_transaccion`.
3. País y canal hacen lo mismo desde sus dimensiones.
4. `CALCULATE` añade el estado “Contabilizada”.
5. `COUNTROWS` cuenta solamente la intersección resultante.

Puede representarse como:

```text
Fecha elegida
∩ País = México
∩ Canal = App móvil
∩ Estado = Contabilizada
= filas contadas por la medida
```

## 1.5 Práctica guiada

Construya una matriz con:

- Filas: `dim_canal[canal]`.
- Columnas: `dim_fecha[anio]`.
- Valores: `[Transacciones contabilizadas]` y `[Volumen transaccional]`.
- Segmentador: `dim_cliente[pais_residencia]`.

Valide lo siguiente:

1. Cada celda cambia por canal y año.
2. El total no tiene por qué ser el promedio de las filas; la medida se vuelve a evaluar en el contexto del total.
3. Al seleccionar un país, cambian las medidas porque el filtro alcanza los hechos mediante la relación.

## 1.6 Error frecuente

```DAX
-- Incorrecto como medida: una columna no tiene un único valor
Monto absoluto incorrecto =
ABS ( fact_transaccion[monto_usd] )
```

Una medida no tiene fila actual por defecto. Si hay varias transacciones visibles, DAX no puede decidir qué `monto_usd` usar. Debe agregar o iterar:

```DAX
Monto absoluto correcto =
SUMX (
    fact_transaccion,
    ABS ( fact_transaccion[monto_usd] )
)
```

---

# Tema 2. Transición de contexto

## 2.1 El problema que resuelve

Imagine una columna calculada en `dim_cliente`. En cada fila existe un cliente actual, pero esa fila no filtra por sí misma `fact_transaccion`.

Esta expresión cuenta toda la tabla de hechos y repite el total global:

```DAX
Transacciones sin transición =
COUNTROWS ( fact_transaccion )
```

El contexto de fila sabe qué cliente se está procesando, pero `COUNTROWS` todavía no recibe un filtro sobre la tabla de hechos.

## 2.2 Transición explícita con CALCULATE

En `dim_cliente`, cree temporalmente esta columna calculada:

```DAX
Transacciones del cliente =
CALCULATE (
    COUNTROWS ( fact_transaccion )
)
```

### Qué ocurre internamente

1. `dim_cliente` tiene una fila actual, por ejemplo `CL000145`.
2. `CALCULATE` detecta el contexto de fila.
3. Convierte los valores de la fila actual en filtros.
4. El filtro `cliente_id = CL000145` viaja por la relación.
5. `COUNTROWS` cuenta las transacciones de ese cliente.

No se escribió un filtro explícito porque `CALCULATE` realizó la transición.

> **Uso didáctico:** la columna permite observar el mecanismo, pero aumenta el tamaño del modelo y sólo se actualiza al refrescar. Para informes interactivos se prefieren medidas.

## 2.3 Transición implícita al invocar una medida

Las medidas se evalúan como si estuvieran envueltas en un `CALCULATE` implícito. Esto importa dentro de iteradores.

Primero cree o confirme la medida:

```DAX
Volumen transaccional =
SUMX (
    fact_transaccion,
    ABS ( fact_transaccion[monto_usd] )
)
```

Después cree:

```DAX
Promedio por cliente =
AVERAGEX (
    VALUES ( dim_cliente[cliente_id] ),
    [Volumen transaccional]
)
```

### Evaluación paso a paso

1. `VALUES` obtiene los clientes visibles.
2. `AVERAGEX` crea una fila actual por cada cliente.
3. La medida `[Volumen transaccional]` activa una transición implícita.
4. El cliente actual se convierte en filtro.
5. Se calcula el volumen de ese cliente.
6. `AVERAGEX` promedia los resultados individuales.

No está promediando transacciones; está promediando el **volumen agregado de cada cliente**.

## 2.4 Comparación para demostrar la transición

```DAX
Promedio incorrecto sin transición =
AVERAGEX (
    VALUES ( dim_cliente[cliente_id] ),
    SUMX (
        fact_transaccion,
        ABS ( fact_transaccion[monto_usd] )
    )
)
```

La expresión interna no es una medida y no tiene `CALCULATE`. Por ello, la fila actual del cliente no se transforma automáticamente en filtro y puede repetirse el volumen global visible.

Versión explícita equivalente a la medida:

```DAX
Promedio correcto con transición explícita =
AVERAGEX (
    VALUES ( dim_cliente[cliente_id] ),
    CALCULATE (
        SUMX (
            fact_transaccion,
            ABS ( fact_transaccion[monto_usd] )
        )
    )
)
```

## 2.5 Validación

Cree una tabla con `dim_cliente[cliente_id]`, `[Volumen transaccional]` y la columna `Transacciones del cliente`.

- Cada cliente debe mostrar resultados distintos cuando tenga actividad diferente.
- La suma de la columna de conteos debe coincidir con el número de transacciones relacionadas, siempre que cada hecho tenga un solo cliente principal válido.
- Si aparece un miembro en blanco, revise claves sin correspondencia entre hecho y dimensión.

---

# Tema 3. CALCULATE como motor analítico

## 3.1 Anatomía

```DAX
CALCULATE (
    <expresión escalar>,
    <filtro 1>,
    <filtro 2>
)
```

El orden conceptual es:

1. Recibir el contexto actual.
2. Realizar transición de contexto, si existe contexto de fila.
3. Evaluar los argumentos de filtro.
4. Modificar el contexto.
5. Evaluar la expresión en el nuevo contexto.

Aunque se escribe primero la expresión, conviene razonar desde los filtros hacia el resultado.

## 3.2 Construcción por capas: tasa de rechazo

### Paso 1. Contar todos los intentos

```DAX
Transacciones intentadas =
COUNTROWS ( fact_transaccion )
```

### Paso 2. Cambiar el contexto al estado rechazado

```DAX
Transacciones rechazadas =
CALCULATE (
    [Transacciones intentadas],
    fact_transaccion[estado] = "Rechazada"
)
```

### Paso 3. Dividir con seguridad

```DAX
Tasa de rechazo =
DIVIDE (
    [Transacciones rechazadas],
    [Transacciones intentadas]
)
```

`DIVIDE` devuelve blanco cuando el denominador es cero, salvo que se indique un resultado alternativo. Esto es preferible a un error o infinito.

### Interpretación bancaria

La tasa responde:

> De todas las operaciones intentadas dentro de la selección actual, ¿qué proporción fue rechazada?

No es una tasa global fija. Cambia por fecha, canal, producto, país, segmento u otra dimensión que filtre los hechos.

## 3.3 Reemplazo de filtros

```DAX
Transacciones digitales =
CALCULATE (
    [Transacciones contabilizadas],
    dim_canal[digital] = 1
)
```

Si el contexto ya tiene un filtro sobre `dim_canal[digital]`, el argumento normal de `CALCULATE` lo reemplaza. Por ejemplo, aunque el usuario haya seleccionado `digital = 0`, la medida fuerza `digital = 1`.

Esto puede ser correcto si la definición del KPI exige siempre canales digitales.

## 3.4 Conservación e intersección con KEEPFILTERS

```DAX
Transacciones digitales visibles =
CALCULATE (
    [Transacciones contabilizadas],
    KEEPFILTERS ( dim_canal[digital] = 1 )
)
```

`KEEPFILTERS` solicita una intersección:

```text
Selección actual sobre digital
∩ digital = 1
= contexto final
```

Si el usuario seleccionó exclusivamente canales no digitales, la intersección queda vacía y la medida devuelve blanco o cero, según la medida base.

## 3.5 Prueba visual para comparar ambas medidas

1. Agregue un segmentador con `dim_canal[grupo_canal]` o `dim_canal[digital]`.
2. Coloque ambas medidas en tarjetas.
3. Seleccione sólo canales presenciales.
4. Compare:
   - `[Transacciones digitales]` ignora o reemplaza el filtro incompatible en la columna `digital`.
   - `[Transacciones digitales visibles]` respeta la selección e intersecta; no debe mostrar actividad digital.

> **Matiz:** si el filtro proviene de otra columna de la misma tabla, la interacción puede depender de la combinación de filtros existente. Para entender el comportamiento de forma inequívoca, usa un segmentador sobre `dim_canal[digital]`.

## 3.6 Buen patrón de medidas

Prefiera una estructura por capas:

```text
Medida base → medida filtrada → razón o KPI → formato/presentación
```

Ejemplo:

```DAX
Transacciones intentadas =
COUNTROWS ( fact_transaccion )
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

Así se evita repetir lógica y se mantiene una definición común entre reportes.

---

# Tema 4. FILTER y modificación de contexto

## 4.1 FILTER devuelve una tabla

`FILTER` no agrega, no cuenta y no produce por sí solo un KPI. Su resultado es una tabla formada por las filas que cumplen una condición.

```DAX
FILTER (
    fact_transaccion,
    ABS ( fact_transaccion[monto_usd] ) >= 1000
)
```

Proceso:

1. Recibe las filas visibles de `fact_transaccion`.
2. Crea un contexto de fila.
3. Evalúa `ABS(monto_usd) >= 1000` en cada transacción.
4. Conserva únicamente las filas verdaderas.

La tabla resultante puede entregarse a `CALCULATE`, `COUNTROWS`, `SUMX` u otra función que acepte una tabla.

## 4.2 Operaciones de alto importe

```DAX
Volumen operaciones altas =
CALCULATE (
    [Volumen transaccional],
    FILTER (
        fact_transaccion,
        ABS ( fact_transaccion[monto_usd] ) >= 1000
    )
)
```

### Evaluación paso a paso

1. El informe determina las transacciones visibles por fecha, país, producto y canal.
2. `FILTER` revisa esas transacciones una por una.
3. Conserva cargos y abonos cuyo valor absoluto sea al menos 1,000 USD.
4. `CALCULATE` usa esa tabla para modificar el contexto.
5. `[Volumen transaccional]` suma el valor absoluto de las filas restantes.

Se usa `ABS` para incluir tanto un cargo de -1,500 como un abono de 1,500.

## 4.3 Conteo y participación de operaciones altas

```DAX
Transacciones de alto importe =
CALCULATE (
    [Transacciones intentadas],
    FILTER (
        fact_transaccion,
        ABS ( fact_transaccion[monto_usd] ) >= 1000
    )
)
```

```DAX
% transacciones de alto importe =
DIVIDE (
    [Transacciones de alto importe],
    [Transacciones intentadas]
)
```

Estas medidas separan dos perspectivas:

- `[Volumen operaciones altas]`: cuánto dinero movilizaron.
- `[Transacciones de alto importe]`: cuántas operaciones fueron.

Una cantidad pequeña de transacciones puede concentrar una gran proporción del volumen.

## 4.4 Filtro booleano frente a FILTER

Use una comparación directa cuando la condición sea simple:

```DAX
Transacciones rechazadas =
CALCULATE (
    [Transacciones intentadas],
    fact_transaccion[estado] = "Rechazada"
)
```

Use `FILTER` cuando necesite una expresión evaluada fila por fila:

```DAX
Transacciones de alto importe =
CALCULATE (
    [Transacciones intentadas],
    FILTER (
        fact_transaccion,
        ABS ( fact_transaccion[monto_usd] ) >= 1000
    )
)
```

Regla práctica:

| Necesidad | Preferencia |
|---|---|
| Columna igual a un valor | Filtro booleano |
| Bandera igual a 0 o 1 | Filtro booleano |
| Expresión matemática por fila | `FILTER` |
| Comparación entre columnas | `FILTER` |
| Condición compleja sobre una tabla virtual | `FILTER` |

Los filtros booleanos suelen ser más legibles y permiten mejores optimizaciones. No utilice `FILTER` alrededor de toda la tabla si una condición simple expresa correctamente la intención.

## 4.5 Variante con umbral reutilizable

Para preparar el modelo para parámetros posteriores, puede separar el umbral:

```DAX
Umbral alto importe USD =
1000
```

```DAX
Volumen sobre umbral =
VAR Umbral = [Umbral alto importe USD]
RETURN
    CALCULATE (
        [Volumen transaccional],
        FILTER (
            fact_transaccion,
            ABS ( fact_transaccion[monto_usd] ) >= Umbral
        )
    )
```

La variable mejora la lectura y deja claro que el mismo valor se utiliza en toda la evaluación.

---

# Tema 5. ALL, ALLEXCEPT y ALLSELECTED

## 5.1 No son funciones intercambiables

| Función | Intención | Pregunta típica |
|---|---|---|
| `ALL` | Retirar filtros de una columna o tabla | ¿Qué proporción representa frente al total definido? |
| `ALLEXCEPT` | Retirar todos los filtros de una tabla salvo los indicados | ¿Cuál es el valor manteniendo sólo el grupo? |
| `ALLSELECTED` | Retirar el detalle interno del visual y conservar la selección externa | ¿Qué proporción representa dentro de lo visible? |

La parte más importante de un porcentaje suele ser el denominador. Antes de escribir DAX, descríbelo en una oración.

## 5.2 Participación contra todos los canales con ALL

```DAX
% volumen total canales =
DIVIDE (
    [Volumen transaccional],
    CALCULATE (
        [Volumen transaccional],
        ALL ( dim_canal )
    )
)
```

En una matriz por canal:

- Numerador: volumen del canal de la fila.
- Denominador: volumen sin filtros provenientes de `dim_canal`.
- Otros filtros, como año, país o producto, se conservan.

Por tanto, “total” no significa necesariamente toda la historia del banco. Significa total **después de retirar el filtro de canal**, manteniendo el resto del contexto.

### Variante más estrecha

Si sólo quiere retirar el nombre del canal y conservar otros atributos de la dimensión:

```DAX
% volumen total nombres de canal =
DIVIDE (
    [Volumen transaccional],
    CALCULATE (
        [Volumen transaccional],
        ALL ( dim_canal[canal] )
    )
)
```

`ALL(dim_canal)` y `ALL(dim_canal[canal])` no son equivalentes cuando existen filtros sobre `grupo_canal`, `digital` u otras columnas.

## 5.3 Mantener sólo el país con ALLEXCEPT

```DAX
Clientes conservando país =
CALCULATE (
    DISTINCTCOUNT ( dim_cliente[cliente_id] ),
    ALLEXCEPT (
        dim_cliente,
        dim_cliente[pais_residencia]
    )
)
```

La medida retira filtros de `dim_cliente` como segmento, riesgo o nivel digital, pero conserva el país.

Ejemplo conceptual:

```text
Contexto original:
México + Segmento Afluente + Riesgo Medio

Después de ALLEXCEPT:
México
```

> **Precaución:** la medida cuenta clientes de la dimensión, incluso aquellos sin transacciones en el periodo seleccionado. Si la pregunta es “clientes con actividad”, debe contar clientes desde el hecho o mediante una medida diseñada para actividad.

Una alternativa para clientes con actividad es:

```DAX
Clientes activos en transacciones =
DISTINCTCOUNT ( fact_transaccion[cliente_principal_id] )
```

```DAX
Clientes activos conservando país =
CALCULATE (
    [Clientes activos en transacciones],
    ALLEXCEPT (
        dim_cliente,
        dim_cliente[pais_residencia]
    )
)
```

## 5.4 Participación dentro de la selección visible con ALLSELECTED

```DAX
% volumen visible =
DIVIDE (
    [Volumen transaccional],
    CALCULATE (
        [Volumen transaccional],
        ALLSELECTED ( dim_canal[canal] )
    )
)
```

Escenario recomendado:

- Matriz con `dim_canal[canal]` en filas.
- Segmentadores de año y país.
- Segmentador de canal con sólo algunos canales seleccionados.

Para cada fila, `ALLSELECTED(dim_canal[canal])` retira el filtro del canal generado por esa fila, pero conserva el conjunto seleccionado por el usuario. El denominador es la suma de los canales visibles seleccionados.

## 5.5 Comparación práctica: ALL frente a ALLSELECTED

```DAX
Volumen denominador ALL =
CALCULATE (
    [Volumen transaccional],
    ALL ( dim_canal[canal] )
)
```

```DAX
Volumen denominador ALLSELECTED =
CALCULATE (
    [Volumen transaccional],
    ALLSELECTED ( dim_canal[canal] )
)
```

Prueba:

1. Seleccione sólo dos canales en un segmentador.
2. Muestre ambos denominadores en una matriz por canal.
3. `ALL` considera todos los nombres de canal permitidos por los demás filtros.
4. `ALLSELECTED` considera los canales elegidos por el usuario.
5. Sin una selección parcial, ambos pueden coincidir; esto no los vuelve equivalentes.

## 5.6 Prueba de suma de participaciones

En el nivel de detalle visible por canal:

- `% volumen visible` debe sumar aproximadamente 100 % entre las filas visibles.
- `% volumen total canales` puede sumar menos de 100 % si el usuario ocultó canales mediante una selección externa y `ALL` los reincorpora al denominador.

Las pequeñas diferencias pueden provenir del redondeo del formato visual.

---

# Tema 6. VALUES, DISTINCT y manejo de filtros

## 6.1 Qué devuelven

Ambas funciones pueden devolver valores únicos dentro del contexto actual, pero tienen una diferencia relevante para la integridad del modelo:

- `VALUES(columna)` puede incluir un miembro desconocido en blanco cuando existen claves del hecho sin correspondencia en la dimensión.
- `DISTINCT(columna)` devuelve los valores distintos existentes en la columna y no agrega ese miembro especial.

Esto convierte a `VALUES` en una herramienta útil para recorrer entidades visibles y también para detectar problemas referenciales.

## 6.2 Contar canales visibles

```DAX
Canales visibles =
COUNTROWS (
    VALUES ( dim_canal[canal_id] )
)
```

La medida no cuenta filas del hecho. Cuenta los identificadores de canal que permanecen visibles en `dim_canal` después de aplicar el contexto.

Pruebe la medida en una tarjeta y cambie un segmentador de canal. El valor debe seguir la selección.

## 6.3 Promedio de resultados por canal

```DAX
Promedio por canal =
AVERAGEX (
    VALUES ( dim_canal[canal_id] ),
    [Volumen transaccional]
)
```

Evaluación:

1. `VALUES` crea la lista de canales visibles.
2. `AVERAGEX` recorre esa lista.
3. La medida activa transición de contexto para cada canal.
4. Se calcula el volumen agregado de cada canal.
5. Se promedian esos resultados.

No equivale al promedio del monto de las transacciones:

```DAX
-- Responde otra pregunta
Promedio por transacción =
AVERAGEX (
    fact_transaccion,
    ABS ( fact_transaccion[monto_usd] )
)
```

La primera medida da el mismo peso a cada canal visible; la segunda da el mismo peso a cada transacción.

## 6.4 Mostrar los filtros activos

```DAX
Lista de canales =
CONCATENATEX (
    VALUES ( dim_canal[canal] ),
    dim_canal[canal],
    ", ",
    dim_canal[canal],
    ASC
)
```

Esta medida es útil como subtítulo dinámico o para depuración. La versión incluye orden alfabético para que el texto sea estable.

Una versión más informativa puede distinguir entre uno, varios o todos los canales:

```DAX
Descripción filtro de canal =
VAR CantidadVisible =
    COUNTROWS ( VALUES ( dim_canal[canal] ) )
VAR CantidadTotal =
    COUNTROWS ( ALL ( dim_canal[canal] ) )
RETURN
    SWITCH (
        TRUE (),
        CantidadVisible = CantidadTotal, "Todos los canales",
        CantidadVisible = 1, SELECTEDVALUE ( dim_canal[canal] ),
        CONCATENATEX (
            VALUES ( dim_canal[canal] ),
            dim_canal[canal],
            ", ",
            dim_canal[canal],
            ASC
        )
    )
```

## 6.5 Detectar el miembro desconocido

Una revisión básica puede comparar `VALUES` y `DISTINCT`:

```DAX
Diferencia VALUES DISTINCT canales =
COUNTROWS ( VALUES ( dim_canal[canal_id] ) )
    - COUNTROWS ( DISTINCT ( dim_canal[canal_id] ) )
```

Una diferencia de 1 puede indicar la fila especial en blanco creada por el modelo debido a claves de canal sin correspondencia. No sustituye una validación de calidad en Power Query, pero ayuda a revelar el síntoma.

Para identificar hechos sin dimensión, es preferible validar el origen o construir una consulta de anti-unión en Power Query. DAX debe apoyar el diagnóstico, no ocultar el problema.

## 6.6 VALUES como lista para iterar

Patrón general:

```DAX
Resultado promedio por entidad =
AVERAGEX (
    VALUES ( Dimension[ClaveEntidad] ),
    [Medida base]
)
```

La granularidad de la lista define la pregunta. Cambiar `cliente_id` por `canal_id` altera el significado del promedio, aunque la estructura DAX sea idéntica.

---

# Ejercicio integrador

## Objetivo

Construir una página que permita explicar contexto, filtros y denominadores mediante tres KPIs:

1. Tasa de rechazo.
2. Participación del canal digital.
3. Participación de cada canal dentro de la selección visible.

## Paso 1. Medidas base

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

## Paso 2. Tasa de rechazo

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

## Paso 3. Volumen digital

```DAX
Volumen digital =
CALCULATE (
    [Volumen transaccional],
    dim_canal[digital] = 1
)
```

```DAX
% volumen digital =
DIVIDE (
    [Volumen digital],
    CALCULATE (
        [Volumen transaccional],
        ALL ( dim_canal )
    )
)
```

La medida fuerza el numerador digital y retira filtros de canal en el denominador. Conserva filtros como fecha, país y producto.

## Paso 4. Porcentaje visible por canal

```DAX
% volumen visible =
DIVIDE (
    [Volumen transaccional],
    CALCULATE (
        [Volumen transaccional],
        ALLSELECTED ( dim_canal[canal] )
    )
)
```

## Paso 5. Diseño de la página

- Tarjeta: `[Tasa de rechazo]`.
- Tarjeta: `[% volumen digital]`.
- Matriz por `dim_canal[canal]`: `[Volumen transaccional]` y `[% volumen visible]`.
- Segmentadores: año, país, producto y canal.
- Subtítulo o tarjeta de texto: `[Descripción filtro de canal]`.

## Paso 6. Preguntas de comprobación

1. ¿Qué filtros conserva el denominador de `% volumen digital`?
2. ¿Qué ocurre si se selecciona exclusivamente un canal presencial?
3. ¿Por qué `% volumen visible` puede cambiar al ocultar un canal?
4. ¿La tasa de rechazo se calcula sobre transacciones o sobre clientes?
5. ¿El volumen usa el monto neto o el valor absoluto?
6. ¿Qué entidad recorre `AVERAGEX` en `[Promedio por canal]`?

---

# Lista de validación

## Validación funcional

- Las dimensiones filtran la tabla de hechos, no al revés.
- `dim_fecha` está marcada como tabla de fechas y su relación activa usa `fecha_operacion_id`.
- Los identificadores de las dimensiones son únicos.
- `[Monto neto USD]` puede ser negativo; `[Volumen transaccional]` no debe ser negativo.
- `[Transacciones rechazadas]` nunca supera `[Transacciones intentadas]` en el mismo contexto.
- `[Tasa de rechazo]` se encuentra entre 0 % y 100 %.
- Las participaciones visibles suman aproximadamente 100 % en el nivel mostrado.
- Los conteos con `VALUES` reaccionan a los segmentadores.

## Validación conceptual

Para cada medida, el alumno debe poder completar estas frases:

```text
La medida empieza con el contexto de ____________________.
CALCULATE agrega, reemplaza o retira ____________________.
La expresión se evalúa sobre ____________________________.
El numerador representa ________________________________.
El denominador representa ______________________________.
La granularidad del resultado es ________________________.
```

## Errores frecuentes y diagnóstico

| Síntoma | Causa probable | Revisión |
|---|---|---|
| El mismo total aparece en cada entidad | Falta transición de contexto | Invocar una medida o envolver la expresión con `CALCULATE` |
| El KPI ignora la selección del usuario | Un filtro de `CALCULATE` reemplaza la selección | Evaluar `KEEPFILTERS` |
| El porcentaje no suma 100 % | Denominador distinto al conjunto visible | Revisar `ALL` frente a `ALLSELECTED` |
| Una fórmula es lenta | `FILTER` recorre una tabla grande sin necesidad | Sustituir por filtro booleano cuando sea posible |
| Aparece un elemento en blanco | Claves del hecho sin dimensión relacionada | Revisar integridad referencial y `VALUES` |
| El promedio parece demasiado alto | Se promedian agregados por entidad, no transacciones | Confirmar la tabla iterada por `AVERAGEX` |
| Volumen y monto neto difieren mucho | Entradas y salidas se cancelan en el neto | Confirmar si la pregunta requiere signo o valor absoluto |

---

# Mapa de decisión

```text
¿Necesito cambiar el contexto de filtro?
└── CALCULATE
    ├── ¿La condición es simple sobre una columna?
    │   └── Filtro booleano
    ├── ¿La condición debe evaluarse fila por fila?
    │   └── FILTER
    ├── ¿Debo conservar el filtro existente sobre la columna?
    │   └── KEEPFILTERS
    ├── ¿Necesito un total sin filtros de una columna o tabla?
    │   └── ALL
    ├── ¿Debo conservar sólo ciertas columnas de una tabla?
    │   └── ALLEXCEPT
    └── ¿Necesito el total de la selección visible?
        └── ALLSELECTED

¿Necesito una lista de entidades visibles para contar o iterar?
└── VALUES
    └── Comparar con DISTINCT si se investiga el miembro desconocido
```

---

# Resultado de aprendizaje esperado

Al terminar estos seis temas, el alumno debe poder:

- Distinguir contexto de fila y contexto de filtro.
- Reconocer cuándo ocurre una transición de contexto.
- Explicar `CALCULATE` como una modificación controlada del contexto.
- Elegir entre un filtro booleano y `FILTER`.
- Diseñar denominadores correctos con `ALL`, `ALLEXCEPT` o `ALLSELECTED`.
- Utilizar `VALUES` para contar, iterar y describir entidades visibles.
- Explicar una medida en lenguaje de negocio antes de optimizarla o ampliarla.

Una medida está verdaderamente terminada cuando su autor puede explicar con claridad **qué conjunto de filas evalúa, qué filtros conserva, cuáles modifica y a qué granularidad responde**.
