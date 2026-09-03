# 03 — Requisitos funcionales

**60 requisitos**, agrupados por área.

> El sexagésimo, RF60, se añadió el 3 de septiembre de 2026: la administración de la plataforma
> existía en el sistema y **no tenía requisito que la respaldara**. Se detectó revisando este
> catálogo contra el código antes de desplegar.

## Cómo leer este documento

Cada requisito conserva su **número original** de `sistema.docx`, y se descompone en **criterios
verificables** numerados `RFxx.1`, `RFxx.2`… Cada criterio afirma **una sola cosa comprobable**.

> **Por qué no se renumeró.** Si RF01 pasara a ser tres requisitos nuevos, la numeración dejaría
> de coincidir con el documento de especificación original y con toda la trazabilidad construida
> sobre él. Descomponer dentro de cada número da la atomicidad sin romper la correspondencia.

**Estados:** ✅ cumplido · 🟡 cumplido parcialmente, con el límite declarado · 🟥 no cumplido

---

## A. Acceso, roles y auditoría

### RF01 · Inicio de sesión
**Enunciado.** El sistema permite iniciar sesión con correo **o nombre de usuario** y contraseña.

| | Criterio verificable | |
|---|---|:--:|
| RF01.1 | Se puede iniciar sesión con correo electrónico y contraseña | ✅ |
| RF01.2 | Se puede iniciar sesión con nombre de usuario y contraseña | ✅ |
| RF01.3 | Las credenciales incorrectas devuelven un mensaje genérico, sin revelar si el correo existe | ✅ |

**Estado ✅.** RF01.2 se cerró el 3 de septiembre de 2026. Hasta entonces `login` buscaba por
correo únicamente porque **no existía campo de nombre de usuario** en el modelo; ahora la columna
`nombre_usuario` existe, es única en todo el sistema —como el correo, y por la misma razón: el
login resuelve la cuenta antes de saber a qué consultorio pertenece— y es opcional, porque el
correo sigue siendo el identificador obligatorio.

El sistema distingue un identificador del otro **por la arroba**: un nombre de usuario no puede
contenerla, así que no hace falta preguntar ni consultar dos veces. RF01.3 se mantiene: un nombre
de usuario inexistente devuelve el mismo error genérico que un correo inexistente.
**Implementado en** `POST /api/auth/login` · `auth.controller.js` · `utils/nombre-usuario.js` ·
`PATCH /api/auth/nombre-usuario` · **Historia:** HU-01

### RF02 · Cuatro roles
**Enunciado.** El sistema define cuatro roles: Administrador, Abogado, Colaborador y Cliente.

| | Criterio | |
|---|---|:--:|
| RF02.1 | Existen exactamente cuatro roles asignables | ✅ |
| RF02.2 | Cada usuario tiene un único rol | ✅ |

**Estado ✅.** En la base de datos el tercer rol se llama `ASISTENTE` y en la interfaz
«Colaborador». Es una decisión documentada, no un desajuste ([ADR-004](../../docs/11-DECISIONES-ARQUITECTONICAS.md)).
**Implementado en** `enum RolUsuario` · **Historia:** HU-02

### RF03 · Permisos por módulo
**Enunciado.** Se pueden conceder permisos de leer, crear, editar y eliminar por cada módulo.

| | Criterio | |
|---|---|:--:|
| RF03.1 | Cada usuario tiene permisos independientes por módulo | ✅ |
| RF03.2 | Los cuatro tipos de permiso se conceden por separado | ✅ |
| RF03.3 | El sistema rechaza con 403 una acción sin permiso | ✅ |

**Estado ✅** · `permiso_rol` · `roles.middleware.js` · `PUT /api/admin/permisos/:id` · **HU-02**

### RF04 · Visibilidad restringida del abogado
**Enunciado.** El abogado solo ve los procesos que tiene asignados.

| | Criterio | |
|---|---|:--:|
| RF04.1 | Un Abogado ve los expedientes donde es responsable principal | ✅ |
| RF04.2 | Ve además aquellos donde figura como colaborador asignado | ✅ |
| RF04.3 | No ve el resto de expedientes del consultorio | ✅ |
| RF04.4 | El Administrador sí ve todos los del consultorio | ✅ |

**Estado ✅** · `getProcesos` filtra por `id_abogado_resp` o pertenencia a `proceso_abogados` · **HU-02**

### RF05 · Bitácora de auditoría
**Enunciado.** Toda acción queda registrada con usuario, fecha y hora, dirección IP, módulo y detalle.

