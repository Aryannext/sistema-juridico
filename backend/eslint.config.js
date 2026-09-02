const js = require('@eslint/js');
const globals = require('globals');

/**
 * Linter del backend.
 *
 * El frontend ya tenía uno; el backend no tenía ninguno, y eso permitió que
 * llegaran a producción cosas como un `console.log` con el código de doble
 * factor y variables sin usar.
 *
 * Los umbrales empiezan siendo tolerantes A PROPÓSITO. Un linter que marca
 * trescientos avisos el primer día acaba desactivado. Se aprietan a medida que
 * se reparte la lógica de los controladores (ver docs/13-CALIDAD-DE-CODIGO.md).
 */
module.exports = [
  {
    ignores: ['node_modules/**', 'generated/**', 'prisma/migrations/**'],
  },

  js.configs.recommended,

  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // `next` es obligatorio en la firma del middleware de errores de Express
      // aunque no se use: sin el cuarto parámetro, Express no lo reconoce.
      'no-unused-vars': ['error', { argsIgnorePattern: '^(next|_)' }],

      // Los datos sensibles no pueden acabar en los registros del contenedor.
      // console.error sí se permite: es cómo se reportan los fallos reales.
      'no-console': ['warn', { allow: ['error', 'warn'] }],

      // Un `async` sin `await` suele señalar una promesa olvidada, pero en los
      // middlewares de Express es idiomático declararlos `async` aunque hoy no
      // esperen nada. Aviso, no error.
      'require-await': 'warn',

      // Detecta `if (a = b)` y comparaciones que siempre dan el mismo resultado.
      'no-cond-assign': 'error',
      'eqeqeq': ['warn', 'smart'],

      // Umbral alto a propósito: hoy hay funciones de 174 líneas. Bajar a 80
      // cuando las reglas de negocio salgan de los controladores.
      'max-lines-per-function': ['warn', { max: 200, skipComments: true }],
    },
  },

  {
    // En las pruebas mandan los globales de Jest, y los console son útiles.
    files: ['src/tests/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      'no-console': 'off',
      'max-lines-per-function': 'off',
    },
  },

  {
    // Los guiones de mantenimiento existen para imprimir por pantalla.
    files: ['scripts/**/*.js', 'prisma/seed*.js'],
    rules: {
      'no-console': 'off',
      'max-lines-per-function': 'off',
    },
  },

  {
    // Registro operativo, no depuración: el arranque del servidor y el avance
    // del cron de recordatorios son la única forma de saber qué hace el
    // contenedor. `docker compose logs backend` depende de esto.
    files: ['server.js', 'src/jobs/**/*.js'],
    rules: {
      'no-console': 'off',
    },
  },
];
