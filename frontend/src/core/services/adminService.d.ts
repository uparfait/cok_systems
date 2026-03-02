// Admin Service Type Declarations

export interface Department {
  _id?: string;
  name: string;
  description?: string;
  leaderEmail?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Employee {
  _id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  department?: string;
  position?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Visitor {
  _id?: string;
  name: string;
  phone: string;
  department: string;
  purpose: string;
  status: string;
  checkInTime?: string;
  checkOutTime?: string;
}

export interface Vehicle {
  _id?: string;
  plateNumber: string;
  owner: string;
  department?: string;
  status: string;
}

export interface Permission {
  resource: string;
  actions: string[];
}

export interface Feedback {
  _id?: string;
  visitorName: string;
  phone: string;
  department: string;
  rating: number;
  comment?: string;
  createdAt?: string;
}

export const departmentService: {
  getAll: () => Promise<any>;
  search: (query: string) => Promise<any>;
  getById: (id: string) => Promise<any>;
  getLeader: (email: string) => Promise<any>;
  create: (data: any) => Promise<any>;
  update: (id: string, data: any) => Promise<any>;
  delete: (id: string) => Promise<any>;
};

export const employeeService: {
  getAll: () => Promise<any>;
  search: (query: string) => Promise<any>;
  getById: (id: string) => Promise<any>;
  create: (data: any) => Promise<any>;
  update: (id: string, data: any) => Promise<any>;
  delete: (id: string) => Promise<any>;
  registerCar: (data: any) => Promise<any>;
  bulkUploadCars: (formData: FormData) => Promise<any>;
};

export const permissionService: {
  getAll: () => Promise<any>;
  getByResource: (resource: string) => Promise<any>;
  assignToUser: (userId: string, permissions: any) => Promise<any>;
  removeFromUser: (userId: string, permissions: any) => Promise<any>;
};

export const feedbackService: {
  searchAll: (limit?: number, page?: number) => Promise<any>;
  searchByDepartment: (departmentId: string, from?: string, to?: string) => Promise<any>;
  getById: (id: string) => Promise<any>;
  submit: (data: any) => Promise<any>;
  verifyPhone: (phone: string) => Promise<any>;
  delete: (id: string) => Promise<any>;
};

export const serviceDeliveryService: {
  getAllVisitors: () => Promise<any>;
  searchVisitors: (query: string) => Promise<any>;
  getVisitorById: (id: string) => Promise<any>;
  checkIn: (data: any) => Promise<any>;
  assignToDepartment: (data: any) => Promise<any>;
  checkOut: (data: any) => Promise<any>;
  toggleServiceStatus: (data: any) => Promise<any>;
  emergencyLeaveReturn: (data: any) => Promise<any>;
};

export const smartParkingService: {
  getAllVehicles: () => Promise<any>;
  searchVehicles: (query: string) => Promise<any>;
  getFlaggedVehicles: () => Promise<any>;
  getVehicleById: (id: string) => Promise<any>;
  verifyCar: (data: any) => Promise<any>;
  checkIn: (data: any) => Promise<any>;
  checkOut: (data: any) => Promise<any>;
  registerSingle: (data: any) => Promise<any>;
  bulkUpload: (formData: FormData) => Promise<any>;
};
