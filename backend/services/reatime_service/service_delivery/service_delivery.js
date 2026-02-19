

async function HandleReatime(socket) {
    socket.on('service_delivery_test', (data) => {
        socket.emit('service_delivery_test', { message: 'Data received successfully!' })
    })
    global.WebsocketIO.emit('service_delivery_test', { message: 'This is a real-time update from the server!' })

}

module.exports = HandleReatime