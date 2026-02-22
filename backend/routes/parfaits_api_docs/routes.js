

const Router = require('express').Router()

const swaggerUi = require('swagger-ui-express')
const YAML = require('yamljs')
const path = require('path')
const swagger_document = YAML.load(path.join(__dirname, 'api_description.yaml'))


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
