# Guía práctica para construir un KPI y convertirlo en insights

## Propósito

Esta guía conecta el trabajo de DAX del Módulo II con los principios de storytelling del Módulo III.

El objetivo consiste en completar un KPI de principio a fin:

1. Definir qué significa para el negocio.
2. Identificar las tablas y el contexto que necesita.
3. construir las medidas DAX por capas.
4. Comparar el resultado con una meta o un periodo anterior.
5. Identificar dónde se concentra la variación.
6. Redactar insights que respeten la evidencia.
7. Diseñar una página ejecutiva orientada a una decisión.

El ejemplo principal será **Cumplimiento de volumen**, porque combina:

- Resultados reales de `fact_transaccion`.
- Metas de `fact_meta_mensual`.
- Dimensiones compartidas de fecha, producto y sucursal.
- Comparaciones temporales.
- Drivers de variación.
- Una lectura ejecutiva directa.

Las mismas etapas pueden reutilizarse para tasa de rechazo, participación digital, saldo promedio, mora y costo por transacción.

---

# 1. Diferencia entre métrica, KPI e insight

## 1.1 Métrica

Una métrica describe un resultado cuantitativo.

Ejemplos:

- Volumen transaccional: USD 12.4 millones.
- Transacciones contabilizadas: 18,450.
- Tasa de rechazo: 2.8 %.

El valor puede ser correcto y todavía no indicar si el desempeño resulta adecuado.

## 1.2 KPI

Un KPI vincula una métrica con un objetivo, una referencia o una decisión.

Ejemplo:

> El volumen transaccional alcanzó 94.2 % de la meta mensual.

La meta permite distinguir entre resultado y desempeño.

## 1.3 Insight

Un insight agrega contexto suficiente para orientar una decisión.

Ejemplo:

> El volumen alcanzó 94.2 % de la meta. La brecha se concentra en dos productos de la región Norte, que explican 71 % del faltante visible. Conviene revisar si la desviación proviene de menor actividad, estacionalidad o problemas de operación antes de modificar la meta.

El insight contiene:

| Componente | Contenido |
|---|---|
| Resultado | 94.2 % de cumplimiento |
| Referencia | Meta mensual |
| Brecha | 5.8 % por debajo de la meta |
| Concentración | Dos productos de una región |
| Límite | Todavía no se conoce la causa |
| Acción | Investigar actividad, estacionalidad y operación |

---

# 2. Selección del KPI

Antes de escribir DAX, complete la siguiente ficha.

| Campo | Pregunta | Ejemplo |
|---|---|---|
| Nombre | ¿Cómo se llamará? | Cumplimiento de volumen |
| Propósito | ¿Qué decisión respalda? | Identificar brechas frente al presupuesto |
| Resultado real | ¿Qué ocurrió? | Volumen transaccional contabilizado |
| Referencia | ¿Contra qué se compara? | Meta mensual aprobada |
| Frecuencia | ¿Cada cuánto se revisa? | Mensual |
| Dimensiones | ¿Dónde se analizará? | Mes, sucursal, producto, país y región |
| Unidad | ¿Cómo se presenta? | Porcentaje |
| Responsable | ¿Quién valida la definición? | Planeación |
| Acción | ¿Qué puede decidir el usuario? | Priorizar productos y sucursales con mayor brecha |

## 2.1 Pregunta de negocio

Una formulación adecuada sería:

> ¿En qué medida el volumen contabilizado cumple la meta mensual y qué productos o sucursales explican la brecha?

Esta pregunta ya anticipa tres niveles de análisis:

1. Estado: cumplimiento total.
2. Explicación: productos y sucursales que explican la brecha.
3. Acción: dónde concentrar la revisión.

## 2.2 Condiciones para usar una meta

La meta aporta valor cuando:

- Corresponde a la misma definición de negocio que el resultado real.
- Utiliza una unidad comparable.
- Está disponible para el mismo periodo.
- Puede compararse en dimensiones comunes.
- Tiene una versión y un escenario identificables.

La meta no debe utilizarse cuando mezcla poblaciones, monedas o niveles de detalle incompatibles.

---

# 3. Tablas utilizadas

