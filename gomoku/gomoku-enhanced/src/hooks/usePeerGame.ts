import { useState, useEffect, useRef, useCallback } from 'react';
import Peer, { type DataConnection } from 'peerjs';
import type { Player, PeerRole, PeerMessage } from '../types';

interface UsePeerGameReturn {
  myColor: Player | null;
  peerName: string | null;
  isConnected: boolean;
  isMyTurn: boolean;
  peerMove: { row: number; col: number } | null;
  peerWantsRematch: boolean;
  peerAcceptedRematch: boolean;
  sendMove: (row: number, col: number) => void;
  sendRematchRequest: (name: string) => void;
  sendRematchAccept: () => void;
  clearPeerMove: () => void;
  clearPeerAcceptedRematch: () => void;
  error: string | null;
}

export function usePeerGame(
  role: PeerRole | null,
  myName: string,
  roomCode: string | null,
  currentPlayer: Player,
): UsePeerGameReturn {
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const myNameRef = useRef(myName);
  useEffect(() => { myNameRef.current = myName; }, [myName]);

  const [myColor, setMyColor] = useState<Player | null>(null);
  const [peerName, setPeerName] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [peerMove, setPeerMove] = useState<{ row: number; col: number } | null>(null);
  const [peerWantsRematch, setPeerWantsRematch] = useState(false);
  const [peerAcceptedRematch, setPeerAcceptedRematch] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    }
  }, []);

  useEffect(() => {
    if (!role || !roomCode) return;

    let destroyed = false;

    const wireConn = (conn: DataConnection) => {
      connRef.current = conn;
      conn.on('open', () => {
        if (destroyed) return;
        setIsConnected(true);
        setError(null);
      });
      conn.on('data', handleData);
      conn.on('close', () => {
        if (!destroyed) setIsConnected(false);
      });
      conn.on('error', (err) => {
        if (!destroyed) setError(String(err));
      });
    };

    if (role === 'host') {
      setMyColor('black');
      const peer = new Peer(roomCode);
      peerRef.current = peer;

      peer.on('connection', (conn) => {
        wireConn(conn);
        // Send init after connection is open (handled in wireConn 'open' event below)
        conn.on('open', () => {
          conn.send({
            type: 'init',
            guestColor: 'white',
            hostName: myNameRef.current,
          } satisfies PeerMessage);
        });
      });

      peer.on('error', (err) => {
        if (!destroyed) setError(String(err));
      });
    } else {
      // guest
      const peer = new Peer();
      peerRef.current = peer;

      peer.on('open', () => {
        if (destroyed) return;
        const conn = peer.connect(roomCode, { reliable: true });
        wireConn(conn);
        conn.on('open', () => {
          conn.send({ type: 'guest-info', name: myNameRef.current } satisfies PeerMessage);
        });
      });

      peer.on('error', (err) => {
        if (!destroyed) setError(String(err));
      });
    }

    return () => {
      destroyed = true;
      connRef.current = null;
      peerRef.current?.destroy();
      peerRef.current = null;
      setIsConnected(false);
      setMyColor(null);
      setPeerName(null);
      setPeerMove(null);
      setPeerWantsRematch(false);
      setPeerAcceptedRematch(false);
      setError(null);
    };
  }, [role, roomCode, handleData]);

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

  const clearPeerMove = useCallback(() => setPeerMove(null), []);
  const clearPeerAcceptedRematch = useCallback(() => setPeerAcceptedRematch(false), []);

  return {
    myColor,
    peerName,
    isConnected,
    isMyTurn,
    peerMove,
    peerWantsRematch,
    peerAcceptedRematch,
    sendMove,
    sendRematchRequest,
    sendRematchAccept,
    clearPeerMove,
    clearPeerAcceptedRematch,
    error,
  };
}
