const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const Chatrooms = require('./models/Chatrooms');
const Messages = require('./models/Messages');
const Users = require('./models/Users');
const { v4: uuidv4 } = require('uuid');
// const roomID = uuidv4(); // Generates e.g., "1b9d6bcd-bbfd-4b2d-9b5d-ab0dfbbd4bed"

require("node:dns/promises").setServers(["1.1.1.1", "8.8.8.8"]);

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});


// MIDDLEWARE
app.use(express.json());


// MONGOOSE CODE
mongoose.connect("mongodb+srv://soumyodeep2:soumyodeep2@cluster0.d7uxyws.mongodb.net/sample_mflix")
    .then(() => console.log('Successfully connected to MongoDB Database.'))
    .catch((error) => console.error('Database connection error:', error.message));















// FUNCTIONS
async function getRoomId (user1Id, user2Id){
    let chatroom = await Chatrooms.findOne({
        participants: {
            $all: [user1Id, user2Id],
            $size: 2
        }
    });
    
    // If room doesn't exist, create it dynamically
    if (!chatroom && user1Id && user2Id) {
        const newRoomId = uuidv4();
        chatroom = new Chatrooms({
            roomid: newRoomId,
            participants: [user1Id, user2Id]
        });
        await chatroom.save();
    }
    
    return chatroom ? chatroom.roomid : null;
};

async function getAllMessage (roomid){
    if (!roomid) return [];
    return await Messages.find({ roomid: roomid }).sort({ createdAt: 1 });
}

async function uploadMessage(sender, roomid, message){
    const newMessage = new Messages({
        sender: sender,
        roomid: roomid,
        message: message
    });
    return await newMessage.save();
}

async function getAllUsers(){
    return await Users.distinct('username');
}

async function getRandomId(){
    return uuidv4();
}











// SOCKET.IO CODE 
const connectedUsers = new Map();

io.on('connection', (socket) => {
    //consele.log(`⚡ New visual device connected: ${socket.id}`);


    socket.on('register_user', async(username) => {
        if (username && username.trim() !== '') {
            // console.log("register_user:", username);
            if (!connectedUsers.has(username)) {
                connectedUsers.set(username, new Set());
            }
            connectedUsers.get(username).add(socket.id);
            socket.username = username;
    
            console.log(`👤 Active User mapped: ${username} -> ${socket.id}`);
            
            // Send current list of online users to everyone
            io.emit('online_users', Array.from(connectedUsers.keys()));
        }
    });

    socket.on('chat-history', async(currentRecipient) =>{
        if (!socket.username) return;
        
        // console.log("chat-history", socket.username, currentRecipient);
        if (socket.username !== currentRecipient) {
            const roomid = await getRoomId(socket.username, currentRecipient);
            // console.log("Room ID fetched/created:", roomid);
            const allMessages = await getAllMessage(roomid);
            socket.emit('chat-history', allMessages);
        }
    })


    socket.on('private_message', async({ recipient, message }) => {
        if (!socket.username || !recipient) return;

        // Automatically gets existing ID or creates a new one safely
        const roomid = await getRoomId(socket.username, recipient);
        await uploadMessage(socket.username, roomid, message);
        
        // Safely check if recipient is online before emitting
        const recipientSockets = connectedUsers.get(recipient);
        if (recipientSockets && recipientSockets.size > 0) {
            const primarySocketId = Array.from(recipientSockets)[0];
            io.to(primarySocketId).emit('receive_message', {
                sender: socket.username, 
                message: message
            });
        }
    });


    socket.on('disconnect', () => {
        if (socket.username) {
            const userSockets = connectedUsers.get(socket.username);
            if (userSockets) {
                userSockets.delete(socket.id);
                if (userSockets.size === 0) {
                    connectedUsers.delete(socket.username);
                }
            }
            console.log(`❌ User disconnected: ${socket.username}`);
            io.emit('online_users', Array.from(connectedUsers.keys()));
        }
    });
});


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 QuickChat Core Server initialized on http://localhost:${PORT}`);
});