## 3.1 Resultado real

`fact_transaccion` contiene una fila por transacción e incluye:

- `fecha_operacion_id`
- `fecha_contabilizacion_id`
- `producto_id`
- `sucursal_id`
- `canal_id`
- `monto_usd`
- `comision_usd`
- `estado`
- `alerta_fraude`

Para el KPI de volumen se utilizan únicamente las operaciones con estado `Contabilizada`.

## 3.2 Meta

`fact_meta_mensual` contiene una fila por combinación de:

- Mes.
- Sucursal.
- Producto.
- Escenario.
- Versión.

Sus campos principales son:

- `fecha_mes_id`
- `sucursal_id`
- `producto_id`
- `meta_transacciones`
- `meta_volumen_usd`
- `meta_saldo_usd`
- `meta_clientes_nuevos`
- `meta_ingreso_neto_usd`
- `escenario`
- `version`

## 3.3 Dimensiones compartidas

| Dimensión | Clave | Uso en el análisis |
|---|---|---|
| `dim_fecha` | `fecha_id` | Mes, trimestre, año y periodo fiscal |
| `dim_producto` | `producto_id` | Producto, familia, subfamilia y mercado |
| `dim_sucursal` | `sucursal_id` | Sucursal, país, región, ciudad y formato |
| `dim_canal` | `canal_id` | Canal, grupo y clasificación digital |

`dim_canal` filtra las transacciones, pero no la meta mensual, porque la meta no está definida por canal.

## 3.4 Relaciones recomendadas

```text
dim_fecha[fecha_id]
    1 ─── * fact_transaccion[fecha_operacion_id]

dim_fecha[fecha_id]
    1 ─── * fact_meta_mensual[fecha_mes_id]

dim_producto[producto_id]
    1 ─── * fact_transaccion[producto_id]

dim_producto[producto_id]
    1 ─── * fact_meta_mensual[producto_id]

dim_sucursal[sucursal_id]
    1 ─── * fact_transaccion[sucursal_id]

dim_sucursal[sucursal_id]
    1 ─── * fact_meta_mensual[sucursal_id]
```

Las relaciones deben filtrar desde las dimensiones hacia los hechos.

No relacione `fact_transaccion` directamente con `fact_meta_mensual`.

---

# 4. Contrato del KPI

## 4.1 Definición propuesta

| Elemento | Definición |
|---|---|
| Nombre | Cumplimiento de volumen |
| Numerador | Volumen transaccional contabilizado |
| Denominador | Meta de volumen aprobada |
| Fórmula | Volumen real ÷ meta de volumen |
| Frecuencia | Mensual |
| Unidad | Porcentaje |
| Fecha real | Fecha de operación |
| Fecha meta | Primer día del mes representado por `fecha_mes_id` |
| Dimensiones comparables | Fecha, producto y sucursal |
| Escenario | Presupuesto |
| Versión | V1_Aprobada |
| Dueño | Planeación |
| Fuente real | `fact_transaccion` |
| Fuente meta | `fact_meta_mensual` |

## 4.2 Interpretación

| Resultado | Lectura |
|---:|---|
| Mayor a 100 % | El volumen supera la meta |
| Igual a 100 % | El volumen coincide con la meta |
| Menor a 100 % | El volumen se encuentra por debajo de la meta |
| Blanco | La meta o el resultado no está disponible en el contexto |

Un resultado superior a 100 % no siempre representa un desempeño favorable. Puede reflejar una meta conservadora, un evento atípico o una concentración de riesgo. El KPI requiere interpretación de negocio.

---

# 5. Construcción de las medidas DAX

## 5.1 Transacciones intentadas

```DAX
Transacciones intentadas =
COUNTROWS ( fact_transaccion )
```

Esta medida cuenta todos los registros transaccionales visibles, independientemente del estado.

## 5.2 Transacciones contabilizadas

```DAX
Transacciones contabilizadas =
CALCULATE (
    [Transacciones intentadas],
    fact_transaccion[estado] = "Contabilizada"
)
```

## 5.3 Volumen transaccional

La definición aprobada utiliza el valor absoluto de `monto_usd` y sólo incluye operaciones contabilizadas.

