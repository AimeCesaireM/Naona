const exp = require('constants')
const express = require ('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)

const {v4: uuidv4} = require('uuid')
app.set('view engine', 'ejs')

app.use(express.static('public'))


app.get('/', (req, res) => {
    res.redirect(`/${uuidv4()}`)
})

app.get('/:room', (req, res) => {
    res.render('room', {roomId: req.params.room})
})

// handler for (implied) join-room event 
io.on('connection', socket => {
    socket.on('join-room', (roomId) => {
        socket.join(roomId)
        socket.broadcast.to(roomId).emit('user-connected')
    })
})




server.listen(3030) // localhost port
