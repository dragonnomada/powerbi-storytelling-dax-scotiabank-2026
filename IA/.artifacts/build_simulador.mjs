import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const inputPath = "/Users/dragonnomada/Desktop/GitHub/powerbi-storytelling-dax-scotiabank-2026/IA/transacciones digitales.xlsx";
const outputDir = "/Users/dragonnomada/Desktop/GitHub/powerbi-storytelling-dax-scotiabank-2026/IA/outputs";
const outputPath = `${outputDir}/simulador_brecha_transaccional_dax.xlsx`;
const previewDir = `${outputDir}/preview_simulador`;
const font = "Arial";
const navy = "#17365D";
const blue = "#2F75B5";
const lightBlue = "#D9EAF7";
const green = "#00843D";
const lightGreen = "#E2F0D9";
const amber = "#FFF2CC";
const red = "#C00000";
const lightRed = "#FCE4D6";
const gray = "#E7E6E6";
const dark = "#222222";

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

const clean = [
  ["Aportación",0,719],["Aportación",1,2237],
  ["Avance de efectivo",0,511],["Avance de efectivo",1,1727],
  ["Cargo de interés",0,1129],["Cargo de interés",1,3680],
  ["Compra",0,1561],["Compra",1,4832],
  ["Depósito",0,905],["Depósito",1,3597],
  ["Desembolso",0,1136],["Desembolso",1,3510],
  ["Indemnización",0,643],["Indemnización",1,1810],
  ["Pago de crédito",0,1180],["Pago de crédito",1,3599],
  ["Pago de prima",0,669],["Pago de prima",1,1878],
  ["Pago de servicio",0,931],["Pago de servicio",1,3603],
  ["Pago de tarjeta",0,564],["Pago de tarjeta",1,1664],
  ["Rendimiento",0,757],["Rendimiento",1,2171],
  ["Retiro",0,869],["Retiro",1,3610],
  ["Retiro de inversión",0,737],["Retiro de inversión",1,2222],
  ["Transferencia enviada",0,908],["Transferencia enviada",1,3645],
  ["Transferencia recibida",0,896],["Transferencia recibida",1,3673],
];

const ticketAssumptions = {
  "Aportación": 250,
  "Avance de efectivo": 180,
  "Cargo de interés": 35,
  "Compra": 85,
  "Depósito": 300,
  "Desembolso": 1200,
  "Indemnización": 1500,
  "Pago de crédito": 420,
  "Pago de prima": 160,
  "Pago de servicio": 75,
  "Pago de tarjeta": 320,
  "Rendimiento": 45,
  "Retiro": 140,
  "Retiro de inversión": 800,
  "Transferencia enviada": 500,
  "Transferencia recibida": 520,
};

const channels = [
  ["Sucursal", 0, 0, -0.08, 1.00, 0.01],
  ["App móvil", 1, 0.55, 0.18, 0.90, 0.03],
  ["Banca web", 1, 0.30, 0.10, 1.15, 0.02],
  ["ATM", 1, 0.15, 0.04, 0.75, 0.01],
];

const types = [...new Set(clean.map(r => String(r[0])))];
const wb = Workbook.create();
const summary = wb.worksheets.add("Resumen");
const drivers = wb.worksheets.add("Drivers");
const fact = wb.worksheets.add("Fact_Simulacion");
const assumptions = wb.worksheets.add("Supuestos");
const source = wb.worksheets.add("Fuente");
const dax = wb.worksheets.add("Modelo_DAX");

for (const sh of [summary, drivers, fact, assumptions, source, dax]) {
  sh.showGridLines = false;
}
summary.tabColor = navy;
drivers.tabColor = blue;
assumptions.tabColor = "#5B9BD5";
source.tabColor = "#A5A5A5";
dax.tabColor = "#70AD47";

function title(sheet, text, subtitle, endCol = "J") {
  sheet.getRange(`A2:${endCol}2`).format.borders = { bottom: { style: "thin", color: blue } };
  sheet.getRange("A2").values = [[text]];
  sheet.getRange("A2").format.font = { name: font, size: 16, bold: true, color: navy };
  sheet.getRange("A3").values = [[subtitle]];
  sheet.getRange(`A3:${endCol}3`).format.font = { name: font, size: 10, italic: true, color: "#666666" };
}

function section(sheet, range, text) {
  const r = sheet.getRange(range);
  const anchor = range.split(":")[0];
  sheet.getRange(anchor).values = [[text]];
  r.format.fill = lightBlue;
  r.format.font = { name: font, size: 10, bold: true, color: navy };
  r.format.borders = { preset: "outside", style: "thin", color: "#9EADBA" };
}

