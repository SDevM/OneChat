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

if (ioSocketServer) console.log("Socket Server Operational")

ioSocketServer.on("connection", (socket) => {
  console.log(`New connection: ${socket.handshake.address}`)

  const metadata = {
    id: crypto.randomUUID(),
    socket: socket,
    name: "random",
  }
  socket.emit("backlog", msgs)

  socket.on("online", () => {
    let subclients = []
    ;[...clients.entries()].forEach((clientPair) =>
      subclients.push(clientPair[1].name)
    )
    ;[...clients.values()].forEach((client) =>
      client.socket.emit("online", subclients)
    )
  })

  socket.on("name", (name) => {
    metadata.name = name
    clients.set(metadata.id, { name, socket })
    let subclients = []
    ;[...clients.entries()].forEach((clientPair) =>
      subclients.push(clientPair[1].name)
    )
    ;[...clients.values()].forEach((client) =>
      client.socket.emit("online", subclients)
    )
  })

  socket.on("message", (msg) => {
    const new_msg = {
      id: metadata.id,
      owner: metadata.name,
      content: msg,
    }
    msgs.push(new_msg)
    clients.forEach((client) => client.send(new_msg))
  })

  socket.on("close", () => {
    clients.delete(metadata.id)
    let subclients = []
    ;[...clients.entries()].forEach((clientPair) =>
      subclients.push(clientPair[1].name)
    )
    ;[...clients.values()].forEach((client) =>
      client.socket.emit("online", subclients)
    )
  })
  socket.on("disconnect", () => {
    clients.delete(metadata.id)
    let subclients = []
    ;[...clients.entries()].forEach((clientPair) =>
      subclients.push(clientPair[1].name)
    )
    ;[...clients.values()].forEach((client) =>
      client.socket.emit("online", subclients)
    )
  })
})
