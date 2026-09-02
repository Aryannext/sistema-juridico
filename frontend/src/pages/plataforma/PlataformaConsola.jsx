import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, LogOut, Search, Ban, CheckCircle2, Trash2,
  Building2, Users, Briefcase, AlertTriangle, Loader2, X
} from 'lucide-react';
import { toast } from 'sonner';
import apiPlataforma, { adminEnSesion, cerrarSesionPlataforma } from '../../api/plataforma';
import { formatFechaSinHora } from '../../lib/utils';

/**
 * Consola de administración de la plataforma.
 *
 * Muestra los consultorios con sus datos administrativos y sus recuentos —lo
 * justo para facturar y decidir— y permite suspenderlos, reactivarlos y darlos
 * de baja. No hay forma de abrir un expediente desde aquí, y no la habrá: el
 * token de esta sesión ni siquiera sirve contra la API de los consultorios.
 */
export default function PlataformaConsola() {
  const navigate = useNavigate();
  const admin = adminEnSesion();

  const [consultorios, setConsultorios] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  const [modalEstado, setModalEstado] = useState(null); // consultorio a suspender
  const [justificacion, setJustificacion] = useState('');
  const [modalBorrado, setModalBorrado] = useState(null);
  const [confirmacionNombre, setConfirmacionNombre] = useState('');
  const [justificacionBaja, setJustificacionBaja] = useState('');
  const [procesando, setProcesando] = useState(false);

  const cargar = async () => {
    try {
      setCargando(true);
      const params = {};
      if (buscar.trim().length >= 2) params.buscar = buscar.trim();
      if (filtroEstado !== 'todos') params.estado = filtroEstado;

      const [listaRes, resumenRes] = await Promise.all([
        apiPlataforma.get('/consultorios', { params }),
        apiPlataforma.get('/resumen'),
      ]);
      setConsultorios(listaRes.data);
      setResumen(resumenRes.data);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'No se pudieron cargar los consultorios');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (!admin) {
      navigate('/login');
      return;
    }
    // set-state-in-effect: `cargar` pone el indicador de carga antes de pedir
    // los datos. Es la carga inicial de la pantalla, no una sincronización con
    // un sistema externo, que es lo que la regla persigue.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEstado]);

  const salir = () => {
    cerrarSesionPlataforma();
    navigate('/login');
  };

  const cambiarEstado = async (consultorio, activo) => {
    try {
      setProcesando(true);
      const res = await apiPlataforma.patch(`/consultorios/${consultorio.id_tenant}/estado`, {
        activo,
        justificacion: activo ? undefined : justificacion,
      });
      toast.success(res.data.message);
      setModalEstado(null);
      setJustificacion('');
      cargar();
    } catch (error) {
      toast.error(error.response?.data?.error || 'No se pudo cambiar el estado');
    } finally {
      setProcesando(false);
    }
  };

  const eliminar = async () => {
    try {
      setProcesando(true);
      const res = await apiPlataforma.delete(`/consultorios/${modalBorrado.id_tenant}`, {
        data: { confirmacion: confirmacionNombre, justificacion: justificacionBaja },
      });
      toast.success(res.data.message);
      if (res.data.avisoArchivos) toast.warning(res.data.avisoArchivos, { duration: 10000 });
      setModalBorrado(null);
      setConfirmacionNombre('');
      setJustificacionBaja('');
      cargar();
    } catch (error) {
      toast.error(error.response?.data?.error || 'No se pudo eliminar el consultorio');
    } finally {
      setProcesando(false);
    }
  };

  const nombreCoincide = modalBorrado && confirmacionNombre.trim() === modalBorrado.nombre;
  const justificacionSuficiente = justificacionBaja.trim().length >= 10;

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-white/10 bg-neutral-950/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck size={20} className="text-[#DFB971]" />
            <span className="font-semibold tracking-wide">Administración de la plataforma</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-neutral-400 hidden sm:inline">{admin?.nombre}</span>
            <button
              onClick={salir}
              className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <LogOut size={16} /> Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">
        {resumen && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Tarjeta icono={Building2} titulo="Consultorios"
              valor={resumen.consultorios.total}
              pie={`${resumen.consultorios.activos} activos · ${resumen.consultorios.suspendidos} suspendidos`} />
            <Tarjeta icono={Users} titulo="Usuarios en total" valor={resumen.usuarios} />
            <Tarjeta icono={Briefcase} titulo="Expedientes en total" valor={resumen.procesos} />
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && cargar()}
              placeholder="Buscar por nombre, correo o NIT…"
              className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl pl-9 pr-4 py-2.5 text-sm"
            />
          </div>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-2.5 text-sm"
          >
            <option value="todos">Todos</option>
            <option value="activos">Solo activos</option>
            <option value="suspendidos">Solo suspendidos</option>
          </select>
        </div>

        <div className="bg-neutral-950/40 border border-white/10 rounded-2xl overflow-hidden">
          {cargando ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="animate-spin text-neutral-600" />
            </div>
          ) : consultorios.length === 0 ? (
            <p className="p-12 text-center text-neutral-500 text-sm">
              No hay consultorios que coincidan.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-neutral-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left p-4 font-semibold">Consultorio</th>
                    <th className="text-left p-4 font-semibold">Contacto</th>
                    <th className="text-center p-4 font-semibold">Usuarios</th>
                    <th className="text-center p-4 font-semibold">Clientes</th>
                    <th className="text-center p-4 font-semibold">Expedientes</th>
                    <th className="text-left p-4 font-semibold">Alta</th>
                    <th className="text-center p-4 font-semibold">Estado</th>
                    <th className="text-right p-4 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {consultorios.map((c) => (
                    <tr key={c.id_tenant} className="border-t border-white/5 hover:bg-white/[0.02]">
                      <td className="p-4">
                        <div className="font-medium text-white">{c.nombre}</div>
                        <div className="text-xs text-neutral-500">
                          {c.tipo === 'CONSULTORIO' ? 'Consultorio' : 'Independiente'}
                          {c.ciudad ? ` · ${c.ciudad}` : ''}
                        </div>
                      </td>
                      <td className="p-4 text-neutral-400">{c.email_admin}</td>
                      <td className="p-4 text-center text-neutral-300">{c._count.usuarios}</td>
                      <td className="p-4 text-center text-neutral-300">{c._count.clientes}</td>
                      <td className="p-4 text-center text-neutral-300">{c._count.procesos}</td>
                      <td className="p-4 text-neutral-400">{formatFechaSinHora(c.created_at, '—')}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          c.activo
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {c.activo ? 'Activo' : 'Suspendido'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          {c.activo ? (
                            <button
                              onClick={() => { setModalEstado(c); setJustificacion(''); }}
                              title="Suspender el acceso de este consultorio"
                              className="p-2 rounded-lg text-neutral-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                            >
                              <Ban size={16} />
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => cambiarEstado(c, true)}
                                title="Devolver el acceso"
                                className="p-2 rounded-lg text-neutral-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                              >
                                <CheckCircle2 size={16} />
                              </button>
                              <button
                                onClick={() => { setModalBorrado(c); setConfirmacionNombre(''); setJustificacionBaja(''); }}
                                title="Eliminar definitivamente"
                                className="p-2 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-neutral-600">
          Un consultorio solo puede eliminarse si antes está suspendido. Es a propósito: deja un
          periodo en el que ya no entra pero sus expedientes siguen ahí, por si hay que rectificar.
        </p>
      </main>

      {/* Suspender */}
      {modalEstado && (
        <Modal onClose={() => setModalEstado(null)} titulo={`Suspender ${modalEstado.nombre}`}>
          <p className="text-sm text-neutral-400">
            Sus <strong className="text-white">{modalEstado._count.usuarios}</strong> usuarios dejarán
            de poder entrar de inmediato. Los datos no se tocan y la suspensión se puede levantar
            cuando quiera.
          </p>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Motivo de la suspensión
            </label>
            <textarea
              value={justificacion}
              onChange={(e) => setJustificacion(e.target.value)}
              rows={3}
              placeholder="Ej.: impago de la mensualidad de septiembre"
              className="w-full bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-4 py-3 text-sm resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalEstado(null)}
              className="px-4 py-2.5 text-sm text-neutral-400 hover:text-white transition-colors cursor-pointer">
              Cancelar
            </button>
            <button
              onClick={() => cambiarEstado(modalEstado, false)}
              disabled={procesando || !justificacion.trim()}
              className="px-5 py-2.5 rounded-xl bg-amber-500/90 hover:bg-amber-500 text-neutral-950 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Suspender
            </button>
          </div>
        </Modal>
      )}

      {/* Eliminar */}
      {modalBorrado && (
        <Modal onClose={() => setModalBorrado(null)} titulo="Eliminar definitivamente" peligro>
          <div className="flex gap-3 p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
            <AlertTriangle size={18} className="text-rose-400 shrink-0 mt-0.5" />
            <div className="text-sm text-rose-200/90 space-y-1">
              <p>Se eliminarán de forma irreversible:</p>
              <p className="text-white font-semibold">
                {modalBorrado._count.usuarios} usuarios · {modalBorrado._count.clientes} clientes ·{' '}
                {modalBorrado._count.procesos} expedientes
              </p>
              <p>Con sus documentos, audiencias, términos, actuaciones y bitácora.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Escriba el nombre exacto del consultorio
            </label>
            <p className="text-xs text-neutral-500 font-mono">{modalBorrado.nombre}</p>
            <input
              value={confirmacionNombre}
              onChange={(e) => setConfirmacionNombre(e.target.value)}
              className="w-full bg-white/5 border border-white/10 focus:border-rose-400 focus:outline-none rounded-xl px-4 py-3 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Justificación (mínimo 10 caracteres)
            </label>
            <textarea
              value={justificacionBaja}
              onChange={(e) => setJustificacionBaja(e.target.value)}
              rows={3}
              placeholder="Ej.: el consultorio solicitó la baja del servicio el 2 de septiembre"
              className="w-full bg-white/5 border border-white/10 focus:border-rose-400 focus:outline-none rounded-xl px-4 py-3 text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalBorrado(null)}
              className="px-4 py-2.5 text-sm text-neutral-400 hover:text-white transition-colors cursor-pointer">
              Cancelar
            </button>
            <button
              onClick={eliminar}
              disabled={procesando || !nombreCoincide || !justificacionSuficiente}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
            >
              {procesando && <Loader2 size={14} className="animate-spin" />}
              Eliminar definitivamente
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Tarjeta({ icono: Icono, titulo, valor, pie }) {
  return (
    <div className="bg-neutral-950/40 border border-white/10 rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">{titulo}</p>
          <p className="text-3xl font-extrabold text-white mt-1">{valor}</p>
          {pie && <p className="text-xs text-neutral-500 mt-1">{pie}</p>}
        </div>
        <div className="p-2.5 rounded-xl bg-[#DFB971]/10 border border-[#DFB971]/20">
          <Icono size={18} className="text-[#DFB971]" />
        </div>
      </div>
    </div>
  );
}

function Modal({ titulo, children, onClose, peligro }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-neutral-950 border border-white/10 rounded-3xl p-6 md:p-8 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <h2 className={`text-xl font-bold ${peligro ? 'text-rose-400' : 'text-white'}`}>{titulo}</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
