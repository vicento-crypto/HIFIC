// Name of the data file loaded from public/data.
import { TEXT, idiomaInicial } from './i18n.js';
export const ARCHIVO_DATOS = 'focos_mensuales.csv';

// Fetches the CSV and converts each row into an object with numeric values.
export async function cargarDatos() {
  const respuesta = await fetch(`/data/${ARCHIVO_DATOS}`);
  if (!respuesta.ok) {
    throw new Error(TEXT[idiomaInicial()].missingCsv.replace('{file}', ARCHIVO_DATOS));
  }

  // Remove the leading BOM before reading the first column name.
  const texto = (await respuesta.text()).replace(/^\uFEFF/, '').trim();
  const [encabezado, ...filas] = texto.split(/\r?\n/);
  // Detect commas or semicolons in the header and trim extra spaces.
  const separador = encabezado.includes(';') ? ';' : ',';
  const columnas = encabezado.split(separador).map((columna) => columna.trim());
  const obligatorias = ['anio', 'mes', 'zona', 'focos_armonizados'];
  const faltantes = obligatorias.filter((columna) => !columnas.includes(columna));
  if (faltantes.length > 0) {
    throw new Error(TEXT[idiomaInicial()].csvColumns);
  }

  let filasIgnoradas = 0;
  let ejemploFilaIgnorada = null;
  const datos = filas.filter(Boolean).flatMap((fila) => {
    const valores = fila.split(separador).map((valor) => valor.trim());
    const indiceAnio = columnas.indexOf('anio');
    const indiceMes = columnas.indexOf('mes');
    const anioTexto = valores[indiceAnio] ?? '';
    const mesTexto = valores[indiceMes] ?? '';
    const columnasNumericas = ['anio', 'mes', 'focos_armonizados', 'focos_modis', 'focos_viirs', 'rango80_bajo', 'rango80_alto'];
    const objeto = Object.fromEntries(columnas.map((columna, indice) => [
      columna,
      columnasNumericas.includes(columna)
        ? (valores[indice] ?? '') === '' && !['anio', 'mes', 'focos_armonizados'].includes(columna)
          ? null
          : Number((valores[indice] ?? '').replace(',', '.'))
        : (valores[indice] ?? ''),
    ]));
    const valorFocos = valores[columnas.indexOf('focos_armonizados')];
    const anioValido = /^\d{4}$/.test(anioTexto) && Number.isInteger(objeto.anio);
    const mesValido = /^\d+$/.test(mesTexto) && Number.isInteger(objeto.mes) && objeto.mes >= 1 && objeto.mes <= 12;
    if (!anioValido || !mesValido || valorFocos === '' || !Number.isFinite(objeto.focos_armonizados)) {
      filasIgnoradas += 1;
      ejemploFilaIgnorada ??= { anio: objeto.anio, mes: objeto.mes };
      return [];
    }
    return [objeto];
  });
  datos.filasIgnoradas = filasIgnoradas;
  datos.ejemploFilaIgnorada = ejemploFilaIgnorada;
  return datos;
}

// Calculates the same month's median across other years, summing all zones first.
export function calcularMedianaMismoMes(datos, mesElegido, anioElegido) {
  const totalesPorAnio = new Map();
  for (const fila of datos) {
    if (fila.mes !== mesElegido || fila.anio === anioElegido) continue;
    totalesPorAnio.set(fila.anio, (totalesPorAnio.get(fila.anio) ?? 0) + fila.focos_armonizados);
  }

  const valores = [...totalesPorAnio.values()].sort((a, b) => a - b);
  if (valores.length === 0) return { mediana: null, cantidad: 0 };

  const centro = Math.floor(valores.length / 2);
  const mediana = valores.length % 2 === 1
    ? valores[centro]
    : (valores[centro - 1] + valores[centro]) / 2;
  return { mediana, cantidad: valores.length };
}
