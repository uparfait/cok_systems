

const express = require('express')
const Router = express.Router()

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
 * Redirect /parfait/docs to main /docs
 */
Router.get('/docs', (req, res) => {
    res.redirect('/cok/api/docs');
});

Router.get('/docs/', (req, res) => {
    res.redirect('/cok/api/docs');
});

/**
 * Also redirect root to /docs for convenience
 */
Router.get('/', (req, res) => {
    res.redirect('/cok/api/docs');
});

module.exports = Router