function header(range) {
  range.format.fill = navy;
  range.format.font = { name: font, size: 10, bold: true, color: "#FFFFFF" };
  range.format.horizontalAlignment = "center";
  range.format.verticalAlignment = "center";
  range.format.wrapText = true;
  range.format.borders = { insideVertical: { style: "thin", color: "#FFFFFF" }, bottom: { style: "thin", color: navy } };
}

function body(range) {
  range.format.font = { name: font, size: 10, color: dark };
  range.format.verticalAlignment = "center";
}

// Fuente
title(source, "Fuente depurada", "Registros observados de 2025. Se excluyen la fila Total y las notas del archivo original.", "E");
source.getRange("A5:D5").values = [["tipo_transaccion", "digital", "Transacciones intentadas", "Año"]];
header(source.getRange("A5:D5"));
source.getRange(`A6:D${5 + clean.length}`).values = clean.map(r => [r[0], r[1], r[2], 2025]);
body(source.getRange(`A6:D${5 + clean.length}`));
source.getRange(`B6:B${5 + clean.length}`).format.horizontalAlignment = "center";
source.getRange(`C6:C${5 + clean.length}`).format.numberFormat = "#,##0";
source.getRange("A39").values = [["Control de fuente"]];
source.getRange("B39").formulas = [[`=SUM(C6:C${5 + clean.length})`]];
source.getRange("B39").format.numberFormat = "#,##0";
source.getRange("A40").values = [["Total declarado en archivo"]];
source.getRange("B40").values = [[61573]];
source.getRange("A41").values = [["Diferencia"]];
source.getRange("B41").formulas = [["=B39-B40"]];
source.getRange("B41").format.numberFormat = "0.00";
source.getRange("A39:B41").format.borders = { preset: "outside", style: "thin", color: "#A6A6A6" };
source.getRange("A39:A41").format.font = { name: font, size: 10, bold: true, color: navy };
source.getRange("A5:D37").format.rowHeight = 19;
source.getRange("A:A").format.columnWidth = 28;
source.getRange("B:B").format.columnWidth = 12;
source.getRange("C:C").format.columnWidth = 24;
source.getRange("D:D").format.columnWidth = 11;
source.freezePanes.freezeRows(5);
source.tables.add(`A5:D${5 + clean.length}`, true, "tblFuenteTransacciones").style = "TableStyleMedium2";

