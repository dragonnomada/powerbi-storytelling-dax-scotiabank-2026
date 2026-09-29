# Caso práctico: pagos a proveedores

## Objetivo

Partir de una tabla combinada y convertirla en un modelo analítico pequeño mediante Power Query. El ejercicio permite practicar:

- identificación de la granularidad;
- separación de hechos y dimensiones;
- eliminación controlada de duplicados;
- definición de claves y relaciones;
- creación manual de un calendario;
- validación de importes y registros;
- construcción de métricas para análisis de pagos.

El archivo fuente es `pagos_proveedores_tabla_combinada.csv`.

## Contexto del caso

El área de cuentas por pagar recibe un archivo que mezcla información de proveedores, facturas, centros de costo y pagos. Una factura puede tener:

- un pago completo;
- varios pagos parciales;
- un pago parcial pendiente de liquidación;
- ningún pago;
- un pago aplicado y un reverso posterior.

Por esta razón, los datos de la factura y del proveedor aparecen repetidos cuando existen varios movimientos de pago.

## Contenido esperado del archivo

| Control | Resultado esperado |
|---|---:|
| Filas de la tabla combinada | 29 |
| Proveedores distintos | 8 |
| Facturas distintas | 24 |
| Filas con `PagoID` | 25 |
| Facturas con estado `Pendiente` | 5 |
| Facturas con estado `Parcial` | 4 |
| Importe total de facturas en moneda base | 1,006,689.04 |
| Importe neto pagado en moneda base | 707,057.59 |

Los totales se incluyen como controles de clase. No deben copiarse al modelo como valores fijos.

## Granularidad de la tabla combinada

Una fila representa una combinación de factura y movimiento de pago.

- Si una factura tiene dos pagos, sus datos aparecen en dos filas.
- Si un pago fue reversado, el reverso aparece como otro movimiento con importe negativo.
- Si una factura todavía no tiene pagos, aparece una fila con `PagoID` vacío e `ImportePagoBase` igual a cero.

La tabla combinada no debe utilizarse directamente para sumar `ImporteFacturaBase`. Ese importe se repite por cada pago de la factura y produciría doble conteo.

## Modelo mínimo propuesto

```text
DimProveedor ──┐
DimFactura ────┤
DimCentroCosto ├── FactPago ── DimFecha
DimMedioPago ──┤
DimMoneda ─────┘
```

Todas las relaciones deben ser de uno a muchos, desde la dimensión hacia `FactPago`, con dirección de filtro única.

## Paso 1. Importar y preparar la consulta de origen

1. En Power BI, seleccione **Obtener datos > Texto/CSV**.
2. Importe `pagos_proveedores_tabla_combinada.csv`.
3. Seleccione **Transformar datos**.
4. Cambie el nombre de la consulta a `Origen_PagosProveedores`.
5. Desactive **Habilitar carga** para esta consulta. Su función será alimentar las consultas finales.
6. Confirme los tipos:
   - identificadores y descripciones: texto;
   - fechas: fecha;
   - días de condición: número entero;
   - tipos de cambio e importes: número decimal fijo;
   - no convierta los identificadores a números.

Use **Referencia** y no **Duplicar** para crear las tablas siguientes. Así todas dependerán de una sola preparación del origen.

## Paso 2. Crear `DimProveedor`

Conserve estas columnas:

- `ProveedorID`
- `ProveedorNombre`
- `TipoProveedor`
- `CategoriaCompra`
- `PaisProveedor`
- `CiudadProveedor`
- `RiesgoProveedor`
- `CondicionPagoDias`

Después:

1. Ordene por `ProveedorID`.
2. Quite duplicados usando únicamente `ProveedorID`.
3. Compruebe que quedan 8 filas.
4. Verifique que `ProveedorID` no contiene valores vacíos ni duplicados.

La clave de la dimensión será `ProveedorID`.

## Paso 3. Crear `DimFactura`

Conserve estas columnas:

- `FacturaID`
- `NumeroFactura`
- `FechaFactura`
- `FechaVencimiento`
- `ProveedorID`
- `CentroCostoID`
- `MonedaFactura`
- `TipoCambioFactura`
- `ImporteSubtotal`
- `ImporteImpuesto`
- `ImporteFactura`
- `ImporteFacturaBase`
- `EstadoFacturaFuente`

Después:

1. Ordene por `FacturaID`.
2. Quite duplicados usando únicamente `FacturaID`.
3. Compruebe que quedan 24 filas.
4. Valide que cada factura conserva un solo proveedor, centro de costo, moneda e importe.

Para este ejercicio, `DimFactura` combina atributos descriptivos y datos de control de la factura. En un modelo corporativo más estricto, los importes y estados históricos de factura pueden trasladarse a una segunda tabla de hechos llamada `FactFactura`.

