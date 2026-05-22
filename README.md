# SGPA - Sistema de Gestión de Procesos de Abogados

El **SGPA** es una plataforma SaaS B2B robusta, construida con tecnologías modernas web para garantizar escalabilidad, seguridad en los datos sensibles de los casos y alto rendimiento para firmas de abogados (Consultorios) y abogados independientes.

Este repositorio contiene el código fuente completo del sistema, dividido en un Frontend (React/Vite) y un Backend (Node.js/Express).

---

## 🏗️ Arquitectura y Especificaciones Técnicas

El sistema está diseñado bajo una arquitectura de **microservicios lógicos (modular)** separando claramente el Frontend del Backend, comunicándose a través de una API RESTful. Implementa una arquitectura **Multi-Tenant** (Multiusuario), donde cada Consultorio Jurídico opera en su propio entorno lógico de datos garantizando un aislamiento total.

### Stack Tecnológico
- **Frontend**: React 18, Vite, Tailwind CSS v4, React Router v7, Axios, React Hook Form, Sonner, Lucide React.
- **Backend**: Node.js (v18+), Express.js, Prisma ORM v5, JWT (Autenticación), Bcrypt (Hashing), Helmet y Rate-Limiting.
- **Base de Datos**: PostgreSQL (v15+) alojado en Supabase con Connection Pooling (PgBouncer).

### Seguridad y Multi-Tenancy
1. **Multi-Tenancy Lógico**: Todas las consultas a la base de datos están estrictamente encapsuladas por el `tenant_id` del usuario en sesión, garantizando que los datos de un consultorio jamás se filtren a otro.
2. **Encriptación**: Las contraseñas jamás se guardan en texto plano (`bcrypt`).
3. **Control de Acceso (RBAC)**: Roles definidos (`ADMINISTRADOR`, `ABOGADO`, `ASISTENTE`, `CLIENTE`) restringen las acciones permitidas en el sistema.
4. **Auditoría (Logs)**: Toda acción destructiva o de modificación queda registrada de forma inmutable en una Bitácora de Auditoría.

---

## 📖 Manual de Usuario

El SGPA está diseñado para ser intuitivo. Aquí tienes una guía rápida de las funciones principales:

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
Si eres el Administrador del despacho, tienes acceso a la pestaña de **Access Control**. Desde allí puedes invitar a tus colegas abogados, asignarles permisos y revisar la Bitácora de Auditoría para saber qué hizo cada empleado y cuándo.

---

## 💻 Guía de Instalación Local (Para Desarrolladores)

Si deseas descargar este repositorio y ejecutarlo en tu máquina local, sigue estas instrucciones detalladas paso a paso.

### Requisitos Previos
- Instalar **Node.js** (versión 18 o superior).
- Tener una cuenta gratuita en [Supabase](https://supabase.com/) (o una instancia local de PostgreSQL).

### Paso 1: Clonar el Repositorio
```bash
git clone https://github.com/Aryannext/sistema-juridico.git
cd sistema-juridico
```

### Paso 2: Configurar la Base de Datos
1. Ve a Supabase, crea un nuevo proyecto y obtén tus credenciales de PostgreSQL.
2. En la carpeta `backend`, copia el archivo de ejemplo de variables de entorno:
   ```bash
   cd backend
   cp .env.example .env
   ```
3. Edita tu nuevo archivo `backend/.env` y completa los datos (Asegúrate de cambiar los URLs de la base de datos y generar tu propia clave JWT).

Ejemplo de `.env`:
```env
DATABASE_URL="postgresql://postgres:TUPASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:TUPASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"
JWT_SECRET="alguna_clave_secreta_aleatoria"
PORT=3000
```

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
La interfaz web estará disponible en tu navegador en `http://localhost:5173`.

---

## 🚀 Guía de Despliegue en Producción

El sistema está listo para montarse en la nube de forma gratuita o de pago.

1. **Backend (Render / AWS / Railway)**:
   - Configura el servicio usando Node.
   - El *Build Command* es: `npm install && npx prisma generate`
   - El *Start Command* es: `npm start`
   - Configura todas las variables de entorno de tu archivo `.env`.
   
2. **Frontend (Vercel)**:
   - Conecta tu repositorio de GitHub directamente a Vercel.
   - Selecciona el directorio `frontend` como raíz.
   - Agrega la variable de entorno `VITE_API_URL` apuntando a la URL pública de tu backend.
   - El archivo `vercel.json` incluido en el repositorio se encargará automáticamente del ruteo para aplicaciones SPA.

---
**SGPA** © 2024. Diseñado para modernizar el trabajo jurídico.
