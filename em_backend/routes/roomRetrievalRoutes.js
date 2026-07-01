const Router = require('express').Router();
const GetRoomsController = require('../controllers/GetRoomsController');
const GetRoomByIdController = require('../controllers/GetRoomByIdController');
const GetRoomByNameController = require('../controllers/GetRoomByNameController');
const GetActiveRoomsController = require('../controllers/GetActiveRoomsController');
const GetRoomAvailabilityController = require('../controllers/GetRoomAvailabilityController');
const GetRoomsStatisticsController = require('../controllers/GetRoomsStatisticsController');


/**
 * @swagger
 * components:
 *   schemas:
 *     RoomResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         totalRecords:
 *           type: number
 *           example: 50
 *         totalPages:
 *           type: number
 *           example: 3
 *         currentPage:
 *           type: number
 *           example: 1
 *         limit:
 *           type: number
 *           example: 20
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Room'
 *     RoomWithEventCount:
 *       allOf:
 *         - $ref: '#/components/schemas/Room'
 *         - type: object
 *           properties:
 *             activeEventsCount:
 *               type: number
 *               example: 5
 *             liveEventsCount:
 *               type: number
 *               example: 2
 *             upcomingEventsCount:
 *               type: number
 *               example: 3
 *     RoomAvailability:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             room:
 *               type: object
 *               properties:
 *                 roomName:
 *                   type: string
 *                   example: "conference room a"
 *                 roomCapacity:
 *                   type: number
 *                   example: 50
 *                 roomLocation:
 *                   type: string
 *                   example: "Building A, Floor 2, Room 205"
 *             requestedPeriod:
 *               type: object
 *               properties:
 *                 start:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-02-15T09:00:00.000Z"
 *                 end:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-02-15T11:00:00.000Z"
 *             available:
 *               type: boolean
 *               example: true
 *             conflict:
 *               nullable: true
 *               type: object
 *               properties:
 *                 type:
 *                   type: string
 *                   example: "LiveEvent"
 *                 details:
 *                   type: object
 */

