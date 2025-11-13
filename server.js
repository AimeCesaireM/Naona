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

const peerServer = ExpressPeerServer(server, {
    path: '/peerjs',
    debug: true
});

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(peerServer);

// Route to create and redirect to a new room
app.get('/create', (_req, res) => {
    const roomId = uuidv4();
    res.redirect(`/room/${roomId}`);
});

// Redirect root requests to a freshly created room
app.get('/', (_req, res) => {
    res.redirect('/create');
});

// Route to join an existing room
app.get('/room/:roomId', (req, res) => {
    res.render('room', { roomId: req.params.roomId });
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
            io.to(roomId).emit('createMessage', {
                userId,
                message,
                timestamp: Date.now()
            });
        });

        socket.on('leave-room', () => {
            console.log(`User ${userId} left room: ${roomId}`);
            socket.leave(roomId);
            socket.broadcast.to(roomId).emit('user-disconnected', userId);
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
