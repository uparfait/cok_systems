

async function HandleReatime(socket) {
    socket.on('smartparking_test', (data) => {
        socket.emit('smartparking_test', { message: 'Data received successfully!' })
    })
    global.WebsocketIO.emit('smartparking_test', { message: 'This is a real-time update from the server!' })

}

module.exports = HandleReatime