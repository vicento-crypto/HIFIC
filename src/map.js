// Dibuja el mapa base y carga encima el contorno de República Dominicana.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const ESTILO_RD = {
  color: '#F26B1D',
  fillColor: '#F26B1D',
  fillOpacity: 0.32,
  weight: 2,
};

async function cargarContorno(mapa, alHacerClicRD) {
  try {
    const respuesta = await fetch('/data/rd_contorno.geojson');
    if (!respuesta.ok) {
      throw new Error('No se encontró public/data/rd_contorno.geojson.');
    }
    const geojson = await respuesta.json();
    L.geoJSON(geojson, {
      style: ESTILO_RD,
      onEachFeature: (_feature, capa) => {
        capa.bindTooltip('Haz clic para ver el calendario de RD');
        capa.on('mouseover', (evento) => {
          mapa.getContainer().style.cursor = 'pointer';
          evento.target.setStyle({ fillOpacity: 0.5, weight: 3 });
        });
        capa.on('mouseout', (evento) => {
          mapa.getContainer().style.cursor = '';
          evento.target.setStyle(ESTILO_RD);
        });
        capa.on('click', alHacerClicRD);
      },
    }).addTo(mapa);
  } catch (error) {
    document.getElementById('error-mapa').textContent = `No se pudo cargar el contorno de RD: ${error.message}`;
  }
}

export function dibujarMapa(alHacerClicRD = () => {}) {
  const mapa = L.map('mapa').setView([18.8, -70.2], 8);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    className: 'teselas-osm',
  }).addTo(mapa);

  // El contorno es una capa separada y conserva su color sobre las teselas filtradas.
  cargarContorno(mapa, alHacerClicRD);
  return mapa;
}
