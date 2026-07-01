const Router = require('express').Router();
const GenerateQrCodeController = require('../controllers/GenerateQrCodeController');

/**
 * @swagger
 * /events/{eventId}/qrcode:
 *   get:
 *     summary: Generate QR code for event attendance
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     responses:
 *       200:
 *         description: QR code generated successfully
 */
Router.get('/:eventId/qrcode', GenerateQrCodeController.handle);

module.exports = Router;