| | Criterio | |
|---|---|:--:|
| RF05.1 | Cada registro identifica al usuario que realizó la acción | ✅ |
| RF05.2 | Registra fecha y hora | ✅ |
| RF05.3 | Registra la **dirección IP real del cliente**, no la del proxy | ✅ |
| RF05.4 | Registra el módulo y un detalle legible para el usuario | ✅ |
| RF05.5 | **El inicio de sesión queda registrado** | ✅ |
| RF05.6 | El cierre de sesión queda registrado | ✅ |
| RF05.7 | La bitácora se puede exportar con filtros | ✅ |

**Estado ✅.** El detalle se escribe en lenguaje llano (*«Registró el cliente María Fernanda
Rojas»*), no como ruta técnica. Además del inicio y el cierre, se registran el intento fallido
y el bloqueo por acumulación de intentos.

RF05.5 y RF05.6 estuvieron en 🟥 hasta el 2 de septiembre de 2026: el código conservaba un
comentario `// Todo: Record audit login` sin implementar. Se cerraron el 3 de septiembre.

> **Dos decisiones que un evaluador puede querer preguntar.** El registro **nunca interrumpe el
> acceso**: si la bitácora falla, se traza el error y el usuario entra igual, porque lo contrario
> dejaría a todo el mundo fuera por un problema de auditoría. Y el cierre de sesión necesitó una
> ruta nueva (`POST /api/auth/logout`), porque antes ocurría solo en el navegador y no había nada
> que registrar.

**Implementado en** `audit.middleware.js` · `sesion.auditoria.js` · `exportacion-bitacora.js`
**Historia:** HU-03 · **Pruebas:** `auditoria_sesion.test.js`, `exportacion_bitacora.test.js`

---

## B. Clientes

### RF06 · Campos según tipo de persona
**Enunciado.** Los campos obligatorios difieren entre persona natural y jurídica.

| | Criterio | |
|---|---|:--:|
| RF06.1 | Persona natural exige nombre, tipo y número de documento, teléfono y correo | ✅ |
| RF06.2 | Persona jurídica exige además razón social, NIT y representante legal | ✅ |
| RF06.3 | El número de documento es único **dentro del consultorio**, no en todo el sistema | ✅ |

**Estado ✅.** RF06.2 se cerró el 3 de septiembre de 2026 con `clientes/validacion.js`.

> **Por qué la base de datos no podía encargarse de esto.** Las columnas `razon_social`, `nit` y
> `representante` **admiten nulo**, y tienen que admitirlo: la tabla la comparten las personas
> naturales, que no tienen ninguna de las tres. La base puede exigir que una columna no esté
> vacía, pero no puede expresar *«si el tipo es jurídica, entonces la razón social es
> obligatoria»*. Esa regla solo puede vivir en el código, y hasta entonces no vivía en ninguna
> parte: una petición directa a la API guardaba una empresa sin razón social ni NIT.
>
> Antes, además, un cliente sin nombre llegaba hasta Prisma y devolvía un **500 opaco** en lugar
> de decir qué faltaba. Ahora se enumeran de una vez todos los campos que faltan, para no obligar
> a reenviar el formulario y descubrirlos de uno en uno.

**Implementado en** `POST /api/clientes` · `clientes/validacion.js`
**Historias:** HU-04, HU-05 · **Pruebas:** `validacion_cliente.test.js`

> **RF06.3 en detalle.** Una misma persona puede ser cliente de dos despachos distintos. Hasta el
> 2 de septiembre de 2026 el documento era único en todo el sistema, lo que lo impedía.

### RF07 · Un cliente, varios procesos
| | Criterio | |
|---|---|:--:|
| RF07.1 | Un cliente puede tener asociados varios expedientes | ✅ |

**Estado ✅** · Relación 1:N `Cliente → Proceso` · **HU-06**

### RF08 · Procesos visibles desde la ficha
| | Criterio | |
|---|---|:--:|
| RF08.1 | La ficha del cliente lista todos sus expedientes | ✅ |
| RF08.2 | Cada expediente listado enlaza a su detalle | ✅ |

**Estado ✅** · `getClienteById` incluye `procesos` · **HU-06**

---

## C. Expedientes

### RF09 · Crear expediente
| | Criterio | |
|---|---|:--:|
| RF09.1 | Se crea un expediente asociado a un número de radicado | ✅ |
| RF09.2 | El expediente queda vinculado a un cliente existente | ✅ |
| RF09.3 | El expediente queda vinculado a un abogado responsable | ✅ |

**Estado ✅** · `POST /api/procesos` · **HU-07**

