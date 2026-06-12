import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { type DataConnection } from 'peerjs';
import type { Player, PeerRole, PeerMessage, ChatMessage } from '../types';

interface UsePeerGameReturn {
  myColor: Player | null;
  peerName: string | null;
  isConnected: boolean;
  isMyTurn: boolean;
  peerMove: { row: number; col: number } | null;
  peerWantsRematch: boolean;
  peerAcceptedRematch: boolean;
  peerResigned: boolean;
  chatMessages: ChatMessage[];
  sendMove: (row: number, col: number) => void;
  sendRematchRequest: (name: string) => void;
  sendRematchAccept: () => void;
  sendResign: () => void;
  sendChat: (text: string) => void;
  clearPeerMove: () => void;
  clearPeerAcceptedRematch: () => void;
  clearPeerResigned: () => void;
  reconnect: () => void;
  error: string | null;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

export function usePeerGame(
  role: PeerRole | null,
  myName: string,
  roomCode: string | null,
  currentPlayer: Player,
): UsePeerGameReturn {
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const myNameRef = useRef(myName);
  const destroyedRef = useRef(false);
  const isConnectedRef = useRef(false);

  useEffect(() => { myNameRef.current = myName; }, [myName]);

  const [myColor, setMyColor] = useState<Player | null>(null);
  const [peerName, setPeerName] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [peerMove, setPeerMove] = useState<{ row: number; col: number } | null>(null);
  const [peerWantsRematch, setPeerWantsRematch] = useState(false);
  const [peerAcceptedRematch, setPeerAcceptedRematch] = useState(false);
  const [peerResigned, setPeerResigned] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { isConnectedRef.current = isConnected; }, [isConnected]);

  const isMyTurn = myColor !== null && myColor === currentPlayer;

  const send = useCallback((msg: PeerMessage) => {
    connRef.current?.send(msg);
  }, []);

  const handleData = useCallback((data: unknown) => {
    const msg = data as PeerMessage;
    if (msg.type === 'init') {
      setMyColor(msg.guestColor);
      setPeerName(msg.hostName);
    } else if (msg.type === 'guest-info') {
      setPeerName(msg.name);
    } else if (msg.type === 'move') {
      setPeerMove({ row: msg.row, col: msg.col });
    } else if (msg.type === 'rematch-request') {
      setPeerWantsRematch(true);
      if (msg.name) setPeerName(msg.name);
    } else if (msg.type === 'rematch-accept') {
      setPeerWantsRematch(false);
      setPeerAcceptedRematch(true);
    } else if (msg.type === 'resign') {
      setPeerResigned(true);
    } else if (msg.type === 'chat') {
      setChatMessages(prev => [...prev, {
        text: msg.text,
        sender: msg.sender,
        timestamp: new Date().toISOString(),
        isMe: false,
      }]);
    }
  }, []);

  const wireConn = useCallback((conn: DataConnection) => {
    connRef.current = conn;
    conn.on('open', () => {
      if (destroyedRef.current) return;
      setIsConnected(true);
      setError(null);
    });
    conn.on('data', handleData);
    conn.on('close', () => {
      if (!destroyedRef.current) setIsConnected(false);
    });
    conn.on('error', (err) => {
      if (!destroyedRef.current) setError(String(err));
    });
  }, [handleData]);

