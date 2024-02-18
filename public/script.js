const videoGrid = document.getElementById('video-grid')
const myVideo = document.createElement('video');
myVideo.muted = true


let myVideoStream
navigator.mediaDevices.getUserMedia({
    //get an AV stream
    video: true,
    audio: true

}).then(stream => {
    myVideoStream = stream
    addVideoSttream(myVideo, stream)

})


const addVideoSttream = (videoElement, stream) => {
    // Connects a video element to a stream and appends it to the video grid in the HTML
    videoElement.srcObject = stream
    videoElement.addEventListener('loadedmetadata', () => {
        videoElement.play();
    })
   videoGrid.append(videoElement)
}