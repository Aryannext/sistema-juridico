import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import { Toaster, toast } from 'sonner';
import { Scale, Lock, Eye, EyeOff, Loader2, XCircle } from 'lucide-react';

/**
 * Elección de la contraseña nueva desde el enlace recibido por correo (HU-01).
 *
 * Los requisitos se muestran mientras se escribe, en lugar de soltarlos como
 * error al enviar: quien acaba de recuperar el acceso ya viene incómodo, y
 * hacerle adivinar la política a base de intentos lo empeora. La comprobación
 * de verdad la hace el servidor; esto es solo la guía visual.
 */
const REQUISITOS = [
  { texto: 'Al menos 8 caracteres', cumple: (v) => v.length >= 8 },
  { texto: 'Una letra mayúscula', cumple: (v) => /[A-ZÁÉÍÓÚÑ]/.test(v) },
  { texto: 'Una letra minúscula', cumple: (v) => /[a-záéíóúñ]/.test(v) },
  { texto: 'Un número', cumple: (v) => /[0-9]/.test(v) },
  // HU-01.6. Debe reflejar exactamente las reglas de backend/src/utils/password.js:
  // esta lista es una guía, y una guía que enseña los cinco puntos en verde
  // mientras el servidor rechaza la contraseña es peor que no tener guía.
  { texto: 'Un carácter especial', cumple: (v) => /[^\p{L}\p{N}\s]/u.test(v) },
];

export default function RestablecerPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [repetida, setRepetida] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cumpleTodo = REQUISITOS.every((r) => r.cumple(password));
  const coinciden = password.length > 0 && password === repetida;

  const guardar = async (e) => {
    e.preventDefault();
    try {
      setGuardando(true);
      const res = await api.post('/auth/restablecer', { token, password });
      toast.success(res.data.message || 'Contraseña actualizada');
      setTimeout(() => navigate('/login'), 1500);
    } catch (error) {
      toast.error(error.response?.data?.error || 'No se pudo cambiar la contraseña');
      // Si el enlace ya no sirve, se manda a pedir otro en lugar de dejarlo
      // reintentando sobre un token muerto.
      if (error.response?.data?.tokenInvalido) {
        setTimeout(() => navigate('/recuperar'), 2500);
      }
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-4 relative overflow-hidden dark">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#DFB971]/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/5 blur-[100px] rounded-full pointer-events-none" />

      <Toaster richColors theme="dark" />

      <div className="w-full max-w-[420px] z-10 animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 mb-4 shadow-[0_0_20px_rgba(223,185,113,0.15)]">
            <Scale size={32} className="text-[#DFB971]" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-widest uppercase mb-1">
            <span className="bg-gradient-to-r from-[#DFB971] via-[#FFF1C6] to-[#DFB971] bg-clip-text text-transparent">SGPA</span>
          </h1>
        </div>

        <div className="bg-neutral-950/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] rounded-3xl p-8 animate-scale-in">
          {!token ? (
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <XCircle className="h-16 w-16 text-red-500" />
              </div>
              <h2 className="text-2xl font-semibold text-white mb-3">Enlace incompleto</h2>
              <p className="text-sm text-neutral-400 mb-8">
                Abre el enlace tal como llegó al correo, sin recortarlo.
              </p>
              <Link
                to="/recuperar"
                className="block w-full bg-gradient-to-r from-[#C29B4F] to-[#E5C37A] text-black font-semibold rounded-xl py-3.5 uppercase tracking-wider text-sm"
              >
                Pedir un enlace nuevo
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold text-white mb-2 tracking-wide">Nueva contraseña</h2>
              <p className="text-sm text-neutral-400 mb-8">
                Elige una contraseña que no hayas usado antes.
              </p>

              <form onSubmit={guardar} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type={verClave ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl pl-9 pr-10 py-3 text-sm text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setVerClave(!verClave)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 cursor-pointer"
                    >
                      {verClave ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <ul className="space-y-1.5">
                  {REQUISITOS.map((r) => {
                    const ok = r.cumple(password);
                    return (
                      <li
                        key={r.texto}
                        className={`text-xs flex items-center gap-2 transition-colors ${
                          ok ? 'text-emerald-400' : 'text-neutral-500'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-neutral-700'}`} />
                        {r.texto}
                      </li>
                    );
                  })}
                </ul>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Repite la contraseña
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type={verClave ? 'text' : 'password'}
                      value={repetida}
                      onChange={(e) => setRepetida(e.target.value)}
                      required
                      autoComplete="new-password"
                      className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl pl-9 pr-4 py-3 text-sm text-white"
                    />
                  </div>
                  {repetida.length > 0 && !coinciden && (
                    <p className="text-xs text-rose-400">Las dos contraseñas no coinciden.</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={guardando || !cumpleTodo || !coinciden}
                  className="w-full bg-gradient-to-r from-[#C29B4F] to-[#E5C37A] hover:from-[#E5C37A] hover:to-[#C29B4F] disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold rounded-xl py-3.5 uppercase tracking-wider text-sm transition-all duration-300 flex justify-center items-center gap-2 cursor-pointer"
                >
                  {guardando && <Loader2 size={16} className="animate-spin" />}
                  {guardando ? 'Guardando…' : 'Guardar contraseña'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
