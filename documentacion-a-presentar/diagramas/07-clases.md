# 07 — Diagrama de clases

**Qué responde:** las entidades del dominio con sus atributos y **su comportamiento** — lo que
cada una sabe hacer.

> **Diferencia con el diagrama entidad–relación.** Aquel muestra cómo se *almacenan* los datos;
> este muestra qué *operaciones* existen sobre ellos. El sistema no usa clases al estilo de Java:
> son módulos con funciones. El diagrama representa la organización lógica, y cada método se
> corresponde con una función real del controlador.

---

## Dominio del expediente

```mermaid
classDiagram
    class Tenant {
        +UUID id_tenant
        +String nombre
        +TipoTenant tipo
        +Boolean activo
        +PlanTenant plan
        +suspender(justificacion)
        +reactivar()
        +actualizarPerfil(datos, logo)
    }

    class Usuario {
        +UUID id_usuario
        +String email
        +String nombre_usuario
        +RolUsuario rol
        +Boolean activo
        +Int intentos_fallidos
        +DateTime bloqueado_hasta
        +CanalNotificacion preferencia_canal
        +autenticar(password) Token
        +bloquearPorIntentos()
        +restablecerPassword(token, nueva)
        +tienePermiso(modulo, accion) Boolean
        +canalesDeAviso() ~correo, plataforma o ambos~
        +prioridadPara(evento) Prioridad ~lo critico manda~
    }

    class Cliente {
        +UUID id_cliente
        +TipoCliente tipo
        +String numero_documento
        +registrar()
        +habilitarPortal() ~envía enlace, no fija clave~
        +listarProcesos() Proceso[]
    }

    class Proceso {
        +UUID id_proceso
        +String numero_radicado
        +EstadoProceso estado
        +UUID id_abogado_resp
        +crear()
        +cambiarEstado(nuevo, justificacion, forzar)
        +cambiarResponsable(abogado, justificacion)
        +asignarIntegrante(usuario, rol)
        +estaIncompleto() Boolean
        +eliminarDefinitivamente(justificacion)
    }

    class ParteProcesal {
        +UUID id_parte
        +TipoParte tipo
        +String nombre
        +String documento
        +registrar()
        +eliminar()
    }

    class PermisoRol {
        +ModuloPermiso modulo
        +Boolean leer
        +Boolean crear
        +Boolean editar
        +Boolean eliminar
        +conceder(modulo, acciones)
        +permite(accion) Boolean
    }

    class Actuacion {
        +UUID id_actuacion
        +Date fecha_actuacion
        +DateTime fecha_registro
        +TipoActuacion tipo
        +String anotacion
        +registrar()
        +corregir(datos)
        +eliminar() ~solo Administrador~
        +terminosQueOrigino() Termino[]
    }

    Tenant "1" --> "*" Usuario
    Tenant "1" --> "*" Cliente
    Usuario "1" --> "*" PermisoRol
    Cliente "1" --> "*" Proceso
    Usuario "1" --> "*" Proceso : responsable
    Usuario "*" -- "*" Proceso : equipo de trabajo
    Proceso "1" --> "*" ParteProcesal
    Proceso "1" --> "*" Actuacion

    note for Proceso "El responsable es UNA relación (id_abogado_resp).<br/>El equipo es OTRA (proceso_abogados).<br/>Quitar a alguien del equipo no lo quita de responsable,<br/>y al responsable no se le puede quitar del equipo: RN04."
```

> **La relación «equipo de trabajo» es de muchos a muchos y en la base de datos tiene tabla
> propia,** `proceso_abogados`, con el rol de cada integrante. No aparece aquí como clase a
> propósito: no tiene comportamiento —ninguna función opera sobre ella salvo crearla y
> borrarla—, y este diagrama muestra *qué sabe hacer cada entidad*. Se representa como lo que
> es: una asociación.

**Métodos que encierran una regla de negocio:**

