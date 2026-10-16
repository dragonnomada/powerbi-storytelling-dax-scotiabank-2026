# Guia - Drivers, concentración y navegación en Power BI

## Propósito

Esta guia utiliza el caso de transacciones bancarias para practicar tres capacidades de una página ejecutiva:

1. Identificar qué segmentos explican un cambio.
2. Medir concentración y priorizar categorías con lógica Pareto.
3. Navegar desde el resumen hasta el detalle sin perder el contexto.

El objetivo no es crear un tablero definitivo. El resultado esperado es un prototipo verificable que permita explicar **qué cambió, dónde se concentra y qué conviene investigar**.

> Los drivers utilizados en este ejercicio son contribuciones analíticas. Ayudan a priorizar el análisis, pero no demuestran causalidad.

---

## 1. Archivos y modelo mínimo

Utilice las siguientes tablas de la carpeta `Cartera`:

| Tabla | Uso en el ejercicio |
|---|---|
| `fact_transaccion.csv` | Resultados observados por transacción |
| `fact_meta_mensual.csv` | Objetivos por mes, sucursal y producto |
| `dim_fecha.csv` | Periodos y jerarquías de tiempo |
| `dim_producto.csv` | Producto, familia, subfamilia y mercado |
| `dim_sucursal.csv` | Sucursal, país, región y zona |
| `dim_canal.csv` | Canal y agrupación digital o presencial |

### Relaciones recomendadas

Configure relaciones de uno a muchos, con filtro en una sola dirección desde la dimensión hacia el hecho:

```text
dim_fecha[fecha_id]       1 ─── * fact_transaccion[fecha_operacion_id]
dim_producto[producto_id] 1 ─── * fact_transaccion[producto_id]
dim_sucursal[sucursal_id] 1 ─── * fact_transaccion[sucursal_id]
dim_canal[canal_id]       1 ─── * fact_transaccion[canal_id]

dim_fecha[fecha_id]       1 ─── * fact_meta_mensual[fecha_mes_id]
dim_producto[producto_id] 1 ─── * fact_meta_mensual[producto_id]
dim_sucursal[sucursal_id] 1 ─── * fact_meta_mensual[sucursal_id]
```

Para esta guia, `fact_transaccion` debe relacionarse con `dim_fecha` mediante `fecha_operacion_id`. Mantenga inactiva cualquier relación adicional con `fecha_contabilizacion_id`.

### Comprobaciones antes de comenzar

- `dim_fecha[fecha]` debe tener tipo Fecha y la tabla debe marcarse como tabla de fechas.
- Las claves de las dimensiones no deben contener duplicados.
- `monto_usd` y `comision_usd` deben ser numéricos.
- `fecha_operacion_id` y `fecha_id` deben utilizar el mismo tipo de dato.
- El sentido del importe debe conservarse: cargos o salidas pueden aparecer con signo negativo.

---

## 2. Medidas base

Cree una tabla vacía llamada `_Medidas` y almacene ahí las medidas del laboratorio.

### 2.1 Actividad y volumen

```DAX
Transacciones =
CALCULATE(
    COUNTROWS(fact_transaccion),
    fact_transaccion[estado] = "Contabilizada"
)
```

```DAX
Monto Neto USD =
CALCULATE(
    SUM(fact_transaccion[monto_usd]),
    fact_transaccion[estado] = "Contabilizada"
)
```

```DAX
Volumen Absoluto USD =
CALCULATE(
    SUMX(
        fact_transaccion,
        ABS(fact_transaccion[monto_usd])
    ),
    fact_transaccion[estado] = "Contabilizada"
)
```

```DAX
Comisiones USD =
CALCULATE(
    SUM(fact_transaccion[comision_usd]),
    fact_transaccion[estado] = "Contabilizada"
)
```

Utilice `Volumen Absoluto USD` cuando quiera estudiar actividad económica sin que entradas y salidas se cancelen. Utilice `Monto Neto USD` cuando el signo forme parte de la pregunta.

### 2.2 Comparación temporal

```DAX
Volumen Mes Anterior USD =
CALCULATE(
    [Volumen Absoluto USD],
    DATEADD(dim_fecha[fecha], -1, MONTH)
)
```

```DAX
Variación Volumen USD =
[Volumen Absoluto USD] - [Volumen Mes Anterior USD]
```

```DAX
Variación Volumen % =
DIVIDE(
    [Variación Volumen USD],
    [Volumen Mes Anterior USD]
)
```

```DAX
Variación Comisiones USD =
[Comisiones USD] -
CALCULATE(
    [Comisiones USD],
    DATEADD(dim_fecha[fecha], -1, MONTH)
)
```

### Validación rápida

Construya una matriz temporal con:

- Filas: `dim_fecha[anio_mes]`.
- Valores: `Volumen Absoluto USD`, `Volumen Mes Anterior USD` y `Variación Volumen USD`.

Compruebe manualmente dos meses consecutivos:

```text
Variación del mes actual = Volumen actual − Volumen del mes anterior
```

El primer mes visible puede devolver blanco si el modelo no contiene un periodo anterior.

---

# Práctica A. Visualizar drivers por segmento

## 3. Pregunta de análisis

> ¿Qué familias de producto, canales o mercados explican el cambio del volumen frente al mes anterior?

El segmento funciona como una forma de dividir la variación total. Si una familia presenta una variación de `+2 millones`, esa cantidad es su contribución absoluta al movimiento.

## 4. Medidas de contribución

Comience con familia de producto como nivel de análisis.

```DAX
Contribución Familia % =
VAR VariacionTotalVisible =
    CALCULATE(
        [Variación Volumen USD],
        ALLSELECTED(dim_producto[familia])
    )
RETURN
    DIVIDE(
        [Variación Volumen USD],
        VariacionTotalVisible
    )
```

```DAX
Ranking Driver Familia =
RANKX(
    ALLSELECTED(dim_producto[familia]),
    ABS([Variación Volumen USD]),
    ,
    DESC,
    DENSE
)
```

Se utiliza el valor absoluto únicamente para ordenar por impacto. La medida `Variación Volumen USD` debe conservar su signo.

### Control de reconciliación

```DAX
Variación Reconciliada Familia =
SUMX(
    VALUES(dim_producto[familia]),
    [Variación Volumen USD]
)
```

```DAX
Diferencia Reconciliación Familia =
[Variación Volumen USD] - [Variación Reconciliada Familia]
```

En el total de la página, `Diferencia Reconciliación Familia` debe ser cero o una diferencia mínima de redondeo.

## 5. Construcción del visual

### Visual principal: barras divergentes

1. Inserte un gráfico de barras horizontales.
2. Coloque `dim_producto[familia]` en el eje Y.
3. Coloque `Variación Volumen USD` en el eje X.
4. Ordene por `Variación Volumen USD` de mayor a menor o por `Ranking Driver Familia`.
5. Active etiquetas de datos.
6. Use rojo para contribuciones negativas y gris oscuro o verde moderado para positivas.
7. Agregue al tooltip:
   - `Volumen Absoluto USD`.
   - `Volumen Mes Anterior USD`.
   - `Variación Volumen %`.
   - `Contribución Familia %`.

### Segmentadores

Agregue:

- `dim_fecha[anio_mes]`, con selección única.
- `dim_sucursal[pais]`.
- `dim_canal[grupo_canal]`.

Seleccione un mes que tenga datos en el mes anterior. Cambie país y canal para observar si también cambia el ranking de drivers.

## 6. Variante dinámica por segmento

Para permitir que el alumno cambie entre Familia, Mercado, Canal y País, cree un **parámetro de campos** desde **Modelado > Parámetro nuevo > Campos**.

Incluya:

```text
dim_producto[familia]
dim_producto[mercado]
dim_canal[grupo_canal]
dim_sucursal[pais]
```

Nombre sugerido: `Selector Segmento`.

Después:

1. Reemplace `dim_producto[familia]` en el eje por el parámetro.
2. Coloque el parámetro como segmentador.
3. Pruebe cada nivel sin cambiar la medida `Variación Volumen USD`.

La medida específica `Contribución Familia %` sólo es válida para familia. Para una demostración inicial, utilice la contribución absoluta al cambiar dinámicamente de campo. En una solución productiva, cree una medida dinámica por nivel o Calculation Groups.

## 7. Preguntas para interpretar

- ¿El segmento de mayor volumen también es el principal driver del cambio?
- ¿Existen segmentos que compensan parcialmente una caída?
- ¿La variación se concentra en pocos elementos o está distribuida?
- ¿El driver cambia cuando se selecciona otro país o canal?
- ¿Qué evidencia adicional necesitaría para afirmar una causa?

### Redacción esperada

```text
El volumen del periodo cambió [importe] frente al mes anterior.
[Segmento 1] y [Segmento 2] concentran [porcentaje] del movimiento.
El resultado se observa principalmente en [filtro relevante].
Conviene revisar [siguiente análisis] antes de atribuir una causa.
```

---

# Práctica B. Medir concentración y construir un Pareto

## 8. Pregunta de análisis

> ¿Qué proporción del volumen total está concentrada en las principales familias de producto?

Concentración no significa variación. En esta práctica se estudia cuánto pesa cada categoría dentro del resultado actual.

## 9. Medidas de concentración

```DAX
Participación Volumen Familia % =
DIVIDE(
    [Volumen Absoluto USD],
    CALCULATE(
        [Volumen Absoluto USD],
        ALLSELECTED(dim_producto[familia])
    )
)
```