// Supuestos
title(assumptions, "Supuestos de simulación", "Celdas amarillas son editables. Los importes representan tickets promedio supuestos en USD.", "H");
assumptions.getRange("A5:B8").values = [
  ["Parámetro", "Valor"],
  ["Escenario", "Base"],
  ["Año", 2025],
  ["Moneda", "USD"],
];
header(assumptions.getRange("A5:B5"));
body(assumptions.getRange("A6:B8"));
assumptions.getRange("B6:B8").format.fill = amber;
assumptions.getRange("B6:B8").format.font = { name: font, size: 10, color: blue };
section(assumptions, "A10:F10", "Supuestos por canal");
assumptions.getRange("A11:F11").values = [["Canal", "Es digital", "Mix actual digital", "Cambio volumen", "Multiplicador ticket", "Cambio ticket"]];
header(assumptions.getRange("A11:F11"));
assumptions.getRange("A12:F15").values = channels;
body(assumptions.getRange("A12:F15"));
assumptions.getRange("B12:B15").format.horizontalAlignment = "center";
assumptions.getRange("C12:C15").format.numberFormat = "0.0%";
assumptions.getRange("D12:D15").format.numberFormat = "0.0%";
assumptions.getRange("E12:E15").format.numberFormat = "0.00x";
assumptions.getRange("F12:F15").format.numberFormat = "0.0%";
assumptions.getRange("C12:F15").format.fill = amber;
assumptions.getRange("C12:F15").format.font = { name: font, size: 10, color: blue };
assumptions.getRange("A17").values = [["Validación mix digital"]];
assumptions.getRange("B17").formulas = [["=SUMIFS(C12:C15,B12:B15,1)"]];
assumptions.getRange("B17").format.numberFormat = "0.0%";
assumptions.getRange("C17").values = [["Debe ser 100.0%"]];
assumptions.getRange("A17:C17").format.font = { name: font, size: 10, bold: true, color: navy };
section(assumptions, "A20:B20", "Ticket base por tipo de transacción");
assumptions.getRange("A21:B21").values = [["Tipo de transacción", "Ticket base USD"]];
header(assumptions.getRange("A21:B21"));
assumptions.getRange(`A22:B${21 + types.length}`).values = types.map(t => [t, ticketAssumptions[t]]);
body(assumptions.getRange(`A22:B${21 + types.length}`));
assumptions.getRange(`B22:B${21 + types.length}`).format.fill = amber;
assumptions.getRange(`B22:B${21 + types.length}`).format.font = { name: font, size: 10, color: blue };
assumptions.getRange(`B22:B${21 + types.length}`).format.numberFormat = "$#,##0.00;($#,##0.00);-";
assumptions.getRange("D20").values = [["Interpretación"]];
assumptions.getRange("D20:H20").format.fill = gray;
assumptions.getRange("D20:H20").format.font = { name: font, size: 10, bold: true, color: navy };
assumptions.getRange("D21:H26").values = [
  ["Los volúmenes observados provienen de la fuente."],
  ["El canal específico no existe en la fuente; el mix digital distribuye el total digital."],
  ["El monto_usd se estima como transacciones × ticket promedio."],
  ["La simulación aplica cambios de volumen y ticket por canal."],
  ["Todos los montos se presentan en valor absoluto."],
  ["Sustituya los supuestos por datos observados antes de producción."],
];
assumptions.getRange("D21:H26").format.font = { name: font, size: 10, color: dark };
assumptions.getRange("D21:H26").format.wrapText = true;
assumptions.getRange("A:A").format.columnWidth = 28;
assumptions.getRange("B:B").format.columnWidth = 18;
assumptions.getRange("C:C").format.columnWidth = 19;
assumptions.getRange("D:D").format.columnWidth = 19;
assumptions.getRange("E:E").format.columnWidth = 20;
assumptions.getRange("F:F").format.columnWidth = 17;
assumptions.getRange("G:H").format.columnWidth = 15;
assumptions.freezePanes.freezeRows(3);

