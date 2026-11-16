/**
 * ============================================================================
 *  armonizadorFuegos.js  —  Fuego Calendario (NASA Space Apps · República Dominicana)
 * ============================================================================
 *
 *  QUÉ HACE ESTE MÓDULO
 *  --------------------
 *  Recibe el TEXTO de archivos CSV de NASA FIRMS (MODIS y, opcionalmente, VIIRS S-NPP),
 *  los limpia y convierte cada punto de fuego MODIS en "puntos VIIRS equivalentes".
 *  Devuelve una tabla mensual (un objeto por mes) lista para pintar el calendario.
 *
 *  NO crea archivos, NO hace peticiones de red, NO toca el DOM.
 *  Es una librería pura: entra texto CSV -> sale un arreglo de objetos.
 *
 *  ---------------------------------------------------------------------------
 *  GUÍA RÁPIDA PARA QUIEN INTEGRE ESTO EN EL FRONTEND (persona o IA)
 *  ---------------------------------------------------------------------------
 *  1) Cargar el archivo:
 *       - Navegador:  <script src="armonizadorFuegos.js"></script>
 *                     -> queda disponible como  window.ArmonizadorFuegos
 *       - Módulo/Node: const ArmonizadorFuegos = require('./armonizadorFuegos.js');
 *
 *  2) Conseguir el texto de los CSV pre-guardados, por ejemplo:
 *       const modisTexto = await fetch('data/FIRMS_modis.csv').then(r => r.text());
 *       const viirsTexto = await fetch('data/FIRMS_viirs.csv').then(r => r.text()); // opcional
 *
 *  3) Llamar a la función principal:
 *       const resultado = ArmonizadorFuegos.transformar({ modisTexto, viirsTexto, zona: 'RD' });
 *
 *  4) Usar  resultado.filas  para el calendario. Cada fila es:
 *       {
 *         anio: 2010,                  // número entero -> EJE VERTICAL del calendario
 *         mes: 10,                     // 1..12         -> EJE HORIZONTAL del calendario
 *         zona: 'RD',                  // selector de zona (solo mostrarlo si hay más de una)
 *         focos_armonizados: 266.4,    // VALOR PRINCIPAL: número y color de la casilla (escala VIIRS)
 *         focos_modis: 47,             // opcional, transparencia: puntos MODIS crudos (null si no hay)
 *         focos_viirs: null,           // opcional, transparencia: puntos VIIRS reales (null si no hay)
 *         confianza: 'media',          // 'alta' | 'media' | 'baja'  (indicador visual opcional)
 *         fuente: 'VIIRS_equivalente', // 'VIIRS_real' | 'VIIRS_equivalente'
 *         rango80_bajo: 189.1,         // opcional: límite inferior del rango probable (null si es real)
 *         rango80_alto: 347.9          // opcional: límite superior del rango probable (null si es real)
 *       }
 *
 *     REGLAS DE PINTADO (vienen del documento del técnico web):
 *       - Si un mes NO aparece en "filas" => casilla gris "sin dato". NO es lo mismo que 0.
 *       - focos_armonizados = 0 => se observó y no hubo fuegos (casilla del color más bajo).
 *       - Meses con confianza 'baja' o 'media' son estimaciones: se recomienda mostrar
 *         "266 (189–348)" usando rango80_bajo / rango80_alto, o un borde punteado.
 *       - La mediana histórica / anomalías deben calcularse sobre focos_armonizados.
 *
 *  5) Si la web necesita el CSV de texto (focos_mensuales.csv) en lugar de objetos:
 *       const csv = ArmonizadorFuegos.aCsv(resultado.filas);
 *
 *  6) resultado.reporte trae cuántas filas quitó cada filtro (útil para mostrar o depurar).
 *
 *  ---------------------------------------------------------------------------
 *  CÓMO FUNCIONA LA CONVERSIÓN (resumen del método)
 *  ---------------------------------------------------------------------------
 *  Cada punto MODIS vale "x" puntos VIIRS:
 *
 *      x = exp( c + a·ln(puntosMODISdelMes) + b·ln(FRP) + s·[mes es ene–abr] )
 *
 *  - FRP alto (fuego intenso)      -> vale más puntos VIIRS.
 *  - Mes con muchos puntos MODIS   -> cada punto vale un poco menos.
 *  - Temporada seca (ene–abr)      -> ajuste estacional.
 *  Los coeficientes (MODELO_POR_DEFECTO) se calibraron en Python comparando MODIS con
 *  VIIRS real 2012–2025 sobre datos ya limpios. Validación dejando un año fuera:
 *  error anual medio ≈ 4,4 %, error mensual ≈ 15,7 %, sesgo total ≈ 0 %.
 *  La suma de los x de un mes = focos_armonizados de ese mes.
 *
 *  Si existe VIIRS real completo para un mes, se usa el REAL sin cambios (confianza 'alta').
 * ============================================================================
 */
