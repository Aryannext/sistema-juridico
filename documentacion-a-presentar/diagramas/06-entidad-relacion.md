# 06 — Entidad–relación

**Qué responde:** cómo se guardan los datos y cómo se relacionan las entidades entre sí.

Derivado de `backend/prisma/schema.prisma`, no de un diseño previo. **19 entidades.**

---

## Núcleo: el consultorio y el expediente

```mermaid
erDiagram
    TENANT ||--o{ USUARIO : "tiene"
    TENANT ||--o{ CLIENTE : "tiene"
    TENANT ||--o{ PROCESO : "tiene"

    USUARIO ||--o{ PERMISO_ROL : "posee"
    USUARIO ||--o{ CLIENTE : "registra"
    CLIENTE ||--o{ PROCESO : "es titular de"
    USUARIO ||--o{ PROCESO : "es responsable de"

    PROCESO ||--o{ PROCESO_ABOGADO : "tiene equipo"
    USUARIO ||--o{ PROCESO_ABOGADO : "participa en"
    PROCESO ||--o{ PARTE_PROCESAL : "tiene partes"
    PROCESO ||--o{ HISTORIAL_PROCESO : "registra cambios"

    TENANT {
        uuid id_tenant PK
        varchar nombre
        enum tipo "CONSULTORIO | INDEPENDIENTE"
        boolean activo "corta el acceso de todos sus usuarios"
        enum plan "BASICO | PRO"
    }

    USUARIO {
        uuid id_usuario PK
        uuid tenant_id FK
        varchar email UK "único GLOBAL: es la credencial"
        enum rol "ADMINISTRADOR | ABOGADO | ASISTENTE | CLIENTE"
        boolean activo
        int intentos_fallidos
        timestamp bloqueado_hasta
    }

    CLIENTE {
        uuid id_cliente PK
        uuid tenant_id FK
        enum tipo "NATURAL | JURIDICA"
        varchar numero_documento "único POR CONSULTORIO"
    }

    PROCESO {
        uuid id_proceso PK
        uuid tenant_id FK
        varchar numero_radicado "único POR CONSULTORIO"
        enum estado "ACTIVO | SUSPENDIDO | ARCHIVADO | FINALIZADO"
        uuid id_cliente FK
        uuid id_abogado_resp FK
    }
```

---

## El contenido del expediente

```mermaid
erDiagram
    PROCESO ||--o{ ACTUACION : "registra"
    PROCESO ||--o{ DOCUMENTO : "contiene"
    PROCESO ||--o{ AUDIENCIA : "agenda"
    PROCESO ||--o{ TERMINO_JUDICIAL : "vigila"

    ACTUACION ||--o{ TERMINO_JUDICIAL : "origina (opcional)"

    DOCUMENTO ||--o{ VERSION_DOCUMENTO : "versiona"
    AUDIENCIA ||--o{ RECORDATORIO_AUDIENCIA : "avisa con"
    TERMINO_JUDICIAL ||--o{ RECORDATORIO_TERMINO : "avisa con"

    ACTUACION {
        uuid id_actuacion PK
        date fecha_actuacion "cuándo OCURRIÓ en el juzgado"
        timestamp fecha_registro "cuándo se DIGITÓ"
        enum tipo "catálogo cerrado de 10"
        text anotacion
    }

    TERMINO_JUDICIAL {
        uuid id_termino PK
        uuid id_actuacion FK "OPCIONAL: de qué auto nace"
        timestamp fecha_vencimiento
        boolean es_critico "alerta también al Administrador"
        enum estado "PENDIENTE | CUMPLIDO | CUMPLIDO_TARDIO | INCUMPLIDO"
        text justificacion
    }

    DOCUMENTO {
        uuid id_documento PK
        uuid id_proceso FK "OPCIONAL: hay documentos generales"
        enum categoria
        enum visibilidad "PRIVADO | COMPARTIDO_CLIENTE | COLABORADORES"
        enum estado "ACTIVO | REEMPLAZADO | INACTIVO"
        uuid id_version_actual FK
    }

    AUDIENCIA {
        uuid id_audiencia PK
        timestamp fecha_hora
        varchar lugar
        enum estado "PROGRAMADA | REALIZADA | CANCELADA | REPROGRAMADA"
    }

    RECORDATORIO_AUDIENCIA {
        int minutos_antes "RELATIVO: reprogramar recalcula solo"
        timestamp fecha_envio
    }

    RECORDATORIO_TERMINO {
        timestamp fecha_hora_envio "ABSOLUTO"
        timestamp fecha_envio_real
    }
```

