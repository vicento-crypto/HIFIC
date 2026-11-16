// Reads raw CSV files, runs harmonization, and saves the results.
const fs = require('node:fs/promises');
const path = require('node:path');
const { runInNewContext } = require('node:vm');

const carpetaPipeline = __dirname;
const carpetaRaiz = path.resolve(carpetaPipeline, '..');
const columnas = [
  'anio', 'mes', 'zona', 'focos_armonizados', 'focos_modis',
  'focos_viirs', 'confianza', 'fuente', 'rango80_bajo', 'rango80_alto',
];

function mesEnFormato(anio, mes) {
  return `${anio}-${String(mes).padStart(2, '0')}`;
}

function escaparCelda(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  const texto = String(valor);
  return /[",\r\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

async function leerEntradas() {
  const rutaModis = path.join(carpetaPipeline, 'entrada', 'MODIS.csv');
  const modisTexto = await fs.readFile(rutaModis, 'utf8');
  let viirsTexto = null;
  try {
    viirsTexto = await fs.readFile(path.join(carpetaPipeline, 'entrada', 'VIIRS.csv'), 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    console.warn('Aviso: no se encontró pipeline/entrada/VIIRS.csv; se procesará solo MODIS.');
  }
  return { modisTexto, viirsTexto };
}

async function cargarArmonizador() {
  // Try the expected .cjs name, then the available file's name.
  const rutas = [
    path.join(carpetaPipeline, 'armonizadorFuegos.cjs'),
    path.join(carpetaPipeline, 'armonizadorFuegos.cjs.js'),
  ];
  let texto;
  let rutaEncontrada;
  for (const ruta of rutas) {
    try {
      texto = await fs.readFile(ruta, 'utf8');
      rutaEncontrada = ruta;
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (!texto) throw new Error('No se encontró pipeline/armonizadorFuegos.cjs.');

  // Run the UMD in a CommonJS context without changing the library file.
  const moduloArmonizador = { exports: {} };
  runInNewContext(texto, { module: moduloArmonizador, exports: moduloArmonizador.exports }, { filename: rutaEncontrada });
  const armonizador = moduloArmonizador.exports;
  if (typeof armonizador.transformar !== 'function') {
    throw new Error('El armonizador no exporta la función transformar.');
  }
  return armonizador.transformar;
}

async function generar() {
  const { modisTexto, viirsTexto } = await leerEntradas();
  const transformar = await cargarArmonizador();
  const resultado = transformar({ modisTexto, viirsTexto, zona: 'RD' });
  const filas = resultado.filas;

  const csv = [
    columnas.join(','),
    ...filas.map((fila) => columnas.map((columna) => escaparCelda(fila[columna])).join(',')),
  ].join('\r\n');
  const carpetaPublica = path.join(carpetaRaiz, 'public', 'data');
  await fs.mkdir(carpetaPublica, { recursive: true });
  await fs.writeFile(path.join(carpetaPublica, 'focos_mensuales.csv'), csv, 'utf8');

  const filasOrdenadas = [...filas].sort((a, b) => a.anio - b.anio || a.mes - b.mes);
  const porConfianza = { alta: 0, media: 0, baja: 0 };
  for (const fila of filas) porConfianza[fila.confianza] = (porConfianza[fila.confianza] ?? 0) + 1;

  const mesesSospechosos = filas.flatMap((fila) => {
    const motivos = [];
    if (fila.focos_viirs === 0 && fila.focos_modis > 0) motivos.push('focos_viirs=0 y focos_modis>0');
    if (fila.focos_armonizados === 0) motivos.push('focos_armonizados=0');
    return motivos.length > 0
      ? [{ anio: fila.anio, mes: fila.mes, zona: fila.zona, motivos }]
      : [];
  });

  const reporte = {
    reporte_filas_por_filtro: resultado.reporte,
    cantidad_filas: filas.length,
    primer_mes: filasOrdenadas.length > 0
      ? mesEnFormato(filasOrdenadas[0].anio, filasOrdenadas[0].mes)
      : null,
    ultimo_mes: filasOrdenadas.length > 0
      ? mesEnFormato(filasOrdenadas.at(-1).anio, filasOrdenadas.at(-1).mes)
      : null,
    meses_por_confianza: porConfianza,
    meses_sospechosos: mesesSospechosos,
  };
  await fs.writeFile(path.join(carpetaPipeline, 'reporte.json'), `${JSON.stringify(reporte, null, 2)}\n`, 'utf8');
  console.log(`Generado public/data/focos_mensuales.csv (${filas.length} filas) y pipeline/reporte.json.`);
}

generar().catch((error) => {
  console.error(`No se pudieron generar los datos: ${error.message}`);
  process.exitCode = 1;
});
