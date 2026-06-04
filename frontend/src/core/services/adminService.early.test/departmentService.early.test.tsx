import { departmentService } from '../adminService';

jest.mock("../apiClient");

const mockedGet = apiClient.get as jest.Mock;
const mockedPost = apiClient.post as jest.Mock;
const mockedPut = apiClient.put as jest.Mock;
const mockedDel = apiClient.del as jest.Mock;

describe('departmentService() departmentService method', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Happy paths', () => {
    it('should call getAll and return departments', async () => {
      const fakeDepartments = [{ _id: '1', department_name: 'HR' }];
      mockedGet.mockResolvedValueOnce(fakeDepartments);

      const result = await departmentService.getAll();

      expect(mockedGet).toHaveBeenCalledWith('/department/crud');
      expect(result).toBe(fakeDepartments);
    });

    it('should call search with query and return results', async () => {
      const query = 'finance';
      const fakeResults = [{ _id: '2', department_name: 'Finance' }];
      mockedGet.mockResolvedValueOnce(fakeResults);

      const result = await departmentService.search(query);

      expect(mockedGet).toHaveBeenCalledWith(`/department/crud/search?query=${encodeURIComponent(query)}`);
      expect(result).toBe(fakeResults);
    });

    it('should call getById with id and return department', async () => {
      const id = 'abc123';
      const fakeDepartment = { _id: id, department_name: 'IT' };
      mockedGet.mockResolvedValueOnce(fakeDepartment);

      const result = await departmentService.getById(id);

      expect(mockedGet).toHaveBeenCalledWith(`/department/crud/${id}`);
      expect(result).toBe(fakeDepartment);
    });

    it('should call getSubDepartments with departmentId and return sub-departments', async () => {
      const departmentId = 'dept1';
      const fakeSubDepartments = [{ _id: 'sub1', department_name: 'SubDept' }];
      mockedGet.mockResolvedValueOnce(fakeSubDepartments);

      const result = await departmentService.getSubDepartments(departmentId);

      expect(mockedGet).toHaveBeenCalledWith(`/department/crud/${departmentId}/sub-departments`);
      expect(result).toBe(fakeSubDepartments);
    });

    it('should call getLeader with email and return leader', async () => {
      const email = 'leader@example.com';
      const fakeLeader = { _id: 'leader1', email };
      mockedGet.mockResolvedValueOnce(fakeLeader);

      const result = await departmentService.getLeader(email);

      expect(mockedGet).toHaveBeenCalledWith(`/department/crud/leader/${encodeURIComponent(email)}`);
      expect(result).toBe(fakeLeader);
    });

    it('should call create with department data and return created department', async () => {
      const data = { department_name: 'NewDept' };
      const fakeCreated = { _id: 'new1', ...data };
      mockedPost.mockResolvedValueOnce(fakeCreated);

      const result = await departmentService.create(data);

      expect(mockedPost).toHaveBeenCalledWith('/department/crud', data);
      expect(result).toBe(fakeCreated);
    });

    it('should call update with id and data and return updated department', async () => {
      const id = 'upd1';
      const data = { department_name: 'UpdatedDept' };
      const fakeUpdated = { _id: id, ...data };
      mockedPut.mockResolvedValueOnce(fakeUpdated);

      const result = await departmentService.update(id, data);

      expect(mockedPut).toHaveBeenCalledWith(`/department/crud/${id}`, data);
      expect(result).toBe(fakeUpdated);
    });

    it('should call delete with id and return result', async () => {
      const id = 'del1';
      const fakeResult = { success: true };
      mockedDel.mockResolvedValueOnce(fakeResult);

      const result = await departmentService.delete(id);

      expect(mockedDel).toHaveBeenCalledWith(`/department/crud/${id}`);
      expect(result).toBe(fakeResult);
    });

    it('should call addService with departmentId and serviceData and return result', async () => {
      const departmentId = 'dept2';
      const serviceData = { name: 'Cleaning', description: 'Daily cleaning' };
      const fakeResult = { success: true };
      mockedPost.mockResolvedValueOnce(fakeResult);

      const result = await departmentService.addService(departmentId, serviceData);

      expect(mockedPost).toHaveBeenCalledWith(`/department/crud/${departmentId}/services`, serviceData);
      expect(result).toBe(fakeResult);
    });

    it('should call updateService with departmentId, serviceId, and serviceData and return result', async () => {
      const departmentId = 'dept3';
      const serviceId = 'serv1';
      const serviceData = { name: 'Updated Service', description: 'Updated desc' };
      const fakeResult = { success: true };
      mockedPut.mockResolvedValueOnce(fakeResult);

      const result = await departmentService.updateService(departmentId, serviceId, serviceData);

      expect(mockedPut).toHaveBeenCalledWith(`/department/crud/${departmentId}/services/${serviceId}`, serviceData);
      expect(result).toBe(fakeResult);
    });

    it('should call deleteService with departmentId and serviceId and return result', async () => {
      const departmentId = 'dept4';
      const serviceId = 'serv2';
      const fakeResult = { success: true };
      mockedDel.mockResolvedValueOnce(fakeResult);

      const result = await departmentService.deleteService(departmentId, serviceId);

      expect(mockedDel).toHaveBeenCalledWith(`/department/crud/${departmentId}/services/${serviceId}`);
      expect(result).toBe(fakeResult);
    });
  });

  describe('Edge cases', () => {
    it('should encode special characters in search query', async () => {
      const query = 'HR & Admin/IT';
      mockedGet.mockResolvedValueOnce([]);

      await departmentService.search(query);

      expect(mockedGet).toHaveBeenCalledWith(`/department/crud/search?query=${encodeURIComponent(query)}`);
    });

    it('should encode special characters in getLeader email', async () => {
      const email = 'user+test@domain.com';
      mockedGet.mockResolvedValueOnce({});

      await departmentService.getLeader(email);

      expect(mockedGet).toHaveBeenCalledWith(`/department/crud/leader/${encodeURIComponent(email)}`);
    });

    it('should handle empty string as id in getById', async () => {
      const id = '';
      mockedGet.mockResolvedValueOnce({});

      await departmentService.getById(id);

      expect(mockedGet).toHaveBeenCalledWith(`/department/crud/`);
    });

    it('should handle empty string as departmentId in getSubDepartments', async () => {
      const departmentId = '';
      mockedGet.mockResolvedValueOnce([]);

      await departmentService.getSubDepartments(departmentId);

      expect(mockedGet).toHaveBeenCalledWith(`/department/crud//sub-departments`);
    });

    it('should handle empty string as id in delete', async () => {
      const id = '';
      mockedDel.mockResolvedValueOnce({ success: true });

      await departmentService.delete(id);

      expect(mockedDel).toHaveBeenCalledWith(`/department/crud/`);
    });

    it('should handle empty string as departmentId in addService', async () => {
      const departmentId = '';
      const serviceData = { name: 'Test Service' };
      mockedPost.mockResolvedValueOnce({ success: true });

      await departmentService.addService(departmentId, serviceData);

      expect(mockedPost).toHaveBeenCalledWith(`/department/crud//services`, serviceData);
    });

    it('should handle empty string as serviceId in updateService', async () => {
      const departmentId = 'deptX';
      const serviceId = '';
      const serviceData = { name: 'Test Service' };
      mockedPut.mockResolvedValueOnce({ success: true });

      await departmentService.updateService(departmentId, serviceId, serviceData);

      expect(mockedPut).toHaveBeenCalledWith(`/department/crud/${departmentId}/services/`, serviceData);
    });

    it('should handle empty string as serviceId in deleteService', async () => {
      const departmentId = 'deptY';
      const serviceId = '';
      mockedDel.mockResolvedValueOnce({ success: true });

      await departmentService.deleteService(departmentId, serviceId);

      expect(mockedDel).toHaveBeenCalledWith(`/department/crud/${departmentId}/services/`);
    });

    it('should handle empty object as data in create', async () => {
      const data = {};
      mockedPost.mockResolvedValueOnce({ _id: 'empty', ...data });

      await departmentService.create(data);

      expect(mockedPost).toHaveBeenCalledWith('/department/crud', data);
    });

    it('should handle empty object as data in update', async () => {
      const id = 'upd2';
      const data = {};
      mockedPut.mockResolvedValueOnce({ _id: id, ...data });

      await departmentService.update(id, data);

      expect(mockedPut).toHaveBeenCalledWith(`/department/crud/${id}`, data);
    });
  });
});