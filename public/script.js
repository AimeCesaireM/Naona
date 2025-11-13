(() => {
    const { dataset } = document.body;
    const roomId = dataset.roomId;

    if (!roomId) {
        console.error('Room ID missing from document. Aborting initialisation.');
        return;
    }

    const socket = io();
    const peers = {};
    const videoTiles = new Map();
    const participants = new Set(['local']);
    const state = {
        localStream: null,
        localId: null,
        hasJoined: false,
        hasLeft: false,
        activeVideoDeviceId: null,
        preferredFacingMode: 'user',
        videoDevices: []
    };

    const videoGrid = document.getElementById('video-grid');
    const stagePlaceholder = document.getElementById('stage-placeholder');
    const connectionStatus = document.getElementById('connection-status');
    const participantCount = document.getElementById('participant-count');
    const copyLinkButton = document.getElementById('copy-link');
    const leaveButton = document.querySelector('.leave_meeting');
    const switchCameraButton = document.getElementById('switch-camera');
    const toggleAudioButton = document.getElementById('toggle-audio');
    const toggleVideoButton = document.getElementById('toggle-video');
    const messageList = document.getElementById('chat-messages');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('chat_message');
    const sendButton = messageForm ? messageForm.querySelector('button[type="submit"]') : null;

    if (messageInput) {
        messageInput.disabled = true;
        messageInput.placeholder = 'Connecting to room…';
    }
    if (sendButton) {
        sendButton.disabled = true;
    }
    if (switchCameraButton) {
        switchCameraButton.disabled = true;
        switchCameraButton.classList.add('control-button--disabled');
    }

    const updateConnectionStatus = (label, variant = 'neutral') => {
        if (!connectionStatus) return;
        const classes = ['status-pill'];
        if (variant) {
            classes.push(`status-pill--${variant}`);
        }
        connectionStatus.className = classes.join(' ');
        connectionStatus.textContent = label;
    };

    const updateParticipantBadge = () => {
        if (!participantCount) return;
        const count = Math.max(1, participants.size);
        const noun = count === 1 ? 'person' : 'people';
        participantCount.textContent = `${count} ${noun} online`;
    };

    const toggleStagePlaceholder = () => {
        if (!stagePlaceholder) return;
        const showPlaceholder = videoTiles.size <= 1;
        stagePlaceholder.classList.toggle('hidden', !showPlaceholder);
    };

    const createVideoTile = ({ label, isLocal = false }) => {
        const container = document.createElement('article');
        container.className = 'video-tile';
        container.setAttribute('role', 'listitem');

        const video = document.createElement('video');
        video.className = 'video-tile__video';
        video.playsInline = true;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.autoplay = true;
        video.setAttribute('autoplay', 'true');
        if (isLocal) {
            video.muted = true;
            video.classList.add('video-tile__video--mirror');
        }

        const badge = document.createElement('span');
        badge.className = 'video-tile__label';
        badge.textContent = label;

        container.appendChild(video);
        container.appendChild(badge);

        if (videoGrid) {
            const insertBefore = stagePlaceholder && stagePlaceholder.parentElement === videoGrid ? stagePlaceholder : null;
            if (insertBefore) {
                videoGrid.insertBefore(container, insertBefore);
            } else {
                videoGrid.appendChild(container);
            }
        }

        return { container, video, badge };
    };

    const attachStream = (tile, stream) => {
        if (!tile?.video) return;
        tile.video.srcObject = stream;
        const playVideo = () => {
            const promise = tile.video.play();
            if (promise && promise.catch) {
                promise.catch(() => {});
            }
        };

        if (tile.video.readyState >= 2) {
            playVideo();
        } else {
            tile.video.addEventListener('loadedmetadata', playVideo, { once: true });
        }
    };

    const registerTile = (id, tile) => {
        videoTiles.set(id, tile);
        toggleStagePlaceholder();
    };

    const removeTile = id => {
        const tile = videoTiles.get(id);
        if (!tile) return;
        tile.container.remove();
        videoTiles.delete(id);
        toggleStagePlaceholder();
    };

    const ensureRemoteTile = (userId, label = 'Guest') => {
        let tile = videoTiles.get(userId);
        if (!tile) {
            tile = createVideoTile({ label });
            registerTile(userId, tile);
        }
        return tile;
    };

    const updateSwitchCameraAvailability = () => {
        if (!switchCameraButton) return;
        const supportsFacingMode = Boolean(navigator.mediaDevices?.getSupportedConstraints?.().facingMode);
        const hasActiveVideo = Boolean(state.localStream?.getVideoTracks?.()?.length);
        const hasMultipleDevices = state.videoDevices.length > 1;
        const canToggle = hasActiveVideo && (hasMultipleDevices || supportsFacingMode);
        switchCameraButton.disabled = !canToggle;
        switchCameraButton.classList.toggle('control-button--disabled', !canToggle);
    };

    const syncActiveVideoMeta = videoTrack => {
        if (!videoTrack) return;
        const settings = videoTrack.getSettings ? videoTrack.getSettings() : {};
        if (settings.deviceId) {
            state.activeVideoDeviceId = settings.deviceId;
        } else if (videoTrack.label && state.videoDevices.length) {
            const match = state.videoDevices.find(device => device.label === videoTrack.label);
            if (match) {
                state.activeVideoDeviceId = match.deviceId;
            }
        }
        if (settings.facingMode) {
            state.preferredFacingMode = settings.facingMode;
        } else if (videoTrack.label) {
            if (/back|rear|environment/i.test(videoTrack.label)) {
                state.preferredFacingMode = 'environment';
            } else if (/front|user/i.test(videoTrack.label)) {
                state.preferredFacingMode = 'user';
            }
        }
    };

    const refreshVideoDevices = async currentVideoTrack => {
        if (!navigator.mediaDevices?.enumerateDevices) {
            state.videoDevices = [];
            updateSwitchCameraAvailability();
            return;
        }

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            state.videoDevices = devices.filter(device => device.kind === 'videoinput');
            syncActiveVideoMeta(currentVideoTrack);
        } catch (error) {
            console.warn('Unable to enumerate media devices', error);
        } finally {
            updateSwitchCameraAvailability();
        }
    };

    const escapeHtml = text =>
        String(text).replace(/[&<>"']/g, char => {
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            };
            return map[char] || char;
        });

    const timeFormatter = new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit'
    });

    const addMessage = ({ author, text, timestamp, isSelf }) => {
        if (!messageList) return;
        const item = document.createElement('li');
        item.className = 'message';
        if (isSelf) {
            item.classList.add('message--self');
        }

        const meta = document.createElement('div');
        meta.className = 'message__meta';

        const authorSpan = document.createElement('span');
        authorSpan.className = 'message__author';
        authorSpan.textContent = author;

        const timeEl = document.createElement('time');
        timeEl.className = 'message__time';
        const date = timestamp ? new Date(timestamp) : new Date();
        timeEl.dateTime = date.toISOString();
        timeEl.textContent = timeFormatter.format(date);

        meta.appendChild(authorSpan);
        meta.appendChild(timeEl);

        const body = document.createElement('p');
        body.className = 'message__body';
        body.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');

        item.appendChild(meta);
        item.appendChild(body);
        messageList.appendChild(item);

        if (messageList.scrollTo) {
            messageList.scrollTo({
                top: messageList.scrollHeight,
                behavior: 'smooth'
            });
        } else {
            messageList.scrollTop = messageList.scrollHeight;
        }
    };

    const setAudioState = enabled => {
        if (!toggleAudioButton) return;
        toggleAudioButton.classList.toggle('control-button--off', !enabled);
        toggleAudioButton.classList.toggle('control-button--active', Boolean(enabled));
        const icon = toggleAudioButton.querySelector('i');
        const label = toggleAudioButton.querySelector('.control-button__label');
        if (icon) {
            icon.className = enabled ? 'fa-solid fa-microphone' : 'fa-solid fa-microphone-slash';
        }
        if (label) {
            label.textContent = enabled ? 'Mute' : 'Unmute';
        }
    };

    const setVideoState = enabled => {
        if (!toggleVideoButton) return;
        toggleVideoButton.classList.toggle('control-button--off', !enabled);
        toggleVideoButton.classList.toggle('control-button--active', Boolean(enabled));
        const icon = toggleVideoButton.querySelector('i');
        const label = toggleVideoButton.querySelector('.control-button__label');
        if (icon) {
            icon.className = enabled ? 'fa-solid fa-video' : 'fa-solid fa-video-slash';
        }
        if (label) {
            label.textContent = enabled ? 'Stop Video' : 'Start Video';
        }
    };

    const buildVideoConstraints = (overrides = {}) => {
        const baseConstraints = {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
        };

        if (overrides.deviceId) {
            return {
                ...baseConstraints,
                deviceId: { exact: overrides.deviceId }
            };
        }

        if (overrides.facingMode) {
            return {
                ...baseConstraints,
                facingMode: { exact: overrides.facingMode }
            };
        }

        if (state.activeVideoDeviceId) {
            return {
                ...baseConstraints,
                deviceId: { exact: state.activeVideoDeviceId }
            };
        }

        if (state.preferredFacingMode) {
            return {
                ...baseConstraints,
                facingMode: { ideal: state.preferredFacingMode }
            };
        }

        return baseConstraints;
    };

    const replaceLocalVideoTrack = newVideoTrack => {
        if (!newVideoTrack) {
            return;
        }

        const existingVideoTracks = state.localStream?.getVideoTracks() ?? [];
        const videoWasEnabled = existingVideoTracks.length ? existingVideoTracks[0].enabled : true;

        if (!state.localStream) {
            state.localStream = new MediaStream([newVideoTrack]);
        } else {
            existingVideoTracks.forEach(track => {
                state.localStream.removeTrack(track);
                track.stop();
            });
            state.localStream.addTrack(newVideoTrack);
        }

        newVideoTrack.enabled = videoWasEnabled;

        if (localTile) {
            attachStream(localTile, state.localStream);
        }

        Object.values(peers).forEach(call => {
            const sender = call.peerConnection?.getSenders?.().find(sender => sender.track && sender.track.kind === 'video');
            if (sender) {
                sender.replaceTrack(newVideoTrack).catch(error => {
                    console.warn('Unable to replace outbound video track', error);
                });
            }
        });

        setVideoState(newVideoTrack.enabled);
    };

    const disableControl = (button, labelText) => {
        if (!button) return;
        button.disabled = true;
        button.classList.add('control-button--disabled');
        button.classList.remove('control-button--active', 'control-button--off');
        const label = button.querySelector('.control-button__label');
        if (label && labelText) {
            label.textContent = labelText;
        }
    };

    const enableControl = button => {
        if (!button) return;
        button.disabled = false;
        button.classList.remove('control-button--disabled');
    };

    const copyLabel = copyLinkButton ? copyLinkButton.querySelector('.btn__label') : null;
    const copyLabelDefault = copyLabel ? copyLabel.textContent : '';

    const showCopyFeedback = (message, isError = false) => {
        if (!copyLinkButton || !copyLabel) return;
        copyLinkButton.classList.remove('btn--success', 'btn--danger');
        copyLinkButton.classList.add(isError ? 'btn--danger' : 'btn--success');
        copyLabel.textContent = message;
        window.setTimeout(() => {
            copyLinkButton.classList.remove('btn--success', 'btn--danger');
            copyLabel.textContent = copyLabelDefault;
        }, 1800);
    };

    const fallbackCopyToClipboard = text => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '-1000px';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showCopyFeedback('Link copied!');
        } catch (err) {
            console.warn('Fallback copy failed', err);
            showCopyFeedback('Copy failed', true);
        } finally {
            document.body.removeChild(textarea);
        }
    };

    copyLinkButton?.addEventListener('click', async () => {
        const url = window.location.href;
        if (navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(url);
                showCopyFeedback('Link copied!');
                return;
            } catch (error) {
                console.warn('Clipboard API copy failed', error);
            }
        }
        fallbackCopyToClipboard(url);
    });

    const leaveRoom = () => {
        if (state.hasLeft) return;
        state.hasLeft = true;

        if (state.hasJoined) {
            socket.emit('leave-room');
        }

        Object.values(peers).forEach(call => {
            try {
                call.close();
            } catch (error) {
                console.warn('Error closing peer call', error);
            }
        });

        socket.disconnect();
        try {
            peer.disconnect();
            peer.destroy();
        } catch (error) {
            console.warn('Error cleaning up peer', error);
        }

        state.localStream?.getTracks().forEach(track => track.stop());
    };

    leaveButton?.addEventListener('click', () => {
        leaveRoom();
        window.location.href = '/';
    });

    window.addEventListener('beforeunload', () => {
        if (state.hasJoined && !state.hasLeft) {
            socket.emit('leave-room');
        }
    });

    toggleAudioButton?.addEventListener('click', () => {
        if (!state.localStream) return;
        const [track] = state.localStream.getAudioTracks();
        if (!track) return;
        const enabled = !track.enabled;
        track.enabled = enabled;
        setAudioState(enabled);
    });

    toggleVideoButton?.addEventListener('click', () => {
        if (!state.localStream) return;
        const [track] = state.localStream.getVideoTracks();
        if (!track) return;
        const enabled = !track.enabled;
        track.enabled = enabled;
        setVideoState(enabled);
    });

    switchCameraButton?.addEventListener('click', async () => {
        if (switchCameraButton.disabled) {
            return;
        }

        if (!navigator.mediaDevices?.getUserMedia || !state.localStream) {
            return;
        }

        switchCameraButton.disabled = true;
        switchCameraButton.classList.add('control-button--disabled');

        try {
            let overrides = {};

            if (state.videoDevices.length > 1) {
                const currentIndex = state.videoDevices.findIndex(device => device.deviceId === state.activeVideoDeviceId);
                const nextIndex = (currentIndex + 1) % state.videoDevices.length;
                const nextDevice = state.videoDevices[nextIndex];

                if (!nextDevice || nextDevice.deviceId === state.activeVideoDeviceId) {
                    return;
                }

                overrides = { deviceId: nextDevice.deviceId };
            } else {
                const nextFacingMode = state.preferredFacingMode === 'environment' ? 'user' : 'environment';
                overrides = { facingMode: nextFacingMode };
            }

            const updatedStream = await navigator.mediaDevices.getUserMedia({
                video: buildVideoConstraints(overrides)
            });

            const [freshVideoTrack] = updatedStream.getVideoTracks();
            if (!freshVideoTrack) {
                throw new Error('No video track returned when switching camera.');
            }

            if (overrides.deviceId) {
                state.activeVideoDeviceId = overrides.deviceId;
            }

            if (overrides.facingMode) {
                state.preferredFacingMode = overrides.facingMode;
                state.activeVideoDeviceId = null;
            }

            replaceLocalVideoTrack(freshVideoTrack);
            syncActiveVideoMeta(freshVideoTrack);
            await refreshVideoDevices(freshVideoTrack);
        } catch (error) {
            console.error('Unable to switch camera', error);
            updateConnectionStatus('Camera switch failed', 'danger');
            window.setTimeout(() => {
                if (state.hasJoined) {
                    updateConnectionStatus('Live', 'success');
                } else if (!state.hasLeft) {
                    updateConnectionStatus('Connecting…', 'warning');
                }
            }, 2200);
        } finally {
            updateSwitchCameraAvailability();
        }
    });

    messageForm?.addEventListener('submit', event => {
        event.preventDefault();
        if (!state.hasJoined || !messageInput) return;
        const value = messageInput.value.trim();
        if (!value) return;
        socket.emit('message', value);
        messageInput.value = '';
    });

    const isSecure = window.location.protocol === 'https:';
    const peerOptions = {
        path: '/peerjs',
        host: window.location.hostname,
        secure: isSecure
    };

    const port = window.location.port;
    if (port) {
        peerOptions.port = Number(port);
    } else if (!isSecure) {
        peerOptions.port = 80;
    }

    const peer = new Peer(undefined, peerOptions);

    let peerBootstrapped = false;
    const ensurePeerBootstrapped = () => {
        if (peerBootstrapped) return;
        peerBootstrapped = true;

        peer.on('call', call => {
            peers[call.peer] = call;
            call.on('stream', remoteStream => {
                const tile = ensureRemoteTile(call.peer);
                attachStream(tile, remoteStream);
                participants.add(call.peer);
                updateParticipantBadge();
            });

            call.on('close', () => {
                delete peers[call.peer];
                participants.delete(call.peer);
                removeTile(call.peer);
                updateParticipantBadge();
            });

            call.on('error', error => {
                console.error('Peer call error', error);
            });

            call.answer(state.localStream || new MediaStream());
        });

        peer.on('open', id => {
            state.localId = id;
            state.hasJoined = true;
            participants.delete('local');
            participants.add(id);
            updateParticipantBadge();
            updateConnectionStatus('Live', 'success');
            socket.emit('join-room', roomId, id);
            if (messageInput) {
                messageInput.disabled = false;
                messageInput.placeholder = 'Say something nice…';
            }
            if (sendButton) {
                sendButton.disabled = false;
            }
        });

        peer.on('disconnected', () => {
            updateConnectionStatus('Reconnecting…', 'warning');
            peer.reconnect();
        });

        peer.on('error', error => {
            console.error('PeerJS error', error);
            updateConnectionStatus('Peer error', 'danger');
        });
    };

    const localTile = createVideoTile({ label: 'You', isLocal: true });
    registerTile('local', localTile);
    updateParticipantBadge();

    const connectToNewUser = userId => {
        if (!state.localStream || !state.hasJoined || userId === state.localId) {
            return;
        }
        const call = peer.call(userId, state.localStream);
        peers[userId] = call;

        call.on('stream', remoteStream => {
            const tile = ensureRemoteTile(userId);
            attachStream(tile, remoteStream);
            participants.add(userId);
            updateParticipantBadge();
        });

        call.on('close', () => {
            delete peers[userId];
            participants.delete(userId);
            removeTile(userId);
            updateParticipantBadge();
        });

        call.on('error', error => {
            console.error('Outgoing call error', error);
        });
    };

    const initialiseMedia = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            console.warn('Media devices API not available in this browser.');
            state.localStream = new MediaStream();
            disableControl(toggleAudioButton, 'Unavailable');
            disableControl(toggleVideoButton, 'Unavailable');
            updateSwitchCameraAvailability();
            ensurePeerBootstrapped();
            updateConnectionStatus('Media unsupported', 'danger');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: buildVideoConstraints(),
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            state.localStream = stream;
            attachStream(localTile, stream);

            const videoTracks = stream.getVideoTracks();
            const [primaryVideoTrack] = videoTracks;
            syncActiveVideoMeta(primaryVideoTrack);
            await refreshVideoDevices(primaryVideoTrack);

            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length) {
                enableControl(toggleAudioButton);
                setAudioState(audioTracks[0].enabled !== false);
            } else {
                disableControl(toggleAudioButton, 'No mic');
                setAudioState(false);
            }

            if (videoTracks.length) {
                enableControl(toggleVideoButton);
                setVideoState(videoTracks[0].enabled !== false);
            } else {
                disableControl(toggleVideoButton, 'No camera');
                setVideoState(false);
                updateSwitchCameraAvailability();
            }

            updateConnectionStatus('Connecting…', 'warning');
            ensurePeerBootstrapped();
        } catch (error) {
            console.error('Error accessing media devices.', error);
            state.localStream = new MediaStream();
            disableControl(toggleAudioButton, 'Mic blocked');
            disableControl(toggleVideoButton, 'Camera blocked');
            setAudioState(false);
            setVideoState(false);
            if (localTile?.badge) {
                localTile.badge.textContent = 'You (camera off)';
            }
            updateConnectionStatus('Camera blocked', 'danger');
            ensurePeerBootstrapped();
            updateSwitchCameraAvailability();
        }
    };

    initialiseMedia();

    socket.on('user-connected', userId => {
        if (userId && userId !== state.localId) {
            connectToNewUser(userId);
        }
    });

    socket.on('user-disconnected', userId => {
        if (userId && peers[userId]) {
            peers[userId].close();
            delete peers[userId];
        }
        participants.delete(userId);
        removeTile(userId);
        updateParticipantBadge();
    });

    socket.on('createMessage', payload => {
        if (!payload) return;
        const isSelf = payload.userId === state.localId;
        addMessage({
            author: isSelf ? 'You' : 'Guest',
            text: payload.message ?? '',
            timestamp: payload.timestamp ?? Date.now(),
            isSelf
        });
    });

    socket.on('connect', () => {
        if (state.hasJoined) {
            updateConnectionStatus('Live', 'success');
        }
    });

    socket.on('disconnect', reason => {
        if (!state.hasLeft) {
            updateConnectionStatus('Connection lost', 'danger');
        }
        console.warn('Socket disconnected', reason);
    });

    socket.on('connect_error', error => {
        console.error('Socket connection error', error);
        updateConnectionStatus('Server unreachable', 'danger');
    });
})();
