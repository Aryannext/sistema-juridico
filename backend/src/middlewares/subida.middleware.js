const multer = require('multer');

/**
 * Traduce los errores de subida de archivos a mensajes que el usuario entienda.
 *
 * El problema que resuelve: multer valida el tamaño y el formato en su propio
 * middleware, ANTES de que la petición llegue al controlador. Cuando rechaza un
 * archivo lanza el error ahí mismo, así que el `try/catch` del controlador —que
 * intentaba responder "Formato de archivo no soportado"— nunca llegaba a
 * ejecutarse. El error caía en el manejador genérico de Express y el usuario
 * recibía un 500 con «Algo salió mal!».
 *
 * Reproducido: subir un logotipo de 3 MB o en formato .webp devolvía
 * exactamente eso, sin ninguna pista de qué corregir.
 *
 * Se coloca INMEDIATAMENTE DESPUÉS del middleware de multer en cada ruta, que
 * es donde Express entrega los errores de la etapa anterior.
 *
 * @param {{maxMb: number, formatos: string}} opciones Se usan para redactar el
 *   mensaje: solo aquí se conocen los límites de esa ruta concreta.
 */
function manejarErroresDeSubida({ maxMb, formatos }) {
  // La firma de cuatro argumentos es obligatoria: sin ella Express no lo
  // reconoce como manejador de errores y lo trata como middleware normal.
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: `El archivo supera el tamaño máximo de ${maxMb} MB. Comprímelo o elige uno más liviano.`,
          codigo: 'ARCHIVO_DEMASIADO_GRANDE',
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          error: 'Se envió un archivo en un campo que no se esperaba.',
          codigo: 'CAMPO_INESPERADO',
        });
      }
      return res.status(400).json({ error: `No se pudo procesar el archivo: ${err.message}` });
    }

    // El error que lanza el `fileFilter` no es un MulterError, sino uno normal.
    if (err && /formato de archivo/i.test(err.message || '')) {
      return res.status(400).json({
        error: `${err.message} Formatos admitidos: ${formatos}.`,
        codigo: 'FORMATO_NO_ADMITIDO',
      });
    }

    return next(err);
  };
}

module.exports = { manejarErroresDeSubida };
