const { Server } = require("socket.io");

/**
 * WebSocketService class encapsulates the initialization and management of WebSocket connections using Socket.IO.
 * It sets up the WebSocket server and provides a global reference for emitting events across the application.
 * 
 * Usage:
 * @const webSocketService = new WebSocketService(server)
 * @await webSocketService.initWebsocket()
 * @params server - The HTTP server instance to attach the WebSocket server to.
 * @returns {boolean} - Returns true if initialization is successful otherwise false.
 * 
 * Authentication:
 * Clients can authenticate by passing the JWT token in one of these ways:
 * 1. socket.handshake.auth.token = "<jwt_token>"
 * 2. socket.handshake.headers.authorization = "Bearer <jwt_token>"
 * 3. socket.handshake.query.token = "<jwt_token>"
 */

class WebSocketService {
  constructor(server) {
    this.server = server;
  }

  /**
   * Initializes the WebSocket server and sets up CORS configuration.
   * It also assigns the Socket.IO instance to a global variable for easy access across the application.
   * @returns {Promise<boolean>} - Resolves to true if initialization is successful, otherwise false.
   */

  async initWebsocket() {
    try {
      if (!this.server) {
        console.error(
          "HTTP server instance is required to initialize WebSocket server.",
        );
        return false;
      }

      const io = new Server(this.server, {
        cors: {
          // Regexes accept localhost / LAN IPs on ANY port so dev servers (5173, 5174, ...) always connect
          origin: process.env.CLIENT_URL_SET || [
            "https://cok-fr.vercel.app",
            /^http:\/\/localhost(:\d+)?$/,
            /^http:\/\/127\.0\.0\.1(:\d+)?$/,
            /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
            /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
          ],
          allowedHeaders: ["Authorization", "Content-Type"],
          credentials: true,
        },
        // Enable authentication in handshake
        auth: {
          type: "jwt"
        }
      });
          

      global.WebsocketIO = io;
      console.log("WebSocket server initialized successfully.");
      return true;
    } catch (error) {
      console.error("Error initializing WebSocket server:", error);
      return false;
    }
  }
}

module.exports = WebSocketService;
