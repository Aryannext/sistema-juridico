# Arquitectura del Sistema de Gestión de Procesos de Abogados (SGPA)

## 1. Visión General
El SGPA está diseñado bajo una arquitectura de microservicios lógicos (modular) separando claramente el Frontend del Backend, comunicándose a través de una API RESTful. Además, el sistema implementa una arquitectura **Multi-Tenant** (Multiusuario), donde cada Consultorio Jurídico o Abogado Independiente opera en su propio entorno lógico de datos, garantizando aislamiento y seguridad.

## 2. Componentes Principales

### 2.1. Frontend (Capa de Presentación)
La interfaz de usuario está construida como una Single Page Application (SPA) para asegurar tiempos de respuesta rápidos y una experiencia fluida.

- **Framework**: React 18
- **Build Tool**: Vite (rápido empaquetado y HMR)
- **Enrutamiento**: React Router DOM v6
- **Estilos**: Tailwind CSS (arquitectura atómica, *Glassmorphism* para el diseño UI premium).
- **Gestión de Estado**: Context API (`AuthContext`) para sesión, y estado local de React para el resto.
- **Peticiones HTTP**: Axios con interceptores para inyección automática del token JWT.
- **Iconografía y Alertas**: Lucide React y Sonner.

### 2.2. Backend (Capa Lógica y de Negocios)
El servidor está desarrollado en Node.js, actuando como intermediario entre la base de datos y el cliente.

- **Entorno**: Node.js
- **Framework REST**: Express.js
- **Arquitectura de Carpetas**: Basada en módulos (por ejemplo, `modules/clientes`, `modules/procesos`, `modules/auth`). Cada módulo contiene sus rutas (`.routes.js`) y controladores (`.controller.js`).
- **Autenticación**: JSON Web Tokens (JWT) con soporte para expiración y renovación.
- **Seguridad Perimetral**:
  - `Helmet`: Cabeceras HTTP seguras.
  - `CORS`: Restricción de dominios permitidos.
  - `express-rate-limit`: Prevención de ataques de fuerza bruta limitando peticiones.
  - `bcrypt`: Hashing asimétrico de contraseñas.

### 2.3. Base de Datos (Capa de Persistencia)
- **Motor DB**: PostgreSQL
- **Hosting DB**: Supabase (Pooler en AWS, para conexiones concurrentes masivas).
- **ORM**: Prisma (Object-Relational Mapping). Facilita el modelado de datos, las migraciones tipadas y consultas seguras (prevención nativa de Inyecciones SQL).

## 3. Modelo Multi-Tenant
El sistema utiliza un enfoque de "Column-based Tenancy". Todas las tablas principales de la base de datos (Usuarios, Clientes, Procesos, Documentos, etc.) incluyen una columna `tenant_id`. 
Cualquier petición al backend pasa por un Middleware de validación (`verifyToken`), el cual extrae el `tenant_id` del token del usuario que hizo la petición y restringe todas las operaciones de Prisma a dicho Tenant, evitando que los datos de un consultorio se filtren a otro.

## 4. Diagrama Lógico de Flujo

1. **Cliente Web** envía credenciales a `/api/auth/login`.
2. **Backend (Express)** valida en **PostgreSQL (vía Prisma)**.
3. Se devuelve un **JWT** firmado al cliente.
4. **Cliente Web** hace peticiones (ej. obtener procesos) enviando el JWT en la cabecera `Authorization`.
5. **Middleware** en Express intercepta, valida la firma del token, e inyecta el `tenant_id` en la petición.
6. **Controlador** realiza la consulta usando `Prisma`, filtrando por `tenant_id`.
7. **Respuesta** en JSON viaja al Frontend para su renderizado.
