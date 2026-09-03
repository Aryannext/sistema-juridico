# 02 — Reglas de negocio

**Nueve reglas.** Van **antes** que los requisitos a propósito: existen aunque no se construya
el software. Vienen del derecho procesal colombiano y de cómo funciona un despacho. Los
requisitos son la **respuesta del sistema** a estas reglas, no al revés.

Cada ficha responde a lo mismo: qué exige la regla, **de dónde sale**, cómo se cumple en el
código y cómo comprobarlo.

---

## RN01 · La bitácora es de solo lectura, incluso para el Administrador

**Qué exige.** Ninguna acción registrada en la bitácora de auditoría puede editarse ni
borrarse. Nadie, ni el titular del consultorio.

**De dónde sale.** Una bitácora que su propio administrador puede alterar no sirve como prueba
de nada. Su valor entero depende de ser inmutable: si el registro puede modificarse, deja de
responder «quién hizo qué» y pasa a responder «qué quiso alguien que constara».

**Cómo se cumple.** No existe ninguna operación de escritura sobre la bitácora fuera de la
creación. `GET /api/admin/auditoria` es el único acceso; no hay `update` ni `delete` en ningún
punto del backend.

**Cómo comprobarlo.** Buscar `bitacoraAuditoria.update` o `bitacoraAuditoria.delete` en
`backend/src`: no aparecen.

**Requisitos que la implementan:** RF05, RNF03 · **Historia:** HU-03

---

## RN02 · Límites del acceso administrativo

**Qué exige.** El Administrador del consultorio, pese a ser el rol de mayor privilegio, **no
puede**:

1. Editar la bitácora de auditoría *(ver RN01)*.
2. Cerrar una alerta crítica dirigida a otra persona, salvo que su destinatario esté inactivo.
3. Suplantar a un cliente en el portal.

**De dónde sale.** El privilegio administrativo sirve para organizar el despacho, no para
sustituir la responsabilidad individual. Si el Administrador pudiera cerrar la alerta de un
término dirigida a otro abogado, quedaría constancia de que la alerta fue atendida sin que
nadie la atendiera de verdad.

**Cómo se cumple.** `gestionarNotificacion` verifica que quien cierra sea el destinatario, o
Administrador **con el destinatario inactivo**. El portal exige `rol === 'CLIENTE'`, de modo que
un administrador no puede entrar por esa vía.

**Requisitos:** RF41, RF43, RF48–RF50 · **Historias:** HU-27, HU-30

---

## RN03 · Un proceso cerrado no se reabre sin autorización y justificación

**Qué exige.** Un expediente en estado **FINALIZADO** o **ARCHIVADO** no vuelve a **ACTIVO**
salvo que lo autorice el Administrador, y siempre con justificación escrita.

**De dónde sale.** Cerrar un proceso es una afirmación con consecuencias: significa que el
despacho ya no vigila sus términos ni su agenda. Reabrirlo sin dejar constancia permitiría
alterar el historial de un caso sin rastro de quién lo decidió ni por qué.

**Cómo se cumple.** `cambiarEstadoProceso` bloquea la transición si el rol no es Administrador, y
exige `justificacion` en toda petición. La justificación queda en el historial del expediente.

**Cómo comprobarlo en la plataforma.** Archivar un expediente, intentar reactivarlo como Abogado:
responde **403**. Intentarlo sin justificación: responde **400**.

**Requisitos:** RF13, RF14 · **Historia:** HU-09

---

## RN04 · Un proceso siempre tiene al menos un abogado responsable

**Qué exige.** No puede existir un expediente sin alguien que responda por él.

**De dónde sale.** Un proceso sin responsable es un proceso cuyos términos no vigila nadie. En
la práctica del despacho, es el escenario del que nace el problema entero.

**Cómo se cumple hoy — y hasta dónde.** El campo `id_abogado_resp` es obligatorio en la base de
datos, así que **nunca puede quedar vacío**. Quitar colaboradores adicionales es seguro porque
el responsable principal es otro campo.

> ⚠️ **Cumplimiento parcial, declarado.** No se valida el cambio del responsable principal ni se
> impide que apunte a un usuario **inactivo**. Un abogado desvinculado del despacho podría
> seguir figurando como responsable. Registrado como pendiente en
> [el plan de remediación](../../docs/10-PLAN-DE-REMEDIACION.md).

**Requisitos:** RF12 · **Historia:** HU-08

---

## RN05 · No se archiva un expediente con pendientes vivos

**Qué exige.** No se puede archivar un expediente que tenga **términos pendientes sin gestionar**
o **audiencias programadas en los próximos 30 días**. El Administrador puede forzarlo, pero solo
de forma explícita y viendo antes qué queda pendiente.

**De dónde sale.** Archivar apaga la vigilancia. Si el expediente tiene un término corriendo,
archivarlo equivale a decidir que ese plazo se va a vencer. Debe ser una decisión consciente, no
un descuido.

**Cómo se cumple.** `cambiarEstadoProceso` consulta términos pendientes y audiencias dentro de
30 días. Si hay, responde **400** con la lista concreta. Solo el Administrador puede repetir la
petición con `force: true`.

