# 16 — Correo saliente y entregabilidad

**Fecha:** 2 de septiembre de 2026
**Problema que resuelve:** los correos de verificación de cuenta llegan a la carpeta de spam.

---

## 1. El diagnóstico, y una corrección

La primera hipótesis fue *«faltan los registros SPF, DKIM y DMARC del dominio»*. **Era falsa**,
y conviene dejarlo escrito para que nadie pierda una tarde en el panel de DNS.

El código enviaba así:

```js
const transporter = nodemailer.createTransport({ service: 'gmail', ... });
// …
from: `"SGPA Notificaciones" <${process.env.GMAIL_USER}>`
```

Es decir: **el remitente es una dirección `@gmail.com`, no del dominio del sistema.**

SPF, DKIM y DMARC autentican **al dominio que envía**. Aquí quien envía es `gmail.com`, que ya
los tiene publicados y los pasa perfectamente. Añadir esos registros a `proyectosena.online` no
cambiaría nada, porque ese dominio no interviene en el envío.

### La causa real

Los servidores que reciben ven correo transaccional de una plataforma saliendo de una cuenta
personal gratuita:

- **Discordancia entre lo visible y lo firmado.** El nombre dice «SGPA Notificaciones»; la
  dirección real es `algo@gmail.com`. Es un patrón clásico de suplantación.
- **Sin reputación de remitente.** Una cuenta gratuita de Gmail no tiene historial como emisor
  de avisos automáticos de un servicio.
- **Proporción enlace/texto.** El correo de verificación es casi todo un botón y un enlace.

---

## 2. La solución

Enviar desde el propio dominio: `no-responder@proyectosena.online`. Ahí **sí** entran en juego
SPF, DKIM y DMARC, y ahí sí Hostinger es la respuesta, porque gestiona el DNS.

El código ya no tiene Gmail incrustado. Basta con definir `SMTP_HOST` en `backend/.env` para que
cambie de vía; si se deja vacío, sigue usando Gmail exactamente como antes.

```bash
SMTP_HOST="smtp.hostinger.com"
SMTP_PORT=465
SMTP_USER="no-responder@proyectosena.online"
SMTP_PASS="la-contraseña-del-buzón"
MAIL_FROM="SGPA · Sistema Jurídico <no-responder@proyectosena.online>"
```

Después:

```bash
docker compose up -d --build backend
```

### Pasos en Hostinger

1. **Comprobar si el plan incluye correo.** En el panel, *Correos electrónicos*. La mayoría de
   los planes de hosting lo traen (propio o Titan).
2. **Crear el buzón** `no-responder@proyectosena.online`.
3. **Confirmar los registros DNS.** Como Hostinger lleva también el DNS del dominio, al crear el
   buzón suele añadir SPF y DKIM automáticamente. Conviene verificarlo en *DNS / Nameservers*:
   debe existir un TXT con `v=spf1 ...` y otro de DKIM.
4. **Añadir DMARC si no está.** Registro TXT en `_dmarc`:

   ```
   v=DMARC1; p=none; rua=mailto:tucorreo@proyectosena.online
   ```

   Se empieza con `p=none` a propósito: solo informa, no rechaza nada. Cuando lleguen los
   informes y se confirme que todo el correo legítimo pasa, se puede endurecer a `p=quarantine`.
   Poner `p=reject` de entrada es la forma más rápida de que dejen de llegar correos válidos.

5. **Copiar el host y el puerto SMTP** que indique Hostinger al `.env`.

### Si el plan NO incluye correo

Un servicio de correo transaccional con nivel gratuito (Brevo, Resend y similares). Verifican el
dominio con unos registros que se pegan en Hostinger y dan un `SMTP_HOST` propio. Mejor
entregabilidad que Gmail y con informes de entrega.

---

## 3. Mientras tanto

Nada se rompe. Si `SMTP_HOST` está vacío, el sistema sigue enviando por Gmail igual que hasta
ahora. En producción escribe un aviso al arrancar para que quede constancia en los registros:

```
[Correo] Enviando desde una cuenta de Gmail. Los mensajes pueden acabar en spam porque el
remitente no pertenece al dominio del sistema. …
```

---

## 4. Un riesgo que sigue abierto

**No existe forma de reenviar el correo de verificación.** Si el mensaje se pierde o va a spam y
el usuario lo borra, su cuenta queda creada pero inactiva y **no puede hacer nada por su cuenta**.
Hoy solo se resuelve activándola a mano:

```bash
docker compose exec postgres psql -U sgpa -d sgpa \
  -c "UPDATE usuario SET activo = true, token_verificacion = NULL WHERE email = 'CORREO';"
```

Es el punto 4.2 del [plan de remediación](10-PLAN-DE-REMEDIACION.md) y gana importancia mientras
los correos sigan yendo a spam: cada mensaje perdido es un usuario bloqueado.
