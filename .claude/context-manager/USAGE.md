# Claude Context Manager - Usage Documentation

## Table of Contents

1. [Quick Start Guide](#quick-start-guide)
2. [API Reference](#api-reference)
3. [Examples](#examples)
4. [Best Practices](#best-practices)
5. [Integration with Claude Code](#integration-with-claude-code)
6. [Configuration Reference](#configuration-reference)

---

## Quick Start Guide

### Basic Setup

Install and import the ContextManager:

```typescript
import { ContextManager, createContextManager } from './.claude/context-manager';

// Create a new instance
const manager = new ContextManager({
  sessionsDir: '.claude/sessions',
  autoCompactThreshold: 100,
  healthCheckInterval: 60000,
  driftThreshold: 0.7,
});

// Or use the factory function
const manager = createContextManager({
  sessionsDir: '.claude/sessions',
});
```

### Creating a Session

Start a new session with an initial prompt:

```typescript
// Create a session with a unique ID and initial prompt
manager.createSession('session-001', 'Implement a new user authentication system');

// The session is now active and tracking
const currentSession = manager.getCurrentSession();
console.log(currentSession?.metadata.phase); // 'active'
```

### Tracking Activity

Track conversation events during the session:

```typescript
// Track user messages
manager.trackMessage('user', 'Add JWT token validation');

// Track assistant responses
manager.trackMessage('assistant', 'I will implement JWT validation middleware');

// Track tool executions
manager.trackTool('read_file', { path: 'src/auth.ts' }, { content: '...' });

// Track errors
manager.trackError(new Error('Failed to read file'), {
  recoverable: true,
  context: { file: 'src/auth.ts' }
});
```

### Getting Health Status

Monitor session health and get recommendations:

```typescript
// Get simple health score (0-1, higher is better)
const healthScore = manager.getHealthScore();
console.log(`Health: ${Math.round(healthScore * 100)}%`);

// Get comprehensive status with recommendations
const status = await manager.getStatus();
console.log(status);
// {
//   healthScore: 0.85,
//   phase: 'active',
//   driftScore: 0.2,
//   lastAction: null,
//   recommendations: []
// }

// Analyze topic drift specifically
const driftAnalysis = await manager.analyzeDrift();
console.log(`Drift: ${Math.round(driftAnalysis.driftScore * 100)}%`);
console.log(`Needs deep analysis: ${driftAnalysis.needsDeepAnalysis}`);
```

---

## API Reference

### ContextManager Class

#### Constructor

```typescript
constructor(options?: ContextManagerOptions)
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sessionsDir` | `string` | `'.claude/sessions'` | Directory for session storage |
| `autoCompactThreshold` | `number` | `100` | Events count before auto-compaction |
| `healthCheckInterval` | `number` | `60000` | Health check interval in milliseconds |
| `driftThreshold` | `number` | `0.7` | Topic drift threshold (0-1) |

#### Session Lifecycle Methods

##### `createSession(sessionId: string, initialPrompt: string): void`

Create a new session with the given ID and initial prompt.

```typescript
manager.createSession('my-session', 'Build a REST API');
```

##### `getSession(sessionId: string): ClaudeSession | null`

Retrieve a session by ID.

```typescript
const session = manager.getSession('my-session');
```

##### `getCurrentSession(): ClaudeSession | null`

Get the currently active session.

```typescript
const current = manager.getCurrentSession();
```

##### `endSession(sessionId: string): void`

End a session (marks phase as 'ended').

```typescript
manager.endSession('my-session');
```

##### `deleteSession(sessionId: string): void`

Permanently delete a session.

```typescript
manager.deleteSession('my-session');
```

##### `listSessions(): ClaudeSession[]`

List all stored sessions.

```typescript
const allSessions = manager.listSessions();
```

#### Monitoring Methods

##### `trackMessage(role: 'user' | 'assistant', content: string): void`

Track a conversation message.

```typescript
manager.trackMessage('user', 'Add error handling');
manager.trackMessage('assistant', 'Adding try-catch blocks...');
```

##### `trackTool(name: string, args: unknown, result: unknown): void`

Track a tool execution.

```typescript
manager.trackTool('write_file',
  { path: 'src/app.ts' },
  { success: true }
);
```

##### `trackError(error: Error | string): void`

Track an error occurrence.

```typescript
manager.trackError(new Error('Compilation failed'));
```

#### Analysis Methods

##### `getHealthScore(): number`

Get the current health score (0-1, higher is better).

```typescript
const score = manager.getHealthScore();
if (score < 0.5) {
  console.log('Session health is critical!');
}
```

##### `getStatus(): Promise<ControllerStatus | null>`

Get comprehensive status including recommendations.

```typescript
const status = await manager.getStatus();
status.recommendations.forEach(rec => console.log(rec));
```

##### `analyzeDrift(): Promise<{ driftScore: number; needsDeepAnalysis: boolean } | null>`

Analyze topic drift for the current session.

```typescript
const drift = await manager.analyzeDrift();
if (drift && drift.driftScore > 0.7) {
  console.log('Topic has drifted significantly!');
}
```

#### Action Methods

##### `compact(options?: CompactOptions): Promise<CompactResult>`

Compact the current session to reduce storage.

```typescript
const result = await manager.compact({
  keepRecentEvents: 50,
  compactThreshold: 100,
});
console.log(`Compacted ${result.compactedEvents} events`);
```

##### `createSnapshot(description?: string): Promise<SnapshotRef>`

Create a snapshot of the current session.

```typescript
const snapshot = await manager.createSnapshot('Before refactoring');
console.log(`Snapshot: ${snapshot.commitHash}`);
```

##### `restoreSnapshot(commitHash: string): Promise<void>`

Restore a session from a snapshot.

```typescript
await manager.restoreSnapshot('abc123def456');
```

##### `trimOutput(customOptions?: object): object | null`

Trim conversation output to reduce size.

```typescript
const trimmed = manager.trimOutput({
  threshold: 10000,
  fileThreshold: 100000,
});
```

#### Statistics Methods

##### `getStats(): SessionStats`

Get overall session statistics.

```typescript
const stats = manager.getStats();
console.log(`Total sessions: ${stats.totalSessions}`);
console.log(`Active sessions: ${stats.activeSessions}`);
console.log(`Average health: ${Math.round(stats.avgHealthScore * 100)}%`);
```

#### Auto-Monitoring Methods

##### `start(): void`

Start automatic health monitoring.

```typescript
manager.start();
```

##### `stop(): void`

Stop automatic health monitoring.

```typescript
manager.stop();
```

##### `isMonitoring(): boolean`

Check if auto-monitoring is running.

```typescript
if (manager.isMonitoring()) {
  console.log('Monitoring is active');
}
```

#### Snapshot Management Methods

##### `getSnapshots(): SnapshotRef[]`

Get all snapshots for the current session.

```typescript
const snapshots = manager.getSnapshots();
```

##### `createSessionSnapshot(options?: SnapshotOptions): Promise<SnapshotRef>`

Create a snapshot with custom options.

```typescript
const snapshot = await manager.createSessionSnapshot({
  description: 'After implementing auth',
  includeMetrics: true,
  includeEvents: true,
});
```

##### `getLatestSnapshot(): SnapshotRef | null`

Get the most recent snapshot.

```typescript
const latest = manager.getLatestSnapshot();
```

##### `getHealthiestSnapshot(): SnapshotRef | null`

Get the snapshot with the highest health score.

```typescript
const best = manager.getHealthiestSnapshot();
```

#### Configuration Methods

##### `setDriftThreshold(threshold: number): void`

Update the drift threshold.

```typescript
manager.setDriftThreshold(0.8);
```

##### `getDriftThreshold(): number`

Get the current drift threshold.

```typescript
const threshold = manager.getDriftThreshold();
```

---

## Examples

### Basic Usage Example

```typescript
import { ContextManager } from './.claude/context-manager';

async function main() {
  const manager = new ContextManager();

  // Create a session
  manager.createSession('dev-session', 'Implement user login');

  // Simulate conversation
  manager.trackMessage('user', 'Add email validation');
  manager.trackMessage('assistant', 'Adding email regex validation');
  manager.trackTool('write_file',
    { path: 'src/validate.ts' },
    { success: true }
  );

  // Check health
  const health = manager.getHealthScore();
  console.log(`Health: ${Math.round(health * 100)}%`);

  // End session
  manager.endSession('dev-session');
}
```

### Auto-Compaction Setup

```typescript
import { ContextManager } from './.claude/context-manager';

async function setupAutoCompaction() {
  const manager = new ContextManager({
    autoCompactThreshold: 100,    // Compact after 100 events
    healthCheckInterval: 30000,   // Check every 30 seconds
  });

  manager.createSession('long-session', 'Extended development session');

  // Start auto-monitoring
  manager.start();

  // Session will auto-compact when event count exceeds threshold
  // and health score drops below 0.5

  // Later...
  manager.stop();
}
```

### Snapshot Workflow

```typescript
import { ContextManager } from './.claude/context-manager';

async function snapshotWorkflow() {
  const manager = new ContextManager();
  manager.createSession('feature-session', 'Add payment processing');

  // Work on feature...
  manager.trackMessage('user', 'Implement Stripe integration');
  manager.trackMessage('assistant', 'Adding Stripe SDK...');

  // Create snapshot before major changes
  const beforeRefactor = await manager.createSessionSnapshot({
    description: 'Before refactoring payment flow',
    includeMetrics: true,
  });
  console.log(`Snapshot created: ${beforeRefactor.commitHash}`);

  // Continue working...
  manager.trackMessage('user', 'Refactor to use adapter pattern');
  // ... more work ...

  // If something goes wrong, restore
  const status = await manager.getStatus();
  if (status && status.healthScore < 0.3) {
    console.log('Health critical, restoring snapshot...');
    await manager.restoreSnapshot(beforeRefactor.commitHash);
  }

  // Get healthiest snapshot
  const best = manager.getHealthiestSnapshot();
  if (best) {
    console.log(`Best snapshot had ${Math.round(best.healthScore * 100)}% health`);
  }
}
```

### Custom Configuration

```typescript
import { ContextManager, CONTEXT_MANAGER_CONFIG } from './.claude/context-manager';

// Use predefined configuration
const config = CONTEXT_MANAGER_CONFIG;

const manager = new ContextManager({
  sessionsDir: '.my-custom/sessions',
  autoCompactThreshold: config.COMPACT_THRESHOLD * 2,  // Double the default
  healthCheckInterval: 120000,  // 2 minutes
  driftThreshold: 0.5,  // More sensitive to drift
});

// Adjust drift threshold dynamically
manager.setDriftThreshold(0.8);

// Monitor drift
manager.createSession('custom-session', 'Custom configured session');
// ... work ...
const drift = await manager.analyzeDrift();
console.log(`Current drift: ${drift?.driftScore}`);
console.log(`Threshold: ${manager.getDriftThreshold()}`);
```

### Event Analysis

```typescript
import { ContextManager, SessionCompactor } from './.claude/context-manager';

async function analyzeSession() {
  const manager = new ContextManager();
  manager.createSession('analysis-session', 'Session for analysis');

  // Generate some activity
  for (let i = 0; i < 50; i++) {
    manager.trackMessage('user', `Request ${i}`);
    manager.trackMessage('assistant', `Response ${i}`);
  }

  const session = manager.getCurrentSession();
  if (session) {
    const compactor = new SessionCompactor();

    // Analyze compaction potential
    const analysis = compactor.analyze(session);
    console.log(`Current events: ${analysis.currentEvents}`);
    console.log(`Events after compaction: ${analysis.eventsAfterCompaction}`);
    console.log(`Recommended: ${analysis.recommended}`);
    console.log(`Reason: ${analysis.reason}`);

    // Get event distribution
    const distribution = compactor.getEventDistribution(session);
    console.log('Event distribution:', distribution.byType);

    // Find old events for compaction
    const oldEvents = compactor.findCompactionCandidates(session, 24);
    console.log(`Events older than 24h: ${oldEvents.length}`);
  }
}
```

---

## Best Practices

### When to Create Snapshots

Create snapshots at these key points:

1. **Before Major Refactoring**
   ```typescript
   await manager.createSnapshot('Before component refactoring');
   ```

2. **After Completing Features**
   ```typescript
   await manager.createSnapshot('Feature complete: User authentication');
   ```

3. **When Health Score Drops Significantly**
   ```typescript
   const health = manager.getHealthScore();
   if (health < 0.5) {
     await manager.createSnapshot('Health checkpoint before recovery');
   }
   ```

4. **Before Context Switches**
   ```typescript
   // Switching from frontend to backend work
   await manager.createSnapshot('Context switch: frontend -> backend');
   ```

5. **At Strategic Milestones**
   - Before deploying to staging
   - After passing integration tests
   - Before risky experimental changes

### How to Interpret Health Scores

Health scores range from 0 to 1, with higher being better.

| Score Range | Status | Action |
|-------------|--------|--------|
| 0.8 - 1.0 | Excellent | Continue working, consider snapshot |
| 0.6 - 0.8 | Good | Normal operations |
| 0.4 - 0.6 | Warning | Consider compaction, review errors |
| 0.2 - 0.4 | Critical | Compact or create snapshot immediately |
| 0.0 - 0.2 | Emergency | Restore from snapshot or fork session |

**Health Factors:**

- **Drift** (0-1): How much the topic has changed from initial prompt
- **Errors** (0-1): Error rate in recent activity
- **Length** (0-1): Session length (100+ messages = 1.0)
- **Activity** (0-1): Recent activity level (1 = active, 0 = stale)

### When to Fork a Session

Consider starting a new session when:

1. **Topic Drift Exceeds Threshold**
   ```typescript
   const drift = await manager.analyzeDrift();
   if (drift && drift.driftScore > 0.7) {
     // Create snapshot and start fresh
     await manager.createSnapshot('Before topic change');
     manager.createSession('new-session', 'New topic description');
   }
   ```

2. **Health Score is Consistently Low**
   ```typescript
   const health = manager.getHealthScore();
   if (health < 0.3) {
     // Session is degraded, consider forking
   }
   ```

3. **Context Switch Between Major Features**
   ```typescript
   // Completed authentication, starting payment processing
   await manager.createSnapshot('Authentication complete');
   manager.createSession('payment-session', 'Implement payment processing');
   ```

4. **After Extended Break**
   ```typescript
   // Returning after days/weeks
   const latest = manager.getLatestSnapshot();
   if (latest) {
     const daysSince = (Date.now() - new Date(latest.timestamp).getTime()) / (1000 * 60 * 60 * 24);
     if (daysSince > 7) {
       // Consider starting fresh
     }
   }
   ```

### Compaction Strategy

1. **Compact Proactively**
   ```typescript
   const session = manager.getCurrentSession();
   if (session && session.events.length > 75) {
     await manager.compact({ keepRecentEvents: 50 });
   }
   ```

2. **Preserve Important Events**
   ```typescript
   await manager.compact({
     keepRecentEvents: 50,
     // Errors and snapshots are preserved by default
   });
   ```

3. **Analyze Before Compacting**
   ```typescript
   const compactor = new SessionCompactor();
   const analysis = compactor.analyze(session);
   if (analysis.recommended) {
     await manager.compact();
   }
   ```

---

## Integration with Claude Code

### Basic Integration Pattern

```typescript
import { ContextManager } from './.claude/context-manager';

class ClaudeCodeIntegration {
  private manager: ContextManager;

  constructor() {
    this.manager = new ContextManager({
      autoCompactThreshold: 100,
      healthCheckInterval: 60000,
    });
    this.manager.start();
  }

  // Hook for new conversations
  onNewConversation(sessionId: string, initialPrompt: string) {
    this.manager.createSession(sessionId, initialPrompt);
  }

  // Hook for incoming messages
  onMessage(role: 'user' | 'assistant', content: string) {
    this.manager.trackMessage(role, content);
    this.checkHealth();
  }

  // Hook for tool calls
  onToolCall(name: string, args: unknown, result: unknown) {
    this.manager.trackTool(name, args, result);
  }

  // Hook for errors
  onError(error: Error) {
    this.manager.trackError(error);
  }

  // Periodic health check
  private async checkHealth() {
    const status = await this.manager.getStatus();
    if (status && status.healthScore < 0.5) {
      console.warn('Session health warning:', status.recommendations);
    }
  }

  // Cleanup
  cleanup() {
    this.manager.stop();
  }
}
```

### Hook Points for Automatic Tracking

#### 1. Message Interception

```typescript
// Wrap the message handler
function wrapMessageHandler(
  manager: ContextManager,
  handler: (role: 'user' | 'assistant', content: string) => void
) {
  return (role: 'user' | 'assistant', content: string) => {
    manager.trackMessage(role, content);
    return handler(role, content);
  };
}
```

#### 2. Tool Execution Wrapper

```typescript
// Wrap tool execution
async function wrapToolExecution(
  manager: ContextManager,
  toolName: string,
  args: unknown,
  execute: () => Promise<unknown>
) {
  try {
    const result = await execute();
    manager.trackTool(toolName, args, result);
    return result;
  } catch (error) {
    manager.trackError(error as Error);
    throw error;
  }
}
```

#### 3. Session Lifecycle Hooks

```typescript
// Auto-create session on first message
function autoCreateSession(manager: ContextManager) {
  if (!manager.getCurrentSession()) {
    manager.createSession(
      `session-${Date.now()}`,
      'Auto-generated session'
    );
  }
}
```

#### 4. Health-Based Actions

```typescript
// Automatic actions based on health
async function healthBasedActions(manager: ContextManager) {
  const status = await manager.getStatus();
  if (!status) return;

  // Auto-compact on low health
  if (status.healthScore < 0.4) {
    await manager.compact();
  }

  // Auto-snapshot on drift
  if (status.driftScore > 0.7) {
    await manager.createSnapshot('High drift detected');
  }
}
```

### Integration with Existing Workflows

```typescript
// Example: Integrating with a task runner
class TaskRunner {
  private manager: ContextManager;

  constructor() {
    this.manager = new ContextManager();
  }

  async runTask(task: Task) {
    // Create session for task
    this.manager.createSession(task.id, task.description);

    try {
      // Execute task with tracking
      const result = await this.executeWithTracking(task);

      // Snapshot on success
      await this.manager.createSnapshot(`Task complete: ${task.name}`);
      return result;
    } catch (error) {
      // Track error
      this.manager.trackError(error as Error);

      // Create failure snapshot
      await this.manager.createSnapshot(`Task failed: ${task.name}`);
      throw error;
    }
  }

  private async executeWithTracking(task: Task) {
    // Track subtasks
    for (const subtask of task.subtasks) {
      this.manager.trackMessage('user', subtask.description);
      // ... execute subtask ...
    }
    // ... task logic ...
  }
}
```

---

## Configuration Reference

### CONTEXT_MANAGER_CONFIG

The module exports a comprehensive configuration object:

```typescript
import { CONTEXT_MANAGER_CONFIG } from './.claude/context-manager';

console.log(CONTEXT_MANAGER_CONFIG);
// {
//   HEALTH: {
//     CRITICAL: 30,      // Below this = critical health
//     WARNING: 50,       // Below this = warning
//     GOOD: 80,          // Above this = good health
//   },
//   DRIFT_THRESHOLD: 0.7,          // Topic drift threshold
//   TOKEN_PENALTY_DIVISOR: 10000,  // For health calculation
//   TOKEN_WARNING_THRESHOLD: 50000,// Token count for trim warning
//   COMPACT_THRESHOLD: 100,        // Events for auto-compaction
//   COMPACT_KEEP_RECENT: 20,       // Recent events to preserve
//   TRIM_THRESHOLD: 10000,         // Characters for trimming
//   TRIM_FILE_THRESHOLD: 100000,   // File content threshold (100KB)
//   PHASE_WINDOW_SIZE: 5,          // Phase detection window
//   SNAPSHOT_AUTO_HEALTH_THRESHOLD: 80,  // Health for auto-snapshot
// }
```

### Threshold Explanations

| Threshold | Default | Purpose |
|-----------|---------|---------|
| `HEALTH.CRITICAL` | 30 | Critical health - immediate action needed |
| `HEALTH.WARNING` | 50 | Warning level - consider compaction |
| `HEALTH.GOOD` | 80 | Good health - snapshot for preservation |
| `DRIFT_THRESHOLD` | 0.7 | Topic drift triggers new session |
| `COMPACT_THRESHOLD` | 100 | Auto-compact after this many events |
| `COMPACT_KEEP_RECENT` | 20 | Events to preserve after compaction |
| `TRIM_THRESHOLD` | 10000 | Trim content longer than this |
| `TRIM_FILE_THRESHOLD` | 100000 | Trim files larger than 100KB |

### Type Definitions

```typescript
// Session data structure
interface ClaudeSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  metadata: {
    initialPrompt: string;
    phase: string;
    healthScore: number;
  };
  metrics: {
    totalTokens: number;
    messageCount: number;
    errorCount: number;
    retryCount: number;
    driftScore: number;
  };
  topicTracking: {
    keywords: string[];
    filePaths: string[];
    initialEmbedding?: number[];
  };
  events: SessionEvent[];
  snapshots: SnapshotRef[];
  messages?: ClaudeMessage[];
}

// Event types
type SessionEventType = 'message' | 'tool' | 'error' | 'snapshot' | 'compact';

// Controller action types
type ControllerActionType = 'compact' | 'snapshot' | 'trim' | 'alert';

// Health analysis result
interface HealthAnalysis {
  score: number;
  factors: {
    drift: number;
    errors: number;
    length: number;
    activity: number;
  };
  recommendations: string[];
}
```

---

## Advanced Topics

### Custom Event Handlers

```typescript
import { SessionMonitor } from './.claude/context-manager';

const monitor = new SessionMonitor();

// Access buffered events
const messages = monitor.getBufferedMessages();
const tools = monitor.getBufferedTools();
const errors = monitor.getBufferedErrors();

// Clear buffers when needed
monitor.clearBuffers();
```

### Drift Detection

```typescript
import { TopicDriftDetector } from './.claude/context-manager';

const detector = new TopicDriftDetector();

// Detect drift using keywords (fast)
const keywordDrift = detector.detectKeywordDrift(session);

// Detect drift using LLM (accurate, future feature)
const llmDrift = await detector.detectLLMDrift(session);

// Combined detection with threshold
const result = await detector.detect(session, 0.7);
console.log(`Drift: ${result.driftScore}, Method: ${result.method}`);
```

### Snapshot Querying

```typescript
import { SnapshotManager } from './.claude/context-manager';
import { SessionStore } from './.claude/context-manager';

const store = new SessionStore('.claude/sessions');
const snapshots = new SnapshotManager(store);

// Find snapshots by health range
const healthySnapshots = snapshots.findSnapshotsByHealth(
  sessionId,
  0.8,  // min score
  1.0   // max score
);

// Find snapshots by time range
const recentSnapshots = snapshots.findSnapshotsByTime(
  sessionId,
  new Date(Date.now() - 24 * 60 * 60 * 1000),  // 24h ago
  new Date()  // now
);
```

---

## Troubleshooting

### Session Not Found

```typescript
const session = manager.getSession('my-session');
if (!session) {
  console.error('Session not found. Available sessions:',
    manager.listSessions().map(s => s.id)
  );
}
```

### Health Score Always Low

```typescript
const status = await manager.getStatus();
if (status) {
  console.log('Health factors:', status.healthScore);
  console.log('Recommendations:', status.recommendations);

  // Check individual factors
  const drift = await manager.analyzeDrift();
  console.log('Drift score:', drift?.driftScore);
}
```

### Compaction Not Working

```typescript
import { SessionCompactor } from './.claude/context-manager';

const compactor = new SessionCompactor();
const analysis = compactor.analyze(session);
console.log('Compaction analysis:', analysis);
// Check if compaction is recommended and why
```

---

## License

MIT License - See project root for details.