| Método | Regla |
|---|---|
| `Proceso.cambiarEstado()` | No archiva con pendientes (RN05); no reabre sin Administrador (RN03) |
| `Proceso.cambiarResponsable()` | El entrante debe ser del consultorio, estar activo y ser Abogado o Administrador (RN04). Exige justificación |
| `Cliente.habilitarPortal()` | **No recibe contraseña.** Crea la cuenta sin credencial utilizable y envía al cliente un enlace para que elija la suya (RN02.3) |
| `Actuacion.eliminar()` | Solo Administrador, y bloqueado si tiene términos (RF59) |
| `Tenant.suspender()` | Corta el acceso de **todos** sus usuarios de golpe |
| `Usuario.bloquearPorIntentos()` | Bloqueo escalado: 1, 5, 15, 30 y 60 minutos |
| `PermisoRol.permite()` | Es lo que `roles.middleware.js` consulta antes de cada operación (RF03) |
| `Usuario.canalesDeAviso()` | RF47.1 — decide si el aviso sale por correo, por la plataforma o por los dos. Ante una preferencia ausente o corrupta avisa por ambos: en un sistema de plazos, equivocarse avisando de más es recuperable; callando, no |
| `Usuario.prioridadPara()` | RF48.2 — **la criticidad manda sobre la preferencia**. Un término crítico es ALTA aunque su destinatario prefiera baja, porque bajarla sería silenciarla |

---

## Plazos y avisos

```mermaid
classDiagram
    class TerminoJudicial {
        +UUID id_termino
        +UUID id_actuacion ~opcional~
        +DateTime fecha_vencimiento
        +Boolean es_critico
        +EstadoTermino estado
        +registrar(recordatorios)
        +gestionar(estado, justificacion)
        +clasificarSiEsTardio() EstadoTermino
        +estaVencido() Boolean
        +horasRestantes() Number
    }

    class Audiencia {
        +UUID id_audiencia
        +DateTime fecha_hora
        +String lugar
        +EstadoAudiencia estado
        +agendar(recordatorios)
        +reprogramar(fecha, lugar)
        +archivarSiYaPaso()
    }

    class RecordatorioTermino {
        +DateTime fecha_hora_envio
        +CanalNotificacion canal
        +DateTime fecha_envio_real
        +estaPendiente() Boolean
    }

    class RecordatorioAudiencia {
        +Int minutos_antes
        +CanalNotificacion canal
        +calcularFechaEnvio() DateTime
    }

    class Notificacion {
        +PrioridadNotificacion prioridad
        +Boolean leida
        +Boolean gestionada
        +gestionar(usuario) ~solo destinatario~
        +puedeCerrarla(usuario) Boolean
    }

    TerminoJudicial "1" --> "0..3" RecordatorioTermino
    Audiencia "1" --> "0..3" RecordatorioAudiencia
    RecordatorioTermino ..> Notificacion : genera
    RecordatorioAudiencia ..> Notificacion : genera
```

**Los dos métodos más importantes del sistema:**

`TerminoJudicial.clasificarSiEsTardio()` — Se ejecuta **en el servidor**, antes de guardar, y no
se puede evitar desde la interfaz. Si se marca *cumplido* después del vencimiento, devuelve
`CUMPLIDO_TARDIO`. Es RN07, la regla con más peso jurídico del sistema.

`Notificacion.puedeCerrarla(usuario)` — Devuelve verdadero solo si el usuario es el destinatario,
o es Administrador **y** el destinatario está inactivo. Es RN08: cerrar una alerta es afirmar
«me he ocupado de esto», y nadie puede afirmarlo por otro.

---

## Documentos

```mermaid
classDiagram
    class Documento {
        +UUID id_documento
        +CategoriaDocumento categoria
        +VisibilidadDocumento visibilidad
        +EstadoDocumento estado
        +UUID id_version_actual
        +cargar(archivo, metadatos)
        +cambiarVisibilidad(nueva)
        +cambiarEstado(nuevo) ~no reactiva~
        +eliminarLogicamente()
        +eliminarFisicamente(justificacion)
        +esVisiblePara(usuario) Boolean
    }

    class VersionDocumento {
        +Int numero_version
        +String url_archivo
        +Int tamano_bytes
        +String formato
        +subir(archivo)
        +generarEnlaceDescarga() URL ~temporal~
    }

    Documento "1" --> "*" VersionDocumento
```

`Documento.cambiarEstado()` rechaza cualquier transición hacia activo desde *reemplazado* o
*inactivo* (RN06). `esVisiblePara()` es el filtro que impide que una nota interna llegue al
portal del cliente (RF46).

