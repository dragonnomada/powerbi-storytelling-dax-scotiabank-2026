import fs from "node:fs/promises";
import { Workbook, SpreadsheetFile } from "@oai/artifact-tool";

const root = "/Users/dragonnomada/Desktop/GitHub/powerbi-storytelling-dax-scotiabank-2026/IA";
const outDir = `${root}/outputs`;
const previewDir = `${outDir}/preview_real_2024_2025`;
const outputPath = `${outDir}/analisis_real_transacciones_2024_2025.xlsx`;
await fs.mkdir(outDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

const parseCsv = (text) => {
  const lines = text.trim().split(/\r?\n/);
  const h = lines[0].split(",");
  return lines.slice(1).map(line => {
    const v = line.split(",");
    return Object.fromEntries(h.map((k, i) => [k, v[i]]));
  });
};
const factsAll = parseCsv(await fs.readFile(`${root}/fact_transaccion.csv`, "utf8"));
const channelsRaw = parseCsv(await fs.readFile(`${root}/dim_canal.csv`, "utf8"));
const channelMap = new Map(channelsRaw.map(x => [x.canal_id, {
  canal_id: x.canal_id, canal: x.canal, grupo: x.grupo_canal,
  digital: Number(x.digital), costo: Number(x.costo_unitario_usd),
}]));
const facts = factsAll.filter(x => [2024, 2025].includes(Number(x.fecha_operacion_id.slice(0, 4))));

const agg = (keyFn) => {
  const m = new Map();
  for (const x of facts) {
    const ch = channelMap.get(x.canal_id);
    const year = Number(x.fecha_operacion_id.slice(0, 4));
    const month = Number(x.fecha_operacion_id.slice(4, 6));
    const amount = Math.abs(Number(x.monto_usd));
    const key = keyFn({x, ch, year, month});
    if (!m.has(key)) m.set(key, {tx: 0, amount: 0, commission: 0});
    const a = m.get(key); a.tx++; a.amount += amount; a.commission += Math.abs(Number(x.comision_usd));
  }
  return m;
};
const channelAgg = agg(({ch, year}) => `${ch.canal_id}|${year}`);
const typeAgg = agg(({x, year}) => `${x.tipo_transaccion}|${year}`);
const monthAgg = agg(({year, month}) => `${year}|${month}`);
const monthDigitalAgg = agg(({ch, year, month}) => `${year}|${month}|${ch.digital}`);
const statusAgg = agg(({x, year}) => `${year}|${x.estado}`);
const factAgg = agg(({x, ch, year, month}) => [year, month, ch.canal_id, ch.canal, ch.grupo, ch.digital, x.tipo_transaccion, x.estado].join("|"));

const sumYear = (year, field) => [...channelAgg.entries()].filter(([k]) => k.endsWith(`|${year}`)).reduce((s,[,v]) => s + v[field], 0);
const total2024 = {tx: sumYear(2024,"tx"), amount: sumYear(2024,"amount")};
const total2025 = {tx: sumYear(2025,"tx"), amount: sumYear(2025,"amount")};
const dupTx = facts.length - new Set(facts.map(x => x.transaccion_id)).size;
const unmatched = facts.filter(x => !channelMap.has(x.canal_id)).length;

const navy = "#17365D", blue = "#2F75B5", lightBlue = "#D9EAF7", green = "#00843D";
const lightGreen = "#E2F0D9", amber = "#FFF2CC", gray = "#E7E6E6", red = "#C00000", lightRed = "#FCE4D6";
const font = "Arial";
const wb = Workbook.create();
const summary = wb.worksheets.add("Resumen");
const dc = wb.worksheets.add("Drivers_Canal");
const dt = wb.worksheets.add("Drivers_Tipo");
const trend = wb.worksheets.add("Tendencia_Mensual");
const fa = wb.worksheets.add("Fact_Agregada");
const quality = wb.worksheets.add("Calidad_Datos");
const dim = wb.worksheets.add("Dim_Canal");
const dax = wb.worksheets.add("Modelo_DAX");
for (const sh of [summary,dc,dt,trend,fa,quality,dim,dax]) sh.showGridLines = false;
summary.tabColor = navy; dc.tabColor = blue; dt.tabColor = blue; trend.tabColor = "#5B9BD5"; fa.tabColor = "#A5A5A5"; quality.tabColor = "#FFC000"; dax.tabColor = "#70AD47";

function title(sh, t, sub, end="J") {
  sh.getRange("A2").values=[[t]]; sh.getRange("A2").format.font={name:font,size:16,bold:true,color:navy};
  sh.getRange(`A2:${end}2`).format.borders={bottom:{style:"thin",color:blue}};
  sh.getRange("A3").values=[[sub]]; sh.getRange(`A3:${end}3`).format.font={name:font,size:10,italic:true,color:"#666666"};
}
function section(sh, range, text) {
  sh.getRange(range.split(":")[0]).values=[[text]]; const r=sh.getRange(range); r.format.fill=lightBlue; r.format.font={name:font,size:10,bold:true,color:navy}; r.format.borders={preset:"outside",style:"thin",color:"#9EADBA"};
}
function header(r) { r.format.fill=navy; r.format.font={name:font,size:10,bold:true,color:"#FFFFFF"}; r.format.horizontalAlignment="center"; r.format.verticalAlignment="center"; r.format.wrapText=true; }
function body(r) { r.format.font={name:font,size:10,color:"#222222"}; r.format.verticalAlignment="center"; }

// Channel driver analysis
title(dc,"Brecha explicada por canal","Comparación real 2025 contra 2024 con monto_usd en valor absoluto.","N");
const driverHeaders=["Canal","Digital","Tx 2024","Tx 2025","Cambio Tx","Monto 2024 USD","Monto 2025 USD","Brecha USD","Ticket 2024 USD","Ticket 2025 USD","Driver volumen USD","Driver ticket USD","Interacción USD","Check"];
dc.getRange("A5:N5").values=[driverHeaders]; header(dc.getRange("A5:N5"));
channelsRaw.forEach((raw,i)=>{
  const r=6+i, ch=channelMap.get(raw.canal_id), a=channelAgg.get(`${raw.canal_id}|2024`)||{tx:0,amount:0}, b=channelAgg.get(`${raw.canal_id}|2025`)||{tx:0,amount:0};
  dc.getRange(`A${r}:D${r}`).values=[[ch.canal,ch.digital,a.tx,b.tx]];
  dc.getRange(`E${r}`).formulas=[[`=D${r}-C${r}`]]; dc.getRange(`F${r}:G${r}`).values=[[a.amount,b.amount]];
  dc.getRange(`H${r}`).formulas=[[`=G${r}-F${r}`]]; dc.getRange(`I${r}`).formulas=[[`=IF(C${r}=0,0,F${r}/C${r})`]]; dc.getRange(`J${r}`).formulas=[[`=IF(D${r}=0,0,G${r}/D${r})`]];
  dc.getRange(`K${r}`).formulas=[[`=(D${r}-C${r})*I${r}`]]; dc.getRange(`L${r}`).formulas=[[`=C${r}*(J${r}-I${r})`]]; dc.getRange(`M${r}`).formulas=[[`=(D${r}-C${r})*(J${r}-I${r})`]]; dc.getRange(`N${r}`).formulas=[[`=ROUND(H${r}-SUM(K${r}:M${r}),2)`]];
});
const dcTotal=12; dc.getRange(`A${dcTotal}`).values=[["Total"]];
for(const col of ["C","D","E","F","G","H","K","L","M","N"]) dc.getRange(`${col}${dcTotal}`).formulas=[[`=SUM(${col}6:${col}11)`]];
dc.getRange(`I${dcTotal}`).formulas=[[`=F${dcTotal}/C${dcTotal}`]]; dc.getRange(`J${dcTotal}`).formulas=[[`=G${dcTotal}/D${dcTotal}`]];
body(dc.getRange("A6:N12")); dc.getRange("A12:N12").format.font={name:font,size:10,bold:true,color:navy}; dc.getRange("A12:N12").format.borders={top:{style:"double",color:navy}};
dc.getRange("C6:E12").format.numberFormat="#,##0"; dc.getRange("F6:N12").format.numberFormat="$#,##0;($#,##0);-";
dc.getRange("A:A").format.columnWidth=24; dc.getRange("B:B").format.columnWidth=10; dc.getRange("C:E").format.columnWidth=13; dc.getRange("F:N").format.columnWidth=18; dc.freezePanes.freezeRows(5);
dc.getRange("N6:N12").conditionalFormats.add("cellIs",{operator:"notEqual",formula:0,format:{fill:lightRed,font:{bold:true,color:red}}});
const cchart=dc.charts.add("bar",[dc.getRange("A5:A11"),dc.getRange("F5:F11"),dc.getRange("G5:G11")]); cchart.title="Monto por canal: 2024 y 2025 (USD)"; cchart.titleTextStyle.typeface=font; cchart.legend={position:"top",textStyle:{typeface:font}}; cchart.yAxis={numberFormatCode:"$0.0,,\"M\"",numberFormatSourceLinked:false,textStyle:{typeface:font}}; cchart.setPosition("A15","H31");
const gchart=dc.charts.add("bar",[dc.getRange("A5:A11"),dc.getRange("H5:H11")]); gchart.title="Brecha por canal (USD)"; gchart.titleTextStyle.typeface=font; gchart.hasLegend=false; gchart.yAxis={numberFormatCode:"$0.0,,\"M\"",numberFormatSourceLinked:false,textStyle:{typeface:font}}; gchart.setPosition("I15","N31");

// Type driver analysis
title(dt,"Brecha explicada por tipo de transacción","Descomposición de la variación 2025 contra 2024.","N");
dt.getRange("A5:N5").values=[driverHeaders.map(x=>x==="Canal"?"Tipo de transacción":x)]; header(dt.getRange("A5:N5"));
const types=[...new Set(facts.map(x=>x.tipo_transaccion))].sort();
types.forEach((t,i)=>{
  const r=6+i,a=typeAgg.get(`${t}|2024`)||{tx:0,amount:0},b=typeAgg.get(`${t}|2025`)||{tx:0,amount:0};
  dt.getRange(`A${r}:D${r}`).values=[[t,null,a.tx,b.tx]]; dt.getRange(`E${r}`).formulas=[[`=D${r}-C${r}`]]; dt.getRange(`F${r}:G${r}`).values=[[a.amount,b.amount]]; dt.getRange(`H${r}`).formulas=[[`=G${r}-F${r}`]]; dt.getRange(`I${r}`).formulas=[[`=F${r}/C${r}`]]; dt.getRange(`J${r}`).formulas=[[`=G${r}/D${r}`]]; dt.getRange(`K${r}`).formulas=[[`=(D${r}-C${r})*I${r}`]]; dt.getRange(`L${r}`).formulas=[[`=C${r}*(J${r}-I${r})`]]; dt.getRange(`M${r}`).formulas=[[`=(D${r}-C${r})*(J${r}-I${r})`]]; dt.getRange(`N${r}`).formulas=[[`=ROUND(H${r}-SUM(K${r}:M${r}),2)`]];
});
const dtLast=5+types.length; body(dt.getRange(`A6:N${dtLast}`)); dt.getRange(`C6:E${dtLast}`).format.numberFormat="#,##0"; dt.getRange(`F6:N${dtLast}`).format.numberFormat="$#,##0;($#,##0);-"; dt.getRange("A:A").format.columnWidth=27; dt.getRange("B:B").format.columnWidth=8; dt.getRange("C:E").format.columnWidth=13; dt.getRange("F:N").format.columnWidth=18; dt.freezePanes.freezeRows(5); dt.getRange(`N6:N${dtLast}`).conditionalFormats.add("cellIs",{operator:"notEqual",formula:0,format:{fill:lightRed,font:{bold:true,color:red}}});

// Monthly trend
title(trend,"Tendencia mensual","Volumen transaccional real por fecha de operación.","K");
trend.getRange("A5:I5").values=[["Mes","Tx 2024","Tx 2025","Cambio Tx","Monto 2024 USD","Monto 2025 USD","Brecha USD","Monto digital 2024 USD","Monto digital 2025 USD"]]; header(trend.getRange("A5:I5"));
const monthNames=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
for(let m=1;m<=12;m++){
  const r=5+m,a=monthAgg.get(`2024|${m}`)||{tx:0,amount:0},b=monthAgg.get(`2025|${m}`)||{tx:0,amount:0},ad=monthDigitalAgg.get(`2024|${m}|1`)||{amount:0},bd=monthDigitalAgg.get(`2025|${m}|1`)||{amount:0};
  trend.getRange(`A${r}:C${r}`).values=[[monthNames[m-1],a.tx,b.tx]]; trend.getRange(`D${r}`).formulas=[[`=C${r}-B${r}`]]; trend.getRange(`E${r}:F${r}`).values=[[a.amount,b.amount]]; trend.getRange(`G${r}`).formulas=[[`=F${r}-E${r}`]]; trend.getRange(`H${r}:I${r}`).values=[[ad.amount,bd.amount]];
}
body(trend.getRange("A6:I17")); trend.getRange("B6:D17").format.numberFormat="#,##0"; trend.getRange("E6:I17").format.numberFormat="$#,##0;($#,##0);-"; trend.getRange("A:A").format.columnWidth=12; trend.getRange("B:D").format.columnWidth=14; trend.getRange("E:I").format.columnWidth=20;
const tchart=trend.charts.add("line",[trend.getRange("A5:A17"),trend.getRange("E5:E17"),trend.getRange("F5:F17")]); tchart.title="Monto mensual 2024 vs 2025 (USD)"; tchart.titleTextStyle.typeface=font; tchart.legend={position:"top",textStyle:{typeface:font}}; tchart.yAxis={numberFormatCode:"$0.0,,\"M\"",numberFormatSourceLinked:false,textStyle:{typeface:font}}; tchart.setPosition("K5","R20");

// Aggregated fact for reuse in Power BI
title(fa,"Hechos agregados 2024–2025","Granularidad: año, mes, canal, tipo de transacción y estado.","M");
const faHeaders=["Año","Mes","Fecha mes","canal_id","Canal","Grupo canal","Digital","Tipo transacción","Estado","Transacciones","Monto absoluto USD","Ticket promedio USD","Comisión absoluta USD"];
fa.getRange("A5:M5").values=[faHeaders]; header(fa.getRange("A5:M5"));
const faRows=[...factAgg.entries()].map(([k,v])=>{const [y,m,id,canal,grupo,digital,tipo,estado]=k.split("|"); return [Number(y),Number(m),new Date(Number(y),Number(m)-1,1),id,canal,grupo,Number(digital),tipo,estado,v.tx,v.amount,v.amount/v.tx,v.commission];}).sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[3].localeCompare(b[3])||a[7].localeCompare(b[7]));
const faLast=5+faRows.length; fa.getRange(`A6:M${faLast}`).values=faRows; body(fa.getRange(`A6:M${faLast}`)); fa.getRange(`C6:C${faLast}`).format.numberFormat="mmm-yy"; fa.getRange(`J6:J${faLast}`).format.numberFormat="#,##0"; fa.getRange(`K6:M${faLast}`).format.numberFormat="$#,##0.00;($#,##0.00);-"; fa.getRange("A:B").format.columnWidth=10; fa.getRange("C:C").format.columnWidth=13; fa.getRange("D:D").format.columnWidth=12; fa.getRange("E:I").format.columnWidth=22; fa.getRange("J:M").format.columnWidth=20; fa.freezePanes.freezeRows(5); fa.freezePanes.freezeColumns(4); fa.tables.add(`A5:M${faLast}`,true,"tblFactAgregada").style="TableStyleMedium2";

