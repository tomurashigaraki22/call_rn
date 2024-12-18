import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaPhoneAlt,
  FaPhone,
} from "react-icons/fa";
import "./App.css";

function VoiceCall() {
  const [isMuted, setIsMuted] = useState(false);
  const [callStatus, setCallStatus] = useState("Idle");
  const [params, setParams] = useState(null);
  const [newSocket, setNewSocket] = useState(null);
  const [isIncomingCall, setIsIncomingCall] = useState(false);

  const peerConnections = useRef({});
  const localStream = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const servers = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  useEffect(() => {
    const initializeParams = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const paramsObj = {
        whoCalling: urlParams.get("whoCalling") || "",
        driverEmail: urlParams.get("driverEmail") || "",
        userId: urlParams.get("email") || "",
      };
      setParams(paramsObj);
    };

    initializeParams();
  }, []);

  useEffect(() => {
    const socket = io("wss://dropserver.onrender.com", {
      reconnectionAttempts: 5,
      timeout: 10000,
    });
    setNewSocket(socket);

    socket.on("connect", () => {
      console.log("Connected to socket.io successfully");
      const email =
        params?.whoCalling === "Driver"
          ? params?.userId.split("@")[0]
          : params?.driverEmail.split("@")[0];
      socket.emit("register_user", { email });
    });

    socket.on("offer", async (data) => {
      console.log("Received offer:", data);
      setCallStatus("Incoming Call...");
      setIsIncomingCall(true);
      peerConnections.current[data.from] = createPeerConnection(data.from);
      await peerConnections.current[data.from].setRemoteDescription(
        new RTCSessionDescription(data.offer)
      );
    });

    socket.on("answer", async (data) => {
      console.log("Received answer:", data);
      if (peerConnections.current[data.from]) {
        await peerConnections.current[data.from].setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
      }
    });

    socket.on("ice-candidate", async (data) => {
      console.log("Received ICE candidate:", data);
      if (peerConnections.current[data.to]) {
        await peerConnections.current[data.to].addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [params]);

  const createPeerConnection = (userId) => {
    const pc = new RTCPeerConnection(servers);
    const targetId =
      params?.whoCalling === "Driver"
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
      console.log("Received remote stream:", event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };
  
    return pc;
  };
  
  const startCall = async () => {
    try {
      setCallStatus("Starting Call...");
      const targetId =
        params?.whoCalling === "Driver"
          ? params.driverEmail.split("@")[0]
          : params.userId.split("@")[0];
  
      const pc = createPeerConnection(targetId);
      peerConnections.current[targetId] = pc;
  
      // Request audio and video
      localStream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      localVideoRef.current.srcObject = localStream.current;
  
      localStream.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.current);
      });
  
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
  
      newSocket.emit("offer", {
        to: targetId,
        from:
          params.whoCalling === "Driver"
            ? params.userId.split("@")[0]
            : params.driverEmail.split("@")[0],
        offer,
      });
    } catch (error) {
      console.error("Error starting call:", error);
      alert("Error occurred: " + error);
    }
  };
  
  const acceptCall = async () => {
    try {
      setCallStatus("Call Accepted");
      const targetId =
        params?.whoCalling === "Driver"
          ? params.driverEmail.split("@")[0]
          : params.userId.split("@")[0];
  
      const pc = peerConnections.current[targetId];
  
      // Request audio and video
      localStream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      localVideoRef.current.srcObject = localStream.current;
  
      localStream.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.current);
      });
  
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
  
      newSocket.emit("answer", { to: targetId, answer });
      setIsIncomingCall(false);
    } catch (error) {
      console.error("Error accepting call:", error);
      alert("Failed to accept call.");
    }
  };
  

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
        <div className="caller-name">
          {params ? params.whoCalling : "Unknown Caller"}
        </div>
        <div className="call-status">{callStatus}</div>
      </div>

      <div className="video-container">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="local-video"
        />
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="remote-video"
        />
      </div>

      <div className="call-controls">
        <button onClick={toggleMute} className="control-button">
          {isMuted ? (
            <FaMicrophoneSlash className="control-icon red" />
          ) : (
            <FaMicrophone className="control-icon white" />
          )}
        </button>

        {isIncomingCall ? (
          <button onClick={acceptCall} className="control-button green-bg">
            <FaPhone className="control-icon white" />
          </button>
        ) : (
          <button onClick={startCall} className="control-button green-bg">
            <FaPhoneAlt className="control-icon white" />
          </button>
        )}

        <button onClick={endCall} className="control-button red-bg">
          <FaPhoneAlt className="control-icon white rotate-icon" />
        </button>
      </div>
    </div>
  );
}

export default VoiceCall;
