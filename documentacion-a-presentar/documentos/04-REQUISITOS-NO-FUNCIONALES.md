# 04 — Requisitos no funcionales

**Diez requisitos.** No describen *qué hace* el sistema, sino **con qué garantías** lo hace:
seguridad, rendimiento, disponibilidad y trazabilidad.

Mismo formato que los funcionales: cada uno descompuesto en criterios verificables.

**Estados:** ✅ cumplido · 🟡 parcial, con el límite declarado · 🔵 depende de un tercero ·
❓ nunca medido

> **La numeración salta del RNF08 al RNF10, y no es un error.** `RNF09` no existe: la
> especificación original lo fusionó con RNF03, que declara ser *«fusión de RNF03 y RNF09
> originales»*. Se anota aquí porque ya se reportó una vez como requisito faltante
> (hallazgo H-15), y sin la explicación volvería a parecerlo.

---

## RNF01 · Cifrado de la información

**Enunciado.** Cifrado en reposo AES-256 y en tránsito TLS 1.2 o superior.

| | Criterio | |
|---|---|:--:|
| RNF01.1 | Todo el tráfico entre navegador y servidor va cifrado con TLS | ✅ |
| RNF01.2 | Los documentos almacenados están cifrados en reposo | ✅ |
| RNF01.3 | La base de datos está cifrada en reposo | 🔵 |
| RNF01.4 | Existe cifrado a nivel de aplicación, independiente del proveedor | 🟥 |

**Estado 🔵.** TLS lo aporta Nginx con certificado de Let's Encrypt. Los documentos heredan el
cifrado por defecto de Cloudflare R2. **La base de datos, al vivir en un contenedor propio,
depende del cifrado de disco del VPS y de nada más.**

> **Esto debe declararse tal cual en la sustentación.** El sistema no cifra los datos por su
> cuenta: confía en la infraestructura. Afirmar «cumple AES-256» sin esa precisión sería
> impreciso.

**RNF01.4 no está pendiente: está decidido**, y desde el 3 de septiembre de 2026 con su razón
escrita en [ADR-013](../../docs/11-DECISIONES-ARQUITECTONICAS.md). El motivo no es el esfuerzo de
cifrar, sino **dónde viviría la clave**: en este despliegue acabaría en el `.env` del mismo
servidor que guarda la base, así que quien pudiera leer el disco leería las dos cosas. Se habría
cambiado un riesgo real por la apariencia de haberlo resuelto, que es peor, porque nadie vuelve a
mirar lo que ya figura en verde. Cifrar además rompería la búsqueda: sobre texto cifrado no hay
`ILIKE` ni índice de trigramas que valgan.

La respuesta correcta —un gestor de claves fuera del servidor— está identificada y descartada por
coste, no por criterio. **La consecuencia que hay que tener presente:** un volcado de la base es
legible, y eso vale también para el respaldo diario. Por eso las copias deben salir del VPS a un
destino con su propio control de acceso.

---

## RNF02 · Seguridad de las credenciales y la sesión

**Enunciado.** Política de contraseñas, bloqueo por intentos fallidos, expiración de sesión,
JWT de 8 horas y código 2FA con vigencia de 5 minutos.

| | Criterio | |
|---|---|:--:|
| RNF02.1 | Las contraseñas se almacenan cifradas, nunca en texto plano | ✅ |
| RNF02.2 | Se exige una política mínima **validada en el servidor** | ✅ |
| RNF02.3 | La cuenta se bloquea tras varios intentos fallidos, de forma escalada | ✅ |
| RNF02.4 | El token de sesión vence a las 8 horas | ✅ |
| RNF02.5 | El código de doble factor vence a los 5 minutos | ✅ |
| RNF02.6 | Existe recuperación de contraseña | ✅ |
| RNF02.7 | La sesión expira por 30 minutos de inactividad | ✅ |
| RNF02.8 | El inicio de sesión tiene un limitador de peticiones dedicado | ✅ |

**Estado ✅.** Las ocho. RNF02.8 se cerró el 3 de septiembre de 2026.

