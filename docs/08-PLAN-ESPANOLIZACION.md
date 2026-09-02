# 08 — Plan de españolización de la interfaz

**Objetivo:** dejar la interfaz completamente en español, que es el idioma de los usuarios
(abogados y consultorios colombianos), **sin tocar una sola línea de estilos**.

**Restricción absoluta de este plan:** ningún cambio propuesto modifica clases de Tailwind,
colores, espaciados, tipografías, animaciones ni estructura de componentes. Solo se sustituye
**el texto entre etiquetas y el valor de atributos `placeholder`**. El diseño visual queda
exactamente igual.

> ✅ **EJECUTADO el 1 de septiembre de 2026.** Durante la ejecución aparecieron **cinco cadenas
> que este inventario no había detectado**, porque el `grep` inicial no cubría etiquetas
> partidas en varias líneas ni el `index.html`:
>
> | Dónde | Era | Quedó |
> |---|---|---|
> | `index.html` — `<title>` | `SGPA - Legal System` | `SGPA - Sistema de Gestión de Procesos de Abogados` |
> | `index.html` — `<html lang>` | `en` | `es` |
> | `RegisterPage.jsx:196` | `Tax ID (NIT) - Optional` | `NIT - Opcional` |
> | `RegisterPage.jsx:214` | `Phone - Optional` | `Teléfono - Opcional` |
> | `ProcesoDetalle.jsx:1872, 2061` | `<option>Email</option>` | `<option>Correo</option>` |
>
> Las dos de `RegisterPage` solo se ven al elegir el perfil "Consultorio", por eso pasaron
> desapercibidas. Se detectaron con un barrido exhaustivo sobre **todos** los `.jsx`, que es el
> método que debió usarse desde el principio (ver la sección 5, «Cómo verificar que no quedó nada»).
>
> **Total real: 61 cadenas + 2 correcciones de marca.**

---

## 1. Alcance: qué se traduce y qué no

| Categoría | ¿Traducir? | Razón |
|---|:--:|---|
| Textos visibles en pantalla | ✅ **Sí** | Es el problema real: el usuario los lee |
| `placeholder` de campos | ✅ Sí | Visibles |
| Etiquetas de menú y navegación | ✅ Sí | Visibles |
| Comentarios del código | ✅ Sí, gradualmente | ~177 de 275 están en inglés; conviene unificar, sin urgencia |
| **Nombres de funciones y variables** | ❌ **No** | `createProceso`, `getAlertasVencimientos`, `tenant_id`. Renombrarlos es una refactorización de alto riesgo y beneficio nulo. Además, ya son mayoritariamente españoles o términos técnicos estándar |
| **Nombres de tablas y columnas** | ❌ No | Ya están en español; cambiarlos exige migración de datos |
| **Valores de enums** | ❌ No | `ADMINISTRADOR`, `PENDIENTE`, `COMPARTIDO_CLIENTE`. Son datos persistidos; ya están en español |
| Rutas de la URL | ❌ No | Ya están en español (`/procesos`, `/clientes`, `/ajustes`) |
| Nombres de archivos | ❌ No | `LoginPage.jsx` es convención de React; cambiarlo rompe importaciones sin beneficio |

> **El principio:** se traduce lo que el usuario ve, no lo que el programador escribe. Es lo que
> hace cualquier equipo profesional, y evita convertir una corrección de una tarde en una
> refactorización de una semana.

---

## 2. Un problema previo, más urgente que el idioma: la marca

Antes de traducir nada, hay que arreglar esto (hallazgo H-24):

| Archivo | Línea | Muestra | Debe mostrar |
|---|:--:|---|---|
| `pages/auth/TwoFactorPage.jsx` | 51 | `Lexica` | `SGPA` |
| `pages/auth/VerificacionPage.jsx` | 46 | `Lexica` | `SGPA` |

Todas las demás pantallas dicen **SGPA**. Un usuario se registra en "SGPA", recibe el correo,
hace clic en el enlace de verificación y aterriza en una marca **distinta**. Eso se lee como
un intento de suplantación y rompe la confianza justo en el momento más delicado.

**Son dos cadenas de texto. Dos minutos de trabajo. Es la corrección de mayor impacto por
esfuerzo de todo este plan.**

---

## 3. Inventario completo de cadenas a traducir

Seis archivos. Ninguno de ellos es una página de negocio: **el resto de la aplicación ya está
en español**. El inglés se concentra en los layouts y en el flujo de autenticación.

### 3.1 `components/layout/DashboardLayout.jsx`

| Línea | Actual | Propuesto |
|:--:|---|---|
| 35 | `Dashboard` | `Panel principal` |
| 36 | `Clients` | `Clientes` |
| 37 | `Legal Cases` | `Expedientes` |
| 41 | `Access Control` | `Control de acceso` |
| 42 | `Reports` | `Reportes` |
| 43 | `Audit Logs` | `Bitácora de auditoría` |
| 47 | `Settings` | `Ajustes` |
| 72 | `Legal System` | `Sistema jurídico` |
| 79 | `Main Menu` | `Menú principal` |
| 100 | `Administration` | `Administración` |
| 123 | `System` | `Sistema` |
| 164 | `Sign Out` | `Cerrar sesión` |
| 175 | `SGPA Workspace` | `Espacio de trabajo SGPA` |

