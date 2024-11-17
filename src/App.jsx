import React, { useState, useEffect, useRef } from 'react';
import { ZegoExpressEngine } from 'zego-express-engine-webrtc';
import { FaMicrophone, FaMicrophoneSlash, FaPhoneAlt, FaVideo, FaVideoSlash } from 'react-icons/fa';
import './App.css';

const appID = 610181119; // Your AppID
const serverURL = 'wss://webliveroom610181119-api.coolzcloud.com/ws'; // Your Server URL
const flaskAPI = 'http://192.168.0.253:1245/generate_token'; // Flask backend URL for token generation

function VoiceCall() {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true); // Default to video enabled
  const [roomID, setRoomID] = useState(null);
  const [userID, setUserID] = useState(null);
  const zg = useRef(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomID = urlParams.get('roomID');
    const userID = urlParams.get('userID') || `user_${new Date().getTime()}`;

    setRoomID(roomID);
    setUserID(userID);

    alert('Room ID: ' + roomID);
    alert('User ID: ' + userID);
  }, []);

  const fetchToken = async (roomID, userID) => {
    const data = {
      app_id: appID,
      user_id: userID,
      secret: '2789558855af8a2142b484a04485155b',
      effective_time_in_seconds: 3600,
      room_id: roomID,
      privilege: { "1": 1, "2": 1 }
    };
  
    try {
      const response = await fetch('https://dropserver.onrender.com/generate_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
  
      if (!response.ok) {
        const result = await response.json();
        alert(`Error generating token: ${result.error_message}`);
        return null;
      }
  
      const result = await response.json();
      return result.token;
    } catch (error) {
      alert("Error fetching token: " + error.message);
      return null;
    }
  };

  useEffect(() => {
    const initZego = async () => {
      try {
        if (roomID && userID) {
          zg.current = new ZegoExpressEngine(appID, serverURL);
          const token = await fetchToken(roomID, userID);
          if (token) {
            loginToRoom(token);
          }
        }
      } catch (error) {
        alert("Error during Zego initialization: " + error);
      }
    };

    initZego();

    return () => {
      if (zg.current) {
        zg.current.logoutRoom(roomID);
      }
    };
  }, [roomID, userID]);

  const loginToRoom = async (token) => {
    try {
      const result = await zg.current.loginRoom(roomID, token, { userID, userName: userID }, { userUpdate: true });
      alert(`Login result: ${JSON.stringify(result)}`);
      if (result) {
        alert('Login successful');
        startLocalStream();
      }
    } catch (error) {
      alert(`Login failed: ${JSON.stringify(error)}`);
    }
  };

  const startLocalStream = async () => {
    try {
      // Request both audio and video
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      alert('Local audio and video stream created');
      console.log(mediaStream); // Check the stream object
  
      // Wrap the media stream in Zego's stream object
      const localStream = await zg.current.createStream({ audio: true, video: true});
      const streamID = new Date().getTime().toString();
      const publishResult = await zg.current.startPublishingStream(streamID, localStream);
  
      if (publishResult) {
        alert('Started publishing local audio and video stream');
        setLocalStream(localStream);
      } else {
        console.error('Failed to publish local stream');
      }
    } catch (error) {
      console.error('Error creating or publishing local stream:', error);
      alert(`Error creating or publishing stream: ${error.message}`);
    }
  };

  useEffect(() => {
    const handleStreamUpdate = async (roomID, updateType, streamList) => {
      if (updateType === 'ADD') {
        streamList.forEach(async (stream) => {
          try {
            setRemoteStreams((prev) => [...prev, stream.streamID]);
            alert(`Remote stream added: ${stream.streamID}`);

            // Create a video element for remote stream
            const remoteVideoElement = document.createElement('video');
            remoteVideoElement.id = `remote-video-${stream.streamID}`;
            remoteVideoElement.autoplay = true;
            remoteVideoElement.controls = true;
            document.body.appendChild(remoteVideoElement); // You can append it elsewhere in your UI
            stream.playVideo(remoteVideoElement);
          } catch (error) {
            alert(`Error playing remote stream: ${error}`);
          }
        });
      }
    };

    if (zg.current) {
      zg.current.on('roomStreamUpdate', handleStreamUpdate);
    }

    return () => {
      if (zg.current) {
        zg.current.off('roomStreamUpdate', handleStreamUpdate);
      }
    };
  }, []);

  const toggleMute = () => {
    if (localStream) {
      const muted = !isMuted;
      localStream.muteAudio(muted);
      setIsMuted(muted);
      alert(`Audio muted: ${muted}`);
    } else {
      alert('No local stream found');
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoEnabled = !isVideoEnabled;
      setIsVideoEnabled(videoEnabled);
      if (videoEnabled) {
        localStream.enableVideo();
        alert('Video enabled');
      } else {
        localStream.disableVideo();
        alert('Video disabled');
      }
    } else {
      alert('No local stream found');
    }
  };

  const endCall = async () => {
    try {
      await zg.current.logoutRoom(roomID);
      alert('Call ended');
    } catch (error) {
      alert(`Error ending call: ${error}`);
    }
  };

  return (
    <div className="call-screen">
      <div className="profile-icon">
        <div className="local-stream-circle">
          <p>{userID}</p>
        </div>
        {/* Display Local Video */}
        {localStream && (
          <video
            id="local-video"
            className="local-video"
            autoPlay
            muted
            ref={(video) => {
              if (video && localStream) {
                video.srcObject = localStream.mediaStream; // Attach local stream to video element
              }
            }}
          />
        )}
      </div>

      <div className="call-area">
        {remoteStreams.length > 0 && (
          <div className="remote-stream-circle">
            <p>Remote User</p>
          </div>
        )}
      </div>

      <div className="call-controls">
        <button onClick={toggleMute} className={`control-btn mic-btn ${isMuted ? 'off' : 'on'}`}>
          {isMuted ? <FaMicrophoneSlash size={30} /> : <FaMicrophone size={30} />}
        </button>
        <button onClick={toggleVideo} className={`control-btn video-btn ${isVideoEnabled ? 'on' : 'off'}`}>
          {isVideoEnabled ? <FaVideo size={30} /> : <FaVideoSlash size={30} />}
        </button>
        <button onClick={endCall} className="control-btn end-call-btn">
          <FaPhoneAlt size={40} />
        </button>
      </div>

      <audio id="local-audio" className="local-audio" />
    </div>
  );
}

export default VoiceCall;