## Paso 4. Crear `DimCentroCosto`

Conserve:

- `CentroCostoID`
- `CentroCostoNombre`
- `UnidadNegocio`
- `ResponsableCentroCosto`

Quite duplicados por `CentroCostoID`. El resultado esperado es de 4 filas.

## Paso 5. Crear `DimMedioPago`

1. Filtre los registros con `PagoID` no vacío.
2. Conserve `MetodoPago` y `CuentaBancoPago`.
3. Agregue una columna personalizada:

```powerquery
[MetodoPago] & " | " & [CuentaBancoPago]
```

4. Llame a la columna `MedioPagoKey`.
5. Quite duplicados por `MedioPagoKey`.

La misma columna deberá crearse en `FactPago` para relacionar ambas tablas.

## Paso 6. Crear `DimMoneda`

1. Filtre registros con `PagoID` no vacío.
2. Conserve `MonedaPago`.
3. Quite duplicados.
4. Cambie el nombre de la columna a `MonedaID` si desea usar una convención uniforme.

No coloque el tipo de cambio en la dimensión. El tipo de cambio corresponde al movimiento y permanece en la tabla de hechos.

## Paso 7. Crear `FactPago`

1. Cree una referencia de `Origen_PagosProveedores`.
2. Filtre `PagoID` para conservar únicamente valores no vacíos.
3. Cree `MedioPagoKey` con la misma regla usada en `DimMedioPago`.
4. Conserve:

| Campo | Función |
|---|---|
| `PagoID` | Clave del movimiento |
| `FechaPago` | Fecha del hecho |
| `FacturaID` | Relación con la factura |
| `ProveedorID` | Relación con el proveedor |
| `CentroCostoID` | Relación con el centro de costo |
| `MedioPagoKey` | Relación con el medio de pago |
| `MonedaPago` | Relación con moneda |
| `EstadoPago` | Estado del movimiento |
| `ReferenciaPago` | Identificador operativo |
| `TipoCambioPago` | Conversión a moneda base |
| `ImportePago` | Importe en moneda original |
| `ImportePagoBase` | Importe firmado en moneda base |

La granularidad final es: **una fila por movimiento de pago o reverso**.

El resultado esperado es de 25 filas. `PagoID` debe ser único.

## Paso 8. Crear manualmente `DimFecha`

En **Modelado > Nueva tabla**, cree el calendario:

```DAX
DimFecha =
CALENDAR ( DATE ( 2025, 1, 1 ), DATE ( 2025, 12, 31 ) )
```

Agregue columnas:

```DAX
Año = YEAR ( DimFecha[Date] )
MesNumero = MONTH ( DimFecha[Date] )
Mes = FORMAT ( DimFecha[Date], "mmmm" )
AñoMes = FORMAT ( DimFecha[Date], "yyyy-MM" )
Trimestre = "T" & FORMAT ( DimFecha[Date], "Q" )
DíaSemanaNumero = WEEKDAY ( DimFecha[Date], 2 )
DíaSemana = FORMAT ( DimFecha[Date], "dddd" )
FinDeMes = EOMONTH ( DimFecha[Date], 0 )
```

Ordene `Mes` por `MesNumero` y marque `DimFecha` como tabla de fechas usando la columna `Date`.

## Paso 9. Crear las relaciones

| Desde | Hacia | Cardinalidad | Dirección |
|---|---|---|---|
| `DimProveedor[ProveedorID]` | `FactPago[ProveedorID]` | 1:* | Única |
| `DimFactura[FacturaID]` | `FactPago[FacturaID]` | 1:* | Única |
| `DimCentroCosto[CentroCostoID]` | `FactPago[CentroCostoID]` | 1:* | Única |
| `DimMedioPago[MedioPagoKey]` | `FactPago[MedioPagoKey]` | 1:* | Única |
| `DimMoneda[MonedaID]` | `FactPago[MonedaPago]` | 1:* | Única |
| `DimFecha[Date]` | `FactPago[FechaPago]` | 1:* | Única |

Evite relacionar entre sí `DimProveedor` y `DimFactura` si ambas ya se conectan directamente con `FactPago`. Esto evita rutas de filtro ambiguas.

## Validaciones obligatorias

### Estructura

- `DimProveedor[ProveedorID]` debe ser único y no nulo.
- `DimFactura[FacturaID]` debe ser único y no nulo.
- `FactPago[PagoID]` debe ser único y no nulo.
- Todas las claves de `FactPago` deben encontrar correspondencia en sus dimensiones.
- `DimFecha` debe cubrir todas las fechas de pago.

### Reconciliación