```DAX
Volumen transaccional =
CALCULATE (
    SUMX (
        fact_transaccion,
        ABS ( fact_transaccion[monto_usd] )
    ),
    fact_transaccion[estado] = "Contabilizada"
)
```

No debe confundirse con el monto neto:

```DAX
Monto neto USD =
SUM ( fact_transaccion[monto_usd] )
```

El volumen mide dinero movilizado. El monto neto conserva el signo económico de cargos y abonos.

## 5.4 Meta de volumen

```DAX
Meta volumen =
CALCULATE (
    SUM ( fact_meta_mensual[meta_volumen_usd] ),
    fact_meta_mensual[escenario] = "Presupuesto",
    fact_meta_mensual[version] = "V1_Aprobada"
)
```

Los filtros de escenario y versión pueden omitirse si el modelo sólo contiene una opción, pero conservarlos documenta la intención y protege el cálculo ante nuevas versiones.

## 5.5 Cumplimiento de volumen

```DAX
Cumplimiento volumen =
DIVIDE (
    [Volumen transaccional],
    [Meta volumen]
)
```

Formato recomendado: porcentaje con un decimal.

## 5.6 Brecha de volumen en USD

```DAX
Brecha volumen USD =
[Volumen transaccional]
    - [Meta volumen]
```

Interpretación:

- Positiva: volumen por encima de la meta.
- Negativa: volumen por debajo de la meta.
- Cero: coincidencia con la meta.

## 5.7 Brecha porcentual frente a la meta

```DAX
Brecha volumen % =
DIVIDE (
    [Brecha volumen USD],
    [Meta volumen]
)
```

Existe una relación directa:

```text
Brecha volumen % = Cumplimiento volumen - 100 %
```

Puede verificarse con esta medida:

```DAX
Control cumplimiento =
[Brecha volumen %]
    - ( [Cumplimiento volumen] - 1 )
```

El control debe ser cero, salvo diferencias mínimas de precisión.

---

# 6. Validación de comparabilidad

## 6.1 Problema del canal

La meta mensual no contiene `canal_id`. Por lo tanto:

- El volumen real sí puede filtrarse por canal.
- La meta no puede distribuirse por canal sin una regla adicional.
- El cumplimiento por canal no resulta comparable con la meta original.

Si se coloca `dim_canal[canal]` en una matriz junto con `[Meta volumen]`, la misma meta puede repetirse en cada canal.

Esto no significa que DAX esté equivocado. Significa que el modelo no posee una meta definida a ese nivel.

## 6.2 Indicador de contexto comparable

```DAX
Contexto meta válido =
IF (
    ISFILTERED ( dim_canal[canal] )
        || ISFILTERED ( dim_canal[grupo_canal] ),
    0,
    1
)
```

## 6.3 Cumplimiento protegido

```DAX
Cumplimiento volumen comparable =
IF (
    [Contexto meta válido] = 1,
    [Cumplimiento volumen],
    BLANK ()
)
```

Esta versión evita presentar un cumplimiento engañoso cuando el usuario desglosa por una dimensión que no existe en la meta.

## 6.4 Mensaje de advertencia

```DAX
Advertencia meta =
IF (
    [Contexto meta válido] = 0,
    "La meta no está definida por canal",
    BLANK ()
)
```

---

# 7. Comparación temporal

La meta responde si el desempeño cumple el plan. La comparación temporal responde si el resultado mejora o empeora frente a su propia historia.

Ambas referencias contestan preguntas distintas.

## 7.1 Volumen del año anterior

```DAX
Volumen año anterior =
CALCULATE (
    [Volumen transaccional],
    DATEADD ( dim_fecha[fecha], -1, YEAR )
)
```

## 7.2 Cambio anual

```DAX
Cambio volumen YoY USD =
[Volumen transaccional]
    - [Volumen año anterior]
```

```DAX
Cambio volumen YoY % =
DIVIDE (
    [Cambio volumen YoY USD],
    [Volumen año anterior]
)
```

## 7.3 Lectura combinada

