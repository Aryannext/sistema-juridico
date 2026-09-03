# 04 — Requisitos no funcionales

**Diez requisitos.** No describen *qué hace* el sistema, sino **con qué garantías** lo hace:
seguridad, rendimiento, disponibilidad y trazabilidad.

Mismo formato que los funcionales: cada uno descompuesto en criterios verificables.

**Estados:** ✅ cumplido · 🟡 parcial, con el límite declarado · 🔵 depende de un tercero ·
❓ nunca medido

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
| RNF02.7 | La sesión expira por 30 minutos de inactividad | 🟥 |
| RNF02.8 | El inicio de sesión tiene un limitador de peticiones dedicado | 🟥 |

**Estado 🟡.** Seis de ocho.

- **RNF02.2** se cumple desde el 2 de septiembre de 2026. Antes solo lo validaba el navegador:
  una petición directa a la API aceptaba la contraseña `"1"`.
- **RNF02.3** es escalado: 1, 5, 15, 30 y 60 minutos según los intentos acumulados.
- **RNF02.8** sigue pendiente. Lo que hoy protege el acceso es el bloqueo por usuario, que frena
  el ataque a una cuenta concreta pero no uno distribuido contra muchas.

---

## RNF03 · Auditoría

**Enunciado.** Bitácora inmutable, conservada 5 años, exportable en CSV o PDF con filtros.

| | Criterio | |
|---|---|:--:|
| RNF03.1 | La bitácora es inmutable: no se puede editar ni borrar | ✅ |
| RNF03.2 | Cada registro incluye usuario, fecha, IP, módulo y detalle legible | ✅ |
| RNF03.3 | La bitácora se puede consultar con filtros | ✅ |
| RNF03.4 | La bitácora se puede **exportar** | 🟥 |
| RNF03.5 | Los registros se conservan 5 años | 🔵 |

**Estado 🟡. Brecha reconocida:** no existe endpoint de exportación de la bitácora. Es una de las
tres no conformidades que detecta la verificación automática.

RNF03.5 depende de que la base no se purgue: no hay proceso de borrado, pero **tampoco hay
política de retención escrita ni respaldos automáticos** *(ver RNF10)*.

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
| RNF05.5 | La respuesta tarda menos de 2 segundos | 🟡 |

**Estado 🟡.** Los cuatro primeros están verificados automáticamente.

Sobre RNF05.5, hay una medición real del 2 de septiembre de 2026: **el servidor responde entre 5
y 17 ms**. El criterio se cumple hoy con holgura. Lo que **no** está garantizado es que siga
cumpliéndose al crecer: **la base de datos solo tiene 2 índices**, y las consultas filtradas por
consultorio recorren la tabla entera. Con pocos datos no se nota; con volumen real, sí.

> Se declara como parcial a propósito. Cumplirlo por casualidad no es cumplirlo.

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

**Enunciado.** Disponibilidad mensual igual o superior al 99,5 %.

| | Criterio | |
|---|---|:--:|
| RNF07.1 | El servicio está disponible de forma continua | 🔵 |
| RNF07.2 | Existe monitoreo que permita medir la disponibilidad | 🟥 |
| RNF07.3 | Existe página de estado o alerta ante caída | 🟥 |

**Estado 🔵.** Depende enteramente del VPS: la API, el cron y la base de datos corren allí.

**No se puede afirmar que se cumpla, porque no se mide.** Sin monitoreo, el 99,5 % es una
aspiración, no un dato. Declararlo cumplido sería inventarlo.

---

## RNF08 · Concurrencia y tiempos de escritura

**Enunciado.** 50 usuarios concurrentes; consultas por debajo de 3 segundos y escrituras por
debajo de 5.

| | Criterio | |
|---|---|:--:|
| RNF08.1 | Soporta 50 usuarios concurrentes | ❓ |
| RNF08.2 | Las consultas responden en menos de 3 segundos | ❓ |
| RNF08.3 | Las escrituras responden en menos de 5 segundos | ❓ |

**Estado ❓ — nunca medido.** No hay pruebas de carga en el repositorio.

