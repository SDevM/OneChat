require("dotenv").config()
const { PORT } = process.env
const http = require("http")
const { Server } = require("socket.io")
const httpServer = http.createServer()
httpServer.listen(PORT)
const ioSocketServer = new Server(httpServer)

const msgs = []
const clients = new Map()

if (ioSocketServer) console.log("Socket Server Operational")

ioSocketServer.on("connection", (socket) => {
  console.log(`New conneciton: ${socket.handshake.address}`)
  const metadata = {
    id: crypto.randomUUID(),
    socket: socket,
    name: "random",
  }
  clients.set(crypto.randomUUID(), socket)
  socket.emit("backlog", msgs)

  socket.on("name", (name) => (metadata.name = name))

  socket.on("message", (msg) => {
    const new_msg = {
      id: metadata.id,
      owner: metadata.name,
      content: msg,
    }
    msgs.push(new_msg)
    clients.forEach((client, id) => id == metadata.id || client.send(new_msg))
  })

  socket.on("close", () => {
    clients.delete(metadata.id)
  })
})