### RF10 · Radicado no duplicado
| | Criterio | |
|---|---|:--:|
| RF10.1 | No se admiten dos expedientes con el mismo radicado **en el mismo consultorio** | ✅ |
| RF10.2 | **Sí** se admite el mismo radicado en consultorios distintos | ✅ |
| RF10.3 | El mensaje de error no revela expedientes de otros consultorios | ✅ |

**Estado ✅.** RF10.2 no es una excepción: en un mismo proceso judicial **la contraparte litiga
con el mismo radicado** desde otro despacho. Impedirlo sería un error de dominio.
**Implementado en** `createProceso` · **HU-07**

### RF11 · Datos del expediente
| | Criterio | |
|---|---|:--:|
| RF11.1 | Registra juzgado, tipo, clase, área del derecho, estado y fecha de radicación | ✅ |
| RF11.2 | El número de radicado **no se puede modificar** tras la creación | ✅ |
| RF11.3 | Toda modificación queda en el historial del expediente | ✅ |

**Estado ✅** · `PUT /api/procesos/:id` · **HU-33**

### RF12 · Equipo de trabajo
| | Criterio | |
|---|---|:--:|
| RF12.1 | Se pueden asignar varios abogados o colaboradores a un expediente | ✅ |
| RF12.2 | Cada asignación indica su rol en el proceso | ✅ |
| RF12.3 | Asignar y retirar queda en el historial | ✅ |

**Estado ✅** · `POST /api/procesos/:id/abogados` · **HU-08** · **Regla:** RN04

### RF13 · Estado del proceso
| | Criterio | |
|---|---|:--:|
| RF13.1 | Los estados posibles son activo, suspendido, archivado y finalizado | ✅ |
| RF13.2 | Todo cambio de estado exige justificación escrita | ✅ |
| RF13.3 | No se archiva con términos pendientes o audiencias en 30 días | ✅ |
| RF13.4 | El Administrador puede forzar el archivado de forma explícita | ✅ |
| RF13.5 | Reactivar un proceso cerrado exige rol Administrador | ✅ |

**Estado ✅** · `PUT /api/procesos/:id/estado` · **HU-09** · **Reglas:** RN03, RN05

### RF14 · Historial de cambios
| | Criterio | |
|---|---|:--:|
| RF14.1 | Cada modificación registra campo, valor anterior, valor nuevo, autor y fecha | ✅ |
| RF14.2 | El historial se consulta desde el expediente, en orden cronológico inverso | ✅ |

**Estado ✅** · Tabla `historial_proceso` · **HU-10**

---

## D. Actuaciones procesales

> Estas cinco fueron **recuperadas**: la entidad Actuación existía en la investigación original y
> desapareció al reescribir los requisitos, sin que nadie lo notara. Razonado en
> [ADR-010](../../docs/11-DECISIONES-ARQUITECTONICAS.md).

### RF55 · Registrar actuaciones
| | Criterio | |
|---|---|:--:|
| RF55.1 | Se registra una actuación con fecha, tipo y anotación | ✅ |
| RF55.2 | La anotación es obligatoria y no puede quedar vacía | ✅ |
| RF55.3 | La actuación queda vinculada al expediente | ✅ |

**Estado ✅** · `POST /api/actuaciones` · **HU-37**

### RF56 · Catálogo cerrado de tipos
| | Criterio | |
|---|---|:--:|
| RF56.1 | El tipo proviene de un catálogo cerrado de diez valores | ✅ |
| RF56.2 | Un tipo fuera del catálogo se rechaza con 400 | ✅ |

**Estado ✅.** Auto, sentencia, notificación, audiencia, memorial, demanda, contestación, recurso,
traslado y otro. **HU-37**

### RF57 · Cronología y dos fechas
| | Criterio | |
|---|---|:--:|
| RF57.1 | Las actuaciones se muestran en orden cronológico inverso | ✅ |
| RF57.2 | Se distingue la fecha **de la actuación** de la fecha **de registro** | ✅ |
| RF57.3 | La fecha de la actuación se conserva sin desplazamiento de día | ✅ |

**Estado ✅.** RF57.3 no es trivial: una fecha sin hora convertida a la zona horaria local se
desplaza un día. En términos judiciales, un día importa.
**HU-37**

### RF58 · Vínculo actuación → término
| | Criterio | |
|---|---|:--:|
| RF58.1 | Un término puede vincularse a la actuación que lo originó | ✅ |
| RF58.2 | El vínculo es opcional | ✅ |
| RF58.3 | La actuación muestra los términos que originó | ✅ |
| RF58.4 | Vincular a una actuación inexistente se rechaza | ✅ |

