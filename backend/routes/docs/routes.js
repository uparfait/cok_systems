/**
 * Combined API Documentation Routes
 * Serves unified Swagger UI for all APIs using swagger-jsdoc annotations
 * All endpoint documentation is defined via @swagger JSDoc comments in each route file
 */

const Router = require('express').Router()

const swaggerUi = require('swagger-ui-express')
const path = require('path')

// Load swagger specification from swagger-jsdoc (generated from @swagger annotations)
const swaggerSpec = require('../../configurations/swaggerConfig')

/**
 * @swagger
 * /docs/swagger.json:
 *   get:
 *     summary: "Get OpenAPI specification"
 *     description: "Retrieve the complete OpenAPI 3.0.3 specification JSON generated from @swagger annotations across all route files."
 *     tags: [System]
 *     security: []
 *     responses:
 *       200:
 *         description: OpenAPI specification JSON
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
Router.get('/swagger.json', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json(swaggerSpec);
});

/**
 * @swagger
 * /docs:
 *   get:
 *     summary: "Swagger UI Documentation"
 *     description: "Interactive Swagger UI documentation for all COK Systems APIs. Browse and test endpoints directly from the browser."
 *     tags: [System]
 *     security: []
 *     responses:
 *       200:
 *         description: Swagger UI HTML page
 */
Router.use(
    '/',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
        explorer: true,
        customSiteTitle: 'COK Systems API Documentation',
        customCss: `
            .swagger-ui .topbar { background-color: #1a1a2e; }
            .swagger-ui .topbar .download-url-wrapper { display: none; }
            .swagger-ui .info .title { color: #1a1a2e; }
            .swagger-ui .info .description { color: #666; }
            .swagger-ui .op-summary-get { color: #0f6b3d; }
            .swagger-ui .op-summary-post { color: #1a1a2e; }
            .swagger-ui .op-summary-put { color: #c58626; }
            .swagger-ui .op-summary-delete { color: #d32f2f; }
        `,
        swaggerOptions: {
            tryItOutEnabled: true,
            persistAuthorization: true,
            displayRequestDuration: true,
            filter: true,
            docExpansion: 'list',
            defaultModelsExpandDepth: 2,
            defaultModelExpandDepth: 2,
            tagsSorter: 'alpha',
            operationsSorter: 'alpha'
        }
    })
)

module.exports = Router