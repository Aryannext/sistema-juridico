import { useEffect, useRef } from 'react';

/**
 * Cierra la sesión tras un rato sin actividad — RNF02.7, HU-01 criterio 7.
 *
 * El motivo es físico, no informático: un abogado deja el portátil abierto en
 * una sala de audiencias o en una mesa compartida, y cualquiera que pase tiene
 * delante expedientes, datos de clientes y documentos privados. Cerrar solo la
 * tapa no cierra la sesión.
 *
 * **Alcance real, para no prometer de más.** Esto cierra la sesión en el
 * navegador: borra el token y devuelve a la pantalla de acceso. El JWT en sí
 * sigue siendo válido en el servidor hasta que caduque a las 8 horas, porque
 * un JWT no se revoca sin mantener una lista de tokens anulados, que este
 * sistema no lleva. Protege del vistazo ajeno a una pantalla desatendida, que
 * es el riesgo que el requisito describe; no de alguien que hubiera copiado el
 * token antes.
 */

const MINUTOS_DE_INACTIVIDAD = 30;

// Señales de que hay alguien delante. `scroll` y `touchstart` van incluidos
// porque en una tableta puede no haber ni ratón ni teclado.
const SENALES = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

export default function useCierrePorInactividad(activa, alExpirar) {
  // En una referencia y no en estado: cambia con cada movimiento del ratón y
  // provocaría un renderizado por cada uno. Arranca en 0 y se fija dentro del
  // efecto; leer el reloj durante el renderizado sería un efecto secundario.
  const ultimaSenal = useRef(0);
  const alExpirarRef = useRef(alExpirar);

  // Se guarda aparte para que el temporizador no dependa de la identidad de la
  // función: si no, cada renderizado del padre reiniciaría la cuenta.
  useEffect(() => {
    alExpirarRef.current = alExpirar;
  }, [alExpirar]);

  useEffect(() => {
    if (!activa) return;

    const limite = MINUTOS_DE_INACTIVIDAD * 60 * 1000;
    const anotar = () => { ultimaSenal.current = Date.now(); };

    // La cuenta empieza al activarse la sesión, no al montar el componente.
    anotar();

    for (const senal of SENALES) {
      window.addEventListener(senal, anotar, { passive: true });
    }

    // Se comprueba cada 30 s en vez de programar un temporizador nuevo con cada
    // movimiento del ratón: sale mucho más barato y 30 s de margen sobre 30 min
    // no cambian nada.
    const reloj = setInterval(() => {
      if (Date.now() - ultimaSenal.current >= limite) {
        alExpirarRef.current?.();
      }
    }, 30 * 1000);

    return () => {
      clearInterval(reloj);
      for (const senal of SENALES) window.removeEventListener(senal, anotar);
    };
  }, [activa]);
}

export { MINUTOS_DE_INACTIVIDAD };
