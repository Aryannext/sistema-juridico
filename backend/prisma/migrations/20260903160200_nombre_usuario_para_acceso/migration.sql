-- RF01.2 / HU-01.1 — entrar con nombre de usuario, no solo con correo.
--
-- La columna admite nulo a propósito: las cuentas que ya existen no tienen
-- ninguno, y el correo sigue siendo el identificador obligatorio. Nulo
-- significa "esta cuenta solo entra por correo", no "falta un dato".

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN "nombre_usuario" VARCHAR(30);

-- Relleno de las cuentas existentes a partir de la parte local de su correo,
-- para que la funcionalidad sirva desde el primer día y no solo para quien se
-- registre a partir de ahora.
--
-- Se salta dos casos, y en ambos la cuenta se queda en nulo:
--
--   1. La parte local no encaja en el formato admitido (acentos, símbolos,
--      menos de 3 caracteres). No se "arregla" recortándola: un identificador
--      de acceso inventado por una migración es peor que no tener ninguno.
--   2. Dos correos comparten parte local en oficinas distintas
--      (ana@bufete-a.com y ana@bufete-b.com). El nombre de usuario es único en
--      todo el sistema, así que no hay forma de repartirlo sin elegir a una de
--      las dos, y esa no es una decisión que deba tomar una migración.
--
-- Quien quede en nulo puede reclamar el suyo desde su perfil.
UPDATE "usuario" u
SET "nombre_usuario" = lower(split_part(u."email", '@', 1))
WHERE lower(split_part(u."email", '@', 1)) ~ '^[a-z0-9._-]{3,30}$'
  AND NOT EXISTS (
    SELECT 1 FROM "usuario" o
    WHERE o."id_usuario" <> u."id_usuario"
      AND lower(split_part(o."email", '@', 1)) = lower(split_part(u."email", '@', 1))
  );

-- Único en TODO el sistema, igual que el correo: el login resuelve la cuenta
-- antes de saber a qué consultorio pertenece. Si el relleno de arriba hubiera
-- generado un duplicado, esta línea falla y la migración entera se deshace.
-- CreateIndex
CREATE UNIQUE INDEX "usuario_nombre_usuario_key" ON "usuario"("nombre_usuario");
