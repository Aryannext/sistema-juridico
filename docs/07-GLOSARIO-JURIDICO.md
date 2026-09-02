# 07 — Glosario jurídico y mapeo al modelo de datos

**Fuente:** `docs/fuentes/investigacion.docx` (Fase 0 — Vocabulario), contrastado contra el
Código General del Proceso colombiano (Ley 1564 de 2012).

Este documento cumple dos funciones. La primera es que **nadie debería nombrar una tabla de
la base de datos con un término que no comprende** — así lo plantea la propia investigación,
y es un criterio correcto. La segunda es señalar **dónde el modelo de datos se aparta del
dominio jurídico real**, que es donde nacen los errores caros.

---

## 1. El número de radicado

Es la matrícula única de un proceso judicial en Colombia: **23 dígitos** definidos por la
Fórmula Única de Radicación del Consejo Superior de la Judicatura. Se lee en siete bloques:

| Posición | Dígitos | Significado |
|---|:--:|---|
| 1–2 | 2 | Código DANE del departamento (11 = Bogotá D.C.; 05 = Antioquia) |
| 3–5 | 3 | Código DANE del municipio (001 = capital) |
| 6–7 | 2 | Entidad o corporación (municipal, circuito, tribunal, alta corte) |
| 8–9 | 2 | Especialidad (civil, laboral, familia, penal, administrativo, promiscuo) |
| 10–12 | 3 | Número del despacho |
| 13–16 | 4 | Año de radicación |
| 17–21 | 5 | Consecutivo del proceso en ese despacho y año |
| 22–23 | 2 | Instancia o recurso (00 = primera instancia) |

**Ejemplo:** `11001 31 03 2023 00145 00` → Bogotá D.C., juzgado del circuito, especialidad civil,
juzgado 3.º, radicado en 2023, caso n.º 145, primera instancia.

**Dos detalles que rompen implementaciones ingenuas:**
1. **Los ceros a la izquierda son parte del número.** `00145 ≠ 145`. Guardar el radicado como
   entero destruye el dato. El sistema lo guarda como texto — correcto.
2. **No siempre son 23 dígitos.** Procesos antiguos o de ciertas jurisdicciones usan 21.

### Cómo lo modela el SGPA

```prisma
numero_radicado String @unique @db.VarChar(50)
```

| Aspecto | Evaluación |
|---|---|
| Tipo texto | ✅ Correcto — preserva los ceros a la izquierda |
| Longitud 50 | ✅ Holgada y suficiente |
| Validación de formato | ❌ **No existe.** Se acepta cualquier cadena, incluso `"abc"` |
| Unicidad | ⚠️ Global, no por tenant (hallazgo H-19) |

**Mejora sugerida (opcional, bajo riesgo):** validar en el backend con
`/^\d{21}$|^\d{23}$/` y mostrar un mensaje descriptivo. No conviene hacerla bloqueante
sin confirmar antes con un abogado en ejercicio si existen casos legítimos fuera de ese patrón.

---

## 2. Los cuatro niveles del proceso

La confusión entre estos cuatro términos es la principal fuente de errores de modelado en
software jurídico. Son niveles distintos, no sinónimos.

| Término | Qué es | Analogía | Artículo CGP |
|---|---|---|---|
| **Proceso** | El conjunto completo de actos judiciales, desde la demanda hasta la terminación | El recipiente que contiene todo | Art. 2 |
| **Actuación** | Cada acto individual dentro del proceso: presentar un escrito, notificar, dictar un auto | Cada eslabón de la cadena | Art. 3 |
| **Audiencia** | El espacio oral y público donde se desarrollan actuaciones | El escenario | Arts. 372, 373 |
| **Providencia** | Toda decisión del juez. Se divide en *auto* y *sentencia* | El pronunciamiento | Art. 278 |

> En una frase: **el proceso es el todo; dentro de él ocurren actuaciones; muchas de esas
> actuaciones se realizan en audiencias; y el juez decide mediante providencias que, a su vez,
> generan nuevas actuaciones.**