> Es el único requisito del catálogo del que **no se puede afirmar nada**. Las mediciones
> puntuales del 2 de septiembre (5–17 ms por endpoint) sugieren margen amplio, pero se hicieron
> con un solo usuario. Un dato con un usuario no dice nada sobre cincuenta.

---

## RNF10 · Integridad y respaldo

**Enunciado.** Transacciones atómicas, respaldos diarios con 30 días de retención e integridad
referencial.

| | Criterio | |
|---|---|:--:|
| RNF10.1 | Las operaciones de varios pasos son atómicas | ✅ |
| RNF10.2 | La integridad referencial está garantizada por la base de datos | ✅ |
| RNF10.3 | **Existen respaldos diarios** | 🟥 |
| RNF10.4 | Los respaldos se conservan 30 días | 🟥 |

**Estado 🟡, y es el punto más delicado del catálogo.**

RNF10.1 y RNF10.2 se cumplen: hay transacciones en el registro de consultorio, la creación de
términos y audiencias, y el borrado de expedientes; las claves foráneas impiden dejar registros
huérfanos.

> ### ⚠️ RNF10.3 y RNF10.4 no se cumplen
>
> Cuando la base de datos vivía en un proveedor gestionado, los respaldos venían incluidos. Al
> pasarla a un contenedor propio **se ganó aislamiento y se perdió el respaldo automático**, sin
> poner nada en su lugar. Hoy, si el volumen se corrompe, se pierden los expedientes de todos
> los consultorios.
>
> Detectado el 2 de septiembre de 2026 al revisar este mismo requisito. Hay procedimiento manual
> documentado en [el runbook de despliegue](../../docs/12-DESPLIEGUE-VPS-COMPARTIDO.md), y la
> automatización está definida pero no instalada.
>
> **Es el mayor riesgo operativo del sistema, y se declara como tal.**

---

## RNF11 · Aislamiento entre consultorios

**Enunciado.** Ninguna consulta debe devolver datos de otro consultorio; un intento debe
registrarse y responder 403.

| | Criterio | |
|---|---|:--:|
| RNF11.1 | Ninguna consulta devuelve datos de otro consultorio | ✅ |
| RNF11.2 | Un intento de acceso cruzado se rechaza | ✅ |
| RNF11.3 | El rechazo responde con código **403** | 🟥 |
| RNF11.4 | El intento queda registrado en la bitácora | 🟥 |

**Estado 🟡.**

RNF11.1 y RNF11.2 están verificados por cuatro comprobaciones de extremo a extremo y una suite
de pruebas unitarias dedicada.

RNF11.3 no se cumple, **y es discutible que deba cumplirse**: el sistema responde **404**, no
403. Un 403 diría «existe, pero no puedes verlo», lo que confirma la existencia de un expediente
ajeno. El 404 no revela nada. Devolver 403 cumpliría la letra del requisito y empeoraría la
seguridad.

> Se declara como no cumplido y con la razón escrita, en lugar de reinterpretar el requisito para
> que encaje. **Es un desacuerdo argumentado con la especificación, no un olvido.**

RNF11.4 sí es una carencia real: los intentos cruzados no se registran.

---

## Resumen

| Estado | Cantidad | Cuáles |
|---|---:|---|
| ✅ Cumplidos | 2 | RNF04, RNF06 |
| 🟡 Parciales, con el límite declarado | 5 | RNF02, RNF03, RNF05, RNF10, RNF11 |
| 🔵 Dependen de infraestructura | 2 | RNF01, RNF07 |
| ❓ Nunca medidos | 1 | RNF08 |

**Los no funcionales son el punto más débil del sistema, y conviene decirlo antes de que lo
pregunten.** Los funcionales están en 48 de 59 cumplidos; aquí solo 2 de 10 lo están del todo.

No es casualidad: los requisitos no funcionales exigen medir, monitorear y respaldar —trabajo que
no produce pantallas visibles y que suele quedar para el final. Las tres carencias que más pesan
son, por este orden:

1. **RNF10.3** — no hay respaldos.
2. **RNF07.2** — no hay monitoreo, así que la disponibilidad no se puede afirmar.
3. **RNF08** — nunca se ha medido la concurrencia.