| Cumplimiento | Cambio YoY | Lectura inicial |
|---|---|---|
| Mayor a 100 % | Positivo | Supera plan y crece |
| Menor a 100 % | Positivo | Crece, pero no alcanza la meta |
| Mayor a 100 % | Negativo | Supera meta, aunque cae frente al año anterior |
| Menor a 100 % | Negativo | No alcanza la meta y se contrae |

Esta matriz evita tratar la meta como la única referencia.

---

# 8. Identificación de drivers

## 8.1 Brecha por producto o sucursal

La medida `[Brecha volumen USD]` puede colocarse en una tabla junto con:

- `dim_producto[producto]`
- `dim_producto[familia]`
- `dim_sucursal[sucursal]`
- `dim_sucursal[pais]`
- `dim_sucursal[region]`

Cada fila recalculará el volumen y la meta dentro del mismo contexto.

## 8.2 Brecha total visible

```DAX
Brecha total visible =
CALCULATE (
    [Brecha volumen USD],
    ALLSELECTED ( dim_producto[producto] )
)
```

## 8.3 Contribución del producto a la brecha

```DAX
Contribución producto a brecha =
DIVIDE (
    [Brecha volumen USD],
    [Brecha total visible]
)
```

Esta medida responde:

> ¿Qué parte de la brecha visible corresponde a este producto?

Debe interpretarse con cautela cuando existen contribuciones positivas y negativas. Un producto por encima de la meta puede compensar a otros productos y producir participaciones negativas o superiores a 100 %.

## 8.4 Impacto absoluto

```DAX
Impacto absoluto brecha =
ABS ( [Brecha volumen USD] )
```

## 8.5 Ranking por impacto

```DAX
Ranking impacto producto =
RANKX (
    ALLSELECTED ( dim_producto[producto] ),
    [Impacto absoluto brecha],
    ,
    DESC,
    DENSE
)
```

El ranking por valor absoluto coloca primero los productos que más mueven el resultado, tanto positiva como negativamente.

## 8.6 Driver desfavorable

```DAX
Brecha desfavorable USD =
IF (
    [Brecha volumen USD] < 0,
    [Brecha volumen USD],
    BLANK ()
)
```

```DAX
Ranking brecha desfavorable =
RANKX (
    FILTER (
        ALLSELECTED ( dim_producto[producto] ),
        [Brecha volumen USD] < 0
    ),
    [Brecha volumen USD],
    ,
    ASC,
    DENSE
)
```

El valor más negativo ocupa la primera posición.

---

# 9. De los resultados al insight

## 9.1 Secuencia recomendada

Complete estas cinco preguntas:

1. ¿Cuál es el resultado actual?
2. ¿Contra qué referencia se compara?
3. ¿Cuál es la magnitud de la diferencia?
4. ¿Dónde se concentra la diferencia?
5. ¿Qué decisión o investigación corresponde?

## 9.2 Plantilla de redacción

```text
[KPI] alcanzó [resultado] en [periodo o selección].
Esto representa [variación] frente a [referencia].
[Segmento o driver] explica [contribución] de la diferencia visible.
Conviene [acción o siguiente análisis], considerando que [límite de la evidencia].
```

## 9.3 Ejemplo con meta

```text
El cumplimiento de volumen alcanzó 94.2 % en el periodo seleccionado.
El resultado se encuentra 5.8 % por debajo de la meta aprobada.
Los productos A y B concentran 71 % de la brecha desfavorable visible.
Conviene revisar actividad, estacionalidad y condiciones operativas en esos productos antes de modificar la meta.
```

Las cifras del texto anterior son ilustrativas. Deben sustituirse por los resultados del modelo.

## 9.4 Insight descriptivo e insight causal

### Insight descriptivo válido

> La brecha se concentra en los productos A y B.

Este enunciado se respalda con la distribución de la brecha.

### Hipótesis válida

> La reducción podría estar relacionada con menor actividad de clientes o restricciones operativas.

El uso de “podría” señala que la causa requiere comprobación.

### Afirmación no respaldada

> El volumen cayó por una falla de la aplicación.

El KPI y el desglose por producto no demuestran esa causa.

---

# 10. Medidas para apoyar la narrativa

## 10.1 Estado del cumplimiento

