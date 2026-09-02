-- CreateEnum
CREATE TYPE "TipoTenant" AS ENUM ('CONSULTORIO', 'INDEPENDIENTE');

-- CreateEnum
CREATE TYPE "PlanTenant" AS ENUM ('BASICO', 'PRO');

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMINISTRADOR', 'ABOGADO', 'ASISTENTE', 'CLIENTE');

-- CreateEnum
CREATE TYPE "ModuloPermiso" AS ENUM ('PROCESOS', 'DOCS', 'CLIENTES', 'AUDIENCIAS', 'TERMINO', 'REPORTES', 'PORTAL');

-- CreateEnum
CREATE TYPE "TipoCliente" AS ENUM ('NATURAL', 'JURIDICA');

-- CreateEnum
CREATE TYPE "EstadoProceso" AS ENUM ('ACTIVO', 'SUSPENDIDO', 'ARCHIVADO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "RolProcesoAbogado" AS ENUM ('ABOGADO', 'ASISTENTE');

-- CreateEnum
CREATE TYPE "TipoParte" AS ENUM ('DEMANDANTE', 'DEMANDADO', 'VICTIMA', 'TERCEROS', 'CLIENTE', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoActuacion" AS ENUM ('AUTO', 'SENTENCIA', 'NOTIFICACION', 'AUDIENCIA', 'MEMORIAL', 'DEMANDA', 'CONTESTACION', 'RECURSO', 'TRASLADO', 'OTRO');

-- CreateEnum
CREATE TYPE "CategoriaDocumento" AS ENUM ('DEMANDA', 'PRUEBA', 'CONTRATO', 'NOTIFICACION', 'PROVIDENCIA', 'OTRO');

-- CreateEnum
CREATE TYPE "VisibilidadDocumento" AS ENUM ('PRIVADO', 'COMPARTIDO_CLIENTE', 'VISIBLE_COLAB');

-- CreateEnum
CREATE TYPE "EstadoDocumento" AS ENUM ('ACTIVO', 'INACTIVO', 'REEMPLAZADO');

-- CreateEnum
CREATE TYPE "EstadoAudiencia" AS ENUM ('PROGRAMADA', 'REALIZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "CanalNotificacion" AS ENUM ('PLATAFORMA', 'EMAIL', 'AMBOS');

-- CreateEnum
CREATE TYPE "EstadoTermino" AS ENUM ('PENDIENTE', 'CUMPLIDO', 'CUMPLIDO_TARDIO', 'INCUMPLIDO');

-- CreateEnum
CREATE TYPE "PrioridadNotificacion" AS ENUM ('ALTA', 'MEDIA', 'BAJA');

-- CreateTable
CREATE TABLE "tenants" (
    "id_tenant" UUID NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "tipo" "TipoTenant" NOT NULL,
    "razon_social" VARCHAR(200),
    "nit" VARCHAR(20),
    "email_admin" VARCHAR(150) NOT NULL,
    "plan" "PlanTenant",
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "logo_url" TEXT,
    "telefono" VARCHAR(20),
    "direccion" TEXT,
    "ciudad" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horas_ocultar_notificaciones" INTEGER NOT NULL DEFAULT 48,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id_tenant")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id_usuario" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "dos_factores" BOOLEAN NOT NULL DEFAULT false,
    "intentos_fallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_hasta" TIMESTAMP(3),
    "codigo_2fa" VARCHAR(10),
    "expira_2fa" TIMESTAMP(3),
    "token_verificacion" VARCHAR(100),
    "create_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "preferencia_canal" "CanalNotificacion" NOT NULL DEFAULT 'AMBOS',
    "pref_prioridad_audiencia" "PrioridadNotificacion" NOT NULL DEFAULT 'MEDIA',
    "pref_prioridad_termino" "PrioridadNotificacion" NOT NULL DEFAULT 'ALTA',
    "pref_prioridad_tarea" "PrioridadNotificacion" NOT NULL DEFAULT 'BAJA',

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "permiso_rol" (
    "id_permiso" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "modulo" "ModuloPermiso" NOT NULL,
    "puede_leer" BOOLEAN NOT NULL DEFAULT false,
    "puede_crear" BOOLEAN NOT NULL DEFAULT false,
    "puede_editar" BOOLEAN NOT NULL DEFAULT false,
    "puede_eliminar" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "permiso_rol_pkey" PRIMARY KEY ("id_permiso")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id_cliente" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tipo" "TipoCliente" NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "razon_social" VARCHAR(150),
    "tipo_documento" VARCHAR(20) NOT NULL,
    "numero_documento" VARCHAR(30) NOT NULL,
    "nit" VARCHAR(20),
    "representante" VARCHAR(100),
    "telefono" VARCHAR(20) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "direccion" TEXT,
    "fecha_nacimiento" DATE,
    "id_usuario" UUID NOT NULL,
    "create_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id_cliente")
);

-- CreateTable
CREATE TABLE "procesos" (
    "id_proceso" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "numero_radicado" VARCHAR(50) NOT NULL,
    "juzgado" VARCHAR(150),
    "tipo_proceso" VARCHAR(100) NOT NULL,
    "clase_proceso" VARCHAR(100),
    "area_derecho" VARCHAR(100),
    "estado" "EstadoProceso" NOT NULL,
    "fecha_radicado" DATE,
    "id_cliente" UUID NOT NULL,
    "id_abogado_resp" UUID NOT NULL,
    "create_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "update_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procesos_pkey" PRIMARY KEY ("id_proceso")
);

-- CreateTable
CREATE TABLE "proceso_abogados" (
    "id" UUID NOT NULL,
    "id_proceso" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "rol_en_proceso" "RolProcesoAbogado" NOT NULL,
    "asigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proceso_abogados_pkey" PRIMARY KEY ("id_proceso","id_usuario")
);

-- CreateTable
CREATE TABLE "partes_procesales" (
    "id_procesal" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "id_proceso" UUID NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "tipo" "TipoParte" NOT NULL,
    "id_documento" VARCHAR(30),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partes_procesales_pkey" PRIMARY KEY ("id_procesal")
);

-- CreateTable
CREATE TABLE "actuaciones" (
    "id_actuacion" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "id_proceso" UUID NOT NULL,
    "fecha_actuacion" DATE NOT NULL,
    "tipo" "TipoActuacion" NOT NULL,
    "anotacion" TEXT NOT NULL,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registrado_por" UUID NOT NULL,

    CONSTRAINT "actuaciones_pkey" PRIMARY KEY ("id_actuacion")
);

-- CreateTable
CREATE TABLE "documentos" (
    "id_documento" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "id_proceso" UUID,
    "nombre" VARCHAR(200) NOT NULL,
    "categoria" "CategoriaDocumento" NOT NULL,
    "visibilidad" "VisibilidadDocumento" NOT NULL,
    "estado" "EstadoDocumento" NOT NULL,
    "id_version_actual" UUID,
    "subido_por" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id_documento")
);

-- CreateTable
CREATE TABLE "versiones_documentos" (
    "id_version" UUID NOT NULL,
    "id_documento" UUID NOT NULL,
    "numero_version" INTEGER NOT NULL,
    "url_archivo" TEXT NOT NULL,
    "nombre_archivo" VARCHAR(255) NOT NULL,
    "tamano_bytes" INTEGER NOT NULL,
    "formato" VARCHAR(10) NOT NULL,
    "subido_por" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "versiones_documentos_pkey" PRIMARY KEY ("id_version")
);

-- CreateTable
CREATE TABLE "audiencias" (
    "id_audiencia" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "id_proceso" UUID NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "tipo" VARCHAR(100) NOT NULL,
    "fecha_hora" TIMESTAMP(3) NOT NULL,
    "lugar" VARCHAR(200) NOT NULL,
    "estado" "EstadoAudiencia" NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audiencias_pkey" PRIMARY KEY ("id_audiencia")
);

-- CreateTable
CREATE TABLE "recordatorios_audiencia" (
    "id_recordatorio" UUID NOT NULL,
    "id_audiencia" UUID NOT NULL,
    "minutos_antes" INTEGER NOT NULL,
    "canal" "CanalNotificacion" NOT NULL,
    "enviado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_envio" TIMESTAMP(3),

    CONSTRAINT "recordatorios_audiencia_pkey" PRIMARY KEY ("id_recordatorio")
);

-- CreateTable
CREATE TABLE "terminos_judiciales" (
    "id_termino" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "id_proceso" UUID NOT NULL,
    "id_actuacion" UUID,
    "nombre" VARCHAR(150) NOT NULL,
    "fecha_vencimiento" TIMESTAMP(3) NOT NULL,
    "es_critico" BOOLEAN NOT NULL DEFAULT false,
    "estado" "EstadoTermino" NOT NULL,
    "gestionado_por" UUID,
    "fecha_gestion" TIMESTAMP(3),
    "justificacion" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terminos_judiciales_pkey" PRIMARY KEY ("id_termino")
);

-- CreateTable
CREATE TABLE "recordatorios_termino" (
    "id_recordatorio" UUID NOT NULL,
    "id_termino" UUID NOT NULL,
    "fecha_hora_envio" TIMESTAMP(3) NOT NULL,
    "canal" "CanalNotificacion" NOT NULL,
    "enviado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_envio_real" TIMESTAMP(3),

    CONSTRAINT "recordatorios_termino_pkey" PRIMARY KEY ("id_recordatorio")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id_notificacion" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "mensaje" TEXT NOT NULL,
    "prioridad" "PrioridadNotificacion" NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "gestionada" BOOLEAN NOT NULL DEFAULT false,
    "referencia_tipo" VARCHAR(50),
    "id_referencia" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id_notificacion")
);

-- CreateTable
CREATE TABLE "bitacora_auditoria" (
    "id_bitacora" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "accion" VARCHAR(100) NOT NULL,
    "modulo" VARCHAR(50) NOT NULL,
    "detalle" TEXT NOT NULL,
    "ip_adress" VARCHAR(45) NOT NULL,
    "create_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bitacora_auditoria_pkey" PRIMARY KEY ("id_bitacora")
);

-- CreateTable
CREATE TABLE "historial_proceso" (
    "id_historial" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "id_proceso" UUID NOT NULL,
    "campo_modificado" VARCHAR(100) NOT NULL,
    "valor_anterior" TEXT,
    "valor_nuevo" TEXT,
    "accion" VARCHAR(100) NOT NULL,
    "realizado_por" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_proceso_pkey" PRIMARY KEY ("id_historial")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_numero_documento_key" ON "clientes"("numero_documento");

-- CreateIndex
CREATE UNIQUE INDEX "procesos_numero_radicado_key" ON "procesos"("numero_radicado");

-- CreateIndex
CREATE INDEX "actuaciones_tenant_id_id_proceso_idx" ON "actuaciones"("tenant_id", "id_proceso");

-- CreateIndex
CREATE INDEX "actuaciones_id_proceso_fecha_actuacion_idx" ON "actuaciones"("id_proceso", "fecha_actuacion");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id_tenant") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permiso_rol" ADD CONSTRAINT "permiso_rol_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id_tenant") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procesos" ADD CONSTRAINT "procesos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id_tenant") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procesos" ADD CONSTRAINT "procesos_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "clientes"("id_cliente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procesos" ADD CONSTRAINT "procesos_id_abogado_resp_fkey" FOREIGN KEY ("id_abogado_resp") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proceso_abogados" ADD CONSTRAINT "proceso_abogados_id_proceso_fkey" FOREIGN KEY ("id_proceso") REFERENCES "procesos"("id_proceso") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proceso_abogados" ADD CONSTRAINT "proceso_abogados_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partes_procesales" ADD CONSTRAINT "partes_procesales_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id_tenant") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partes_procesales" ADD CONSTRAINT "partes_procesales_id_proceso_fkey" FOREIGN KEY ("id_proceso") REFERENCES "procesos"("id_proceso") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actuaciones" ADD CONSTRAINT "actuaciones_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id_tenant") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actuaciones" ADD CONSTRAINT "actuaciones_id_proceso_fkey" FOREIGN KEY ("id_proceso") REFERENCES "procesos"("id_proceso") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actuaciones" ADD CONSTRAINT "actuaciones_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id_tenant") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_id_proceso_fkey" FOREIGN KEY ("id_proceso") REFERENCES "procesos"("id_proceso") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_subido_por_fkey" FOREIGN KEY ("subido_por") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_id_version_actual_fkey" FOREIGN KEY ("id_version_actual") REFERENCES "versiones_documentos"("id_version") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versiones_documentos" ADD CONSTRAINT "versiones_documentos_id_documento_fkey" FOREIGN KEY ("id_documento") REFERENCES "documentos"("id_documento") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versiones_documentos" ADD CONSTRAINT "versiones_documentos_subido_por_fkey" FOREIGN KEY ("subido_por") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audiencias" ADD CONSTRAINT "audiencias_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id_tenant") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audiencias" ADD CONSTRAINT "audiencias_id_proceso_fkey" FOREIGN KEY ("id_proceso") REFERENCES "procesos"("id_proceso") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audiencias" ADD CONSTRAINT "audiencias_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recordatorios_audiencia" ADD CONSTRAINT "recordatorios_audiencia_id_audiencia_fkey" FOREIGN KEY ("id_audiencia") REFERENCES "audiencias"("id_audiencia") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terminos_judiciales" ADD CONSTRAINT "terminos_judiciales_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id_tenant") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terminos_judiciales" ADD CONSTRAINT "terminos_judiciales_id_proceso_fkey" FOREIGN KEY ("id_proceso") REFERENCES "procesos"("id_proceso") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terminos_judiciales" ADD CONSTRAINT "terminos_judiciales_id_actuacion_fkey" FOREIGN KEY ("id_actuacion") REFERENCES "actuaciones"("id_actuacion") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terminos_judiciales" ADD CONSTRAINT "terminos_judiciales_gestionado_por_fkey" FOREIGN KEY ("gestionado_por") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terminos_judiciales" ADD CONSTRAINT "terminos_judiciales_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recordatorios_termino" ADD CONSTRAINT "recordatorios_termino_id_termino_fkey" FOREIGN KEY ("id_termino") REFERENCES "terminos_judiciales"("id_termino") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id_tenant") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitacora_auditoria" ADD CONSTRAINT "bitacora_auditoria_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id_tenant") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitacora_auditoria" ADD CONSTRAINT "bitacora_auditoria_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_proceso" ADD CONSTRAINT "historial_proceso_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id_tenant") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_proceso" ADD CONSTRAINT "historial_proceso_id_proceso_fkey" FOREIGN KEY ("id_proceso") REFERENCES "procesos"("id_proceso") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_proceso" ADD CONSTRAINT "historial_proceso_realizado_por_fkey" FOREIGN KEY ("realizado_por") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
