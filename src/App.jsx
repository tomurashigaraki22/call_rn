import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import { FaMicrophone, FaMicrophoneSlash, FaPhoneAlt, FaUserCircle } from "react-icons/fa";
import "./App.css";

function VoiceCall() {
  const [isMuted, setIsMuted] = useState(false);
  const [callStatus, setCallStatus] = useState("Idle");
  const [params, setParams] = useState(null);
  const [newSocket, setNewSocket] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [fromAccept, setFromAccept] = useState(false);

  const peerConnection = useRef(null);
  const localStream = useRef(null);
  const remoteStream = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const servers = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  useEffect(() => {
    function handleInjectedValues() {
      if (window.INJECTED_VALUES && Object.keys(window.INJECTED_VALUES).length > 0) {
        setParams(window.INJECTED_VALUES);
        console.log("Injected values:", window.INJECTED_VALUES);
      } else {
        console.log("Injected values not found or empty");

        // Fallback to URL parameters
        const urlParams = new URLSearchParams(window.location.search);

        const paramsObj = {
          whoCalling: urlParams.get("whoCalling") || "",
          driverEmail: urlParams.get("driverEmail") || "",
          userId: urlParams.get("email") || "",
        };

        if (paramsObj.whoCalling || paramsObj.driverEmail || paramsObj.userId) {
          setParams(paramsObj);
          console.log("URL parameters:", paramsObj);
        } else {
          console.log("No valid parameters found in URL");
        }
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

  // Initialize Socket.IO
  useEffect(() => {
    const socket = io("wss://dropserver.onrender.com", {
      reconnectionAttempts: 5,
      timeout: 10000,
    });
    setNewSocket(socket);

    socket.on("connect", () => {
      alert("Connected to socket.io successfully");
      const email = params?.whoCalling === "Driver" ? params.userId.split("@")[0] : params.driverEmail.split("@")[0];
      socket.emit("register_user", { email });
    });

    socket.on("offer", async (data) => {
      console.log("Received offer:", data);
      setCallStatus("Incoming Call...");
      peerConnection.current = createPeerConnection();
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      socket.emit("answer", { to: data.from, answer });
    });

    socket.on("answer", async (data) => {
      console.log("Received answer:", data);
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
    });

    socket.on("ice-candidate", async (data) => {
      console.log("Received ICE candidate:", data);
      if (peerConnection.current) {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    socket.on("error", (data) => {
      alert("Error: " + data.message);
      setCallStatus("Error: " + data.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [params]);

  // Function to create RTCPeerConnection
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(servers);

    const emitTarget = params?.whoCalling === "Driver" 
      ? params.userId.split("@")[0] 
      : params.driverEmail.split("@")[0];

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        newSocket.emit("ice-candidate", {
          to: emitTarget,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("Received remote stream.");
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    return pc;
  };

  const startCall = async () => {
    try {
      setCallStatus("Starting Call...");
      peerConnection.current = createPeerConnection();

      localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localVideoRef.current.srcObject = localStream.current;

      localStream.current.getTracks().forEach((track) => {
        peerConnection.current.addTrack(track, localStream.current);
      });

      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);

      const emitTarget = params?.whoCalling === "Driver" 
        ? params.userId.split("@")[0] 
        : params.driverEmail.split("@")[0];

      alert(`Calling ${emitTarget}`);

      newSocket.emit("offer", {
        to: emitTarget,
        from: params.whoCalling === "Driver" ? params.userId.split("@")[0] : params.driverEmail.split("@")[0],
        offer,
      });
    } catch (error) {
      console.error("Error starting call:", error);
      alert(`Error occurred: ${error}`);
    }
  };

  const requestMicrophonePermission = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStream.current = stream;
        setHasPermission(true);
      } else {
        console.error("getUserMedia is not supported in this browser.");
        alert("Your browser does not support microphone access.");
      }
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Please grant microphone permissions to proceed.");
    }
  };

  useEffect(() => {
    requestMicrophonePermission();
  }, []);

  const endCall = () => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => track.stop());
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
      <div className="caller-info">
        <div className="caller-name">{params ? params.whoCalling : "Unknown Caller"}</div>
        <div className="call-status">{callStatus}</div>
      </div>

      <div className="profile-icon">
        <FaUserCircle className="profile-icon-placeholder" />
      </div>

      <div>
        <video ref={localVideoRef} autoPlay muted playsInline style={{ display: "none" }} />
        <video ref={remoteVideoRef} autoPlay playsInline style={{ display: "none" }} />
      </div>

      <div className="call-controls">
        <button onClick={toggleMute} className="control-button">
          {isMuted ? (
            <FaMicrophoneSlash className="control-icon red" />
          ) : (
            <FaMicrophone className="control-icon white" />
          )}
        </button>
        <button onClick={startCall} className="control-button green-bg">
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