// Fact simulation
title(fact, "Hechos simulados", "Granularidad: año, tipo de transacción y canal. Tabla preparada para importar a Power BI.", "Y");
const factHeaders = ["Año","Escenario","Tipo de transacción","Canal","Es digital","Mix canal","Tx observadas base","Ticket base USD","Multiplicador canal","Tx actuales","Ticket actual USD","Monto actual USD","Cambio volumen","Cambio ticket","Tx simuladas","Ticket simulado USD","Monto simulado USD","Brecha monto USD","Driver volumen USD","Driver ticket USD","Interacción USD","Check drivers"];
fact.getRange("A5:V5").values = [factHeaders];
header(fact.getRange("A5:V5"));
const factRows = [];
for (const t of types) for (const c of channels) factRows.push([2025, "Base", t, c[0], c[1]]);
const firstFact = 6;
const lastFact = firstFact + factRows.length - 1;
fact.getRange(`A${firstFact}:E${lastFact}`).values = factRows;
body(fact.getRange(`A${firstFact}:V${lastFact}`));
for (let r = firstFact; r <= lastFact; r++) {
  fact.getRange(`F${r}`).formulas = [[`=VLOOKUP(D${r},Supuestos!$A$12:$F$15,3,FALSE)`]];
  fact.getRange(`G${r}`).formulas = [[`=SUMIFS(Fuente!$C$6:$C$37,Fuente!$A$6:$A$37,C${r},Fuente!$B$6:$B$37,E${r})`]];
  fact.getRange(`H${r}`).formulas = [[`=VLOOKUP(C${r},Supuestos!$A$22:$B$37,2,FALSE)`]];
  fact.getRange(`I${r}`).formulas = [[`=VLOOKUP(D${r},Supuestos!$A$12:$F$15,5,FALSE)`]];
  fact.getRange(`J${r}`).formulas = [[`=G${r}*IF(E${r}=1,F${r},1)`]];
  fact.getRange(`K${r}`).formulas = [[`=H${r}*I${r}`]];
  fact.getRange(`L${r}`).formulas = [[`=ABS(J${r}*K${r})`]];
  fact.getRange(`M${r}`).formulas = [[`=VLOOKUP(D${r},Supuestos!$A$12:$F$15,4,FALSE)`]];
  fact.getRange(`N${r}`).formulas = [[`=VLOOKUP(D${r},Supuestos!$A$12:$F$15,6,FALSE)`]];
  fact.getRange(`O${r}`).formulas = [[`=J${r}*(1+M${r})`]];
  fact.getRange(`P${r}`).formulas = [[`=K${r}*(1+N${r})`]];
  fact.getRange(`Q${r}`).formulas = [[`=ABS(O${r}*P${r})`]];
  fact.getRange(`R${r}`).formulas = [[`=Q${r}-L${r}`]];
  fact.getRange(`S${r}`).formulas = [[`=(O${r}-J${r})*K${r}`]];
  fact.getRange(`T${r}`).formulas = [[`=J${r}*(P${r}-K${r})`]];
  fact.getRange(`U${r}`).formulas = [[`=(O${r}-J${r})*(P${r}-K${r})`]];
  fact.getRange(`V${r}`).formulas = [[`=ROUND(R${r}-SUM(S${r}:U${r}),2)`]];
}
fact.getRange(`F${firstFact}:F${lastFact}`).format.numberFormat = "0.0%";
fact.getRange(`G${firstFact}:G${lastFact}`).format.numberFormat = "#,##0";
fact.getRange(`H${firstFact}:I${lastFact}`).format.numberFormat = "$#,##0.00;($#,##0.00);-";
fact.getRange(`J${firstFact}:J${lastFact}`).format.numberFormat = "#,##0.0";
fact.getRange(`K${firstFact}:L${lastFact}`).format.numberFormat = "$#,##0.00;($#,##0.00);-";
fact.getRange(`M${firstFact}:N${lastFact}`).format.numberFormat = "0.0%";
fact.getRange(`O${firstFact}:O${lastFact}`).format.numberFormat = "#,##0.0";
fact.getRange(`P${firstFact}:V${lastFact}`).format.numberFormat = "$#,##0.00;($#,##0.00);-";
fact.getRange(`F${firstFact}:V${lastFact}`).format.font = { name: font, size: 10, color: green };
fact.getRange(`A${lastFact + 2}:V${lastFact + 2}`).values = [["TOTAL",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]];
for (const col of ["J","L","O","Q","R","S","T","U","V"]) {
  fact.getRange(`${col}${lastFact + 2}`).formulas = [[`=SUM(${col}${firstFact}:${col}${lastFact})`]];
}
fact.getRange(`A${lastFact + 2}:V${lastFact + 2}`).format.font = { name: font, size: 10, bold: true, color: navy };
fact.getRange(`A${lastFact + 2}:V${lastFact + 2}`).format.borders = { top: { style: "double", color: navy } };
fact.getRange(`L${lastFact + 2}:V${lastFact + 2}`).format.numberFormat = "$#,##0.00;($#,##0.00);-";
fact.freezePanes.freezeRows(5);
fact.freezePanes.freezeColumns(4);
fact.getRange("A:A").format.columnWidth = 9;
fact.getRange("B:B").format.columnWidth = 12;
fact.getRange("C:C").format.columnWidth = 25;
fact.getRange("D:D").format.columnWidth = 15;
fact.getRange("E:I").format.columnWidth = 14;
fact.getRange("J:V").format.columnWidth = 17;
fact.tables.add(`A5:V${lastFact}`, true, "tblFactSimulacion").style = "TableStyleMedium2";

// Drivers
title(drivers, "Brecha explicada por drivers", "La brecha de monto se atribuye a volumen, ticket promedio e interacción.", "J");
section(drivers, "A5:H5", "Drivers por canal");
drivers.getRange("A6:H6").values = [["Canal","Monto actual USD","Monto simulado USD","Brecha USD","Driver volumen USD","Driver ticket USD","Interacción USD","Check"]];
header(drivers.getRange("A6:H6"));
drivers.getRange("A7:A10").values = channels.map(c => [c[0]]);
for (let r = 7; r <= 10; r++) {
  drivers.getRange(`B${r}`).formulas = [[`=SUMIFS(Fact_Simulacion!$L$${firstFact}:$L$${lastFact},Fact_Simulacion!$D$${firstFact}:$D$${lastFact},A${r})`]];
  drivers.getRange(`C${r}`).formulas = [[`=SUMIFS(Fact_Simulacion!$Q$${firstFact}:$Q$${lastFact},Fact_Simulacion!$D$${firstFact}:$D$${lastFact},A${r})`]];
  drivers.getRange(`D${r}`).formulas = [[`=C${r}-B${r}`]];
  drivers.getRange(`E${r}`).formulas = [[`=SUMIFS(Fact_Simulacion!$S$${firstFact}:$S$${lastFact},Fact_Simulacion!$D$${firstFact}:$D$${lastFact},A${r})`]];
  drivers.getRange(`F${r}`).formulas = [[`=SUMIFS(Fact_Simulacion!$T$${firstFact}:$T$${lastFact},Fact_Simulacion!$D$${firstFact}:$D$${lastFact},A${r})`]];
  drivers.getRange(`G${r}`).formulas = [[`=SUMIFS(Fact_Simulacion!$U$${firstFact}:$U$${lastFact},Fact_Simulacion!$D$${firstFact}:$D$${lastFact},A${r})`]];
  drivers.getRange(`H${r}`).formulas = [[`=ROUND(D${r}-SUM(E${r}:G${r}),2)`]];
}
drivers.getRange("A11").values = [["Total"]];
for (const col of ["B","C","D","E","F","G","H"]) drivers.getRange(`${col}11`).formulas = [[`=SUM(${col}7:${col}10)`]];
body(drivers.getRange("A7:H11"));
drivers.getRange("A11:H11").format.font = { name: font, size: 10, bold: true, color: navy };
drivers.getRange("A11:H11").format.borders = { top: { style: "double", color: navy } };
drivers.getRange("B7:H11").format.numberFormat = "$#,##0;($#,##0);-";

