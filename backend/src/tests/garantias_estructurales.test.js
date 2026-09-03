/**
 * Propiedades que hoy se cumplen **porque no existe la forma de romperlas**.
 *
 * Dos criterios de aceptación estaban marcados como «no validados»:
 *
 *   HU-02.7 — el único Administrador no puede quitarse su propio rol.
 *   HU-08.3 — un expediente no puede quedarse sin abogado responsable (RN04).
 *
 * Ninguno necesitaba código nuevo: **ya se cumplen por construcción**. No hay
 * ningún punto del backend que modifique el rol de un usuario, y la clave del
 * responsable es obligatoria en el esquema.
 *
 * Lo que faltaba era esto: una prueba que lo fije. Una garantía que depende de
 * que nadie añada cierto código es frágil mientras nadie la vigile; en cuanto
 * alguien cree un endpoint de edición de usuarios, este archivo falla y obliga
 * a decidir a conciencia en vez de por descuido.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');

function codigoDeControladores() {
  const modulos = path.join(RAIZ, 'modules');
  const trozos = [];

  const recorrer = (dir) => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const completa = path.join(dir, entrada.name);
      if (entrada.isDirectory()) recorrer(completa);
      else if (entrada.name.endsWith('.js')) {
        trozos.push({ archivo: entrada.name, texto: fs.readFileSync(completa, 'utf8') });
      }
    }
  };

  recorrer(modulos);
  return trozos;
}

describe('HU-02.7 · Nadie puede cambiar el rol de un usuario', () => {
  it('Ningún controlador escribe el campo `rol` en una actualización', () => {
    const sospechosos = [];

    for (const { archivo, texto } of codigoDeControladores()) {
      // Se buscan actualizaciones de usuario que lleven `rol` en sus datos.
      // La creación sí lo asigna, y es correcto: crear un colaborador exige
      // decir qué rol tendrá.
      for (const m of texto.matchAll(/usuario\.update(?:Many)?\s*\(\s*\{([\s\S]{0,400}?)\}\s*\)/g)) {
        if (/\brol\s*:/.test(m[1])) sospechosos.push(archivo);
      }
    }

    expect(sospechosos).toEqual([]);
  });

  it('La creación de usuarios solo admite ABOGADO o ASISTENTE', () => {
    // El Administrador nace con el consultorio; no se crea desde el panel. Así
    // no hay forma de fabricar un segundo Administrador ni de degradar al que
    // hay, porque no existe la operación.
    const controlador = fs.readFileSync(
      path.join(RAIZ, 'modules', 'admin', 'admin.controller.js'), 'utf8');

    expect(controlador).toMatch(/\['ABOGADO',\s*'ASISTENTE'\]/);
  });

  it('El módulo de administración no expone ninguna ruta de edición de usuario', () => {
    const rutas = fs.readFileSync(
      path.join(RAIZ, 'modules', 'admin', 'admin.routes.js'), 'utf8');

    // Si algún día se añade, hay que revisar HU-02.7 antes de darla por buena.
    expect(rutas).not.toMatch(/router\.(put|patch)\(\s*['"]\/usuarios/);
    expect(rutas).not.toMatch(/router\.delete\(\s*['"]\/usuarios/);
  });
});

describe('HU-08.3 · RN04 · Un expediente nunca se queda sin responsable', () => {
  const schema = fs.readFileSync(
    path.resolve(RAIZ, '..', 'prisma', 'schema.prisma'), 'utf8');

  it('La clave del abogado responsable es obligatoria en el esquema', () => {
    // `String` sin `?`: la base misma impide que quede vacía. Es la garantía
    // más fuerte posible, porque no depende de que el código se acuerde.
    expect(schema).toMatch(/id_abogado_resp\s+String\s+@db\.Uuid/);
    expect(schema).not.toMatch(/id_abogado_resp\s+String\?/);
  });

  it('La actualización del expediente no permite cambiar el responsable', () => {
    const controlador = fs.readFileSync(
      path.join(RAIZ, 'modules', 'procesos', 'procesos.controller.js'), 'utf8');

    const update = controlador.match(/exports\.updateProceso[\s\S]*?res\.json/);
    expect(update).not.toBeNull();
    expect(update[0]).not.toMatch(/id_abogado_resp/);
  });

  it('Retirar a alguien del equipo no toca al responsable principal', () => {
    // `proceso_abogados` guarda el equipo de apoyo; el responsable vive en una
    // columna aparte del expediente. Vaciar el equipo entero deja el expediente
    // con responsable.
    const controlador = fs.readFileSync(
      path.join(RAIZ, 'modules', 'procesos', 'procesos.controller.js'), 'utf8');

    const remove = controlador.match(/exports\.removeAbogadoProceso[\s\S]*?^};/m);
    expect(remove).not.toBeNull();
    expect(remove[0]).toMatch(/procesoAbogado\.delete/);
    expect(remove[0]).not.toMatch(/proceso\.update/);
  });
});
