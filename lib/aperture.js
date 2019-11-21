// Require additional libraries needed for application
require('./extendArray').extendModule(Array)
const moment = require('moment')
const timestampFormat = 'YYYY-MM-DD HH:mm:ss'

// Return a list of available rooms on the Aperture server
const collectRoomList = function (io, client) {
  var roomNameRegExp = RegExp('[A-Z0-9]{12}')
  console.log(`${moment().format(timestampFormat)}: The ${client.type} ${client.apertureClientId} is collecting a list of available rooms.`)
  return new Promise(function (resolve, reject) {
    io.of('/').adapter.allRooms((err, rooms) => {
      const deviceRooms = rooms.filter((item) => {
        return roomNameRegExp.test(item)
      })
      console.log('Available rooms across all instances: ' + deviceRooms)
      resolve(deviceRooms)
    })
  })
}

// Send list of available rooms to client
const sendRoomList = function (io, client) {
  console.log(`${moment().format(timestampFormat)}: The ${client.type} ${client.apertureClientId} has requested a list of available rooms.`)
  collectRoomList(io, client).then(function (roomList) {
    console.log(`${moment().format(timestampFormat)}: Sending a list of available rooms to the ${client.type} ${client.apertureClientId}.`)
    client.emit('room list', roomList)
  })
}

// Join client to requested room
const clientJoinRoom = function (io, client, roomList, requestedRoom) {
  io.of('/').adapter.customRequest(requestedRoom, function (err, replies) {
    var requestedRoomDevice = replies.filter(Boolean)[0]

    // Join user to room if they meet criteria
    if (client.type === 'user' && roomList.includes(requestedRoom) && requestedRoomDevice !== undefined) {
      client.join(requestedRoom, function () {
        console.log(`${moment().format(timestampFormat)}: The ${client.type} ${client.apertureClientId} has joined the room "${requestedRoom}".`)
        client.emit('joined room', requestedRoom)
        client.connectedDeviceSID = requestedRoomDevice.id
        client.connectedRoom = requestedRoom
        client.to(client.connectedDeviceSID).emit('user joined device', client.id)
      })
    }

    // Join device to room if they meet criteria
    else if (client.type === 'device' && requestedRoomDevice === undefined) {
      client.join(requestedRoom, function () {
        console.log(`${moment().format(timestampFormat)}: The ${client.type} ${client.apertureClientId} has joined the room "${requestedRoom}".`)
        client.emit('joined room', requestedRoom)
        updateDeviceStatus(io, client, client.apertureClientId, true)
        client.connectedRoom = requestedRoom
      })
    }

    // Deny anyone who isn't a user or device who also meets criteria
    else {
      denyClientToRoom(io, client, requestedRoom)
    }
  })
}

// Send device status of online or offline to all users currently connected to Aperture
const updateDeviceStatus = function (io, client, device, status) {
  io.of('/').adapter.clients((err, clients) => {
    clients.forEach(function (foundClient) {
      var socket = io.sockets.connected[foundClient]
      if (socket.type === 'user') {
        client.to(socket.id).emit('device status changed', { device: device, status: status })
      }
    })
  })
}

// Allow client to leave room
const clientLeaveRoom = function (io, client) {
  io.of('/').adapter.remoteLeave(client.id, client.connectedRoom, (err) => {
    console.log(`${moment().format(timestampFormat)}: The ${client.type} ${client.apertureClientId} is leaving the room ${client.connectedRoom}.`)
    client.to(client.connectedDeviceSID).emit('user left device', client.id)
    client.connectedDeviceSID = ''
    client.connectedRoom = ''
  })
}

// Kick a single client from a room
const kickSingleClient = function (io, client, socket) {
  io.of('/').adapter.remoteLeave(socket.id, socket.connectedRoom, (err) => {
    console.log(`${moment().format(timestampFormat)}: The socket ID ${socket.id} is being kicked from the room "${socket.connectedRoom}".`)
    client.to(socket.id).emit('terminal data', '\r\nThe device has been disconnected from the Aperture server.')
  })
}

// Kick all clients from room
const roomKicksAllClients = function (io, client) {
  io.in(client.connectedRoom).clients((err, clients) => {
    clients.forEach(function (foundClient) {
      var socket = io.sockets.connected[foundClient]
      if (socket.type === 'user') {
        kickSingleClient(io, client, socket)
      }
    })
  })
}

// Deny client from joining requested room
const denyClientToRoom = function (io, client, requestedRoom) {
  io.of('/').adapter.remoteDisconnect(client.id, false, (err) => {
    console.log(`${moment().format(timestampFormat)}: The ${client.type} ${client.apertureClientId} was denied access to the room "${requestedRoom}".`)
  })
}

// Send terminal data from sending client to receiving client
const sendTerminalData = function (client, data) {
  if (client.type === 'user') {
    client.to(client.connectedDeviceSID).emit('terminal data', { terminalData: data, user: client.id })
  } else if (client.type === 'device') {
    client.to(data.user).emit('terminal data', data.terminalData)
  }
}

// Resize the users terminal session on the specified device
const resizeTerminal = function (client, data) {
  client.to(client.connectedDeviceSID).emit('resize terminal', { user: client.id, cols: data.cols, rows: data.rows })
}

// Remove user session on device when user disconnects, or kick all clients in device room when device disconnects
const disconnect = function (io, client) {
  console.log(`${moment().format(timestampFormat)}: The ${client.type} ${client.apertureClientId} (SID: ${client.id}) has disconnected from the server.`)
  if (client.type === 'user' && client.connectedRoom !== undefined) {
    client.to(client.connectedDeviceSID).emit('user left device', client.id)
  } else if (client.type === 'device') {
    roomKicksAllClients(io, client)
    updateDeviceStatus(io, client, client.apertureClientId, false)
  }
}

module.exports = {
  collectRoomList: collectRoomList,
  sendRoomList: sendRoomList,
  clientJoinRoom: clientJoinRoom,
  clientLeaveRoom: clientLeaveRoom,
  kickSingleClient: kickSingleClient,
  roomKicksAllClients: roomKicksAllClients,
  denyClientToRoom: denyClientToRoom,
  sendTerminalData: sendTerminalData,
  resizeTerminal: resizeTerminal,
  disconnect: disconnect
}