section(drivers, "A14:H14", "Drivers por tipo de transacción");
drivers.getRange("A15:H15").values = [["Tipo de transacción","Monto actual USD","Monto simulado USD","Brecha USD","Driver volumen USD","Driver ticket USD","Interacción USD","Check"]];
header(drivers.getRange("A15:H15"));
drivers.getRange(`A16:A${15 + types.length}`).values = types.map(t => [t]);
for (let r = 16; r <= 15 + types.length; r++) {
  drivers.getRange(`B${r}`).formulas = [[`=SUMIFS(Fact_Simulacion!$L$${firstFact}:$L$${lastFact},Fact_Simulacion!$C$${firstFact}:$C$${lastFact},A${r})`]];
  drivers.getRange(`C${r}`).formulas = [[`=SUMIFS(Fact_Simulacion!$Q$${firstFact}:$Q$${lastFact},Fact_Simulacion!$C$${firstFact}:$C$${lastFact},A${r})`]];
  drivers.getRange(`D${r}`).formulas = [[`=C${r}-B${r}`]];
  drivers.getRange(`E${r}`).formulas = [[`=SUMIFS(Fact_Simulacion!$S$${firstFact}:$S$${lastFact},Fact_Simulacion!$C$${firstFact}:$C$${lastFact},A${r})`]];
  drivers.getRange(`F${r}`).formulas = [[`=SUMIFS(Fact_Simulacion!$T$${firstFact}:$T$${lastFact},Fact_Simulacion!$C$${firstFact}:$C$${lastFact},A${r})`]];
  drivers.getRange(`G${r}`).formulas = [[`=SUMIFS(Fact_Simulacion!$U$${firstFact}:$U$${lastFact},Fact_Simulacion!$C$${firstFact}:$C$${lastFact},A${r})`]];
  drivers.getRange(`H${r}`).formulas = [[`=ROUND(D${r}-SUM(E${r}:G${r}),2)`]];
}
body(drivers.getRange(`A16:H${15 + types.length}`));
drivers.getRange(`B16:H${15 + types.length}`).format.numberFormat = "$#,##0;($#,##0);-";
drivers.getRange("A:A").format.columnWidth = 28;
drivers.getRange("B:H").format.columnWidth = 18;
drivers.freezePanes.freezeRows(6);
const driverChart = drivers.charts.add("bar", drivers.getRange("A6:C10"));
driverChart.title = "Monto actual y simulado por canal (USD)";
driverChart.titleTextStyle.typeface = font;
driverChart.titleTextStyle.fontSize = 12;
driverChart.legend = { position: "top", textStyle: { typeface: font } };
driverChart.xAxis = { axisType: "textAxis", textStyle: { typeface: font, fontSize: 10 } };
driverChart.yAxis = { numberFormatCode: "$0.0,,\"M\"", numberFormatSourceLinked: false, textStyle: { typeface: font, fontSize: 10 } };
driverChart.setPosition("J5", "Q18");

