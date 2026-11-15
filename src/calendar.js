// Dibuja el total mensual de focos en un calendario de colores.
import * as echarts from 'echarts';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function dibujarCalendario(datos, alSeleccionar = () => {}) {
  // Los años salen del archivo; el agrupamiento suma todas las zonas por mes.
  const anios = [...new Set(datos.map((fila) => fila.anio))].sort((a, b) => a - b);
  const totales = new Map();

  // Suma las filas de todas las zonas que pertenecen al mismo año y mes.
  for (const fila of datos) {
    const clave = `${fila.anio}-${fila.mes}`;
    totales.set(clave, (totales.get(clave) ?? 0) + fila.focos_armonizados);
  }

  // Conserva todas las combinaciones: distingue un cero de un mes sin filas.
  const valores = anios.flatMap((anio, indiceAnio) =>
    MESES.map((mes, indiceMes) => {
      const clave = `${anio}-${indiceMes + 1}`;
      const sinDato = !totales.has(clave);
      return {
        // ECharts necesita un número válido; el estilo gris distingue el mes sin dato.
        value: [indiceMes, indiceAnio, totales.get(clave) ?? 0],
        sinDato,
        ...(sinDato ? { itemStyle: { color: '#c8cdd2' } } : {}),
      };
    }),
  );
  const maximo = Math.max(...valores.filter((valor) => !valor.sinDato).map((valor) => valor.value[2]), 1);

  const elemento = document.getElementById('calendario');
  const grafico = echarts.getInstanceByDom(elemento) ?? echarts.init(elemento);
  grafico.setOption({
    tooltip: {
      position: 'top',
      formatter: ({ data }) => data.sinDato
        ? `${MESES[data.value[0]]} ${anios[data.value[1]]}: sin dato`
        : `${MESES[data.value[0]]} ${anios[data.value[1]]}: ${data.value[2]} focos`,
    },
    grid: { top: 35, right: 25, bottom: 55, left: 55 },
    xAxis: { type: 'category', data: MESES, splitArea: { show: true } },
    yAxis: { type: 'category', data: anios, splitArea: { show: true } },
    visualMap: {
      min: 0,
      max: maximo,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      // Violeta oscuro a amarillo, como la paleta viridis.
      inRange: { color: ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#35b779', '#6ece58', '#fde725'] },
    },
    series: [{
      type: 'heatmap',
      data: valores,
      label: {
        show: true,
        // Usa texto claro en valores bajos y oscuro en los valores altos y amarillos.
        formatter: ({ data }) => {
          if (data.sinDato) return '{sinDato|sin dato}';
          return data.value[2] >= maximo * 0.55
            ? `{oscuro|${data.value[2]}}`
            : `{claro|${data.value[2]}}`;
        },
        rich: {
          claro: { color: '#fff' },
          oscuro: { color: '#202124' },
          sinDato: { color: '#30343b', fontSize: 9 },
        },
        fontSize: 10,
      },
      emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0, 0, 0, 0.35)' } },
    }],
  }, true);

  // Ajusta el gráfico si cambia el tamaño de la ventana.
  // Al pulsar una casilla, envía sus datos al panel de comparación.
  grafico.off('click');
  grafico.on('click', ({ data }) => {
    alSeleccionar(data.value[0] + 1, anios[data.value[1]], data.value[2], data.sinDato);
  });

  window.addEventListener('resize', () => grafico.resize());
}
