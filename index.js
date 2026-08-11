const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const Chatrooms = require('./models/Chatrooms');
const Messages = require('./models/Messages');
const Users = require('./models/Users');

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
async function getRoomId (user1Id, user2Id, context){
    let chatroom = await Chatrooms.findOne({
        participants: {
            $all: [user1Id, user2Id],
            $size: 2
        }
    });
    
    // If room doesn't exist, create it dynamically
    if (!chatroom && context==='private_message') {
        console.log('7. roomid doesnt exist so crating one')
        const newRoomId = await generateId();
        console.log('8. created roomid: ', newRoomId)
        chatroom = new Chatrooms({
            roomid: newRoomId,
            participants: [user1Id, user2Id]
        });
        await chatroom.save();
        console.log('9. saved the new roomid: ', chatroom);
    }

    console.log("4. roomid fetched: ", chatroom ? chatroom.roomid : null, 'with context', context);

    return chatroom ? chatroom.roomid : null;
};

async function getAllMessage (roomid){
    if (!roomid) return [];
    const messages1=await Messages.find({ roomid: roomid })
    console.log('14. fetched messages: ', messages1.length);
    return messages1;
}

async function uploadMessage(sender, roomid, message){
    const newMessage = new Messages({
        sender: sender,
        roomid: roomid,
        message: message
    });
    console.log('10. uploading message: ', newMessage);
    return await newMessage.save();
}

async function getAllUsers(){
    return await Users.distinct('username');
}

async function generateId() {
    const { v4: uuidv4 } = await import('uuid');
    const id = uuidv4();
    return id;
  }











// SOCKET.IO CODE 
const connectedUsers = new Map();

io.on('connection', (socket) => {
    //consele.log(`⚡ New visual device connected: ${socket.id}`);


    socket.on('register_user', async(username) => {
        if (username && username.trim() !== '') {
            // console.log("1. in server register_user: ", username);
            if (!connectedUsers.has(username)) {
                connectedUsers.set(username, new Set());
            }
            connectedUsers.get(username).add(socket.id);
            socket.username = username;
    
            console.log(`1. 👤 Active User mapped: ${username} -> ${socket.id}`);

            const allUsers=await getAllUsers();

            console.log('2. sending list of all users online_user: ', allUsers);
            
            // Send current list of online users to everyone
            io.emit('online_users', allUsers);
        }
    });

    socket.on('chat-history', async(currentRecipient) =>{
        if (!socket.username) return;
        
        console.log("3. fetching chat-history of: ", socket.username, currentRecipient);
        if (socket.username !== currentRecipient) {
            const roomid = await getRoomId(socket.username, currentRecipient, 'chat_history');
            if(roomid){
                const allMessages = await getAllMessage(roomid);
                socket.emit('chat-history', allMessages);
                console.log('16. sent all messages');
            }
            else{
                console.log('5. sending null as chat-history: ',roomid);
                socket.emit('chat-history', roomid)
            }
        }
    })


    socket.on('private_message', async({sender, recipient, message }) => {
        console.log('6. received private message: ',sender, message, 'to ', recipient)
        if (!socket.username || !recipient) return;


        // Automatically gets existing ID or creates a new one safely
        const roomid = await getRoomId(socket.username, recipient, 'private_message');
        await uploadMessage(socket.username, roomid, message);
        // console.log('14. uploaded message: ', message);
        
        // Safely check if recipient is online before emitting
        const recipientSockets = connectedUsers.get(recipient);
        console.log('11. recipient socket: ', recipientSockets, 'recipient: ', recipient)
        if (recipientSockets && recipientSockets.size > 0) {
            const primarySocketId = Array.from(recipientSockets)[0];
            io.to(primarySocketId).emit('receive_message', {
                sender: socket.username, 
                message: message
            });
            console.log('16. sent priavate message to: ', recipientSockets)
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
            // io.emit('online_users', Array.from(connectedUsers.keys()));
        }
    });
});


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 QuickChat Core Server initialized on http://localhost:${PORT}`);
});
