import React, { useState, useEffect, useRef } from 'react';
import { ZegoExpressEngine } from 'zego-express-engine-webrtc';
import { FaMicrophone, FaMicrophoneSlash, FaPhoneAlt, FaVideo, FaVideoSlash } from 'react-icons/fa';
import './App.css';

const appID = 610181119; // Your AppID
const serverURL = 'wss://webliveroom610181119-api.coolzcloud.com/ws'; // Your Server URL
const flaskAPI = 'http://127.0.0.1:5000/generate_token'; // Flask backend URL for token generation

function VoiceCall() {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [roomID, setRoomID] = useState(null);
  const [userID, setUserID] = useState(null);
  const zg = useRef(null);

  // Extract roomID and userID from the URL query parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomID = urlParams.get('roomID');
    const userID = urlParams.get('userID') || `user_${new Date().getTime()}`;

    setRoomID(roomID);
    setUserID(userID);

    alert('Room ID: ' + roomID);
    alert('User ID: ' + userID);
  }, []);

  // Fetch token from the Flask backend API
  const fetchToken = async (roomID, userID) => {
    const data = {
      app_id: appID,
      user_id: userID,
      secret: 'your_secret_key_here',  // Provide the secret key
      effective_time_in_seconds: 3600,  // Token validity in seconds
      room_id: roomID,
      privilege: {
        "1": 1,
        "2": 1,
      }
    };

    try {
      const response = await fetch(flaskAPI, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        return result.token; // Return the generated token
      } else {
        alert(`Error generating token: ${result.error_message}`);
        return null;
      }
    } catch (error) {
      alert("Error fetching token: " + error);
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
      const localStream = await zg.current.createStream();
      alert('Local stream created');
      
      const localVideoElement = document.querySelector("#local-video");
      localStream.playVideo(localVideoElement);
      
      const streamID = new Date().getTime().toString();
      zg.current.startPublishingStream(streamID, localStream);
      alert('Started publishing local stream');
      
      setLocalStream(localStream);
    } catch (error) {
      alert(`Error creating or publishing local stream: ${error}`);
    }
  };

  useEffect(() => {
    const handleStreamUpdate = async (roomID, updateType, streamList) => {
      if (updateType === 'ADD') {
        streamList.forEach(async (stream) => {
          try {
            setRemoteStreams((prev) => [...prev, stream.streamID]);
            alert(`Remote stream added: ${stream.streamID}`);
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

      <div id="local-video" className="local-video" />
    </div>
  );
}

export default VoiceCall;