**Cómo comprobarlo.** Crear un término pendiente e intentar archivar el expediente: el sistema
enumera qué lo impide.

**Requisitos:** RF13 · **Historia:** HU-09

---

## RN06 · Un documento inactivo o reemplazado no se reactiva

**Qué exige.** Un documento marcado como **INACTIVO** o **REEMPLAZADO** no puede volver a estado
activo.

**De dónde sale.** El versionado documental sirve para saber qué versión estaba vigente en cada
momento. Si una versión reemplazada pudiera reactivarse, dos documentos podrían reclamar ser el
vigente y el historial dejaría de ser fiable.

**Cómo se cumple.** `updateDocumentoEstado` rechaza cualquier transición hacia activo desde esos
dos estados.

**Requisitos:** RF25, RF26 · **Historia:** HU-16

---

## RN07 · El cumplimiento tardío se clasifica solo, y sobrescribirlo deja rastro

**Qué exige.** Si un término se marca como **CUMPLIDO** después de su fecha de vencimiento, el
sistema lo reclasifica automáticamente como **CUMPLIDO_TARDÍO**. Solo el Administrador puede
sobrescribir esa clasificación, y hacerlo queda registrado en la bitácora.

**De dónde sale.** Es la regla con más peso jurídico de todas. Un término judicial es
**perentorio**: cumplirlo tarde **no es cumplirlo**. La distinción entre cumplimiento y
cumplimiento tardío puede ser exactamente lo que se discuta en una reclamación de
responsabilidad profesional. Permitir que se registre como cumplido a secas sería falsear el
historial del caso.

**Cómo se cumple.** `gestionarTermino` compara la fecha actual con el vencimiento y reclasifica
antes de guardar. La sobrescritura administrativa genera la entrada
`SOBREESCRITURA_TERMINO_TARDIO` en la bitácora.

**Cómo comprobarlo.** Crear un término con vencimiento pasado y marcarlo como cumplido: el
estado resultante es `CUMPLIDO_TARDIO`. Está entre las 34 comprobaciones automáticas de
`npm --prefix backend run verificar`.

**Requisitos:** RF35, RF37 · **Historia:** HU-23

---

## RN08 · Una alerta crítica solo la cierra su destinatario

**Qué exige.** Una notificación de prioridad **alta** solo puede marcarla como gestionada la
persona a quien va dirigida. El Administrador puede hacerlo únicamente si ese destinatario está
inactivo.

**De dónde sale.** Cerrar una alerta es afirmar «me he ocupado de esto». Si otra persona pudiera
cerrarla, el sistema registraría una atención que no ocurrió, y el abogado responsable perdería
el aviso sin haberlo visto. La excepción del destinatario inactivo existe para que las alertas
de alguien que dejó el despacho no queden bloqueadas para siempre.

**Cómo se cumple.** `gestionarNotificacion` verifica destinatario, prioridad y estado del
usuario antes de permitir el cierre.

**Requisitos:** RF48–RF50 · **Historia:** HU-30

---

## RN09 · El rojo se reserva para riesgo procesal o disciplinario

**Qué exige.** En toda la interfaz, el color rojo indica **únicamente** riesgo procesal —un
término vencido, una audiencia inminente sin preparar— o riesgo disciplinario. Nunca se usa como
recurso decorativo ni para llamar la atención sobre algo sin consecuencias.

**De dónde sale.** El semáforo solo sirve si significa siempre lo mismo. Un abogado que ve rojo
en pantallas donde no hay riesgo aprende a ignorarlo, y el día que el rojo importe de verdad no
lo mirará. Es una regla de diseño con consecuencia operativa.

**Cómo se cumple.** El panel principal aplica el criterio en el semáforo de riesgos: rojo para
términos vencidos, ámbar para los que vencen en menos de 48 horas, verde para el resto.

> **Origen distinto al de las demás.** Esta regla se citaba en las historias de usuario como
> «RN09» **sin estar definida en ninguna parte**. Se detectó en la auditoría de coherencia
> (hallazgo H-13) y se formalizó aquí a partir del criterio que el código ya aplicaba.

**Requisitos:** RF38–RF40 · **Historia:** HU-24

---

## Resumen de cumplimiento

| Regla | Estado | Nota |
|---|:--:|---|
| RN01 · Bitácora inmutable | ✅ | |
| RN02 · Límites del administrador | 🟡 | Las tres prohibiciones se cumplen; la tercera de forma indirecta |
| RN03 · No reabrir sin autorización | ✅ | |
| RN04 · Siempre un responsable | 🟡 | No valida el cambio de responsable ni el usuario inactivo |
| RN05 · No archivar con pendientes | ✅ | |
| RN06 · No reactivar documentos | ✅ | |
| RN07 · Cumplimiento tardío | ✅ | Verificada automáticamente |
| RN08 · Cierre de alertas críticas | ✅ | |
| RN09 · Semántica del rojo | ✅ | Formalizada a partir del código |

Siete de nueve se cumplen por completo. Las dos parciales están declaradas con el límite exacto,
no marcadas como terminadas.