// Data quality and channel dimension
title(quality,"Calidad y alcance de datos","Controles aplicados antes del análisis.","H");
quality.getRange("A5:D5").values=[["Control","Resultado","Estado","Interpretación"]]; header(quality.getRange("A5:D5"));
quality.getRange("A6:D12").values=[
  ["Registros 2024",total2024.tx,total2024.tx===34058?"OK":"REVISAR","Todas las transacciones intentadas por fecha de operación."],
  ["Registros 2025",total2025.tx,total2025.tx===61573?"OK":"REVISAR","Coincide con el total del análisis previo."],
  ["Duplicados transaccion_id",dupTx,dupTx===0?"OK":"REVISAR","La llave de transacción debe ser única."],
  ["Canales sin correspondencia",unmatched,unmatched===0?"OK":"REVISAR","Todos los canal_id deben existir en Dim_Canal."],
  ["Monto nulo",facts.filter(x=>x.monto_usd==="").length,facts.every(x=>x.monto_usd!=="")?"OK":"REVISAR","monto_usd es requerido."],
  ["Años incluidos","2024 y 2025","OK","Se excluye 2023."],
  ["Definición de monto","ABS(monto_usd)","OK","Incluye entradas y salidas como volumen positivo."],
]; body(quality.getRange("A6:D12")); quality.getRange("B6:B10").format.numberFormat="#,##0";
section(quality,"A15:D15","Distribución por estado"); quality.getRange("A16:C16").values=[["Estado","Transacciones 2024","Transacciones 2025"]]; header(quality.getRange("A16:C16"));
const statuses=[...new Set(facts.map(x=>x.estado))].sort(); statuses.forEach((s,i)=>quality.getRange(`A${17+i}:C${17+i}`).values=[[s,(statusAgg.get(`2024|${s}`)||{tx:0}).tx,(statusAgg.get(`2025|${s}`)||{tx:0}).tx]]); body(quality.getRange(`A17:C${16+statuses.length}`)); quality.getRange(`B17:C${16+statuses.length}`).format.numberFormat="#,##0"; quality.getRange("A:A").format.columnWidth=30; quality.getRange("B:C").format.columnWidth=20; quality.getRange("D:D").format.columnWidth=55;
quality.getRange("C6:C12").conditionalFormats.add("containsText",{text:"REVISAR",format:{fill:lightRed,font:{bold:true,color:red}}});

