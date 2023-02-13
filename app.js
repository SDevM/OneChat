require("dotenv").config()
const { PORT } = process.env
const crypto = require("crypto")
const express = require("express")()
const http = require("http")
const { Server } = require("socket.io")
const httpServer = http.createServer(express)
httpServer.listen(PORT)
const ioSocketServer = new Server(httpServer)

const msgs = []
const clients = new Map()

if (ioSocketServer) console.log("Socket Server Operational")

express.get("/")

ioSocketServer.on("connection", (socket) => {
  // console.log(`New conneciton: ${socket.handshake.address}`)
  const metadata = {
    id: crypto.randomUUID(),
    socket: socket,
    name: "random",
  }
  clients.set(crypto.randomUUID(), socket)
  socket.emit("backlog", { stack: msgs, me: metadata.id })

  socket.on("name", (name) => (metadata.name = name))

  socket.on("message", (msg) => {
    const new_msg = {
      id: metadata.id,
      owner: metadata.name,
      content: msg,
    }
    msgs.push(new_msg)
    clients.forEach((client, id) => client.send(new_msg))
  })

  socket.on("close", () => {
    clients.delete(metadata.id)
  })
})