  useEffect(() => {
    if (!role || !roomCode) return;
    destroyedRef.current = false;

    if (role === 'host') {
      setMyColor('black');
      const peer = new Peer(roomCode, { config: { iceServers: ICE_SERVERS } });
      peerRef.current = peer;

      peer.on('connection', (conn) => {
        wireConn(conn);
        conn.on('open', () => {
          conn.send({
            type: 'init',
            guestColor: 'white',
            hostName: myNameRef.current,
          } satisfies PeerMessage);
        });
      });

      peer.on('error', (err) => {
        if (!destroyedRef.current) setError(String(err));
      });
    } else {
      const peer = new Peer({ config: { iceServers: ICE_SERVERS } });
      peerRef.current = peer;

      peer.on('open', () => {
        if (destroyedRef.current) return;
        const conn = peer.connect(roomCode, { reliable: true });
        wireConn(conn);
        conn.on('open', () => {
          conn.send({ type: 'guest-info', name: myNameRef.current } satisfies PeerMessage);
        });
      });

      peer.on('error', (err) => {
        if (!destroyedRef.current) setError(String(err));
      });
    }

    return () => {
      destroyedRef.current = true;
      connRef.current = null;
      peerRef.current?.destroy();
      peerRef.current = null;
      setIsConnected(false);
      setMyColor(null);
      setPeerName(null);
      setPeerMove(null);
      setPeerWantsRematch(false);
      setPeerAcceptedRematch(false);
      setPeerResigned(false);
      setChatMessages([]);
      setError(null);
    };
  }, [role, roomCode, wireConn]);

  // Auto-reconnect when tab becomes visible after being backgrounded (Safari mobile issue)
  useEffect(() => {
    if (!role || !roomCode) return;

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (isConnectedRef.current || destroyedRef.current) return;
      const peer = peerRef.current;
      if (!peer || peer.destroyed) return;

      if (role === 'guest') {
        try {
          const conn = peer.connect(roomCode, { reliable: true });
          wireConn(conn);
          conn.on('open', () => {
            conn.send({ type: 'guest-info', name: myNameRef.current } satisfies PeerMessage);
          });
        } catch { /* ignore */ }
      } else {
        // Host: reconnect to signaling server so guest can find us again
        try { peer.reconnect(); } catch { /* ignore */ }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [role, roomCode, wireConn]);

  const reconnect = useCallback(() => {
    const peer = peerRef.current;
    if (!peer || !role || !roomCode || destroyedRef.current) return;

    try { connRef.current?.close(); } catch { /* ignore */ }
    connRef.current = null;
    setIsConnected(false);
    setError(null);

    if (peer.destroyed) return;

    try { peer.reconnect(); } catch { /* ignore */ }

    if (role === 'guest') {
      peer.once('open', () => {
        if (destroyedRef.current) return;
        const conn = peer.connect(roomCode, { reliable: true });
        wireConn(conn);
        conn.on('open', () => {
          conn.send({ type: 'guest-info', name: myNameRef.current } satisfies PeerMessage);
        });
      });
    }
  }, [role, roomCode, wireConn]);

  const sendMove = useCallback((row: number, col: number) => {
    send({ type: 'move', row, col });
  }, [send]);

  const sendRematchRequest = useCallback((name: string) => {
    send({ type: 'rematch-request', name });
  }, [send]);

  const sendRematchAccept = useCallback(() => {
    send({ type: 'rematch-accept' });
    setPeerWantsRematch(false);
  }, [send]);

  const sendResign = useCallback(() => {
    send({ type: 'resign' });
  }, [send]);

  const sendChat = useCallback((text: string) => {
    send({ type: 'chat', text, sender: myNameRef.current });
    setChatMessages(prev => [...prev, {
      text,
      sender: myNameRef.current,
      timestamp: new Date().toISOString(),
      isMe: true,
    }]);
  }, [send]);

  const clearPeerMove = useCallback(() => setPeerMove(null), []);
  const clearPeerAcceptedRematch = useCallback(() => setPeerAcceptedRematch(false), []);
  const clearPeerResigned = useCallback(() => setPeerResigned(false), []);

  return {
    myColor,
    peerName,
    isConnected,
    isMyTurn,
    peerMove,
    peerWantsRematch,
    peerAcceptedRematch,
    peerResigned,
    chatMessages,
    sendMove,
    sendRematchRequest,
    sendRematchAccept,
    sendResign,
    sendChat,
    clearPeerMove,
    clearPeerAcceptedRematch,
    clearPeerResigned,
    reconnect,
    error,
  };
}