(function (raiz, fabrica) {
  // Patrón UMD: funciona con require() en Node y como variable global en el navegador.
  if (typeof module === 'object' && module.exports) {
    module.exports = fabrica();
  } else {
    raiz.ArmonizadorFuegos = fabrica();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ==========================================================================
  // CONFIGURACIÓN (reglas de limpieza acordadas con el equipo)
  // ==========================================================================
  const CONFIG = {
    tiposValidos: [0],                 // type 0 = vegetación / presunto incendio
    confianzaMinimaModis: 30,          // MODIS: se conservan confianza >= 30
    confianzaExcluidaViirs: 'l',       // VIIRS: se quitan las de confianza baja 'l'
    sateliteViirs: 'N',                // VIIRS: solo S-NPP, el mismo en todos los años
    satelitesModis: ['Terra', 'Aqua'], // MODIS: ambos (Terra es el único antes de jul-2002)
    inicioAqua: '2002-07-04',          // antes de esta fecha solo existía Terra
    inicioViirs: '2012-01-20',         // inicio del archivo S-NPP en FIRMS (ene-2012 queda incompleto)
    inicioModis: '2000-11-01',         // inicio del archivo MODIS en FIRMS
    mesesSecos: [1, 2, 3, 4],          // temporada seca usada por el modelo
    ultimoAnioHistorico: 2025,         // hasta este año se ELIMINAN filas con version NRT
    anioMin: 2000,                     // rango que acepta la web
    anioMax: 2025,
  };

  // ==========================================================================
  // MODELO (coeficientes calibrados en Python con datos limpios, 2012-02 a 2025-12)
  // Variantes:
  //   ambos      -> meses con Terra y Aqua (jul-2002 en adelante)   => confianza 'media'
  //   solo_terra -> antes de jul-2002, o si el archivo no trae Aqua => confianza 'baja'
  //   solo_aqua  -> si el archivo no trae Terra                      => confianza 'baja'
  // intervalo80: en el 80 % de los meses validados, real/equivalente cayó entre estos factores.
  // ==========================================================================
  const MODELO_POR_DEFECTO = {
    ambos:      { const: 1.704315, log_nmes: -0.179419, log_frp: 0.292527, seca: 0.097799 },
    solo_terra: { const: 3.238168, log_nmes: -0.222546, log_frp: 0.10683,  seca: 0.201797 },
    solo_aqua:  { const: 2.154882, log_nmes: -0.219572, log_frp: 0.310134, seca: 0.112573 },
    intervalo80: [0.71, 1.306],
  };

  // Orden EXACTO de columnas que exige la web (obligatorias primero, opcionales al final).
  const COLUMNAS_WEB = ['anio', 'mes', 'zona', 'focos_armonizados', 'focos_modis', 'focos_viirs', 'confianza'];

  // ==========================================================================
  // UTILIDADES DE FECHA (se trabaja con strings 'AAAA-MM-DD' para evitar zonas horarias)
  // ==========================================================================
  /** 'AAAA-MM-DD' -> 'AAAA-MM' (clave de mes usada en todo el módulo). */
  function claveMes(fecha) { return fecha.slice(0, 7); }

  /** Último día del mes de una clave 'AAAA-MM' -> 'AAAA-MM-DD'. */
  function ultimoDiaDelMes(clave) {
    const [a, m] = clave.split('-').map(Number);
    const dia = new Date(Date.UTC(a, m, 0)).getUTCDate(); // día 0 del mes siguiente
    return `${clave}-${String(dia).padStart(2, '0')}`;
  }

  /** Suma n meses a una clave 'AAAA-MM'. */
  function sumarMeses(clave, n) {
    const [a, m] = clave.split('-').map(Number);
    const total = a * 12 + (m - 1) + n;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
  }

  /** Lista de claves de mes desde 'desde' hasta 'hasta' (ambas incluidas). */
  function rangoDeMeses(desde, hasta) {
    const lista = [];
    for (let c = desde; c <= hasta; c = sumarMeses(c, 1)) lista.push(c);
    return lista;
  }

  // ==========================================================================
  // 1) LECTURA DEL CSV
  // ==========================================================================
  /**
   * Convierte el texto de un CSV de FIRMS en un arreglo de objetos.
   * FIRMS no usa comillas ni comas dentro de los campos, por eso basta con split(',').
   * Todos los valores quedan como texto; las conversiones numéricas se hacen después.
   */
  function leerCsv(texto) {
    const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim() !== '');
    const encabezados = lineas[0].split(',').map(h => h.trim());
    const filas = new Array(lineas.length - 1);
    for (let i = 1; i < lineas.length; i++) {
      const valores = lineas[i].split(',');
      const fila = {};
      for (let j = 0; j < encabezados.length; j++) fila[encabezados[j]] = (valores[j] || '').trim();
      filas[i - 1] = fila;
    }
    return { encabezados, filas };
  }

  /** Detecta si el CSV es MODIS o VIIRS (por la columna instrument o por sus columnas propias). */
  function detectarSensor(encabezados, filas) {
    if (encabezados.includes('instrument') && filas.length) return filas[0].instrument.toUpperCase();
    return encabezados.includes('bright_ti4') ? 'VIIRS' : 'MODIS';
  }

  // ==========================================================================
  // 2) LIMPIEZA (las 5 reglas del equipo)
  // ==========================================================================
  /**
   * Aplica en orden: type -> confidence -> satélite -> version NRT -> borrar columnas.
   * Devuelve { filas, reporte } donde reporte = [{paso, filas}, ...].
   * Cada fila limpia queda con: fecha, mes (clave), satelite, frp (número), version.
   */
  function limpiar(textoCsv, sensorEsperado, config) {
    const { encabezados, filas } = leerCsv(textoCsv);
    const requeridas = ['latitude', 'longitude', 'acq_date', 'satellite', 'confidence', 'frp', 'type', 'version'];
    const faltan = requeridas.filter(c => !encabezados.includes(c));
    if (faltan.length) throw new Error(`El CSV no parece de FIRMS: faltan columnas ${faltan.join(', ')}`);

    const sensor = detectarSensor(encabezados, filas);
    if (sensorEsperado && sensor !== sensorEsperado) {
      throw new Error(`Se esperaba un archivo ${sensorEsperado} y llegó ${sensor}`);
    }

    const reporte = [{ paso: 'filas leídas', filas: filas.length }];
    let datos = filas;

    // Regla 1: type. Solo los tipos válidos (0 = vegetación).
    datos = datos.filter(f => config.tiposValidos.includes(Number(f.type)));
    reporte.push({ paso: 'después de type', filas: datos.length });

    // Regla 2: confidence. MODIS >= 30 (número). VIIRS: quitar 'l' (texto l/n/h).
    if (sensor === 'MODIS') {
      datos = datos.filter(f => Number(f.confidence) >= config.confianzaMinimaModis);
    } else {
      datos = datos.filter(f => f.confidence.toLowerCase() !== config.confianzaExcluidaViirs);
    }
    reporte.push({ paso: 'después de confidence', filas: datos.length });

    // Regla 3: satélite. VIIRS: solo 'N' (S-NPP). MODIS: Terra y Aqua (acepta también 'T'/'A').
    if (sensor === 'VIIRS') {
      datos = datos.filter(f => f.satellite === config.sateliteViirs);
    } else {
      datos = datos
        .map(f => ({ ...f, satellite: f.satellite === 'T' ? 'Terra' : f.satellite === 'A' ? 'Aqua' : f.satellite }))
        .filter(f => config.satelitesModis.includes(f.satellite));
    }
    reporte.push({ paso: 'después de satélite', filas: datos.length });

    // Regla 4: version. En años históricos no se aceptan datos NRT (casi tiempo real).
    datos = datos.filter(f => !(esNrt(f.version) && Number(f.acq_date.slice(0, 4)) <= config.ultimoAnioHistorico));
    reporte.push({ paso: 'después de version', filas: datos.length });

    // Regla 5: borrar columnas que no se usan (brightness/bright_ti4, scan, track, bright_t31/bright_ti5).
    // Se construye un objeto nuevo solo con lo necesario.
    const limpias = datos.map(f => ({
      fecha: f.acq_date,
      mes: claveMes(f.acq_date),
      hora: f.acq_time,
      latitud: Number(f.latitude),
      longitud: Number(f.longitude),
      satelite: f.satellite,
      confianza: f.confidence,
      frp: Number(f.frp),
      diaNoche: f.daynight,
      version: f.version,
    }));

    // Fecha más antigua y más reciente del archivo CRUDO (sirven para saber qué meses están completos).
    let fechaMin = null, fechaMax = null;
    for (const f of filas) {
      if (!fechaMin || f.acq_date < fechaMin) fechaMin = f.acq_date;
      if (!fechaMax || f.acq_date > fechaMax) fechaMax = f.acq_date;
    }
    return { sensor, filas: limpias, reporte, fechaMin, fechaMax };
  }

  function esNrt(version) { return String(version).toUpperCase().includes('NRT'); }

  // ==========================================================================
  // 3) CONVERSIÓN MODIS -> VIIRS EQUIVALENTE (peso por punto)
  // ==========================================================================
  /**
   * Calcula el peso x de UN punto MODIS.
   * coef = { const, log_nmes, log_frp, seca }
   * puntosDelMes = cuántos puntos MODIS (de la misma variante) hay en ese mes.
   */
  function pesoDelPunto(punto, puntosDelMes, coef, config) {
    const mes = Number(punto.mes.slice(5, 7));
    const esSeca = config.mesesSecos.includes(mes) ? 1 : 0;
    const frp = Math.max(punto.frp, 0.1); // evita ln(0)
    return Math.exp(coef.const + coef.log_nmes * Math.log(puntosDelMes) + coef.log_frp * Math.log(frp) + coef.seca * esSeca);
  }

  /**
   * Asigna a cada punto MODIS su peso y la variante del modelo usada.
   * Variante por punto:
   *   - fecha < inicioAqua               -> 'solo_terra'
   *   - si el AÑO trae Terra y Aqua      -> 'ambos'
   *   - si el año trae solo uno de ellos -> 'solo_aqua' / 'solo_terra'
   * Devuelve los mismos puntos con { peso_viirs, variante }.
   */
  function convertirModis(puntosModis, modelo, config) {
    // Qué satélites aparecen en cada año.
    const satelitesPorAnio = {};
    for (const p of puntosModis) {
      const anio = p.fecha.slice(0, 4);
      (satelitesPorAnio[anio] = satelitesPorAnio[anio] || new Set()).add(p.satelite);
    }

    // Elegir variante de cada punto.
    const conVariante = puntosModis.map(p => {
      let variante;
      if (p.fecha < config.inicioAqua) {
        variante = 'solo_terra';
      } else {
        const hay = satelitesPorAnio[p.fecha.slice(0, 4)];
        variante = hay.has('Terra') && hay.has('Aqua') ? 'ambos' : hay.has('Aqua') ? 'solo_aqua' : 'solo_terra';
      }
      return { ...p, variante };
    });

    // Contar puntos por (mes, variante): es la "densidad" que usa la fórmula.
    const conteo = {};
    for (const p of conVariante) {
      const k = p.mes + '|' + p.variante;
      conteo[k] = (conteo[k] || 0) + 1;
    }

    // Calcular el peso de cada punto.
    return conVariante.map(p => ({
      ...p,
      peso_viirs: pesoDelPunto(p, conteo[p.mes + '|' + p.variante], modelo[p.variante], config),
    }));
  }

  // ==========================================================================
  // 4) MESES COMPLETOS
  // ==========================================================================
  /**
   * Devuelve [primerMes, ultimoMes] completos de un sensor.
   * - El primer mes se descarta si el sensor empezó a mitad de mes (ej. VIIRS 20-ene-2012).
   * - El último mes se descarta si el archivo no llega al último día del mes.
   */
  function mesesCompletos(fechaInicioSensor, fechaMinArchivo, fechaMaxArchivo) {
    const inicio = fechaMinArchivo > fechaInicioSensor ? fechaMinArchivo : fechaInicioSensor;
    let primer = claveMes(inicio);
    if (inicio.slice(8, 10) !== '01' && inicio === fechaInicioSensor) primer = sumarMeses(primer, 1);
    let ultimo = claveMes(fechaMaxArchivo);
    if (fechaMaxArchivo !== ultimoDiaDelMes(ultimo)) ultimo = sumarMeses(ultimo, -1);
    return [primer, ultimo];
  }

  // ==========================================================================
  // 5) FUNCIÓN PRINCIPAL
  // ==========================================================================
  /**
   * transformar({ modisTexto, viirsTexto?, zona?, modelo?, config? })
   *
   * Parámetros:
   *   modisTexto  (obligatorio) texto del CSV crudo de FIRMS MODIS.
   *   viirsTexto  (opcional)    texto del CSV crudo de FIRMS VIIRS S-NPP. Si se da, los meses
   *                             con VIIRS real completo usan el valor REAL (confianza 'alta').
   *   zona        (opcional)    código corto de la región. Por defecto 'RD'.
   *   modelo      (opcional)    coeficientes alternativos (mismo formato que MODELO_POR_DEFECTO).
   *   config      (opcional)    sobrescribe valores de CONFIG (ej. { anioMax: 2026 }).
   *
   * Devuelve:
   *   {
   *     filas:   [ {anio, mes, zona, focos_armonizados, focos_modis, focos_viirs, confianza,
   *                 fuente, rango80_bajo, rango80_alto}, ... ]   // ordenadas por año y mes
   *     puntos:  [ cada punto MODIS limpio con peso_viirs y variante ]   // para mapas, opcional
   *     reporte: { modis: [...], viirs: [...] }                          // filas por filtro
   *   }
   */
  function transformar(opciones) {
    const config = Object.assign({}, CONFIG, opciones.config || {});
    // Acepta también el JSON que genera el script de Python (usa la clave 'intervalo80_factor').
    const modelo = Object.assign({}, opciones.modelo || MODELO_POR_DEFECTO);
    if (!modelo.intervalo80) modelo.intervalo80 = modelo.intervalo80_factor || MODELO_POR_DEFECTO.intervalo80;
    const zona = opciones.zona || 'RD';

    // --- MODIS: limpiar y convertir ---
    const modis = limpiar(opciones.modisTexto, 'MODIS', config);
    if (!modis.filas.length) throw new Error('Después de limpiar no quedó ningún punto MODIS.');
    const puntos = convertirModis(modis.filas, modelo, config);

    // Sumar por mes: equivalente, conteo MODIS, variante dominante y si hubo NRT.
    const porMes = {};
    for (const p of puntos) {
      const m = (porMes[p.mes] = porMes[p.mes] || { suma: 0, n: 0, variantes: {}, nrt: false });
      m.suma += p.peso_viirs;
      m.n += 1;
      m.variantes[p.variante] = (m.variantes[p.variante] || 0) + 1;
      if (esNrt(p.version)) m.nrt = true;
    }

    // Todos los meses completos cubiertos por MODIS (incluye meses con 0 puntos = 0 fuegos).
    const [modisDesde, modisHasta] = mesesCompletos(config.inicioModis, modis.fechaMin.slice(0, 7) + '-01', modis.fechaMax);
    const filasPorMes = {};
    for (const clave of rangoDeMeses(modisDesde, modisHasta)) {
      const m = porMes[clave];
      const variante = m ? Object.keys(m.variantes).sort((a, b) => m.variantes[b] - m.variantes[a])[0] : 'ambos';
      const equivalente = m ? m.suma : 0;
      filasPorMes[clave] = {
        clave,
        focos_armonizados: redondear(equivalente, 1),
        focos_modis: m ? m.n : 0,
        focos_viirs: null,
        confianza: variante !== 'ambos' || (m && m.nrt) ? 'baja' : 'media',
        fuente: 'VIIRS_equivalente',
        rango80_bajo: redondear(equivalente * modelo.intervalo80[0], 1),
        rango80_alto: redondear(equivalente * modelo.intervalo80[1], 1),
      };
    }

    // --- VIIRS real (opcional): reemplaza los meses que tengan VIIRS completo ---
    let viirs = null;
    if (opciones.viirsTexto) {
      viirs = limpiar(opciones.viirsTexto, 'VIIRS', config);
      const conteoViirs = {};
      for (const p of viirs.filas) conteoViirs[p.mes] = (conteoViirs[p.mes] || 0) + 1;
      const [viirsDesde, viirsHasta] = mesesCompletos(config.inicioViirs, viirs.fechaMin, viirs.fechaMax);
      for (const clave of rangoDeMeses(viirsDesde, viirsHasta)) {
        const real = conteoViirs[clave] || 0;
        const previa = filasPorMes[clave];
        filasPorMes[clave] = {
          clave,
          focos_armonizados: real,               // el REAL, sin cambios
          focos_modis: previa ? previa.focos_modis : null,
          focos_viirs: real,
          confianza: 'alta',
          fuente: 'VIIRS_real',
          rango80_bajo: null,
          rango80_alto: null,
        };
      }
    }

    // --- Armar la salida final, ordenada y dentro del rango de años de la web ---
    const filas = Object.keys(filasPorMes).sort().map(clave => {
      const f = filasPorMes[clave];
      return {
        anio: Number(clave.slice(0, 4)),
        mes: Number(clave.slice(5, 7)),
        zona,
        focos_armonizados: f.focos_armonizados,
        focos_modis: f.focos_modis,
        focos_viirs: f.focos_viirs,
        confianza: f.confianza,
        fuente: f.fuente,
        rango80_bajo: f.rango80_bajo,
        rango80_alto: f.rango80_alto,
      };
    }).filter(f => f.anio >= config.anioMin && f.anio <= config.anioMax);

    validarFilas(filas, config);
    return { filas, puntos, reporte: { modis: modis.reporte, viirs: viirs ? viirs.reporte : null } };
  }

  // ==========================================================================
  // 6) VALIDACIÓN DEL FORMATO (reglas del documento del técnico web)
  // ==========================================================================
  /** Lanza un error si la tabla no cumple el formato. No devuelve nada si todo está bien. */
  function validarFilas(filas, config) {
    const vistos = new Set();
    for (const f of filas) {
      const clave = `${f.zona}|${f.anio}|${f.mes}`;
      if (vistos.has(clave)) throw new Error(`Fila repetida: ${clave}`);
      vistos.add(clave);
      if (!Number.isInteger(f.anio) || f.anio < config.anioMin || f.anio > config.anioMax) throw new Error(`Año fuera de rango: ${f.anio}`);
      if (!Number.isInteger(f.mes) || f.mes < 1 || f.mes > 12) throw new Error(`Mes inválido: ${f.mes}`);
      if (typeof f.focos_armonizados !== 'number' || !(f.focos_armonizados >= 0)) throw new Error(`focos_armonizados inválido en ${clave}`);
      if (!['alta', 'media', 'baja'].includes(f.confianza)) throw new Error(`confianza inválida en ${clave}`);
    }
  }

  // ==========================================================================
  // 7) EXPORTAR A CSV (formato focos_mensuales.csv: coma, punto decimal, vacíos = celda vacía)
  // ==========================================================================
  /** Convierte las filas al texto CSV exacto que espera la web (solo las 7 columnas oficiales). */
  function aCsv(filas) {
    const lineas = [COLUMNAS_WEB.join(',')];
    for (const f of filas) {
      lineas.push(COLUMNAS_WEB.map(c => (f[c] === null || f[c] === undefined ? '' : String(f[c]))).join(','));
    }
    return lineas.join('\n') + '\n';
  }

  // ==========================================================================
  // 8) AYUDAS PARA EL FRONTEND
  // ==========================================================================
  /**
   * Convierte las filas en una matriz para pintar el calendario:
   *   { anios: [2000, ..., 2025], celdas: { 2010: { 1: fila, 2: fila, ... }, ... } }
   * Una celda ausente (undefined) significa "sin dato" -> pintar en gris.
   */
  function aMatrizCalendario(filas) {
    const celdas = {};
    for (const f of filas) (celdas[f.anio] = celdas[f.anio] || {})[f.mes] = f;
    const anios = Object.keys(celdas).map(Number).sort((a, b) => a - b);
    return { anios, celdas };
  }

  /**
   * Mediana histórica por mes del año (1..12) sobre focos_armonizados.
   * Útil para colorear anomalías: anomalia = focos_armonizados / mediana[mes] - 1.
   */
  function medianaPorMes(filas) {
    const grupos = {};
    for (const f of filas) (grupos[f.mes] = grupos[f.mes] || []).push(f.focos_armonizados);
    const res = {};
    for (const mes of Object.keys(grupos)) {
      const v = grupos[mes].sort((a, b) => a - b);
      const mitad = Math.floor(v.length / 2);
      res[mes] = v.length % 2 ? v[mitad] : (v[mitad - 1] + v[mitad]) / 2;
    }
    return res;
  }

  function redondear(x, decimales) {
    const f = Math.pow(10, decimales);
    return Math.round(x * f) / f;
  }

  // API pública del módulo.
  return {
    transformar,        // función principal
    aCsv,               // filas -> texto CSV del formato web
    aMatrizCalendario,  // filas -> estructura año x mes para el calendario
    medianaPorMes,      // mediana histórica por mes (para anomalías)
    limpiar,            // expuesta por si se quiere mostrar el reporte de limpieza aparte
    MODELO_POR_DEFECTO,
    CONFIG,
    COLUMNAS_WEB,
  };
});