### ✅ La entidad "Actuación" — brecha cerrada el 1 de septiembre de 2026

Este fue el hallazgo de dominio más relevante del análisis, y ya está resuelto.

**Cuál era el problema.** El `README.md` prometía *"Dentro de un expediente podrás registrar
**Actuaciones** (historial del caso)"*, pero el modelo de datos no tenía ninguna tabla
`actuaciones`. Lo más parecido era `historial_proceso`, que **no es lo mismo**:

| | `historial_proceso` | `actuaciones` |
|---|---|---|
| Registra | Que un usuario cambió un campo del sistema | Que el juzgado dictó un auto admisorio |
| Fecha relevante | Cuándo se editó en la aplicación | Cuándo ocurrió el acto en el proceso |
| Origen | Interno, automático | Externo, digitado del portal judicial |
| Para qué sirve | Auditoría interna | **Reconstruir la historia del caso** |

**Por qué se había perdido.** La entidad **sí estaba** en `investigacion.docx`, y como entidad
de primer nivel:

```
Actuación (RF02) | Fecha actuación, tipo actuación (FK catálogo), anotación,
                   fecha inicia término, fecha finaliza término, FK proceso | Pestaña 4
Término   (RF04) | Fecha inicio, fecha fin, FK actuación
```

Nótese el `FK actuación` del término. **Al reescribir los requisitos de RF01–RF09 a RF01–RF54
la entidad desapareció y nadie lo notó.** En `sistema.docx` la palabra "actuación" aparece
una sola vez, en RF25, y como adjetivo. El README siguió prometiéndola porque en el diseño
original sí existía.

**Qué se hizo.** Se adoptó la Opción B (modelarla), porque el objetivo del cliente
—*"administre el expediente digital de cada caso"*— y su problema declarado
—*"los términos judiciales vencen por falta de seguimiento"*— describen una cadena
**actuación → término → alerta** que estaba rota en su primer eslabón: los términos existían
flotando, sin el hecho procesal que los origina.

| Elemento | Dónde |
|---|---|
| Modelo `Actuacion` + `enum TipoActuacion` (10 valores) | `schema.prisma` |
| `TerminoJudicial.id_actuacion` (opcional) | `schema.prisma` |
| Módulo backend con 4 endpoints | `src/modules/actuaciones/` |
| Pestaña "Actuaciones" en la ficha del expediente | `ProcesoDetalle.jsx` |
| Requisitos | RF55–RF59 (doc 03) |
| Historia de usuario | HU-37 (doc 04) |
| Decisión razonada | [ADR-010](11-DECISIONES-ARQUITECTONICAS.md) |
| Pruebas | `actuaciones.test.js` (6 casos) |

---

## 3. Auto y sentencia

Ambos son **providencias**, pero no son intercambiables.

| | **Auto** | **Sentencia** |
|---|---|---|
| Qué decide | Trámites, incidentes, medidas, admisión de demanda, pruebas | El fondo: pretensiones, excepciones de mérito, perjuicios |
| Efecto | No termina el proceso | Lo termina (al menos en esa instancia) |
| Estructura | Breve: consideraciones + resolución | Extensa, con la fórmula *"administrando justicia en nombre de la República…"* |
| Recurso | Reposición y, si procede, apelación | Apelación o consulta. **No procede reposición** |
| Efecto de la apelación | Devolutivo (el proceso sigue) | Suspensivo (el proceso se detiene) |

**Regla práctica:** si el juez admite la demanda, dicta un **auto**. Si al final condena o
absuelve, dicta una **sentencia**.

**En el SGPA:** `CategoriaDocumento` incluye `PROVIDENCIA` como categoría única, sin distinguir
auto de sentencia. Es una simplificación aceptable para clasificar archivos, pero **impide
filtrar por tipo de decisión**, que es una consulta natural para un abogado. Si algún día se
crea la entidad `actuaciones`, la distinción debería vivir allí, no en la categoría documental.

---

## 4. Notificación

