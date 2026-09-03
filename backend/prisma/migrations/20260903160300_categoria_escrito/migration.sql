-- RF19.1 / HU-13.2 — la séptima categoría documental que faltaba.
--
-- El enunciado enumera siete: demandas, pruebas, contratos, ESCRITOS,
-- notificaciones, providencias y otros. El enumerado tenía seis.
--
-- Añadir un valor no toca ninguna fila: los documentos ya clasificados
-- conservan su categoría. El valor se añade al final del orden del tipo en la
-- base de datos aunque en schema.prisma figure en su sitio del enunciado; ese
-- orden solo afecta a cómo ordena PostgreSQL el enumerado, no a la validez.

-- AlterEnum
ALTER TYPE "CategoriaDocumento" ADD VALUE 'ESCRITO';
