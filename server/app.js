// Require additional libraries needed for application
const express = require('express')
const moment = require('moment')
const redis = require('socket.io-redis')
const ioredis = require('ioredis')
const pubioredis = ioredis(process.env.IO_REDIS_PUB || 'redis://:@127.0.0.1:6379/4')
const subioredis = ioredis(process.env.IO_REDIS_SUB || 'redis://:@127.0.0.1:6379/4')
const aperture = require('../lib/aperture.js')
const timestampFormat = 'YYYY-MM-DD HH:mm:ss'
const PORT = process.env.PORT || 5001

// Authenticate user before allowing them access to the Aperture features.
// This can just be left alone if you don't want to use any authentication.
const authenticate = function (client, clientInfo, callback) {
  var authorized = false

  if (clientInfo === undefined || clientInfo.apertureClientId === undefined || clientInfo.type === undefined) {
    authorized = false
  } else {
    client.apertureClientId = clientInfo.apertureClientId
    client.type = clientInfo.type
    authorized = true
  }

  callback(null, authorized)
}

// All available client options must happen in postAuthenticate to prevent them from reaching services if they are unauthorized
const postAuthenticate = function (client, authData) {
  // Join client to a room
  client.on('join room', function (requestedRoom) {
    aperture.collectRoomList(io, client).then(function (roomList) {
      aperture.clientJoinRoom(io, client, roomList, requestedRoom)
    })
  })

  // Remove client from a room
  client.on('leave room', function () {
    aperture.clientLeaveRoom(io, client)
  })

  // Allow a user to get a list of available rooms to join
  client.on('get rooms', function () {
    aperture.sendRoomList(io, client)
  })

  // Allow a client to send terminal data to its respective user/device
  client.on('terminal data', function (data) {
    aperture.sendTerminalData(client, data)
  })

  // Allow a user to resize their terminal for the device they are connected to
  client.on('resize terminal', function (data) {
    aperture.resizeTerminal(client, data)
  })

  // Remove user session on device when user disconnects, or kick all clients in device room when device disconnects
  client.on('disconnect', function () {
    aperture.disconnect(io, client)
  })
}

// Start server and listen on designated port
const app = express()
const server = app.listen(PORT, function () {
  console.log(`${moment().format(timestampFormat)}: Server started on port ${server.address().port}`)
})

// Attach socketio-auth to socket.io server
const io = require('socket.io')(server, { wsEngine: 'ws' })
require('socketio-auth')(io, {
  authenticate: authenticate,
  postAuthenticate: postAuthenticate,
  timeout: 'none'
})

// Connect to redis to share events between multiple instances in different processes or servers
io.adapter(redis({ pubClient: pubioredis, subClient: subioredis }))

// Ask every node for the room's device information
io.of('/').adapter.customHook = (room, callback) => {
  try {
    var clientInfo
    if (io.nsps['/'].adapter.rooms[room] !== undefined) {
      var sockets_in_room = io.nsps['/'].adapter.rooms[room].sockets
      for (const socketId in sockets_in_room) {
        var socket = io.sockets.connected[socketId]
        if (socket.apertureClientId === room) {
          clientInfo = new Object()
          clientInfo.clientId = socket.clientId
          clientInfo.siteId = socket.siteId
          clientInfo.id = socket.id
          clientInfo.apertureClientId = socket.apertureClientId
          break
        }
      }
    } else {
      console.log(`${moment().format(timestampFormat)}: There is currently no device in the room "${room}" on this node.`)
    }

    callback(clientInfo)
  } catch (err) {
    console.log(`${moment().format(timestampFormat)}: There was a problem getting the device information for the specified room.`)
  }
}

module.exports = server
