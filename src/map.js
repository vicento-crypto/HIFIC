// Draws the basemap and overlays the Dominican Republic outline.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TEXT } from './i18n.js';

const ESTILO_RD = {
  color: '#F26B1D',
  fillColor: '#F26B1D',
  fillOpacity: 0.32,
  weight: 2,
};

async function cargarContorno(mapa, alHacerClicRD, alFinalizarContorno, idiomaActual) {
  try {
    const respuesta = await fetch('/data/rd_contorno.geojson');
    if (!respuesta.ok) {
      throw new Error(TEXT[typeof idiomaActual === 'function' ? idiomaActual() : idiomaActual].missingOutline);
    }
    const geojson = await respuesta.json();
    L.geoJSON(geojson, {
      style: ESTILO_RD,
      bubblingMouseEvents: false,
      onEachFeature: (_feature, capa) => {
        capa.bindTooltip(TEXT[typeof idiomaActual === 'function' ? idiomaActual() : idiomaActual].mapTooltip);
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
    const idioma = typeof idiomaActual === 'function' ? idiomaActual() : idiomaActual;
    document.getElementById('error-mapa').textContent = `${TEXT[idioma].outlineError}: ${error.message}`;
  } finally {
    alFinalizarContorno();
  }
}

export function dibujarMapa(alHacerClicRD = () => {}, alHacerClicMapa = () => {}, alMapaListo = () => {}, idioma = 'es') {
  const mapa = L.map('mapa').setView([18.8, -70.2], 8);
  mapa.on('click', alHacerClicMapa);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    className: 'teselas-osm',
  }).addTo(mapa);

  // The outline is a separate layer, so its color stays visible over the filtered tiles.
  cargarContorno(mapa, alHacerClicRD, alMapaListo, idioma);
  return mapa;
}

export function actualizarIdiomaMapa(mapa, idioma) {
  mapa?.eachLayer((capa) => {
    if (typeof capa.setTooltipContent === 'function') capa.setTooltipContent(TEXT[idioma].mapTooltip);
  });
}
