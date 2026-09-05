/**
 * Los valores de enumerado que la API acepta deben ser los que la base admite.
 *
 * Esta prueba es la que hace útil a `utils/enumerados.js`. Sin ella, el archivo
 * sería una séptima copia de las listas —y las copias divergen—. Con ella, la
 * copia está vigilada: si alguien añade un valor al esquema y no lo añade aquí,
 * o al revés, esto falla y nombra el enumerado.
 *
 * Se comprueba contra `schema.prisma` porque es la única fuente que manda: es
 * lo que la base acepta de verdad.
 */
const fs = require('node:fs');
const path = require('node:path');
const { ENUMERADOS, validarEnum } = require('../utils/enumerados');

const esquema = fs.readFileSync(
  path.join(__dirname, '..', '..', 'prisma', 'schema.prisma'), 'utf8'
);

/** Valores de un enumerado tal como están en el esquema. */
function delEsquema(nombre) {
  const bloque = esquema.match(new RegExp(`enum ${nombre} \\{([\\s\\S]*?)^\\}`, 'm'));
  if (!bloque) return null;
  return bloque[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'));
}

describe('Los enumerados declarados coinciden con el esquema', () => {
  for (const nombre of Object.keys(ENUMERADOS)) {
    it(`${nombre} coincide con schema.prisma`, () => {
      const enElEsquema = delEsquema(nombre);

      expect(enElEsquema).not.toBeNull();
      expect([...ENUMERADOS[nombre]].sort()).toEqual([...enElEsquema].sort());
    });
  }
});

describe('validarEnum', () => {
  it('Acepta un valor de la lista', () => {
    expect(validarEnum('EstadoAudiencia', 'CANCELADA').valido).toBe(true);
  });

  it('Rechaza uno que no está, y dice cuáles valen', () => {
    const r = validarEnum('EstadoAudiencia', 'INVENTADO');

    expect(r.valido).toBe(false);
    expect(r.error).toContain('PROGRAMADA');
    expect(r.error).toContain('REALIZADA');
    expect(r.error).toContain('CANCELADA');
  });

  it('Admite la ausencia: casi todos estos campos son opcionales', () => {
    // Actualizar una audiencia sin tocar su estado es legítimo. Quien lo
    // necesite obligatorio lo comprueba aparte.
    for (const nada of [undefined, null, '']) {
      expect(validarEnum('EstadoAudiencia', nada).valido).toBe(true);
    }
  });

  it('El mensaje está en castellano y nombra el campo como lo ve el usuario', () => {
    // «CategoriaDocumento inválido» no le dice nada a quien usa la plataforma.
    expect(validarEnum('CategoriaDocumento', 'X').error).toMatch(/categoría del documento/i);
  });

  it('Un enumerado sin lista declarada es un error de programación, no del usuario', () => {
    // Devolver «válido» sin mirar sería justo el fallo que este archivo evita.
    expect(() => validarEnum('NoExiste', 'algo')).toThrow(/No hay lista declarada/);
  });
});

describe('Ningún enumerado del esquema se queda fuera sin querer', () => {
  it('Los que faltan son solo los que no llegan nunca del cliente', () => {
    // Estos tres no se reciben en ninguna petición: los fija el sistema.
    // Se declaran aquí para que añadir uno nuevo obligue a decidir a
    // conciencia si se valida o no, en vez de olvidarlo.
    const NO_LLEGAN_DEL_CLIENTE = ['RolUsuario', 'ModuloPermiso', 'TipoTenant', 'PlanTenant'];

    const todos = [...esquema.matchAll(/^enum (\w+) \{/gm)].map((m) => m[1]);
    const sinDeclarar = todos.filter(
      (e) => !ENUMERADOS[e] && !NO_LLEGAN_DEL_CLIENTE.includes(e)
    );

    expect(sinDeclarar).toEqual([]);
  });
});
