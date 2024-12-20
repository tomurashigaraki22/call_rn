import React, { useState, useEffect, useRef } from "react";
import Peer from "peerjs";
import { FaMicrophone, FaMicrophoneSlash, FaPhoneAlt, FaPhone } from "react-icons/fa";

function UserCallPeer() {
  const [isMuted, setIsMuted] = useState(false);
  const [callStatus, setCallStatus] = useState("Idle");
  const [peerId, setPeerId] = useState("");
  const [remotePeerId, setRemotePeerId] = useState("");
  const [isIncomingCall, setIsIncomingCall] = useState(false);

  const localStream = useRef(null);
  const remoteAudioRef = useRef(null);
  const peer = useRef(null);
  const currentCall = useRef(null);

  useEffect(() => {
    peer.current = new Peer();

    peer.current.on("open", (id) => {
      console.log("Peer ID:", id);
      setPeerId(id);
    });

    peer.current.on("call", (incomingCall) => {
      setCallStatus("Incoming Call...");
      setIsIncomingCall(true);
      currentCall.current = incomingCall;
    });

    return () => peer.current.disconnect();
  }, []);

  const startCall = async () => {
    setCallStatus("Starting Call...");
    try {
      localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const outgoingCall = peer.current.call(remotePeerId, localStream.current);
      handleCall(outgoingCall);
    } catch (error) {
      console.error("Error starting call:", error);
      alert("Error occurred: " + error);
    }
  };

  const acceptCall = async () => {
    try {
      localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      currentCall.current.answer(localStream.current);
      handleCall(currentCall.current);
      setIsIncomingCall(false);
    } catch (error) {
      console.error("Error accepting call:", error);
      alert("Error occurred: " + error);
    }
  };

  const handleCall = (call) => {
    call.on("stream", (remoteStream) => {
      console.log("Remote stream received");
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(console.error);
    });

    call.on("close", () => {
      console.log("Call ended");
      endCall();
    });

    currentCall.current = call;
    setCallStatus("In Call");
  };

  const endCall = () => {
    if (currentCall.current) currentCall.current.close();
    if (localStream.current) localStream.current.getTracks().forEach((track) => track.stop());
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
    <div style={{ textAlign: "center", height: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", backgroundColor: "black", color: "white" }}>
      <div style={{ fontSize: "32px", fontWeight: "600" }}>Peer.js Call</div>
      <div>{callStatus}</div>
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />
      <input
        type="text"
        placeholder="Enter Remote Peer ID"
        value={remotePeerId}
        onChange={(e) => setRemotePeerId(e.target.value)}
        style={{ margin: "10px", padding: "8px" }}
      />
      <div style={{ display: "flex", gap: "16px", marginTop: "16px" }}>
        <button onClick={toggleMute} style={{ padding: "12px", borderRadius: "50%", border: "2px solid white" }}>
          {isMuted ? <FaMicrophoneSlash style={{ color: "white", fontSize: "24px" }} /> : <FaMicrophone style={{ color: "white", fontSize: "24px" }} />}
        </button>
        {isIncomingCall ? (
          <button onClick={acceptCall} style={{ padding: "12px", borderRadius: "50%", backgroundColor: "#f27e05" }}>
            <FaPhone style={{ color: "white", fontSize: "24px" }} />
          </button>
        ) : (
          <button onClick={startCall} style={{ padding: "12px", borderRadius: "50%", backgroundColor: "#4CAF50" }}>
            <FaPhoneAlt style={{ color: "white", fontSize: "24px" }} />
          </button>
        )}
        <button onClick={endCall} style={{ padding: "12px", borderRadius: "50%", backgroundColor: "#D32F2F" }}>
          <FaPhoneAlt style={{ color: "white", fontSize: "24px", transform: "rotate(180deg)" }} />
        </button>
      </div>
    </div>
  );
}

export default UserCallPeer;
