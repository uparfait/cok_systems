const BookingRequestService = require("../services/BookingRequestService");

class BookingRequestController {
  static async handleCreate(req, res) {
    try {
      const result = await BookingRequestService.createRequest(req.body);
      return res.status(201).json(result);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  static async handleAccept(req, res) {
    try {
      const { id } = req.params;
      const result = await BookingRequestService.acceptRequest(id);
      return res.status(200).json(result);
    } catch (error) {
      const statusCode = error.message.includes("not found") ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        message: error.message,
      });
    }
  }

  static async handleReject(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const result = await BookingRequestService.rejectRequest(id, reason);
      return res.status(200).json(result);
    } catch (error) {
      const statusCode = error.message.includes("not found") ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        message: error.message,
      });
    }
  }

  static async handleCancel(req, res) {
    try {
      const { id } = req.params;
      const result = await BookingRequestService.cancelRequest(id);
      return res.status(200).json(result);
    } catch (error) {
      const statusCode = error.message.includes("not found") ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        message: error.message,
      });
    }
  }

  static async handleGetByTrackingCode(req, res) {
    try {
      const { trackingCode } = req.params;
      const result = await BookingRequestService.getByTrackingCode(trackingCode);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  static async handleGetById(req, res) {
    try {
      const { id } = req.params;
      const result = await BookingRequestService.getById(id);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
  }

  static async handleList(req, res) {
    try {
      const result = await BookingRequestService.listRequests(req.query);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  static async handleUpdate(req, res) {
    try {
      const { id } = req.params;
      const result = await BookingRequestService.updateRequest(id, req.body);
      return res.status(200).json(result);
    } catch (error) {
      const statusCode = error.message.includes("not found") ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = BookingRequestController;