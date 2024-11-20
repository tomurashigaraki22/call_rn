import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import { FaMicrophone, FaMicrophoneSlash, FaPhoneAlt, FaUserCircle } from "react-icons/fa";
import "./App.css";

function VoiceCall() {
  const [isMuted, setIsMuted] = useState(false);
  const [callStatus, setCallStatus] = useState("Idle");
  const [email, setEmail] = useState("");
  const [driverEmail, setDriverEmail] = useState("");
  const [whoCalling, setWhoCalling] = useState("");
  const [fromAccept, setFromAccept] = useState(null);
  const [newSocket, setNewSocket] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [params, setParams] = useState(null);

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
        console.log("Injected values:", window.INJECTED_VALUES);
      } else {
        console.log("Injected values not found or empty");
      }
    }

    if (document.readyState === "complete") {
      handleInjectedValues();
    } else {
      window.addEventListener("load", handleInjectedValues);
    }

    document.addEventListener("injectedValuesReady", handleInjectedValues);

    return () => {
      window.removeEventListener("load", handleInjectedValues);
      document.removeEventListener("injectedValuesReady", handleInjectedValues);
    };
  }, []);

  // Socket connection and signal handling
  useEffect(() => {

    const socket = io("wss://dropserver.onrender.com", {
      reconnectionAttempts: 5,
      timeout: 10000,
    });
    console.log("Socket: ", socket)

    setNewSocket(socket);

    socket.on("connect", () => {
      alert("Connected to socket.io successfully");
      console.log("Connected successfuly")
      const email = params.whoCalling === "Driver" ? params.driverEmail : params.userId;
      socket.emit("register_user", { email: params.whoCalling === 'Driver' ? params.driverEmail : params.userId });
    });

    socket.on("connect_error", (error) => {
      alert("Socket connection error:", error);
      window.ReactNativeWebView.postMessage(JSON.stringify(error));
      setCallStatus("Connection Error: " + error.message); // Update call status for better feedback
      console.error("Socket connection error:", error); // Log error for debugging
    });

    socket.on("reconnect", (attempt) => {
      console.log(`Reconnected after ${attempt} attempts`);
      const email = params.whoCalling === "Driver" ? params.driverEmail : params.userId;
      socket.emit("register_user", { email });
    });

    socket.on("error", (data) => {
      alert("An error occurred:", data.message);
      setCallStatus("Error: " + data.message); // Update call status with received error message
    });

    socket.on("signal_ack", (data) => {
      console.log("Signal Acknowledged:", data.status);
    });

    socket.on("signal", async (data) => {
      const { description, candidate } = data;

      try {
        if (description) {
          setCallStatus("Connecting...");
          await peerConnection.current.setRemoteDescription(
            new RTCSessionDescription(description)
          );

          if (description.type === "offer") {
            const answer = await peerConnection.current.createAnswer();
            await peerConnection.current.setLocalDescription(answer);
            socket.emit("signal", {
              description: peerConnection.current.localDescription,
              email: params.whoCalling === "Driver" ? params.driverEmail : params.userId,
            });
          } else if (description.type === "answer") {
            setCallStatus("In Call");
          }
        } else if (candidate) {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (error) {
        console.error("Error handling signal:", error);
        setCallStatus("Error handling signal: " + error.message);
      }
    });

    return () => {
      console.log("Cleaning up socket listeners...");
      socket.off("connect");
      socket.off("connect_error");
      socket.off("reconnect");
      socket.off("error");
      socket.off("signal_ack");
      socket.off("signal");
      socket.disconnect();
    };
  }, []);

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
            newSocket.emit("signal", { candidate, email: params.whoCalling === 'Driver' ? params.driverEmail : params.userId });
          }
        };

        // Create offer and set local description
        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);

        // Emit the signal to the server
        newSocket.emit("signal", {
          description: peerConnection.current.localDescription,
          email: params.whoCalling === "Driver" ? params.driverEmail : params.userId,
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
        <div className="caller-name">{params ? params.whoCalling : "Unknown Caller"}</div>
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
          onClick={startCall}
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
