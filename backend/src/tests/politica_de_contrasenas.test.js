/**
 * HU-01.6 / RNF02.2 — la política de contraseñas, comprobada en el servidor.
 *
 * Esta prueba nace de un hallazgo incómodo: el criterio HU-01.6 pedía «mínimo 8
 * caracteres, mayúscula, número y **carácter especial**» y figuraba como
 * cumplido, pero de las cuatro exigencias solo se comprobaban tres. Una
 * contraseña como "Segura2026" pasaba el filtro. El criterio estaba marcado ✅
 * sin que nada lo sostuviera, que es peor que estar en rojo: en rojo se ve.
 *
 * La regla que faltaba se añadió el 3 de septiembre de 2026. Esta prueba fija
 * las cuatro para que ninguna vuelva a desaparecer en silencio.
 */
const { validarPassword, MINIMO } = require('../utils/password');

describe('HU-01.6 · Las cuatro exigencias de la política', () => {
  it('Acepta una contraseña que las cumple todas', () => {
    expect(validarPassword('Segura2026*').valida).toBe(true);
  });

  it('Rechaza la que no llega al mínimo de caracteres', () => {
    const r = validarPassword('Ab1*');
    expect(r.valida).toBe(false);
    expect(r.error).toContain(`${MINIMO} caracteres`);
  });

  it('Rechaza la que no tiene mayúscula', () => {
    const r = validarPassword('segura2026*');
    expect(r.valida).toBe(false);
    expect(r.error).toContain('mayúscula');
  });

  it('Rechaza la que no tiene minúscula', () => {
    const r = validarPassword('SEGURA2026*');
    expect(r.valida).toBe(false);
    expect(r.error).toContain('minúscula');
  });

  it('Rechaza la que no tiene número', () => {
    const r = validarPassword('SeguraClave*');
    expect(r.valida).toBe(false);
    expect(r.error).toContain('número');
  });

  it('Rechaza la que no tiene carácter especial', () => {
    // El caso concreto que se colaba: cumplía las otras tres.
    const r = validarPassword('Segura2026');
    expect(r.valida).toBe(false);
    expect(r.error).toContain('carácter especial');
  });

  it('Enumera de una vez todo lo que falta, no de uno en uno', () => {
    // Decirlo por partes obliga a reintentar hasta descubrir el conjunto.
    const r = validarPassword('abc');
    expect(r.valida).toBe(false);
    expect(r.error).toContain('caracteres');
    expect(r.error).toContain('mayúscula');
    expect(r.error).toContain('número');
    expect(r.error).toContain('carácter especial');
  });

  it('Rechaza el vacío y lo que no es texto', () => {
    for (const malo of ['', null, undefined, 12345678]) {
      expect(validarPassword(malo).valida).toBe(false);
    }
  });
});

describe('Qué cuenta como carácter especial', () => {
  it('Admite cualquier signo, no una lista corta de los previstos', () => {
    // Una lista cerrada deja fuera lo que no se le ocurrió a quien la escribió,
    // y rechazar un signo que la persona eligió a conciencia empuja hacia
    // contraseñas peores, no mejores.
    for (const signo of ['*', '!', '#', '$', '%', '&', '?', '-', '_', '.', '@', '+', '=', '¿', '¡', '€']) {
      expect(validarPassword(`Segura2026${signo}`).valida).toBe(true);
    }
  });

  it('Una letra acentuada NO cuenta como carácter especial', () => {
    // "Contraseñá2026" no debe colar por llevar tilde: es una letra, y darla
    // por buena vaciaría la regla justo en el idioma del sistema.
    const r = validarPassword('Contraseñá2026');
    expect(r.valida).toBe(false);
    expect(r.error).toContain('carácter especial');
  });

  it('Un espacio tampoco', () => {
    const r = validarPassword('Segura 2026');
    expect(r.valida).toBe(false);
    expect(r.error).toContain('carácter especial');
  });
});
