import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import { FiPhoneOff, FiMic, FiMicOff, FiPhoneCall } from 'react-icons/fi'; // Importing icons

const CallScreen = () => {
  const [callStatus, setCallStatus] = useState('Connecting...');
  const [peer, setPeer] = useState(null);
  const [peerId, setPeerId] = useState('');
  const [remotePeerId, setRemotePeerId] = useState(''); // Set dynamically
  const [isMuted, setIsMuted] = useState(false);
  const [call, setCall] = useState(null);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const urlParams = new URLSearchParams(window.location.search);
  const driverId = urlParams.get('driverId');
  const userId = urlParams.get('userId');
  const isInitiator = urlParams.get('initiator') === 'true';

  const localPeerId = driverId;
  const targetPeerId = userId;

  useEffect(() => {
    const newPeer = new Peer(localPeerId);
    setPeer(newPeer);

    newPeer.on('open', (id) => {
      setPeerId(id);
      console.log('Peer ID:', id);
    });

    newPeer.on('call', (incomingCall) => {
      setCallStatus('Ringing...');
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        localAudioRef.current.srcObject = stream;
        incomingCall.answer(stream);
        setCall(incomingCall);

        incomingCall.on('stream', (remoteStream) => {
          remoteAudioRef.current.srcObject = remoteStream;
          remoteAudioRef.current.play();
          setCallStatus('In Call');
        });
      });
    });

    return () => {
      if (newPeer) newPeer.destroy();
    };
  }, []);

  useEffect(() => {
    if (isInitiator && peer) {
      const conn = peer.connect(targetPeerId);
      conn.on('open', () => {
        setCallStatus('Peer Connected');
        startCall(targetPeerId);
      });

      conn.on('error', () => {
        setCallStatus('Retrying Connection...');
      });
    }
  }, [isInitiator, peer]);

  const startCall = (remotePeerId) => {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      localAudioRef.current.srcObject = stream;
      const outgoingCall = peer.call(remotePeerId, stream);
      setCall(outgoingCall);

      outgoingCall.on('stream', (remoteStream) => {
        remoteAudioRef.current.srcObject = remoteStream;
        setCallStatus('In Call');
      });

      setCallStatus('Calling...');
    });
  };

  const endCall = () => {
    if (call) {
      call.close();
      setCallStatus('Call Ended');
    }
  };

  const toggleMute = () => {
    const stream = localAudioRef.current?.srcObject;
    const audioTrack = stream?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#000',
        padding: '5%',
        boxSizing: 'border-box',
      }}
    >
      <p
        style={{
          fontSize: '5vw',
          color: 'white',
          textAlign: 'center',
        }}
      >
        {callStatus}
      </p>

      <audio ref={localAudioRef} autoPlay muted style={{ display: 'none' }} />
      <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />

      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-around',
          position: 'absolute',
          bottom: '10%',
        }}
      >
        {/* End Call */}
        <button
          onClick={endCall}
          style={{
            width: '15vw',
            height: '15vw',
            backgroundColor: 'red',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '6vw',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <FiPhoneOff />
        </button>

        {/* Mute/Unmute */}
        <button
          onClick={toggleMute}
          style={{
            width: '15vw',
            height: '15vw',
            backgroundColor: isMuted ? 'gray' : 'green',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '6vw',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {isMuted ? <FiMicOff /> : <FiMic />}
        </button>

        {/* Redial */}
        <button
          onClick={() => startCall(remotePeerId)}
          style={{
            width: '15vw',
            height: '15vw',
            backgroundColor: '#007bff',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '6vw',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <FiPhoneCall />
        </button>
      </div>
    </div>
  );
};

export default CallScreen;
