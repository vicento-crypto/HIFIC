// Downloads the selected range's actual rows as a UTF-8 CSV file.
export function descargarCSV(datos, desdeAnio, hastaAnio, esPrueba = false) {
  const filas = datos.filter((fila) => fila.anio >= desdeAnio && fila.anio <= hastaAnio);
  const columnas = ['anio', 'mes', 'zona', 'focos_armonizados'];
  const escapar = (valor) => {
    const texto = String(valor);
    return /[",\r\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
  };
  const contenido = [
    columnas.join(','),
    ...filas.map((fila) => columnas.map((columna) => escapar(fila[columna])).join(',')),
  ].join('\r\n');
  // The BOM helps spreadsheet apps recognize UTF-8 text.
  const archivo = new Blob(['\uFEFF', contenido], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement('a');
  const zonas = [...new Set(filas.map((fila) => fila.zona))].sort().join('_') || 'zonas';
  const etiquetaPrueba = esPrueba ? 'PRUEBA_' : '';
  enlace.href = url;
  enlace.download = `focos_${zonas}_${etiquetaPrueba}${desdeAnio}-${hastaAnio}.csv`;
  enlace.click();
  URL.revokeObjectURL(url);
}
