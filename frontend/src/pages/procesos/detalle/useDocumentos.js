import { useState } from 'react';
import { toast } from 'sonner';
import api from '../../../api/axios';

/**
 * Documentos del expediente: carga, versiones, estado y borrado.
 *
 * Conviven dos borrados distintos y conviene no confundirlos:
 *   - `handleDeleteDoc` es lógico: marca el documento y lo saca de la vista.
 *   - `handleDeleteDefinitivoSubmit` es físico, exige justificación y borra
 *     también el archivo del almacenamiento.
 */
export function useDocumentos(idProceso) {
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

  // Formulario de carga
  const [docNombre, setDocNombre] = useState('');
  const [docCategoria, setDocCategoria] = useState('DEMANDA');
  const [docVisibilidad, setDocVisibilidad] = useState('PRIVADO');
  const [docFile, setDocFile] = useState(null);

  const fetchDocuments = async () => {
    try {
      setLoadingDocs(true);
      const res = await api.get(`/documentos/proceso/${idProceso}`);
      setDocumentos(res.data);
    } catch (error) {
      console.error(error);
      toast.error('Error al obtener documentos del expediente');
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleDocUploadSubmit = async (e) => {
    e.preventDefault();
    if (!docFile) {
      toast.error('Por favor seleccione un archivo para cargar');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('archivo', docFile);
      formData.append('id_proceso', idProceso);
      formData.append('nombre', docNombre || docFile.name);
      formData.append('categoria', docCategoria);
      formData.append('visibilidad', docVisibilidad);

      const res = await api.post('/documentos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
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
        headers: { 'Content-Type': 'multipart/form-data' },
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
        data: { justificacion: deleteJustificacion },
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

  return {
    documentos,
    loadingDocs,
    showUploadDocModal,
    setShowUploadDocModal,
    showNewVersionModal,
    setShowNewVersionModal,
    selectedDoc,
    setSelectedDoc,
    showVersionesModal,
    setShowVersionesModal,
    docVersiones,
    loadingVersiones,
    showDocEstadoModal,
    setShowDocEstadoModal,
    docEstadoNuevo,
    setDocEstadoNuevo,
    showDeleteDefinitivoModal,
    setShowDeleteDefinitivoModal,
    deleteJustificacion,
    setDeleteJustificacion,
    deleteConfirmText,
    setDeleteConfirmText,
    deleteConfirmCheckbox,
    setDeleteConfirmCheckbox,
    docNombre,
    setDocNombre,
    docCategoria,
    setDocCategoria,
    docVisibilidad,
    setDocVisibilidad,
    docFile,
    setDocFile,
    fetchDocuments,
    handleDocUploadSubmit,
    handleNewVersionSubmit,
    handleDownloadDoc,
    handleViewHistory,
    handleDeleteDoc,
    handleUpdateDocEstado,
    handleDeleteDefinitivoSubmit,
  };
}