```DAX
Ranking Volumen Familia =
RANKX(
    ALLSELECTED(dim_producto[familia]),
    [Volumen Absoluto USD],
    ,
    DESC,
    DENSE
)
```

```DAX
Participación Acumulada Familia % =
VAR RankingActual = [Ranking Volumen Familia]
VAR TablaOrdenada =
    TOPN(
        RankingActual,
        ALLSELECTED(dim_producto[familia]),
        [Volumen Absoluto USD], DESC,
        dim_producto[familia], ASC
    )
RETURN
    SUMX(
        TablaOrdenada,
        [Participación Volumen Familia %]
    )
```

```DAX
Clase Pareto Familia =
SWITCH(
    TRUE(),
    [Participación Acumulada Familia %] <= 0.80, "A · Prioritaria",
    [Participación Acumulada Familia %] <= 0.95, "B · Intermedia",
    "C · Cola"
)
```

La clase Pareto es una regla demostrativa. El umbral debe ajustarse cuando el negocio utilice otra definición.

## 10. Construcción del Pareto

### Opción recomendada: gráfico combinado

1. Inserte un gráfico de líneas y columnas agrupadas.
2. Use `dim_producto[familia]` en el eje X.
3. Use `Volumen Absoluto USD` como valor de columnas.
4. Use `Participación Acumulada Familia %` como valor de línea.
5. Ordene las categorías por `Volumen Absoluto USD` de mayor a menor.
6. Active el eje secundario para la línea y configúrelo de 0 % a 100 %.
7. Formatee las columnas en gris y la línea acumulada en rojo.
8. Agregue una línea constante al 80 % si el visual lo permite.

### Tabla de apoyo

Agregue una tabla con:

- Familia.
- Volumen absoluto.
- Participación.
- Ranking.
- Participación acumulada.
- Clase Pareto.

Esto facilita validar el gráfico y explicar el cálculo.

## 11. Validaciones

Realice estas comprobaciones después de cada cambio de filtro:

- La suma de `Participación Volumen Familia %` debe ser aproximadamente 100 %.
- La última categoría del Pareto debe alcanzar aproximadamente 100 %.
- El acumulado no debe disminuir.
- Las categorías deben permanecer ordenadas por volumen descendente.
- Los segmentadores deben recalcular tanto las barras como la línea.

### Medida de control opcional

```DAX
Control Participación Familia =
SUMX(
    VALUES(dim_producto[familia]),
    [Participación Volumen Familia %]
)
```

En una tarjeta, la medida debe mostrar 100 % bajo el contexto visible.

## 12. Comparación útil: peso frente a contribución

Cree una matriz con:

| Campo | Propósito |
|---|---|
| Familia | Segmento analizado |
| Participación Volumen Familia % | Peso dentro del resultado actual |
| Contribución Familia % | Participación dentro del cambio |
| Variación Volumen USD | Dirección y magnitud del movimiento |

Busque una familia que tenga mucho peso, pero poca contribución a la variación. Este caso demuestra por qué concentración y driver no son sinónimos.

---

# Práctica C. Navegación, drill-down y drill-through

## 13. Diseñar la ruta de lectura

Construya tres páginas:

```text
01 Resumen ejecutivo
        ↓
02 Drivers y concentración
        ↓
03 Detalle del segmento
```

La primera página informa el estado. La segunda explica dónde se concentra el resultado y el cambio. La tercera permite investigar un elemento específico.

## 14. Página 01: Resumen ejecutivo

Incluya:

- Tarjeta: `Volumen Absoluto USD`.
- Tarjeta: `Variación Volumen %`.
- Tarjeta: `Transacciones`.
- Línea temporal: volumen por `anio_mes`.
- Botón: **Analizar drivers**.

Configure el botón con:

```text
Acción: Navegación de página
Destino: 02 Drivers y concentración
```

Mantenga visibles los segmentadores de periodo, país y canal.

## 15. Página 02: Drivers y concentración

Incluya los dos visuales construidos anteriormente:

- Barras divergentes de `Variación Volumen USD` por segmento.
- Pareto de concentración.

### Sincronizar segmentadores

1. Abra **Vista > Sincronización de segmentadores**.
2. Sincronice periodo, país y canal entre las páginas 01 y 02.
3. Decida si serán visibles en ambas páginas.
4. Cambie un filtro en la página 01 y confirme que la página 02 conserva el contexto.

### Jerarquía para drill-down

Cree una jerarquía territorial:

```text
Región
  └── País
        └── Sucursal
```

Después:

1. Inserte un gráfico de barras con la jerarquía en el eje.
2. Use `Volumen Absoluto USD` como valor.
3. Active el modo de exploración.
4. Pruebe **bajar un nivel** y **expandir todo un nivel**.

Observe la diferencia:

