/**
 * Initializes all real-time services by setting up WebSocket connections and handlers.
 * This module imports individual real-time handlers for different services (e.g., smart parking, service delivery)
 * and attaches them to the WebSocket server. It ensures that all real-time functionalities are centralized and easily maintainable.
 * 
 * JWT Authentication: Verifies token from socket handshake headers for protected connections.
 */

const smart_park_realtime = require('./smartparking/smartpark.js')
const service_delivery_realtime = require('./service_delivery/service_delivery.js')
const task_realtime = require('./tasks/task_realtime.js')
const department = require('../../models/department.js')
const chat_realtime = require('./chatting/chat.js')
const jwt = require('../../utilities/jwt.js')
const User = require('../../models/user.js')


function Global_ChatRoom() {
    return "global_chat_room"
}

function Private_Room(userId) {
    return `PRIVATE_ROOM_${userId.toString()}`
}

function RoleBased_Room(roleName) {
    return `ROLE_BASED_ROOM_${roleName}`
}

/**
 * Verify JWT token from socket handshake
 * @param {string} token - JWT token from handshake
 * @returns {Promise<object|null>} - User object if valid, null otherwise
 */
async function verifySocketToken(token) {
    try {
        if (!token) return null;
        
        // Extract token - handle both "Bearer <token>" and raw token formats
        let extractedToken = token;
        if (token.startsWith('Bearer ')) {
            // Remove "Bearer " prefix and try to extract
            const rawToken = token.substring(7); // Remove "Bearer " prefix
            const extracted = jwt.extractToken(token);
            if (extracted) {
                extractedToken = extracted;
            } else {
                // If extraction fails, use raw token
                extractedToken = rawToken;
            }
        }
        
        
        // Verify the token
        const verification = jwt.verifyAccessToken(extractedToken);
        if (!verification.valid) {
            console.log('Token verification failed:', verification.error);
            return null;
        }
        
        
        // Get user from database
        const user = await User.findById(verification.decoded.userId);
        if (!user) {
            console.log('User not found for userId:', verification.decoded.userId);
            return null;
        }
        
        // Check if account is activated
        if (!user.is_account_activated) {
            console.log('User account not activated:', user.email);
            return null;
        }
        
        // Check if account is locked
        if (user.access_control?.is_locked) {
            console.log('User account is locked:', user.email);
            return null;
        }
        
        return {
            userId: user._id,
            email: user.email,
            fullName: user.full_name,
            role: user.roles?.role_name || 'user',
            permissions: user.roles?.permissions || []
        };
    } catch (error) {
        console.error('Socket token verification error:', error);
        return null;
    }
}

/**
 * Initializes the WebSocket server and sets up real-time handlers for various services.
 * It listens for new WebSocket connections and attaches the appropriate handlers for each service.
 * @returns {Promise<boolean>} - Resolves to true if initialization is successful, otherwise false.
 */
module.exports = async function InitialiseAllRealtimeServices() {

    try {
        const io = WebsocketIO

        io.use(async (socket, next) => {
            // Get token from socket handshake headers
            const token = socket.handshake.auth.token || 
                          socket.handshake.headers.authorization?.replace('Bearer ', '') ||
                          socket.handshake.query.token;
            
            
            // If no token provided, allow connection but mark as unauthenticated
            if (!token) {
                console.log('Socket connection without authentication');
                socket.user = null;
                return next();
            }
            
            // Verify the token
            const user = await verifySocketToken(token);
            
            if (user) {
                socket.user = user;
                console.log(`Socket authenticated: ${user.email} (${user.role}) - UserId: ${user.userId}`);
            } else {
                console.log('Socket authentication failed - invalid token');
                // Allow connection but mark as unauthenticated
                socket.user = null;
            }
            
            next();
        })

        io.on('connection', async (socket) => {
            console.log('A user connected to real-time services:', socket.userId || socket.id)

            // if socket and user exists join to rooms

            if (socket.user) {
                socket.join(Global_ChatRoom());
                socket.join(Private_Room(socket.user.userId));
                socket.join(RoleBased_Room(socket.user.role));
                
                // so ckeck if there is a department he is a reader and join him to this department and makesure comparing mongodb id

                const departments = await department.find({ 'department_leader': socket.user.userId });
                if (departments && departments.length > 0) {
                    departments.forEach(dept => {
                        socket.join(`DEPARTMENT_ROOM_${dept.department_name}`)
                       // console.log(`User ${socket.user.email} joined department room: DEPARTMENT_ROOM_${dept.department_id}`)
                    })
                } 
            }

            // update this user as active in database if user exists
            if (socket.user) {
                User.findByIdAndUpdate(socket.user.userId, { is_active: true }, { new: true })
                    .then(updatedUser => {
                        // notify active users
                        global.WebsocketIO.emit('active_user', {
                            user_id: updatedUser._id,
                        })
                    })
                    .catch(err => {
                        console.error('Error updating user active status:', err)
                    })
            }
           
            
            socket.on('disconnect', async () => {
                console.log('A user disconnected from real-time services:', socket.id)
                // remove user from all rooms
                if(socket.user) {
                    socket.leave(Global_ChatRoom());
                    socket.leave(Private_Room(socket.user.userId));
                    socket.leave(RoleBased_Room(socket.user.role));

                    // check user if is a leader in any department and remove him from this department room
                    const departments = await department.find({ 'department_leader': socket.user.userId });
                    if (departments && departments.length > 0) {
                        departments.forEach(dept => {
                            socket.leave(`DEPARTMENT_ROOM_${dept.department_name}`)
                            //console.log(`User ${socket.user.email} left department room: DEPARTMENT_ROOM_${dept.department_id}`)
                        })
                    }
                }

                // update this user as inactive in database if user exists
                if (socket.user) {
                    User.findByIdAndUpdate(socket.user.userId, { is_active: false }, { new: true })
                        .then(updatedUser => {
                            // notify inactive to users
                            global.WebsocketIO.emit('inactive_user', {
                                user_id: updatedUser._id,
                            })
                        })
                        .catch(err => {
                            console.error('Error updating user active status:', err)
                        })
                }
            })

            socket.on('error', (error) => {
                console.error('WebSocket error on socket', socket.id, ':', error)
            })

            socket.on('connect_error', (error) => {
                console.error('WebSocket connection error on socket', socket.id, ':', error)
            })
            socket.on('connect_timeout', (timeout) => {
                console.error('WebSocket connection timeout on socket', socket.id, ':', timeout)
            })

            socket.on('ping', () => {
                console.log('Received ping from socket', socket.id)
                socket.emit('pong', { message: 'Pong from server!' })
            })

            // Get authenticated user info
            socket.on('get_user_info', (data, callback) => {
                if (socket.user) {
                    return callback({ 
                        success: true, 
                        authenticated: true,
                        user: socket.user 
                    });
                }
                return callback({ 
                    success: false, 
                    authenticated: false,
                    message: 'Not authenticated'
                });
            });

            // Initialize individual real-time handlers
            smart_park_realtime(socket)
            service_delivery_realtime(socket)
            task_realtime(socket)
            chat_realtime(socket)
            // All other real-time handlers can be added here in the future as needed


        })

        console.log('All Real-time services initialized successfully with JWT authentication.')
        return true
    }
    catch (error) {
        console.error('Error initializing real-time services:', error)
        return false
    }
}