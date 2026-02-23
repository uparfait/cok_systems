const user_model = require('../../../models/user.js')
const mongoose = require('mongoose')

async function HandleReatime(socket) {
    socket.on('service_delivery_test', (data) => {
        socket.emit('service_delivery_test', { message: 'Data received successfully!' })
    })

    socket.on('im_not_active', async (data, callback) => {

        try {
            const user_name = data.user.name
            const user_id = data.user.id

            if (!user_name || !user_id) {
                return callback({ message: 'Username and id are required' })
            }

            if (!mongoose.Types.ObjectId.isValid(user_id)) {
                return callback({ success: false, message: "Invalid user ID" })
            }

            const find_user = await user_model.findById(user_id)

            if (find_user && find_user?.is_active === false) {
                find_user.is_active = false
                await find_user.save()

                global.WebsocketIO.emit('notifications', {
                    message: `${user_name} isn't active from now`
                })

                return callback({ success: true, message: "You marked as inactive and notification sent." })
            } else {
                return callback({ success: false, message: "You are already inactive or your account not found." })
            }
        } catch (e) {
            console.log('error in service delivery socket')
            return callback({ status: false, message: "Something got wrong try again later" })
        }


    })

    socket.on('im_active', async (data, callback) => {


        try {
            const user_name = data.user.name
            const user_id = data.user.id

            if (!user_name || !user_id) {
                return callback({ message: 'Username and id are required' })
            }

            // verify if sent id is valid

            if (!mongoose.Types.ObjectId.isValid(user_id)) {
                return callback({ success: false, message: "Invalid user ID" })
            }

            const find_user = await user_model.findById(user_id)

            if (find_user && find_user?.is_active === false) {
                find_user.is_active = true
                await find_user.save()
                global.WebsocketIO.emit('notifications', {
                    message: `${user_name} is now active`
                })
                return callback({ success: true, message: "You marked as active and notification sent." })
            } else {
                return callback({ success: false, message: "You are already active or your account not found." })
            }

        } catch (e) {
            console.log('error in service delivery socket')
            return callback({ status: false, message: "Something got wrong try again later" })
        }


    })


    socket.on('global_notification', (data, callback) => {
        try {
            const message = data.message
            const user = data?.user?.message

            if(user && message) {
                global.WebsocketIO.emit('global_notification', { title: 'Notification',sender: user, message: message })
                return callback({status: true, message: "Sent"})
            } else {
                return callback({status: false, message: "Missing user or message data"})
            }
            
        } catch(e) {
            console.log('error in global_notification', e)
            return callback({status: false, message: "Try again later"})
        }
    })

    global.WebsocketIO.emit('service_delivery_test', { message: 'This is a real-time update from the server!' })

}

module.exports = HandleReatime