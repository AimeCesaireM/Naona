const express = require('express');
const { ExpressPeerServer } = require('peer');
const http = require('http');
const { v4: uuidv4 } = require('uuid'); // Import the uuid package

const app = express();
const server = http.createServer(app);

const io = require('socket.io')(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["my-custom-header"],
        credentials: true
    }
});

const roomId = "Main";

const peerServer = ExpressPeerServer(server, {
    path: '/peerjs',
    debug: true
});

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use('/peerjs', peerServer);

// Route to create and redirect to a new room
app.get('/create', (req, res) => {
    // const roomId = uuidv4(); // Generate a new room ID
    res.redirect(`/${roomId}`); // Redirect to the newly created room
});

// Route to join an existing room
app.get('/', (req, res) => {
    res.render('room', { roomId: req.params.room }); // Render the room with the provided room ID
});

// Socket.io connection
io.on('connection', socket => {
    console.log('a user connected');

    socket.on('join-room', (roomId, userId) => {
        console.log(`User ${userId} joined room: ${roomId}`);
        socket.join(roomId);
        socket.broadcast.to(roomId).emit('user-connected', userId);

        socket.on('message', message => {
            console.log(`Message from ${userId}: ${message}`);
            io.to(roomId).emit('createMessage', message);
        });

        // Handle user disconnection
        socket.on('disconnect', () => {
            console.log(`User ${userId} disconnected from room: ${roomId}`);
            socket.broadcast.to(roomId).emit('user-disconnected', userId);
        });
    });
});

// Start the server
const PORT = process.env.PORT || 3030;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