**Estado ✅.** Cierra la cadena **actuación → término → alerta**, que es el recorrido real del
problema: del juzgado sale un auto, del auto nace un plazo, del plazo debe salir un aviso.
**HU-37**

### RF59 · Eliminación restringida
| | Criterio | |
|---|---|:--:|
| RF59.1 | Solo el Administrador puede eliminar una actuación | ✅ |
| RF59.2 | No se elimina si tiene términos asociados | ✅ |
| RF59.3 | La eliminación queda en el historial del expediente | ✅ |

**Estado ✅** · `DELETE /api/actuaciones/:id` · **HU-37**

---

## E. Partes procesales

### RF15 · Tipos de parte
| | Criterio | |
|---|---|:--:|
| RF15.1 | Se registran demandante, demandado, víctima, tercero, cliente y otros | ✅ |

**Estado ✅** · `enum TipoParte` · **HU-11**

### RF16 · Proceso sin partes completas
| | Criterio | |
|---|---|:--:|
| RF16.1 | Se puede crear un expediente sin haber registrado todas las partes | ✅ |

**Estado ✅.** Correcto por diseño: al abrir un caso no siempre se conocen todas las partes. **HU-11**

### RF17 · Aviso de proceso incompleto
| | Criterio | |
|---|---|:--:|
| RF17.1 | Un expediente sin demandante y demandado se marca como incompleto | ✅ |
| RF17.2 | El aviso aparece en la ficha del expediente | ✅ |
| RF17.3 | El aviso aparece **también en el panel principal** | ✅ |

**Estado ✅.** RF17.3 se cerró el 3 de septiembre de 2026 con `GET /api/procesos/atencion`.
El aviso llevaba tiempo en la ficha del expediente, que es el peor sitio posible para él: nadie
abre un expediente para enterarse de que está incompleto. **HU-11**

---

## F. Documentos

### RF18 · Formatos y tamaño
| | Criterio | |
|---|---|:--:|
| RF18.1 | Se admiten al menos PDF, DOCX, XLSX, JPG y PNG | ✅ |
| RF18.2 | El tamaño máximo por archivo es de 10 MB | ✅ |
| RF18.3 | Un formato no admitido devuelve un error **descriptivo** | ✅ |
| RF18.4 | Un archivo demasiado grande devuelve un error descriptivo | ✅ |

**Estado ✅.** RF18.3 y RF18.4 se corrigieron el 2 de septiembre de 2026: antes devolvían un
`500 "Algo salió mal!"` porque la validación ocurre **antes** del controlador. Y hasta esa fecha

> **La plataforma admite más formatos de los que el enunciado enumera, y conviene decirlo antes de
> que lo pregunten.** El requisito nombra cinco; `documentos.routes.js` acepta **diez**: PDF, DOC,
> DOCX, XLS, XLSX, JPG, PNG, WebP, TIFF y TXT.
>
> No es una desviación: es un superconjunto. Los cinco del enunciado están todos, y los otros
> cinco responden a lo que llega de verdad a un despacho — un juzgado que remite en `.doc`, una
> notificación escaneada en TIFF, una constancia en texto plano. Rechazarlos habría obligado a
> convertir el archivo antes de subirlo, que es exactamente la fricción que este sistema viene a
> quitar.
>
> El criterio se redactó como *«al menos»* el 3 de septiembre de 2026, al detectar el desajuste
> revisando el catálogo contra el código. Antes decía «se admiten PDF, DOCX, XLSX, JPG y PNG» a
> secas, y quien lo leyera esperaría que un `.txt` fuera rechazado.
no existía filtro de formatos: se podía adjuntar un ejecutable a un expediente judicial.
**HU-12**

### RF19 · Categorías
| | Criterio | |
|---|---|:--:|
| RF19.1 | Existen siete categorías: demandas, pruebas, contratos, escritos, notificaciones, providencias y otros | ✅ |
| RF19.2 | Los documentos se pueden filtrar por categoría | ✅ |

**Estado ✅.** Los dos criterios se cerraron el 3 de septiembre de 2026.

**RF19.1**: faltaba **escritos** en el enumerado, y era la categoría del género más frecuente en un
despacho —memoriales, recursos, alegatos—, que hasta entonces había que archivar como «otros».
Enviar una categoría inexistente devolvía un `500` desde Prisma; ahora devuelve un `400` que
enumera las admitidas.

