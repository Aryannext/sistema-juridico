# SGPA - Sistema de Gestión de Procesos de Abogados

El **SGPA** es una plataforma SaaS B2B robusta, construida con tecnologías modernas web para garantizar escalabilidad, seguridad en los datos sensibles de los casos y alto rendimiento para firmas de abogados (Consultorios) y abogados independientes.

Este repositorio contiene el código fuente completo del sistema, dividido en un Frontend (React/Vite) y un Backend (Node.js/Express).

---

## 📚 Documentación completa

Toda la documentación técnica y funcional del proyecto vive en la carpeta `docs/`:

👉 **[Índice de documentación](./docs/README.md)**

Arquitectura, modelo de datos, catálogo de requisitos (RF/RNF/RN), historias de usuario,
matriz de trazabilidad, catálogo de la API, glosario jurídico y decisiones de arquitectura.

---

## 🏗️ Arquitectura y Especificaciones Técnicas

El sistema está construido como un **monolito modular** desplegado en dos artefactos (una SPA estática y una API REST), que se comunican mediante una API RESTful. El backend se organiza **por dominio de negocio** (`src/modules/procesos`, `src/modules/clientes`, …) y, dentro de cada módulo, por capas: Router → Middlewares → Controlador → Prisma → PostgreSQL.

Implementa además una arquitectura **Multi-Tenant**, donde cada Consultorio Jurídico opera en su propio entorno lógico de datos mediante una columna discriminadora `tenant_id`.

> Detalle completo, con diagramas: **[docs/01-ARQUITECTURA.md](./docs/01-ARQUITECTURA.md)**

### Stack Tecnológico
- **Frontend**: React 19, Vite 8, Tailwind CSS v4, React Router v7, Axios, React Hook Form, Sonner, Lucide React.
- **Backend**: Node.js (v22+, probado en v24), Express.js 4, Prisma ORM v5, JWT (Autenticación), Bcrypt (Hashing), Helmet y Rate-Limiting.
- **Base de Datos**: PostgreSQL 16 en **contenedor propio**, con su propio volumen y sin puertos expuestos a internet (ver [ADR-011](./docs/11-DECISIONES-ARQUITECTONICAS.md)).
- **Almacenamiento de archivos**: Cloudflare R2 (compatible con S3), con URLs firmadas temporales.
- **Tareas programadas**: `node-cron` dentro del propio proceso de la API (recordatorios cada 15 minutos).

### Seguridad y Multi-Tenancy
1. **Multi-Tenancy Lógico**: Todas las consultas a la base de datos están estrictamente encapsuladas por el `tenant_id` del usuario en sesión, garantizando que los datos de un consultorio jamás se filtren a otro.
2. **Encriptación**: Las contraseñas jamás se guardan en texto plano (`bcrypt`).
3. **Control de Acceso (RBAC)**: Roles definidos (`ADMINISTRADOR`, `ABOGADO`, `ASISTENTE`, `CLIENTE`) restringen las acciones permitidas en el sistema.
4. **Auditoría (Logs)**: Toda acción destructiva o de modificación queda registrada de forma inmutable en una Bitácora de Auditoría.

---

## 📖 Manual de Usuario

Hemos preparado un manual de usuario detallado, diseñado para que cualquier persona (incluso sin conocimientos técnicos) aprenda a usar el sistema paso a paso. 

👉 **[Ver el Manual de Usuario Completo Aquí](./docs/MANUAL_USUARIO.md)**

El SGPA está diseñado para ser intuitivo. Aquí tienes un resumen rápido de las funciones principales:

### 1. Panel de Control (Dashboard)
Tu centro de comando. Al ingresar, el sistema te muestra métricas clave, una agenda interactiva y un **Semáforo de Riesgos Procesales** que te alerta si tienes términos (fechas límite) a punto de vencer o si un proceso lleva demasiado tiempo inactivo.

### 2. Gestión de Clientes
- Dirígete a la pestaña **Clientes** para agregar nuevos registros (Personas Naturales o Jurídicas).
- **Portal del Cliente**: Puedes generarle una contraseña temporal a cualquier cliente para que inicie sesión en la misma plataforma. Al entrar, el sistema detecta que es un "Cliente" y le muestra una vista restringida únicamente con los avances de sus propios casos, disminuyendo las llamadas telefónicas al despacho.

### 3. Expedientes y Casos Legales
- Ve a **Procesos** para crear nuevos expedientes (con el número de radicado oficial).
- Dentro de un expediente podrás:
  - Registrar **Actuaciones** (historial del caso).
  - Configurar **Términos** y alarmas.
  - Agendar **Audiencias**.
  - Subir y centralizar **Documentos** probatorios.

### 4. Control de Acceso y Auditoría
Si eres el Administrador del despacho, tienes acceso a la pestaña de **Control de acceso**. Desde allí puedes invitar a tus colegas abogados, asignarles permisos y revisar la Bitácora de Auditoría para saber qué hizo cada empleado y cuándo.

---

