-- RNF05.5 / HU-31.5 — sostener la búsqueda de expedientes por debajo de 2
-- segundos cuando la tabla crezca.
--
-- Hasta ahora respondía entre 5 y 17 ms, pero por una razón que no aguanta:
-- hay pocas filas, y recorrerlas todas es barato. No había un solo índice
-- sobre `procesos` aparte de la clave primaria y el único (tenant, radicado).
--
-- Va en su propia migración, la última de las tres, a propósito: es la única
-- que necesita una extensión de PostgreSQL. Si el usuario de base de datos del
-- despliegue no puede crearla, falla ESTA y las otras dos ya están aplicadas.

-- La búsqueda parcial de RNF05 es `ILIKE '%texto%'`, con comodín por delante.
-- Un índice B-tree no sirve para eso: ordena por prefijo, y aquí no hay
-- prefijo. pg_trgm parte el texto en trigramas y permite indexar la búsqueda
-- por dentro de la palabra, que es lo que pide el requisito ("texto parcial
-- desde 3 caracteres" — no por casualidad, tres es el tamaño del trigrama).
--
-- IF NOT EXISTS porque la extensión puede venir ya instalada en la plantilla
-- de la base de datos. Requiere privilegios de creación de extensiones.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- El listado siempre arranca filtrando por consultorio y ordena por fecha de
-- creación descendente. Sin este índice, cada página vuelve a leer y a
-- reordenar todos los expedientes del consultorio para descartar los 20 que
-- ya se enseñaron.
-- CreateIndex
CREATE INDEX "procesos_tenant_id_create_at_idx" ON "procesos"("tenant_id", "create_at" DESC);

-- Los dos filtros combinables de RNF05, cada uno anclado al consultorio.
-- CreateIndex
CREATE INDEX "procesos_tenant_id_estado_idx" ON "procesos"("tenant_id", "estado");

-- CreateIndex
CREATE INDEX "procesos_tenant_id_tipo_proceso_idx" ON "procesos"("tenant_id", "tipo_proceso");

-- Quien no es Administrador solo ve los expedientes de los que es responsable.
-- Esa clave foránea se consulta en TODA petición de ese rol y no tenía índice
-- propio; PostgreSQL no los crea solo por ser una referencia.
-- CreateIndex
CREATE INDEX "procesos_id_abogado_resp_idx" ON "procesos"("id_abogado_resp");

-- La otra mitad de esa misma condición: los expedientes en los que la persona
-- figura como equipo. La clave primaria de la tabla empieza por id_proceso, así
-- que no responde a la pregunta al revés.
-- CreateIndex
CREATE INDEX "proceso_abogados_id_usuario_idx" ON "proceso_abogados"("id_usuario");

-- El nombre del cliente se busca desde el listado de expedientes por una
-- relación, y esa relación filtra primero por consultorio.
-- CreateIndex
CREATE INDEX "clientes_tenant_id_idx" ON "clientes"("tenant_id");

-- Los cuatro campos de texto que recorre la búsqueda parcial: radicado y
-- juzgado en el expediente, nombre y razón social en el cliente, nombre en el
-- abogado responsable. Son los cinco campos de RNF05 que admiten texto libre.
-- CreateIndex
CREATE INDEX "procesos_numero_radicado_idx" ON "procesos" USING GIN ("numero_radicado" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "procesos_juzgado_idx" ON "procesos" USING GIN ("juzgado" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "clientes_nombre_idx" ON "clientes" USING GIN ("nombre" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "clientes_razon_social_idx" ON "clientes" USING GIN ("razon_social" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "usuario_nombre_idx" ON "usuario" USING GIN ("nombre" gin_trgm_ops);
