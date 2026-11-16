export const TEXT = {
  es: {
    title: 'HIFIC – Calendario Histórico de Incendios', introSubtitle: 'Calendario Histórico de Incendios', intro: 'Haz clic para entrar', welcome: 'Bienvenida a HIFIC',
    mapAria: 'Mapa de República Dominicana', mapQuestion: '¿Es este mes normal para esta zona?', mapHelp: 'Haz clic en República Dominicana para ver el calendario', mapTooltip: 'Haz clic para ver el calendario de RD',
    mapError: 'No se pudo mostrar el mapa', outlineError: 'No se pudo cargar el contorno de RD', missingOutline: 'No se encontró public/data/rd_contorno.geojson.',
    testData: 'DATOS DE PRUEBA', source: 'Datos: NASA FIRMS (MODIS + VIIRS)', outlineCredit: 'Contorno: geoBoundaries (geoboundaries.org), CC BY 4.0. Mapa base: © OpenStreetMap',
    viewAria: 'Vista del calendario', count: 'Conteo', anomaly: 'Anomalía', fromYear: 'Desde año', toYear: 'Hasta año', download: 'Descargar CSV', minimize: 'Minimizar', openCalendar: 'Abrir calendario', calendar: 'Calendario',
    calendarAria: 'Calendario de focos de calor de República Dominicana por mes y año; haz clic en una casilla para compararla con la mediana',
    legendP90: 'Borde grueso = más alto que el 90% de los demás años de ese mes', confidenceLegend: 'Borde punteado = estimado a partir de MODIS; sin borde = medido por VIIRS',
    howCalculated: '¿Cómo se calcula?', howText: 'Se compara cada mes con la mediana del mismo mes en los demás años (sin contar el año elegido ni los meses sin dato). Borde punteado = estimado a partir de MODIS convertido a la escala de VIIRS',
    value: 'Valor', foci: 'focos', noData: 'sin dato', noDataMonth: 'Sin dato para este mes: el CSV no trae esa fila.', percentileUnavailable: 'No hay otros años con dato para comparar.',
    percentile: 'Más alto que el {value}% de los demás años', otherMedian: 'Mediana de otros años', fewData: 'pocos datos para comparar',
    diffMedian: '{arrow} {value} focos de diferencia con la mediana', aboveMedian: '{arrow} {value}% por encima de la mediana', belowMedian: '{arrow} {value}% por debajo de la mediana', equalMedian: '＝ igual a la mediana',
    noMedianData: 'sin datos', invalidRows: 'Se ignoraron {count} filas con año, mes o focos_armonizados no válidos. Ejemplo: año {year}, mes {month}.',
    noValidCsv: 'No hay datos válidos en el CSV', noYears: 'No hay años en ese rango', calendarError: 'No se pudo mostrar el calendario',
    missingCsv: 'No se encontró el archivo {file}. Comprueba que esté en public/data.', csvColumns: 'El CSV debe tener las columnas anio, mes, zona y focos_armonizados.',
    monthNames: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'], approx: '≈', range: 'rango probable',
    tooltipMedian: 'mediana', noComparable: 'n/c', anomalyLegendMin: '−100%', anomalyLegendMid: '0', anomalyLegendMax: '+100% o más',
  },
  en: {
    title: 'HIFIC – Historical Fire Calendar', introSubtitle: 'Historical Fire Calendar', intro: 'Click to enter', welcome: 'Welcome to HIFIC', mapAria: 'Map of the Dominican Republic', mapQuestion: 'Is this month normal for this area?', mapHelp: 'Click the Dominican Republic to view the calendar', mapTooltip: 'Click to view the DR calendar',
    mapError: 'Could not display the map', outlineError: 'Could not load the DR outline', missingOutline: 'Could not find public/data/rd_contorno.geojson.',
    testData: 'SAMPLE DATA', source: 'Data: NASA FIRMS (MODIS + VIIRS)', outlineCredit: 'Outline: geoBoundaries (geoboundaries.org), CC BY 4.0. Basemap: © OpenStreetMap',
    viewAria: 'Calendar view', count: 'Count', anomaly: 'Anomaly', fromYear: 'From year', toYear: 'To year', download: 'Download CSV', minimize: 'Minimize', openCalendar: 'Open calendar', calendar: 'Calendar',
    calendarAria: 'Dominican Republic fire detections by month and year; click a cell to compare it with the median',
    legendP90: 'Thick border = higher than 90% of other years for that month', confidenceLegend: 'Dotted border = estimated from MODIS; no border = measured by VIIRS',
    howCalculated: 'How is this calculated?', howText: 'Each month is compared with the same month’s median in other years (excluding the selected year and months with no data). Dotted border = estimated from MODIS, converted to the VIIRS scale',
    value: 'Value', foci: 'detections', // REVISAR: “detections” describe los focos de calor en inglés.
    noData: 'no data', noDataMonth: 'No data for this month: the CSV has no row for it.', percentileUnavailable: 'No other years with data to compare.',
    percentile: 'Higher than {value}% of other years', otherMedian: 'Median of other years', fewData: 'too few data points to compare',
    diffMedian: '{arrow} {value} detections from the median', aboveMedian: '{arrow} {value}% above the median', belowMedian: '{arrow} {value}% below the median', equalMedian: '＝ equal to the median',
    noMedianData: 'no data', invalidRows: 'Ignored {count} rows with invalid year, month, or focos_armonizados. Example: year {year}, month {month}.',
    noValidCsv: 'No valid data in the CSV', noYears: 'No years in this range', calendarError: 'Could not display the calendar',
    missingCsv: 'Could not find {file}. Make sure it is in public/data.', csvColumns: 'The CSV must include the columns anio, mes, zona, and focos_armonizados.',
    monthNames: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], approx: '≈', range: 'likely range',
    tooltipMedian: 'median', noComparable: 'n/a', anomalyLegendMin: '−100%', anomalyLegendMid: '0', anomalyLegendMax: '+100% or more',
  },
};

export function idiomaInicial() {
  const parametro = new URLSearchParams(window.location.search).get('lang');
  if (parametro === 'es' || parametro === 'en') return parametro;
  try {
    const guardado = localStorage.getItem('hific-lang');
    if (guardado === 'es' || guardado === 'en') return guardado;
  } catch (_error) {
    // El almacenamiento puede estar deshabilitado.
  }
  return 'en';
}

export function guardarIdioma(idioma) {
  try {
    localStorage.setItem('hific-lang', idioma);
  } catch (_error) {
    // El almacenamiento puede estar deshabilitado.
  }
}
