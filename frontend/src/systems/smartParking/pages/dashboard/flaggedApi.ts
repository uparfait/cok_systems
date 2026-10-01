import { get } from '../../../../core/services/apiClient';
import type { ParkingRow } from '../checkoutVehicle/parkingRows';

export const FLAGGED_PAGE_SIZE = 50;

export interface FlaggedPage {
  rows: ParkingRow[];
  total: number;
}

export const fetchFlaggedVehicles = async (page: number, limit: number = FLAGGED_PAGE_SIZE): Promise<FlaggedPage> => {
  const response = await get(`/smartparking/vehicle/flagged?limit=${limit}&page=${page}&status=active`);
  const rows: ParkingRow[] = Array.isArray(response?.data) ? response.data : [];
  return { rows, total: Number(response?.total) || 0 };
};
