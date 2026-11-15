// Nombre del archivo de datos que se carga desde la carpeta public/data.
export const ARCHIVO_DATOS = 'focos_mensuales_PRUEBA_ENSAYO1.csv';

// Descarga el CSV y convierte cada fila en un objeto con valores numéricos.
export async function cargarDatos() {
  const respuesta = await fetch(`/data/${ARCHIVO_DATOS}`);
  if (!respuesta.ok) {
    throw new Error(`No se encontró el archivo ${ARCHIVO_DATOS}. Comprueba que esté en public/data.`);
  }

  // Quita el BOM inicial antes de leer el nombre de la primera columna.
  const texto = (await respuesta.text()).replace(/^\uFEFF/, '').trim();
  const [encabezado, ...filas] = texto.split(/\r?\n/);
  // Detecta coma o punto y coma en el encabezado y limpia espacios sobrantes.
  const separador = encabezado.includes(';') ? ';' : ',';
  const columnas = encabezado.split(separador).map((columna) => columna.trim());
  const obligatorias = ['anio', 'mes', 'zona', 'focos_armonizados'];
  const faltantes = obligatorias.filter((columna) => !columnas.includes(columna));
  if (faltantes.length > 0) {
    throw new Error('El CSV debe tener las columnas anio, mes, zona y focos_armonizados.');
  }

  let filasIgnoradas = 0;
  let ejemploFilaIgnorada = null;
  const datos = filas.filter(Boolean).flatMap((fila) => {
    const valores = fila.split(separador).map((valor) => valor.trim());
    const objeto = Object.fromEntries(columnas.map((columna, indice) => [
      columna,
      ['anio', 'mes', 'focos_armonizados'].includes(columna)
        ? Number((valores[indice] ?? '').replace(',', '.'))
        : (valores[indice] ?? ''),
    ]));
    const valorFocos = valores[columnas.indexOf('focos_armonizados')];
    if (valorFocos === '' || !Number.isFinite(objeto.focos_armonizados)) {
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

// Calcula la mediana del mismo mes en otros años, sumando primero todas las zonas.
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
