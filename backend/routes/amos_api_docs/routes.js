/**
 * AMOS Auth API Documentation Routes
 * Serves Swagger UI for Auth API documentation
 */

const Router = require('express').Router()

const swaggerUi = require('swagger-ui-express')
const YAML = require('yamljs')
const path = require('path')
const swagger_document = YAML.load(path.join(__dirname, 'auth_api_description.yaml'))
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

// Serve swagger spec at unique path - prevent cache
Router.get('/swagger.json', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json(swagger_document);
});

// Serve swagger spec at unique path - prevent cache
Router.get('/api-docs.json', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json(swagger_document);
});

/**
 * Swagger UI for Auth API
 */
Router.use(
    '/docs',
    swaggerUi.serveFiles(swagger_document, {
        swaggerOptions: {
            url: '/cok/api/amos/swagger.json',
        }
    }),
    swaggerUi.setup(swagger_document, {
        explorer: true,
        customSiteTitle: 'AMOS Auth API Docs',
        swaggerUrl: '/cok/api/amos/swagger.json',
        customCss: `
            .swagger-ui .topbar { background-color: #1a1a2e; }
            .swagger-ui .topbar .download-url-wrapper { display: none; }
            .swagger-ui .info .title { color: #1a1a2e; }
        `,
        swaggerOptions: {
            tryItOutEnabled: true,
            persistAuthorization: false,
            displayRequestDuration: true,
            filter: true,
            docExpansion: 'list',
            defaultModelsExpandDepth: 2,
            defaultModelExpandDepth: 2,
            url: '/cok/api/amos/swagger.json',
        }
    })
)

module.exports = Router
