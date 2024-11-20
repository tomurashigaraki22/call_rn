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

  const peerConnection = useRef(null);
  const localStream = useRef(null);

  const servers = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  useEffect(() => {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          email,
          driverEmail,
          roomId,
          whoCalling,
          fromAccept,
        })
      );
    }
  }, []); // Depend on relevant states
  

  // Capture data from the message sent by WebView
  useEffect(() => {
    
    const interval = setInterval(() => {
      const email = window.email || "";
      const driverEmail = window.driverEmail || "";
      const roomId = window.roomId || "";
      const whoCalling = window.whoCalling || "Unknown Caller";
      const fromAccept = window.fromAccept;
  
      // If values are set, stop the interval
      if (email && driverEmail && roomId && whoCalling !== undefined) {
        clearInterval(interval);
  
        // Update state
        setEmail(email);
        setDriverEmail(driverEmail);
        setRoomId(roomId);
        setWhoCalling(whoCalling);
        setfromAccept(fromAccept);
  
        // Log to console
        alert("Injected JS values:", email, driverEmail, roomId, whoCalling, fromAccept);
      }
    }, 100); // Check every 100ms (adjust as needed)
  
    // Cleanup interval when component is unmounted
    return () => clearInterval(interval);
  }, []);
  
  

  useEffect(() => {
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
  }, [fromAccept]);

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
        <div className="caller-name">{whoCalling || "Unknown Caller"}</div>
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