- **RNF02.2** se cumple desde el 2 de septiembre de 2026. Antes solo lo validaba el navegador:
  una petición directa a la API aceptaba la contraseña `"1"`. El 3 de septiembre de 2026 se le
  añadió la exigencia de **carácter especial**, que HU-01.6 pedía desde el principio y que no se
  comprobaba en ninguna parte: `Segura2026` pasaba el filtro. Las cinco reglas están fijadas por
  `politica_de_contrasenas.test.js`, y los dos formularios que fijan contraseña aplican ahora las
  mismas que el servidor.
- **RNF02.3** es escalado: 1, 5, 15, 30 y 60 minutos según los intentos acumulados.
- **RNF02.7** se cumple desde el 3 de septiembre de 2026 (`useCierrePorInactividad.js`).
- **RNF02.8** se cerró el 3 de septiembre de 2026, y conviene entender qué añade. El bloqueo por
  usuario frena el ataque contra **una** cuenta: cinco fallos y se cierra. No frena el reparto
  —probar una contraseña común contra cientos de correos distintos nunca llega a cinco fallos en
  ninguna cuenta, así que ese bloqueo no se dispara jamás—. Ese ataque se corta por origen, y para
  eso hace falta un limitador por dirección IP.

  Son **20 intentos fallidos cada 15 minutos**, y solo cuentan los fallidos: en un despacho todos
  comparten la misma IP, y si los accesos correctos gastaran cupo una mañana normal de trabajo
  dejaría a la oficina entera fuera. El margen coincide con el de `/api/plataforma/login` a
  propósito, porque la pantalla de acceso es única y un fallo consume cupo en las dos vías.

> **Hasta dónde llega RNF02.7, dicho con precisión.** Cierra la sesión **en el navegador**: borra
> el token y devuelve a la pantalla de acceso, explicando por qué. El JWT sigue siendo válido en
> el servidor hasta caducar a las 8 horas, porque un JWT es autocontenido y no se revoca sin
> mantener una lista de tokens anulados, que este sistema no lleva.
>
> Se declara así en vez de marcarlo ✅ a secas porque el matiz importa: protege del **riesgo que
> el requisito describe** —un portátil desatendido en una sala de audiencias o una mesa
> compartida, con expedientes y datos de clientes a la vista— y no de alguien que hubiera copiado
> el token antes de marcharse. Para eso haría falta una lista de revocación, que es otra decisión.

---

## RNF03 · Auditoría

**Enunciado.** Bitácora inmutable, conservada 5 años, exportable en CSV o PDF con filtros.

| | Criterio | |
|---|---|:--:|
| RNF03.1 | La bitácora es inmutable: ningún usuario del consultorio la edita ni la borra | ✅ |
| RNF03.2 | Cada registro incluye usuario, fecha, IP, módulo y detalle legible | ✅ |
| RNF03.3 | La bitácora se puede consultar con filtros | ✅ |
| RNF03.4 | La bitácora se puede **exportar** | ✅ |
| RNF03.5 | Los registros se conservan 5 años | 🔵 |

**Sobre RNF03.1.** No existe ni un `update` sobre la bitácora en todo el backend. El único
borrado ocurre cuando el administrador *de la plataforma* da de baja un consultorio entero, y ese
acto queda anotado en `BitacoraPlataforma`, que guarda el nombre como texto para sobrevivir a la
baja. Es una excepción que no permite quitar una línea suelta ni ocultar quién la quitó. Ver
[RN01](02-REGLAS-DE-NEGOCIO.md).

**Estado 🟡.** RNF03.4 se cerró el 3 de septiembre de 2026: `GET /api/admin/auditoria/export`
entrega la bitácora en CSV con los mismos filtros de la pantalla —módulo, acción y rango de
fechas—, de modo que lo exportado coincide con lo que se está viendo. La propia exportación
queda registrada en la bitácora: sacar el registro del sistema es en sí un acto auditable.

**Se exporta en CSV y no en PDF, a propósito.** El enunciado admite «CSV o PDF». Una bitácora se
exporta para analizarla —filtrar, ordenar, cruzar fechas—, y eso se hace en una hoja de cálculo.
El PDF se reservó para el informe de expedientes (RF42), que sí se entrega a terceros.

