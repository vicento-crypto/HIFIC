// Loads the data and shows the calendar or a clear error message.
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';
import { ARCHIVO_DATOS, cargarDatos, calcularMedianaMismoMes } from './data.js';
import { descargarCSV } from './export.js';
import { dibujarMapa, actualizarIdiomaMapa } from './map.js';
import { TEXT, idiomaInicial, guardarIdioma } from './i18n.js';

let idiomaActual = idiomaInicial();
let textoActual = TEXT[idiomaActual];
let datosCache = [];

async function iniciar() {
  const selectorIdioma = document.getElementById('selector-idioma');
  selectorIdioma.value = idiomaActual;
  const aplicarIdioma = () => {
    textoActual = TEXT[idiomaActual];
    document.documentElement.lang = idiomaActual;
    document.title = textoActual.title;
    document.querySelectorAll('[data-i18n]').forEach((elemento) => {
      elemento.textContent = textoActual[elemento.dataset.i18n];
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((elemento) => {
      elemento.setAttribute('aria-label', textoActual[elemento.dataset.i18nAria]);
    });
    const dialogo = document.getElementById('intro-bienvenida');
    if (dialogo) {
      dialogo.setAttribute('aria-label', textoActual.welcome);
      const ayuda = dialogo.querySelector('.intro-ayuda');
      if (ayuda) ayuda.textContent = textoActual.intro;
      const subtitulo = dialogo.querySelector('.intro-contenido p');
      if (subtitulo) subtitulo.textContent = textoActual.introSubtitle;
    }
  };
  aplicarIdioma();
  const contenidoCalendario = document.getElementById('contenido-calendario');
  const tarjetaComparacion = document.getElementById('tarjeta-comparacion');
  const aplicacion = document.querySelector('.aplicacion');
  const zonaCalendario = document.querySelector('.zona-calendario');
  const botonAbrir = document.getElementById('abrir-calendario');
  const botonMinimizar = document.getElementById('minimizar-calendario');
  let modoVista = 'conteo';
  let mapa;
  let actualizarCalendario = () => {};
  let redibujarGrafico = () => {};
  let mapaListo = false;
  let datosListos = false;
  let inicioNotificado = false;
  let promesaModuloCalendario;
  let versionDibujo = 0;
  selectorIdioma.addEventListener('change', () => {
    idiomaActual = selectorIdioma.value;
    guardarIdioma(idiomaActual);
    aplicarIdioma();
    if (mapa) actualizarIdiomaMapa(mapa, idiomaActual);
    actualizarCalendario();
    const fecha = document.getElementById('comparacion-titulo').dataset.fecha;
    if (fecha) {
      const [mes, anio, valor, sinDato] = fecha.split(',');
      // Repaint the card in the selected language without recalculating its metrics.
      mostrarComparacion(datosCache, Number(mes), Number(anio), Number(valor), sinDato === 'true');
    }
  });
  const notificarInicioListo = () => {
    if (!mapaListo || !datosListos || inicioNotificado) return;
    inicioNotificado = true;
    window.dispatchEvent(new Event('hific:app-ready'));
  };
  const cargarModuloCalendario = () => {
    if (!promesaModuloCalendario) {
      promesaModuloCalendario = import('./calendar.js').then((modulo) => {
        redibujarGrafico = modulo.redimensionarCalendario;
        return modulo;
      });
    }
    return promesaModuloCalendario;
  };
  const invalidarMapaAlFinal = () => {
    let completado = false;
    let respaldo;
    const finalizar = () => {
      if (completado) return;
      completado = true;
      clearTimeout(respaldo);
      contenidoCalendario.removeEventListener('transitionend', alTerminarTransicion);
      mapa?.invalidateSize({ pan: false });
      redibujarGrafico();
    };
    const alTerminarTransicion = (evento) => {
      if (evento.target === contenidoCalendario && evento.propertyName === 'transform') finalizar();
    };
    contenidoCalendario.addEventListener('transitionend', alTerminarTransicion);
    respaldo = setTimeout(finalizar, 350);
  };
  const redimensionarVista = () => {
    requestAnimationFrame(() => mapa?.invalidateSize({ pan: false }));
  };
  const ubicarComparacion = () => {
    const espacio = aplicacion.clientWidth - contenidoCalendario.getBoundingClientRect().width - 40;
    const compacta = !contenidoCalendario.classList.contains('panel-minimizado') && espacio < 260;
    contenidoCalendario.classList.toggle('comparacion-compacta', compacta);
    if (compacta) {
      tarjetaComparacion.style.width = '100%';
      contenidoCalendario.insertBefore(tarjetaComparacion, zonaCalendario);
    } else {
      aplicacion.append(tarjetaComparacion);
      tarjetaComparacion.style.width = `${Math.max(260, Math.min(320, espacio))}px`;
    }
  };
  const mostrarCalendario = () => {
    if (!contenidoCalendario.classList.contains('panel-minimizado')) return;
    contenidoCalendario.classList.remove('panel-minimizado');
    aplicacion.classList.remove('calendario-minimizado');
    botonAbrir.hidden = true;
    tarjetaComparacion.hidden = false;
    actualizarCalendario();
    ubicarComparacion();
    invalidarMapaAlFinal();
  };
  const minimizarCalendario = () => {
    if (contenidoCalendario.classList.contains('panel-minimizado')) return;
    contenidoCalendario.classList.add('panel-minimizado');
    aplicacion.classList.add('calendario-minimizado');
    botonAbrir.hidden = false;
    tarjetaComparacion.hidden = true;
    ubicarComparacion();
    invalidarMapaAlFinal();
  };
  botonAbrir.addEventListener('click', mostrarCalendario);
  botonMinimizar.addEventListener('click', minimizarCalendario);
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') minimizarCalendario();
  });
  const botonConteo = document.getElementById('vista-conteo');
  const botonAnomalia = document.getElementById('vista-anomalia');
  const leyendaAnomalia = document.getElementById('leyenda-anomalia');
  const elegirVista = (vista) => {
    modoVista = vista;
    leyendaAnomalia.hidden = vista !== 'anomalia';
    botonConteo.classList.toggle('seleccionada', vista === 'conteo');
    botonAnomalia.classList.toggle('seleccionada', vista === 'anomalia');
    botonConteo.setAttribute('aria-pressed', String(vista === 'conteo'));
    botonAnomalia.setAttribute('aria-pressed', String(vista === 'anomalia'));
    actualizarCalendario();
  };
  botonConteo.addEventListener('click', () => elegirVista('conteo'));
  botonAnomalia.addEventListener('click', () => elegirVista('anomalia'));

  // Initialize the map separately so an outline error does not remove the basemap.
  try {
    mapa = dibujarMapa(mostrarCalendario, minimizarCalendario, () => {
      mapaListo = true;
      notificarInicioListo();
    }, () => idiomaActual);
  } catch (error) {
    document.getElementById('error-mapa').textContent = `${textoActual.mapError}: ${error.message}`;
    mapaListo = true;
    notificarInicioListo();
  }

// Updates the comparison summary for the selected cell.
function mostrarComparacion(datos, mes, anio, valor, sinDato) {
  const panel = document.getElementById('comparacion');
  const [titulo, lineaValor, lineaMediana, mensaje] = [
    'comparacion-titulo', 'comparacion-valor', 'comparacion-mediana', 'comparacion-mensaje',
  ].map((id) => document.getElementById(id));
  const lineaPercentil = document.getElementById('comparacion-percentil');
  panel.hidden = false;
  const numero = (valorNumerico) => `<span class="numero">${valorNumerico}</span>`;
  titulo.dataset.fecha = `${mes},${anio},${valor},${sinDato}`;
  titulo.innerHTML = `${textoActual.monthNames[mes - 1]} ${numero(anio)}`;

  if (sinDato) {
    lineaValor.innerHTML = `${textoActual.value}: ${textoActual.noData}`;
    lineaMediana.innerHTML = '';
    mensaje.textContent = textoActual.noDataMonth;
    lineaPercentil.textContent = '';
    return;
  }

  lineaValor.innerHTML = `${textoActual.value}: ${numero(valor)} ${textoActual.foci}`;
  const { mediana, cantidad } = calcularMedianaMismoMes(datos, mes, anio);
  const porcentajeMenor = calcularPorcentajeMenor(datos, mes, anio, valor);
  lineaPercentil.innerHTML = porcentajeMenor === null
    ? textoActual.percentileUnavailable
    : textoActual.percentile.replace('{value}', numero(porcentajeMenor));
  lineaMediana.innerHTML = mediana === null ? `${textoActual.otherMedian}: ${textoActual.noMedianData}` : `${textoActual.otherMedian}: ${numero(mediana)} ${textoActual.foci}`;
  if (cantidad < 5) {
    mensaje.textContent = textoActual.fewData;
  } else if (mediana === 0) {
    const diferencia = valor;
    mensaje.innerHTML = textoActual.diffMedian.replace('{arrow}', diferencia >= 0 ? '▲' : '▼').replace('{value}', numero(Math.abs(diferencia)));
  } else {
    const porcentaje = Math.round(((valor - mediana) / mediana) * 100);
    mensaje.innerHTML = porcentaje > 0
      ? textoActual.aboveMedian.replace('{arrow}', '▲').replace('{value}', numero(porcentaje))
      : porcentaje < 0
        ? textoActual.belowMedian.replace('{arrow}', '▼').replace('{value}', numero(Math.abs(porcentaje)))
        : textoActual.equalMedian;
  }
}

function calcularPorcentajeMenor(datos, mesElegido, anioElegido, valorElegido) {
  const totalesPorAnio = new Map();
  for (const fila of datos) {
    if (fila.mes !== mesElegido || fila.anio === anioElegido) continue;
    totalesPorAnio.set(fila.anio, (totalesPorAnio.get(fila.anio) ?? 0) + fila.focos_armonizados);
  }
  if (totalesPorAnio.size === 0) return null;
  const menores = [...totalesPorAnio.values()].filter((valor) => valor < valorElegido).length;
  return Math.round((menores / totalesPorAnio.size) * 100);
}

const aviso = document.getElementById('aviso-prueba');
aviso.hidden = !ARCHIVO_DATOS.includes('PRUEBA');
document.getElementById('comparacion-prueba').hidden = !ARCHIVO_DATOS.includes('PRUEBA');
try {
  const datos = await cargarDatos();
  datosCache = datos;
  // Load ECharts inside the guarded block to isolate its errors.
  if (datos.filasIgnoradas > 0) {
    const avisoFilas = document.getElementById('aviso-filas');
    avisoFilas.textContent = textoActual.invalidRows
      .replace('{count}', datos.filasIgnoradas)
      .replace('{year}', datos.ejemploFilaIgnorada.anio)
      .replace('{month}', datos.ejemploFilaIgnorada.mes);
    avisoFilas.hidden = false;
  }
  if (datos.length === 0) {
    document.getElementById('error').textContent = textoActual.noValidCsv;
    datosListos = true;
    notificarInicioListo();
    return;
  }
  const anios = [...new Set(datos.map((fila) => fila.anio))].sort((a, b) => a - b);
  const desde = document.getElementById('desde-anio');
  const hasta = document.getElementById('hasta-anio');
  const botonDescarga = document.getElementById('descargar-csv');
  const mensajeRango = document.getElementById('mensaje-rango');
  const elementoCalendario = document.getElementById('calendario');
  const zonaCalendario = document.querySelector('.zona-calendario');
  for (const anio of anios) {
    desde.add(new Option(anio, anio));
    hasta.add(new Option(anio, anio));
  }
  desde.value = anios[0];
  hasta.value = anios.at(-1);

  actualizarCalendario = async () => {
    const versionActual = ++versionDibujo;
    const minimo = Number(desde.value);
    const maximo = Number(hasta.value);
    const datosVisibles = datos.filter((fila) => fila.anio >= minimo && fila.anio <= maximo);
    const aniosVisibles = new Set(datosVisibles.map((fila) => fila.anio));
    if (aniosVisibles.size === 0) {
      elementoCalendario.hidden = true;
      mensajeRango.textContent = textoActual.noYears;
      mensajeRango.hidden = false;
      botonDescarga.disabled = true;
      return;
    }
    elementoCalendario.hidden = false;
    mensajeRango.hidden = true;
    botonDescarga.disabled = false;
    const leyendaAnomalia = document.getElementById('leyenda-anomalia');
    const leyendaConfianza = document.querySelector('.leyenda-confianza');
    const alturaPie = leyendaConfianza.offsetHeight
      + (leyendaAnomalia.hidden ? 0 : leyendaAnomalia.offsetHeight)
      + (mensajeRango.hidden ? 0 : mensajeRango.offsetHeight)
      + 12;
    const alturaDisponibleGrafico = Math.max(0, zonaCalendario.clientHeight - alturaPie);
    const alturaMinimaFilas = aniosVisibles.size * 20 + 92;
    elementoCalendario.style.height = `${Math.max(alturaDisponibleGrafico, alturaMinimaFilas)}px`;
    if (!contenidoCalendario.classList.contains('panel-minimizado')) {
      try {
        const moduloCalendario = await cargarModuloCalendario();
        if (versionActual !== versionDibujo || contenidoCalendario.classList.contains('panel-minimizado')) return;
        moduloCalendario.dibujarCalendario(datosVisibles, (mes, anio, valor, sinDato) => {
        mostrarComparacion(datos, mes, anio, valor, sinDato);
        }, modoVista, datos, idiomaActual);
        redimensionarVista();
      } catch (error) {
        document.getElementById('error').textContent = `${textoActual.calendarError}: ${error.message}`;
      }
    }
  };
  desde.addEventListener('change', () => {
    if (Number(desde.value) > Number(hasta.value)) hasta.value = desde.value;
    actualizarCalendario();
  });
  hasta.addEventListener('change', () => {
    if (Number(hasta.value) < Number(desde.value)) desde.value = hasta.value;
    actualizarCalendario();
  });
  botonDescarga.addEventListener('click', () => {
    if (botonDescarga.disabled) return;
    descargarCSV(datos, Number(desde.value), Number(hasta.value), ARCHIVO_DATOS.includes('PRUEBA'));
  });
  actualizarCalendario();

  // Start at the most recent month with data.
  const ultimo = datos
    .filter((fila) => Number.isFinite(fila.anio) && Number.isFinite(fila.mes))
    .sort((a, b) => b.anio - a.anio || b.mes - a.mes)[0];
  if (ultimo) {
    const filasMes = datos.filter((fila) => fila.anio === ultimo.anio && fila.mes === ultimo.mes);
    const valor = filasMes.reduce((suma, fila) => suma + fila.focos_armonizados, 0);
    mostrarComparacion(datos, ultimo.mes, ultimo.anio, valor, false);
  }
  datosListos = true;
  notificarInicioListo();
} catch (error) {
  document.getElementById('error').textContent = `${textoActual.calendarError}: ${error.message}`;
  datosListos = true;
  notificarInicioListo();
}
}

iniciar();
