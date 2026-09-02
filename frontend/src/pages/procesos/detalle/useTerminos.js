import { useState } from 'react';
import { toast } from 'sonner';
import api from '../../../api/axios';

const MINUTOS_POR_HORA = 60;
const MINUTOS_POR_DIA = 1440;

/**
 * Términos judiciales del expediente: registro, recordatorios y gestión.
 *
 * El término puede nacer de una actuación procesal (`termIdActuacion`), que es
 * lo que cierra la cadena actuación → término → alerta de vencimiento (HU-37).
 */
export function useTerminos(idProceso) {
  const [terminos, setTerminos] = useState([]);
  const [loadingTerminos, setLoadingTerminos] = useState(false);
  const [showAddTerminoModal, setShowAddTerminoModal] = useState(false);
  const [termIdActuacion, setTermIdActuacion] = useState('');
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

  const fetchTerminos = async () => {
    try {
      setLoadingTerminos(true);
      const res = await api.get(`/terminos/proceso/${idProceso}`);
      setTerminos(res.data);
    } catch (error) {
      console.error(error);
      toast.error('Error al obtener términos procesales');
    } finally {
      setLoadingTerminos(false);
    }
  };

  const handleAddTerminoSubmit = async (e) => {
    e.preventDefault();
    try {
      // La lista se guarda como "minutos antes"; el backend espera la fecha y
      // hora exacta de cada envío, así que se resta del vencimiento.
      const recordatoriosListFormatted = termRecordatoriosList.map((r) => {
        const vDate = new Date(termFechaVencimiento);
        const sendDate = new Date(vDate.getTime() - r.minutos_antes * 60 * 1000);
        return {
          fecha_hora_envio: sendDate.toISOString(),
          canal: r.canal,
        };
      });

      const data = {
        id_proceso: idProceso,
        nombre: termNombre,
        fecha_vencimiento: termFechaVencimiento,
        es_critico: termEsCritico,
        recordatorios: recordatoriosListFormatted,
        ...(termIdActuacion && { id_actuacion: termIdActuacion }),
      };

      const res = await api.post('/terminos', data);
      toast.success(res.data.message || 'Término judicial registrado');
      setShowAddTerminoModal(false);
      setTermNombre('');
      setTermFechaVencimiento('');
      setTermEsCritico(false);
      setTermIdActuacion('');
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
    if (newTermRecUnidad === 'HORAS') mins = val * MINUTOS_POR_HORA;
    if (newTermRecUnidad === 'DIAS') mins = val * MINUTOS_POR_DIA;

    setTermRecordatoriosList([...termRecordatoriosList, {
      minutos_antes: mins,
      canal: newTermRecCanal,
    }]);
  };

  const handleGestionarTerminoSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        estado: termEstadoGestion,
        justificacion: termJustificacion,
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

  return {
    terminos,
    loadingTerminos,
    showAddTerminoModal,
    setShowAddTerminoModal,
    termIdActuacion,
    setTermIdActuacion,
    showGestionarTerminoModal,
    setShowGestionarTerminoModal,
    selectedTermino,
    setSelectedTermino,
    termNombre,
    setTermNombre,
    termFechaVencimiento,
    setTermFechaVencimiento,
    termEsCritico,
    setTermEsCritico,
    termEstadoGestion,
    setTermEstadoGestion,
    termJustificacion,
    setTermJustificacion,
    termRecordatoriosList,
    setTermRecordatoriosList,
    newTermRecValor,
    setNewTermRecValor,
    newTermRecUnidad,
    setNewTermRecUnidad,
    newTermRecCanal,
    setNewTermRecCanal,
    fetchTerminos,
    handleAddTerminoSubmit,
    handleAddTermRecordatorio,
    handleGestionarTerminoSubmit,
  };
}
