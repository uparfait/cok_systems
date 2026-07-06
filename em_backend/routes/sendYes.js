const Router = require('express').Router();


/**
 * @swagger
 * /yes:
 *   get:
 *     summary: Test endpoint to check if the server is running
 *     responses:
 *       200:
 *         description: Server is running and responds with a message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Yes, it works!"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
Router.get('/yes', (req, res) => {
  res.json({ message: 'Yes, it works!' });
});

module.exports = Router;