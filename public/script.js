const socket = io('/');
const videoGrid = document.getElementById('video-grid');
const myVideo = document.createElement('video');
myVideo.muted = true;

const peer = new Peer(undefined, {
    path: '/peerjs',
    host: 'localhost',
    port: '3030'
});

peer.on('open', id => {
    // Emit join-room event
    console.log(`My peer ID is: ${id} and I am joining room ${ROOM_ID}`);
    socket.emit('join-room', ROOM_ID, id);
});

let myVideoStream;

navigator.mediaDevices.getUserMedia({
    // Get an AV stream
    video: true,
    audio: true,
}).then(stream => {
    myVideoStream = stream;
    addVideoStream(myVideo, stream);
    console.log("Local video stream added");

    peer.on('call', call => {
        console.log("Receiving call from: ", call.peer);
        call.answer(stream);
        const video = document.createElement('video');

        // Add the caller's stream to my UI
        call.on('stream', userVideoStream => {
            addVideoStream(video, userVideoStream);
        });
    });

    // Handle the event of other users connecting
    socket.on('user-connected', (userId) => {
        connectToNewUser(userId, stream);
    });

    let text = document.querySelector('input');

    document.querySelector('html').addEventListener('keydown', (e) => {
        if (e.which == 13 && text.value.length !== 0) {
            socket.emit('message', text.value);
            text.value = '';
        }
    });

    socket.on('createMessage', message => {
        document.querySelector('.messages').insertAdjacentHTML('beforeend', `<li class="message"><b>User:</b><br/>${message}</li>`);
        scrollToBottom();
    });
})
.catch(error => {
    console.error("Error accessing media devices.", error);
});

peer.on('error', (err) => {
    console.error('Peer connection error:', err);
});

const connectToNewUser = (userId, stream) => {
    console.log('New user connected:', userId);
    const call = peer.call(userId, stream);
    const video = document.createElement('video');

    // When the stream from the new user is received
    call.on('stream', userVideoStream => {
        addVideoStream(video, userVideoStream);
    });

    // Handle when the call ends
    call.on('close', () => {
        video.remove(); // Remove the video element if the user disconnects
    });
};

const addVideoStream = (videoElement, stream) => {
    // Connects a video element to a stream and appends it to the video grid in the HTML
    videoElement.srcObject = stream;
    videoElement.addEventListener('loadedmetadata', () => {
        videoElement.play();
    });
    videoGrid.append(videoElement);
};

const scrollToBottom = () => {
    const chatWindow = document.querySelector('.main__chat_window');
    chatWindow.scrollTop = chatWindow.scrollHeight;
};

// Mute onclick function
const muteUnmute = () => {
    const enabled = myVideoStream.getAudioTracks()[0].enabled;
    if (enabled) {
        myVideoStream.getAudioTracks()[0].enabled = false;
        setUnmuteButton();
    } else {
        setMuteButton();
        myVideoStream.getAudioTracks()[0].enabled = true;
    }
};

const setUnmuteButton = () => {
    const html = `
        <i class="mute fa-solid fa-microphone-slash"></i>
        <span>Unmute</span>
    `;
    document.querySelector(".main__mute_button").innerHTML = html;
};

const setMuteButton = () => {
    const html = `
        <i class="fa-solid fa-microphone"></i>
        <span>Mute</span>
    `;
    document.querySelector(".main__mute_button").innerHTML = html;
};

const playStop = () => {
    const enabled = myVideoStream.getVideoTracks()[0].enabled;
    if (enabled) {
        myVideoStream.getVideoTracks()[0].enabled = false;
        setPlayVideo();
    } else {
        setStopVideo();
        myVideoStream.getVideoTracks()[0].enabled = true;
    }
};

const setStopVideo = () => {
    const html = `
        <i class="fa-solid fa-video"></i>
        <span>Stop Video</span>
    `;
    document.querySelector(".main__video_button").innerHTML = html;
};

const setPlayVideo = () => {
    const html = `
        <i class="stop fa-solid fa-video-slash"></i>
        <span>Play Video</span>
    `;
    document.querySelector(".main__video_button").innerHTML = html;
};

document.querySelector('.leave_meeting').onclick = () => {
    socket.emit('disconnect'); // You may need to handle this on the server
    window.location.href = '/'; // Redirect to home or another page
};