**RF19.2 figuraba como cumplido y no lo estaba.** No había filtro por categoría en ninguna parte:
ni parámetro en la API ni control en la pantalla. Se dio por bueno sin comprobarlo, y una revisión
posterior lo llegó a explicar diciendo que «el filtro es en cliente», que tampoco era cierto. Ahora
existe: `GET /api/documentos/proceso/:id?categoria=`, aplicado en el servidor **después** de las
reglas de visibilidad de RF22, para que filtrar no pueda ampliar lo que alguien tiene derecho a
ver. **HU-13**

### RF20 · Orden cronológico
| | Criterio | |
|---|---|:--:|
| RF20.1 | Los documentos se listan por fecha y hora de carga, del más reciente al más antiguo | ✅ |

**Estado ✅** · **HU-13**

### RF21 · Documentos generales
| | Criterio | |
|---|---|:--:|
| RF21.1 | Se pueden cargar documentos no vinculados a ningún expediente | ✅ |

**Estado ✅** · `Documento.id_proceso` es opcional · **HU-13**

### RF22 · Visibilidad
| | Criterio | |
|---|---|:--:|
| RF22.1 | Cada documento es privado, compartido con el cliente o visible para colaboradores | ✅ |
| RF22.2 | La visibilidad se puede cambiar después de la carga | ✅ |

**Estado ✅** · **HU-14**

### RF23 · Versionado
| | Criterio | |
|---|---|:--:|
| RF23.1 | Se conservan todas las versiones de un documento | ✅ |
| RF23.2 | La versión activa es siempre la más reciente | ✅ |
| RF23.3 | Se puede consultar el historial de versiones | ✅ |

**Estado ✅** · **HU-15** · **Regla:** RN06

### RF24 · Historial documental
| | Criterio | |
|---|---|:--:|
| RF24.1 | La creación, modificación y eliminación de documentos queda en la bitácora | ✅ |

**Estado ✅** · **HU-12**

### RF25 · Eliminación restringida
| | Criterio | |
|---|---|:--:|
| RF25.1 | La eliminación física exige rol Administrador | ✅ |
| RF25.2 | Exige justificación escrita | ✅ |

**Estado ✅** · **HU-16**

### RF26 · Reemplazado o inactivo
| | Criterio | |
|---|---|:--:|
| RF26.1 | Un documento se puede marcar como reemplazado o inactivo | ✅ |
| RF26.2 | Marcarlo así no borra su historial | ✅ |
| RF26.3 | Un documento inactivo o reemplazado **no se reactiva** | ✅ |

**Estado ✅** · **HU-16** · **Regla:** RN06

---

## G. Audiencias

### RF27 · Registrar audiencia
| | Criterio | |
|---|---|:--:|
| RF27.1 | Se registra una audiencia con nombre, tipo, fecha y hora, y lugar | ✅ |

**Estado ✅** · `POST /api/audiencias` · **HU-17**

### RF28 · Recordatorios de audiencia
| | Criterio | |
|---|---|:--:|
| RF28.1 | Se configuran hasta tres recordatorios por audiencia | ✅ |
| RF28.2 | Por defecto son 48 h, 24 h y el mismo día | ✅ |
| RF28.3 | El canal de cada recordatorio es configurable | ✅ |

**Estado ✅** · **HU-18**

### RF29 · Destinatarios
| | Criterio | |
|---|---|:--:|
| RF29.1 | El recordatorio llega al abogado responsable | ✅ |
| RF29.2 | Llega también a los colaboradores asignados | ✅ |

**Estado ✅** · `recordatorios.job.js` · **HU-18**

### RF30 · Reprogramación
| | Criterio | |
|---|---|:--:|
| RF30.1 | Una audiencia se puede reprogramar | ✅ |
| RF30.2 | La reprogramación queda en el historial del expediente | ✅ |
| RF30.3 | Los recordatorios se recalculan sobre la fecha nueva | ✅ |

**Estado ✅** · **HU-19**

### RF31 · Archivado automático
| | Criterio | |
|---|---|:--:|
| RF31.1 | Las audiencias ya celebradas pasan al historial sin intervención manual | ✅ |

**Estado ✅** · `autoArchivePastHearings` · **HU-20**

---

## H. Términos judiciales

### RF32 · Registrar término
| | Criterio | |
|---|---|:--:|
| RF32.1 | Se registra un término con descripción y fecha de vencimiento | ✅ |
| RF32.2 | Se puede marcar como crítico | ✅ |

**Estado ✅** · `POST /api/terminos` · **HU-21**