**Lo que sigue abierto es RNF03.5.** Depende de que la base no se purgue: no hay proceso de
borrado, pero **tampoco hay política de retención escrita ni respaldos automáticos**
*(ver RNF10)*. Es la razón de que el requisito siga en 🟡 y no en ✅.

---

## RNF04 · Compatibilidad y diseño adaptable

| | Criterio | |
|---|---|:--:|
| RNF04.1 | Funciona en navegadores modernos | ✅ |
| RNF04.2 | La interfaz se adapta de 360 a 1440 píxeles de ancho | ✅ |

**Estado ✅.** Puntos de ruptura de Tailwind; la barra lateral se oculta por debajo de `lg`.

---

## RNF05 · Búsqueda y rendimiento de consulta

**Enunciado.** Búsqueda por seis campos, respuesta en menos de 2 segundos, texto parcial desde
3 caracteres, filtros combinables y paginación de 20 registros.

| | Criterio | |
|---|---|:--:|
| RNF05.1 | La búsqueda cubre radicado, juzgado, cliente y abogado responsable | ✅ |
| RNF05.2 | El texto parcial se aplica desde 3 caracteres | ✅ |
| RNF05.3 | Los filtros de estado y tipo se combinan con la búsqueda | ✅ |
| RNF05.4 | Los resultados se paginan de 20 en 20 | ✅ |
| RNF05.5 | La respuesta tarda menos de 2 segundos | ✅ |

**Estado ✅.** Los cuatro primeros estaban verificados automáticamente. RNF05.5 se cerró el 3 de
septiembre de 2026.

Hasta entonces se declaraba como parcial a propósito, con esta razón: había una medición real del
2 de septiembre de 2026 —**el servidor responde entre 5 y 17 ms**— pero **la base de datos solo
tenía 2 índices**, y las consultas filtradas por consultorio recorrían la tabla entera. El
criterio se cumplía por el tamaño de los datos, no por el diseño. Cumplirlo por casualidad no es
cumplirlo.

Se añadieron **once índices**. Seis son B-tree corrientes: consultorio y fecha para el listado
paginado, los dos filtros combinables de RNF05.3, y las dos claves por las que se decide qué
expedientes ve quien no es Administrador. Los otros cinco no podían serlo. La búsqueda parcial es
`ILIKE '%texto%'`, con comodín por delante, y **un B-tree no puede resolverla**: ordena por
prefijo y aquí no hay prefijo. Son índices GIN de trigramas (`pg_trgm`), que indexan la búsqueda
por dentro de la palabra. Eso convierte el umbral de 3 caracteres de RNF05.2 en parte de la
garantía y no solo en una comodidad: tres es el tamaño del trigrama.

> **Cómo se verifica, ya que el cronómetro aquí no vale.** Con la tabla pequeña, la consulta tarda
> lo mismo con índices que sin ellos —ese era justamente el espejismo—. Así que `npm run
> verificar:indices` no mide tiempo: apaga el recorrido secuencial y pide a PostgreSQL el plan de
> las diez consultas que emite el listado. Si alguna sigue recorriendo la tabla entera aun con el
> recorrido penalizado, es que no tiene ningún índice que le sirva. Ninguna lo hace.
>
> Lo que se afirma, por tanto, no es «responde en X ms» —eso depende de la máquina—, sino que
> ninguna de esas consultas tendrá que leer la tabla completa cuando crezca. Que era lo único que
> faltaba.

---

## RNF06 · Eliminación definitiva controlada

| | Criterio | |
|---|---|:--:|
| RNF06.1 | Solo el Administrador puede eliminar definitivamente | ✅ |
| RNF06.2 | Exige justificación escrita | ✅ |
| RNF06.3 | La interfaz exige confirmación en dos pasos | ✅ |
| RNF06.4 | La eliminación queda registrada en la bitácora | ✅ |

**Estado ✅.**

---

## RNF07 · Disponibilidad

