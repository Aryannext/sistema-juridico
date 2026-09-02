import { useState } from 'react';
import { toast } from 'sonner';
import api from '../../../api/axios';

/**
 * Estado del expediente, equipo de trabajo y partes procesales.
 *
 * Los tres van juntos porque comparten una característica: cualquier cambio
 * obliga a recargar el expediente entero, ya que todos escriben en su historial.
 *
 * @param {string} idProceso
 * @param {object|null} proceso  El expediente cargado; hace falta para saber
 *                               qué usuarios están ya asignados.
 * @param {Function} alCambiar   Recarga del expediente.
 */
export function useEquipoYPartes(idProceso, proceso, alCambiar) {
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

  const handleCambiarEstado = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/procesos/${idProceso}/estado`, {
        estado: newEstado,
        justificacion: estadoJustificacion,
        force: forceArchivado,
      });
      toast.success(res.data.message || 'Estado actualizado exitosamente');
      setShowChangeEstadoModal(false);
      setEstadoJustificacion('');
      setPendingWarnings(null);
      setForceArchivado(false);
      alCambiar?.();
    } catch (error) {
      console.error(error);
      // El backend responde 400 con `hasPending` cuando el archivado choca con
      // términos pendientes o audiencias próximas (RN03). No es un error a
      // secas: trae la lista que hay que enseñar antes de permitir forzarlo.
      if (error.response?.status === 400 && error.response?.data?.hasPending) {
        setPendingWarnings(error.response.data);
        toast.error('No se puede archivar: Existen audiencias o términos pendientes');
      } else {
        toast.error(error.response?.data?.error || 'Error al cambiar el estado del proceso');
      }
    }
  };

  /** Usuarios del consultorio que aún no están asignados al expediente. */
  const fetchUsuariosDisponibles = async () => {
    const sinAsignar = (lista) => {
      const asignados = new Set([
        proceso.id_abogado_resp,
        ...(proceso.abogados?.map((a) => a.id_usuario) || []),
      ]);
      return lista.filter((u) => !asignados.has(u.id_usuario));
    };

    try {
      setLoadingUsuarios(true);
      const res = await api.get('/admin/usuarios').catch(() => null);

      if (res && res.data) {
        const disponibles = sinAsignar(res.data);
        setAvailableUsuarios(disponibles);
        if (disponibles.length > 0) setColaboradorId(disponibles[0].id_usuario);
        return;
      }

      // Sin permiso para listar el consultorio entero (no es administrador),
      // al menos puede asignarse a sí mismo.
      const usuarioActual = JSON.parse(localStorage.getItem('user') || '{}');
      if (!usuarioActual.id_usuario) return;

      const disponibles = sinAsignar([usuarioActual]);
      setAvailableUsuarios(disponibles);
      if (disponibles.length > 0) setColaboradorId(usuarioActual.id_usuario);
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
      const res = await api.post(`/procesos/${idProceso}/abogados`, {
        id_usuario: colaboradorId,
        rol_en_proceso: colaboradorRol,
      });
      toast.success(res.data.message || 'Colaborador asignado al expediente');
      setShowAddColaboradorModal(false);
      alCambiar?.();
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
      const res = await api.delete(`/procesos/${idProceso}/abogados/${idUsuario}`);
      toast.success(res.data.message || 'Colaborador desvinculado con éxito');
      alCambiar?.();
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
      const res = await api.post(`/procesos/${idProceso}/partes`, {
        nombre: parteNombre,
        tipo: parteTipo,
      });
      toast.success(res.data.message || 'Parte procesal registrada con éxito');
      setShowAddParteModal(false);
      setParteNombre('');
      alCambiar?.();
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
      const res = await api.delete(`/procesos/${idProceso}/partes/${idParte}`);
      toast.success(res.data.message || 'Parte procesal eliminada con éxito');
      alCambiar?.();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al eliminar la parte procesal');
    }
  };

  return {
    showChangeEstadoModal,
    setShowChangeEstadoModal,
    newEstado,
    setNewEstado,
    estadoJustificacion,
    setEstadoJustificacion,
    forceArchivado,
    setForceArchivado,
    pendingWarnings,
    setPendingWarnings,
    showAddColaboradorModal,
    setShowAddColaboradorModal,
    colaboradorId,
    setColaboradorId,
    colaboradorRol,
    setColaboradorRol,
    availableUsuarios,
    loadingUsuarios,
    showAddParteModal,
    setShowAddParteModal,
    parteNombre,
    setParteNombre,
    parteTipo,
    setParteTipo,
    handleCambiarEstado,
    fetchUsuariosDisponibles,
    handleAsignarColaborador,
    handleRemoverColaborador,
    handleRegistrarParte,
    handleEliminarParte,
  };
}
