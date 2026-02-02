import { useMemo } from 'react';

interface GlobalStatusBarProps {
  activeTerminalsCount?: number;
}

export function GlobalStatusBar({ activeTerminalsCount = 0 }: GlobalStatusBarProps) {
  // Get memory usage if available
  const memoryUsage = useMemo(() => {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const mem = (performance as any).memory;
      if (mem) {
        const used = Math.round(mem.usedJSHeapSize / 1024 / 1024);
        const total = Math.round(mem.jsHeapSizeLimit / 1024 / 1024);
        return `${used}MB/${total}MB`;
      }
    }
    return null;
  }, []);

  return (
    <div className="global-status-bar">
      <div className="global-statusbar-left">
        <span className="statusbar-item">
          <span className="status-indicator status-online"></span>
          Server: Connected
        </span>
      </div>
      <div className="global-statusbar-right">
        <span className="statusbar-item">WebSocket: Active</span>
        <span className="statusbar-item">Terminals: {activeTerminalsCount}</span>
        {memoryUsage && (
          <span className="statusbar-item">Memory: {memoryUsage}</span>
        )}
      </div>
    </div>
  );
}