// Resumen
title(summary, "Simulador de brecha transaccional", "Escenario previo a Power BI: monto_usd absoluto y explicación de cambios por canal.", "N");
summary.getRange("A5:B5").values = [["Escenario seleccionado", null]];
summary.getRange("C5").formulas = [["=Supuestos!B6"]];
summary.getRange("A5:C5").format.font = { name: font, size: 11, bold: true, color: navy };
summary.getRange("C5").format.font = { name: font, size: 11, bold: true, color: green };
summary.getRange("A7:B7").values = [["Monto actual USD", null]];
summary.getRange("A8:B8").values = [["Monto simulado USD", null]];
summary.getRange("A9:B9").values = [["Brecha USD", null]];
summary.getRange("A10:B10").values = [["Brecha %", null]];
summary.getRange("C7").formulas = [[`=SUM(Fact_Simulacion!L${firstFact}:L${lastFact})`]];
summary.getRange("C8").formulas = [[`=SUM(Fact_Simulacion!Q${firstFact}:Q${lastFact})`]];
summary.getRange("C9").formulas = [["=C8-C7"]];
summary.getRange("C10").formulas = [["=IF(C7=0,\"n.a.\",C9/C7)"]];
summary.getRange("A7:C10").format.borders = { preset: "outside", style: "thin", color: "#A6A6A6" };
summary.getRange("A7:B10").format.fill = lightBlue;
summary.getRange("A7:A10").format.font = { name: font, size: 11, bold: true, color: navy };
summary.getRange("C7:C9").format.numberFormat = "$#,##0;($#,##0);-";
summary.getRange("C10").format.numberFormat = "0.0%";
summary.getRange("C7:C10").format.font = { name: font, size: 12, bold: true, color: dark };

summary.getRange("E7:F7").values = [["Monto digital actual", null]];
summary.getRange("E8:F8").values = [["Monto digital simulado", null]];
summary.getRange("E9:F9").values = [["Participación digital actual", null]];
summary.getRange("E10:F10").values = [["Participación digital simulada", null]];
summary.getRange("G7").formulas = [[`=SUMIFS(Fact_Simulacion!L${firstFact}:L${lastFact},Fact_Simulacion!E${firstFact}:E${lastFact},1)`]];
summary.getRange("G8").formulas = [[`=SUMIFS(Fact_Simulacion!Q${firstFact}:Q${lastFact},Fact_Simulacion!E${firstFact}:E${lastFact},1)`]];
summary.getRange("G9").formulas = [["=G7/C7"]];
summary.getRange("G10").formulas = [["=G8/C8"]];
summary.getRange("E7:G10").format.borders = { preset: "outside", style: "thin", color: "#A6A6A6" };
summary.getRange("E7:F10").format.fill = lightGreen;
summary.getRange("E7:E10").format.font = { name: font, size: 11, bold: true, color: navy };
summary.getRange("G7:G8").format.numberFormat = "$#,##0;($#,##0);-";
summary.getRange("G9:G10").format.numberFormat = "0.0%";
summary.getRange("G7:G10").format.font = { name: font, size: 12, bold: true, color: dark };

section(summary, "A13:D13", "Explicación de la brecha");
summary.getRange("A14:D14").values = [["Driver", "Valor USD", "% de brecha", "Definición"]];
header(summary.getRange("A14:D14"));
summary.getRange("A15:A17").values = [["Volumen"],["Ticket promedio"],["Interacción"]];
summary.getRange("D15:D17").values = [
  ["Cambio en transacciones manteniendo el ticket actual."],
  ["Cambio en ticket manteniendo el volumen actual."],
  ["Efecto simultáneo entre volumen y ticket."],
];
summary.getRange("B15").formulas = [[`=SUM(Fact_Simulacion!S${firstFact}:S${lastFact})`]];
summary.getRange("B16").formulas = [[`=SUM(Fact_Simulacion!T${firstFact}:T${lastFact})`]];
summary.getRange("B17").formulas = [[`=SUM(Fact_Simulacion!U${firstFact}:U${lastFact})`]];
summary.getRange("C15").formulas = [["=IF($C$9=0,\"n.a.\",B15/$C$9)"]];
summary.getRange("C16").formulas = [["=IF($C$9=0,\"n.a.\",B16/$C$9)"]];
summary.getRange("C17").formulas = [["=IF($C$9=0,\"n.a.\",B17/$C$9)"]];
body(summary.getRange("A15:D17"));
summary.getRange("B15:B17").format.numberFormat = "$#,##0;($#,##0);-";
summary.getRange("C15:C17").format.numberFormat = "0.0%";
summary.getRange("D15:D17").format.wrapText = true;
summary.getRange("A19").values = [["Reconciliación de drivers"]];
summary.getRange("B19").formulas = [["=ROUND(C9-SUM(B15:B17),2)"]];
summary.getRange("B19").format.numberFormat = "$#,##0.00;($#,##0.00);-";
summary.getRange("A19:B19").format.font = { name: font, size: 10, bold: true, color: navy };

