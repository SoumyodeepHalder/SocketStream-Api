const mongoose = require('mongoose');

const ChatroomsSchema = new mongoose.Schema({
    roomid: {
        type: String,
        required: true
    },
    participants:[{
        type: String,
        required: true
    }]
});

module.exports = mongoose.model('chatrooms', ChatroomsSchema);