### RF33 · Recordatorios por defecto
| | Criterio | |
|---|---|:--:|
| RF33.1 | Por defecto se crean recordatorios a 5 días, 1 día y el día del vencimiento | ✅ |
| RF33.2 | Se omiten los que ya habrían pasado al crear el término | ✅ |

**Estado ✅** · **HU-22**

### RF34 · Términos vencidos visibles
| | Criterio | |
|---|---|:--:|
| RF34.1 | Un término vencido sigue visible hasta que se gestiona manualmente | ✅ |

**Estado ✅.** No desaparece solo: un plazo vencido es justo lo que no debe dejar de verse. **HU-21**

### RF35 · Gestión del término
| | Criterio | |
|---|---|:--:|
| RF35.1 | Se registra como cumplido, cumplido tardíamente o incumplido | ✅ |
| RF35.2 | La gestión exige justificación escrita | ✅ |
| RF35.3 | Marcar cumplido tras el vencimiento lo reclasifica automáticamente como tardío | ✅ |

**Estado ✅** · **HU-23** · **Regla:** RN07

### RF36 · Historial de alertas
| | Criterio | |
|---|---|:--:|
| RF36.1 | Se conserva el registro de los recordatorios enviados | ✅ |
| RF36.2 | Se conserva el historial de cambios de estado del término | ✅ |

**Estado ✅.** RF36.2 se cerró el 3 de septiembre de 2026, junto con HU-22. Hasta entonces la fila
del término guardaba un único estado y al reclasificarlo se perdía por dónde había pasado: que hoy
figure como *cumplido tardíamente* no dice si llegó ahí desde *pendiente* o si un Administrador lo
rebajó desde *incumplido*. Cada cambio se apunta ahora en el historial del expediente
(`historialProceso`), que es donde ya vivían los demás. **HU-22**

> Este párrafo decía **Estado 🟡** mientras sus dos criterios estaban marcados ✅ en la tabla de
> arriba: se quedó atrás cuando se cerró HU-22 y contradecía al código. Corregido el 3 de
> septiembre de 2026 tras comprobarlo en `terminos.controller.js`.

### RF37 · Recordatorios y criticidad
| | Criterio | |
|---|---|:--:|
| RF37.1 | Se configuran hasta tres recordatorios por término | ✅ |
| RF37.2 | Un término **crítico** alerta también al Administrador | ✅ |

**Estado ✅** · **HU-21, HU-22, HU-23**

---

## I. Panel, alertas y reportes

### RF38 · Panel por rol
| | Criterio | |
|---|---|:--:|
| RF38.1 | El panel muestra contenido distinto según el rol | ✅ |
| RF38.2 | El cliente es dirigido a su portal, no al panel del despacho | ✅ |

**Estado ✅** · **HU-24**

### RF39 · Priorización
| | Criterio | |
|---|---|:--:|
| RF39.1 | El panel prioriza términos por vencer, vencidos y audiencias próximas | ✅ |

**Estado ✅** · **HU-24**

### RF40 · Semáforo
| | Criterio | |
|---|---|:--:|
| RF40.1 | Los términos vencidos se marcan en rojo | ✅ |
| RF40.2 | Las audiencias en menos de 24 h se marcan en rojo | ✅ |
| RF40.3 | Los procesos sin movimiento más de 30 días se marcan en rojo | ✅ |

**Estado ✅.** RF40.3 se cerró el 3 de septiembre de 2026. La detección existía, pero solo la
veía el Administrador: llegaba por `/reportes/stats`, que abarca todo el consultorio. Ahora cada
abogado ve los suyos, con el mismo filtro de visibilidad que usa el listado (RF04).
**HU-24** · **Regla:** RN09

### RF41 · Ocultar lo gestionado
| | Criterio | |
|---|---|:--:|
| RF41.1 | Una alerta gestionada se oculta pasadas X horas | ✅ |
| RF41.2 | El umbral es configurable por consultorio, 48 h por defecto | ✅ |

**Estado ✅** · **HU-25**

### RF42 · Estadísticas y exportación
| | Criterio | |
|---|---|:--:|
| RF42.1 | Las estadísticas se filtran por rango de fechas | ✅ |
| RF42.2 | Los datos se exportan en CSV | ✅ |
| RF42.3 | Los datos se exportan en **PDF** | ✅ |

**Estado ✅.** RF42.3 estuvo en 🟥 hasta el 2 de septiembre de 2026; se cerró el 3 de septiembre
con `GET /api/reportes/export/pdf`.

