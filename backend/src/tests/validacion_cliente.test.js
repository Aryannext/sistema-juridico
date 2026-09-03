/**
 * Validación del cliente en el servidor — RF06, HU-04 y HU-05.
 *
 * El caso que motivó esto: un cliente jurídico podía guardarse sin razón social
 * ni NIT, porque esas columnas admiten nulo en la base para compartir tabla con
 * las personas naturales. La base no puede expresar «si es jurídica, entonces…»;
 * esa regla vive en el código y por eso hay que vigilarla aquí.
 */
const { validarCliente } = require('../modules/clientes/validacion');

const natural = (extra = {}) => ({
  tipo: 'NATURAL',
  nombre: 'María Fernanda Rojas',
  tipo_documento: 'CC',
  numero_documento: '1075123456',
  telefono: '3001234567',
  email: 'maria@correo.test',
  ...extra,
});

const juridica = (extra = {}) => ({
  tipo: 'JURIDICA',
  nombre: 'Inversiones Andinas S.A.S.',
  razon_social: 'Inversiones Andinas S.A.S.',
  nit: '901234567-8',
  representante: 'Carlos Ramírez',
  tipo_documento: 'NIT',
  numero_documento: '901234567',
  telefono: '6081234567',
  email: 'contacto@andinas.test',
  ...extra,
});

describe('Tipo de persona', () => {
  it('Acepta una persona natural completa', () => {
    expect(validarCliente(natural()).valido).toBe(true);
  });

  it('Acepta una persona jurídica completa', () => {
    expect(validarCliente(juridica()).valido).toBe(true);
  });

  it('Sin tipo, no se puede saber qué exigir', () => {
    const { valido, error } = validarCliente({ nombre: 'Alguien' });
    expect(valido).toBe(false);
    expect(error).toMatch(/natural o jurídica/i);
  });

  it('Rechaza un tipo que no existe', () => {
    expect(validarCliente(natural({ tipo: 'FUNDACION' })).valido).toBe(false);
  });
});

describe('Lo que exige cada tipo', () => {
  it('La persona jurídica necesita razón social, NIT y representante', () => {
    // Es el defecto que motivó esta validación: la base los admite nulos.
    const { valido, error } = validarCliente(
      juridica({ razon_social: '', nit: '', representante: '' })
    );

    expect(valido).toBe(false);
    expect(error).toContain('razón social');
    expect(error).toContain('NIT');
    expect(error).toContain('representante legal');
  });

  it('A la persona natural no se le pide NIT ni representante', () => {
    // Exigírselos sería absurdo y bloquearía el alta más común.
    expect(validarCliente(natural({ nit: undefined, representante: undefined })).valido).toBe(true);
  });

  it('La persona natural necesita nombre', () => {
    expect(validarCliente(natural({ nombre: '' })).valido).toBe(false);
  });
});

describe('Campos comunes', () => {
  it('Exige documento, teléfono y correo en ambos tipos', () => {
    for (const base of [natural, juridica]) {
      const { valido } = validarCliente(base({ numero_documento: '', telefono: '', email: '' }));
      expect(valido).toBe(false);
    }
  });

  it('Un campo con solo espacios cuenta como vacío', () => {
    // Sin esto, "   " pasaría la validación y quedaría guardado.
    expect(validarCliente(natural({ nombre: '   ' })).valido).toBe(false);
  });

  it('Enumera de una vez todo lo que falta, no de uno en uno', () => {
    // Reenviar el formulario para descubrir el siguiente campo que falta hace
    // perder el tiempo sin necesidad.
    const { error } = validarCliente({ tipo: 'NATURAL' });

    expect(error).toContain('nombre');
    expect(error).toContain('teléfono');
    expect(error).toContain('correo');
    expect(error).toContain('número de documento');
  });

  it('Une el último con «y», para que se lea como una frase', () => {
    const { error } = validarCliente(natural({ telefono: '', email: '' }));
    expect(error).toMatch(/ y /);
  });
});

describe('Formato del correo', () => {
  it('Rechaza algo que no es una dirección', () => {
    expect(validarCliente(natural({ email: 'esto-no-es-un-correo' })).valido).toBe(false);
  });

  it('Rechaza una dirección sin dominio', () => {
    expect(validarCliente(natural({ email: 'alguien@' })).valido).toBe(false);
  });

  it('Acepta direcciones poco comunes pero válidas', () => {
    // La comprobación es laxa a propósito: rechazar un correo válido cuesta más
    // que dejar pasar uno mal escrito, que se descubre al primer envío.
    for (const email of ['a+etiqueta@bufete.com.co', 'nombre.apellido@sub.dominio.org']) {
      expect(validarCliente(natural({ email })).valido).toBe(true);
    }
  });
});
