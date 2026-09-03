import { createContext, useState, useEffect, useContext, useCallback } from 'react';
import api from '../api/axios';
import useCierrePorInactividad from '../hooks/useCierrePorInactividad';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = useCallback(async () => {
    // Avisar al servidor para que el cierre quede en la bitácora (RF05). Se
    // espera la respuesta, pero el fallo no detiene nada: si la API no
    // responde, la sesión se cierra igual en el navegador. Lo contrario
    // dejaría al usuario atrapado dentro por un problema de red.
    try {
      await api.post('/auth/logout');
    } catch {
      /* el cierre local sigue adelante */
    }

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  // RNF02.7 — La sesión se cierra sola tras un rato sin actividad. Se avisa de
  // por qué: un cierre silencioso parece un fallo del sistema, y quien vuelve
  // al escritorio merece saber que fue el propio sistema quien lo protegió.
  //
  // El motivo se deja anotado en vez de mostrarse aquí: el aviso emergente vive
  // dentro del layout, que se desmonta al cerrar la sesión, así que un mensaje
  // lanzado en este punto no llegaría a verse. Lo recoge la pantalla de acceso.
  const cerrarPorInactividad = useCallback(async () => {
    sessionStorage.setItem('motivo_cierre', 'inactividad');
    await logout();
  }, [logout]);

  useCierrePorInactividad(Boolean(user), cerrarPorInactividad);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