*"Salvo los casos expresamente exceptuados, ninguna providencia producirá efectos antes de
haberse notificado"* (Art. 289 CGP). La notificación no es un trámite administrativo: es la
condición de eficacia de la decisión judicial.

| Forma | Art. | Cuándo se surte |
|---|:--:|---|
| **Personal** | 290–291 | Regla preferente. El día en que se entrega copia y se firma el acta |
| **Por aviso** | 292 | Subsidiaria. Al finalizar el día siguiente a la entrega del aviso |
| **En estrados** | 294 | Verbalmente en audiencia. Efecto inmediato |
| **Por estado** | 295 | Publicación en el estado del despacho. Al día siguiente |
| **Por conducta concluyente** | 296 | Cuando la parte demuestra conocer la providencia. Desde ese momento |
| **Emplazamiento** | 293 | Si se desconoce el paradero. Si no comparece, se designa curador *ad litem* |

Jerarquía: **personal → por aviso → emplazamiento con curador *ad litem***.

**En el SGPA:** `CategoriaDocumento.NOTIFICACION` permite archivar el soporte documental, pero
el sistema **no modela la forma de notificación ni la fecha en que se surtió**. Dado que de esa
fecha depende el inicio de casi todos los términos, es una omisión relevante si alguna vez se
quiere calcular vencimientos.

---

## 5. Término judicial y el concepto de "perentorio"

**Término judicial:** la oportunidad que la ley o el juez fija para realizar un acto procesal.

| Tipo | Quién lo fija | Ejemplo |
|---|---|---|
| Legal | La ley | 10 días para contestar la demanda (Art. 368) |
| Judicial | El juez, a falta de término legal | 5 días para aportar un documento |
| Convencional | Acuerdo de las partes | Fecha pactada para conciliación |

**Cómputo (Art. 118):** se cuentan **días hábiles** — no cuentan sábados, domingos, festivos ni
vacancia judicial. Si el vencimiento cae en día inhábil, se corre al primer día hábil siguiente.

**Perentorio (Art. 117):** al vencerse el plazo, **se extingue de pleno derecho** la facultad.
No hace falta que un juez lo declare: opera por ministerio de la ley. En la práctica:

- El acto extemporáneo **no surte efecto**. La demanda, el recurso o la prueba quedan sin valor.
- El plazo **no se prorroga**, salvo autorización legal expresa.
- La consecuencia es la **caducidad del derecho** o la **preclusión de la oportunidad**.

Aquí está la razón de ser de todo este sistema: un término vencido no es un recordatorio
olvidado, es un derecho perdido y, potencialmente, una sanción disciplinaria para el abogado.

### Cómo lo modela el SGPA

| Aspecto | Implementación | Evaluación |
|---|---|---|
| Registro manual del vencimiento | `TerminoJudicial.fecha_vencimiento` | ✅ Correcto |
| Cálculo automático en días hábiles | **No se hace** | ✅ **Decisión correcta** — ver abajo |
| Alerta antes del vencimiento | 3 recordatorios configurables | ✅ |
| Visibilidad hasta gestión manual | `estado: PENDIENTE`, sin corte por fecha (RF34) | ✅ |
| Clasificación de cumplimiento tardío | Automática y no sobrescribible (RN07) | ✅ Refleja fielmente el carácter perentorio |

> **Por qué no calcular es lo correcto.** La investigación lo verificó contra cinco productos
> comerciales colombianos: *"Nadie en el mercado calcula términos. Todos registran la fecha y
> alertan."* Calcular exigiría mantener el calendario oficial de festivos y vacancias que el
> Consejo Superior de la Judicatura publica cada año, más decenas de reglas por tipo de proceso,
> actuación y sujeto. La fecha de vencimiento **ya viene calculada por el secretario del juzgado**
> y publicada en el portal judicial. El sistema la recibe; no la inventa. Esta decisión está
> formalizada en [ADR-008](11-DECISIONES-ARQUITECTONICAS.md).

---

## 6. Sujetos procesales

