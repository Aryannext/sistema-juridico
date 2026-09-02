-- DropIndex
DROP INDEX "clientes_numero_documento_key";

-- DropIndex
DROP INDEX "procesos_numero_radicado_key";

-- CreateIndex
CREATE UNIQUE INDEX "clientes_tenant_id_numero_documento_key" ON "clientes"("tenant_id", "numero_documento");

-- CreateIndex
CREATE UNIQUE INDEX "procesos_tenant_id_numero_radicado_key" ON "procesos"("tenant_id", "numero_radicado");