| | Criterio | |
|---|---|:--:|
| RNF07.1 | El servicio está disponible de forma continua | 🔵 |
| RNF07.2 | Existe monitoreo que permita medir la disponibilidad | ✅ |
| RNF07.3 | Existe página de estado o alerta ante caída | 🟡 |

**Estado 🟡.** RNF07.2 se cerró el 3 de septiembre de 2026.

> **Por qué las tres estaban en rojo por la misma causa.** La única ruta de salud que existía,
> `GET /`, devuelve un texto fijo: contesta *«SGPA API is running»* aunque la base esté caída,
> porque no comprueba nada. Vigilar con ella habría dicho que todo iba bien mientras el sistema no
> podía atender a nadie — peor que no vigilar, porque da tranquilidad falsa.

**RNF07.2** se cumple con `GET /api/estado`, que sí mira sus dependencias: consulta la base y
devuelve **200 solo si el servicio puede trabajar**, o 503 en cuanto no puede. Es lo que un
vigilante externo necesita, porque no lee el mensaje: mira el código. Incluye el tiempo que tardó
cada dependencia —una respuesta de tres segundos no está caída, pero tampoco está bien— y el
tiempo en marcha del proceso, que delata un reinicio que nadie pidió.

No lleva autenticación, porque un vigilante no tiene sesión; y por eso mismo **no dice nada que no
se pueda contar en público**: ni versiones, ni rutas internas, ni el motivo del fallo. Los errores
de conexión de PostgreSQL incluyen la dirección y el puerto de la base, y en una ruta abierta eso
es un mapa de la infraestructura. El motivo se traza en el servidor.

**RNF07.3 queda a medias, y es honesto decirlo.** La señal existe y es consumible; lo que no hay
es **nadie escuchándola**. Falta dar de alta un vigilante externo que apunte a esa dirección: el
procedimiento está escrito en [doc 12 § 7 ter](../../docs/12-DESPLIEGUE-VPS-COMPARTIDO.md), con
planes gratuitos que no requieren presupuesto. No es código; es una configuración de diez minutos
que solo puede hacerse **después de desplegar**, porque la ruta aún no existe en producción.

> **El vigilante tiene que estar fuera del servidor**, y no debe apuntar a la dirección de la
> aplicación: esa la sirve Nginx desde un archivo estático y **devuelve 200 aunque la base esté
> caída**. Un monitor así estaría en verde para siempre sin significar nada.

**RNF07.1 no puede cerrarse desde el repositorio.** «Disponible de forma continua» es una medida
que se acumula con el tiempo sobre un sistema en marcha; hasta que RNF07.3 esté conectado y haya
histórico, no hay nada que afirmar. Con la ruta ya existe cómo medirlo, que antes no lo había.

---

## RNF08 · Concurrencia y tiempos de escritura

| | Criterio | |
|---|---|:--:|
| RNF08.1 | Soporta 50 usuarios concurrentes | ✅ |
| RNF08.2 | Las consultas responden en menos de 3 segundos | ✅ |
| RNF08.3 | Las escrituras responden en menos de 5 segundos | ✅ |

**Estado ✅ — medido el 3 de septiembre de 2026.** Estuvo en ❓ *«nunca medido»*, que ante un
evaluador es peor que un incumplimiento: de un incumplimiento se conoce el tamaño; de algo sin
medir no se puede afirmar nada en ninguna dirección.

Se mide con `npm run medir:concurrencia`. No simula: levanta el servidor real —el mismo `app`, con
su autenticación y su base— y lo golpea por HTTP sosteniendo **50 peticiones simultáneas** contra
un consultorio con 300 expedientes de fondo.

| Operación | Mediana | p95 | p99 | Máximo | Límite | Errores |
|---|---:|---:|---:|---:|---:|---:|
| Lectura (búsqueda paginada) | 97 ms | 364 ms | 447 ms | 467 ms | 3 000 ms | 0 |
| Escritura (crear expediente) | 65 ms | 82 ms | 83 ms | 83 ms | 5 000 ms | 0 |

