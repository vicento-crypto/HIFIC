// Dibuja el total mensual de focos en un calendario de colores.
import * as echarts from 'echarts';
import { calcularMedianaMismoMes } from './data.js';
import { TEXT } from './i18n.js';

let observadorZona;

export function redimensionarCalendario() {
  const elemento = document.getElementById('calendario');
  echarts.getInstanceByDom(elemento)?.resize();
}

export function dibujarCalendario(datos, alSeleccionar = () => {}, modoVista = 'conteo', datosReferencia = datos, idioma = 'es') {
  const texto = TEXT[idioma];
  const MESES = texto.monthNames;
  // Los años salen del archivo; el agrupamiento suma todas las zonas por mes.
  const anios = [...new Set(datos.map((fila) => fila.anio))].sort((a, b) => a - b);
  const totales = new Map();

  // Suma valores y conserva aparte la confianza y el rango para mostrar el estilo adecuado.
  for (const fila of datos) {
    const clave = `${fila.anio}-${fila.mes}`;
    const total = totales.get(clave) ?? {
      valor: 0,
      estimado: false,
      rangoBajo: 0,
      rangoAlto: 0,
      rangoCompleto: true,
    };
    total.valor += fila.focos_armonizados;
    if (fila.confianza === 'baja' || fila.confianza === 'media') {
      total.estimado = true;
      if (Number.isFinite(fila.rango80_bajo) && Number.isFinite(fila.rango80_alto)) {
        total.rangoBajo += fila.rango80_bajo;
        total.rangoAlto += fila.rango80_alto;
      } else {
        total.rangoCompleto = false;
      }
    } else if (fila.confianza === 'alta') {
      // Un valor medido contribuye al rango agregado como un valor exacto.
      total.rangoBajo += fila.focos_armonizados;
      total.rangoAlto += fila.focos_armonizados;
    }
    totales.set(clave, total);
  }

  // Agrupa también el archivo completo para calcular el p90 entre los otros años.
  const totalesReferencia = new Map();
  for (const fila of datosReferencia) {
    const clave = `${fila.anio}-${fila.mes}`;
    totalesReferencia.set(clave, (totalesReferencia.get(clave) ?? 0) + fila.focos_armonizados);
  }

  // Conserva todas las combinaciones: distingue un cero de un mes sin filas.
  const valores = anios.flatMap((anio, indiceAnio) =>
    MESES.map((mes, indiceMes) => {
      const clave = `${anio}-${indiceMes + 1}`;
      const total = totales.get(clave);
      const sinDato = !total;
      const comparacion = !sinDato && modoVista === 'anomalia'
        ? calcularMedianaMismoMes(datosReferencia, indiceMes + 1, anio)
        : null;
      const noComparable = comparacion !== null
        && (comparacion.cantidad < 5 || comparacion.mediana === 0 || comparacion.mediana === null);
      const otrosValores = modoVista === 'anomalia' && !sinDato
        ? [...totalesReferencia.entries()]
          .filter(([otraClave]) => otraClave.endsWith(`-${indiceMes + 1}`) && !otraClave.startsWith(`${anio}-`))
          .map(([, otroTotal]) => otroTotal)
        : [];
      const percentil90 = otrosValores.length > 0 ? calcularPercentil(otrosValores, 0.9) : null;
      const superaPercentil90 = !noComparable
        && percentil90 !== null
        && total.valor > percentil90;
      const porcentaje = noComparable || comparacion === null
        ? null
        : ((total.valor - comparacion.mediana) / comparacion.mediana) * 100;
      const valorGrafico = modoVista === 'anomalia'
        ? (noComparable || sinDato ? 0 : Math.max(-100, Math.min(100, porcentaje)))
        : (total?.valor ?? 0);
      const estiloCelda = {};
      if (sinDato || (modoVista === 'anomalia' && noComparable)) estiloCelda.color = '#c8cdd2';
      if (total?.estimado) {
        estiloCelda.borderColor = '#34343b';
        estiloCelda.borderType = 'dotted';
        estiloCelda.borderWidth = 1.5;
      }
      return {
        // ECharts necesita un número válido; el estilo gris distingue el mes sin dato.
        value: [indiceMes, indiceAnio, valorGrafico],
        sinDato,
        valorFocos: total?.valor ?? null,
        mediana: comparacion?.mediana ?? null,
        cantidadComparaciones: comparacion?.cantidad ?? 0,
        noComparable,
        porcentaje,
        superaPercentil90,
        estimado: total?.estimado ?? false,
        rangoBajo: total?.rangoBajo ?? null,
        rangoAlto: total?.rangoAlto ?? null,
        rangoCompleto: total?.rangoCompleto ?? false,
        ...(Object.keys(estiloCelda).length > 0 ? { itemStyle: estiloCelda } : {}),
      };
    }),
  );
  const valoresValidos = valores
    .filter((valor) => !valor.sinDato)
    .map((valor) => valor.value[2])
    .sort((a, b) => a - b);
  const posicionP95 = (valoresValidos.length - 1) * 0.95;
  const p95 = valoresValidos.length === 0
    ? 0
    : valoresValidos[Math.floor(posicionP95)]
      + (valoresValidos[Math.ceil(posicionP95)] - valoresValidos[Math.floor(posicionP95)])
        * (posicionP95 - Math.floor(posicionP95));
  const maximo = p95 > 0 ? p95 : 1;
  const textoP95 = new Intl.NumberFormat(idioma === 'es' ? 'es-DO' : 'en-US', { maximumFractionDigits: 1 }).format(p95);
  const celdasSobreP90 = modoVista === 'anomalia'
    ? valores.filter((valor) => valor.superaPercentil90).map((valor) => [valor.value[0], valor.value[1]])
    : [];

  const elemento = document.getElementById('calendario');
  const grafico = echarts.getInstanceByDom(elemento) ?? echarts.init(elemento);
  const zona = elemento.parentElement;
  if (!observadorZona && zona) {
    observadorZona = new ResizeObserver(() => grafico.resize());
    observadorZona.observe(zona);
  }
  grafico.setOption({
    animation: modoVista !== 'anomalia',
    textStyle: { fontFamily: "'Space Grotesk', sans-serif" },
    tooltip: {
      position: 'top',
      confine: true,
      textStyle: { fontFamily: "'JetBrains Mono', monospace" },
      formatter: ({ data }) => {
        const mesAnio = `${MESES[data.value[0]]} ${anios[data.value[1]]}`;
        if (data.sinDato) return `${mesAnio}: ${texto.noData}`;
        if (modoVista === 'anomalia') {
          const mediana = formatoNumero(data.mediana);
          if (data.noComparable) return `${mesAnio}: ${formatoNumero(data.valorFocos, idioma)} ${texto.foci}, ${texto.tooltipMedian} ${mediana}, ${texto.noComparable}`;
          const diferencia = formatoNumero(Math.abs(data.porcentaje));
          const porcentaje = data.porcentaje > 0 ? `+${diferencia}` : data.porcentaje < 0 ? `-${diferencia}` : '0';
          return `${mesAnio}: ${formatoNumero(data.valorFocos, idioma)} ${texto.foci}, ${texto.tooltipMedian} ${mediana}, ${porcentaje}%`;
        }
        return data.estimado
          ? `${mesAnio}: ${texto.approx} ${formatoNumero(data.valorFocos, idioma)} ${texto.foci}${data.rangoCompleto ? ` (${texto.range} ${formatoNumero(data.rangoBajo, idioma)}–${formatoNumero(data.rangoAlto, idioma)})` : ''}`
          : `${mesAnio}: ${formatoNumero(data.valorFocos, idioma)} ${texto.foci}`;
      },
    },
    // Reserva espacio arriba para la leyenda y los nombres de los meses.
    grid: { top: 36, right: 25, bottom: 56, left: 65 },
    xAxis: {
      type: 'category',
      data: MESES,
      position: 'top',
      splitArea: { show: true },
      axisLabel: { interval: 0, margin: 14 },
    },
    yAxis: {
      type: 'category',
      data: anios,
      splitArea: { show: true },
      axisLabel: { interval: 0, margin: 12, fontFamily: "'JetBrains Mono', monospace" },
    },
    visualMap: modoVista === 'anomalia'
      ? {
        show: false,
        min: -100,
        max: 100,
        calculable: false,
        inRange: { color: ['#2166AC', '#F7F7F7', '#B35806'] },
      }
      : {
      min: 0,
      max: maximo,
      text: [idioma === 'es' ? '≥ 1.650' : '≥ 1,650', '0'],
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 12,
      padding: [2, 10],
      textGap: 8,
      textStyle: { fontFamily: "'JetBrains Mono', monospace" },
      // Violeta oscuro a amarillo, como la paleta viridis.
      inRange: { color: ['#440154', '#482878', '#3e4989', '#31688e', '#26828e', '#35b779', '#6ece58', '#fde725'] },
      },
    series: [{
      type: 'heatmap',
      data: valores,
      label: {
        show: true,
        // Redondea solo la etiqueta y reduce el tamaño según la cantidad de dígitos.
        formatter: ({ data }) => {
          if (data.sinDato) return `{sinDato|${texto.noData}}`;
          if (modoVista === 'anomalia') {
            if (data.noComparable) return `{neutro|${texto.noComparable}}`;
            const porcentaje = Math.round(data.porcentaje);
            const etiqueta = porcentaje > 0 ? `+${porcentaje}%` : `${porcentaje}%`;
            return porcentaje < -50 ? `{claroNormal|${etiqueta}}` : `{oscuroNormal|${etiqueta}}`;
          }
          const entero = String(Math.round(data.value[2]));
          const tono = data.value[2] >= maximo * 0.55 ? 'oscuro' : 'claro';
          const tamano = entero.length > 6 ? 'Mini' : entero.length > 4 ? 'Pequeno' : 'Normal';
          return `{${tono}${tamano}|${entero}}`;
        },
        fontFamily: "'JetBrains Mono', monospace",
        rich: {
          claroNormal: { color: '#fff', fontSize: 11 },
          neutro: { color: '#30343b', fontSize: 11 },
          oscuroNormal: { color: '#202124', fontSize: 11 },
          claroPequeno: { color: '#fff', fontSize: 11 },
          oscuroPequeno: { color: '#202124', fontSize: 11 },
          claroMini: { color: '#fff', fontSize: 11 },
          oscuroMini: { color: '#202124', fontSize: 11 },
          sinDato: { color: '#30343b', fontSize: 9 },
        },
      },
      labelLayout: { hideOverlap: true },
      emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0, 0, 0, 0.35)' } },
    }, ...(celdasSobreP90.length > 0 ? [{
      // Dibuja un contorno continuo exterior para el p90 sin tapar el borde estimado.
      type: 'custom',
      coordinateSystem: 'cartesian2d',
      encode: { x: 0, y: 1 },
      data: celdasSobreP90,
      silent: true,
      z: 10,
      renderItem: (parametros, api) => {
        const centro = api.coord([api.value(0), api.value(1)]);
        const tamano = api.size([1, 1]);
        const margen = 2;
        const forma = echarts.graphic.clipRectByRect({
          x: centro[0] - tamano[0] / 2 - margen,
          y: centro[1] - tamano[1] / 2 - margen,
          width: tamano[0] + margen * 2,
          height: tamano[1] + margen * 2,
        }, parametros.coordSys);
        return forma && {
          type: 'rect',
          shape: forma,
          style: { fill: 'none', stroke: '#26262B', lineWidth: 3 },
          silent: true,
        };
      },
    }] : [])],
  }, true);

  // Al pulsar una casilla, envía sus datos al panel de comparación.
  grafico.off('click');
  grafico.on('click', ({ data }) => {
    alSeleccionar(data.value[0] + 1, anios[data.value[1]], data.valorFocos ?? 0, data.sinDato);
  });

}

function calcularPercentil(valores, percentil) {
  const ordenados = [...valores].sort((a, b) => a - b);
  const posicion = (ordenados.length - 1) * percentil;
  const inferior = Math.floor(posicion);
  const superior = Math.ceil(posicion);
  return ordenados[inferior] + (ordenados[superior] - ordenados[inferior]) * (posicion - inferior);
}

function formatoNumero(valor, idioma = 'es') {
  return valor === null || valor === undefined
    ? TEXT[idioma].noComparable
    : new Intl.NumberFormat(idioma === 'es' ? 'es-DO' : 'en-US', { maximumFractionDigits: 1 }).format(valor);
}
