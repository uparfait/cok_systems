import React, { useRef } from 'react';
import { FiUser, FiTruck, FiClock, FiPhone, FiCheck, FiDownload, FiUpload, FiX, FiMapPin, FiBriefcase, FiFileText } from 'react-icons/fi';

interface ReservationFormData { plate_number: string; driver_name: string; id_type: string; id_number: string; telephone_number: string; slot_number: string; arrival_time?: string; }
interface StaffBookingData { staff_name: string; phone: string; plate_number: string; department_name?: string; owner_title?: string; id_type?: string; identification?: string; }

interface VisitorFormProps {
  formData: ReservationFormData; loading: boolean; onChange: (d: ReservationFormData) => void; onSubmit: (e: React.FormEvent) => void; onDownloadTemplate: () => void;
  bulkFile: File | null; onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void; onFileRemove: () => void; onBulkUpload: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export const VisitorReservationForm: React.FC<VisitorFormProps> = ({ formData, loading, onChange, onSubmit, onDownloadTemplate, bulkFile, onFileSelect, onFileRemove, onBulkUpload, fileInputRef }) => (
  <div className="bg-white border border-gray-200 overflow-hidden">
    <div className="px-4 py-3 border-b bg-gradient-to-r from-blue-50/50 to-white">
      <div className="flex items-center gap-2"><div className="p-1.5 bg-blue-100"><FiUser className="w-4 h-4 text-blue-600" /></div><h2 className="text-sm font-semibold text-gray-900">Visitor Reservations</h2></div>
    </div>
    <div className="p-4">
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1 block">Full Name <span className="text-red-500">*</span></label>
            <div className="relative"><FiUser className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" /><input type="text" name="driver_name" value={formData.driver_name} onChange={e => onChange({ ...formData, driver_name: e.target.value })} required placeholder="Enter full name" className="w-full pl-8 pr-2.5 py-1.5 text-sm border border-gray-200" /></div></div>
          <div><label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1 block">Plate Number <span className="text-red-500">*</span></label>
            <div className="relative"><FiTruck className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" /><input type="text" name="plate_number" value={formData.plate_number} onChange={e => onChange({ ...formData, plate_number: e.target.value })} required placeholder="e.g., RAD 302H" className="w-full pl-8 pr-2.5 py-1.5 text-sm border border-gray-200" /></div></div>
          <div><label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1 block">Arrival Time</label>
            <div className="relative"><FiClock className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" /><input type="datetime-local" name="arrival_time" value={formData.arrival_time} onChange={e => onChange({ ...formData, arrival_time: e.target.value })} className="w-full pl-8 pr-2.5 py-1.5 text-sm border border-gray-200" /></div></div>
          <div><label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1 block">Phone Number</label>
            <div className="relative"><FiPhone className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" /><input type="tel" name="telephone_number" value={formData.telephone_number} onChange={e => onChange({ ...formData, telephone_number: e.target.value })} placeholder="+250 791 783 308" className="w-full pl-8 pr-2.5 py-1.5 text-sm border border-gray-200" /></div></div>
          <div><label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1 block">ID Type</label><select name="id_type" value={formData.id_type} onChange={e => onChange({ ...formData, id_type: e.target.value })} className="w-full px-2.5 py-1.5 text-sm border border-gray-200"><option value="NID">National ID</option><option value="Passport">Passport</option><option value="Driving Permit">Driving Permit</option></select></div>
          <div><label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1 block">ID Number</label><input type="text" name="id_number" value={formData.id_number} onChange={e => onChange({ ...formData, id_number: e.target.value })} placeholder="Enter ID number" className="w-full px-2.5 py-1.5 text-sm border border-gray-200" /></div>
        </div>
        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-1">
          <button type="submit" disabled={loading} className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5">{loading ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin" /> : <FiCheck className="w-3.5 h-3.5" />}Reserve Slot</button>
          <button type="button" onClick={onDownloadTemplate} className="px-4 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 flex items-center justify-center gap-1.5"><FiDownload className="w-3.5 h-3.5" />Template</button>
        </div>
      </form>
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between mb-2"><span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Bulk Visitor Upload</span><span className="text-xs text-gray-400">Excel (.xlsx, .csv)</span></div>
        <div className="border-2 border-dashed border-gray-200 p-3 text-center hover:border-blue-400 bg-gray-50/30">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFileSelect} className="hidden" id="visitor-bulk" />
          <label htmlFor="visitor-bulk" className="cursor-pointer block"><FiUpload className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            {bulkFile ? <div className="flex items-center justify-center gap-2 text-xs"><span className="text-gray-700">{bulkFile.name}</span><button type="button" onClick={onFileRemove} className="text-red-500"><FiX className="w-3.5 h-3.5" /></button></div> : <><div className="text-xs text-gray-600">Click to upload</div><div className="text-xs text-gray-400 mt-0.5">.xlsx, .csv</div></>}
          </label>
        </div>
        {bulkFile && <button onClick={onBulkUpload} disabled={loading} className="mt-2 w-full py-1.5 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5">{loading ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin" /> : <FiUpload className="w-3.5 h-3.5" />}Upload List</button>}
      </div>
    </div>
  </div>
);

interface StaffFormProps {
  formData: StaffBookingData; loading: boolean; onChange: (d: StaffBookingData) => void; onSubmit: (e: React.FormEvent) => void; onDownloadTemplate: () => void;
  bulkFile: File | null; onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void; onFileRemove: () => void; onBulkUpload: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export const StaffBookingForm: React.FC<StaffFormProps> = ({ formData, loading, onChange, onSubmit, onDownloadTemplate, bulkFile, onFileSelect, onFileRemove, onBulkUpload, fileInputRef }) => (
  <div className="bg-white border border-gray-200 overflow-hidden">
    <div className="px-4 py-3 border-b bg-gradient-to-r from-indigo-50/50 to-white">
      <div className="flex items-center gap-2"><div className="p-1.5 bg-indigo-100"><FiBriefcase className="w-4 h-4 text-indigo-600" /></div><h2 className="text-sm font-semibold text-gray-900">Permanent Staff Booking</h2></div>
    </div>
    <div className="p-4">
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1 block">Staff Name <span className="text-red-500">*</span></label>
            <div className="relative"><FiUser className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" /><input type="text" name="staff_name" value={formData.staff_name} onChange={e => onChange({ ...formData, staff_name: e.target.value })} required placeholder="e.g., MUHIRE Kenny" className="w-full pl-8 pr-2.5 py-1.5 text-sm border border-gray-200" /></div></div>
          <div><label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1 block">Plate Number <span className="text-red-500">*</span></label>
            <div className="relative"><FiTruck className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" /><input type="text" name="plate_number" value={formData.plate_number} onChange={e => onChange({ ...formData, plate_number: e.target.value })} required placeholder="e.g., RAF 100S" className="w-full pl-8 pr-2.5 py-1.5 text-sm border border-gray-200" /></div></div>
          <div><label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1 block">Phone</label>
            <div className="relative"><FiPhone className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" /><input type="tel" name="phone" value={formData.phone} onChange={e => onChange({ ...formData, phone: e.target.value })} placeholder="+250 791 783 308" className="w-full pl-8 pr-2.5 py-1.5 text-sm border border-gray-200" /></div></div>
          <div><label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1 block">ID Number</label>
            <div className="relative"><FiFileText className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" /><input type="text" name="identification" value={formData.identification} onChange={e => onChange({ ...formData, identification: e.target.value })} placeholder="National ID Number" className="w-full pl-8 pr-2.5 py-1.5 text-sm border border-gray-200" /></div></div>
          <div><label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1 block">Department</label>
            <div className="relative"><FiBriefcase className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" /><input type="text" name="department_name" value={formData.department_name} onChange={e => onChange({ ...formData, department_name: e.target.value })} placeholder="e.g., Finance" className="w-full pl-8 pr-2.5 py-1.5 text-sm border border-gray-200" /></div></div>
        </div>
        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-1">
          <button type="submit" disabled={loading} className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1.5">{loading ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin" /> : <FiMapPin className="w-3.5 h-3.5" />}Allocate Slot</button>
          <button type="button" onClick={onDownloadTemplate} className="px-4 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 flex items-center justify-center gap-1.5"><FiDownload className="w-3.5 h-3.5" />Template</button>
        </div>
      </form>
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between mb-2"><span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Staff Directory Sync</span><span className="text-xs text-gray-400">Upload spreadsheet</span></div>
        <div className="border-2 border-dashed border-gray-200 p-3 text-center hover:border-indigo-400 bg-gray-50/30">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFileSelect} className="hidden" id="staff-bulk" />
          <label htmlFor="staff-bulk" className="cursor-pointer block"><FiUpload className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
            {bulkFile ? <div className="flex items-center justify-center gap-2 text-xs"><span className="text-gray-700">{bulkFile.name}</span><button type="button" onClick={onFileRemove} className="text-red-500"><FiX className="w-3.5 h-3.5" /></button></div> : <><div className="text-xs text-gray-600">Choose file for staff reservation</div><div className="text-xs text-gray-400 mt-0.5">Excel or CSV format</div></>}
          </label>
        </div>
        {bulkFile && <button onClick={onBulkUpload} disabled={loading} className="mt-2 w-full py-1.5 bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1.5">{loading ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin" /> : <FiUpload className="w-3.5 h-3.5" />}Upload List</button>}
      </div>
    </div>
  </div>
);