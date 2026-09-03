# 11 — Decisiones de arquitectura (ADR)

Un **ADR** (*Architecture Decision Record*) deja por escrito una decisión estructural: qué se
decidió, en qué contexto, qué alternativas se descartaron y qué consecuencias tiene.

Estos doce ADR **documentan decisiones que ya están tomadas y materializadas en el código**.
No son propuestas: son la reconstrucción explícita del razonamiento que la documentación
anterior nunca escribió. Ese vacío es, precisamente, la causa de que hoy nadie sepa si el
sistema es MVC o monolítico.

**Estado de todos:** `Aceptado` · **Fecha de formalización:** 1 de septiembre de 2026

---

## ADR-001 — Monolito modular, no microservicios

### Contexto
`README.md` y `docs/historico/arquitectura.md` describen el sistema como *"microservicios lógicos
(modular)"*. El código muestra un único proceso Node.js con una sola base de datos y un solo
despliegue. La contradicción hace que ningún lector sepa qué esperar.

### Decisión
El SGPA es un **monolito modular**: un proceso de backend, organizado internamente por dominio
de negocio (`src/modules/<dominio>/`), con capas dentro de cada módulo
(Router → Middlewares → Controlador → ORM). Se abandona el término "microservicios".

### Alternativas descartadas
- **Microservicios reales.** Exigiría separar despliegues, comunicación entre procesos y
  probablemente bases de datos independientes. Para un sistema de 51 endpoints con un equipo
  pequeño, multiplicaría la complejidad operativa sin resolver ningún problema existente.
- **Monolito por capas técnicas** (`controllers/`, `routes/`, `services/`). Es la estructura
  más común en tutoriales de Express, pero dispersa cada funcionalidad entre carpetas.

### Consecuencias
- ✅ Un desarrollador nuevo entiende "expedientes" abriendo dos archivos contiguos.
- ✅ Despliegue trivial: un `npm start`.
- ⚠️ El escalado es vertical o por réplicas completas, no por módulo.
- ⚠️ El planificador de tareas vive dentro del proceso (ver ADR-007).

---

## ADR-002 — `sistema.docx` es la especificación única

### Contexto
Existen dos numeraciones RF incompatibles: `sistema.docx` (RF01–RF54) e `investigacion.docx`
(RF01–RF09). `RF01` significa "inicio de sesión" en una y "registro del proceso" en la otra.
Cualquier matriz de trazabilidad que las mezcle es inválida (hallazgo H-10).

### Decisión
`sistema.docx` es **la especificación funcional vigente**. `investigacion.docx` se reclasifica
como **investigación de dominio y benchmark**; su numeración RF se retira de circulación.

### Justificación
El sistema construido implementa el alcance de `sistema.docx`: multi-tenant, cuatro roles,
portal del cliente con descargas, Cloudflare R2, `node-cron` dentro del proceso.
`investigacion.docx` describe un MVP distinto: Next.js con TypeScript, VPS con disco local
cifrado, tres roles, crontab del sistema y **sin descarga de documentos en el portal**.
Es una fase previa de exploración, no la especificación de lo que se construyó.

### Consecuencias
- ✅ Una sola numeración RF; la trazabilidad del doc 05 es válida.
- ✅ El contenido valioso de la investigación —glosario jurídico, anatomía del radicado,
  matriz de supuestos, declaración de método— se rescata en el doc 07.
- ⚠️ Cualquier referencia previa a "RF04" en el sentido de *vigilancia de términos* queda
  obsoleta y debe reescribirse.

---

## ADR-003 — Multi-tenancy por columna discriminadora, aplicada en la aplicación

### Contexto
Cada consultorio necesita aislamiento total de sus datos (RF52, RNF11).

### Decisión
Una sola base de datos, un solo esquema, columna `tenant_id` en cada tabla de negocio.
El aislamiento se impone en el código: `auth.middleware.js` inyecta `req.tenant_id` y cada
consulta lo incluye en su `where`.

**Decisión complementaria:** `Usuario.email` se mantiene **único globalmente**, mientras que
`Cliente.numero_documento` y `Proceso.numero_radicado` deben pasar a ser únicos **por tenant**
(corrección pendiente, Ola 3 del doc 10).