summary.getRange("I7:L7").values = [["Canal", "Actual", "Simulado", "Brecha"]];
header(summary.getRange("I7:L7"));
summary.getRange("I8:I11").values = channels.map(c => [c[0]]);
for (let r = 8; r <= 11; r++) {
  summary.getRange(`J${r}`).formulas = [[`=SUMIFS(Fact_Simulacion!$L$${firstFact}:$L$${lastFact},Fact_Simulacion!$D$${firstFact}:$D$${lastFact},I${r})`]];
  summary.getRange(`K${r}`).formulas = [[`=SUMIFS(Fact_Simulacion!$Q$${firstFact}:$Q$${lastFact},Fact_Simulacion!$D$${firstFact}:$D$${lastFact},I${r})`]];
  summary.getRange(`L${r}`).formulas = [[`=K${r}-J${r}`]];
}
body(summary.getRange("I8:L11"));
summary.getRange("J8:L11").format.numberFormat = "$#,##0;($#,##0);-";
const summaryChart = summary.charts.add("bar", summary.getRange("I7:K11"));
summaryChart.title = "Monto actual y simulado por canal (USD)";
summaryChart.titleTextStyle.typeface = font;
summaryChart.titleTextStyle.fontSize = 12;
summaryChart.legend = { position: "top", textStyle: { typeface: font } };
summaryChart.xAxis = { axisType: "textAxis", textStyle: { typeface: font, fontSize: 10 } };
summaryChart.yAxis = { numberFormatCode: "$0.0,,\"M\"", numberFormatSourceLinked: false, textStyle: { typeface: font, fontSize: 10 } };
summaryChart.setPosition("I13", "N28");

summary.getRange("A22:G26").values = [
  ["Cómo usar el simulador", null, null, null, null, null, null],
  ["1. Ajuste el mix, crecimiento y ticket por canal en Supuestos."],
  ["2. Ajuste el ticket base por tipo de transacción."],
  ["3. Revise la brecha y su reconciliación en Resumen y Drivers."],
  ["4. Importe Fact_Simulacion y dimensiones a Power BI; sustituya supuestos por datos reales."],
];
summary.getRange("A22:G22").format.fill = gray;
summary.getRange("A22:G22").format.font = { name: font, size: 10, bold: true, color: navy };
summary.getRange("A23:G26").format.font = { name: font, size: 10, color: dark };
summary.getRange("A23:G26").format.wrapText = true;
summary.getRange("A:A").format.columnWidth = 28;
summary.getRange("B:B").format.columnWidth = 18;
summary.getRange("C:C").format.columnWidth = 18;
summary.getRange("D:D").format.columnWidth = 44;
summary.getRange("E:E").format.columnWidth = 30;
summary.getRange("F:F").format.columnWidth = 3;
summary.getRange("G:G").format.columnWidth = 18;
summary.getRange("H:H").format.columnWidth = 3;
summary.getRange("I:I").format.columnWidth = 17;
summary.getRange("J:L").format.columnWidth = 16;

