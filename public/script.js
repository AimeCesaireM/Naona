const { text } = require("express");

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
    audio: true

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
    let msg = $('input')

    $('html').keydown( (e) => {
        if (e.which == 13 && text.val().length !== 0){
            socket.emit('message', text.val())
            text.val('')
        }
    })

    socket.on('createMessage', message => {
        $('.messages').append(`<li class="message"><b>user</b><br/>${message})</li>`)
        scrollToBottom()
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

const scrollToBottom = () => {
    var d = $('.main__chat_window')
    d.scrollTop(d.prop("scrollHeight")) 
}

//mute onclick function
const muteUnmute = () =>{
    console.log(clicked)
    const enabled = myVideoStream.getAudioTracks()[0].enabled
    if (enabled) {
        myVideoStream.getAudioTracks()[0].enabled = false
        setUnmuteButton()

    } else {
        setMuteButton()
        myVideoStream.getAudioTracks()[0].enabled = true
    }
}

const setUnmuteButton = () => {
    const html = `
        <i class="mute fa-solid fa-microphone-slash"></i>
        <span>Unmute</span>
    `
    document.getElementsByClassName("main__mute_button").innerHTML = html
}

const setMuteButton = () => {
    const html = `
        <i class="fa-solid fa-microphone"></i>
        <span>Mute</span>
    `
    document.getElementsByClassName("main__mute_button").innerHTML = html
}

const playStop = () => {
    let enabled = myVideoStream.getVideoTracks()[0].enabled
    if (enabled){
        myVideoStream.getVideoTracks()[0].enabled = false
        setPlayVideo()
    }
    else {
        setStopVideo()
        myVideoStream.getVideoTracks()[0].enabled = true
    }
}

const setStopVideo = () =>{
    const html = `
        <i class="fa-solid fa-video"></i>
        <span>Stop Video</span>
        `
    document.querySelector(".main__video_button").innerHTML = html
}

const setPlayVideo = () =>{
    const html = `
        <i class="stop fa-solid fa-video-slash"></i>
        <span>Play Video</span>
        `
    document.querySelector(".main__video_button").innerHTML = html
}