> **Aplicado el 2 de septiembre de 2026** — migración `unicidad_por_consultorio`. El texto de
> arriba se conserva tal cual porque un ADR no se reescribe; esta nota registra que la
> corrección que anticipaba ya está hecha. Ver [doc 14, D-04](14-AUDITORIA-DE-DEFECTOS.md).

### Justificación de la asimetría
El correo es la credencial de inicio de sesión y el formulario de login **no tiene selector de
consultorio**. Si dos tenants pudieran registrar el mismo correo, `POST /login` no sabría a qué
cuenta autenticar. El documento de identidad y el radicado, en cambio, **son naturalmente
compartidos entre despachos**: dos consultorios pueden representar a la misma persona, y dos
despachos pueden litigar lados opuestos del mismo proceso. Que hoy sean únicos globalmente es
un defecto, no una decisión.

### Alternativas descartadas
- **Un esquema PostgreSQL por tenant.** Aislamiento más fuerte, pero las migraciones se
  multiplican por el número de consultorios y Prisma no lo soporta con comodidad.
- **Row Level Security de PostgreSQL.** Es la opción técnicamente superior: el aislamiento
  dejaría de depender de que ningún desarrollador olvide un `where`. Se descarta **por ahora**
  porque exige que la conexión propague el `tenant_id` como variable de sesión, lo cual se
  complica con PgBouncer en modo *transaction pooling*. **Queda anotado como mejora futura.**

### Consecuencias
- ✅ Simple, y verificado: 118 usos de `tenant_id` en los 11 controladores.
- ⚠️ **El aislamiento depende de la disciplina del programador.** Un controlador nuevo que
  olvide el filtro expone datos entre tenants sin que nada lo impida.
- ⚠️ Por eso la prueba de aislamiento (Ola 5.1) es la más importante del plan de pruebas.

---

## ADR-004 — `ASISTENTE` en la base de datos, "Colaborador" en la interfaz

### Contexto
Los requisitos llaman al tercer rol **Colaborador**; el enum de la base de datos lo llama
`ASISTENTE`. El `Reporte_Coherencia_SGPA.md` recomendó unificar todo bajo "Colaborador"; la
recomendación nunca se aplicó (hallazgo H-09).

### Decisión
Conservar `ASISTENTE` como identificador técnico (enum, JWT, comprobaciones de rol) y usar
**"Colaborador"** como etiqueta visible en la interfaz y en la documentación de negocio.

### Justificación
Renombrar el enum exige `ALTER TYPE` sobre una columna en uso, en dos enumeraciones
(`RolUsuario` y `RolProcesoAbogado`), más cambios coordinados en el frontend (`App.jsx:78`),
en los middlewares y en los tokens ya emitidos. Todo eso para cambiar una palabra que el
usuario **nunca ve**, porque la interfaz muestra la etiqueta, no el valor del enum.

Es la separación habitual entre *término técnico* y *término de negocio*.

### Consecuencias
- ✅ Cero migración, cero riesgo.
- ⚠️ Quien lea la base de datos verá `ASISTENTE` y quien lea las historias verá "Colaborador".
  **Por eso esta equivalencia debe estar escrita** — y lo está, aquí y en los docs 00 y 02.

---

## ADR-005 — Sin capa de servicios: la lógica vive en los controladores

### Contexto
`procesos.controller.js` tiene 632 líneas y `documentos.controller.js` 608. La lógica de
negocio, las validaciones y las transacciones conviven con el manejo de `req`/`res`.

### Decisión
**Aceptar la estructura actual.** No se introduce una capa `service` en el estado presente
del proyecto.

### Justificación
Extraer servicios es una refactorización que toca los 11 módulos, con riesgo real de regresión
y **cero cambio funcional**. El proyecto tiene necesidades más urgentes y de mayor valor
(auditoría de sesión, recuperación de contraseña, aislamiento entre tenants). Además,
la cobertura de pruebas actual —15 pruebas— no es suficiente para respaldar una refactorización
de ese alcance con seguridad.

### Consecuencias
- ✅ Sin riesgo hoy.
- ⚠️ La lógica de negocio no es reutilizable fuera de una petición HTTP. Si algún día se
  necesita ejecutar "cambiar estado de proceso" desde el cron o desde un script, habrá que
  extraerla.