- **Bajar un nivel:** sustituye el nivel actual por el siguiente.
- **Expandir un nivel:** conserva el nivel actual y muestra el detalle inferior.

## 16. Página 03: Detalle del segmento

Esta página será un destino de drill-through.

### Configuración

1. Agregue `dim_producto[familia]` al área **Obtener detalles** o **Drill-through**.
2. Active **Mantener todos los filtros**.
3. Agregue un botón de regreso.
4. Añada un título dinámico.

```DAX
Título Detalle Familia =
VAR FamiliaSeleccionada =
    SELECTEDVALUE(
        dim_producto[familia],
        "varias familias"
    )
RETURN
    "Detalle de " & FamiliaSeleccionada
```

### Contenido sugerido

- Tarjetas de volumen, variación y transacciones.
- Tendencia mensual de la familia seleccionada.
- Barras por producto.
- Barras por canal.
- Tabla breve de sucursales con mayor volumen.

Evite mostrar identificadores de clientes o cuentas si no son necesarios para la decisión.

### Prueba del drill-through

1. Regrese a la página 02.
2. Seleccione una familia en el gráfico de drivers.
3. Abra el menú contextual y seleccione la página de detalle.
4. Compruebe que el título muestra la familia seleccionada.
5. Confirme que periodo, país y canal siguen aplicados.
6. Use el botón de regreso.

## 17. Tooltip de apoyo

Cree una página de tooltip para evitar saturar el gráfico de drivers.

Incluya:

- Volumen actual.
- Volumen del mes anterior.
- Variación absoluta.
- Variación porcentual.
- Participación del segmento.

Configure el tamaño de página como Tooltip y asígnelo al gráfico de barras.

---

# Práctica D. Integrar la explicación ejecutiva

## 18. Construir un texto guiado

Después de seleccionar un periodo y un segmento, complete esta estructura:

```text
RESULTADO
El volumen del periodo fue de __________.

REFERENCIA
Esto representa una variación de __________ frente al mes anterior.

CONCENTRACIÓN
Las categorías __________ concentran __________ del resultado o del cambio.

IMPLICACIÓN
La mayor exposición se encuentra en __________.

ACCIÓN
Conviene profundizar en __________ antes de atribuir una causa.
```

### Reglas de redacción

- Indique siempre la unidad y el periodo.
- Diferencie volumen actual de contribución al cambio.
- No utilice “causó” si sólo existe concentración o correlación.
- Utilice “se concentra”, “explica matemáticamente” o “conviene investigar”.
- Mantenga la acción relacionada con la evidencia disponible.

---

# 19. Reto para los alumnos

## Nivel 1

Cambie el segmento de Familia a Canal y reconstruya el gráfico de drivers.

## Nivel 2

Compare dos países y documente si cambia la concentración de las tres principales familias.

## Nivel 3

Construya un segundo drill-through por sucursal. La página debe conservar periodo, producto y canal.

## Nivel 4

Agregue un botón para alternar entre:

- Variación de volumen.
- Variación de comisiones.

Puede realizarlo con parámetros de campos, marcadores o un Calculation Group.

---

# 20. Lista de verificación final

## Drivers

- [ ] La variación se calcula contra un periodo válido.
- [ ] Los valores positivos y negativos conservan su signo.
- [ ] Las contribuciones se reconcilian con la variación total.
- [ ] El ranking responde a los filtros visibles.
- [ ] La interpretación no confunde driver con causa.

## Concentración

- [ ] La participación suma aproximadamente 100 %.
- [ ] El Pareto está ordenado de mayor a menor.
- [ ] El acumulado termina aproximadamente en 100 %.
- [ ] La lectura distingue peso actual y contribución al cambio.

## Navegación

- [ ] Existe una ruta clara entre resumen, drivers y detalle.
- [ ] Los filtros relevantes se conservan entre páginas.
- [ ] La página de drill-through muestra el contexto seleccionado.
- [ ] Existe un botón de regreso.
- [ ] No hay páginas sin salida ni datos sensibles innecesarios.

## Storytelling

- [ ] El título comunica el mensaje o la pregunta principal.
- [ ] La explicación contiene resultado, referencia y concentración.
- [ ] Las hipótesis se presentan como hipótesis.
- [ ] La acción propuesta corresponde a la evidencia.

---

# Resultado esperado

Al terminar, el archivo de Power BI debe permitir esta secuencia:

1. Observar el resultado y su variación.
2. Identificar los segmentos con mayor contribución al cambio.
3. Evaluar la concentración del resultado.
4. Cambiar filtros y comprobar que las medidas se recalculan.
5. Profundizar territorialmente mediante drill-down.
6. Abrir el detalle de una familia mediante drill-through.
7. Redactar una explicación ejecutiva prudente y respaldada por el modelo.

