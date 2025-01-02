# Naona - Video Conferencing App

**Naona** is a real-time video conferencing application built with **WebRTC**, **PeerJS**, **Socket.IO**, and **Express**. It allows users to join video call rooms, send text messages, and control their video and audio streams during calls. The app is designed to be simple, scalable, and easy to use for both developers and users.

## 🚀 Features

- **Real-Time Video and Audio Communication**: Peer-to-peer communication using WebRTC and PeerJS.
- **Room Management**: Users can join existing rooms or create new ones.
- **Chat Functionality**: In-app messaging during video calls.
- **Mute/Unmute Audio & Video**: Control your audio and video streams during the call.
- **Responsive UI**: The interface is designed for both desktop and mobile devices.
- **Security**: Basic features to manage participants and meeting security.

## 💻 Technologies Used

- **Node.js**: Backend runtime for the app.
- **Express**: Web framework for building the server.
- **PeerJS**: Library for managing peer-to-peer connections.
- **Socket.IO**: Real-time communication for events such as joining a room and sending messages.
- **WebRTC**: For real-time audio and video communication.
- **EJS**: Embedded JavaScript templates for rendering HTML views.
- **HTML/CSS**: For building the front-end user interface.
- **FontAwesome**: For icons in the UI.
- **jQuery**: For handling user interactions and DOM manipulations.

## 🌱 Installation

To run the app locally, follow the steps below:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/naona.git
   cd naona
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the server**:
   ```bash
   npm start
   ```

4. Open your browser and go to [http://localhost:3030](http://localhost:3030).

## 🛠️ How It Works

1. **Creating a Room**:  
   When you visit the app, you can create a new room by clicking a button that generates a unique room ID. You will be redirected to that room where you can start a video call.

2. **Joining a Room**:  
   You can also join an existing room by entering its room ID. Upon joining, your video and audio streams are broadcast to other participants.

3. **Peer-to-Peer Video Call**:  
   The app uses PeerJS to establish peer-to-peer connections between users. Each participant in the room is assigned a unique peer ID, and the connection is made directly to other peers, ensuring minimal latency.

4. **Chat Functionality**:  
   While in a call, you can send text messages to other participants. Messages are broadcast to all users in the same room using Socket.IO.

5. **Control Audio/Video**:  
   You can mute/unmute your microphone and stop/start your video feed by clicking the respective buttons.

6. **Leave the Meeting**:  
   When you're done, you can leave the meeting, which will disconnect your peer connection and return you to the home screen.

## 📱 Usage

1. **Mute/Unmute Audio**:  
   Click the microphone button to mute or unmute your audio during the call.

2. **Stop/Play Video**:  
   Click the video camera button to stop or start your video feed.

3. **Send Messages**:  
   Type messages in the input box and press Enter to send them. Messages are displayed in the chat window.

4. **Leave the Meeting**:  
   Click the "Leave Meeting" button to exit the call and return to the homepage.

## 🔧 Customization

To customize the app, you can:

- Modify the **UI components** in the `room.ejs` and `style.css` files.
- Change the **server configuration** in `server.js` for different behaviors (e.g., adding authentication or more complex room management).
- Add additional **features** like screen sharing, participant muting, or more advanced security controls.

## 🐛 Known Issues

- **No authentication**: The app currently does not have any user authentication or room protection mechanisms. Anyone with a room ID can join a room.
- **Mobile device limitations**: Although the app is responsive, mobile users may experience occasional performance issues with video streams depending on their device and network connection.

## 🤝 Contributing

Contributions are welcome! If you'd like to contribute to the development of this app, feel free to fork the repository and submit a pull request. Please follow these guidelines:

1. Fork the repository
2. Create a new branch (`git checkout -b feature-name`)
3. Commit your changes (`git commit -am 'Add feature'`)
4. Push to the branch (`git push origin feature-name`)
5. Submit a pull request

## 📄 License

This project is licensed under the [MIT License](LICENSE).