title(dim,"Dimensión de canales","Clasificación y costo unitario provenientes de dim_canal.csv.","F"); dim.getRange("A5:E5").values=[["canal_id","Canal","Grupo canal","Digital","Costo unitario USD"]]; header(dim.getRange("A5:E5")); dim.getRange("A6:E11").values=channelsRaw.map(x=>[x.canal_id,x.canal,x.grupo_canal,Number(x.digital),Number(x.costo_unitario_usd)]); body(dim.getRange("A6:E11")); dim.getRange("E6:E11").format.numberFormat="$0.00"; dim.getRange("A:A").format.columnWidth=12; dim.getRange("B:C").format.columnWidth=24; dim.getRange("D:D").format.columnWidth=12; dim.getRange("E:E").format.columnWidth=20; dim.tables.add("A5:E11",true,"tblDimCanal").style="TableStyleMedium2";

// Summary
title(summary,"Análisis real de brecha transaccional","Comparación 2025 contra 2024 con monto_usd en valor absoluto.","N");
summary.getRange("A5:C5").values=[["Indicador","2024","2025"]]; header(summary.getRange("A5:C5")); summary.getRange("A6:A9").values=[["Transacciones"],["Monto absoluto USD"],["Ticket promedio USD"],["Monto digital USD"]];
summary.getRange("B6:C6").values=[[total2024.tx,total2025.tx]]; summary.getRange("B7:C7").values=[[total2024.amount,total2025.amount]]; summary.getRange("B8").formulas=[["=B7/B6"]]; summary.getRange("C8").formulas=[["=C7/C6"]];
const dig24=channelsRaw.filter(x=>Number(x.digital)===1).reduce((s,x)=>s+(channelAgg.get(`${x.canal_id}|2024`)||{amount:0}).amount,0), dig25=channelsRaw.filter(x=>Number(x.digital)===1).reduce((s,x)=>s+(channelAgg.get(`${x.canal_id}|2025`)||{amount:0}).amount,0);
summary.getRange("B9:C9").values=[[dig24,dig25]]; body(summary.getRange("A6:C9")); summary.getRange("B6:C6").format.numberFormat="#,##0"; summary.getRange("B7:C9").format.numberFormat="$#,##0;($#,##0);-";
summary.getRange("E5:F5").values=[["Brecha 2025 vs 2024","Resultado"]]; header(summary.getRange("E5:F5")); summary.getRange("E6:E10").values=[["Cambio transacciones"],["Cambio monto USD"],["Cambio monto %"],["Participación digital 2024"],["Participación digital 2025"]]; summary.getRange("F6").formulas=[["=C6-B6"]]; summary.getRange("F7").formulas=[["=C7-B7"]]; summary.getRange("F8").formulas=[["=F7/B7"]]; summary.getRange("F9").formulas=[["=B9/B7"]]; summary.getRange("F10").formulas=[["=C9/C7"]]; body(summary.getRange("E6:F10")); summary.getRange("F6").format.numberFormat="#,##0"; summary.getRange("F7").format.numberFormat="$#,##0;($#,##0);-"; summary.getRange("F8:F10").format.numberFormat="0.0%";
section(summary,"A13:D13","Drivers de la brecha total"); summary.getRange("A14:C14").values=[["Driver","USD","% de brecha"]]; header(summary.getRange("A14:C14")); summary.getRange("A15:A17").values=[["Volumen"],["Ticket promedio"],["Interacción"]]; summary.getRange("B15").formulas=[["=Drivers_Canal!K12"]]; summary.getRange("B16").formulas=[["=Drivers_Canal!L12"]]; summary.getRange("B17").formulas=[["=Drivers_Canal!M12"]]; summary.getRange("C15").formulas=[["=B15/$F$7"]]; summary.getRange("C16").formulas=[["=B16/$F$7"]]; summary.getRange("C17").formulas=[["=B17/$F$7"]]; body(summary.getRange("A15:C17")); summary.getRange("B15:B17").format.numberFormat="$#,##0;($#,##0);-"; summary.getRange("C15:C17").format.numberFormat="0.0%"; summary.getRange("A19").values=[["Reconciliación"]]; summary.getRange("B19").formulas=[["=ROUND($F$7-SUM(B15:B17),2)"]]; summary.getRange("B19").format.numberFormat="$#,##0.00;($#,##0.00);-";
summary.getRange("A22:G26").format.fill=gray; summary.getRange("A22").values=[["Lectura ejecutiva"]]; summary.getRange("A23").values=[["El crecimiento del monto absoluto proviene principalmente del aumento de transacciones."]]; summary.getRange("A24").values=[["Los cuatro canales digitales concentran la mayor parte del incremento interanual."]]; summary.getRange("A25").values=[["Centro de contacto y Sucursal aumentan volumen, pero reducen su ticket promedio."]]; summary.getRange("A26").values=[["El universo incluye operaciones contabilizadas, rechazadas y reversadas para conservar la definición de transacciones intentadas."]]; summary.getRange("A22:G22").format.font={name:font,size:10,bold:true,color:navy}; summary.getRange("A23:G26").format.font={name:font,size:10,color:"#222222"};
summary.getRange("A:A").format.columnWidth=31; summary.getRange("B:C").format.columnWidth=19; summary.getRange("D:D").format.columnWidth=4; summary.getRange("E:E").format.columnWidth=31; summary.getRange("F:F").format.columnWidth=19;
const schart=summary.charts.add("bar",[dc.getRange("A5:A11"),dc.getRange("H5:H11")]); schart.title="Brecha 2025 vs 2024 por canal (USD)"; schart.titleTextStyle.typeface=font; schart.hasLegend=false; schart.yAxis={numberFormatCode:"$0.0,,\"M\"",numberFormatSourceLinked:false,textStyle:{typeface:font}}; schart.setPosition("H5","N20"); summary.getRange("B19").conditionalFormats.add("cellIs",{operator:"notEqual",formula:0,format:{fill:lightRed,font:{bold:true,color:red}}});

