import { useState } from 'react';
import { toast } from 'sonner';
import api from '../../../api/axios';

/** Recordatorio por defecto de una audiencia: 24 horas antes, por correo. */
const RECORDATORIO_POR_DEFECTO = [{ minutos_antes: 1440, canal: 'EMAIL' }];

/**
 * Agenda de audiencias del expediente: programar, reprogramar y marcar estado.
 *
 * @param {string} idProceso
 * @param {Function} alCambiar  Se invoca al reprogramar, para que el
 *                              expediente recargue su historial.
 */
export function useAudiencias(idProceso, alCambiar) {
  const [audiencias, setAudiencias] = useState([]);
  const [loadingAudiencias, setLoadingAudiencias] = useState(false);
  const [showAddAudienciaModal, setShowAddAudienciaModal] = useState(false);
  const [audNombre, setAudNombre] = useState('');
  const [audTipo, setAudTipo] = useState('');
  const [audFechaHora, setAudFechaHora] = useState('');
  const [audLugar, setAudLugar] = useState('');
  const [customRecordatorios, setCustomRecordatorios] = useState(RECORDATORIO_POR_DEFECTO);
  const [showReprogramModal, setShowReprogramModal] = useState(false);
  const [selectedAudiencia, setSelectedAudiencia] = useState(null);
  const [reprogramFechaHora, setReprogramFechaHora] = useState('');
  const [reprogramLugar, setReprogramLugar] = useState('');
  const [reprogramNombre, setReprogramNombre] = useState('');
  const [reprogramTipo, setReprogramTipo] = useState('');

  const fetchAudiencias = async () => {
    try {
      setLoadingAudiencias(true);
      const res = await api.get(`/audiencias/proceso/${idProceso}`);
      setAudiencias(res.data);
    } catch (error) {
      console.error(error);
      toast.error('Error al obtener la agenda de audiencias');
    } finally {
      setLoadingAudiencias(false);
    }
  };

  const handleAddAudienciaSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        id_proceso: idProceso,
        nombre: audNombre,
        tipo: audTipo,
        fecha_hora: audFechaHora,
        lugar: audLugar,
        recordatorios: customRecordatorios.map((r) => ({
          minutos_antes: parseInt(r.minutos_antes),
          canal: r.canal,
        })),
      };

      const res = await api.post('/audiencias', data);
      toast.success(res.data.message || 'Audiencia judicial programada');
      setShowAddAudienciaModal(false);
      setAudNombre('');
      setAudTipo('');
      setAudFechaHora('');
      setAudLugar('');
      setCustomRecordatorios(RECORDATORIO_POR_DEFECTO);
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
        lugar: reprogramLugar,
      };

      const res = await api.put(`/audiencias/${selectedAudiencia.id_audiencia}`, data);
      toast.success(res.data.message || 'Audiencia reprogramada con éxito');
      setShowReprogramModal(false);
      fetchAudiencias();
      alCambiar?.(); // Recargar historial de bitácora
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

  return {
    audiencias,
    loadingAudiencias,
    showAddAudienciaModal,
    setShowAddAudienciaModal,
    audNombre,
    setAudNombre,
    audTipo,
    setAudTipo,
    audFechaHora,
    setAudFechaHora,
    audLugar,
    setAudLugar,
    customRecordatorios,
    setCustomRecordatorios,
    showReprogramModal,
    setShowReprogramModal,
    selectedAudiencia,
    setSelectedAudiencia,
    reprogramFechaHora,
    setReprogramFechaHora,
    reprogramLugar,
    setReprogramLugar,
    reprogramNombre,
    setReprogramNombre,
    reprogramTipo,
    setReprogramTipo,
    fetchAudiencias,
    handleAddAudienciaSubmit,
    handleReprogramSubmit,
    handleMarkAudienciaEstado,
  };
}