| Sujeto | Qué es | Puntos clave |
|---|---|---|
| **Demandante** | Quien inicia el proceso formulando pretensiones | Debe actuar por medio de abogado, salvo excepciones (Art. 73) |
| **Demandado** | Contra quien se dirigen las pretensiones | Se incorpora por notificación personal del auto admisorio; 10 días para contestar |
| **Apoderado judicial** | El abogado a quien se confiere poder | Poder general o especial (Art. 74). Se entiende notificado por conducta concluyente desde que se le reconoce personería |
| **Curador *ad litem*** | Designado cuando el demandado no comparece tras emplazamiento | Art. 293 |
| **Tercero interviniente** | Quien se vincula sin ser parte inicial | — |

**Representante legal ≠ apoderado judicial.** El primero deriva de la ley o del acto
constitutivo (el padre de un menor, el gerente de una sociedad) y representa en todos los actos.
El segundo deriva de un contrato de mandato y solo actúa en los actos judiciales que el poder
le confiere.

### ⚠️ Brecha: el catálogo de partes está incompleto

```prisma
enum TipoParte { DEMANDANTE, DEMANDADO, VICTIMA, TERCEROS, CLIENTE, OTRO }
```

La investigación documentó que en la Consulta de Procesos Nacional Unificada el campo "Tipo"
es un **catálogo cerrado** que incluye, entre otros, `APODERADO` y `CURADOR AD LITEM`.
Ninguno de los dos existe en el enum, y ambos son roles cotidianos.

**Corrección sugerida:** añadir `APODERADO` y `CURADOR_AD_LITEM` al enum. Coste: 20 minutos.
También conviene revisar el valor `CLIENTE`: no es una categoría procesal real, es una
etiqueta interna del despacho. Puede convivir, pero conviene documentar que no proviene del CGP.

---

## 7. Juzgado, despacho y secretaría

Se usan casi como sinónimos, pero designan niveles distintos (Ley 270 de 1996, arts. 21 y 51):

| Concepto | Qué es | Alcance |
|---|---|---|
| **Juzgado** | La unidad institucional: el órgano jurisdiccional creado por ley, con competencia y sede. Es la "célula básica" | Macro. *"Juzgado 3.º Civil del Circuito de Bogotá"* |
| **Despacho** | El espacio de trabajo del juez dentro del juzgado: su carga procesal | Meso. Juez + equipo inmediato |
| **Secretaría** | El área administrativa: radica escritos, surte notificaciones, custodia el expediente | Micro. La "ventanilla". **El ciudadano no habla con el juez: habla con la secretaría** |

**En el SGPA:** existe un único campo `Proceso.juzgado String? @db.VarChar(150)`, de texto libre
y opcional. Suficiente para el alcance actual, pero con dos consecuencias:

1. **No es normalizable.** *"Juzgado 3 Civil Circuito Bogotá"* y *"JUZGADO 003 CIVIL DEL CIRCUITO
   DE BOGOTÁ D.C."* son el mismo despacho y el sistema los tratará como distintos. La búsqueda
   por juzgado de RNF05 devolverá resultados incompletos.
2. **Es opcional**, cuando en la práctica todo proceso radicado tiene despacho asignado.

Mejora futura: catálogo de despachos, poblado a partir de los bloques 6–12 del radicado, que
ya contienen esa información codificada.

---

## 8. Ejecutoria y archivo

- **Ejecutoria (Art. 302):** el momento en que la providencia queda en firme, porque venció
  el plazo para recurrirla o se resolvieron los recursos. Es un **estado jurídico**.
- **Archivo:** el acto material de cerrar el expediente. Es un **estado administrativo**.

No son lo mismo, y el SGPA los mezcla: `EstadoProceso` tiene `ARCHIVADO` y `FINALIZADO`, pero
ninguno de los dos captura la ejecutoria. Para el alcance actual es aceptable; conviene saberlo
antes de presentar el modelo como si reflejara el ciclo procesal completo.

---

## 9. Los doce términos, en una línea cada uno