```DAX
Estado cumplimiento volumen =
VAR Cumplimiento = [Cumplimiento volumen comparable]
RETURN
    SWITCH (
        TRUE (),
        ISBLANK ( Cumplimiento ), "Sin comparación",
        Cumplimiento >= 1, "Cumple o supera",
        Cumplimiento >= 0.95, "Cerca de la meta",
        "Debajo de la meta"
    )
```

Los umbrales son una decisión de negocio. No deben definirse sólo por conveniencia visual.

## 10.2 Color del estado

```DAX
Color cumplimiento volumen =
SWITCH (
    [Estado cumplimiento volumen],
    "Cumple o supera", "#4F7654",
    "Cerca de la meta", "#70757A",
    "Debajo de la meta", "#B00020",
    "#B9BDC2"
)
```

## 10.3 Producto con mayor brecha desfavorable

```DAX
Producto principal brecha =
VAR TablaProductos =
    TOPN (
        1,
        FILTER (
            ADDCOLUMNS (
                ALLSELECTED ( dim_producto[producto] ),
                "@Brecha", [Brecha volumen USD]
            ),
            [@Brecha] < 0
        ),
        [@Brecha], ASC,
        dim_producto[producto], ASC
    )
RETURN
    CONCATENATEX (
        TablaProductos,
        dim_producto[producto],
        ", "
    )
```

## 10.4 Brecha del principal producto

```DAX
Brecha principal producto USD =
VAR TablaProductos =
    TOPN (
        1,
        FILTER (
            ADDCOLUMNS (
                ALLSELECTED ( dim_producto[producto] ),
                "@Brecha", [Brecha volumen USD]
            ),
            [@Brecha] < 0
        ),
        [@Brecha], ASC,
        dim_producto[producto], ASC
    )
RETURN
    MAXX ( TablaProductos, [@Brecha] )
```

## 10.5 Título dinámico

```DAX
Título cumplimiento volumen =
VAR Periodo =
    SELECTEDVALUE (
        dim_fecha[anio_mes],
        "periodo seleccionado"
    )
RETURN
    "Cumplimiento de volumen · " & Periodo
```

## 10.6 Texto narrativo breve

```DAX
Narrativa cumplimiento volumen =
VAR Cumplimiento = [Cumplimiento volumen comparable]
VAR Brecha = [Brecha volumen USD]
VAR Producto = [Producto principal brecha]
VAR Estado = [Estado cumplimiento volumen]
RETURN
    IF (
        ISBLANK ( Cumplimiento ),
        [Advertencia meta],
        "El volumen se encuentra en "
            & FORMAT ( Cumplimiento, "0.0%" )
            & " de la meta. Estado: "
            & Estado
            & ". Brecha: "
            & FORMAT ( Brecha, "$#,##0" )
            & IF (
                NOT ISBLANK ( Producto ),
                ". Principal producto con brecha: " & Producto,
                ""
            )
            & "."
    )
```

Esta medida puede apoyar una tarjeta narrativa, pero no sustituye la revisión del analista. El texto automático describe resultados; no debe inventar causas.

---

# 11. Diseño de la página ejecutiva

## 11.1 Zona 1: estado

Utilice:

- Tarjeta: `[Cumplimiento volumen comparable]`.
- Tarjeta secundaria: `[Brecha volumen USD]`.
- Comparación adicional: `[Cambio volumen YoY %]`.
- Indicador de estado: `[Estado cumplimiento volumen]`.

Pregunta que responde:

> ¿Cuál es el resultado y cómo se compara con la meta y el año anterior?

## 11.2 Zona 2: tendencia

Visual recomendado:

- Eje: `dim_fecha[anio_mes]`.
- Valores: `[Volumen transaccional]` y `[Meta volumen]`.

Pregunta que responde:

> ¿La brecha es reciente, persistente o estacional?

## 11.3 Zona 3: drivers

Visual recomendado:

- Barras por `dim_producto[producto]` o `dim_sucursal[sucursal]`.
- Valor: `[Brecha volumen USD]`.
- Orden: `[Impacto absoluto brecha]` descendente.
- Tooltip: volumen, meta, cumplimiento, cambio YoY y contribución.

