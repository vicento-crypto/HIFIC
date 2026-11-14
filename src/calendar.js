// Dibuja el total mensual de focos en un calendario de colores.
import * as echarts from 'echarts';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function dibujarCalendario(datos) {
  const anios = [...new Set(datos.map((fila) => fila.anio))].sort((a, b) => a - b);
  const totales = new Map();

  // Suma todas las celdas que pertenecen al mismo año y mes.
  for (const fila of datos) {
    const clave = `${fila.anio}-${fila.mes}`;
    totales.set(clave, (totales.get(clave) ?? 0) + fila.focos_armonizados);
  }

  // Incluye cada combinación año/mes, también cuando su total es cero.
  const valores = anios.flatMap((anio, indiceAnio) =>
    MESES.map((mes, indiceMes) => [indiceMes, indiceAnio, totales.get(`${anio}-${indiceMes + 1}`) ?? 0]),
  );

  const grafico = echarts.init(document.getElementById('calendario'));
  grafico.setOption({
    tooltip: {
      position: 'top',
      formatter: ({ data }) => `${MESES[data[0]]} ${anios[data[1]]}: ${data[2]} focos`,
    },
    grid: { top: 35, right: 25, bottom: 55, left: 55 },
    xAxis: { type: 'category', data: MESES, splitArea: { show: true } },
    yAxis: { type: 'category', data: anios, splitArea: { show: true } },
    visualMap: {
      min: 0,
      max: Math.max(...valores.map((valor) => valor[2]), 1),
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
        formatter: ({ data }) => data[2] >= Math.max(...valores.map((valor) => valor[2])) * 0.55
          ? `{oscuro|${data[2]}}`
          : `{claro|${data[2]}}`,
        rich: {
          claro: { color: '#fff' },
          oscuro: { color: '#202124' },
        },
        fontSize: 10,
      },
      emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0, 0, 0, 0.35)' } },
    }],
  });

  // Ajusta el gráfico si cambia el tamaño de la ventana.
  window.addEventListener('resize', () => grafico.resize());
}
