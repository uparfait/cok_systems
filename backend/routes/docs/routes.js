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

const multer = require('multer')
const upload = multer()

Router.use(upload.any())

/**
 * Global Interceptor for Multer Errors
 */
Router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError || error) {
        console.warn('[UPLOAD WARNING]: Handled unexpected or empty input:', error.message)
        req.body = req.body || {}
        return next()
    }
    next()
})

/**
 * Serve Swagger JSON spec (generated from route annotations)
 */
Router.get('/swagger.json', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json(swaggerSpec);
});

/**
 * Unified Swagger UI with all APIs grouped by tags
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