> **Por qué los dos formatos y no uno.** El CSV sirve para **procesar** —abrirlo en Excel,
> filtrar, sumar—; el PDF sirve para **entregar**: a un socio, a un cliente o como soporte de
> una reunión. Ambos parten de la misma consulta, para que no puedan mostrar cifras distintas
> sobre el mismo periodo.

**Implementado en** `exportacion.js` (CSV) · `exportacion-pdf.js` (PDF, con `pdfkit`)
**HU-26** · **Pruebas:** `exportacion_pdf.test.js`

### RF47 · Canal y agrupación
| | Criterio | |
|---|---|:--:|
| RF47.1 | El canal de notificación es configurable por usuario | ✅ |
| RF47.2 | Más de cinco alertas en diez minutos se agrupan en una sola | ✅ |

**Estado ✅** · **HU-25, HU-29**

### RF48 · Prioridades
| | Criterio | |
|---|---|:--:|
| RF48.1 | Existen tres prioridades de notificación | ✅ |
| RF48.2 | Las de prioridad alta **no se pueden desactivar** | ✅ |

**Estado ✅** · **HU-29, HU-30**

### RF49 · Alertas críticas persistentes
| | Criterio | |
|---|---|:--:|
| RF49.1 | Una alerta crítica permanece visible hasta que se gestiona manualmente | ✅ |

**Estado ✅** · **HU-30** · **Regla:** RN08

### RF50 · Historial de notificaciones
| | Criterio | |
|---|---|:--:|
| RF50.1 | Las notificaciones no se borran; se marcan como leídas o gestionadas | ✅ |

**Estado ✅** · **HU-30**

---

## J. Portal del cliente

### RF43 · Contenido del portal
| | Criterio | |
|---|---|:--:|
| RF43.1 | El cliente ve sus procesos | ✅ |
| RF43.2 | Ve las audiencias autorizadas | ✅ |
| RF43.3 | Ve los documentos habilitados | ✅ |
| RF43.4 | Ve las novedades de sus casos | ✅ |

**Estado ✅** · **HU-27**

### RF44 · El abogado decide qué se comparte
| | Criterio | |
|---|---|:--:|
| RF44.1 | Solo los documentos marcados como compartidos llegan al portal | ✅ |

**Estado ✅** · **HU-14, HU-28**

### RF45 · Descarga
| | Criterio | |
|---|---|:--:|
| RF45.1 | El cliente descarga los documentos autorizados | ✅ |
| RF45.2 | La descarga se realiza mediante enlace firmado y temporal | ✅ |
| RF45.3 | Cada descarga queda auditada | ✅ |

**Estado ✅** · **HU-28**

### RF46 · Restricción de lo interno
| | Criterio | |
|---|---|:--:|
| RF46.1 | Las notas internas y los documentos privados **nunca** llegan al portal | ✅ |

**Estado ✅.** El filtro es explícito en la consulta, no una omisión de la interfaz. **HU-27**

---

## K. Multi-consultorio y cuenta

### RF51 · Registro público
| | Criterio | |
|---|---|:--:|
| RF51.1 | Cualquiera puede registrar un consultorio nuevo | ✅ |
| RF51.2 | La cuenta queda **inactiva** hasta verificar el correo | ✅ |

**Estado ✅** · **HU-35**

### RF52 · Aislamiento entre consultorios
| | Criterio | |
|---|---|:--:|
| RF52.1 | Un consultorio no ve clientes de otro | ✅ |
| RF52.2 | Un consultorio no ve expedientes de otro | ✅ |
| RF52.3 | Un consultorio no puede modificar datos de otro | ✅ |
| RF52.4 | El aislamiento está respaldado por la base de datos, no solo por el código | 🟥 |

**Estado 🟡.** Los tres primeros están verificados de extremo a extremo y con pruebas unitarias.
RF52.4 no se cumple: el aislamiento depende de que cada consulta filtre por consultorio. Se
evaluó *Row Level Security* y se pospuso ([ADR-003](../../docs/11-DECISIONES-ARQUITECTONICAS.md)).
**HU-02**

### RF53 · Perfil del consultorio
| | Criterio | |
|---|---|:--:|
| RF53.1 | El Administrador actualiza los datos del consultorio | ✅ |
| RF53.2 | Puede cargar un logotipo | ✅ |

**Estado ✅** · **HU-36**

### RF54 · Verificación de cuenta
| | Criterio | |
|---|---|:--:|
| RF54.1 | El enlace de verificación es único y tokenizado | ✅ |
| RF54.2 | Vence a las 24 horas | ✅ |
| RF54.3 | Es de un solo uso | ✅ |
| RF54.4 | Se puede solicitar el reenvío | ✅ |

