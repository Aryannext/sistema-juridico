-- CreateTable
CREATE TABLE "admin_plataforma" (
    "id_admin" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_acceso" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_plataforma_pkey" PRIMARY KEY ("id_admin")
);

-- CreateTable
CREATE TABLE "bitacora_plataforma" (
    "id_registro" UUID NOT NULL,
    "id_admin" UUID NOT NULL,
    "accion" VARCHAR(60) NOT NULL,
    "tenant_id" UUID,
    "tenant_nombre" VARCHAR(150) NOT NULL,
    "justificacion" TEXT,
    "ip_address" VARCHAR(60),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bitacora_plataforma_pkey" PRIMARY KEY ("id_registro")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_plataforma_email_key" ON "admin_plataforma"("email");

-- CreateIndex
CREATE INDEX "bitacora_plataforma_created_at_idx" ON "bitacora_plataforma"("created_at");

-- AddForeignKey
ALTER TABLE "bitacora_plataforma" ADD CONSTRAINT "bitacora_plataforma_id_admin_fkey" FOREIGN KEY ("id_admin") REFERENCES "admin_plataforma"("id_admin") ON DELETE RESTRICT ON UPDATE CASCADE;

