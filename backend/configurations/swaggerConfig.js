/**
 * Swagger Configuration
 * Central configuration for Swagger API documentation
 * All route files use @swagger JSDoc annotations for endpoint definitions
 */

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'COK Systems API',
      version: '1.0.0',
      description: `
        Combined API Documentation for COK Systems
        
        ## Authentication
        Most endpoints require JWT Bearer token authentication.
        To authenticate, click the "Authorize" button and enter your JWT token.
        
        ## API Prefix
        All endpoints are prefixed with /cok/api
        
        ## Modules
        - **Authentication** - Login, logout, password reset, account activation
        - **Service Delivery** - Visitor management, check-in/out, service tracking
        - **Smart Parking** - Vehicle management, parking slots, reservations
        - **Departments** - Department CRUD and service management
        - **Employees** - Employee management and staff vehicles
        - **Event Management** - Rooms, events, attendance, meeting minutes
        - **Task Management** - Kanban boards, tasks, checklists
        - **Feedback** - Visitor feedback and ratings
        - **Notifications** - User notifications
        - **Statistics** - Analytics and reporting
        - **Audit** - Audit logs and tracking
        - **Roles & Permissions** - RBAC management
        - **Profile** - User profile management
      `,
      contact: {
        name: 'COK Systems Team',
        email: 'cokservicedelivery@gmail.com',
        url: 'https://github.com/uparfait/cok_systems'
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC'
      }
    },
    servers: [
      {
        url: 'http://localhost:2026/cok/api',
        description: 'Local Development Server'
      },
      {
        url: 'https://cok-bc.onrender.com/cok/api',
        description: 'Production Server'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token. Format: Bearer <token>'
        }
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Indicates if the request was successful'
            },
            message: {
              type: 'string',
              description: 'Response message'
            },
            error: {
              type: 'string',
              description: 'Error message if success is false'
            },
            data: {
              type: 'object',
              description: 'Response payload data'
            }
          }
        },
        PaginationInfo: {
          type: 'object',
          properties: {
            current_page: { type: 'integer', example: 1 },
            per_page: { type: 'integer', example: 10 },
            total: { type: 'integer', example: 100 },
            total_pages: { type: 'integer', example: 10 },
            has_next: { type: 'boolean', example: true },
            has_prev: { type: 'boolean', example: false }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            type: { type: 'string', example: 'warning' },
            message: { type: 'string', example: 'Error description' },
            error: { type: 'string', example: 'Detailed error message' }
          }
        }
      }
    },
    security: [
      {
        BearerAuth: []
      }
    ],
    tags: [
      // Authentication Tags
      { name: 'Authentication - Login', description: 'User login with OTP 2FA' },
      { name: 'Authentication - Logout', description: 'User logout and session management' },
      { name: 'Authentication - Password Reset', description: 'Password recovery and reset with OTP' },
      { name: 'Authentication - First Login', description: 'Account activation for new users' },
      { name: 'Authentication - Account Lock', description: 'Account locking and unlocking' },
      
      // Core Module Tags
      { name: 'Service Delivery', description: 'Visitor management, check-in/out, and service tracking' },
      { name: 'Smart Parking', description: 'Vehicle management, parking slots, and reservations' },
      { name: 'Departments', description: 'Department CRUD operations and service management' },
      { name: 'Employees', description: 'Employee management and staff vehicle registration' },
      
      // Event Management Tags
      { name: 'Event Rooms', description: 'Room CRUD, availability, and statistics' },
      { name: 'Event Management', description: 'Create, manage, and track events' },
      { name: 'Event Attendance', description: 'Event attendance tracking and submission' },
      { name: 'Event Meeting Minutes', description: 'Post and manage meeting minutes' },
      
      // Task Management Tags
      { name: 'Task Management', description: 'Kanban board task management' },
      
      // System Module Tags
      { name: 'Feedback', description: 'Visitor feedback submission and management' },
      { name: 'Notifications', description: 'User notification management' },
      { name: 'Statistics', description: 'Analytics and reporting endpoints' },
      { name: 'Profile', description: 'User profile and password management' },
      { name: 'Roles & Permissions', description: 'Role-based access control management' },
      { name: 'System Permissions', description: 'System-wide permission management' },
      { name: 'Audit Logs', description: 'Audit trail and system monitoring' },
      { name: 'Dashboard', description: 'Dashboard analytics and metrics' },
      { name: 'Department Manager', description: 'Department manager specific endpoints' },
      { name: 'Performance', description: 'Employee and team performance analytics' },
      { name: 'Bulk Operations', description: 'Bulk data upload and employee creation' }
    ]
  },
  apis: [
    './routes/**/*.js',
    './routes/auth/**/*.js',
    './routes/docs/**/*.js'
  ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;