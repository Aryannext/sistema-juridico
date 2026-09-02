import { useState } from 'react';
import { toast } from 'sonner';
import api from '../../../api/axios';

/**
 * Actuaciones procesales del expediente (HU-37).
 *
 * Se lleva su estado y sus llamadas a la API fuera del componente de detalle.
 * Devuelve los mismos nombres que tenían allí, para que el JSX no cambie.
 *
 * @param {string} idProceso
 * @param {Function} alCambiar  Se invoca tras crear, editar o eliminar, para
 *                              que el expediente recargue su historial.
 */
export function useActuaciones(idProceso, alCambiar) {
  const [actuaciones, setActuaciones] = useState([]);
  const [loadingActuaciones, setLoadingActuaciones] = useState(false);
  const [showAddActuacionModal, setShowAddActuacionModal] = useState(false);
  const [newActFecha, setNewActFecha] = useState('');
  const [newActTipo, setNewActTipo] = useState('AUTO');
  const [newActAnotacion, setNewActAnotacion] = useState('');
  const [savingActuacion, setSavingActuacion] = useState(false);
  // null = se está creando; un objeto = se está corrigiendo esa actuación
  const [editingActuacion, setEditingActuacion] = useState(null);

  const fetchActuaciones = async () => {
    try {
      setLoadingActuaciones(true);
      const res = await api.get(`/actuaciones/proceso/${idProceso}`);
      setActuaciones(res.data);
    } catch (error) {
      console.error(error);
      toast.error('Error al obtener las actuaciones del expediente');
    } finally {
      setLoadingActuaciones(false);
    }
  };

  const cerrarModalActuacion = () => {
    setShowAddActuacionModal(false);
    setEditingActuacion(null);
    setNewActFecha('');
    setNewActTipo('AUTO');
    setNewActAnotacion('');
  };

  /** Abre el modal precargado con los datos de la actuación a corregir. */
  const abrirEdicionActuacion = (a) => {
    setEditingActuacion(a);
    // fecha_actuacion es una columna @db.Date: se corta el ISO para no
    // desplazar el día al pasarlo al input type="date" (ver hallazgo H-27)
    setNewActFecha(new Date(a.fecha_actuacion).toISOString().slice(0, 10));
    setNewActTipo(a.tipo);
    setNewActAnotacion(a.anotacion);
    setShowAddActuacionModal(true);
  };

  const handleAddActuacion = async (e) => {
    e.preventDefault();
    try {
      setSavingActuacion(true);
      const payload = {
        fecha_actuacion: newActFecha,
        tipo: newActTipo,
        anotacion: newActAnotacion,
      };

      const res = editingActuacion
        ? await api.put(`/actuaciones/${editingActuacion.id_actuacion}`, payload)
        : await api.post('/actuaciones', { id_proceso: idProceso, ...payload });

      toast.success(res.data.message || 'Actuación registrada');
      cerrarModalActuacion();
      fetchActuaciones();
      alCambiar?.();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al guardar la actuación');
    } finally {
      setSavingActuacion(false);
    }
  };

  const handleEliminarActuacion = async (a) => {
    if (!window.confirm(
      `¿Eliminar la actuación "${a.tipo}: ${a.anotacion.slice(0, 60)}"?\n\n` +
      'Esta acción quedará registrada en el historial del expediente.'
    )) {
      return;
    }
    try {
      const res = await api.delete(`/actuaciones/${a.id_actuacion}`);
      toast.success(res.data.message || 'Actuación eliminada');
      fetchActuaciones();
      alCambiar?.();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Error al eliminar la actuación');
    }
  };

  return {
    actuaciones,
    loadingActuaciones,
    showAddActuacionModal,
    setShowAddActuacionModal,
    newActFecha,
    setNewActFecha,
    newActTipo,
    setNewActTipo,
    newActAnotacion,
    setNewActAnotacion,
    savingActuacion,
    editingActuacion,
    fetchActuaciones,
    cerrarModalActuacion,
    abrirEdicionActuacion,
    handleAddActuacion,
    handleEliminarActuacion,
  };
}