**Estado ✅.** RF54.2 y RF54.4 se completaron el 2 de septiembre de 2026. Antes, un correo perdido
dejaba a la persona bloqueada sin ninguna salida. **HU-35**


### RF60 · Administración de la plataforma

**Enunciado.** Existe una administración del servicio, separada de los consultorios, que da de
alta, suspende y da de baja consultorios sin acceder a sus expedientes.

| | Criterio verificable | |
|---|---|:--:|
| RF60.1 | La administración de la plataforma es una identidad separada, no un rol de consultorio | ✅ |
| RF60.2 | Su sesión **no da acceso** a expedientes, clientes ni documentos de ningún consultorio | ✅ |
| RF60.3 | Puede suspender un consultorio, y la suspensión corta el acceso de todos sus usuarios | ✅ |
| RF60.4 | La suspensión exige justificación escrita | ✅ |
| RF60.5 | La baja definitiva exige que el consultorio esté suspendido, el nombre exacto y justificación | ✅ |
| RF60.6 | Los actos de plataforma quedan en una bitácora aparte que sobrevive a la baja del consultorio | ✅ |

**Estado ✅.** Este requisito **no existía**, y la funcionalidad sí: se añadió el 3 de septiembre
de 2026 al revisar el catálogo contra el código antes de desplegar.

> **Por qué faltaba, y por qué importa que ya no falte.** La administración de plataforma nació de
> una necesidad operativa —cortar el acceso a un consultorio que no paga— y se documentó bien, pero
> en otro sitio: [doc 15](../../docs/15-ADMINISTRACION-DE-PLATAFORMA.md) y
> [ADR-012](../../docs/11-DECISIONES-ARQUITECTONICAS.md). Nunca se escribió como requisito.
>
> El resultado era que **la plataforma hacía algo que su catálogo no pedía**: seis endpoints, una
> tabla de identidad propia y la capacidad de borrar un despacho entero, sin ningún RF detrás. Al
> presentar el catálogo, cualquiera podía señalar esa funcionalidad y preguntar de dónde salió.
>
> La decisión de fondo —que esa administración **no** puede abrir expedientes— es la parte que más
> convenía tener escrita como requisito y no solo como decisión técnica: los procesos judiciales
> están cubiertos por el secreto profesional, y que exista un rol capaz de leerlos todos sería una
> cuestión legal, no de implementación. RF60.2 lo fija.

**Implementado en** `plataforma.controller.js` · `plataforma.middleware.js` · `AdminPlataforma` ·
`BitacoraPlataforma` · **Pruebas:** `consultorio_suspendido.test.js`

---

## Resumen

| Estado | Requisitos |
|---|---:|
| ✅ Cumplidos | 59 |
| 🟡 Parciales, con el límite declarado | 1 |
| 🟥 No cumplidos | 0 |

Ninguno está sin empezar. Queda **un criterio pendiente sobre un total de 143**, y está aquí, en
su tabla, marcado 🟥:

| Criterio | Qué falta | Qué exige resolverlo |
|---|---|---|
| RF52.4 | El aislamiento entre consultorios lo aplica el código, no la base de datos | Políticas a nivel de fila; ver [ADR-003](../../docs/11-DECISIONES-ARQUITECTONICAS.md) |

**No sigue abierto por falta de tiempo, sino por una decisión registrada.** RF52.1, RF52.2 y
RF52.3 —que un consultorio no vea, ni toque, los datos de otro— están verificados de extremo a
extremo y con pruebas. Lo que RF52.4 pide es que esa garantía la sostenga además la base de datos
y no solo el código, y eso es *Row Level Security*: se evaluó y se pospuso en ADR-003. Cambiarlo
es una decisión de arquitectura, no una tarea pendiente.

### Los que se cerraron el 3 de septiembre de 2026

| Criterio | Lo que le faltaba |
|---|---|
| RF01.2 | Entrar con nombre de usuario y no solo con correo. Exigía la columna `nombre_usuario`, única en todo el sistema |
| RF19.1 | La séptima categoría documental, «escritos» |
| RF36.2 | Conservar el historial de estados del término, no solo el último |

> **No hay ninguna diferencia entre lo que este documento declara y lo que la plataforma hace.**
> Las brechas que la verificación señalaba antes —RF05.5, RF05.6, RF42.3, RF06.2, RF17.3, RF36.2
> y RF40.3— estaban recogidas aquí como criterios no cumplidos **antes** de resolverse. Ese rastro
> es el que hace comprobable el resto del catálogo: un catálogo que solo dice ✅ no demuestra nada.
