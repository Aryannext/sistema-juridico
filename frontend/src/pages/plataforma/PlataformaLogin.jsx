import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import apiPlataforma, { guardarSesionPlataforma } from '../../api/plataforma';

/**
 * Acceso a la administración de la PLATAFORMA.
 *
 * Deliberadamente sobrio y sin enlace de registro: estas cuentas solo se crean
 * con `npm run crear-admin-plataforma` en el servidor. Tampoco enlaza con el
 * acceso de los consultorios, para que nadie confunda las dos puertas.
 */
export default function PlataformaLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [entrando, setEntrando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    try {
      setEntrando(true);
      const res = await apiPlataforma.post('/login', { email, password });
      guardarSesionPlataforma(res.data.token, res.data.admin);
      navigate('/plataforma/consola');
    } catch (error) {
      toast.error(error.response?.data?.error || 'No se pudo iniciar sesión');
    } finally {
      setEntrando(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 rounded-2xl bg-[#DFB971]/10 border border-[#DFB971]/30 mb-4">
            <ShieldCheck size={28} className="text-[#DFB971]" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Administración de la plataforma
          </h1>
          <p className="text-sm text-neutral-500 mt-2 text-center">
            Gestión de consultorios. Este acceso no da entrada a los expedientes de ninguno.
          </p>
        </div>

        <form
          onSubmit={entrar}
          className="bg-neutral-950/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 space-y-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.6)]"
        >
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm text-white"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm text-white"
            />
          </div>

          <button
            type="submit"
            disabled={entrando}
            className="w-full bg-gradient-to-r from-[#DFB971] to-[#C9A25E] text-neutral-950 font-bold py-3 rounded-xl transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {entrando && <Loader2 size={16} className="animate-spin" />}
            {entrando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-neutral-600 mt-6">
          Las cuentas de plataforma se crean únicamente desde el servidor.
        </p>
      </div>
    </div>
  );
}