Pregunta que responde:

> ¿Qué elementos explican la diferencia?

## 11.4 Zona 4: insight y acción

Muestre:

- `[Narrativa cumplimiento volumen]`.
- Una acción redactada por el analista.
- La advertencia de comparabilidad cuando corresponda.

Pregunta que responde:

> ¿Qué debe revisar o decidir el usuario?

---

# 12. Validaciones obligatorias

## 12.1 Volumen

- `[Volumen transaccional]` no debe ser negativo.
- Debe considerar únicamente operaciones contabilizadas.
- El valor absoluto debe aplicarse por transacción antes de sumar.
- No debe confundirse con `[Monto neto USD]`.

## 12.2 Meta

- La suma debe usar `meta_volumen_usd`.
- El escenario debe ser `Presupuesto`.
- La versión debe ser `V1_Aprobada`.
- La meta debe responder a fecha, producto y sucursal.
- La meta no debe desglosarse por canal sin una asignación aprobada.

## 12.3 Cumplimiento

- Una meta cero debe producir blanco mediante `DIVIDE`.
- El porcentaje debe ser coherente con volumen ÷ meta.
- La brecha porcentual debe ser igual a cumplimiento menos 100 %.
- Totales y subtotales deben recalcularse, no sumar porcentajes.

## 12.4 Drivers

- La suma de brechas por producto debe reconciliar con la brecha total cuando los productos sean exhaustivos y mutuamente excluyentes.
- La contribución puede superar 100 % cuando existen compensaciones.
- El ranking debe respetar los filtros visibles.
- Un driver grande no constituye automáticamente una causa.

## 12.5 Storytelling

- El mensaje debe incluir periodo y referencia.
- Resultado, interpretación e hipótesis deben distinguirse.
- La acción debe corresponder a la evidencia disponible.
- Los colores no deben cambiar el significado del signo.

---

# 13. Uso de otros KPIs del catálogo

## 13.1 Tasa de rechazo

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

Referencia recomendada:

- Periodo anterior.
- Año anterior.
- Umbral operativo aprobado, si existe.

No existe una meta de rechazo en `fact_meta_mensual`, por lo que no debe inventarse una.

## 13.2 Participación digital

```DAX
Transacciones digitales =
CALCULATE (
    [Transacciones contabilizadas],
    dim_canal[digital] = 1
)
```

```DAX
Participación digital =
DIVIDE (
    [Transacciones digitales],
    [Transacciones contabilizadas]
)
```

Referencia recomendada:

- Periodo anterior.
- Año anterior.
- Objetivo externo únicamente si existe una fuente gobernada.

## 13.3 Saldo promedio y meta de saldo

```DAX
Saldo promedio =
SUM ( fact_saldo_mensual[saldo_promedio_usd] )
```

```DAX
Meta saldo =
CALCULATE (
    SUM ( fact_meta_mensual[meta_saldo_usd] ),
    fact_meta_mensual[escenario] = "Presupuesto",
    fact_meta_mensual[version] = "V1_Aprobada"
)
```

```DAX
Cumplimiento saldo =
DIVIDE (
    [Saldo promedio],
    [Meta saldo]
)
```

Antes de publicar este KPI, valide si la meta se compara contra saldo promedio o saldo final. La columna disponible no resuelve por sí sola la definición de negocio.

## 13.4 Transacciones frente a meta

```DAX
Meta transacciones =
CALCULATE (
    SUM ( fact_meta_mensual[meta_transacciones] ),
    fact_meta_mensual[escenario] = "Presupuesto",
    fact_meta_mensual[version] = "V1_Aprobada"
)
```

```DAX
Cumplimiento transacciones =
DIVIDE (
    [Transacciones contabilizadas],
    [Meta transacciones]
)
```

Valide que la meta representa transacciones contabilizadas y no intentadas.

## 13.5 Clientes nuevos

`fact_meta_mensual` contiene `meta_clientes_nuevos`, pero el resultado real requiere definir:

- Qué fecha determina que un cliente es nuevo.
- Si se usa `dim_cliente[fecha_alta]`.
- Qué cliente se cuenta cuando existen cuentas conjuntas.
- Si la métrica se atribuye a sucursal y producto.