**Dos detalles que se preguntan:**

Las **dos claves foráneas opcionales** no son descuidos. `TERMINO.id_actuacion` es opcional
porque un plazo puede registrarse suelto (RF32); `DOCUMENTO.id_proceso` lo es porque existen
documentos generales del despacho (RF21).

Los **dos tipos de recordatorio se modelan distinto**. El de audiencia guarda *minutos antes*,
así que reprogramar recalcula los avisos solo. El de término guarda la *fecha y hora exacta* de
envío, porque un plazo no se mueve.

---

## Alertas y rastro

```mermaid
erDiagram
    TENANT ||--o{ NOTIFICACION : "genera"
    USUARIO ||--o{ NOTIFICACION : "recibe"
    TENANT ||--o{ BITACORA_AUDITORIA : "acumula"
    USUARIO ||--o{ BITACORA_AUDITORIA : "protagoniza"

    NOTIFICACION {
        uuid id_notificacion PK
        enum prioridad "ALTA | MEDIA | BAJA"
        boolean leida "la vio"
        boolean gestionada "se ocupó de ella"
        uuid id_referencia "a qué término o audiencia apunta"
    }

    BITACORA_AUDITORIA {
        uuid id_bitacora PK
        varchar accion
        varchar modulo
        text detalle "en lenguaje llano, no rutas de la API"
        varchar ip_adress "la IP REAL del cliente"
        timestamp create_at
    }
```

> **`leida` y `gestionada` son campos distintos a propósito.** Ver una alerta no es haberse
> ocupado de ella. Una alerta crítica permanece hasta que alguien la marca como gestionada, y
> solo puede hacerlo su destinatario (RN08).

---

## Administración de la plataforma — aislada del resto

```mermaid
erDiagram
    ADMIN_PLATAFORMA ||--o{ BITACORA_PLATAFORMA : "registra"

    ADMIN_PLATAFORMA {
        uuid id_admin PK
        varchar email UK
        varchar password_hash
        boolean activo
        timestamp ultimo_acceso
    }

    BITACORA_PLATAFORMA {
        uuid id_registro PK
        varchar accion "SUSPENDER | REACTIVAR | ELIMINAR"
        uuid tenant_id "sin clave foránea, a propósito"
        varchar tenant_nombre "TEXTO: sobrevive al borrado"
        text justificacion
    }
```

**Estas dos entidades no tienen ninguna relación con `TENANT`.** No es un olvido del diagrama:

- `ADMIN_PLATAFORMA` **no tiene `tenant_id`** porque no pertenece a ningún consultorio.
- `BITACORA_PLATAFORMA` guarda el nombre del consultorio como **texto y no como clave foránea**,
  porque tiene que seguir teniendo sentido cuando el consultorio ya no exista. Si fuera una
  relación, el registro de «quién eliminó este consultorio» desaparecería junto con él.

---

## La asimetría de las claves únicas

| Campo | Alcance | Por qué |
|---|---|---|
| `USUARIO.email` | **Global** | Es la credencial y el login no tiene selector de consultorio. Si se repitiera, el sistema no sabría a quién autenticar |
| `CLIENTE.numero_documento` | **Por consultorio** | Una persona puede ser cliente de dos despachos |
| `PROCESO.numero_radicado` | **Por consultorio** | **La contraparte litiga el mismo proceso con el mismo radicado** desde otro despacho |

Los dos últimos eran globales hasta el 2 de septiembre de 2026. Además de impedir usos
legítimos, el mensaje *«ese radicado ya existe en el sistema»* revelaba que otro consultorio
llevaba ese caso.

---

## Integridad referencial

**Ninguna clave foránea borra en cascada.** Todas son `ON DELETE RESTRICT`.

Es deliberado: en un sistema jurídico, un borrado que arrastra registros en silencio es
peligroso. Eliminar un expediente se hace explícitamente, dentro de una transacción y en orden,
de las hojas hacia la raíz:

```
recordatorios → versiones → notificaciones → historial → bitácora
   → partes → términos → actuaciones → audiencias → documentos
      → proceso
```

> Esa decisión tuvo un coste real: al añadir `ACTUACION` se olvidó incluirla en la transacción, y
> eliminar un expediente con actuaciones empezó a fallar con un error opaco. Hoy hay una prueba
> que vigila que la cascada las contemple.
