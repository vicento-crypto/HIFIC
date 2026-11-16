import { TEXT, idiomaInicial } from './i18n.js';

const URL_INTRO = new URLSearchParams(window.location.search).get('intro');

if (URL_INTRO !== '0') {
  iniciarIntro();
}

function iniciarIntro() {
  const dialogo = document.createElement('div');
  dialogo.className = 'intro-bienvenida';
  dialogo.id = 'intro-bienvenida';
  dialogo.setAttribute('role', 'dialog');
  dialogo.setAttribute('aria-modal', 'true');
  const idioma = idiomaInicial();
  dialogo.setAttribute('aria-label', TEXT[idioma].welcome);
  dialogo.tabIndex = -1;
  dialogo.innerHTML = `<canvas class="intro-canvas" aria-hidden="true"></canvas><div class="intro-contenido"><h1>HIFIC</h1><p>${TEXT[idioma].introSubtitle}</p></div><p class="intro-ayuda">${TEXT[idioma].intro}</p>`;
  document.body.append(dialogo);
  const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let detenerAnimacion = () => {};

  const elementosPrevios = [...document.body.children]
    .filter((elemento) => elemento !== dialogo)
    .map((elemento) => ({ elemento, inert: elemento.inert }));
  for (const { elemento } of elementosPrevios) elemento.inert = true;

  let cerrando = false;
  const restaurarInteraccion = () => {
    for (const { elemento, inert } of elementosPrevios) elemento.inert = inert;
    document.removeEventListener('keydown', alPresionarTecla, true);
    document.removeEventListener('focusin', mantenerFoco, true);
    dialogo.remove();
  };
  const cerrarIntro = () => {
    if (cerrando) return;
    cerrando = true;
    window.removeEventListener('hific:app-ready', iniciarAnimacion);
    detenerAnimacion();
    dialogo.classList.add('cerrando');
    window.setTimeout(restaurarInteraccion, 500);
  };
  const alPresionarTecla = (evento) => {
    if (evento.key === 'Enter' || evento.key === ' ' || evento.key === 'Escape') {
      evento.preventDefault();
      cerrarIntro();
    } else if (evento.key === 'Tab') {
      evento.preventDefault();
      dialogo.focus({ preventScroll: true });
    }
  };
  const mantenerFoco = (evento) => {
    if (!dialogo.contains(evento.target)) dialogo.focus({ preventScroll: true });
  };
  dialogo.addEventListener('click', cerrarIntro);
  document.addEventListener('keydown', alPresionarTecla, true);
  document.addEventListener('focusin', mantenerFoco, true);
  dialogo.focus({ preventScroll: true });
  const iniciarAnimacion = () => {
    if (movimientoReducido) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (cerrando || !dialogo.isConnected) return;
      dialogo.classList.add('intro-animando', 'intro-iniciando');
      requestAnimationFrame(() => dialogo.classList.remove('intro-iniciando'));
      window.setTimeout(() => dialogo.classList.add('intro-visible'), 1400);
      detenerAnimacion = iniciarFuego(dialogo.querySelector('canvas'), dialogo.querySelector('h1'), dialogo);
    }));
  };
  window.addEventListener('hific:app-ready', iniciarAnimacion, { once: true });
}