// DAX proposal
title(dax,"Modelo y medidas DAX","Medidas para reproducir el análisis sobre fact_transaccion.csv y dim_canal.csv.","H"); section(dax,"A5:H5","Modelo estrella"); dax.getRange("A6:C10").values=[["Tabla","Rol","Relación"],["Fact_Transaccion","Hechos a nivel transacción","* → 1 con dimensiones"],["Dim_Canal","Canal, grupo y digital","canal_id"],["Dim_Fecha","Calendario continuo","fecha_operacion_id"],["Dim_Transaccion","Tipo de transacción","tipo_transaccion"]]; header(dax.getRange("A6:C6")); body(dax.getRange("A7:C10")); section(dax,"A13:H13","Medidas DAX");
const daxRows=[
 ["Transacciones","Transacciones =\nCOUNTROWS ( Fact_Transaccion )"],
 ["Monto absoluto USD","Monto absoluto USD =\nSUMX ( Fact_Transaccion, ABS ( Fact_Transaccion[monto_usd] ) )"],
 ["Ticket promedio USD","Ticket promedio USD =\nDIVIDE ( [Monto absoluto USD], [Transacciones] )"],
 ["Monto LY USD","Monto LY USD =\nCALCULATE ( [Monto absoluto USD], DATEADD ( Dim_Fecha[Fecha], -1, YEAR ) )"],
 ["Transacciones LY","Transacciones LY =\nCALCULATE ( [Transacciones], DATEADD ( Dim_Fecha[Fecha], -1, YEAR ) )"],
 ["Ticket LY USD","Ticket LY USD =\nDIVIDE ( [Monto LY USD], [Transacciones LY] )"],
 ["Brecha monto USD","Brecha monto USD =\n[Monto absoluto USD] - [Monto LY USD]"],
 ["Driver volumen USD","Driver volumen USD =\n( [Transacciones] - [Transacciones LY] ) * [Ticket LY USD]"],
 ["Driver ticket USD","Driver ticket USD =\n[Transacciones LY] * ( [Ticket promedio USD] - [Ticket LY USD] )"],
 ["Driver interacción USD","Driver interacción USD =\n( [Transacciones] - [Transacciones LY] ) * ( [Ticket promedio USD] - [Ticket LY USD] )"],
 ["Check drivers","Check drivers =\n[Brecha monto USD] - [Driver volumen USD] - [Driver ticket USD] - [Driver interacción USD]"],
 ["Brecha digital USD","Brecha digital USD =\nCALCULATE ( [Brecha monto USD], KEEPFILTERS ( Dim_Canal[digital] = 1 ) )"],
];
dax.getRange(`A14:B${13+daxRows.length}`).values=daxRows; dax.getRange(`A14:A${13+daxRows.length}`).format.font={name:font,size:10,bold:true,color:navy}; dax.getRange(`B14:B${13+daxRows.length}`).format.font={name:"Courier New",size:9,color:"#222222"}; dax.getRange(`B14:B${13+daxRows.length}`).format.wrapText=true; dax.getRange(`14:${13+daxRows.length}`).format.rowHeight=42; dax.getRange("A:A").format.columnWidth=28; dax.getRange("B:B").format.columnWidth=85; dax.getRange("C:H").format.columnWidth=14;

