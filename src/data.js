// Nombre del archivo de datos que se carga desde la carpeta public/data.
export const ARCHIVO_DATOS = 'focos_mensuales_PRUEBA.csv';

// Descarga el CSV y convierte cada fila en un objeto con valores numéricos.
export async function cargarDatos() {
  const respuesta = await fetch(`/data/${ARCHIVO_DATOS}`);
  if (!respuesta.ok) {
    throw new Error(`No se encontró el archivo ${ARCHIVO_DATOS}. Comprueba que esté en public/data.`);
  }

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

  return filas.filter(Boolean).map((fila) => {
    const valores = fila.split(separador).map((valor) => valor.trim());
    return Object.fromEntries(columnas.map((columna, indice) => [
      columna,
      ['anio', 'mes', 'focos_armonizados'].includes(columna)
        ? Number(valores[indice])
        : valores[indice],
    ]));
  });
}
