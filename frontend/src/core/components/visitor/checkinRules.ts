import { serviceDeliveryService } from '../../services/adminService';

export const ID_TYPE_OPTIONS = ['National ID', 'Passport', 'Driving Licence'];

export const validateIdNumber = (idType: string, idNumber: string): string | null => {
  const trimmedId = (idNumber || '').trim();
  if (!trimmedId) return null;
  if (idType === 'National ID') {
    if (trimmedId.length !== 16) return 'National ID must be 16 digits';
    if (!/^\d+$/.test(trimmedId)) return 'National ID must contain only numbers';
  } else if (idType === 'Passport') {
    if (trimmedId.length < 6) return 'Passport number must be at least 6 characters';
    if (!/^[A-Z0-9]+$/i.test(trimmedId)) return 'Passport number must contain only letters and numbers';
  } else if (idType === 'Driving Licence') {
    if (trimmedId.length < 8) return 'Driving Licence must be at least 8 characters';
    if (!/^[A-Z0-9]+$/i.test(trimmedId)) return 'Driving Licence must contain only letters and numbers';
  }
  return null;
};

export const validateEmail = (email: string): string | null => {
  const trimmedEmail = (email || '').trim();
  if (!trimmedEmail) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail) ? null : 'Please enter a valid email address';
};

export interface FoundVisitor {
  _id?: string;
  full_name?: string;
  telephone?: string;
  email?: string;
  gender?: string;
  identification?: { id_type?: string; number?: string } | null;
}

export const findVisitorByIdNumber = async (idType: string, idNumber: string): Promise<FoundVisitor | null> => {
  try {
    const response = await serviceDeliveryService.getVisitorByIdentification(idType, idNumber.trim());
    return response?.success && response.data ? (response.data as FoundVisitor) : null;
  } catch {
    return null;
  }
};

export const identificationPayload = (idType: string, idNumber: string) =>
  idNumber.trim() ? { id_type: idType, number: idNumber.trim() } : {};
