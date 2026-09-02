import axios from 'axios';

/**
 * Cliente HTTP de la administración de plataforma.
 *
 * Separado del de los consultorios a propósito, y con la sesión guardada bajo
 * OTRA clave del navegador. Si compartieran clave, entrar como administrador de
 * plataforma cerraría la sesión del consultorio y al revés, y peor aún: un
 * token se enviaría a la API equivocada.
 */
const CLAVE_TOKEN = 'token_plataforma';
const CLAVE_ADMIN = 'admin_plataforma';

const apiPlataforma = axios.create({
  baseURL:
    (import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/sistema-juridico/api' : 'http://localhost:3000/api')) +
    '/plataforma',
});

apiPlataforma.interceptors.request.use((config) => {
  const token = localStorage.getItem(CLAVE_TOKEN);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiPlataforma.interceptors.response.use(
  (respuesta) => respuesta,
  (error) => {
    // Sesión caducada: se limpia y se vuelve al acceso de plataforma, no al de
    // los consultorios.
    if (error.response?.status === 401 && !error.config.url.includes('/login')) {
      cerrarSesionPlataforma();
      window.location.href = `${import.meta.env.BASE_URL}plataforma`;
    }
    return Promise.reject(error);
  }
);

export function guardarSesionPlataforma(token, admin) {
  localStorage.setItem(CLAVE_TOKEN, token);
  localStorage.setItem(CLAVE_ADMIN, JSON.stringify(admin));
}

export function cerrarSesionPlataforma() {
  localStorage.removeItem(CLAVE_TOKEN);
  localStorage.removeItem(CLAVE_ADMIN);
}

export function adminEnSesion() {
  const bruto = localStorage.getItem(CLAVE_ADMIN);
  if (!bruto) return null;
  try {
    return JSON.parse(bruto);
  } catch {
    return null;
  }
}

export default apiPlataforma;