Se mide la **búsqueda** y no una lectura cualquiera porque es la consulta más cara del sistema y
la que RNF05 somete a su propio límite; y **crear un expediente** porque toca la validación del
responsable, el único de radicado y la bitácora: es una escritura completa, no un `INSERT` suelto.

> **Qué NO dice este número, y hay que decirlo al presentarlo.** La medición corre en la máquina de
> desarrollo, contra PostgreSQL local, sin la latencia de la red ni el Nginx del VPS. Describe
> **cómo se comporta el sistema bajo carga simultánea**, no cuánto tardará el navegador de un
> abogado en Neiva. Un número con su entorno declarado vale; el mismo número presentado como si
> fuera producción, no. Repetirlo en el servidor es una línea de orden.

---

## RNF10 · Integridad y respaldo

**Enunciado.** Transacciones atómicas, respaldos diarios con 30 días de retención e integridad
referencial.

| | Criterio | |
|---|---|:--:|
| RNF10.1 | Las operaciones de varios pasos son atómicas | ✅ |
| RNF10.2 | La integridad referencial está garantizada por la base de datos | ✅ |
| RNF10.3 | **Existen respaldos diarios** | 🔵 |
| RNF10.4 | Los respaldos se conservan 30 días | 🔵 |

**Estado 🟡, y es el punto más delicado del catálogo.**

RNF10.1 y RNF10.2 se cumplen: hay transacciones en el registro de consultorio, la creación de
términos y audiencias, y el borrado de expedientes; las claves foráneas impiden dejar registros
huérfanos.

> ### ⚠️ RNF10.3 y RNF10.4: el mecanismo existe, los respaldos todavía no
>
> **Sigue siendo el punto más delicado del catálogo, y el único cuyo daño es irreversible.** Todo
> lo demás degrada el servicio; esto pierde expedientes judiciales de terceros.
>
> El 3 de septiembre de 2026 se escribió y se probó el mecanismo: `npm run respaldo`
> (`backend/scripts/respaldo.js`). Vuelca la base comprimida, con la fecha en el nombre, **la
> verifica** y aplica la retención de 30 días. Se comprobó de extremo a extremo: se generó un
> volcado, se restauró en una base aparte y se compararon tablas y filas. Coincidían.
>
> **Y aun así los criterios no se declaran cumplidos.** «Existen respaldos diarios» es una
> afirmación sobre un sistema en marcha, no sobre un archivo del repositorio: hasta que la tarea
> programada corra en el servidor, los respaldos no existen. Falta una línea de `cron`
> —documentada en [doc 12 § 7 bis](../../docs/12-DESPLIEGUE-VPS-COMPARTIDO.md)— y sacar las
> copias del VPS, porque un respaldo en la misma máquina no protege del fallo más probable, que
> es perder la máquina.
>
> Se marcan 🔵 y no ✅ por eso, y no 🟥 porque ya no falta trabajo de desarrollo: falta un acto de
> operación. La distinción importa para saber a quién le toca.
>
> **Por qué el guion y no la orden de una línea.** `pg_dump ... | gzip > archivo` tiene un
> defecto que no se ve: en una tubería la shell devuelve el código del **último** proceso, o sea
> el de `gzip`. Si `pg_dump` muere a mitad, `gzip` comprime lo que recibió y devuelve 0: queda un
> archivo con peso, cortado, y una tarea que nunca avisa. Es la diferencia entre tener copias y
> creer que se tienen.

---

## RNF11 · Aislamiento entre consultorios

**Enunciado.** Ninguna consulta debe devolver datos de otro consultorio; un intento debe
registrarse y responder 403.

| | Criterio | |
|---|---|:--:|
| RNF11.1 | Ninguna consulta devuelve datos de otro consultorio | ✅ |
| RNF11.2 | Un intento de acceso cruzado se rechaza | ✅ |
| RNF11.3 | El rechazo responde con código **403** | 🟥 |
| RNF11.4 | El intento queda registrado en la bitácora | ✅ |

**Estado 🟡.**

RNF11.1 y RNF11.2 están verificados por cuatro comprobaciones de extremo a extremo y una suite
de pruebas unitarias dedicada.

