import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { 
  BarChart3, Download, Printer, Calendar, ShieldAlert, Users, 
  Briefcase, AlertCircle, FileText, CheckCircle2, Clock, Loader2 
} from 'lucide-react';
import { toast } from 'sonner';

export default function ReportesPage() {
  const [filter, setFilter] = useState('mes');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [exporting, setExporting] = useState(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const params = { filter };
      if (filter === 'custom') {
        if (!startDate || !endDate) {
          toast.warning('Por favor seleccione ambas fechas para el filtro personalizado.');
          setLoading(false);
          return;
        }
        params.start_date = startDate;
        params.end_date = endDate;
      }
      
      const res = await api.get('/reportes/stats', { params });
      setStats(res.data);
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar las estadísticas del consultorio.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [filter, startDate, endDate]);

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const params = { filter };
      if (filter === 'custom') {
        params.start_date = startDate;
        params.end_date = endDate;
      }

      const res = await api.get('/reportes/export/csv', {
        params,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reporte-general-${filter}-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Reporte CSV exportado y descargado exitosamente.');
    } catch (error) {
      console.error(error);
      toast.error('Error al exportar datos a CSV.');
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
        <Loader2 size={36} className="animate-spin text-neutral-400" />
        <p className="text-neutral-400 text-sm">Generando consolidados del consultorio...</p>
      </div>
    );
  }

  // Calculate some aggregate values for UI
  const totalProcesos = stats?.procesosPorEstado?.reduce((acc, curr) => acc + curr._count.id_proceso, 0) || 0;
  const activosProcesos = stats?.procesosPorEstado?.find(p => p.estado === 'ACTIVO')?._count.id_proceso || 0;

  return (
    <div className="space-y-8 animate-fade-in pb-16 print:p-0 print:space-y-6">
      
      {/* Header - Hidden on print */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-[#FFF1C6] to-[#DFB971] bg-clip-text text-transparent flex items-center gap-3">
            <BarChart3 className="text-[#DFB971]" size={32} />
            <span>Reportes y Estadísticas</span>
          </h1>
          <p className="text-neutral-400 mt-1">
            Visualiza y exporta métricas generales de expedientes, términos y cargas de trabajo.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-neutral-300 hover:text-[#DFB971] hover:border-[#DFB971]/30 font-semibold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-[0_4px_16px_rgba(0,0,0,0.2)]"
          >
            <Printer size={14} />
            <span>Imprimir</span>
          </button>
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="flex items-center gap-2 bg-gradient-to-r from-[#C29B4F] to-[#E5C37A] hover:from-[#E5C37A] hover:to-[#C29B4F] text-black font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-[0_4px_15px_rgba(223,185,113,0.3)] disabled:opacity-50 transform hover:scale-[1.02]"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Print Specific Header */}
      <div className="hidden print:block border-b border-black pb-4">
        <h1 className="text-2xl font-bold text-black">SGPA - Reporte Consolidado del Consultorio</h1>
        <p className="text-xs text-neutral-600 mt-1">
          Fecha de generación: {new Date().toLocaleString('es-CO')}
        </p>
        <p className="text-xs text-neutral-600">
          Filtro aplicado: {filter === 'mes' ? 'Este Mes' : filter === 'trimestre' ? 'Último Trimestre' : filter === 'anio' ? 'Este Año' : `Personalizado (${startDate} a ${endDate})`}
        </p>
      </div>

      {/* Filter Tabs - Hidden on print */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-2 bg-neutral-950/40 backdrop-blur-xl border border-white/10 rounded-2xl print:hidden shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
        <div className="flex gap-1.5">
          {['mes', 'trimestre', 'anio', 'custom'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                filter === f 
                  ? 'bg-gradient-to-r from-[#C29B4F] to-[#E5C37A] text-black font-bold shadow-[0_4px_10px_rgba(223,185,113,0.3)]' 
                  : 'text-neutral-400 hover:text-[#DFB971] hover:bg-white/5'
              }`}
            >
              {f === 'mes' ? 'Este Mes' : f === 'trimestre' ? 'Trimestre' : f === 'anio' ? 'Año' : 'Personalizado'}
            </button>
          ))}
        </div>

        {filter === 'custom' && (
          <div className="flex items-center gap-2 animate-fade-in pr-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-3 py-1.5 text-xs text-white cursor-pointer"
            />
            <span className="text-neutral-500 text-xs">a</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white/5 border border-white/10 focus:border-[#DFB971] focus:outline-none rounded-xl px-3 py-1.5 text-xs text-white cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* Aggregate metrics grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 print:grid-cols-4 print:gap-4">
        
        {/* Total Cases */}
        <div className="rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-white/10 p-6 print:border-black print:bg-white print:text-black shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] hover:border-[#DFB971]/30 transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-[#DFB971] uppercase tracking-widest print:text-neutral-600">
              Expedientes Totales
            </span>
            <Briefcase size={16} className="text-[#DFB971] print:text-neutral-600" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white print:text-black">{totalProcesos}</span>
            <span className="text-xs text-neutral-500">creados en rango</span>
          </div>
        </div>

        {/* Active Cases */}
        <div className="rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-white/10 p-6 print:border-black print:bg-white print:text-black shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] hover:border-[#DFB971]/30 transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-[#DFB971] uppercase tracking-widest print:text-neutral-600">
              Expedientes Activos
            </span>
            <Clock size={16} className="text-[#DFB971] print:text-neutral-600" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white print:text-black">{activosProcesos}</span>
            <span className="text-xs text-neutral-500">
              ({totalProcesos > 0 ? Math.round((activosProcesos / totalProcesos) * 100) : 0}%) del total
            </span>
          </div>
        </div>

        {/* High Risk Semaphores */}
        <div className="rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-rose-500/20 p-6 print:border-black print:bg-white print:text-black shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] hover:border-rose-500/40 transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-widest">
              Plazos Vencidos
            </span>
            <ShieldAlert size={16} className="text-rose-500" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.4)]">{stats?.plazosVencidos || 0}</span>
            <span className="text-xs text-neutral-400">requieren gestión urgente</span>
          </div>
        </div>

        {/* Inactive Cases */}
        <div className="rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-rose-500/20 p-6 print:border-black print:bg-white print:text-black shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] hover:border-rose-500/40 transition-colors">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-widest">
              Expedientes Inactivos
            </span>
            <AlertCircle size={16} className="text-rose-500" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.4)]">{stats?.procesosInactivos?.length || 0}</span>
            <span className="text-xs text-neutral-400">sin movimiento &gt;30d</span>
          </div>
        </div>
      </div>

      {/* Main Stats Graphs/Visual representations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:grid-cols-1 print:gap-6">
        
        {/* Process States distribution */}
        <div className="rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-white/10 p-6 space-y-6 print:border-black print:bg-white print:text-black shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]">
          <h3 className="text-md font-bold text-white flex items-center gap-2 border-b border-white/10 pb-4 print:text-black print:border-black">
            <FileText size={18} className="text-[#DFB971] print:text-neutral-700" />
            Distribución de Expedientes por Estado
          </h3>

          <div className="space-y-4">
            {(!stats?.procesosPorEstado || stats.procesosPorEstado.length === 0) ? (
              <p className="text-xs text-neutral-500 text-center py-8">No se encontraron expedientes en este rango.</p>
            ) : (
              stats.procesosPorEstado.map((item) => {
                const percentage = totalProcesos > 0 ? Math.round((item._count.id_proceso / totalProcesos) * 100) : 0;
                return (
                  <div key={item.estado} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-neutral-300 print:text-black uppercase">{item.estado}</span>
                      <span className="font-bold text-white print:text-black">
                        {item._count.id_proceso} ({percentage}%)
                      </span>
                    </div>
                    {/* Visual bar */}
                    <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden border border-neutral-850 print:bg-neutral-100">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.estado === 'ACTIVO' ? 'bg-white print:bg-neutral-800' :
                          item.estado === 'SUSPENDIDO' ? 'bg-neutral-600 print:bg-neutral-400' :
                          item.estado === 'ARCHIVADO' ? 'bg-neutral-800 print:bg-neutral-300' : 'bg-neutral-700'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Lawyer workloads */}
        <div className="rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-white/10 p-6 space-y-6 print:border-black print:bg-white print:text-black shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]">
          <h3 className="text-md font-bold text-white flex items-center gap-2 border-b border-white/10 pb-4 print:text-black print:border-black">
            <Users size={18} className="text-[#DFB971] print:text-neutral-700" />
            Carga de Trabajo (Casos Activos por Abogado)
          </h3>

          <div className="space-y-4">
            {(!stats?.cargaTrabajo || stats.cargaTrabajo.length === 0) ? (
              <p className="text-xs text-neutral-500 text-center py-8">No se encontraron abogados asignados.</p>
            ) : (
              stats.cargaTrabajo.map((abogado) => {
                const maxActivos = Math.max(...stats.cargaTrabajo.map(a => a.procesos_activos), 1);
                const visualPercentage = Math.round((abogado.procesos_activos / maxActivos) * 100);
                return (
                  <div key={abogado.id_usuario} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <div>
                        <span className="font-semibold text-neutral-300 print:text-black">{abogado.nombre}</span>
                        <span className="text-[10px] text-neutral-500 ml-2 print:text-neutral-600">({abogado.email})</span>
                      </div>
                      <span className="font-bold text-white print:text-black">
                        {abogado.procesos_activos} casos
                      </span>
                    </div>
                    {/* Visual workload bar */}
                    <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden border border-neutral-850 print:bg-neutral-100">
                      <div 
                        className="h-full bg-gradient-to-r from-neutral-800 to-white print:bg-neutral-700 rounded-full transition-all duration-500"
                        style={{ width: `${visualPercentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Inactive cases section with strict RED semaphore rules */}
      <div className="rounded-3xl bg-neutral-950/40 backdrop-blur-xl border border-rose-500/20 p-6 space-y-6 print:border-black print:bg-white print:text-black shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]">
        <div>
          <h3 className="text-md font-bold text-white flex items-center gap-2 border-b border-rose-500/20 pb-4 print:text-black print:border-black">
            <AlertCircle size={18} className="text-rose-500" />
            Riesgo Procesal: Expedientes Activos Sin Movimiento (Semáforo Rojo &gt;30 días)
          </h3>
          <p className="text-xs text-neutral-400 mt-1 print:text-neutral-600">
            A continuación se listan los procesos activos que no registran novedades ni carga de documentos en los últimos 30 días. El color rojo se reserva estrictamente para indicar este riesgo procesal crítico.
          </p>
        </div>

        {(!stats?.procesosInactivos || stats.procesosInactivos.length === 0) ? (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/10 bg-emerald-500/5 text-emerald-400 text-xs">
            <CheckCircle2 size={16} />
            <span>Excelente. No se registran expedientes activos inactivos por más de 30 días en el consultorio.</span>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-rose-500/20 text-rose-400/70 print:border-black print:text-black">
                  <th className="py-2.5 font-bold uppercase tracking-wider pl-2">Número Radicado</th>
                  <th className="py-2.5 font-bold uppercase tracking-wider">Cliente</th>
                  <th className="py-2.5 font-bold uppercase tracking-wider">Abogado Responsable</th>
                  <th className="py-2.5 font-bold uppercase tracking-wider">Tipo</th>
                  <th className="py-2.5 font-bold uppercase tracking-wider text-right pr-2">Días Inactivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-500/10 print:divide-neutral-200">
                {stats.procesosInactivos.map((proceso) => (
                  <tr key={proceso.id_proceso} className="hover:bg-rose-500/5 transition-colors group">
                    <td className="py-3 pl-2 font-semibold text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]">{proceso.numero_radicado}</td>
                    <td className="py-3 text-neutral-300 print:text-black group-hover:text-white transition-colors">{proceso.cliente}</td>
                    <td className="py-3 text-neutral-300 print:text-black group-hover:text-white transition-colors">{proceso.abogado}</td>
                    <td className="py-3 text-neutral-400 print:text-neutral-700">{proceso.tipo_proceso}</td>
                    <td className="py-3 pr-2 text-right font-extrabold text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]">
                      {proceso.dias_inactivo} días
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
