// Nombre del archivo de datos que se carga desde la carpeta public/data.
export const ARCHIVO_DATOS = 'focos_mensuales_PRUEBA.csv';

// Descarga el CSV y convierte cada fila en un objeto con valores numéricos.
export async function cargarDatos() {
  const respuesta = await fetch(`/data/${ARCHIVO_DATOS}`);
  if (!respuesta.ok) {
    throw new Error(`No se pudo cargar el archivo ${ARCHIVO_DATOS}`);
  }

  const texto = await respuesta.text();
  const [encabezado, ...filas] = texto.trim().split(/\r?\n/);
  const columnas = encabezado.split(',');

  return filas.filter(Boolean).map((fila) => {
    const valores = fila.split(',');
    return Object.fromEntries(columnas.map((columna, indice) => [
      columna,
      ['anio', 'mes', 'celda_id', 'lat_centro', 'lon_centro', 'focos_armonizados'].includes(columna)
        ? Number(valores[indice])
        : valores[indice],
    ]));
  });
}
