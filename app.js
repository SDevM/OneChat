require("dotenv").config()
const { PORT } = process.env
const crypto = require("crypto")
const http = require("http")
const { Server } = require("socket.io")
const httpServer = http.createServer()
httpServer.listen(PORT)
const ioSocketServer = new Server(httpServer)

const msgs = []
const clients = new Map()
const rooms = new Map()

if (ioSocketServer) console.log("Socket Server Operational")

ioSocketServer.on("connection", (socket) => {
  console.log(`New connection: ${socket.handshake.address}`)

  const metadata = {
    id: crypto.randomUUID(),
    socket: socket,
    name: "random",
    dms: [],
  }
  socket.emit("backlog", msgs)

  socket.on("online", () => {
    let subclients = []
    ;[...clients.entries()].forEach((clientPair) =>
      subclients.push({ name: clientPair[1].name, id: clientPair[0] })
    )
    ;[...clients.entries()].forEach((client) =>
      client[1].socket.emit(
        "online",
        subclients.filter((subclient) => subclient.id != client[0])
      )
    )
  })

  socket.on("name", (name) => {
    metadata.name = name
    clients.set(metadata.id, { name, socket })
    let subclients = []
    ;[...clients.entries()].forEach((clientPair) =>
      subclients.push({ name: clientPair[1].name, id: clientPair[0] })
    )
    ;[...clients.entries()].forEach((client) =>
      client[1].socket.emit(
        "online",
        subclients.filter((subclient) => subclient.id != client[0])
      )
    )
  })

  socket.on("message", (msg) => {
    const new_msg = {
      id: metadata.id,
      owner: metadata.name,
      content: msg,
    }
    msgs.push(new_msg)
    ;[...clients.values()].forEach((client) => client.socket.send(new_msg))
  })

  socket.on("loadDm", (id) => {
    let sortedIDs = [metadata.id, id].sort()
    let concat = sortedIDs[0] + sortedIDs[1]
    socket.emit("loadDm", rooms.get(concat) || [])
    metadata.dms.push(concat)
  })

  socket.on("directMessage", (dmdata) => {
    let sortedIDs = [metadata.id, dmdata.id].sort()
    let concat = sortedIDs[0] + sortedIDs[1]
    if (!rooms.get(concat)) rooms.set(concat, [])
    let msg = {
      id: metadata.id,
      owner: metadata.name,
      content: dmdata.text,
    }
    rooms.get(concat).push(msg)
    socket.emit("directMessage", msg, metadata.id)
    clients.get(dmdata.id).socket.emit("directMessage", msg, metadata.id)
  })

  socket.on("close", () => {
    clients.delete(metadata.id)
    metadata.dms.forEach((room) => {
      rooms.delete(room)
    })
    let subclients = []
    ;[...clients.entries()].forEach((clientPair) =>
      subclients.push({ name: clientPair[1].name, id: clientPair[0] })
    )
    ;[...clients.entries()].forEach((client) =>
      client[1].socket.emit(
        "online",
        subclients.filter((subclient) => subclient.id != client[0])
      )
    )
  })
  socket.on("disconnect", () => {
    clients.delete(metadata.id)
    metadata.dms.forEach((room) => {
      rooms.delete(room)
    })
    let subclients = []
    ;[...clients.entries()].forEach((clientPair) =>
      subclients.push({ name: clientPair[1].name, id: clientPair[0] })
    )
    ;[...clients.entries()].forEach((client) =>
      client[1].socket.emit(
        "online",
        subclients.filter((subclient) => subclient.id != client[0])
      )
    )
  })
})
