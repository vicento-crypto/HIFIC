// Carga los datos y muestra el calendario o un mensaje de error claro.
import { ARCHIVO_DATOS, cargarDatos, calcularMedianaMismoMes } from './data.js';
import { descargarCSV } from './export.js';
import { dibujarMapa } from './map.js';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

async function iniciar() {
// Inicia el mapa de forma independiente de la carga del CSV y del calendario.
try {
  dibujarMapa();
} catch (error) {
  document.getElementById('error-mapa').textContent = `No se pudo mostrar el mapa: ${error.message}`;
}

// Actualiza el resumen de comparación para la casilla elegida.
function mostrarComparacion(datos, mes, anio, valor, sinDato) {
  const panel = document.getElementById('comparacion');
  const [titulo, lineaValor, lineaMediana, mensaje] = [
    'comparacion-titulo', 'comparacion-valor', 'comparacion-mediana', 'comparacion-mensaje',
  ].map((id) => document.getElementById(id));
  panel.hidden = false;
  titulo.textContent = `${MESES[mes - 1]} ${anio}`;

  if (sinDato) {
    lineaValor.textContent = 'Valor: sin dato';
    lineaMediana.textContent = '';
    mensaje.textContent = 'Este mes no tiene dato en el CSV.';
    return;
  }

  lineaValor.textContent = `Valor: ${valor} focos`;
  const { mediana, cantidad } = calcularMedianaMismoMes(datos, mes, anio);
  lineaMediana.textContent = mediana === null ? 'Mediana de otros años: sin datos' : `Mediana de otros años: ${mediana} focos`;
  if (cantidad < 5) {
    mensaje.textContent = 'pocos datos para comparar';
  } else if (mediana === 0) {
    const diferencia = valor;
    mensaje.textContent = `${diferencia >= 0 ? '▲' : '▼'} ${Math.abs(diferencia)} focos de diferencia con la mediana`;
  } else {
    const porcentaje = Math.round(((valor - mediana) / mediana) * 100);
    mensaje.textContent = porcentaje > 0
      ? `▲ ${porcentaje}% por encima de la mediana`
      : porcentaje < 0
        ? `▼ ${Math.abs(porcentaje)}% por debajo de la mediana`
        : '＝ igual a la mediana';
  }
}

const aviso = document.getElementById('aviso-prueba');
aviso.hidden = !ARCHIVO_DATOS.includes('PRUEBA');
document.getElementById('comparacion-prueba').hidden = !ARCHIVO_DATOS.includes('PRUEBA');

try {
  const datos = await cargarDatos();
  // Carga ECharts solo dentro del bloque protegido para aislar sus errores.
  const { dibujarCalendario } = await import('./calendar.js');
  if (datos.filasIgnoradas > 0) {
    const avisoFilas = document.getElementById('aviso-filas');
    avisoFilas.textContent = `Se ignoraron ${datos.filasIgnoradas} filas con focos_armonizados no numérico. Ejemplo: año ${datos.ejemploFilaIgnorada.anio}, mes ${datos.ejemploFilaIgnorada.mes}.`;
    avisoFilas.hidden = false;
  }
  if (datos.length === 0) {
    document.getElementById('error').textContent = 'No hay datos válidos en el CSV';
    return;
  }
  const anios = [...new Set(datos.map((fila) => fila.anio))].sort((a, b) => a - b);
  const desde = document.getElementById('desde-anio');
  const hasta = document.getElementById('hasta-anio');
  const botonDescarga = document.getElementById('descargar-csv');
  const mensajeRango = document.getElementById('mensaje-rango');
  const elementoCalendario = document.getElementById('calendario');
  for (const anio of anios) {
    desde.add(new Option(anio, anio));
    hasta.add(new Option(anio, anio));
  }
  desde.value = anios[0];
  hasta.value = anios.at(-1);

  const actualizarCalendario = () => {
    const minimo = Number(desde.value);
    const maximo = Number(hasta.value);
    const datosVisibles = datos.filter((fila) => fila.anio >= minimo && fila.anio <= maximo);
    const aniosVisibles = new Set(datosVisibles.map((fila) => fila.anio));
    if (aniosVisibles.size === 0) {
      elementoCalendario.hidden = true;
      mensajeRango.textContent = 'No hay años en ese rango';
      mensajeRango.hidden = false;
      botonDescarga.disabled = true;
      return;
    }
    elementoCalendario.hidden = false;
    mensajeRango.hidden = true;
    botonDescarga.disabled = false;
    dibujarCalendario(datosVisibles, (mes, anio, valor, sinDato) => {
    mostrarComparacion(datos, mes, anio, valor, sinDato);
    });
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

  // Empieza en el mes más reciente que sí tiene dato.
  const ultimo = datos
    .filter((fila) => Number.isFinite(fila.anio) && Number.isFinite(fila.mes))
    .sort((a, b) => b.anio - a.anio || b.mes - a.mes)[0];
  if (ultimo) {
    const filasMes = datos.filter((fila) => fila.anio === ultimo.anio && fila.mes === ultimo.mes);
    const valor = filasMes.reduce((suma, fila) => suma + fila.focos_armonizados, 0);
    mostrarComparacion(datos, ultimo.mes, ultimo.anio, valor, false);
  }
} catch (error) {
  document.getElementById('error').textContent = `No se pudo mostrar el calendario: ${error.message}`;
}
}

iniciar();