/**
 * @swagger
 * /rooms:
 *   get:
 *     summary: Retrieve all rooms with pagination, sorting, and filters
 *     tags: [Rooms]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of records per page
 *         example: 20
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [new, old, name, nameDesc, capacity, capacityDesc, location, updated]
 *           default: new
 *         description: Sort order
 *         example: "name"
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [all, thisWeek, thisMonth, thisYear, recentlyUpdated, inactive]
 *         description: Filter rooms by time period or status
 *         example: "thisMonth"
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for filtering rooms
 *         example: "conference"
 *       - in: query
 *         name: searchField
 *         schema:
 *           type: string
 *           enum: [roomName, roomLocation, roomDescription]
 *         description: Specific field to search within
 *         example: "roomName"
 *       - in: query
 *         name: minCapacity
 *         schema:
 *           type: integer
 *         description: Minimum room capacity
 *         example: 10
 *       - in: query
 *         name: maxCapacity
 *         schema:
 *           type: integer
 *         description: Maximum room capacity
 *         example: 100
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *         example: true
 *     responses:
 *       200:
 *         description: Rooms retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoomResponse'
 *             examples:
 *               filteredResults:
 *                 value:
 *                   success: true
 *                   totalRecords: 2
 *                   totalPages: 1
 *                   currentPage: 1
 *                   limit: 20
 *                   data:
 *                     - _id: "60d5f484f1a2c8b1f8e4e1a1"
 *                       roomName: "conference room a"
 *                       roomDescription: "Large conference room with projector and whiteboard"
 *                       roomCapacity: 50
 *                       roomLocation: "Building A, Floor 2, Room 205"
 *                       isActive: true
 *                       createdAt: "2024-01-15T10:30:00.000Z"
 *                       updatedAt: "2024-01-15T10:30:00.000Z"
 *                     - _id: "60d5f484f1a2c8b1f8e4e1a2"
 *                       roomName: "board room"
 *                       roomDescription: "Executive board room with video conferencing"
 *                       roomCapacity: 20
 *                       roomLocation: "Building B, Floor 10, Room 1001"
 *                       isActive: true
 *                       createdAt: "2024-01-10T09:00:00.000Z"
 *                       updatedAt: "2024-02-01T14:00:00.000Z"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
Router.get('/', GetRoomsController.handle);



/**
 * @swagger
 * /rooms/name/{roomName}:
 *   get:
 *     summary: Retrieve a room by its name
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: roomName
 *         schema:
 *           type: string
 *         required: true
 *         description: Name of the room (case-insensitive)
 *         example: "Conference Room A"
 *     responses:
 *       200:
 *         description: Room retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Room'
 *       400:
 *         description: Room name is required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Room name is required"
 *       404:
 *         description: Room not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
Router.get('/name/:roomName', GetRoomByNameController.handle);

/**
 * @swagger
 * /rooms/status/active:
 *   get:
 *     summary: Retrieve only active rooms with optional event counts
 *     tags: [Rooms]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of records per page
 *         example: 10
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [name, nameDesc, capacity, capacityDesc, location]
 *           default: name
 *         description: Sort order
 *         example: "capacity"
 *       - in: query
 *         name: includeEventCount
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: false
 *         description: Include count of active events per room
 *         example: "true"
 *     responses:
 *       200:
 *         description: Active rooms retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/RoomResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         oneOf:
 *                           - $ref: '#/components/schemas/Room'
 *                           - $ref: '#/components/schemas/RoomWithEventCount'
 *             examples:
 *               withEventCounts:
 *                 value:
 *                   success: true
 *                   totalRecords: 5
 *                   totalPages: 1
 *                   currentPage: 1
 *                   data:
 *                     - _id: "60d5f484f1a2c8b1f8e4e1a1"
 *                       roomName: "conference room a"
 *                       roomDescription: "Large conference room with projector"
 *                       roomCapacity: 50
 *                       roomLocation: "Building A, Floor 2, Room 205"
 *                       isActive: true
 *                       activeEventsCount: 3
 *                       liveEventsCount: 1
 *                       upcomingEventsCount: 2
 *                       createdAt: "2024-01-15T10:30:00.000Z"
 *                       updatedAt: "2024-02-10T14:00:00.000Z"
 *                     - _id: "60d5f484f1a2c8b1f8e4e1a2"
 *                       roomName: "training room b"
 *                       roomDescription: "Training room with smart board"
 *                       roomCapacity: 30
 *                       roomLocation: "Building C, Floor 1, Room 101"
 *                       isActive: true
 *                       activeEventsCount: 0
 *                       liveEventsCount: 0
 *                       upcomingEventsCount: 0
 *                       createdAt: "2024-01-20T09:00:00.000Z"
 *                       updatedAt: "2024-01-20T09:00:00.000Z"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
Router.get('/status/active', GetActiveRoomsController.handle);

/**
 * @swagger
 * /rooms/availability:
 *   get:
 *     summary: Check room availability for a specific time period
 *     tags: [Rooms]
 *     parameters:
 *       - in: query
 *         name: roomName
 *         schema:
 *           type: string
 *         required: true
 *         description: Name of the room to check
 *         example: "Conference Room A"
 *       - in: query
 *         name: startTime
 *         schema:
 *           type: string
 *           format: date-time
 *         required: true
 *         description: Start of the time period
 *         example: "2024-02-15T09:00:00.000Z"
 *       - in: query
 *         name: endTime
 *         schema:
 *           type: string
 *           format: date-time
 *         required: true
 *         description: End of the time period
 *         example: "2024-02-15T11:00:00.000Z"
 *     responses:
 *       200:
 *         description: Room availability check completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoomAvailability'
 *             examples:
 *               available:
 *                 value:
 *                   success: true
 *                   data:
 *                     room:
 *                       roomName: "conference room a"
 *                       roomCapacity: 50
 *                       roomLocation: "Building A, Floor 2, Room 205"
 *                     requestedPeriod:
 *                       start: "2024-02-15T09:00:00.000Z"
 *                       end: "2024-02-15T11:00:00.000Z"
 *                     available: true
 *                     conflict: null
 *               conflicting:
 *                 value:
 *                   success: true
 *                   data:
 *                     room:
 *                       roomName: "conference room a"
 *                       roomCapacity: 50
 *                       roomLocation: "Building A, Floor 2, Room 205"
 *                     requestedPeriod:
 *                       start: "2024-02-15T09:00:00.000Z"
 *                       end: "2024-02-15T11:00:00.000Z"
 *                     available: false
 *                     conflict:
 *                       type: "LiveEvent"
 *                       details:
 *                         eventName: "Team Standup"
 *                         startedAt: "2024-02-15T09:30:00.000Z"
 *                         willEndAt: "2024-02-15T10:30:00.000Z"
 *       400:
 *         description: Missing or invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "roomName, startTime, and endTime are required"
 *       404:
 *         description: Room not found or inactive
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
Router.get('/availability', GetRoomAvailabilityController.handle);

/**
 * @swagger
 * /rooms/statistics:
 *   get:
 *     summary: Get room statistics and analytics
 *     tags: [Rooms]
 *     description: Retrieve comprehensive statistics about rooms including capacity, occupancy, and location distribution
 *     responses:
 *       200:
 *         description: Room statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     overview:
 *                       type: object
 *                       properties:
 *                         totalRooms:
 *                           type: number
 *                           example: 50
 *                         activeRooms:
 *                           type: number
 *                           example: 45
 *                         inactiveRooms:
 *                           type: number
 *                           example: 5
 *                         occupiedRooms:
 *                           type: number
 *                           example: 12
 *                         availableRooms:
 *                           type: number
 *                           example: 33
 *                     capacity:
 *                       type: object
 *                       properties:
 *                         totalCapacity:
 *                           type: number
 *                           example: 2500
 *                         averageCapacity:
 *                           type: number
 *                           example: 56
 *                     topLocations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           location:
 *                             type: string
 *                             example: "Building A"
 *                           roomCount:
 *                             type: number
 *                             example: 15
 *                           totalCapacity:
 *                             type: number
 *                             example: 750
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
Router.get('/statistics', GetRoomsStatisticsController.handle);

/**
 * @swagger
 * /rooms/{id}:
 *   get:
 *     summary: Retrieve a room by MongoDB ID
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: MongoDB ID of the room
 *         example: "60d5f484f1a2c8b1f8e4e1a1"
 *     responses:
 *       200:
 *         description: Room retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Room'
 *       400:
 *         description: Invalid room ID format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Invalid room ID format"
 *       404:
 *         description: Room not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
Router.get('/:id', GetRoomByIdController.handle);

module.exports = Router;