> **Cuidado con el ancho.** `Bitácora de auditoría` es notablemente más largo que `Audit Logs`.
> La barra lateral mide `w-72` (288 px) y el texto usa `text-sm`; entra sin problema, pero
> conviene verificarlo visualmente tras el cambio. Alternativa más corta si hiciera falta:
> `Auditoría`.

### 3.2 `components/layout/PortalLayout.jsx`

| Línea | Actual | Propuesto |
|:--:|---|---|
| 37 | `My Cases` | `Mis procesos` |
| 38 | `Settings` | `Ajustes` |
| 61 | `Client Portal` | `Portal del cliente` |
| 68 | `Main Menu` | `Menú principal` |
| 109 | `Sign Out` | `Cerrar sesión` |
| 120 | `Portal Workspace` | `Portal del cliente` |

### 3.3 `pages/auth/LoginPage.jsx`

| Línea | Actual | Propuesto |
|:--:|---|---|
| 71 | `alt="Legal background"` | `alt="Fondo jurídico"` |
| 101 | `Legal System` | `Sistema jurídico` |
| 106 | `Welcome to SGPA` | `Bienvenido a SGPA` |
| 107 | `Secure Portal for Legal Professionals` | `Portal seguro para profesionales del derecho` |
| ~123 | `Email Address` | `Correo electrónico` |
| 130 | `placeholder="Enter your email"` | `placeholder="Ingresa tu correo"` |
| ~140 | `Password` | `Contraseña` |
| ~166 | `Forgot Password?` | `¿Olvidaste tu contraseña?` |
| 182 | `'Locked'` | `'Bloqueado'` |
| 182 | `'Sign In'` | `'Iniciar sesión'` |
| ~190 | `New User?` | `¿Eres nuevo?` |
| ~192 | `Register Now` | `Regístrate aquí` |

> **Nota sobre "¿Olvidaste tu contraseña?":** ese enlace es hoy `<Link to="#">` — no hace nada.
> Traducirlo sin implementarlo mejora la apariencia y empeora la experiencia: el usuario
> entenderá mejor un enlace que sigue sin funcionar. **Recomendación:** o se implementa la
> recuperación (ver doc 10), o se oculta el enlace hasta que exista.

### 3.4 `pages/auth/RegisterPage.jsx`

| Línea | Actual | Propuesto |
|:--:|---|---|
| 43 | `alt="Legal background"` | `alt="Fondo jurídico"` |
| 77 | `Create an Account` | `Crear una cuenta` |
| 78 | `Select your profile type to join SGPA` | `Elige tu tipo de perfil para unirte a SGPA` |
| 92 | `Independent` | `Independiente` |
| 104 | `Firm / Office` | `Consultorio` |
| 112 | `Firm Name *` | `Nombre del consultorio *` |
| 120 | `placeholder="Enter the firm's name"` | `placeholder="Nombre del consultorio"` |
| 130 | `Full Name (Admin) *` | `Nombre completo del administrador *` |
| 138 | `placeholder="Enter admin full name"` | `placeholder="Nombre y apellidos"` |
| 149 | `Email Address *` | `Correo electrónico *` |
| 167 | `Password *` | `Contraseña *` |
| 246 | `'Complete Registration'` | `'Completar registro'` |
| 251 | `Already have an account?` | `¿Ya tienes una cuenta?` |
| 254 | `Sign In Here` | `Inicia sesión aquí` |

> Los `placeholder` `"Ej. 900123456"` (NIT) y `"Ej. 3001234567"` (teléfono) **ya están en
> español** y no se tocan. Los mensajes de validación de `react-hook-form` también.

### 3.5 `pages/auth/TwoFactorPage.jsx`

| Línea | Actual | Propuesto |
|:--:|---|---|
| 51 | `Lexica` | **`SGPA`** ← corrección de marca |
| 58 | `Two-Factor Auth` | `Verificación en dos pasos` |
| 59 | `Enter the 6-digit code sent to your email` | `Ingresa el código de 6 dígitos enviado a tu correo` |
| 65 | `Security Code` | `Código de seguridad` |
| 89 | `'Verify Identity'` | `'Verificar identidad'` |

### 3.6 `pages/auth/VerificacionPage.jsx`

| Línea | Actual | Propuesto |
|:--:|---|---|
| 46 | `Lexica` | **`SGPA`** ← corrección de marca |
| 60 | `'Verifying Account...'` | `'Verificando tu cuenta…'` |
| 61 | `'Account Verified!'` | `'¡Cuenta verificada!'` |
| 62 | `'Verification Failed'` | `'No pudimos verificar tu cuenta'` |
| 66 | `'Please wait while we confirm your credentials.'` | `'Espera un momento mientras confirmamos tus datos.'` |
| 67 | `'Your email has been confirmed successfully. You can now securely access the system.'` | `'Tu correo fue confirmado. Ya puedes ingresar al sistema.'` |
| 68 | `'The verification link may have expired or is invalid. Please try registering again or contact support.'` | `'El enlace de verificación es inválido o ya expiró. Intenta registrarte de nuevo o contacta al administrador.'` |
| 76 | `Return to Login` | `Volver al inicio de sesión` |

