import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Shield, Search, Filter, Calendar, Activity, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function AuditoriaList() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('ALL');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/auditoria');
      setLogs(res.data);
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar la bitácora de auditoría');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const modulesList = ['ALL', ...new Set(logs.map(log => log.modulo))];

  const filteredLogs = logs.filter(log => {
    const term = search.toLowerCase();
    const matchAccion = log.accion?.toLowerCase().includes(term);
    const matchDetalle = log.detalle?.toLowerCase().includes(term);
    const matchUser = log.usuario?.nombre?.toLowerCase().includes(term) || log.usuario?.email?.toLowerCase().includes(term);
    const matchIp = log.ip_adress?.includes(term);
    
    const matchModule = moduleFilter === 'ALL' || log.modulo === moduleFilter;

    return (matchAccion || matchDetalle || matchUser || matchIp) && matchModule;
  });

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-neutral-200 to-neutral-500 bg-clip-text text-transparent">
          Bitácora de Auditoría (Inmutable)
        </h1>
        <p className="text-neutral-400 mt-1">
          Registro cronológico detallado de las operaciones de escritura, modificaciones y configuraciones del consultorio.
        </p>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder="Buscar por acción, detalle, usuario o IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-neutral-500 transition-colors"
          />
        </div>

        {/* Module Filter */}
        <div className="flex items-center gap-3 w-full md:w-auto shrink-0 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-1.5">
          <Filter size={16} className="text-neutral-500" />
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="bg-transparent text-sm text-neutral-300 focus:outline-none py-1.5 cursor-pointer"
          >
            {modulesList.map(mod => (
              <option key={mod} value={mod} className="bg-neutral-950">
                {mod === 'ALL' ? 'Todos los Módulos' : mod}
              </option>
            ))}
          </select>
        </div>

      </div>

      {/* Grid or Table */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="h-16 rounded-xl bg-neutral-950 border border-neutral-900 animate-pulse" />
          ))}
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-20 rounded-3xl bg-neutral-950/50 border border-neutral-900">
          <Shield className="mx-auto text-neutral-800 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-neutral-300">No hay registros de auditoría</h3>
          <p className="text-neutral-500 mt-1 text-sm">No se encontraron actividades que coincidan con los filtros aplicados.</p>
        </div>
      ) : (
        <div className="bg-neutral-950 border border-neutral-900 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-900 text-xs font-bold uppercase tracking-wider text-neutral-500 bg-neutral-950/80">
                  <th className="py-4 px-6">Usuario</th>
                  <th className="py-4 px-6">Acción</th>
                  <th className="py-4 px-6">Módulo</th>
                  <th className="py-4 px-6">Detalle</th>
                  <th className="py-4 px-6">Dirección IP</th>
                  <th className="py-4 px-6 text-right">Fecha y Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900 text-sm">
                {filteredLogs.map((log) => (
                  <tr 
                    key={log.id_bitacora}
                    className="hover:bg-neutral-900/20 transition-colors"
                  >
                    <td className="py-4.5 px-6">
                      <div>
                        <p className="text-white font-bold">{log.usuario?.nombre}</p>
                        <p className="text-xs text-neutral-500">{log.usuario?.email}</p>
                      </div>
                    </td>
                    <td className="py-4.5 px-6 font-semibold text-white">
                      <span className="bg-neutral-900 border border-neutral-850 px-2.5 py-1 rounded text-xs">
                        {log.accion}
                      </span>
                    </td>
                    <td className="py-4.5 px-6">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-400">
                        {log.modulo}
                      </span>
                    </td>
                    <td className="py-4.5 px-6 text-neutral-400 max-w-xs truncate">
                      {log.detalle}
                    </td>
                    <td className="py-4.5 px-6 font-mono text-xs text-neutral-500">
                      {log.ip_adress}
                    </td>
                    <td className="py-4.5 px-6 text-right text-neutral-400 text-xs whitespace-nowrap">
                      {new Date(log.create_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
