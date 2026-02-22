

const Router = require('express').Router()

const swaggerUi = require('swagger-ui-express')
const YAML = require('yamljs')
const path = require('path')
const swagger_document = YAML.load(path.join(__dirname, 'api_description.yaml'))
const multer = require('multer')
const upload = multer()


Router.use(upload.any())

/**
 * Global Interceptor for Multer Errors
 * This prevents the app from throwing a 500 error when:
 * - No data is sent
 * - Input is not formatted correctly as multipart/form-data
 * - Unexpected fields are sent
 */
Router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError || error) {
        // Log the issue internally for the dev
        console.warn('[UPLOAD WARNING]: Handled unexpected or empty input:', error.message)

        // Instead of crashing, we normalize the body to an empty object
        // and let the request continue to the controllers
        req.body = req.body || {}
        return next()
    }
    next()
})


Router.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(swagger_document, {
        explorer: true,
        customSiteTitle: 'PARFAIT\'S API Docs',
        customCss: `
            .swagger-ui .topbar { background-color: #1a1a2e; }
            .swagger-ui .topbar .download-url-wrapper { display: none; }
            .swagger-ui .info .title { color: #1a1a2e; }
        `,

        swaggerOptions: {
            tryItOutEnabled: true,
            persistAuthorization: true,
            displayRequestDuration: true,
            filter: true,
            docExpansion: 'list',
            defaultModelsExpandDepth: 2,
            defaultModelExpandDepth: 2,
        }
    })
)




module.exports = Router
