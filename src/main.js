// Carga los datos y muestra el calendario o un mensaje de error claro.
import { ARCHIVO_DATOS, cargarDatos } from './data.js';
import { dibujarCalendario } from './calendar.js';

const aviso = document.getElementById('aviso-prueba');
aviso.hidden = !ARCHIVO_DATOS.includes('PRUEBA');

try {
  const datos = await cargarDatos();
  dibujarCalendario(datos);
} catch (error) {
  document.getElementById('error').textContent = `No se pudo mostrar el calendario: ${error.message}`;
}