RNF11.3 no se cumple, **y es discutible que deba cumplirse**: el sistema responde **404**, no
403. Un 403 diría «existe, pero no puedes verlo», lo que confirma la existencia de un expediente
ajeno. El 404 no revela nada. Devolver 403 cumpliría la letra del requisito y empeoraría la
seguridad.

> Se declara como no cumplido y con la razón escrita, en lugar de reinterpretar el requisito para
> que encaje. **Es un desacuerdo argumentado con la especificación, no un olvido.**

RNF11.4 **era** una carencia real y se cerró el 3 de septiembre de 2026. Sin registro, probar
identificadores hasta acertar era indistinguible del ruido: quien lo intentaba no obtenía datos,
pero tampoco dejaba rastro, así que nadie podía detectarlo.

**Lo difícil no era registrar, era no registrar de más.** Un 404 casi siempre es un identificador
equivocado —un enlace viejo, un expediente borrado—, y anotarlos todos llenaría la bitácora de
ruido, que es la forma más eficaz de inutilizar una auditoría sin llegar a desactivarla. Por eso
solo se anota cuando el identificador **existe de verdad en otro consultorio**: eso ya no es un
error de tecleo.

**El registro va a la bitácora de quien lo intentó, no a la del consultorio afectado.** Avisar al
segundo le revelaría que existe otro consultorio interesado en sus expedientes, que es filtrar por
el otro lado exactamente lo mismo que esta regla impide filtrar por el primero.

Está resuelto en un middleware —`acceso-cruzado.middleware.js`— y no repartido por los
controladores. El sistema tiene una treintena de puntos que devuelven 404 tras filtrar por
consultorio: instrumentarlos uno a uno serían treinta ocasiones de olvidarse, y el próximo
endpoint nacería sin registro.

---

## Resumen

| Estado | Cantidad | Cuáles |
|---|---:|---|
| ✅ Cumplidos | 5 | RNF02, RNF04, RNF05, RNF06, RNF08 |
| 🟡 Parciales, con el límite declarado | 4 | RNF03, RNF07, RNF10, RNF11 |
| 🔵 Dependen de infraestructura | 1 | RNF01 |
| ❓ Nunca medidos | 0 | — |

**Los no funcionales siguen siendo el punto más débil del sistema, y conviene decirlo antes de que
lo pregunten.** Los funcionales están en 58 de 59 cumplidos; aquí, 5 de 10 lo están del todo.

**Ya no queda ninguno sin medir.** RNF08 estaba en ❓ y ahora tiene números con su entorno
declarado, que era lo peor de la lista: de un incumplimiento se sabe el tamaño; de algo sin medir
no se puede afirmar nada.

De lo que queda, conviene separar tres cosas distintas, porque mezclarlas confunde a quien evalúa:

| | Cuáles | Qué falta de verdad |
|---|---|---|
| **Una decisión ya tomada** | RNF11 | Su único criterio abierto es devolver 403 en vez de 404, y cumplirlo **empeoraría** la seguridad. Está argumentado, no olvidado |
| **Un acto en el servidor** | RNF03, RNF07, RNF10 | El mecanismo de respaldo y la comprobación de estado existen y están probados. Falta programarlos allí: una línea de `cron` y un vigilante externo apuntando a `/api/estado` |
| **Una decisión pendiente** | RNF01 | Cifrar en la aplicación, además de heredar el cifrado del disco y de R2. Exige decidir dónde viven las claves, y eso no se improvisa |

**Lo único que sigue sin red es el respaldo**, y es lo único de esta lista cuyo daño es
irreversible. Todo lo demás degrada el servicio; perder la base pierde expedientes ajenos.

No es casualidad: los requisitos no funcionales exigen medir, monitorear y respaldar —trabajo que
no produce pantallas visibles y que suele quedar para el final. Las tres carencias que más pesan
son, por este orden:

1. **RNF10.3** — no hay respaldos.
2. **RNF07.2** — no hay monitoreo, así que la disponibilidad no se puede afirmar.
3. **RNF08** — nunca se ha medido la concurrencia.
