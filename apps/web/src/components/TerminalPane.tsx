import { useMemo } from 'react';
import type { TerminalSession, TerminalGroup } from '../types';
import { TerminalTile } from './TerminalTile';
import { TerminalGroupHeader } from './TerminalGroupHeader';

interface TerminalPaneProps {
  terminals: TerminalSession[];
  wsBase: string;
  onDeleteTerminal: (terminalId: string) => void;
  terminalGroups?: TerminalGroup[];
  onCreateTerminal?: () => void;
  onToggleGroupCollapsed?: (groupId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onRenameGroup?: (groupId: string) => void;
}

// Group terminals by their groupId
function groupTerminals(
  terminals: TerminalSession[],
  groups: TerminalGroup[]
): {
  ungrouped: TerminalSession[];
  grouped: Map<TerminalGroup, TerminalSession[]>;
} {
  const ungrouped: TerminalSession[] = [];
  const grouped = new Map<TerminalGroup, TerminalSession[]>();

  // Initialize map with empty arrays for each group
  groups.forEach((group) => {
    grouped.set(group, []);
  });

  // Sort terminals into groups or ungrouped
  terminals.forEach((terminal) => {
    if (terminal.groupId) {
      const group = groups.find((g) => g.id === terminal.groupId);
      if (group) {
        grouped.get(group)?.push(terminal);
      } else {
        // Group not found, treat as ungrouped
        ungrouped.push(terminal);
      }
    } else {
      ungrouped.push(terminal);
    }
  });

  return { ungrouped, grouped };
}

// Calculate optimal grid for terminal count
function getOptimalGrid(count: number) {
  if (count <= 1) return { cols: 1, rows: 1 };
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  return { cols, rows };
}

function renderTerminalGrid(
  terminals: TerminalSession[],
  wsBase: string,
  onDeleteTerminal: (terminalId: string) => void
) {
  const { cols, rows } = getOptimalGrid(terminals.length);

  return (
    <div
      className="terminal-grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
    >
      {terminals.map((terminal) => (
        <TerminalTile
          key={terminal.id}
          session={terminal}
          wsUrl={`${wsBase}/api/terminals/${terminal.id}`}
          onDelete={() => onDeleteTerminal(terminal.id)}
        />
      ))}
    </div>
  );
}

export function TerminalPane({
  terminals,
  wsBase,
  onDeleteTerminal,
  terminalGroups = [],
  onCreateTerminal,
  onToggleGroupCollapsed,
  onDeleteGroup,
  onRenameGroup
}: TerminalPaneProps) {
  const { ungrouped, grouped } = useMemo(
    () => groupTerminals(terminals, terminalGroups),
    [terminals, terminalGroups]
  );

  // Sort groups: expanded first, then by name
  const sortedGroups = useMemo(
    () => [...grouped.entries()].sort(([, a], [, b]) => {
      const groupA = a[0];
      const groupB = b[0];
      // First sort by collapsed state (expanded first)
      if (groupA.collapsed !== groupB.collapsed) {
        return groupA.collapsed ? 1 : -1;
      }
      // Then by name
      return groupA.name.localeCompare(groupB.name);
    }),
    [grouped]
  );

  return (
    <section className="terminal-pane">
      {terminals.length === 0 ? (
        <div className="terminal-empty">
          <span className="terminal-empty-text">ターミナルを追加</span>
        </div>
      ) : (
        <div className="terminal-container">
          {/* Ungrouped terminals */}
          {ungrouped.length > 0 && (
            <div className="terminal-section">
              {renderTerminalGrid(ungrouped, wsBase, onDeleteTerminal)}
            </div>
          )}

          {/* Grouped terminals */}
          {sortedGroups.map(([group, groupTerminals]) =>
            groupTerminals.length > 0 ? (
              <div
                key={group.id}
                className="terminal-section terminal-group-section"
                style={{ borderColor: group.collapsed ? group.color : undefined }}
              >
                <TerminalGroupHeader
                  group={group}
                  terminalCount={groupTerminals.length}
                  onToggleCollapsed={() => onToggleGroupCollapsed?.(group.id)}
                  onCreateTerminal={onCreateTerminal}
                  onDeleteGroup={() => onDeleteGroup?.(group.id)}
                  onRenameGroup={() => onRenameGroup?.(group.id)}
                />
                {!group.collapsed && renderTerminalGrid(groupTerminals, wsBase, onDeleteTerminal)}
              </div>
            ) : null
          )}
        </div>
      )}
    </section>
  );
}
