import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { 
  ArrowLeft, Briefcase, Calendar, User, Building2, 
  Clock, Edit3, X, Save, AlertCircle, FileText, CheckCircle, ListTodo,
  Upload, Download, History, Trash2, Plus, AlertTriangle, Check, Loader2,
  Users, UserPlus
} from 'lucide-react';
import { toast } from 'sonner';

export default function ProcesoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // General states
  const [proceso, setProceso] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState('general'); // 'general', 'documentos', 'agenda', 'terminos'

  // Edit process states
  const [juzgado, setJuzgado] = useState('');
  const [claseProceso, setClaseProceso] = useState('');
  const [areaDerecho, setAreaDerecho] = useState('');
  const [fechaRadicado, setFechaRadicado] = useState('');

  // Component 1: Documents States
  const [documentos, setDocumentos] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [showUploadDocModal, setShowUploadDocModal] = useState(false);
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showVersionesModal, setShowVersionesModal] = useState(false);
  const [docVersiones, setDocVersiones] = useState([]);
  const [loadingVersiones, setLoadingVersiones] = useState(false);
  const [showDocEstadoModal, setShowDocEstadoModal] = useState(false);
  const [docEstadoNuevo, setDocEstadoNuevo] = useState('INACTIVO');
  const [showDeleteDefinitivoModal, setShowDeleteDefinitivoModal] = useState(false);
  const [deleteJustificacion, setDeleteJustificacion] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteConfirmCheckbox, setDeleteConfirmCheckbox] = useState(false);

  // Document upload form states
  const [docNombre, setDocNombre] = useState('');
  const [docCategoria, setDocCategoria] = useState('DEMANDA');
  const [docVisibilidad, setDocVisibilidad] = useState('PRIVADO');
  const [docFile, setDocFile] = useState(null);

  // Component 2: Audiencias States
  const [audiencias, setAudiencias] = useState([]);
  const [loadingAudiencias, setLoadingAudiencias] = useState(false);
  const [showAddAudienciaModal, setShowAddAudienciaModal] = useState(false);
  const [audNombre, setAudNombre] = useState('');
  const [audTipo, setAudTipo] = useState('');
  const [audFechaHora, setAudFechaHora] = useState('');
  const [audLugar, setAudLugar] = useState('');
  const [customRecordatorios, setCustomRecordatorios] = useState([{ minutos_antes: 1440, canal: 'EMAIL' }]);
  const [showReprogramModal, setShowReprogramModal] = useState(false);
  const [selectedAudiencia, setSelectedAudiencia] = useState(null);
  const [reprogramFechaHora, setReprogramFechaHora] = useState('');
  const [reprogramLugar, setReprogramLugar] = useState('');
  const [reprogramNombre, setReprogramNombre] = useState('');
  const [reprogramTipo, setReprogramTipo] = useState('');

  // Component 3: Terminos States
  const [terminos, setTerminos] = useState([]);
  const [loadingTerminos, setLoadingTerminos] = useState(false);
  const [showAddTerminoModal, setShowAddTerminoModal] = useState(false);
  const [showGestionarTerminoModal, setShowGestionarTerminoModal] = useState(false);
  const [selectedTermino, setSelectedTermino] = useState(null);
  const [termNombre, setTermNombre] = useState('');
  const [termFechaVencimiento, setTermFechaVencimiento] = useState('');
  const [termEsCritico, setTermEsCritico] = useState(false);
  const [termEstadoGestion, setTermEstadoGestion] = useState('CUMPLIDO');
  const [termJustificacion, setTermJustificacion] = useState('');
  const [termRecordatoriosList, setTermRecordatoriosList] = useState([]);
  const [newTermRecValor, setNewTermRecValor] = useState(24);
  const [newTermRecUnidad, setNewTermRecUnidad] = useState('HORAS');
  const [newTermRecCanal, setNewTermRecCanal] = useState('EMAIL');

  // Sprint 2 - Cambiar Estado, Equipo, and Partes States
  const [showChangeEstadoModal, setShowChangeEstadoModal] = useState(false);
  const [newEstado, setNewEstado] = useState('ACTIVO');
  const [estadoJustificacion, setEstadoJustificacion] = useState('');
  const [forceArchivado, setForceArchivado] = useState(false);
  const [pendingWarnings, setPendingWarnings] = useState(null);

  const [showAddColaboradorModal, setShowAddColaboradorModal] = useState(false);
  const [colaboradorId, setColaboradorId] = useState('');
  const [colaboradorRol, setColaboradorRol] = useState('ABOGADO');
  const [availableUsuarios, setAvailableUsuarios] = useState([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);

  const [showAddParteModal, setShowAddParteModal] = useState(false);
  const [parteNombre, setParteNombre] = useState('');
  const [parteTipo, setParteTipo] = useState('DEMANDANTE');

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = currentUser.rol === 'ADMINISTRADOR';
  const isResponsable = proceso ? currentUser.id_usuario === proceso.id_abogado_resp : false;
  const canModify = isAdmin || isResponsable;

  // -------------------------------------------------------------
  // Data Fetching Methods
  // -------------------------------------------------------------
  const fetchProceso = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/procesos/${id}`);
      setProceso(res.data);
      
      // Seed edit form
      setJuzgado(res.data.juzgado || '');
      setClaseProceso(res.data.clase_proceso || '');
      setAreaDerecho(res.data.area_derecho || '');
      setFechaRadicado(res.data.fecha_radicado ? res.data.fecha_radicado.split('T')[0] : '');
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar los detalles del expediente');
      navigate('/procesos');
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoadingDocs(true);
      const res = await api.get(`/documentos/proceso/${id}`);
      setDocumentos(res.data);
    } catch (error) {
      console.error(error);
      toast.error('Error al obtener documentos del expediente');
    } finally {
      setLoadingDocs(false);
    }
  };

  const fetchAudiencias = async () => {
    try {
      setLoadingAudiencias(true);
      const res = await api.get(`/audiencias/proceso/${id}`);
      setAudiencias(res.data);
    } catch (error) {
      console.error(error);
      toast.error('Error al obtener la agenda de audiencias');
    } finally {
      setLoadingAudiencias(false);
    }
  };

  const fetchTerminos = async () => {
    try {
      setLoadingTerminos(true);
      const res = await api.get(`/terminos/proceso/${id}`);
      setTerminos(res.data);
    } catch (error) {
      console.error(error);
      toast.error('Error al obtener términos procesales');
    } finally {
      setLoadingTerminos(false);
    }
  };

  // Run initial fetch
  useEffect(() => {
    fetchProceso();
  }, [id]);

  // Handle lazy loading for tab views
  useEffect(() => {
    if (activeTab === 'documentos') {
      fetchDocuments();
    } else if (activeTab === 'agenda') {
      fetchAudiencias();
    } else if (activeTab === 'terminos') {
      fetchTerminos();
    }
  }, [activeTab]);

  // -------------------------------------------------------------
  // Submit Handlers
  // -------------------------------------------------------------
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        juzgado,
        clase_proceso: claseProceso,
        area_derecho: areaDerecho,
        fecha_radicado: fechaRadicado || null
      };

      const res = await api.put(`/procesos/${id}`, data);
      toast.success(res.data.message || 'Expediente actualizado exitosamente');
      setShowEditModal(false);
      fetchProceso(); // Reload with new history entry!
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al actualizar el expediente');
    }
  };

  // Document management handlers
  const handleDocUploadSubmit = async (e) => {
    e.preventDefault();
    if (!docFile) {
      toast.error('Por favor seleccione un archivo para cargar');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('archivo', docFile);
      formData.append('id_proceso', id);
      formData.append('nombre', docNombre || docFile.name);
      formData.append('categoria', docCategoria);
      formData.append('visibilidad', docVisibilidad);

      const res = await api.post('/documentos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success(res.data.message || 'Archivo legal cargado y registrado');
      setShowUploadDocModal(false);
      setDocNombre('');
      setDocFile(null);
      fetchDocuments();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al cargar el documento');
    }
  };

  const handleNewVersionSubmit = async (e) => {
    e.preventDefault();
    if (!docFile) {
      toast.error('Seleccione el archivo de la nueva versión');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('archivo', docFile);

      const res = await api.post(`/documentos/${selectedDoc.id_documento}/version`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success(res.data.message || 'Nueva versión cargada con éxito');
      setShowNewVersionModal(false);
      setDocFile(null);
      fetchDocuments();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al subir la nueva versión');
    }
  };

  const handleDownloadDoc = async (idVersion) => {
    try {
      toast.loading('Generando URL de descarga segura...');
      const res = await api.get(`/documentos/download/${idVersion}`);
      toast.dismiss();
      if (res.data.url) {
        window.open(res.data.url, '_blank');
      }
    } catch (error) {
      toast.dismiss();
      console.error(error);
      toast.error('Error al descargar el archivo');
    }
  };

  const handleViewHistory = async (doc) => {
    try {
      setSelectedDoc(doc);
      setShowVersionesModal(true);
      setLoadingVersiones(true);
      const res = await api.get(`/documentos/${doc.id_documento}/versiones`);
      setDocVersiones(res.data);
    } catch (error) {
      console.error(error);
      toast.error('Error al obtener el historial de versiones');
    } finally {
      setLoadingVersiones(false);
    }
  };

  const handleDeleteDoc = async (idDoc) => {
    if (!window.confirm('¿Está seguro de que desea eliminar este documento? Esta acción se registrará en la auditoría.')) {
      return;
    }
    try {
      await api.delete(`/documentos/${idDoc}`);
      toast.success('Documento eliminado (eliminación lógica)');
      fetchDocuments();
    } catch (error) {
      console.error(error);
      toast.error('Error al eliminar el documento');
    }
  };

  const handleUpdateDocEstado = async (e) => {
    e.preventDefault();
    try {
      const res = await api.patch(`/documentos/${selectedDoc.id_documento}/estado`, { estado: docEstadoNuevo });
      toast.success(res.data.message || 'Estado del documento actualizado');
      setShowDocEstadoModal(false);
      fetchDocuments();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al actualizar el estado del documento');
    }
  };

  const handleDeleteDefinitivoSubmit = async (e) => {
    e.preventDefault();
    if (!deleteJustificacion.trim()) {
      toast.error('La justificación es obligatoria');
      return;
    }
    try {
      const res = await api.delete(`/documentos/${selectedDoc.id_documento}/definitivo`, {
        data: { justificacion: deleteJustificacion }
      });
      toast.success(res.data.message || 'Documento eliminado de forma física y definitiva');
      setShowDeleteDefinitivoModal(false);
      setDeleteJustificacion('');
      fetchDocuments();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al eliminar definitivamente el documento');
    }
  };

  // Audiencias scheduling handlers
  const handleAddAudienciaSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        id_proceso: id,
        nombre: audNombre,
        tipo: audTipo,
        fecha_hora: audFechaHora,
        lugar: audLugar,
        recordatorios: customRecordatorios.map(r => ({
          minutos_antes: parseInt(r.minutos_antes),
          canal: r.canal
        }))
      };

      const res = await api.post('/audiencias', data);
      toast.success(res.data.message || 'Audiencia judicial programada');
      setShowAddAudienciaModal(false);
      setAudNombre('');
      setAudTipo('');
      setAudFechaHora('');
      setAudLugar('');
      setCustomRecordatorios([{ minutos_antes: 1440, canal: 'EMAIL' }]);
      fetchAudiencias();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al programar la audiencia');
    }
  };

  const handleReprogramSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        nombre: reprogramNombre,
        tipo: reprogramTipo,
        fecha_hora: reprogramFechaHora,
        lugar: reprogramLugar
      };

      const res = await api.put(`/audiencias/${selectedAudiencia.id_audiencia}`, data);
      toast.success(res.data.message || 'Audiencia reprogramada con éxito');
      setShowReprogramModal(false);
      fetchAudiencias();
      fetchProceso(); // Recargar historial de bitácora
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al reprogramar la audiencia');
    }
  };

  const handleMarkAudienciaEstado = async (idAud, nuevoEstado) => {
    try {
      const res = await api.put(`/audiencias/${idAud}`, { estado: nuevoEstado });
      toast.success(res.data.message || `Audiencia marcada como ${nuevoEstado}`);
      fetchAudiencias();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al cambiar estado de la audiencia');
    }
  };

  // Court terms/deadlines handlers
  const handleAddTerminoSubmit = async (e) => {
    e.preventDefault();
    try {
      // Map custom term recordatorios list
      const recordatoriosListFormatted = termRecordatoriosList.map(r => {
        const vDate = new Date(termFechaVencimiento);
        const sendDate = new Date(vDate.getTime() - r.minutos_antes * 60 * 1000);
        return {
          fecha_hora_envio: sendDate.toISOString(),
          canal: r.canal
        };
      });

      const data = {
        id_proceso: id,
        nombre: termNombre,
        fecha_vencimiento: termFechaVencimiento,
        es_critico: termEsCritico,
        recordatorios: recordatoriosListFormatted
      };

      const res = await api.post('/terminos', data);
      toast.success(res.data.message || 'Término judicial registrado');
      setShowAddTerminoModal(false);
      setTermNombre('');
      setTermFechaVencimiento('');
      setTermEsCritico(false);
      setTermRecordatoriosList([]);
      fetchTerminos();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al programar el término judicial');
    }
  };

  const handleAddTermRecordatorio = () => {
    const val = parseInt(newTermRecValor);
    if (isNaN(val) || val <= 0) {
      toast.error('Ingrese un valor numérico válido y mayor a 0');
      return;
    }
    let mins = val;
    if (newTermRecUnidad === 'HORAS') mins = val * 60;
    if (newTermRecUnidad === 'DIAS') mins = val * 1440;

    setTermRecordatoriosList([...termRecordatoriosList, {
      minutos_antes: mins,
      canal: newTermRecCanal
    }]);
  };

  const handleGestionarTerminoSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        estado: termEstadoGestion,
        justificacion: termJustificacion
      };

      const res = await api.put(`/terminos/${selectedTermino.id_termino}/gestion`, data);
      toast.success(res.data.message || 'Término judicial gestionado');
      setShowGestionarTerminoModal(false);
      setTermJustificacion('');
      fetchTerminos();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al gestionar el término');
    }
  };

  // -------------------------------------------------------------
  // State changes, Co-defenders, and Partes handlers (Sprint 2)
  // -------------------------------------------------------------
  const handleCambiarEstado = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/procesos/${id}/estado`, {
        estado: newEstado,
        justificacion: estadoJustificacion,
        force: forceArchivado
      });
      toast.success(res.data.message || 'Estado actualizado exitosamente');
      setShowChangeEstadoModal(false);
      setEstadoJustificacion('');
      setPendingWarnings(null);
      setForceArchivado(false);
      fetchProceso();
    } catch (error) {
      console.error(error);
      if (error.response?.status === 400 && error.response?.data?.hasPending) {
        setPendingWarnings(error.response.data);
        toast.error('No se puede archivar: Existen audiencias o términos pendientes');
      } else {
        toast.error(error.response?.data?.error || 'Error al cambiar el estado del proceso');
      }
    }
  };

  const fetchUsuariosDisponibles = async () => {
    try {
      setLoadingUsuarios(true);
      const res = await api.get('/admin/usuarios').catch(() => null);
      if (res && res.data) {
        // Filter out already assigned users
        const assignedIds = new Set([
          proceso.id_abogado_resp,
          ...(proceso.abogados?.map(a => a.id_usuario) || [])
        ]);
        const filtered = res.data.filter(u => !assignedIds.has(u.id_usuario));
        setAvailableUsuarios(filtered);
        if (filtered.length > 0) {
          setColaboradorId(filtered[0].id_usuario);
        }
      } else {
        // Fallback to current user if authorized but can't fetch others
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        if (currentUser && currentUser.id_usuario) {
          const assignedIds = new Set([
            proceso.id_abogado_resp,
            ...(proceso.abogados?.map(a => a.id_usuario) || [])
          ]);
          if (!assignedIds.has(currentUser.id_usuario)) {
            setAvailableUsuarios([currentUser]);
            setColaboradorId(currentUser.id_usuario);
          } else {
            setAvailableUsuarios([]);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsuarios(false);
    }
  };

  const handleAsignarColaborador = async (e) => {
    e.preventDefault();
    if (!colaboradorId) {
      toast.error('Seleccione un colaborador para asignar');
      return;
    }
    try {
      const res = await api.post(`/procesos/${id}/abogados`, {
        id_usuario: colaboradorId,
        rol_en_proceso: colaboradorRol
      });
      toast.success(res.data.message || 'Colaborador asignado al expediente');
      setShowAddColaboradorModal(false);
      fetchProceso();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al asignar el colaborador');
    }
  };

  const handleRemoverColaborador = async (idUsuario) => {
    if (!window.confirm('¿Está seguro de que desea remover este colaborador del expediente? Esta acción quedará registrada.')) {
      return;
    }
    try {
      const res = await api.delete(`/procesos/${id}/abogados/${idUsuario}`);
      toast.success(res.data.message || 'Colaborador desvinculado con éxito');
      fetchProceso();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al remover el colaborador');
    }
  };

  const handleRegistrarParte = async (e) => {
    e.preventDefault();
    if (!parteNombre.trim()) {
      toast.error('Ingrese el nombre de la parte procesal');
      return;
    }
    try {
      const res = await api.post(`/procesos/${id}/partes`, {
        nombre: parteNombre,
        tipo: parteTipo
      });
      toast.success(res.data.message || 'Parte procesal registrada con éxito');
      setShowAddParteModal(false);
      setParteNombre('');
      fetchProceso();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al registrar la parte procesal');
    }
  };

  const handleEliminarParte = async (idParte) => {
    if (!window.confirm('¿Está seguro de que desea eliminar esta parte procesal? Esta acción quedará registrada.')) {
      return;
    }
    try {
      const res = await api.delete(`/procesos/${id}/partes/${idParte}`);
      toast.success(res.data.message || 'Parte procesal eliminada con éxito');
      fetchProceso();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al eliminar la parte procesal');
    }
  };

  // -------------------------------------------------------------
  // Helper Calculations
  // -------------------------------------------------------------
  const getSemaforoStats = () => {
    let rojos = 0;
    let amarillos = 0;
    let verdes = 0;
    const now = new Date();

    terminos.forEach(t => {
      if (t.estado !== 'PENDIENTE') {
        verdes++;
      } else {
        const diffHours = (new Date(t.fecha_vencimiento) - now) / (1000 * 60 * 60);
        if (diffHours <= 0) {
          rojos++;
        } else if (diffHours <= 48) {
          amarillos++;
        } else {
          verdes++;
        }
      }
    });

    return { rojos, amarillos, verdes };
  };

  const getTerminoAlertColor = (t) => {
    if (t.estado !== 'PENDIENTE') return 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400';
    const diffHours = (new Date(t.fecha_vencimiento) - new Date()) / (1000 * 60 * 60);
    if (diffHours <= 0) return 'border-rose-500/20 bg-rose-500/5 text-rose-400';
    if (diffHours <= 48) return 'border-amber-500/20 bg-amber-500/5 text-amber-400';
    return 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400';
  };

  const getRemainingTimeText = (vencimiento, estado) => {
    if (estado !== 'PENDIENTE') return 'Completado';
    const diffMs = new Date(vencimiento) - new Date();
    if (diffMs <= 0) return 'Vencido 🚨';
    
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    if (days > 0) {
      return `Vence en ${days}d ${remainingHours}h`;
    }
    if (hours > 0) {
      return `Vence en ${hours}h ${mins}m`;
    }
    return `Vence en ${mins}m`;
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // -------------------------------------------------------------
  // Render View
  // -------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-t-white border-neutral-800 animate-spin" />
        <p className="text-neutral-400 text-sm">Cargando detalles del expediente...</p>
      </div>
    );
  }

  if (!proceso) return null;

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/procesos')}
            className="p-3 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white rounded-xl transition-all cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-neutral-500">
              Expediente Judicial
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
              Radicado: {proceso.numero_radicado}
            </h1>
          </div>
        </div>

        <button
          onClick={() => setShowEditModal(true)}
          className="flex items-center justify-center gap-2 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-all cursor-pointer text-sm"
        >
          <Edit3 size={16} />
          <span>Editar Datos</span>
        </button>
      </div>

      {/* Tabs navigation bar */}
      <div className="flex border-b border-neutral-800 overflow-x-auto scrollbar-none gap-2 pb-px">
        {[
          { id: 'general', label: 'General', icon: Briefcase },
          { id: 'documentos', label: 'Documentos', icon: FileText },
          { id: 'agenda', label: 'Agenda / Audiencias', icon: Calendar },
          { id: 'terminos', label: 'Términos Judiciales', icon: ListTodo }
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3.5 border-b-2 font-bold text-sm transition-all cursor-pointer whitespace-nowrap ${
                isSelected 
                  ? 'border-white text-white' 
                  : 'border-transparent text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: GENERAL */}
      {activeTab === 'general' && (
        <div className="space-y-6 animate-fade-in w-full">
          {(!proceso.partes?.some(p => p.tipo === 'DEMANDANTE') || !proceso.partes?.some(p => p.tipo === 'DEMANDADO')) && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3 text-amber-400">
              <AlertTriangle className="flex-shrink-0" size={20} />
              <div className="text-xs">
                <span className="font-bold">Expediente Incompleto:</span> Se requiere registrar al menos un <span className="font-semibold underline">Demandante</span> y un <span className="font-semibold underline">Demandado</span> en la sección de Partes Procesales para completar la conformación básica del expediente.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Card: General Information */}
              <div className="bg-gradient-to-b from-neutral-950 to-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Briefcase size={20} className="text-neutral-400" />
                  <span>Información General del Proceso</span>
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div className="space-y-1">
                    <p className="text-neutral-500 font-medium">Despacho Judicial</p>
                    <p className="text-white font-semibold text-base">{proceso.juzgado || 'No especificado'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-neutral-500 font-medium">Jurisdicción / Tipo de Proceso</p>
                    <p className="text-white font-semibold text-base">{proceso.tipo_proceso}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-neutral-500 font-medium">Clase de Proceso</p>
                    <p className="text-white font-semibold text-base">{proceso.clase_proceso || 'No especificada'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-neutral-500 font-medium">Área del Derecho</p>
                    <p className="text-white font-semibold text-base">{proceso.area_derecho || 'No especificada'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-neutral-500 font-medium">Estado del Proceso</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-block px-3 py-1 rounded text-xs font-bold border ${
                        proceso.estado === 'ACTIVO' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        proceso.estado === 'SUSPENDIDO' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        proceso.estado === 'ARCHIVADO' ? 'bg-neutral-800 text-neutral-400 border-neutral-700' :
                        'bg-blue-500/10 text-blue-400 border-blue-500/20' // FINALIZADO
                      }`}>
                        {proceso.estado}
                      </span>
                      <button
                        onClick={() => {
                          setNewEstado(proceso.estado);
                          setEstadoJustificacion('');
                          setForceArchivado(false);
                          setPendingWarnings(null);
                          setShowChangeEstadoModal(true);
                        }}
                        className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors text-xs flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <Edit3 size={12} />
                        <span>Cambiar</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-neutral-500 font-medium">Fecha de Radicación</p>
                    <p className="text-white font-semibold text-base flex items-center gap-1.5 mt-1">
                      <Calendar size={15} className="text-neutral-500" />
                      {proceso.fecha_radicado 
                        ? new Date(proceso.fecha_radicado).toLocaleDateString()
                        : 'No registrada'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Card: Client & Lawyer Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Client Profile Summary */}
                <div 
                  onClick={() => navigate(`/clientes/${proceso.id_cliente}`)}
                  className="bg-neutral-950 border border-neutral-800 hover:border-neutral-700 p-6 rounded-3xl cursor-pointer transition-colors shadow-lg group"
                >
                  <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-4">
                    Cliente Asociado
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-neutral-900 flex items-center justify-center text-white">
                      {proceso.cliente?.tipo === 'NATURAL' ? <User size={22} /> : <Building2 size={22} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-bold group-hover:text-neutral-300 transition-colors truncate">
                        {proceso.cliente?.nombre || proceso.cliente?.razon_social}
                      </p>
                      <p className="text-xs text-neutral-400 mt-0.5 truncate">
                        {proceso.cliente?.tipo_documento}: {proceso.cliente?.numero_documento}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Abogado Responsable */}
                <div className="bg-neutral-950 border border-neutral-800 p-6 rounded-3xl shadow-lg">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-4">
                    Abogado Responsable
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-neutral-900 flex items-center justify-center text-neutral-400">
                      <User size={22} />
                    </div>
                    <div>
                      <p className="text-white font-bold">{proceso.abogado_resp?.nombre}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">{proceso.abogado_resp?.email}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid: Equipo de Trabajo and Partes Procesales (HU-08 & HU-11) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Equipo de Trabajo */}
                <div className="bg-neutral-950 border border-neutral-800 p-6 rounded-3xl shadow-lg space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                      <Users size={16} />
                      <span>Equipo de Trabajo</span>
                    </h3>
                    {canModify && (
                      <button
                        onClick={() => {
                          fetchUsuariosDisponibles();
                          setShowAddColaboradorModal(true);
                        }}
                        className="p-1.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-white rounded-lg text-xs flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <UserPlus size={12} />
                        <span>Asignar</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                    {/* Responsable Principal */}
                    <div className="flex items-center justify-between p-3 bg-neutral-900/40 border border-neutral-800 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-400 text-xs font-bold">
                          R
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{proceso.abogado_resp?.nombre}</p>
                          <p className="text-[10px] text-neutral-500 truncate">{proceso.abogado_resp?.email}</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded text-[9px] font-bold">
                        RESPONSABLE
                      </span>
                    </div>

                    {/* Colaboradores adicionales */}
                    {!proceso.abogados || proceso.abogados.length === 0 ? (
                      <p className="text-neutral-500 text-xs text-center py-4">No hay colaboradores adicionales asignados.</p>
                    ) : (
                      proceso.abogados.map((abg) => (
                        <div key={abg.id_usuario} className="flex items-center justify-between p-3 bg-neutral-900/20 border border-neutral-900 rounded-2xl hover:border-neutral-800 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center text-neutral-400 text-xs font-bold">
                              C
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{abg.usuario?.nombre}</p>
                              <p className="text-[10px] text-neutral-500 truncate">{abg.usuario?.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                              abg.rol_en_proceso === 'ABOGADO' 
                                ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                                : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                            }`}>
                              {abg.rol_en_proceso}
                            </span>
                            {canModify && (
                              <button
                                onClick={() => handleRemoverColaborador(abg.id_usuario)}
                                className="p-1 hover:bg-neutral-900 rounded text-neutral-500 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Remover del caso"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Partes Procesales */}
                <div className="bg-neutral-950 border border-neutral-800 p-6 rounded-3xl shadow-lg space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                      <Users size={16} />
                      <span>Partes Procesales</span>
                    </h3>
                    {canModify && (
                      <button
                        onClick={() => {
                          setParteNombre('');
                          setParteTipo('DEMANDANTE');
                          setShowAddParteModal(true);
                        }}
                        className="p-1.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-white rounded-lg text-xs flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <Plus size={12} />
                        <span>Agregar</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                    {!proceso.partes || proceso.partes.length === 0 ? (
                      <p className="text-neutral-500 text-xs text-center py-8">No hay partes procesales registradas.</p>
                    ) : (
                      proceso.partes.map((prt) => (
                        <div key={prt.id_procesal} className="flex items-center justify-between p-3 bg-neutral-900/20 border border-neutral-900 rounded-2xl hover:border-neutral-800 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center text-neutral-400 text-xs font-bold flex-shrink-0">
                              {prt.nombre.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{prt.nombre}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                              prt.tipo === 'DEMANDANTE' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                              prt.tipo === 'DEMANDADO' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                              prt.tipo === 'VICTIMA' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                              'bg-neutral-800 border-neutral-700 text-neutral-400'
                            }`}>
                              {prt.tipo}
                            </span>
                            {canModify && (
                              <button
                                onClick={() => handleEliminarParte(prt.id_procesal)}
                                className="p-1 hover:bg-neutral-900 rounded text-neutral-500 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Eliminar parte"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Change History Timeline */}
            <div className="lg:col-span-1 bg-gradient-to-b from-neutral-950 to-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock size={20} className="text-neutral-400" />
                <span>Bitácora de Cambios</span>
              </h2>

              {!proceso.historial || proceso.historial.length === 0 ? (
                <div className="text-center py-12 rounded-2xl bg-neutral-900/40 border border-neutral-900/80">
                  <AlertCircle className="mx-auto text-neutral-700 mb-2" size={32} />
                  <p className="text-neutral-400 text-xs">No hay modificaciones registradas en el expediente.</p>
                </div>
              ) : (
                <div className="relative border-l border-neutral-800 pl-4 ml-2 space-y-6">
                  {proceso.historial.map((hist) => (
                    <div key={hist.id_historial} className="relative group">
                      <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-neutral-700 group-hover:bg-white transition-colors" />
                      
                      <div className="space-y-1">
                        <span className="text-[10px] text-neutral-500 font-bold">
                          {new Date(hist.created_at).toLocaleString()}
                        </span>
                        <p className="text-xs text-white font-semibold">
                          {hist.usuario?.nombre}
                        </p>
                        <p className="text-xs text-neutral-400">
                          Editó: <span className="text-white bg-neutral-900 px-1.5 py-0.5 rounded text-[10px]">{hist.campo_modificado}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: DOCUMENTS */}
      {activeTab === 'documentos' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-white">Gestión Documental</h2>
              <p className="text-xs text-neutral-400">Cargue y gestione contratos, demandas y pruebas con control de versiones físico.</p>
            </div>
            <button
              onClick={() => setShowUploadDocModal(true)}
              className="flex items-center gap-1.5 bg-white text-black hover:bg-neutral-200 font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer text-xs"
            >
              <Upload size={14} />
              <span>Subir Archivo</span>
            </button>
          </div>

          {loadingDocs ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-neutral-500" size={32} />
            </div>
          ) : documentos.length === 0 ? (
            <div className="text-center py-16 bg-neutral-950 border border-neutral-800 rounded-3xl">
              <FileText className="mx-auto text-neutral-700 mb-3" size={40} />
              <h3 className="text-white font-bold text-sm">Sin Documentos</h3>
              <p className="text-neutral-400 text-xs mt-1">No se han cargado archivos soporte en este expediente.</p>
            </div>
          ) : (
            <div className="bg-neutral-950 border border-neutral-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-800 bg-neutral-900/30 text-neutral-400 uppercase tracking-wider font-bold">
                      <th className="p-4 pl-6">Nombre del Archivo</th>
                      <th className="p-4">Categoría</th>
                      <th className="p-4">Versión Actual</th>
                      <th className="p-4">Tamaño</th>
                      <th className="p-4">Subido por</th>
                      <th className="p-4 text-right pr-6">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-900">
                    {documentos.map((doc) => (
                      <tr key={doc.id_documento} className="hover:bg-neutral-900/20 text-neutral-300">
                        <td className="p-4 pl-6 font-bold text-white">
                          <div className="flex items-center gap-2.5">
                            <FileText size={18} className="text-neutral-500" />
                            <span className="truncate max-w-[200px]" title={doc.nombre}>{doc.nombre}</span>
                            {doc.estado === 'INACTIVO' && (
                              <span className="px-1.5 py-0.5 bg-neutral-850 text-neutral-500 border border-neutral-800 rounded text-[9px] font-bold">
                                INACTIVO
                              </span>
                            )}
                            {doc.estado === 'REEMPLAZADO' && (
                              <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[9px] font-bold">
                                REEMPLAZADO
                              </span>
                            )}
                            {doc.estado === 'ACTIVO' && (
                              <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[9px] font-bold">
                                ACTIVO
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded text-[10px] font-bold text-neutral-400">
                            {doc.categoria}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-neutral-400">
                          v{doc.version_actual?.numero_version || 1}
                        </td>
                        <td className="p-4 text-neutral-400">
                          {formatBytes(doc.version_actual?.tamano_bytes || 0)}
                        </td>
                        <td className="p-4 text-neutral-400">
                          {doc.usuario?.nombre}
                        </td>
                        <td className="p-4 text-right pr-6 space-x-1 whitespace-nowrap">
                          <button
                            onClick={() => handleDownloadDoc(doc.id_version_actual)}
                            className="p-2 hover:bg-neutral-900 rounded-lg text-neutral-400 hover:text-white transition-colors cursor-pointer"
                            title="Descargar versión actual"
                          >
                            <Download size={14} />
                          </button>
                          <button
                            onClick={() => { setSelectedDoc(doc); setShowNewVersionModal(true); }}
                            className="p-2 hover:bg-neutral-900 rounded-lg text-neutral-400 hover:text-white transition-colors cursor-pointer"
                            title="Subir nueva versión"
                          >
                            <Upload size={14} />
                          </button>
                          {doc.estado === 'ACTIVO' && (
                            <button
                              onClick={() => { setSelectedDoc(doc); setDocEstadoNuevo('INACTIVO'); setShowDocEstadoModal(true); }}
                              className="p-2 hover:bg-neutral-900 rounded-lg text-neutral-400 hover:text-white transition-colors cursor-pointer"
                              title="Cambiar estado del documento"
                            >
                              <Edit3 size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => handleViewHistory(doc)}
                            className="p-2 hover:bg-neutral-900 rounded-lg text-neutral-400 hover:text-white transition-colors cursor-pointer"
                            title="Historial de versiones"
                          >
                            <History size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteDoc(doc.id_documento)}
                            className="p-2 hover:bg-neutral-900 rounded-lg text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Eliminar documento (Lógico)"
                          >
                            <Trash2 size={14} />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => { setSelectedDoc(doc); setDeleteJustificacion(''); setShowDeleteDefinitivoModal(true); }}
                              className="p-2 hover:bg-neutral-900 rounded-lg text-rose-500 hover:text-rose-450 transition-colors cursor-pointer border border-rose-500/10 bg-rose-500/5"
                              title="Eliminar definitivamente (Admin)"
                            >
                              <Trash2 size={14} className="stroke-[2.5]" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: AGENDA */}
      {activeTab === 'agenda' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-white">Agenda de Audiencias</h2>
              <p className="text-xs text-neutral-400">Rastree todas las diligencias judiciales asociadas a este expediente.</p>
            </div>
            <button
              onClick={() => setShowAddAudienciaModal(true)}
              className="flex items-center gap-1.5 bg-white text-black hover:bg-neutral-200 font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer text-xs"
            >
              <Plus size={14} />
              <span>Agendar Audiencia</span>
            </button>
          </div>

          {loadingAudiencias ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-neutral-500" size={32} />
            </div>
          ) : audiencias.length === 0 ? (
            <div className="text-center py-16 bg-neutral-950 border border-neutral-800 rounded-3xl">
              <Calendar className="mx-auto text-neutral-700 mb-3" size={40} />
              <h3 className="text-white font-bold text-sm">Sin Audiencias</h3>
              <p className="text-neutral-400 text-xs mt-1">No hay audiencias programadas en este proceso.</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-neutral-800 pl-6 ml-4 space-y-8 py-2">
              {audiencias.map((aud) => (
                <div key={aud.id_audiencia} className="relative group">
                  {/* Circular dot */}
                  <div className="absolute -left-[32px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-neutral-950 bg-neutral-800 group-hover:bg-white transition-all" />
                  
                  <div className="bg-neutral-950 border border-neutral-800 p-6 rounded-2xl max-w-2xl space-y-4 shadow-lg">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                          {aud.tipo}
                        </span>
                        <h3 className="text-base font-bold text-white">{aud.nombre}</h3>
                      </div>
                      
                      <span className={`inline-block px-2.5 py-1 text-[10px] font-bold rounded-lg border w-fit ${
                        aud.estado === 'PROGRAMADA' 
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : aud.estado === 'REALIZADA'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {aud.estado}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-neutral-400">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-neutral-500" />
                        <span>{new Date(aud.fecha_hora).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Briefcase size={14} className="text-neutral-500" />
                        <span className="truncate">Lugar: {aud.lugar}</span>
                      </div>
                    </div>

                    {aud.estado === 'PROGRAMADA' && (
                      <div className="flex gap-2 pt-2 border-t border-neutral-900 mt-2">
                        <button
                          onClick={() => {
                            setSelectedAudiencia(aud);
                            setReprogramNombre(aud.nombre);
                            setReprogramTipo(aud.tipo);
                            setReprogramFechaHora(aud.fecha_hora ? aud.fecha_hora.substring(0, 16) : '');
                            setReprogramLugar(aud.lugar);
                            setShowReprogramModal(true);
                          }}
                          className="p-1.5 px-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                        >
                          Reprogramar
                        </button>
                        <button
                          onClick={() => handleMarkAudienciaEstado(aud.id_audiencia, 'REALIZADA')}
                          className="p-1.5 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                        >
                          Marcar Realizada
                        </button>
                        <button
                          onClick={() => handleMarkAudienciaEstado(aud.id_audiencia, 'CANCELADA')}
                          className="p-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: TERMINOS */}
      {activeTab === 'terminos' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-white">Términos Judiciales</h2>
              <p className="text-xs text-neutral-400">Controle el vencimiento de términos y registre las justificaciones procesales obligatorias.</p>
            </div>
            <button
              onClick={() => setShowAddTerminoModal(true)}
              className="flex items-center gap-1.5 bg-white text-black hover:bg-neutral-200 font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer text-xs"
            >
              <Plus size={14} />
              <span>Registrar Plazo</span>
            </button>
          </div>

          {loadingTerminos ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-neutral-500" size={32} />
            </div>
          ) : terminos.length === 0 ? (
            <div className="text-center py-16 bg-neutral-950 border border-neutral-800 rounded-3xl">
              <ListTodo className="mx-auto text-neutral-700 mb-3" size={40} />
              <h3 className="text-white font-bold text-sm">Sin Plazos Registrados</h3>
              <p className="text-neutral-400 text-xs mt-1">No se han registrado vencimientos en este expediente.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Traffic light counts */}
              {(() => {
                const stats = getSemaforoStats();
                return (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="border border-rose-500/20 bg-rose-500/5 rounded-2xl p-4 flex flex-col items-center justify-center">
                      <span className="text-2xl font-extrabold text-rose-500">{stats.rojos}</span>
                      <span className="text-[10px] uppercase font-bold text-neutral-500 mt-1">Vencidos / Hoy</span>
                    </div>
                    <div className="border border-amber-500/20 bg-amber-500/5 rounded-2xl p-4 flex flex-col items-center justify-center">
                      <span className="text-2xl font-extrabold text-amber-500">{stats.amarillos}</span>
                      <span className="text-[10px] uppercase font-bold text-neutral-500 mt-1">Próximos (24-48h)</span>
                    </div>
                    <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-2xl p-4 flex flex-col items-center justify-center">
                      <span className="text-2xl font-extrabold text-emerald-500">{stats.verdes}</span>
                      <span className="text-[10px] uppercase font-bold text-neutral-500 mt-1">Al día / Resueltos</span>
                    </div>
                  </div>
                );
              })()}

              {/* Terminos grid table */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-neutral-900/30 text-neutral-400 uppercase tracking-wider font-bold">
                        <th className="p-4 pl-6">Descripción del Plazo</th>
                        <th className="p-4">Fecha Límite</th>
                        <th className="p-4">Prioridad</th>
                        <th className="p-4">Tiempo Restante</th>
                        <th className="p-4">Estado</th>
                        <th className="p-4 text-right pr-6">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900">
                      {terminos.map((t) => {
                        const alertColor = getTerminoAlertColor(t);
                        return (
                          <tr key={t.id_termino} className="hover:bg-neutral-900/20 text-neutral-300">
                            <td className="p-4 pl-6 font-bold text-white">
                              {t.nombre}
                            </td>
                            <td className="p-4 text-neutral-400">
                              {new Date(t.fecha_vencimiento).toLocaleString()}
                            </td>
                            <td className="p-4">
                              {t.es_critico ? (
                                <span className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded text-[9px] font-bold">
                                  CRÍTICO
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-neutral-900 border border-neutral-800 text-neutral-400 rounded text-[9px] font-bold">
                                  NORMAL
                                </span>
                              )}
                            </td>
                            <td className="p-4 font-semibold text-neutral-400">
                              {getRemainingTimeText(t.fecha_vencimiento, t.estado)}
                            </td>
                            <td className="p-4">
                              <span className={`inline-block px-2.5 py-1 text-[10px] font-bold rounded-lg border ${alertColor}`}>
                                {t.estado}
                              </span>
                            </td>
                            <td className="p-4 text-right pr-6">
                              {t.estado === 'PENDIENTE' ? (
                                <button
                                  onClick={() => { setSelectedTermino(t); setShowGestionarTerminoModal(true); }}
                                  className="bg-white text-black hover:bg-neutral-200 font-bold px-3 py-1.5 rounded-lg text-[10px] cursor-pointer"
                                >
                                  Gestionar
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    alert(`Justificación de la resolución:\n"${t.justificacion || 'No especificada'}"`);
                                  }}
                                  className="text-neutral-500 hover:text-white font-bold text-[10px] cursor-pointer"
                                >
                                  Ver Justificación
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL - EDIT PROCESO */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-3xl p-8 shadow-2xl animate-scale-in my-8">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute top-6 right-6 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent mb-2">
              Editar Datos del Expediente
            </h2>
            <p className="text-sm text-neutral-400 mb-6">
              Actualiza los datos clave. Cualquier cambio generará una bitácora inmutable en el historial.
            </p>

            <form onSubmit={handleEditSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Despacho / Juzgado
                  </label>
                  <input
                    type="text"
                    required
                    value={juzgado}
                    onChange={(e) => setJuzgado(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Clase de Proceso
                  </label>
                  <input
                    type="text"
                    required
                    value={claseProceso}
                    onChange={(e) => setClaseProceso(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Área del Derecho
                  </label>
                  <input
                    type="text"
                    required
                    value={areaDerecho}
                    onChange={(e) => setAreaDerecho(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Fecha de Radicación
                  </label>
                  <input
                    type="date"
                    value={fechaRadicado}
                    onChange={(e) => setFechaRadicado(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-neutral-300"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t border-neutral-900">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-white hover:bg-neutral-200 text-black font-semibold px-6 py-2.5 rounded-xl transition-all cursor-pointer text-sm flex items-center gap-1.5"
                >
                  <Save size={16} />
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL - UPLOAD DOCUMENT */}
      {showUploadDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-3xl p-8 shadow-2xl animate-scale-in my-8">
            <button
              onClick={() => setShowUploadDocModal(false)}
              className="absolute top-6 right-6 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent mb-2">
              Subir Soporte Documental
            </h2>
            <p className="text-sm text-neutral-400 mb-6">
              Adjunte demandas, fallos, pruebas o contratos. Límite máximo de 10MB.
            </p>

            <form onSubmit={handleDocUploadSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Nombre Descriptivo
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Demanda Inicial Modificada"
                    value={docNombre}
                    onChange={(e) => setDocNombre(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Categoría del Documento
                  </label>
                  <select
                    value={docCategoria}
                    onChange={(e) => setDocCategoria(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-neutral-300"
                  >
                    <option value="DEMANDA">Demanda</option>
                    <option value="PRUEBA">Prueba</option>
                    <option value="CONTRATO">Contrato</option>
                    <option value="NOTIFICACION">Notificación</option>
                    <option value="PROVIDENCIA">Providencia</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Visibilidad / Accesibilidad
                  </label>
                  <select
                    value={docVisibilidad}
                    onChange={(e) => setDocVisibilidad(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-neutral-300"
                  >
                    <option value="PRIVADO">Privado (Solo personal interno)</option>
                    <option value="COMPARTIDO_CLIENTE">Compartido con Cliente</option>
                    <option value="VISIBLE_COLAB">Visible para colaboradores</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Seleccionar Archivo
                  </label>
                  <input
                    type="file"
                    required
                    onChange={(e) => setDocFile(e.target.files[0])}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-neutral-300"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t border-neutral-900">
                <button
                  type="button"
                  onClick={() => setShowUploadDocModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-white hover:bg-neutral-200 text-black font-semibold px-6 py-2.5 rounded-xl transition-all cursor-pointer text-sm flex items-center gap-1.5"
                >
                  <Upload size={16} />
                  <span>Subir Documento</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL - UPLOAD NEW VERSION */}
      {showNewVersionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-3xl p-8 shadow-2xl animate-scale-in my-8">
            <button
              onClick={() => setShowNewVersionModal(false)}
              className="absolute top-6 right-6 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent mb-2">
              Subir Nueva Versión
            </h2>
            <p className="text-sm text-neutral-400 mb-6">
              Reemplace el archivo de: <strong className="text-white">{selectedDoc?.nombre}</strong>. La versión física se incrementará de manera automática.
            </p>

            <form onSubmit={handleNewVersionSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Seleccionar Archivo
                  </label>
                  <input
                    type="file"
                    required
                    onChange={(e) => setDocFile(e.target.files[0])}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-neutral-300"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t border-neutral-900">
                <button
                  type="button"
                  onClick={() => setShowNewVersionModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-white hover:bg-neutral-200 text-black font-semibold px-6 py-2.5 rounded-xl transition-all cursor-pointer text-sm flex items-center gap-1.5"
                >
                  <Upload size={16} />
                  <span>Subir Versión</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL - VERSION HISTORY */}
      {showVersionesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-neutral-950 border border-neutral-800 rounded-3xl p-8 shadow-2xl animate-scale-in my-8">
            <button
              onClick={() => setShowVersionesModal(false)}
              className="absolute top-6 right-6 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent mb-2">
              Historial de Versiones
            </h2>
            <p className="text-sm text-neutral-400 mb-6">
              Visualice y descargue versiones anteriores de: <strong className="text-white">{selectedDoc?.nombre}</strong>
            </p>

            {loadingVersiones ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-neutral-500" />
              </div>
            ) : (
              <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-800 bg-neutral-900 text-neutral-400 uppercase tracking-wider font-bold">
                      <th className="p-3 pl-5">Versión</th>
                      <th className="p-3">Nombre de Archivo</th>
                      <th className="p-3">Fecha y Hora</th>
                      <th className="p-3">Tamaño</th>
                      <th className="p-3">Subido por</th>
                      <th className="p-3 text-right pr-5">Descarga</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-900">
                    {docVersiones.map((v) => (
                      <tr key={v.id_version} className="hover:bg-neutral-900/10 text-neutral-300">
                        <td className="p-3 pl-5 font-bold text-white">v{v.numero_version}</td>
                        <td className="p-3 truncate max-w-[150px]" title={v.nombre_archivo}>{v.nombre_archivo}</td>
                        <td className="p-3 text-neutral-400">{new Date(v.created_at).toLocaleString()}</td>
                        <td className="p-3 text-neutral-400">{formatBytes(v.tamano_bytes)}</td>
                        <td className="p-3 text-neutral-400">{v.usuario?.nombre}</td>
                        <td className="p-3 text-right pr-5">
                          <button
                            onClick={() => handleDownloadDoc(v.id_version)}
                            className="p-1.5 hover:bg-neutral-900 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
                          >
                            <Download size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-6 border-t border-neutral-900 mt-6">
              <button
                type="button"
                onClick={() => setShowVersionesModal(false)}
                className="px-6 py-2.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-white font-bold rounded-xl cursor-pointer text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL - SCHEDULE AUDIENCIA */}
      {showAddAudienciaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-3xl p-8 shadow-2xl animate-scale-in my-8">
            <button
              onClick={() => setShowAddAudienciaModal(false)}
              className="absolute top-6 right-6 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent mb-2">
              Programar Audiencia Judicial
            </h2>
            <p className="text-sm text-neutral-400 mb-6">
              Registre audiencias virtuales o presenciales. El cron job del sistema despachará alertas al correo registrado del abogado.
            </p>

            <form onSubmit={handleAddAudienciaSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Descripción de Diligencia
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Audiencia de Conciliación"
                    value={audNombre}
                    onChange={(e) => setAudNombre(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Tipo de Audiencia
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Penal / Administrativa"
                    value={audTipo}
                    onChange={(e) => setAudTipo(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Fecha y Hora
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={audFechaHora}
                    onChange={(e) => setAudFechaHora(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-neutral-300"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Lugar / Enlace de Conexión
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Sala Virtual Teams / Juzgado 3 Civil"
                    value={audLugar}
                    onChange={(e) => setAudLugar(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>

                <div className="space-y-4 pt-2 border-t border-neutral-900">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Recordatorios Personalizados (Máx 3)
                  </label>

                  {customRecordatorios.length === 0 ? (
                    <p className="text-[10px] text-neutral-500 italic">No se han configurado recordatorios para esta audiencia.</p>
                  ) : (
                    <div className="space-y-2">
                      {customRecordatorios.map((r, idx) => {
                        let displayTime = `${r.minutos_antes} min`;
                        if (r.minutos_antes % 1440 === 0) {
                          displayTime = `${r.minutos_antes / 1440} día(s)`;
                        } else if (r.minutos_antes % 60 === 0) {
                          displayTime = `${r.minutos_antes / 60} hora(s)`;
                        }
                        return (
                          <div key={idx} className="flex justify-between items-center bg-neutral-900/60 border border-neutral-800 rounded-xl px-4 py-2 text-xs text-white">
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span>{displayTime} antes vía <strong className="text-neutral-300">{r.canal}</strong></span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const list = [...customRecordatorios];
                                list.splice(idx, 1);
                                setCustomRecordatorios(list);
                              }}
                              className="text-[10px] text-rose-400 hover:text-rose-300 font-bold"
                            >
                              Eliminar
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {customRecordatorios.length < 3 && (
                    <div className="bg-neutral-900/20 border border-neutral-800 p-4 rounded-2xl space-y-3">
                      <p className="text-[10px] uppercase font-bold text-neutral-500">Agregar Nueva Alerta</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <input
                            type="number"
                            id="new_aud_rec_val"
                            placeholder="Valor"
                            defaultValue={24}
                            className="w-full bg-neutral-950 border border-neutral-800 focus:outline-none focus:border-white rounded-lg px-2 py-1.5 text-xs text-white"
                          />
                        </div>
                        <div>
                          <select
                            id="new_aud_rec_unit"
                            defaultValue="HORAS"
                            className="w-full bg-neutral-950 border border-neutral-800 focus:outline-none focus:border-white rounded-lg px-2 py-1.5 text-xs text-neutral-300"
                          >
                            <option value="MINUTOS">Minutos</option>
                            <option value="HORAS">Horas</option>
                            <option value="DIAS">Días</option>
                          </select>
                        </div>
                        <div>
                          <select
                            id="new_aud_rec_chan"
                            defaultValue="EMAIL"
                            className="w-full bg-neutral-950 border border-neutral-800 focus:outline-none focus:border-white rounded-lg px-2 py-1.5 text-xs text-neutral-300"
                          >
                            <option value="EMAIL">Email</option>
                            <option value="PLATAFORMA">Plataforma</option>
                            <option value="AMBOS">Ambos</option>
                          </select>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const valEl = document.getElementById('new_aud_rec_val');
                          const unitEl = document.getElementById('new_aud_rec_unit');
                          const chanEl = document.getElementById('new_aud_rec_chan');
                          
                          const val = parseInt(valEl.value);
                          if (isNaN(val) || val <= 0) {
                            toast.error('Ingrese un valor numérico válido y mayor a 0');
                            return;
                          }
                          let mins = val;
                          if (unitEl.value === 'HORAS') mins = val * 60;
                          if (unitEl.value === 'DIAS') mins = val * 1440;
                          
                          setCustomRecordatorios([...customRecordatorios, {
                            minutos_antes: mins,
                            canal: chanEl.value
                          }]);
                        }}
                        className="w-full py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer text-center"
                      >
                        + Agregar Recordatorio
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t border-neutral-900">
                <button
                  type="button"
                  onClick={() => setShowAddAudienciaModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-white hover:bg-neutral-200 text-black font-semibold px-6 py-2.5 rounded-xl transition-all cursor-pointer text-sm flex items-center gap-1.5"
                >
                  <Save size={16} />
                  <span>Programar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL - ADD TERMINO */}
      {showAddTerminoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-3xl p-8 shadow-2xl animate-scale-in my-8">
            <button
              onClick={() => setShowAddTerminoModal(false)}
              className="absolute top-6 right-6 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent mb-2">
              Registrar Plazo Judicial
            </h2>
            <p className="text-sm text-neutral-400 mb-6">
              Añada un término crítico para contestar demanda, interponer recursos o subsanar pliegos.
            </p>

            <form onSubmit={handleAddTerminoSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Descripción del Término
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Plazo para contestar demanda"
                    value={termNombre}
                    onChange={(e) => setTermNombre(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Fecha y Hora de Vencimiento
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={termFechaVencimiento}
                    onChange={(e) => setTermFechaVencimiento(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-neutral-300"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block mb-1">
                    ¿Es un Término Crítico?
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-400">
                    <input
                      type="checkbox"
                      checked={termEsCritico}
                      onChange={(e) => setTermEsCritico(e.target.checked)}
                      className="rounded border-neutral-800 text-white focus:ring-0"
                    />
                    <span>Sí, enviar alertas preventivas adicionales de alta prioridad.</span>
                  </label>
                </div>

                {/* Term Recordatorios list */}
                <div className="space-y-4 pt-2 border-t border-neutral-900">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Recordatorios de Vencimiento (Máx 3)
                  </label>

                  {termRecordatoriosList.length === 0 ? (
                    <p className="text-[10px] text-neutral-500 italic">No se han configurado recordatorios personalizados. Se usarán los valores por defecto (5d, 1d, 0h).</p>
                  ) : (
                    <div className="space-y-2">
                      {termRecordatoriosList.map((r, idx) => {
                        let displayTime = `${r.minutos_antes} min`;
                        if (r.minutos_antes % 1440 === 0) {
                          displayTime = `${r.minutos_antes / 1440} día(s)`;
                        } else if (r.minutos_antes % 60 === 0) {
                          displayTime = `${r.minutos_antes / 60} hora(s)`;
                        }
                        return (
                          <div key={idx} className="flex justify-between items-center bg-neutral-900/60 border border-neutral-800 rounded-xl px-4 py-2 text-xs text-white">
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              <span>{displayTime} antes vía <strong className="text-neutral-300">{r.canal}</strong></span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const list = [...termRecordatoriosList];
                                list.splice(idx, 1);
                                setTermRecordatoriosList(list);
                              }}
                              className="text-[10px] text-rose-400 hover:text-rose-300 font-bold"
                            >
                              Eliminar
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {termRecordatoriosList.length < 3 && (
                    <div className="bg-neutral-900/20 border border-neutral-800 p-4 rounded-2xl space-y-3">
                      <p className="text-[10px] uppercase font-bold text-neutral-500">Configurar Alerta Preventiva</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <input
                            type="number"
                            value={newTermRecValor}
                            onChange={(e) => setNewTermRecValor(e.target.value)}
                            placeholder="Valor"
                            className="w-full bg-neutral-950 border border-neutral-800 focus:outline-none focus:border-white rounded-lg px-2 py-1.5 text-xs text-white"
                          />
                        </div>
                        <div>
                          <select
                            value={newTermRecUnidad}
                            onChange={(e) => setNewTermRecUnidad(e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-800 focus:outline-none focus:border-white rounded-lg px-2 py-1.5 text-xs text-neutral-300"
                          >
                            <option value="MINUTOS">Minutos</option>
                            <option value="HORAS">Horas</option>
                            <option value="DIAS">Días</option>
                          </select>
                        </div>
                        <div>
                          <select
                            value={newTermRecCanal}
                            onChange={(e) => setNewTermRecCanal(e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-800 focus:outline-none focus:border-white rounded-lg px-2 py-1.5 text-xs text-neutral-300"
                          >
                            <option value="EMAIL">Email</option>
                            <option value="PLATAFORMA">Plataforma</option>
                            <option value="AMBOS">Ambos</option>
                          </select>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddTermRecordatorio}
                        className="w-full py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer text-center"
                      >
                        + Agregar Recordatorio
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t border-neutral-900">
                <button
                  type="button"
                  onClick={() => setShowAddTerminoModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-white hover:bg-neutral-200 text-black font-semibold px-6 py-2.5 rounded-xl transition-all cursor-pointer text-sm flex items-center gap-1.5"
                >
                  <Save size={16} />
                  <span>Programar Plazo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL - GESTIONAR TERMINO */}
      {showGestionarTerminoModal && (() => {
        const isVencido = new Date(selectedTermino?.fecha_vencimiento) < new Date();
        const isAlreadyResolved = selectedTermino?.estado !== 'PENDIENTE';
        const cannotEdit = isAlreadyResolved && !isAdmin;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
            <div className="relative w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-3xl p-8 shadow-2xl animate-scale-in my-8">
              <button
                onClick={() => setShowGestionarTerminoModal(false)}
                className="absolute top-6 right-6 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={24} />
              </button>

              <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent mb-2">
                Resolver Plazo / Término
              </h2>
              <p className="text-sm text-neutral-400 mb-6">
                Registre la resolución del término judicial: <strong className="text-white">{selectedTermino?.nombre}</strong>. Para su validez, debe proporcionar una justificación obligatoria.
              </p>

              {/* Warning Banners */}
              {isVencido && !isAlreadyResolved && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-2xl text-xs flex items-start gap-2 mb-4">
                  <AlertTriangle className="flex-shrink-0 mt-0.5" size={16} />
                  <span>
                    <strong>Atención:</strong> La fecha límite de este término ya ha expirado. Al guardarse, se auto-clasificará de forma inmutable como <strong>CUMPLIDO_TARDÍAMENTE</strong> en el sistema.
                  </span>
                </div>
              )}

              {isAlreadyResolved && !isAdmin && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl text-xs flex items-start gap-2 mb-4">
                  <AlertCircle className="flex-shrink-0 mt-0.5" size={16} />
                  <span>
                    <strong>Acción Denegada:</strong> Este término ya ha sido resuelto como <strong>{selectedTermino?.estado}</strong>. Solo un Administrador puede modificar los términos ya resueltos.
                  </span>
                </div>
              )}

              {isAlreadyResolved && isAdmin && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-2xl text-xs flex items-start gap-2 mb-4">
                  <AlertTriangle className="flex-shrink-0 mt-0.5" size={16} />
                  <span>
                    <strong>Atención Administrador:</strong> Está modificando la resolución de un término ya resuelto. Esta acción registrará una bitácora especial en el historial de auditoría de consultorio.
                  </span>
                </div>
              )}

              <form onSubmit={handleGestionarTerminoSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                      Estado de la Gestión
                    </label>
                    <select
                      disabled={cannotEdit}
                      value={termEstadoGestion}
                      onChange={(e) => setTermEstadoGestion(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-neutral-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="CUMPLIDO">Cumplido en Tiempo</option>
                      <option value="CUMPLIDO_TARDIO">Cumplido Tardíamente</option>
                      <option value="INCUMPLIDO">Incumplido</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                      Justificación procesal (Obligatoria)
                    </label>
                    <textarea
                      required
                      disabled={cannotEdit}
                      rows={4}
                      placeholder="Detalle el memorial radicado, radicado de contestación o justificación del incumplimiento..."
                      value={termJustificacion}
                      onChange={(e) => setTermJustificacion(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t border-neutral-900">
                  <button
                    type="button"
                    onClick={() => setShowGestionarTerminoModal(false)}
                    className="px-5 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer text-sm font-semibold"
                  >
                    {cannotEdit ? 'Cerrar' : 'Cancelar'}
                  </button>
                  {!cannotEdit && (
                    <button
                      type="submit"
                      className="bg-white hover:bg-neutral-200 text-black font-semibold px-6 py-2.5 rounded-xl transition-all cursor-pointer text-sm flex items-center gap-1.5"
                    >
                      <Save size={16} />
                      <span>{isAlreadyResolved ? 'Guardar Cambios (Admin)' : 'Resolver Plazo'}</span>
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* MODAL - CAMBIAR ESTADO */}
      {showChangeEstadoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-3xl p-8 shadow-2xl animate-scale-in my-8">
            <button
              onClick={() => {
                setShowChangeEstadoModal(false);
                setPendingWarnings(null);
              }}
              className="absolute top-6 right-6 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent mb-2">
              Cambiar Estado del Expediente
            </h2>
            <p className="text-sm text-neutral-400 mb-6">
              Las transiciones de estado quedan documentadas en la bitácora del proceso.
            </p>

            <form onSubmit={handleCambiarEstado} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Nuevo Estado
                  </label>
                  <select
                    value={newEstado}
                    onChange={(e) => {
                      setNewEstado(e.target.value);
                      setPendingWarnings(null);
                    }}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-neutral-300"
                  >
                    <option value="ACTIVO">Activo</option>
                    <option value="SUSPENDIDO">Suspendido</option>
                    <option value="ARCHIVADO">Archivado</option>
                    <option value="FINALIZADO">Finalizado</option>
                  </select>
                </div>

                {/* Reactivation warning for non-admins */}
                {(proceso.estado === 'ARCHIVADO' || proceso.estado === 'FINALIZADO') && (newEstado === 'ACTIVO' || newEstado === 'SUSPENDIDO') && !isAdmin && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl flex items-start gap-2 text-xs">
                    <AlertCircle className="flex-shrink-0 mt-0.5" size={16} />
                    <span>
                      <strong>Acción Denegada:</strong> Los expedientes finalizados o archivados solo pueden ser reactivados por un usuario con rol de Administrador.
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Justificación del Cambio (Mínimo 10 caracteres)
                  </label>
                  <textarea
                    required
                    minLength={10}
                    rows={3}
                    placeholder="Detalle los motivos del cambio de estado..."
                    value={estadoJustificacion}
                    onChange={(e) => setEstadoJustificacion(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white resize-none"
                  />
                </div>

                {/* Pending issues warnings from backend */}
                {pendingWarnings && (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-xl space-y-3 text-xs">
                    <div className="flex items-center gap-2 font-bold">
                      <AlertTriangle size={16} />
                      <span>{pendingWarnings.error}</span>
                    </div>
                    {pendingWarnings.terminos?.length > 0 && (
                      <div>
                        <p className="font-semibold underline">Términos Pendientes:</p>
                        <ul className="list-disc list-inside ml-2">
                          {pendingWarnings.terminos.map((t, idx) => <li key={idx}>{t}</li>)}
                        </ul>
                      </div>
                    )}
                    {pendingWarnings.audiencias?.length > 0 && (
                      <div>
                        <p className="font-semibold underline">Audiencias Programadas (30 días):</p>
                        <ul className="list-disc list-inside ml-2">
                          {pendingWarnings.audiencias.map((a, idx) => <li key={idx}>{a}</li>)}
                        </ul>
                      </div>
                    )}

                    {isAdmin ? (
                      <div className="pt-2 border-t border-amber-500/20 mt-2">
                        <label className="flex items-center gap-2 cursor-pointer font-bold">
                          <input
                            type="checkbox"
                            checked={forceArchivado}
                            onChange={(e) => setForceArchivado(e.target.checked)}
                            className="rounded border-amber-500/30 text-amber-500 focus:ring-0 bg-neutral-900"
                          />
                          <span>Forzar Archivado del expediente (Acción de Administrador)</span>
                        </label>
                      </div>
                    ) : (
                      <p className="text-[10px] text-neutral-400 italic pt-1 border-t border-amber-500/10">
                        * Solo un Administrador puede forzar el archivado con pendientes en el sistema.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t border-neutral-900">
                <button
                  type="button"
                  onClick={() => {
                    setShowChangeEstadoModal(false);
                    setPendingWarnings(null);
                  }}
                  className="px-5 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={(proceso.estado === 'ARCHIVADO' || proceso.estado === 'FINALIZADO') && (newEstado === 'ACTIVO' || newEstado === 'SUSPENDIDO') && !isAdmin}
                  className="bg-white hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-500 text-black font-semibold px-6 py-2.5 rounded-xl transition-all cursor-pointer text-sm flex items-center gap-1.5"
                >
                  <Save size={16} />
                  <span>Cambiar Estado</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL - ASIGNAR COLABORADOR */}
      {showAddColaboradorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-3xl p-8 shadow-2xl animate-scale-in my-8">
            <button
              onClick={() => setShowAddColaboradorModal(false)}
              className="absolute top-6 right-6 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent mb-2">
              Asignar Colaborador al Caso
            </h2>
            <p className="text-sm text-neutral-400 mb-6">
              Agregue co-defensores o asistentes al equipo de trabajo para este expediente.
            </p>

            {loadingUsuarios ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-neutral-500" />
              </div>
            ) : availableUsuarios.length === 0 ? (
              <div className="text-center py-8 space-y-4">
                <p className="text-sm text-neutral-400">No hay más abogados o asistentes disponibles en el consultorio.</p>
                <button
                  type="button"
                  onClick={() => setShowAddColaboradorModal(false)}
                  className="px-6 py-2 bg-neutral-900 border border-neutral-800 text-white rounded-xl cursor-pointer text-xs font-bold"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleAsignarColaborador} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                      Seleccionar Abogado / Asistente
                    </label>
                    <select
                      value={colaboradorId}
                      onChange={(e) => setColaboradorId(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-neutral-300"
                    >
                      {availableUsuarios.map((u) => (
                        <option key={u.id_usuario} value={u.id_usuario}>
                          {u.nombre} ({u.rol})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                      Rol en el Proceso
                    </label>
                    <select
                      value={colaboradorRol}
                      onChange={(e) => setColaboradorRol(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-neutral-300"
                    >
                      <option value="ABOGADO">Co-defensor (Abogado)</option>
                      <option value="ASISTENTE">Asistente Judicial</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t border-neutral-900">
                  <button
                    type="button"
                    onClick={() => setShowAddColaboradorModal(false)}
                    className="px-5 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer text-sm font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-white hover:bg-neutral-200 text-black font-semibold px-6 py-2.5 rounded-xl transition-all cursor-pointer text-sm flex items-center gap-1.5"
                  >
                    <UserPlus size={16} />
                    <span>Asignar Miembro</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL - REGISTRAR PARTE PROCESAL */}
      {showAddParteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-3xl p-8 shadow-2xl animate-scale-in my-8">
            <button
              onClick={() => setShowAddParteModal(false)}
              className="absolute top-6 right-6 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent mb-2">
              Registrar Parte Procesal
            </h2>
            <p className="text-sm text-neutral-400 mb-6">
              Añada partes involucradas en el expediente judicial (demandantes, demandados, víctimas, etc.).
            </p>

            <form onSubmit={handleRegistrarParte} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Nombre Completo / Razón Social
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Inversiones del Norte S.A.S."
                    value={parteNombre}
                    onChange={(e) => setParteNombre(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Tipo de Parte
                  </label>
                  <select
                    value={parteTipo}
                    onChange={(e) => setParteTipo(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-neutral-300"
                  >
                    <option value="DEMANDANTE">Demandante</option>
                    <option value="DEMANDADO">Demandado</option>
                    <option value="VICTIMA">Víctima</option>
                    <option value="TERCEROS">Tercero Interviniente</option>
                    <option value="CLIENTE">Cliente</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t border-neutral-900">
                <button
                  type="button"
                  onClick={() => setShowAddParteModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-white hover:bg-neutral-200 text-black font-semibold px-6 py-2.5 rounded-xl transition-all cursor-pointer text-sm flex items-center gap-1.5"
                >
                  <Save size={16} />
                  <span>Registrar Parte</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL - DOCUMENT STATE */}
      {showDocEstadoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-3xl p-8 shadow-2xl animate-scale-in my-8">
            <button
              onClick={() => setShowDocEstadoModal(false)}
              className="absolute top-6 right-6 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent mb-2">
              Cambiar Estado del Documento
            </h2>
            <p className="text-sm text-neutral-400 mb-6">
              Transicione el estado del documento legal a Inactivo o Reemplazado. Tenga en cuenta que no podrá reactivarlo a Activo una vez realizado este cambio.
            </p>

            <form onSubmit={handleUpdateDocEstado} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Nuevo Estado
                  </label>
                  <select
                    value={docEstadoNuevo}
                    onChange={(e) => setDocEstadoNuevo(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-neutral-300"
                  >
                    <option value="INACTIVO">Inactivo</option>
                    <option value="REEMPLAZADO">Reemplazado</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t border-neutral-900">
                <button
                  type="button"
                  onClick={() => setShowDocEstadoModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-white hover:bg-neutral-200 text-black font-semibold px-6 py-2.5 rounded-xl transition-all cursor-pointer text-sm flex items-center gap-1.5"
                >
                  <Save size={16} />
                  <span>Actualizar Estado</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL - DELETE DEFINITIVO (ADMIN ONLY) */}
      {showDeleteDefinitivoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-3xl p-8 shadow-2xl animate-scale-in my-8">
            <button
              onClick={() => {
                setShowDeleteDefinitivoModal(false);
                setDeleteConfirmText('');
                setDeleteConfirmCheckbox(false);
              }}
              className="absolute top-6 right-6 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl font-bold text-rose-500 mb-2">
              Eliminar Documento Definitivamente
            </h2>
            <p className="text-sm text-neutral-400 mb-6">
              Esta es una acción irreversible y crítica. Eliminará físicamente todas las versiones de <strong className="text-white">{selectedDoc?.nombre}</strong> de Supabase Storage y de la base de datos.
            </p>

            <form onSubmit={handleDeleteDefinitivoSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Justificación Escrita Obligatoria
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Escriba la razón de la eliminación para la auditoría..."
                    value={deleteJustificacion}
                    onChange={(e) => setDeleteJustificacion(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block">
                    Confirmación de Seguridad (Paso 1)
                  </label>
                  <p className="text-xs text-neutral-500 mb-1">Escriba <strong className="text-neutral-400">ELIMINAR</strong> para confirmar:</p>
                  <input
                    type="text"
                    required
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="ELIMINAR"
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-rose-500 focus:outline-none rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-400">
                    <input
                      type="checkbox"
                      checked={deleteConfirmCheckbox}
                      onChange={(e) => setDeleteConfirmCheckbox(e.target.checked)}
                      className="rounded border-neutral-800 text-white focus:ring-0"
                    />
                    <span>Comprendo que esta acción borrará permanentemente todo el historial del archivo. (Paso 2)</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t border-neutral-900">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteDefinitivoModal(false);
                    setDeleteConfirmText('');
                    setDeleteConfirmCheckbox(false);
                  }}
                  className="px-5 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={deleteConfirmText !== 'ELIMINAR' || !deleteConfirmCheckbox}
                  className="bg-rose-600 hover:bg-rose-500 disabled:bg-neutral-900 disabled:text-neutral-600 text-white font-semibold px-6 py-2.5 rounded-xl transition-all cursor-pointer text-sm flex items-center gap-1.5"
                >
                  <Trash2 size={16} />
                  <span>Eliminar Definitivamente</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL - REPROGRAM AUDIENCIA */}
      {showReprogramModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-neutral-950 border border-neutral-800 rounded-3xl p-8 shadow-2xl animate-scale-in my-8">
            <button
              onClick={() => setShowReprogramModal(false)}
              className="absolute top-6 right-6 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent mb-2">
              Reprogramar Audiencia Judicial
            </h2>
            <p className="text-sm text-neutral-400 mb-6">
              Actualice los datos de la audiencia. Se recalcularán los recordatorios y se notificará a los colaboradores asignados.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Form Side */}
              <form onSubmit={handleReprogramSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Descripción / Nombre
                  </label>
                  <input
                    type="text"
                    required
                    value={reprogramNombre}
                    onChange={(e) => setReprogramNombre(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Tipo de Audiencia
                  </label>
                  <input
                    type="text"
                    required
                    value={reprogramTipo}
                    onChange={(e) => setReprogramTipo(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Nueva Fecha y Hora
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={reprogramFechaHora}
                    onChange={(e) => setReprogramFechaHora(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-neutral-300"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Nuevo Lugar / Enlace
                  </label>
                  <input
                    type="text"
                    required
                    value={reprogramLugar}
                    onChange={(e) => setReprogramLugar(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-neutral-900">
                  <button
                    type="button"
                    onClick={() => setShowReprogramModal(false)}
                    className="px-4 py-2 rounded-xl border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-white hover:bg-neutral-200 text-black font-semibold px-5 py-2 rounded-xl transition-all cursor-pointer text-xs flex items-center gap-1.5"
                  >
                    <Save size={14} />
                    <span>Guardar Cambios</span>
                  </button>
                </div>
              </form>

              {/* Reprogram History Side */}
              <div className="bg-neutral-900/20 border border-neutral-800 rounded-2xl p-6 space-y-4 max-h-[400px] overflow-y-auto">
                <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                  <History size={14} />
                  <span>Historial de Reprogramaciones</span>
                </h3>

                {(() => {
                  const reprogEntries = proceso.historial?.filter(
                    (hist) => hist.campo_modificado === 'AUDIENCIA_REPROGRAMADA'
                  ) || [];

                  if (reprogEntries.length === 0) {
                    return (
                      <p className="text-xs text-neutral-500 italic py-8 text-center">
                        No hay reprogramaciones previas registradas para este expediente.
                      </p>
                    );
                  }

                  return (
                    <div className="relative border-l border-neutral-800 pl-4 ml-2 space-y-6 text-xs">
                      {reprogEntries.map((hist) => (
                        <div key={hist.id_historial} className="relative group">
                          <div className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-neutral-700 group-hover:bg-white transition-colors" />
                          <div className="space-y-1">
                            <span className="text-[10px] text-neutral-500 font-bold block">
                              {new Date(hist.created_at).toLocaleString()}
                            </span>
                            <p className="text-white font-semibold">
                              Por: {hist.usuario?.nombre || 'Usuario'}
                            </p>
                            <p className="text-neutral-400 whitespace-pre-line leading-relaxed">
                              {hist.descripcion || 'Se modificó la fecha/hora o lugar de una audiencia.'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
