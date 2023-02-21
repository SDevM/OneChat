require("dotenv").config()
const { PORT } = process.env
const crypto = require("crypto")
const http = require("http")
const { Server } = require("socket.io")
const { streamToBuffer } = require("./Helpers/aws/converters.helper")
const S3Helper = require("./Helpers/aws/s3.helper")
const httpServer = http.createServer()
httpServer.listen(PORT)
const ioSocketServer = new Server(httpServer, { maxHttpBufferSize: 5e8 })

const msgs = [
  {
    id: "0",
    owner: "System",
    content:
      "Welcome to Anonychat! You may speak here in the general chat, or find an online user to DM.",
  },
]
const clients = new Map()
const rooms = new Map()
const names = new Set()

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

  socket.on("online", async () => {
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

  socket.on("name", async (name) => {
    if (
      names.has(String(name).toUpperCase()) ||
      String(name).toUpperCase() == "SYSTEM"
    ) {
      socket.emit("NAMETAKEN")
      return
    } else if (String(name).toUpperCase() != "ANON") {
      names.delete(String(metadata.name).toUpperCase())
      names.add(String(name).toUpperCase())
    }
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

  socket.on("message", async (msg, img) => {
    let imgB64
    if (img) {
      let key = `${metadata.id}_${Date.now().toString(16)}`
      const upload = await S3Helper.upload(Buffer.from(img), key).catch(
        (err) => {
          console.log(err)
          socket.emit("UPLOADFAIL")
        }
      )
      if (upload)
        // Fix the file download + send to client
        imgB64 = await S3Helper.download(key).catch(() => {
          console.log(err)
          socket.emit("UPLOADFAIL")
        })
      imgB64 = imgB64.Body.toString("base64")
    }
    const new_msg = {
      id: metadata.id,
      owner: metadata.name,
      content: msg,
      image: imgB64,
    }
    msgs.push(new_msg)
    ;[...clients.values()].forEach((client) => client.socket.send(new_msg))
  })

  socket.on("loadDm", async (id) => {
    let sortedIDs = [metadata.id, id].sort()
    let concat = sortedIDs[0] + sortedIDs[1]
    socket.join(concat)
    socket.emit("loadDm", rooms.get(concat) || [])
    metadata.dms.push(concat)
  })

  socket.on("leaveDm", async (id) => {
    let sortedIDs = [metadata.id, id].sort()
    let concat = sortedIDs[0] + sortedIDs[1]
    socket.leave(concat)
  })

  socket.on("directMessage", async (dmdata) => {
    let sortedIDs = [metadata.id, dmdata.id].sort()
    let concat = sortedIDs[0] + sortedIDs[1]
    if (!rooms.get(concat)) rooms.set(concat, [])
    let msg = {
      id: metadata.id,
      owner: metadata.name,
      content: dmdata.text,
    }
    rooms.get(concat).push(msg)
    ioSocketServer.to(concat).emit("directMessage", msg, metadata.id)
  })

  socket.on("close", async () => {
    clients.delete(metadata.id)
    names.delete(String(metadata.name).toUpperCase())

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
  socket.on("disconnect", async () => {
    clients.delete(metadata.id)
    names.delete(String(metadata.name).toUpperCase())

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
