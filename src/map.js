// Dibuja el mapa base de República Dominicana con Leaflet.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export function dibujarMapa() {
  const mapa = L.map('mapa').setView([18.8, -70.2], 8);

  // Capa de OpenStreetMap con la atribución obligatoria.
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(mapa);
}
