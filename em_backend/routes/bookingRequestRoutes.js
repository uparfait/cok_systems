const Router = require("express").Router();
const BookingRequestController = require("../controllers/BookingRequestController");

/**
 * @swagger
 * components:
 *   schemas:
 *     BookingRequest:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated MongoDB ID
 *         eventMeetingType:
 *           type: string
 *           enum: [event, meet]
 *           example: "event"
 *         eventName:
 *           type: string
 *           maxlength: 500
 *           example: "Team Planning Session"
 *         eventDescription:
 *           type: string
 *           maxlength: 2000
 *           example: "Quarterly planning session"
 *         eventType:
 *           type: string
 *           enum: [Internal, Joint, External]
 *           example: "Internal"
 *         eventRoom:
 *           type: string
 *           example: "conference room a"
 *         eventOrganizer:
 *           type: object
 *           properties:
 *             fullNames:
 *               type: string
 *             email:
 *               type: string
 *             phone:
 *               type: string
 *             institution:
 *               type: string
 *         startTime:
 *           type: string
 *           format: date-time
 *         endTime:
 *           type: string
 *           format: date-time
 *         expectedAudience:
 *           type: number
 *           example: 20
 *         activityAgenda:
 *           type: array
 *           items:
 *             type: object
 *         trackingCode:
 *           type: string
 *           example: "BRK-A1B2C3D4"
 *         status:
 *           type: string
 *           enum: [Pending, Accepted, Rejected, Cancelled]
 *           example: "Pending"
 *         rejectionReason:
 *           type: string
 *           example: ""
 *         acceptedEventSpecialId:
 *           type: string
 *           nullable: true
 *         acceptedEventType:
 *           type: string
 *           enum: [upcoming, recurring]
 *           nullable: true
 *     BookingRequestListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         totalRecords:
 *           type: number
 *         totalPages:
 *           type: number
 *         currentPage:
 *           type: number
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/BookingRequest'
 */

/**
 * @swagger
 * /booking-requests:
 *   post:
 *     summary: Submit a new booking request
 *     tags: [Booking Requests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventName
 *               - eventDescription
 *               - eventType
 *               - eventRoom
 *               - eventOrganizer
 *               - startTime
 *               - endTime
 *             properties:
 *               eventMeetingType:
 *                 type: string
 *                 enum: [event, meet]
 *                 example: "event"
 *               eventName:
 *                 type: string
 *                 example: "Team Planning Session"
 *               eventDescription:
 *                 type: string
 *                 example: "Quarterly planning session"
 *               eventType:
 *                 type: string
 *                 enum: [Internal, Joint, External]
 *                 example: "Internal"
 *               eventRoom:
 *                 type: string
 *                 example: "conference room a"
 *               eventOrganizer:
 *                 type: object
 *                 properties:
 *                   fullNames:
 *                     type: string
 *                   email:
 *                     type: string
 *                   phone:
 *                     type: string
 *                   institution:
 *                     type: string
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               expectedAudience:
 *                 type: number
 *     responses:
 *       201:
 *         description: Booking request submitted successfully
 *       400:
 *         description: Validation error or room conflict
 */
Router.post("/", BookingRequestController.handleCreate);

/**
 * @swagger
 * /booking-requests:
 *   get:
 *     summary: List all booking requests with pagination, status, and date filters
 *     tags: [Booking Requests]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Pending, Accepted, Rejected, Cancelled]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [new, old]
 *     responses:
 *       200:
 *         description: Booking requests retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookingRequestListResponse'
 */
Router.get("/", BookingRequestController.handleList);

/**
 * @swagger
 * /booking-requests/tracking/{trackingCode}:
 *   get:
 *     summary: Get a booking request by its tracking code
 *     tags: [Booking Requests]
 *     parameters:
 *       - in: path
 *         name: trackingCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking request found
 *       404:
 *         description: Booking request not found
 */
Router.get("/tracking/:trackingCode", BookingRequestController.handleGetByTrackingCode);

/**
 * @swagger
 * /booking-requests/tracking/{trackingCode}/request-water:
 *   put:
 *     summary: Request water for an accepted Internal booking (from the tracking page)
 *     tags: [Booking Requests]
 *     parameters:
 *       - in: path
 *         name: trackingCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Water request submitted
 *       400:
 *         description: Request not accepted, not Internal, or water already requested
 *       404:
 *         description: Booking request not found
 */
Router.put("/tracking/:trackingCode/request-water", BookingRequestController.handleRequestWater);

/**
 * @swagger
 * /booking-requests/{id}:
 *   get:
 *     summary: Get a booking request by its MongoDB ID
 *     tags: [Booking Requests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking request found
 *       404:
 *         description: Booking request not found
 */
Router.get("/:id", BookingRequestController.handleGetById);

/**
 * @swagger
 * /booking-requests/{id}/accept:
 *   put:
 *     summary: Accept a booking request and create the event
 *     tags: [Booking Requests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking request accepted and event created
 *       400:
 *         description: Cannot accept a non-pending request
 *       404:
 *         description: Booking request not found
 */
Router.put("/:id/accept", BookingRequestController.handleAccept);

/**
 * @swagger
 * /booking-requests/{id}/reject:
 *   put:
 *     summary: Reject a booking request with a reason
 *     tags: [Booking Requests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 maxlength: 1000
 *     responses:
 *       200:
 *         description: Booking request rejected
 *       400:
 *         description: Cannot reject a non-pending request or missing reason
 *       404:
 *         description: Booking request not found
 */
Router.put("/:id/reject", BookingRequestController.handleReject);

/**
 * @swagger
 * /booking-requests/{id}/cancel:
 *   put:
 *     summary: Cancel a booking request (by user, only if Pending)
 *     tags: [Booking Requests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking request cancelled
 *       400:
 *         description: Cannot cancel a non-pending request
 *       404:
 *         description: Booking request not found
 */
Router.put("/:id/cancel", BookingRequestController.handleCancel);

/**
 * @swagger
 * /booking-requests/{id}:
 *   put:
 *     summary: Update a pending booking request
 *     tags: [Booking Requests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               eventName:
 *                 type: string
 *               eventDescription:
 *                 type: string
 *               eventType:
 *                 type: string
 *               eventRoom:
 *                 type: string
 *               eventMeetingType:
 *                 type: string
 *               expectedAudience:
 *                 type: number
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               eventOrganizer:
 *                 type: object
 *     responses:
 *       200:
 *         description: Booking request updated
 *       400:
 *         description: Validation error or room conflict
 *       404:
 *         description: Booking request not found
 */
Router.put("/:id", BookingRequestController.handleUpdate);

module.exports = Router;