| # | Término | En una frase |
|---|---|---|
| 1 | Rama judicial | El poder que resuelve conflictos |
| 2 | Jurisdicción | El poder del Estado para juzgar |
| 3 | Competencia | Quién concretamente juzga |
| 4 | Proceso | El recipiente que contiene todo |
| 5 | Providencia | Cualquier decisión del juez |
| 6 | Sentencia | La que resuelve el fondo |
| 7 | Audiencia | El momento oral y público |
| 8 | Notificación | Dar a conocer para que produzca efectos |
| 9 | Término perentorio | El plazo que, al vencer, extingue el derecho |
| 10 | Apoderado | El abogado que actúa en nombre de la parte |
| 11 | Cosa juzgada | Lo que ya no se puede volver a discutir |
| 12 | Ejecutoria | El momento en que la providencia queda en firme |

---

## 10. Resumen: brechas entre el dominio y el modelo

| # | Brecha | Severidad | Corrección |
|---|---|:--:|---|
| 1 | ~~No existe la entidad **Actuación**~~ | — | ✅ **RESUELTO el 1/09/2026**: se adoptó la Opción B. Modelo `Actuacion`, módulo `actuaciones`, RF55–RF59, HU-37 y pestaña propia en la ficha del expediente |
| 2 | `TipoParte` no incluye `APODERADO` ni `CURADOR_AD_LITEM` | Media | Añadir al enum |
| 3 | El radicado no valida su formato de 21/23 dígitos | Media | Validación en backend |
| 4 | `juzgado` es texto libre y opcional | Media | Catálogo de despachos (futuro) |
| 5 | No se registra la **forma ni la fecha de notificación** | Media | Solo relevante si se implementa cálculo de términos |
| 6 | `PROVIDENCIA` no distingue auto de sentencia | Baja | Aceptable como categoría documental |
| 7 | No se modela la **ejecutoria** | Baja | Aceptable en el alcance actual |

---

## Anexo — Matriz de supuestos de la investigación

`investigacion.docx` cierra con una declaración metodológica que conviene conservar tal cual
para la sustentación, porque es honesta y bien construida: el levantamiento de requisitos
**fue documental**, no hubo entrevista con un abogado en ejercicio, y la priorización se derivó
de un benchmark de cinco productos comerciales colombianos y de la transcripción de cinco
procesos reales en la Consulta de Procesos Nacional Unificada.

Los doce supuestos declarados, con su nivel de riesgo:

| ID | Supuesto | Impacto | Confianza |
|---|---|---|---|
| SUP-01 | La prioridad viene del benchmark, no de entrevista con usuario experto | Alto | Media |
| SUP-02 | El canal de alerta es correo + web | Medio | Alta |
| SUP-03 | El portal del cliente es mínimo (estado + fechas) | Bajo | Media |
| SUP-04 | Volumen: 1 abogado, 10–20 procesos, ~50 archivos | Medio | Media |
| SUP-05 | Los términos se cuentan en días hábiles | Alto* | Alta |
| SUP-06 | El sistema **no calcula** términos: registra y vigila | Medio | Alta |
| SUP-07 | El equipo domina Node/TypeScript | Bajo | Alta |
| SUP-08 | El VPS tiene RAM y disco suficientes | Medio | Baja |
| SUP-09 | La Consulta de Procesos Nacional Unificada será estable | Bajo | Alta |
| SUP-10 | Los catálogos de sujeto y actuación son cerrados | Bajo | Media |
| SUP-11 | El proveedor de correo alcanza para el volumen | Bajo | Alta |
| SUP-12 | El instructor acepta el stack sin exigir Docker | Bajo | Media |

\* El impacto de SUP-05 baja a bajo si el sistema no calcula, que es la decisión adoptada (SUP-06).

**Advertencia sobre esta matriz:** describe un MVP con un alcance y un stack **distintos**
del sistema que finalmente se construyó (ver hallazgo H-10). SUP-03, en particular, propone
un portal **sin descarga de documentos** — y la plataforma sí la implementa. Al citar esta
matriz hay que decir explícitamente que corresponde a una fase previa de exploración.