1. La cantidad de registros de `FactPago` debe ser igual a la cantidad de filas del origen con `PagoID` no vacío: 25.
2. La suma de `FactPago[ImportePagoBase]` debe ser 707,057.59.
3. La suma de `DimFactura[ImporteFacturaBase]` debe ser 1,006,689.04.
4. La suma de `ImporteFacturaBase` en la tabla combinada no debe usarse como control porque las facturas con varios pagos están repetidas.
5. Debe existir al menos un movimiento negativo con `EstadoPago = Reversado`.
6. Las cuatro facturas sin `PagoID` no deben generar filas ficticias en `FactPago`.

### Prueba visual de doble conteo

Cree dos tarjetas temporales:

- `SUM(Origen_PagosProveedores[ImporteFacturaBase])`
- `SUM(DimFactura[ImporteFacturaBase])`

Los valores serán distintos. La primera tarjeta suma facturas repetidas. La segunda utiliza una fila por factura y es el control correcto.

## Medidas DAX sugeridas

```DAX
Monto pagado base =
SUM ( FactPago[ImportePagoBase] )
```

```DAX
Número de movimientos =
COUNTROWS ( FactPago )
```

```DAX
Facturas con movimiento =
DISTINCTCOUNT ( FactPago[FacturaID] )
```

```DAX
Proveedores pagados =
DISTINCTCOUNT ( FactPago[ProveedorID] )
```

```DAX
Pago promedio =
DIVIDE ( [Monto pagado base], [Número de movimientos] )
```

```DAX
Movimientos reversados =
CALCULATE (
    [Número de movimientos],
    FactPago[EstadoPago] = "Reversado"
)
```

```DAX
Monto reversado base =
- CALCULATE (
    [Monto pagado base],
    FactPago[EstadoPago] = "Reversado"
)
```

```DAX
Pagos posteriores al vencimiento =
COUNTROWS (
    FILTER (
        FactPago,
        FactPago[FechaPago] > RELATED ( DimFactura[FechaVencimiento] )
    )
)
```

```DAX
% movimientos posteriores al vencimiento =
DIVIDE ( [Pagos posteriores al vencimiento], [Número de movimientos] )
```

## Análisis interesantes para la clase

1. **Pagos por mes:** línea con `DimFecha[AñoMes]` y `Monto pagado base`.
2. **Concentración por proveedor:** barras con proveedor y monto neto pagado.
3. **Pagos por categoría de compra:** comparar tecnología, logística, consultoría y otras categorías.
4. **Cumplimiento de vencimiento:** movimientos realizados antes o después de la fecha de vencimiento.
5. **Facturas parciales:** identificar facturas con pagos que no cubren el importe total.
6. **Reversos:** localizar movimientos negativos y comprobar su efecto sobre el monto neto.
7. **Exposición por moneda:** comparar montos originales por moneda y montos convertidos a moneda base.
8. **Centros de costo:** revisar qué áreas concentran pagos y cuántos proveedores utilizan.
9. **Riesgo de proveedor:** cruzar riesgo, monto pagado y retrasos.
10. **Medio de pago:** comparar transferencia y pago electrónico, incluyendo la cuenta bancaria utilizada.

## Preguntas para discusión

- ¿Por qué `ImporteFacturaBase` no debe sumarse directamente desde el archivo combinado?
- ¿Qué diferencia existe entre una factura pendiente sin pago y una factura cuyo pago fue reversado?
- ¿Qué columnas describen entidades y cuáles describen eventos?
- ¿El estado de la factura debería permanecer en una dimensión si cambia con el tiempo?
- ¿Cuándo convendría crear una segunda tabla de hechos para las facturas?
- ¿Qué ocurriría si se activara el filtro bidireccional en todas las relaciones?

## Extensión opcional: modelo con dos hechos

Para conectar este ejercicio con múltiples tablas de hechos, transforme `DimFactura` en:

- `DimFactura`: identificadores y atributos descriptivos;
- `FactFactura`: una fila por factura, con importes, fechas, estado, proveedor y centro de costo;
- `FactPago`: una fila por movimiento de pago.

`DimProveedor`, `DimCentroCosto`, `DimMoneda` y `DimFecha` funcionarían como dimensiones compartidas. Esta versión permite analizar correctamente todas las facturas, incluidas las que aún no tienen pagos, sin depender de atributos numéricos dentro de una dimensión.

## Resultado esperado

Al terminar, el alumno debe poder explicar:

1. qué representa una fila de cada tabla;
2. por qué los atributos repetidos se separaron;
3. qué claves sostienen las relaciones;
4. qué importe se puede sumar y desde qué tabla;
5. cómo se validó que la separación no cambió los totales;
6. qué limitaciones conserva el modelo mínimo y cómo evolucionaría a un modelo corporativo.
