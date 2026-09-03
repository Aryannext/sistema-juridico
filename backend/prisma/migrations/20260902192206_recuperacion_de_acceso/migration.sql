-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "token_recuperacion" VARCHAR(100),
ADD COLUMN     "token_recuperacion_expira" TIMESTAMP(3),
ADD COLUMN     "token_verificacion_expira" TIMESTAMP(3);

