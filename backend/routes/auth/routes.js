const Router = require("express").Router()


Router.get('/login', (req, res, next) => {
    return res.status(200).json({
        status: true,
        error: null,
        message: "GET auth/login"
    })
})

Router.post('/login', (req, res, next) => {
    return res.status(200).json({
        status: true,
        error: null,
        message: "POST auth/login"
    })
})

Router.put('/login', (req, res, next) => {
    return res.status(200).json({
        status: true,
        error: null,
        message: "PUT auth/login"
    })
})

module.exports = Router