wb.recalculate();
console.log((await wb.inspect({kind:"table",range:"Resumen!A1:F26",include:"values,formulas",tableMaxRows:30,tableMaxCols:8,maxChars:12000})).ndjson);
console.log((await wb.inspect({kind:"table",range:"Drivers_Canal!A5:N12",include:"values,formulas",tableMaxRows:10,tableMaxCols:14,maxChars:12000})).ndjson);
console.log((await wb.inspect({kind:"match",searchTerm:"#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",options:{useRegex:true,maxResults:300},summary:"final formula error scan",maxChars:8000})).ndjson);
for(const [sheetName,range,file] of [["Resumen","A1:N26","resumen.png"],["Drivers_Canal","A1:N31","drivers_canal.png"],["Tendencia_Mensual","A1:R20","tendencia.png"],["Calidad_Datos","A1:H22","calidad.png"],["Modelo_DAX","A1:H26","dax.png"]]){const img=await wb.render({sheetName,range,scale:1.2,format:"png"});await fs.writeFile(`${previewDir}/${file}`,new Uint8Array(await img.arrayBuffer()));}
const out=await SpreadsheetFile.exportXlsx(wb); await out.save(outputPath); console.log(JSON.stringify({outputPath,previewDir,factRows:facts.length,aggregateRows:faRows.length}));