## 💻 Guía de Instalación Local (Para Desarrolladores)

Si deseas descargar este repositorio y ejecutarlo en tu máquina local, sigue estas instrucciones detalladas paso a paso.

### Requisitos Previos
- Instalar **Node.js versión 22 o superior** (el proyecto está probado en v24; ver `.nvmrc`).
- Tener **PostgreSQL** disponible: una instancia local, o Docker para levantar el contenedor que ya define `docker-compose.yml`.
- Tener un bucket de **Cloudflare R2** para el almacenamiento de documentos. Sin credenciales de R2 el sistema arranca, pero no se pueden subir archivos.

### Paso 1: Clonar el Repositorio
```bash
git clone https://github.com/Aryannext/sistema-juridico.git
cd sistema-juridico
```

### Paso 2: Configurar la Base de Datos
1. Levanta PostgreSQL. Con Docker basta con `docker compose up -d postgres` desde la raíz
   (requiere un `.env` en la raíz con `POSTGRES_PASSWORD`; ver `.env.example`).
   Si prefieres una instancia local ya instalada, crea una base vacía y sigue al paso 2.
2. En la carpeta `backend`, copia el archivo de ejemplo de variables de entorno:
   ```bash
   cd backend
   cp .env.example .env
   ```
3. Edita tu nuevo archivo `backend/.env` y completa los datos. El archivo `.env.example` documenta **todas** las variables que el código lee, con explicación de cada una.

Ejemplo mínimo de `.env`:
```env
# En local, con PostgreSQL instalado en tu máquina:
DATABASE_URL="postgresql://postgres:TUPASSWORD@localhost:5432/sistema_juridico?schema=public"
DIRECT_URL="postgresql://postgres:TUPASSWORD@localhost:5432/sistema_juridico?schema=public"
# Dentro de Docker el host es "postgres", el nombre del servicio, NUNCA localhost:
# dentro de un contenedor, localhost es el propio contenedor.
JWT_SECRET="alguna_clave_secreta_aleatoria"
PORT=3000

# Necesarias para subir documentos (Cloudflare R2)
R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."

# Base de los enlaces de verificación por correo
FRONTEND_URL="http://localhost:5173/sistema-juridico"
```

> Referencia completa de variables de entorno: **[docs/09-COMPATIBILIDAD-NODE.md](./docs/09-COMPATIBILIDAD-NODE.md)**

### Paso 3: Inicializar el Backend
Dentro de la carpeta `backend`, instala las dependencias y sincroniza el esquema de la base de datos:
```bash
# Instalar dependencias del servidor
npm install

# Generar el cliente de Prisma
npx prisma generate

# Sincronizar el esquema con tu base de datos (crear tablas)
npx prisma db push

# Iniciar el servidor en modo desarrollo
npm run dev
```
El servidor backend quedará corriendo en `http://localhost:3000`.

### Paso 4: Inicializar el Frontend
Abre una **nueva terminal** (dejando el backend corriendo), navega a la carpeta del frontend e inicia el servidor de React:
```bash
cd frontend

# Instalar dependencias visuales
npm install

# Iniciar el entorno de desarrollo
npm run dev
```
La interfaz web estará disponible en tu navegador en `http://localhost:5173/sistema-juridico/`.

> ⚠️ **Ojo con la subcarpeta.** El proyecto se sirve bajo la ruta `/sistema-juridico/`
> (`vite.config.js` fija `base` y `App.jsx` fija `basename`). Abrir `http://localhost:5173`
> a secas devuelve una página en blanco. Todo enlace absoluto que escribas debe construirse
> con `import.meta.env.BASE_URL`.

### Paso 5: Ejecutar las pruebas
```bash
cd backend && npm test
```

---

## 🚀 Guía de Despliegue en Producción

El despliegue actual del sistema es un **VPS con Nginx**, sirviendo el frontend como archivos
estáticos en la subcarpeta `/sistema-juridico/` y haciendo proxy inverso de `/api` hacia el
proceso Node en el puerto 3000.

1. **Backend (Node en el VPS)**:
   - *Build*: `npm ci && npx prisma generate`
   - *Start*: `npm start` (se recomienda un gestor de procesos como PM2 o un servicio systemd).
   - Configura todas las variables de entorno del archivo `.env`.
   - El proceso también ejecuta el cron de recordatorios; **no levantes varias instancias**
     sin leer antes el ADR-007, o se enviarán correos duplicados.

2. **Frontend (estático detrás de Nginx)**:
   - *Build*: `npm ci && npm run build` → genera `frontend/dist`.
   - Publica el contenido de `dist` en la ruta `/sistema-juridico/` del servidor web.
   - Configura `VITE_API_URL` si la API no está en `/sistema-juridico/api`.
   - Nginx debe redirigir las rutas no encontradas a `index.html` (comportamiento SPA).

> Detalle de la topología de despliegue: **[docs/01-ARQUITECTURA.md](./docs/01-ARQUITECTURA.md)**

---
**SGPA** © 2024. Diseñado para modernizar el trabajo jurídico.