function iniciarFuego(canvas, titulo, dialogo) {
  let marco = 0;
  let activo = true;
  let ancho = 0;
  let alto = 0;
  let escala = 1;
  let contexto;
  let alCambiarTamano;
  let alCambiarVisibilidad;
  const detener = () => {
    activo = false;
    cancelAnimationFrame(marco);
    window.removeEventListener('resize', alCambiarTamano);
    document.removeEventListener('visibilitychange', alCambiarVisibilidad);
  };
  try {
    contexto = canvas.getContext('2d');
    if (!contexto) return () => {};
    let modo = 'normal';
    let mezclaAditiva = true;
    let maximoFuego = 0;
    let maximoCenizas = 0;
    let muestras = 0;
    let promedioFotograma = 0;
    let acumuladoFuego = 0;
    let acumuladoCeniza = 0;
    let tiempoTranscurrido = 0;
    let anterior = performance.now();
    let cenizasIniciadas = false;
    const particulas = [];
    const colorCeniza = '#8A8A8F';
    const sprite = document.createElement('canvas');
    const contextoSprite = sprite.getContext('2d');
    if (!contextoSprite) return () => {};
    sprite.width = 48;
    sprite.height = 48;
    const gradienteSprite = contextoSprite.createRadialGradient(24, 24, 0, 24, 24, 24);
    gradienteSprite.addColorStop(0, 'rgba(255, 239, 150, 0.96)');
    gradienteSprite.addColorStop(0.24, '#FFB000');
    gradienteSprite.addColorStop(0.58, '#F26B1D');
    gradienteSprite.addColorStop(0.82, '#8C1D18');
    gradienteSprite.addColorStop(1, 'rgba(140, 29, 24, 0)');
    contextoSprite.fillStyle = gradienteSprite;
    contextoSprite.fillRect(0, 0, 48, 48);
    const ajustarLimites = () => {
      const movil = window.matchMedia('(max-width: 799px)').matches;
      const baseFuego = movil ? 40 : 80;
      const baseCenizas = movil ? 25 : 40;
      maximoFuego = modo === 'estatico' ? 0 : Math.floor(baseFuego / (modo === 'degradado' ? 2 : 1));
      maximoCenizas = modo === 'estatico' ? 15 : Math.floor(baseCenizas / (modo === 'degradado' ? 2 : 1));
      if (particulas.length > Math.max(maximoFuego, maximoCenizas)) {
        particulas.length = Math.max(maximoFuego, maximoCenizas);
      }
    };
    const ajustar = () => {
      ancho = window.innerWidth;
      alto = window.innerHeight;
      escala = Math.min(window.devicePixelRatio || 1, 1);
      canvas.width = Math.round(ancho * escala);
      canvas.height = Math.round(alto * escala);
      contexto.setTransform(escala, 0, 0, escala, 0, 0);
      ajustarLimites();
    };
    alCambiarTamano = () => ajustar();
    ajustar();
    window.addEventListener('resize', alCambiarTamano, { passive: true });
    const refrescar = () => {
      if (activo && !document.hidden) marco = requestAnimationFrame(dibujar);
    };
    alCambiarVisibilidad = () => {
      if (document.hidden) cancelAnimationFrame(marco);
      else {
        anterior = performance.now();
        refrescar();
      }
    };
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    const dibujar = (ahora) => {
      try {
        const delta = Math.max(0, (ahora - anterior) / 1000);
        anterior = ahora;
        tiempoTranscurrido += delta;
        if (muestras < 30) {
          muestras += 1;
          promedioFotograma += (delta * 1000 - promedioFotograma) / muestras;
          if (muestras === 30) {
            if (promedioFotograma > 40) {
              modo = 'estatico';
              mezclaAditiva = false;
              dialogo.classList.add('intro-visible');
            } else if (promedioFotograma > 24) {
              modo = 'degradado';
              mezclaAditiva = false;
            }
            ajustarLimites();
          }
        }
        const faseFuego = modo !== 'estatico' && tiempoTranscurrido < 2.2;
        if (!faseFuego && !cenizasIniciadas) {
          particulas.length = 0;
          cenizasIniciadas = true;
        }
        const intensidad = modo === 'estatico' || !faseFuego
          ? 0
          : tiempoTranscurrido < 0.8
            ? tiempoTranscurrido / 0.8
            : tiempoTranscurrido < 1.6
              ? 1
              : Math.max(0, 1 - (tiempoTranscurrido - 1.6) / 0.6);
        const caja = titulo.getBoundingClientRect();
        const origenY = caja.bottom + 8;
        contexto.clearRect(0, 0, ancho, alto);
        contexto.globalCompositeOperation = faseFuego && mezclaAditiva ? 'lighter' : 'source-over';
        if (faseFuego) acumuladoFuego += delta * 60 * intensidad;
        else if (cenizasIniciadas) acumuladoCeniza += delta * (modo === 'estatico' ? 3 : 6);
        const nacenFuego = faseFuego ? Math.min(maximoFuego - particulas.length, Math.floor(acumuladoFuego)) : 0;
        acumuladoFuego -= nacenFuego;
        const limiteCeniza = faseFuego ? 0 : maximoCenizas;
        const nacenCeniza = Math.min(limiteCeniza - particulas.length, Math.floor(acumuladoCeniza));
        acumuladoCeniza -= nacenCeniza;
        const nacen = nacenFuego + nacenCeniza;
        for (let indice = 0; indice < nacen; indice += 1) {
          if (indice >= nacenFuego) {
            const brasa = Math.random() < 0.22;
            particulas.push({
              x: Math.random() * ancho,
              y: alto + Math.random() * 20,
              vx: (Math.random() - 0.5) * 0.12,
              vy: -(0.08 + Math.random() * 0.16),
              deriva: Math.random() * Math.PI * 2,
              radio: 1 + Math.random() * 2,
              edad: 0,
              vida: 5 + Math.random() * 4,
              ceniza: !brasa,
            });
            continue;
          }
          particulas.push({
            x: caja.left + caja.width * (0.1 + Math.random() * 0.8),
            y: origenY + Math.random() * 14,
            vx: (Math.random() - 0.5) * 1.1,
            vy: -(0.7 + Math.random() * 1.6),
            radio: 1.5 + Math.random() * 2.5,
            edad: 0,
            vida: 0.65 + Math.random() * 0.65,
          });
        }
        for (let indice = particulas.length - 1; indice >= 0; indice -= 1) {
          const particula = particulas[indice];
          particula.edad += delta;
          particula.x += (particula.vx + (particula.deriva === undefined ? 0 : Math.sin(tiempoTranscurrido + particula.deriva) * 0.08)) * delta * 60;
          particula.y += particula.vy * (delta * 60);
          if (faseFuego) particula.radio += 2.7 * delta;
          if (particula.edad >= particula.vida) {
            particulas.splice(indice, 1);
            continue;
          }
          const progreso = particula.edad / particula.vida;
          if (faseFuego) {
            contexto.globalAlpha = intensidad * (1 - progreso);
            const diametro = particula.radio * 6;
            contexto.drawImage(sprite, particula.x - diametro / 2, particula.y - diametro / 2, diametro, diametro);
          } else {
            contexto.globalAlpha = Math.sin(Math.PI * progreso) * (modo === 'estatico' ? 0.22 : 0.5);
            contexto.fillStyle = particula.ceniza ? colorCeniza : '#F26B1D';
            contexto.beginPath();
            contexto.arc(particula.x, particula.y, particula.radio, 0, Math.PI * 2);
          }
          contexto.fill();
        }
        contexto.globalAlpha = 1;
        contexto.globalCompositeOperation = 'source-over';
        refrescar();
      } catch {
        detener();
      }
    };
    refrescar();
    return detener;
  } catch {
    detener();
    return () => {};
  }
}

