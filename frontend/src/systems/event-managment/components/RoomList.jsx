import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import RoomsHeader from '././sub-components/RoomsHeader';
import RoomsTable from '././sub-components/RoomsTable';
import RoomsPagination from '././sub-components/RoomsPagination';
import RoomFormModal from '././sub-components/RoomFormModal';
import RoomQrCodeModal from '../ui-components/RoomQrCodeModal';
import Notification from '././sub-components/Notification';
import SpiralLoader from './SpiralLoader';

const BASE_URL = '/cok/api/v1';

export default function RoomsList() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('new');
  const [saving, setSaving] = useState(false);

  // Modal state
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [formData, setFormData] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // QR Code Modal state
  const [qrCodeRoom, setQrCodeRoom] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);

  // Notification state
  const [notification, setNotification] = useState(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchRooms = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 10, sort: sortBy };
      if (searchTerm) {
        params.search = searchTerm;
        params.searchField = 'roomName';
      }
      if (statusFilter === 'activeOnly') params.isActive = 'true';
      else if (statusFilter === 'inactiveOnly') params.isActive = 'false';

      const response = await axios.get(`${BASE_URL}/rooms`, { params });
      const data = response.data;
      setRooms(data.data || []);
      setCurrentPage(data.currentPage || 1);
      setTotalPages(data.totalPages || 1);
      setTotalRecords(data.totalRecords || 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch rooms');
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, sortBy]);

  useEffect(() => {
    fetchRooms(currentPage);
  }, [currentPage, fetchRooms]);

  const handleSaveField = async (roomId, field, value) => {
    setSaving(true);
    try {
      const updateData = {};
      if (field === 'roomCapacity') updateData[field] = parseInt(value) || 0;
      else if (field === 'isActive') updateData[field] = value === 'true' || value === true;
      else updateData[field] = value;

      await axios.put(`${BASE_URL}/rooms/${roomId}`, updateData);
      showNotification('Room updated successfully');
      fetchRooms(currentPage);
      return true;
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to update', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openCreateModal = () => {
    setFormMode('create');
    setFormData({ roomName: '', roomDescription: '', roomCapacity: '', roomLocation: '', isActive: true });
    setShowFormModal(true);
  };

  const openEditModal = async (roomId) => {
    try {
      const response = await axios.get(`${BASE_URL}/rooms/${roomId}`);
      const room = response.data.data;
      setFormMode('edit');
      setFormData({
        _id: room._id,
        roomName: room.roomName || '',
        roomDescription: room.roomDescription || '',
        roomCapacity: room.roomCapacity || '',
        roomLocation: room.roomLocation || '',
        isActive: room.isActive !== undefined ? room.isActive : true
      });
      setShowFormModal(true);
    } catch (err) {
      showNotification('Failed to load room details', 'error');
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      const data = {
        roomName: formData.roomName,
        roomDescription: formData.roomDescription,
        roomCapacity: parseInt(formData.roomCapacity),
        roomLocation: formData.roomLocation,
        isActive: formData.isActive
      };

      if (formMode === 'create') {
        await axios.post(`${BASE_URL}/rooms`, data);
        showNotification('Room created successfully');
      } else {
        await axios.put(`${BASE_URL}/rooms/${formData._id}`, data);
        showNotification('Room updated successfully');
      }
      setShowFormModal(false);
      fetchRooms(currentPage);
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to save room', 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (roomId) => {
    if (!window.confirm('Delete this room? This action cannot be undone.')) return;
    try {
      await axios.delete(`${BASE_URL}/rooms/${roomId}`);
      showNotification('Room deleted successfully');
      fetchRooms(currentPage);
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to delete room', 'error');
    }
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="bg-red-50 border-2 border-red-200 p-6 text-center">
          <p className="text-red-700 text-sm font-medium mb-3">{error}</p>
          <button onClick={() => fetchRooms(currentPage)} className="px-4 py-2 bg-red-600 text-white text-sm font-bold hover:bg-red-700">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Notification notification={notification} />
      
      <RoomsHeader
        searchTerm={searchTerm}
        statusFilter={statusFilter}
        sortBy={sortBy}
        onSearchChange={(val) => { setSearchTerm(val); setCurrentPage(1); }}
        onStatusChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}
        onSortChange={(val) => { setSortBy(val); setCurrentPage(1); }}
        onCreateClick={openCreateModal}
      />

      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <SpiralLoader />
            </div>
          </div>
        ) : (
          <RoomsTable
            rooms={rooms}
            saving={saving}
            onSaveField={handleSaveField}
            onEditClick={openEditModal}
            onDeleteClick={handleDelete}
            onQrCodeClick={(room) => { setQrCodeRoom(room); setShowQrModal(true); }}
          />
        )}
      </div>

      <RoomsPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalRecords={totalRecords}
        onPageChange={handlePageChange}
      />

      {showFormModal && (
        <RoomFormModal
          mode={formMode}
          formData={formData}
          submitting={formSubmitting}
          onChange={setFormData}
          onSubmit={handleFormSubmit}
          onClose={() => setShowFormModal(false)}
        />
      )}

      {showQrModal && qrCodeRoom && (
        <RoomQrCodeModal
          isOpen={showQrModal}
          onClose={() => { setShowQrModal(false); setQrCodeRoom(null); }}
          room={qrCodeRoom}
        />
      )}
    </div>
  );
}