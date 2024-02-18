const socket = io('/')
const videoGrid = document.getElementById('video-grid')
const myVideo = document.createElement('video');
myVideo.muted = true

var peer = new Peer(undefined, {
    path: '/peerjs',
    host: '/',
    port: '3030'
})

let myVideoStream
navigator.mediaDevices.getUserMedia({
    //get an AV stream
    video: true,
    audio: false

    }).then(stream => {
        console.log ("test 1")
        myVideoStream = stream
        addVideoSttream(myVideo, stream)

        peer.on('call', call => {
            console.log("test2")
            call.answer(stream)
            const video = document.createElement('video')
            call.on('stream', userVideoStream => {
                addVideoSttream(video, userVideoStream)
            }) })

        // handle the event of other users connecting
        socket.on('user-connected', (userId) => {
            connectToNewUser(userId, stream)
        })

})

peer.on('open', id => {
    //emit join-room event
    socket.emit('join-room', ROOM_ID, id)
})


const connectToNewUser = (userId, stream) => {
    console.log('new user:', userId)
    const call = peer.call(userId, stream)
    const video = document.createElement('video')
    call.on('stream', userVideoStream => {
        addVideoSttream(video, userVideoStream)
    })
 }


const addVideoSttream = (videoElement, stream) => {
    // Connects a video element to a stream and appends it to the video grid in the HTML
    videoElement.srcObject = stream
    videoElement.addEventListener('loadedmetadata', () => {
        videoElement.play();
    })
   videoGrid.append(videoElement)
}