---

## 4. Glosario de traducción: decisiones y su porqué

Traducir bien no es traducir literal. Estas son las decisiones que conviene fijar de antemano
para que el resultado sea coherente:

| Inglés | ❌ Literal | ✅ Adoptado | Por qué |
|---|---|---|---|
| Legal Cases | Casos legales | **Expedientes** | Es el término que usa un abogado colombiano. "Caso legal" es calco del inglés. Además, el resto del sistema ya dice "expediente" |
| Access Control | Control de accesos | **Control de acceso** | Singular, como en la literatura de seguridad en español |
| Audit Logs | Registros de auditoría | **Bitácora de auditoría** | Es el término que ya usa toda la documentación del proyecto (RN01, RNF03) |
| Firm / Office | Firma / Oficina | **Consultorio** | Es el término del dominio, y el valor del enum ya es `CONSULTORIO` |
| Dashboard | Tablero | **Panel principal** | "Panel" es lo habitual en español; las HU dicen "panel principal" |
| Sign In | Ingresar | **Iniciar sesión** | Coherente con RF01 y con "Cerrar sesión" |
| Workspace | Espacio de trabajo | **Espacio de trabajo** | Traducción directa correcta |
| My Cases | Mis casos | **Mis procesos** | El cliente ve *procesos*, que es como su abogado se los nombra |
| Two-Factor Auth | Autenticación de dos factores | **Verificación en dos pasos** | Más corto y más comprensible para el usuario final. El término técnico "2FA" se conserva en la documentación |

**Regla de tratamiento:** el sistema tutea al usuario (*"Ingresa tu correo"*, *"¿Ya tienes una
cuenta?"*), que es lo que ya hacen los mensajes en español existentes. Mantener esa coherencia:
no mezclar tuteo con usted en la misma aplicación.

**Tildes y signos de apertura:** obligatorios. `¿Olvidaste tu contraseña?`, no
`Olvidaste tu contraseña?`. Es un detalle que distingue una traducción profesional de una hecha
a la carrera.

---

## 5. Cómo ejecutarlo con seguridad

Cinco pasos. El plan está diseñado para que cada paso sea verificable por separado.

**Paso 1 — Marca (2 min).** Cambiar `Lexica` por `SGPA` en los dos archivos. Es independiente
del resto y se puede confirmar de inmediato.

**Paso 2 — Layouts (15 min).** `DashboardLayout.jsx` y `PortalLayout.jsx`. Afectan a todas las
pantallas, así que un error se nota enseguida. Verificar el ancho de la barra lateral con
`Bitácora de auditoría`.

**Paso 3 — Autenticación (30 min).** Las cuatro páginas de `pages/auth/`. Es el flujo que ve
un usuario nuevo, así que conviene recorrerlo entero: registro → correo → verificación →
inicio de sesión → 2FA.

**Paso 4 — Verificación visual.** Compilar y revisar en tres anchos:

```bash
cd frontend && npm run build && npm run preview
```

Revisar en 360 px, 768 px y 1440 px, que son los límites que fija RNF04.

**Paso 5 — Comentarios del código (opcional, sin urgencia).** Traducir los ~177 comentarios en
inglés del backend. **Sin prisa y sin mezclar con lo anterior**: un cambio de comentarios que
viaja en el mismo commit que un cambio de interfaz hace la revisión imposible.

### Cómo verificar que no quedó nada

```bash
cd frontend/src
grep -rnE "Sign (In|Out)|Dashboard'|Clients|Legal Cases|Access Control|Audit Logs|Settings'|Main Menu|Welcome to|Create an Account|Verify Identity|Return to Login|My Cases|Client Portal|Lexica" --include=*.jsx .
```

Debe devolver únicamente coincidencias en nombres de iconos de `lucide-react`
(por ejemplo `Settings` importado como icono), nunca en texto visible.

---

## 6. Sobre no introducir i18n

Sería tentador instalar `react-i18next` y extraer todo a archivos de traducción. **No conviene
hacerlo ahora**, por tres razones:

1. **No hay un segundo idioma previsto.** El sistema es para consultorios colombianos.
2. Añadiría una dependencia, un contexto y un `useTranslation()` en cada componente: mucha
   superficie de cambio para cero beneficio inmediato.
3. Contradice la restricción del proyecto de no alterar la estructura existente.

Si algún día se necesita, el camino natural es extraer primero las cadenas a un módulo
`src/i18n/es.js` y solo después introducir la librería. Pero eso es una decisión futura,
no parte de esta corrección.

---

## 7. Resumen

| | |
|---|---|
| **Archivos a modificar** | 6 |
| **Cadenas a traducir** | 56 |
| **Correcciones de marca** | 2 |
| **Esfuerzo estimado** | ~1 hora, incluida la verificación visual |
| **Riesgo** | **Muy bajo** — solo texto; ni una clase CSS se toca |
| **Reversible** | Sí, completamente |