// DAX
title(dax, "Propuesta de integración en Power BI", "Medidas basadas en Fact_Simulacion. Los drivers reconcilian exactamente con la brecha total.", "H");
section(dax, "A5:H5", "Modelo recomendado");
dax.getRange("A6:H10").values = [
  ["Tabla", "Rol", "Relación", null, null, null, null, null],
  ["Fact_Simulacion", "Hechos: volumen, monto y drivers", "Muchos a uno con dimensiones"],
  ["Dim_Fecha", "Año / mes / fecha", "1 → * por clave de fecha"],
  ["Dim_Canal", "Canal y bandera digital", "1 → * por canal"],
  ["Dim_Transaccion", "Tipo de transacción", "1 → * por tipo"],
];
header(dax.getRange("A6:C6"));
body(dax.getRange("A7:C10"));
section(dax, "A13:H13", "Medidas DAX");
const daxRows = [
  ["Monto Actual USD", "Monto Actual USD =\nSUM ( Fact_Simulacion[Monto actual USD] )"],
  ["Monto Simulado USD", "Monto Simulado USD =\nSUM ( Fact_Simulacion[Monto simulado USD] )"],
  ["Brecha Monto USD", "Brecha Monto USD =\n[Monto Simulado USD] - [Monto Actual USD]"],
  ["Brecha Monto %", "Brecha Monto % =\nDIVIDE ( [Brecha Monto USD], [Monto Actual USD] )"],
  ["Driver Volumen USD", "Driver Volumen USD =\nSUM ( Fact_Simulacion[Driver volumen USD] )"],
  ["Driver Ticket USD", "Driver Ticket USD =\nSUM ( Fact_Simulacion[Driver ticket USD] )"],
  ["Driver Interacción USD", "Driver Interacción USD =\nSUM ( Fact_Simulacion[Interacción USD] )"],
  ["Check Drivers", "Check Drivers =\n[Brecha Monto USD] - [Driver Volumen USD] - [Driver Ticket USD] - [Driver Interacción USD]"],
  ["Brecha Digital USD", "Brecha Digital USD =\nCALCULATE ( [Brecha Monto USD], KEEPFILTERS ( Dim_Canal[Es digital] = 1 ) )"],
  ["Aporte Canal %", "Aporte Canal % =\nDIVIDE ( [Brecha Monto USD], CALCULATE ( [Brecha Monto USD], REMOVEFILTERS ( Dim_Canal ) ) )"],
  ["Ranking Canal", "Ranking Canal =\nRANKX ( ALLSELECTED ( Dim_Canal[Canal] ), [Brecha Monto USD], , DESC, DENSE )"],
];
dax.getRange(`A14:B${13 + daxRows.length}`).values = daxRows;
dax.getRange("A14:A24").format.font = { name: font, size: 10, bold: true, color: navy };
dax.getRange("B14:B24").format.font = { name: "Courier New", size: 9, color: dark };
dax.getRange("B14:B24").format.wrapText = true;
dax.getRange("A14:B24").format.borders = { insideHorizontal: { style: "thin", color: "#D9E2F3" } };
dax.getRange("A26").values = [["Nota: en producción, conserve monto_usd como columna numérica positiva y use una columna separada para el signo económico si fuera necesario."]];
dax.getRange("A26:H26").format.font = { name: font, size: 10, italic: true, color: "#666666" };
dax.getRange("A:A").format.columnWidth = 26;
dax.getRange("B:B").format.columnWidth = 80;
dax.getRange("C:H").format.columnWidth = 14;
dax.getRange("14:24").format.rowHeight = 42;

// Conditional checks and general alignment
assumptions.getRange("B17").conditionalFormats.add("cellIs", { operator: "notEqual", formula: 1, format: { fill: lightRed, font: { bold: true, color: red } } });
summary.getRange("B19").conditionalFormats.add("cellIs", { operator: "notEqual", formula: 0, format: { fill: lightRed, font: { bold: true, color: red } } });
drivers.getRange("H7:H32").conditionalFormats.add("cellIs", { operator: "notEqual", formula: 0, format: { fill: lightRed, font: { bold: true, color: red } } });
fact.getRange(`V${firstFact}:V${lastFact}`).conditionalFormats.add("cellIs", { operator: "notEqual", formula: 0, format: { fill: lightRed, font: { bold: true, color: red } } });

wb.recalculate();

const inspectSummary = await wb.inspect({ kind: "table", range: "Resumen!A1:L26", include: "values,formulas", tableMaxRows: 30, tableMaxCols: 12, maxChars: 12000 });
console.log(inspectSummary.ndjson);
const inspectChecks = await wb.inspect({ kind: "table", range: "Drivers!A5:H11", include: "values,formulas", tableMaxRows: 10, tableMaxCols: 8, maxChars: 8000 });
console.log(inspectChecks.ndjson);
const errors = await wb.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 300 }, summary: "final formula error scan", maxChars: 10000 });
console.log(errors.ndjson);

for (const [sheetName, range, file] of [
  ["Resumen", "A1:N28", "resumen.png"],
  ["Drivers", "A1:Q33", "drivers.png"],
  ["Supuestos", "A1:H38", "supuestos.png"],
  ["Modelo_DAX", "A1:H26", "modelo_dax.png"],
]) {
  const img = await wb.render({ sheetName, range, scale: 1.2, format: "png" });
  await fs.writeFile(`${previewDir}/${file}`, new Uint8Array(await img.arrayBuffer()));
}

const out = await SpreadsheetFile.exportXlsx(wb);
await out.save(outputPath);
console.log(JSON.stringify({ outputPath, previewDir, rows: factRows.length, sourceRows: clean.length }));
