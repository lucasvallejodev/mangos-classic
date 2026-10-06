import net from "node:net";
import { env } from "./env";

// The world server caches the next free character/item/mail/pet ids in memory at
// startup, so rows must not be inserted while it runs. "Running" = its port accepts.
export function isWorldServerRunning(timeoutMs = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: env.worldHost, port: env.worldPort });
    const done = (up: boolean) => {
      socket.destroy();
      resolve(up);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}
