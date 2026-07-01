const Router = require('express').Router();
const CreateRoomController = require('../controllers/CreateRoomController');
const UpdateRoomController = require('../controllers/UpdateRoomController');
const DeleteRoomController = require('../controllers/DeleteRoomController');

/**
 * @swagger
 * components:
 *   schemas:
 *     Room:
 *       type: object
 *       required:
 *         - roomName
 *         - roomDescription
 *         - roomCapacity
 *         - roomLocation
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated MongoDB ID
 *         roomName:
 *           type: string
 *           maxlength: 300
 *           description: Name of the room (case-insensitive, unique)
 *           example: "Conference Room A"
 *         roomDescription:
 *           type: string
 *           maxlength: 1000
 *           description: Detailed description of the room
 *           example: "Large conference room with projector and whiteboard"
 *         roomCapacity:
 *           type: number
 *           minimum: 1
 *           description: Maximum capacity of the room
 *           example: 50
 *         roomLocation:
 *           type: string
 *           maxlength: 500
 *           description: Physical location of the room
 *           example: "Building A, Floor 2, Room 205"
 *         isActive:
 *           type: boolean
 *           default: true
 *           description: Whether the room is currently active
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the room was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the room was last updated
 *       example:
 *         _id: "60d5f484f1a2c8b1f8e4e1a1"
 *         roomName: "conference room a"
 *         roomDescription: "Large conference room with projector and whiteboard"
 *         roomCapacity: 50
 *         roomLocation: "Building A, Floor 2, Room 205"
 *         isActive: true
 *         createdAt: "2024-01-15T10:30:00.000Z"
 *         updatedAt: "2024-01-15T10:30:00.000Z"
 *     Error:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "Error message description"
 */

/**
 * @swagger
 * /rooms:
 *   post:
 *     summary: Create a new room
 *     tags: [Rooms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomName
 *               - roomDescription
 *               - roomCapacity
 *               - roomLocation
 *             properties:
 *               roomName:
 *                 type: string
 *                 maxlength: 300
 *                 description: Name of the room (case-insensitive, unique)
 *                 example: "Executive Board Room"
 *               roomDescription:
 *                 type: string
 *                 maxlength: 1000
 *                 description: Detailed description of the room
 *                 example: "Premium board room with video conferencing and smart board"
 *               roomCapacity:
 *                 type: number
 *                 minimum: 1
 *                 description: Maximum capacity of the room
 *                 example: 20
 *               roomLocation:
 *                 type: string
 *                 maxlength: 500
 *                 description: Physical location of the room
 *                 example: "Tower B, Floor 15, Executive Suite 1501"
 *     responses:
 *       201:
 *         description: Room created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Room created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Room'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Duplicate room name
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
 *                   example: "A room with this name already exists"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
Router.post('/', CreateRoomController.handle);

/**
 * @swagger
 * /rooms/{id}:
 *   put:
 *     summary: Update an existing room
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: MongoDB ID of the room to update
 *         example: "60d5f484f1a2c8b1f8e4e1a1"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roomName:
 *                 type: string
 *                 maxlength: 300
 *                 description: Updated room name
 *                 example: "Updated Conference Room B"
 *               roomDescription:
 *                 type: string
 *                 maxlength: 1000
 *                 description: Updated room description
 *                 example: "Updated description with new AV equipment"
 *               roomCapacity:
 *                 type: number
 *                 minimum: 1
 *                 description: Updated room capacity
 *                 example: 75
 *               roomLocation:
 *                 type: string
 *                 maxlength: 500
 *                 description: Updated room location
 *                 example: "Building C, Floor 3, Room 305"
 *     responses:
 *       200:
 *         description: Room updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Room updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Room'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Room not found
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
 *                   example: "Room not found"
 *       409:
 *         description: Duplicate room name
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
 *                   example: "A room with this name already exists"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
Router.put('/:id', UpdateRoomController.handle);

/**
 * @swagger
 * /rooms/{id}:
 *   delete:
 *     summary: Soft delete a room (marks as inactive)
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: MongoDB ID of the room to delete
 *         example: "60d5f484f1a2c8b1f8e4e1a1"
 *     responses:
 *       200:
 *         description: Room deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Room deleted successfully"
 *       400:
 *         description: Cannot delete room with active events
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
 *                   example: "Cannot delete room with active events"
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
Router.delete('/:id', DeleteRoomController.handle);

module.exports = Router;