No construya el KPI hasta resolver estas decisiones.

---

# 14. Ejercicio guiado

## Objetivo

Construir una página de cumplimiento de volumen y redactar dos insights:

1. Insight frente a meta.
2. Insight sobre los drivers de la brecha.

## Paso 1. Prepare las medidas

Cree:

- `[Volumen transaccional]`
- `[Meta volumen]`
- `[Cumplimiento volumen]`
- `[Brecha volumen USD]`
- `[Brecha volumen %]`
- `[Volumen año anterior]`
- `[Cambio volumen YoY %]`

## Paso 2. Valide el total

Cree una tabla con:

- `dim_fecha[anio_mes]`
- `[Volumen transaccional]`
- `[Meta volumen]`
- `[Cumplimiento volumen]`
- `[Brecha volumen USD]`

Compruebe manualmente un mes:

```text
Cumplimiento = volumen ÷ meta
Brecha USD = volumen - meta
Brecha % = brecha USD ÷ meta
```

## Paso 3. Localice la brecha

Cree dos barras:

1. Brecha por producto.
2. Brecha por sucursal.

Ordene ambas por `[Impacto absoluto brecha]`.

## Paso 4. Pruebe filtros

Utilice segmentadores de:

- Año y mes.
- País.
- Región.
- Familia de producto.

Después agregue temporalmente un segmentador de canal y observe el comportamiento de la meta. Utilice `[Advertencia meta]` para explicar por qué el KPI no debe presentarse a ese nivel.

## Paso 5. Redacte el insight

Complete:

```text
El cumplimiento de volumen fue __________.
La brecha frente a la meta fue __________ USD, equivalente a __________.
El principal driver desfavorable fue __________ y explicó __________ de la brecha visible.
El resultado cambió __________ frente al año anterior.
El siguiente análisis recomendado es __________.
Todavía no puede afirmarse que __________.
```

## Paso 6. Revisión por pares

Pida a otra persona que responda:

- ¿Puede distinguir hechos e hipótesis?
- ¿La comparación utiliza una meta compatible?
- ¿El principal driver se identifica con una medida?
- ¿La recomendación corresponde a la evidencia?
- ¿La página permite comprender el resultado en menos de un minuto?

---

# 15. Plantilla final para completar un KPI

## A. Definición

```text
Nombre:
Propósito:
Dueño:
Frecuencia:
Unidad:
Numerador:
Denominador:
Incluye:
Excluye:
Fecha utilizada:
Fuente autorizada:
```

## B. Comparación

```text
Referencia principal:
Meta o periodo anterior:
Escenario:
Versión:
Dimensiones comparables:
Dimensiones no comparables:
Comportamiento esperado sin referencia:
```

## C. Medidas

```text
Medida base:
Medida de referencia:
Medida de cumplimiento:
Variación absoluta:
Variación porcentual:
Medida de control:
```

## D. Insight

```text
Resultado actual:
Magnitud de la diferencia:
Principal driver:
Contribución del driver:
Comparación temporal:
Implicación:
Siguiente acción:
Límite de la evidencia:
```

## E. Diseño

```text
KPI dominante:
Comparación visible:
Visual de tendencia:
Visual de drivers:
Filtros principales:
Advertencia de comparabilidad:
Detalle disponible:
```

## F. Validación

```text
Prueba de numerador:
Prueba de denominador:
Prueba de total:
Prueba con filtros:
Prueba sin meta:
Prueba de granularidad:
Reconciliación de drivers:
Aprobación del dueño:
```

---

# 16. Resultado esperado

Al terminar la guía, el alumno debe poder:

- Construir un KPI a partir de medidas base reutilizables.
- Comparar hechos de distinta granularidad mediante dimensiones compartidas.
- Reconocer cuándo una meta no puede analizarse en cierto nivel.
- Combinar meta, historia y drivers sin mezclar sus significados.
- Redactar insights basados en resultados verificables.
- Separar una concentración observable de una causa todavía no demostrada.
- Diseñar una página ejecutiva que conecte estado, explicación y acción.