- ⚠️ Los controladores seguirán creciendo. **Señal para reconsiderar:** cuando un controlador
  supere las 800 líneas o cuando haya que reutilizar la misma lógica desde dos entradas
  distintas.
- 📌 **Condición previa a cualquier refactorización futura:** subir primero la cobertura de
  pruebas (Ola 5).
- 📎 Esta decisión se revisa con datos en [13-CALIDAD-DE-CODIGO.md](13-CALIDAD-DE-CODIGO.md),
  que mide el coste real de no tener capa de servicios y define en qué momento dejaría de ser
  la decisión correcta.

---

## ADR-006 — Cloudflare R2 con URLs firmadas para el almacenamiento

### Contexto
Los documentos judiciales son datos sensibles sujetos a reserva profesional. El proyecto
comenzó con Supabase Storage (`config/supabase.js`, hoy desactivado).

### Decisión
Almacenar los archivos en **Cloudflare R2** mediante el SDK de AWS S3, y entregarlos con
**URLs firmadas temporales**, nunca haciendo pasar el binario por la API.

### Justificación
- R2 no cobra por transferencia de salida, lo que importa cuando el uso principal es descargar
  expedientes.
- Las URLs firmadas cumplen el criterio de RNF01 (*"ninguna solicitud de archivo debe
  responderse sin token de sesión válido"*): la URL solo se emite tras validar sesión, rol y
  visibilidad del documento.
- El proceso Node no gasta memoria ni ancho de banda sirviendo archivos.

### Consecuencias
- ✅ Descargas rápidas y baratas; el servidor no es cuello de botella.
- ✅ Autorización verificada antes de emitir cada URL.
- ⚠️ Una URL firmada, una vez emitida, es válida hasta que expira **aunque se revoquen los
  permisos del usuario**. Mantener vigencias cortas.
- ⚠️ El cifrado en reposo lo aporta el proveedor, no la aplicación. **Debe declararse así**
  en cualquier afirmación de cumplimiento de RNF01: no hay cifrado a nivel de aplicación.

---

## ADR-007 — Tareas programadas dentro del proceso de la API

### Contexto
Los recordatorios de audiencias y términos deben enviarse sin intervención humana
(RF29, RF33). `investigacion.docx` proponía el crontab del sistema operativo.

### Decisión
Usar **`node-cron` dentro del mismo proceso Express**, arrancado desde `server.js`, con
ejecución cada 15 minutos.

### Justificación
Cero infraestructura adicional, cero configuración en el servidor, y el trabajo comparte la
instancia de Prisma y el transporte de correo ya configurados. Para un despliegue de una sola
instancia es la opción más simple que funciona.

### Consecuencias
- ✅ Despliegue de una sola pieza.
- 🔴 **Consecuencia crítica no documentada hasta ahora:** si se escalan varias instancias de la
  API, **cada una ejecutará el mismo trabajo y enviará correos duplicados**. Antes de escalar
  horizontalmente hay que introducir un bloqueo distribuido o extraer el trabajo a un proceso
  aparte.
- ⚠️ Si el proceso de la API cae, los recordatorios dejan de enviarse sin aviso.
- ⚠️ `initRecordatoriosJob` ejecuta una pasada inmediata 5 segundos después de arrancar, como
  ayuda para desarrollo. En producción, cada reinicio dispara esa pasada. Es inocua porque los
  recordatorios ya enviados se marcan como tales, pero conviene condicionarla a
  `NODE_ENV !== 'production'`.

---

## ADR-008 — El sistema registra y vigila términos; no los calcula

### Contexto
Los términos judiciales se cuentan en días hábiles, excluyendo festivos y vacancia judicial, y
sus reglas varían por tipo de proceso, actuación y sujeto (doc 07 § 5).

### Decisión
El sistema **recibe** la fecha de vencimiento digitada por el usuario. **No la calcula.**
Su función es vigilar, alertar y clasificar el cumplimiento.

### Justificación
Es la conclusión mejor sustentada de toda la investigación previa, y conviene conservarla
textualmente: *"Nadie en el mercado calcula términos. Todos registran la fecha y alertan"* —
verificado contra cinco productos comerciales colombianos.

Calcular exigiría mantener el calendario oficial de festivos y vacancias que el Consejo
Superior de la Judicatura publica cada año, más decenas de reglas por combinación de tipo de
proceso, actuación y sujeto. Y sería redundante: **la fecha de vencimiento ya viene calculada
por el secretario del juzgado** y publicada en el portal judicial.

### Consecuencias
- ✅ Alcance acotado y realista.
- ✅ Sin dependencia del calendario judicial anual.
- ⚠️ La exactitud de la alerta depende de que el usuario digite bien la fecha.
- ⚠️ Es una limitación que **debe comunicarse al usuario**: el sistema no valida la corrección
  jurídica del plazo, solo avisa de la fecha que se le indicó.

---

## ADR-009 — La documentación se sincroniza con el código, no al revés

### Contexto
Este es el ADR que da sentido a todo el conjunto. La documentación del proyecto describía un
sistema que no existía. Ante cada discrepancia había que decidir qué lado corregir.

### Decisión
**El código y el diseño visual existentes son la fuente de verdad.** Cuando un documento y el
código discrepan, se corrige el documento — **salvo** cuando el documento expresa un requisito
legítimo que el código incumple, en cuyo caso se registra como *defecto de implementación* y
se lleva al plan de remediación.

### Justificación
El sistema **funciona**: 15 pruebas en verde, compilación correcta, reglas de negocio complejas
correctamente implementadas y un diseño visual coherente y bien ejecutado. Reescribirlo para
que encaje con documentos desactualizados sería destruir trabajo válido para satisfacer papeles.

La distinción entre "el documento está desactualizado" y "el código incumple un requisito"
es lo que hace utilizable esta auditoría: de los 26 hallazgos, **15 se corrigen editando
documentos y 8 editando código**; los 3 restantes exigen una decisión humana.

### Consecuencias
- ✅ El sistema sigue funcionando durante toda la corrección documental.
- ✅ El diseño visual queda intacto — restricción explícita del encargo.
- ✅ Las brechas reales quedan identificadas, priorizadas y estimadas, no ocultas.
- ⚠️ Exige disciplina hacia adelante: **cada cambio de código que altere una decisión de estos
  ADR debe actualizar el documento correspondiente en el mismo commit.** Si eso no ocurre, en
  seis meses el proyecto estará exactamente donde estaba antes de esta auditoría.

---

## ADR-010 — Recuperar la entidad "Actuación" perdida en la reescritura de requisitos

**Fecha:** 1 de septiembre de 2026

### Contexto

El `README.md` prometía *"Dentro de un expediente podrás registrar **Actuaciones**"*, pero el
modelo de datos no tenía ninguna tabla `actuaciones`. Al rastrear el origen apareció algo más
grave que una promesa incumplida: **la entidad sí estaba diseñada y se perdió.**

`investigacion.docx` la modelaba como entidad de primer nivel, y con el término colgando de ella:

```
Actuación (RF02) | Fecha actuación, tipo actuación (FK catálogo), anotación,
                   fecha inicia término, fecha finaliza término, FK proceso
Término   (RF04) | Fecha inicio, fecha fin, FK actuación
```

Estaba planificada en el Sprint 2 de esa investigación, con catálogo cerrado de tipos derivado
de la Consulta de Procesos Nacional Unificada. **Al reescribir los requisitos a la numeración
RF01–RF54 la entidad desapareció y nadie lo notó**: en `sistema.docx` la palabra "actuación"
aparece una sola vez, en RF25, y como adjetivo.

El planteamiento del cliente lo hace exigible: el objetivo pide *"administrar el expediente
digital de cada caso"*, y el problema declarado es que *"los términos judiciales vencen por
falta de seguimiento"*. El seguimiento es una cadena —**actuación → término → alerta**— que
estaba rota en su primer eslabón: los términos existían flotando, sin el hecho procesal que
los origina, y el abogado no podía responder *"¿de dónde sale este plazo?"*.

### Decisión

Modelar la entidad `Actuacion` con catálogo cerrado de 10 tipos, exponerla en un módulo propio
del backend y darle una pestaña en la ficha del expediente. `TerminoJudicial` recibe un
`id_actuacion` **opcional** que reconstruye el vínculo original.

Formalizado como **RF55–RF59** y **HU-37**.

### Alternativas descartadas

- **Corregir el README y aceptar el alcance actual.** Era la opción honesta y de 10 minutos,
  y fue la recomendación inicial. Se descarta porque reduce el sistema a un archivador con
  fechas: sin actuaciones, el "expediente digital" no contiene la historia del caso.
- **Reutilizar `historial_proceso`.** Registra cambios que los usuarios hacen *en el sistema*,
  no hechos ocurridos *en el juzgado*. Sus fechas, su origen y su propósito son distintos.
  Mezclarlos habría contaminado la auditoría interna con datos de negocio.
- **Calcular los términos a partir de la actuación.** Descartado por coherencia con
  [ADR-008](#adr-008--el-sistema-registra-y-vigila-términos-no-los-calcula): el sistema
  registra y vigila, no calcula.

### Decisiones de diseño asociadas

| Decisión | Por qué |
|---|---|
| `TerminoJudicial.id_actuacion` es **opcional** | RF32 permite registrar términos manualmente, y ya existen términos sin actuación. Hacerlo obligatorio habría roto los datos en producción |
| El módulo **reutiliza los permisos de `PROCESOS`** | Añadir un valor a `ModuloPermiso` habría dejado sin fila de permisos a todos los usuarios existentes, y `requirePermission` les habría respondido 403. Además la actuación es parte del expediente |
| Dos fechas separadas: `fecha_actuacion` y `fecha_registro` | La primera es cuándo ocurrió en el juzgado, la segunda cuándo se digitó. Confundirlas invalida la cronología del caso |
| No se puede eliminar una actuación con términos asociados | Integridad referencial (RNF10): evita términos huérfanos de su origen |

### Consecuencias

- ✅ El `README.md` deja de prometer algo que no existía.
- ✅ La cadena actuación → término → alerta queda completa; el abogado ve, bajo cada actuación,
  los términos que nacieron de ella.
- ✅ Cubierto por 6 pruebas automatizadas (`actuaciones.test.js`).
- ✅ **Migración aplicada** el 1/09/2026 (`20260901203729_agregar_actuaciones`) sobre la base
  de desarrollo local. Verificado en ejecución: se registró una actuación, se vinculó un
  término y la ficha muestra la cadena completa.
- ⚠️ **La base de producción (Supabase) NO está migrada.** Además, como esa base se gestionó
  con `prisma db push`, `migrate deploy` fallaría allí con *relation already exists*: la
  migración generada crea el esquema completo. Ver la sección de despliegue del doc 10.
  > **Resuelto el 2 de septiembre de 2026, y de otra manera.** Supabase quedó fuera: la base de
  > producción es ahora un contenedor propio y vacío (ADR-011), de modo que `migrate deploy`
  > funcionó sin conflicto. El aviso se conserva porque describe correctamente el riesgo que
  > existía mientras la base siguió en el proveedor gestionado.
- ⚠️ El catálogo de 10 tipos proviene de una muestra de la investigación, no de un catálogo
  oficial exhaustivo del Consejo Superior de la Judicatura. Puede quedarse corto; por eso
  incluye `OTRO`. Conviene validarlo con un abogado en ejercicio (supuesto SUP-10).
- ✅ El modal «Registrar Plazo» incluye un selector opcional *«Actuación que origina el término»*,
  de modo que la cadena se puede construir íntegramente desde la interfaz.
- ✅ La UI cubre el ciclo completo: crear, consultar, **corregir y eliminar**. El botón de
  corregir aparece para el administrador y el abogado responsable (`canModify`); el de
  eliminar **solo para el administrador** (`isAdmin`), en coherencia con la regla del backend,
  para no ofrecer una acción que siempre respondería 403.
- ⚠️ Al implementar la pestaña se reprodujo un fallo de visualización de fechas preexistente
  (hallazgo H-27), ya corregido con el helper `formatFechaSinHora()`.

---

## ADR-011 — Contenedores para aislar el despliegue en un VPS compartido

**Fecha:** 1 de septiembre de 2026

### Contexto

El SGPA se despliega en un VPS **compartido con otro usuario y otra aplicación**. Ambas
dependen de un único Node.js instalado a nivel de sistema. Consecuencia observada por el
responsable del proyecto: **al actualizar Node para el SGPA, la aplicación del otro usuario
dejaba de funcionar**, porque estaba construida sobre la versión anterior.

Es un acoplamiento real: dos proyectos sin relación entre sí comparten una dependencia global,
y cualquier actualización de uno es un riesgo para el otro. Mientras siga así, cada despliegue
obliga a elegir entre quedarse atrás o romperle el servicio a alguien.

`investigacion.docx` había descartado Docker (supuesto SUP-12: *"no es necesario para un solo
VPS"*). Ese razonamiento era correcto **bajo el supuesto de un VPS de uso exclusivo**. El
supuesto resultó falso, así que la conclusión que se apoyaba en él deja de sostenerse.

### Decisión

Empaquetar el SGPA en contenedores Docker:

- **Backend:** imagen propia con su versión de Node fijada en el `Dockerfile`, publicada en
  `127.0.0.1` para que solo la alcance el Nginx del host.
- **Frontend:** contenedor **de compilación**, no de ejecución. Produce `dist/` y termina.
  El Nginx existente sirve esos archivos estáticos.

- **Base de datos:** PostgreSQL propio en contenedor, con su volumen.

**No se contenedoriza el Nginx del host.**

### Justificación de los límites

| Qué se deja fuera | Por qué |
|---|---|
| **El Nginx del host** | Sirve también a la otra aplicación. Tomar control de él convertiría una mejora de aislamiento en un riesgo para el vecino — exactamente lo que se quiere evitar |
| **PostgreSQL del host** | Lo comparte el otro usuario. Para que un contenedor lo alcanzara habría que modificar `listen_addresses` y `pg_hba.conf` y **reiniciar el servicio**, cortándole las conexiones. Se descarta: el SGPA usa su propio PostgreSQL en contenedor. Al no haber datos que conservar, el coste de esa decisión fue cero |

**Por qué el frontend también se compila en contenedor:** si se compilara en el VPS haría falta
Node instalado allí, y volveríamos al problema original. Compilar dentro del contenedor es lo
que permite que el servidor **no necesite Node en absoluto**.

### Alternativas descartadas

- **`nvm` por usuario.** Cada usuario de Linux con su propio Node en su carpeta personal.
  Más ligero y sin `sudo`. Resuelve el conflicto de versiones de Node, pero **no** el de
  librerías del sistema, y el responsable planteó el problema como *"cuando actualizaba Node
  **u otro**"*. Queda como alternativa documentada si Docker resultara inviable.
- **Un VPS separado.** Aislamiento perfecto y coste recurrente adicional. Desproporcionado.
- **No hacer nada.** Es el estado actual, y ya causó caídas.

### Consecuencias

- ✅ Actualizar Node pasa a ser cambiar una etiqueta en el `Dockerfile` y reconstruir.
  El otro usuario no se ve afectado.
- ✅ Revertir es igual de barato: se vuelve a la etiqueta anterior.
- ✅ El entorno de ejecución queda descrito en un archivo versionado, no en el estado
  irreproducible de un servidor.
- ✅ El contenedor corre con un usuario sin privilegios (`uid 10001`), no como root.
- ⚠️ **Instalar Docker sí es un cambio a nivel de sistema** y requiere `sudo` una vez.
  Es el único momento en que este montaje toca el VPS; conviene avisar al otro usuario.
- ⚠️ **No escalar `backend` a varias réplicas**: el cron vive dentro del proceso
  ([ADR-007](#adr-007--tareas-programadas-dentro-del-proceso-de-la-api)) y cada réplica
  enviaría los mismos correos.
- ⚠️ Docker acumula imágenes en un disco compartido. Conviene `docker system prune`
  periódicamente.
- ⚠️ El montaje **no se ha probado en el VPS**: se escribió y revisó, pero la ejecución real
  depende del servidor, al que no hay acceso desde el entorno de desarrollo.

---

## ADR-012 — El administrador de plataforma es una identidad separada, no un rol más

**Fecha:** 2 de septiembre de 2026

### Contexto

Hacía falta dar de alta, suspender y eliminar consultorios sin entrar por SSH al VPS, con vistas
a un modelo de suscripción: cortar el acceso a quien no paga la mensualidad. Hasta ahora
`Tenant.activo` existía pero **no se comprobaba en ningún sitio** (defecto D-09): marcarlo no
tenía ningún efecto.

La decisión de fondo no es técnica sino de alcance: **¿ese administrador puede abrir los
expedientes de los consultorios?** Los procesos judiciales están cubiertos por el secreto
profesional entre abogado y cliente. Un administrador con acceso de lectura a todos los
despachos es una decisión con consecuencias legales, no un detalle de implementación.

### Decisión

**Solo gestión administrativa.** Ve el nombre del consultorio, su tipo, contacto, plan, estado,
fecha de alta y **recuentos** de usuarios, clientes y expedientes. No puede abrir ningún
expediente, cliente ni documento. Para cobrar suscripciones y suspender morosos no hace falta
nada más.

Y se implementa como **identidad separada**, no como un rol añadido a `RolUsuario`:

- Tabla propia `AdminPlataforma`, sin `tenant_id`.
- Token propio, marcado con `tipo: "PLATAFORMA"`.
- Middleware propio que además **no define `req.tenant_id` ni `req.user`**: si un controlador de
  consultorio se invocara por error, filtraría por `undefined` y no devolvería nada, en lugar de
  devolverlo todo.
- Comprobación en los dos sentidos: `auth.middleware.js` rechaza los tokens de plataforma y
  `plataforma.middleware.js` rechaza los de consultorio.
- Bitácora propia, `BitacoraPlataforma`. La del consultorio se borra con él, así que ahí
  desaparecería el registro de quién lo borró.
- Se crean **solo desde el servidor**. No existe ninguna ruta web de registro para la cuenta de
  mayor privilegio del sistema.

### Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Añadir `SUPERADMIN` a `RolUsuario` | Todo `Usuario` exige `tenant_id`. Un superadministrador tendría que pertenecer a algún consultorio, lo cual es falso, y quedaría a un `UPDATE` de distancia de cualquier cuenta normal |
| Un booleano `es_admin_plataforma` en `Usuario` | Más simple, pero mezcla en una misma fila a quien litiga y a quien factura. El token seguiría siendo el mismo, así que la separación dependería de comprobaciones dispersas en vez de la forma del token |
| Dar acceso de lectura a los expedientes | No hace falta para el objetivo, y convierte una cuenta administrativa en una llave maestra sobre información amparada por el secreto profesional |

### Consecuencias

**A favor.** La separación no depende de acordarse de comprobar un rol: depende de que el token
sea de otro tipo. Verificado en ambos sentidos, comprobaciones P-03 y P-04 de
`npm run verificar:plataforma`.

**En contra.** Hay dos sistemas de sesión que mantener, y quien sea administrador de plataforma
y además abogado en un consultorio necesita dos cuentas. Se acepta: es el precio de que una no
pueda convertirse en la otra.

**Lo que NO resuelve.** Es la palanca, no la maquinaria de suscripción. `Tenant.plan` sigue sin
leerse y no hay campos de vencimiento ni de pago. Suspender por impago sigue siendo una acción
manual.

---

## Cómo añadir un ADR nuevo

Cuando se tome una decisión estructural —cambiar de proveedor de almacenamiento, introducir una
capa de servicios, activar Row Level Security, adoptar TypeScript— se añade una sección con
este formato:

```markdown
## ADR-0NN — Título en una línea

### Contexto
Qué problema o presión obliga a decidir.

### Decisión
Qué se decidió, en una o dos frases.

### Alternativas descartadas
Qué más se consideró y por qué no.

### Consecuencias
Lo bueno, lo malo y lo que habrá que vigilar.
```

Un ADR **nunca se borra ni se reescribe**. Si una decisión se revierte, se añade un ADR nuevo
que la supere y se marca el anterior como `Superado por ADR-0NN`. El valor de un registro de
decisiones está en poder reconstruir por qué se pensó lo que se pensó, incluso cuando se
demostró equivocado.
