// lib/socket.ts
import type { Server } from 'socket.io'

let io: Server

export const setupSocketIO = (ioInstance: Server) => {
  io = ioInstance

  io.on('connection', socket => {
    console.log('🟢 Socket connected:', socket.id)

    socket.on('disconnect', () => {
      console.log('🔴 Socket disconnected:', socket.id)
    })
  })
}

export const getIO = () => {
  if (!io) throw new Error("Socket.IO not initialized")
  return io
}
