import { useEffect, useRef } from 'react';
import { Terminal, type IDisposable } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import type { TerminalSession } from '../types';
import {
  TERMINAL_FONT_FAMILY,
  TERMINAL_FONT_SIZE,
  TERMINAL_BACKGROUND_COLOR,
  TERMINAL_FOREGROUND_COLOR
} from '../constants';

interface TerminalTileProps {
  session: TerminalSession;
  wsUrl: string;
  onDelete: () => void;
}

const TEXT_BOOT = 'ターミナルを起動しました: ';
const TEXT_CONNECTED = '接続しました。';
const TEXT_CLOSED = '切断しました。';
const RESIZE_MESSAGE_PREFIX = '\u0000resize:';

export function TerminalTile({
  session,
  wsUrl,
  onDelete
}: TerminalTileProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    containerRef.current.innerHTML = '';
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: TERMINAL_FONT_FAMILY,
      fontSize: TERMINAL_FONT_SIZE,
      theme: {
        background: TERMINAL_BACKGROUND_COLOR,
        foreground: TERMINAL_FOREGROUND_COLOR
      }
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;
    term.open(containerRef.current);
    fitAddon.fit();
    term.write(`${TEXT_BOOT}${session.title}\r\n\r\n`);

    const sendResize = () => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const cols = term.cols;
      const rows = term.rows;
      if (!cols || !rows) return;
      socket.send(`${RESIZE_MESSAGE_PREFIX}${cols},${rows}`);
    };

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      sendResize();
    });
    resizeObserver.observe(containerRef.current);

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;
    socket.addEventListener('open', () => {
      sendResize();
      term.write(`\r\n${TEXT_CONNECTED}\r\n\r\n`);
    });
    socket.addEventListener('message', (event) => {
      term.write(event.data);
    });
    socket.addEventListener('close', () => {
      term.write(`\r\n${TEXT_CLOSED}\r\n\r\n`);
    });

    const dataDisposable: IDisposable = term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });

    return () => {
      resizeObserver.disconnect();
      dataDisposable.dispose();
      socket.close();
      socketRef.current = null;
      fitAddonRef.current = null;
      term.dispose();
    };
  }, [session.id, session.title, wsUrl]);

  return (
    <div className="terminal-tile">
      <div className="terminal-tile-header">
        <span>{session.title}</span>
        <button
          type="button"
          className="terminal-close-btn"
          onClick={onDelete}
          aria-label="ターミナルを閉じる"
        >
          ×
        </button>
      </div>
      <div className="terminal-tile-body" ref={containerRef} />
    </div>
  );
}
