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

  const peerConnections = useRef({}); // Dictionary to store peer connections
  const localStream = useRef(null);
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
        const urlParams = new URLSearchParams(window.location.search);
        const paramsObj = {
          whoCalling: urlParams.get("whoCalling") || "",
          driverEmail: urlParams.get("driverEmail") || "",
          userId: urlParams.get("email") || "",
        };
        if (paramsObj.whoCalling || paramsObj.driverEmail || paramsObj.userId) {
          setParams(paramsObj);
          console.log("URL parameters:", paramsObj);
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
      peerConnections.current[data.from] = createPeerConnection(data.from);

      await peerConnections.current[data.from].setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnections.current[data.from].createAnswer();
      await peerConnections.current[data.from].setLocalDescription(answer);
      const targetId = params?.whoCalling === "Driver" 
        ? params.driverEmail.split("@")[0] 
        : params.userId.split("@")[0];

      socket.emit("answer", { to: targetId, answer });
    });

    socket.on("answer", async (data) => {
      console.log("Received answer:", data);
      if (peerConnections.current[data.from]) {
        await peerConnections.current[data.from].setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

    socket.on("ice-candidate", async (data) => {
      console.log("Received ICE candidate:", data);
      if (peerConnections.current[data.to]) {
        await peerConnections.current[data.to].addIceCandidate(new RTCIceCandidate(data.candidate));
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

  const createPeerConnection = (userId) => {
    const pc = new RTCPeerConnection(servers);
    const targetId = params?.whoCalling === "Driver" 
        ? params.driverEmail.split("@")[0] 
        : params.userId.split("@")[0];

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        newSocket.emit("ice-candidate", {
          to: targetId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("Received remote stream: ", event);
      alert(`Remote stream: ${event}`)
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    return pc;
  };

  const startCall = async () => {
    try {
      setCallStatus("Starting Call...");
      const targetId = params?.whoCalling === "Driver" 
        ? params.driverEmail.split("@")[0] 
        : params.userId.split("@")[0];

      const pc = createPeerConnection(targetId);
      peerConnections.current[targetId] = pc;  // Store peer connection in the dictionary
  
      localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localVideoRef.current.srcObject = localStream.current;

      localStream.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.current);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
  
      alert(`Calling ${targetId}`);

      newSocket.emit("offer", {
        to: targetId,
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
    Object.values(peerConnections.current).forEach((pc) => pc.close());
    peerConnections.current = {};
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
