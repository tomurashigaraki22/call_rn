import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import { FaMicrophone, FaMicrophoneSlash, FaPhoneAlt, FaUserCircle } from "react-icons/fa";
import "./App.css";

const socket = io("http://192.168.0.253:1245"); // Replace with your backend URL

function VoiceCall() {
  const [isMuted, setIsMuted] = useState(false);
  const [callStatus, setCallStatus] = useState("Idle");
  const [email, setEmail] = useState("");
  const [driverEmail, setDriverEmail] = useState("");
  const [whoCalling, setWhoCalling] = useState("");
  const [fromAccept, setfromAccept] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [params, setParams] = useState(null)

  const peerConnection = useRef(null);
  const localStream = useRef(null);

  const servers = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  useEffect(() => {
    function handleInjectedValues() {
      if (window.INJECTED_VALUES && Object.keys(window.INJECTED_VALUES).length > 0) {
        setParams(window.INJECTED_VALUES);
        
        // Log the injected values for debugging
        console.log('Injected values:', window.INJECTED_VALUES);
        

      } else {
        console.log('Injected values not found or empty');
      }
    }

    if (document.readyState === 'complete') {
      handleInjectedValues();
    } else {
      window.addEventListener('load', handleInjectedValues);
    }

    document.addEventListener('injectedValuesReady', handleInjectedValues);

    return () => {
      window.removeEventListener('load', handleInjectedValues);
      document.removeEventListener('injectedValuesReady', handleInjectedValues);
    };
  }, []);



  // Capture data from the message sent by WebView

  

  useEffect(() => {
    if (!params) return

    socket.on("connect", (data) => {
      if (params.whoCalling === 'Driver'){
        socket.emit("register_user", {
          email: params.driverEmail
        })
      } else{
        socket.emit("register_user", {
          email: params.userId
        })
      }
        
    })

    socket.on("error", (data) => {
      alert("An error occurred: ", data.message)
    })

    socket.on("signal_ack", (data) => {
      alert("Signal Acknowledge: ", data.status)
    })

    socket.on("signal", async (data) => {
      const { description, candidate } = data;

      if (description) {
        setCallStatus("Connecting...");
        await peerConnection.current.setRemoteDescription(
          new RTCSessionDescription(description)
        );

        if (description.type === "offer" && !fromAccept) {
          // Handle new offer
          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);
          socket.emit("signal", {
            description: peerConnection.current.localDescription,
            email: params.whoCalling === 'Driver' ? params.driverEmail : params.userId
          });
        } else if (description.type === "answer") {
          setCallStatus("In Call");
        }
      } else if (candidate) {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [fromAccept, params]);

  const startCall = async () => {
    // Check if navigator.mediaDevices is available
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        // Access user's media devices (audio)
        localStream.current = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

        // Set up the peer connection
        peerConnection.current = new RTCPeerConnection(servers);

        // Add media tracks to peer connection
        localStream.current.getTracks().forEach((track) => {
          peerConnection.current.addTrack(track, localStream.current);
        });

        // Handle ICE candidates
        peerConnection.current.onicecandidate = ({ candidate }) => {
          if (candidate) {
            socket.emit("signal", { candidate });
          }
        };

        // Create offer and set local description
        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);

        // Emit the signal to the server
        socket.emit("signal", {
          description: peerConnection.current.localDescription,
          email: params.whoCalling === 'Driver' ? params.driverEmail : params.userId

        });

        setCallStatus("Calling...");
      } catch (error) {
        console.error("Error accessing media devices:", error);
        setCallStatus("Error: Could not access media devices");
      }
    } else {
      console.error("Media devices not supported in this browser");
      setCallStatus("Error: Media devices not supported");
    }
  };

  const endCall = () => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => track.stop());
      localStream.current = null;
    }

    setCallStatus("Call Ended");
  };

  const toggleMute = () => {
    if (localStream.current) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  return (
    <div className="call-screen">
      {/* Caller Info */}
      <div className="caller-info">
        <div className="caller-name">{params !== null ? params.whoCalling : "Unknown Caller"}</div>
        <div className="call-status">{callStatus}</div>
      </div>

      {/* Profile Icon */}
      <div className="profile-icon">
        <FaUserCircle className="profile-icon-placeholder" />
      </div>

      {/* Call Controls */}
      <div className="call-controls">
        <button onClick={toggleMute} className="control-button">
          {isMuted ? (
            <FaMicrophoneSlash className="control-icon red" />
          ) : (
            <FaMicrophone className="control-icon white" />
          )}
        </button>

        {/* Start or Accept Call */}
        <button
          onClick={startCall} // Determine the action based on fromAccept
          className={fromAccept ? "control-button green-bg" : "control-button green-bg"}>
          <FaPhoneAlt className="control-icon white" />
        </button>

        <button onClick={endCall} className="control-button red-bg">
          <FaPhoneAlt className="control-icon white rotate-icon" />
        </button>
      </div>
    </div>
  );
}

export default VoiceCall;
