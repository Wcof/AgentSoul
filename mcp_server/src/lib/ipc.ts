import net from 'net';
import { logWAL } from './utils.js';

const PET_IPC_PORT = 8081;
const PET_IPC_HOST = '127.0.0.1';

/**
 * Send a notification event to the Desktop Pet.
 * Zero-dependency TCP socket writer.
 */
export function notifyState(state: string): void {
  const client = new net.Socket();
  client.connect(PET_IPC_PORT, PET_IPC_HOST, () => {
    const payload = JSON.stringify({ event: 'state_change', state }) + '\n';
    client.write(payload, () => {
      client.destroy();
    });
  });
  client.on('error', () => {
    // Ignore errors when pet is not running
  });
}

/**
 * Send a permission request to the Desktop Pet and wait for user response.
 * Blocks the tool call until user approves or denies in the desktop popup.
 */
export function requestPermission(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const client = new net.Socket();
    const requestId = `req-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const cleanup = () => {
      client.destroy();
    };

    client.connect(PET_IPC_PORT, PET_IPC_HOST, () => {
      const payload = JSON.stringify({
        event: 'permission_request',
        request_id: requestId,
        title,
        message
      }) + '\n';
      client.write(payload);
    });

    client.on('data', (data) => {
      try {
        const responseStr = data.toString().trim();
        const responseLines = responseStr.split('\n');
        for (const line of responseLines) {
          if (!line) continue;
          const parsed = JSON.parse(line);
          if (parsed.request_id === requestId) {
            cleanup();
            resolve(parsed.response === 'approve');
            return;
          }
        }
      } catch (e) {
        // Parse error
      }
    });

    client.on('error', (err) => {
      logWAL('requestPermission', 'error', { error: err.message });
      cleanup();
      // Fallback: approve automatically if pet is not running to avoid blocking CLI developers
      resolve(true);
    });

    // Timeout after 30 seconds
    const timeout = setTimeout(() => {
      cleanup();
      resolve(false); // default fallback Deny for safety
    }, 30000);

    client.on('close', () => {
      clearTimeout(timeout);
    });
  });
}