---

## Auditoría — el patrón que la hace fiable

```mermaid
classDiagram
    class BitacoraAuditoria {
        +UUID id_bitacora
        +String accion
        +String modulo
        +String detalle
        +String ip_adress
        +DateTime create_at
        +registrar(accion, detalle)
        +consultar(filtros) Registro[]
        +exportar(filtros) CSV
    }

    note for BitacoraAuditoria "NO tiene actualizar().<br/>Escribe y lee; nunca modifica.<br/>Esa ausencia es RN01."

    class HistorialProceso {
        +String campo_modificado
        +String valor_anterior
        +String valor_nuevo
        +String accion
        +UUID realizado_por
        +DateTime created_at
        +registrar(campo, antes, despues)
        +delExpediente(id) Cambio[]
    }

    note for HistorialProceso "Tampoco tiene actualizar().<br/>Es la bitácora DEL EXPEDIENTE:<br/>qué cambió, de qué valor a cuál y quién."

    class BitacoraPlataforma {
        +String accion
        +String tenant_nombre ~texto, no relación~
        +String justificacion
        +registrar(accion, consultorio)
    }
```

> **Estos dos métodos existen porque durante un tiempo no existieron.** Los campos de
> preferencia estaban en la base y la pantalla los guardaba, pero **nadie los leía al avisar**:
> el envío era siempre por correo y la prioridad estaba escrita a mano en el código. Se
> corrigió el 4 de septiembre de 2026. Aparecen aquí porque un diagrama de clases que muestra
> los atributos sin el comportamiento que los usa deja creer que el dato sirve para algo por
> el mero hecho de estar guardado.
>
> **Hay tres registros y no uno, y responden a preguntas distintas.**
> `BitacoraAuditoria` responde *«¿quién hizo qué en el consultorio?»* y abarca todos los módulos.
> `HistorialProceso` responde *«¿qué le ha pasado a ESTE expediente?»* y por eso guarda el valor
> anterior y el nuevo, que es lo que permite leer un cambio de estado o un relevo de responsable
> sin reconstruirlo. `BitacoraPlataforma` responde *«¿qué se hizo con los consultorios?»* y vive
> aparte porque tiene que sobrevivir a la baja del consultorio del que habla.
>
> **La ausencia de métodos es aquí tan significativa como su presencia.** `BitacoraAuditoria`
> registra, se consulta y se exporta, pero **no se modifica**: no existe ningún `update` sobre
> ella en todo el backend. Esa ausencia **es** la implementación de RN01, porque una bitácora que
> su administrador puede alterar no sirve como prueba de nada.

> **Un borrado sí existe, y conviene saberlo antes de que lo pregunten.** Cuando el
> administrador de la plataforma da de baja un consultorio entero, la bitácora de ese
> consultorio desaparece con él —las claves foráneas son `RESTRICT`, así que no podría ser de
> otra forma—. No permite quitar una línea suelta, y el acto queda anotado en
> `BitacoraPlataforma`. Por eso esa clase guarda `tenant_nombre` como **texto y no como
> relación**: tiene que seguir teniendo sentido cuando el consultorio ya no exista.

---

## Identidad separada de la plataforma

```mermaid
classDiagram
    class AdminPlataforma {
        +UUID id_admin
        +String email
        +Boolean activo
        +autenticar(password) TokenPlataforma
        +listarConsultorios() Resumen[]
        +suspenderConsultorio(id, justificacion)
        +eliminarConsultorio(id, nombre, justificacion)
    }

    note for AdminPlataforma "SIN tenant_id.<br/>No puede abrir ningún expediente:<br/>su token es de otro tipo."
```

**Ningún método de esta clase devuelve contenido de un expediente.** `listarConsultorios()`
devuelve nombre, contacto, plan, estado y **recuentos** — cuántos usuarios, cuántos clientes,
cuántos expedientes. Nunca sus datos.

No es una limitación de la interfaz: el token de esta identidad es de tipo `PLATAFORMA` y el
middleware de los consultorios lo rechaza con 403. La separación es de sesión, no de pantalla
([ADR-012](../../docs/11-DECISIONES-ARQUITECTONICAS.md)).
