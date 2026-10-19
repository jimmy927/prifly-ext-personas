import { afterEach, expect, test } from "bun:test";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activate } from "../index";
import { VoiceServer, type VoiceChild, type VoiceDeps } from "../voice/skippy-voice";

const repo = join(import.meta.dir, "..");

// What a test started is stopped and cleaned up even when it fails midway, so
// no process hook or temp folder outlives it.
const servers: VoiceServer[] = [];
const folders: string[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.stop()));
  await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true })));
});

function track(deps: VoiceDeps): VoiceServer {
  const server = new VoiceServer(deps);
  servers.push(server);
  return server;
}

/** A stand-in spawn and kill: records every call, no Python runs. */
function standIn(options: { healthy?: boolean; exitsOnTerm?: boolean; graceMs?: number } = {}) {
  const spawned: { pid: number; exit(): void }[] = [];
  const signals: [number, string][] = [];
  const deps: VoiceDeps = {
    spawn() {
      const handlers: (() => void)[] = [];
      const child: VoiceChild & { exit(): void } = {
        pid: 1000 + spawned.length,
        once: (event, handler) => {
          if (event === "exit") handlers.push(handler);
        },
        unref: () => undefined,
        exit: () => handlers.splice(0).forEach((handler) => handler()),
      };
      spawned.push(child as { pid: number; exit(): void });
      return child;
    },
    killGroup(pid, signal) {
      signals.push([pid, signal]);
      if (signal === "SIGTERM" && options.exitsOnTerm !== false) spawned.find((child) => child.pid === pid)?.exit();
    },
    healthy: () => Promise.resolve(options.healthy ?? false),
    installed: () => true,
    graceMs: options.graceMs ?? 20,
  };
  return { deps, spawned, signals };
}

async function personasFolder(): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "personas-voice-"));
  folders.push(folder);
  await cp(join(repo, "personas"), join(folder, "personas"), { recursive: true });
  return folder;
}

/** An extension api whose dropdown the test can change. */
async function dropdown(initial: string) {
  let change: (values: Readonly<Record<string, unknown>>) => void = () => undefined;
  const api = {
    folder: await personasFolder(),
    settings: { persona: initial },
    onSettings: (handler: typeof change) => {
      change = handler;
    },
    log: () => undefined,
  };
  const pick = async (persona: string) => {
    change({ persona });
    // apply() is not awaited by the host; let it settle.
    await new Promise((resolve) => setTimeout(resolve, 30));
  };
  return { api, pick };
}

test("Skippy picked spawns the voice exactly once, also when picked twice", async () => {
  const { deps, spawned } = standIn();
  const { api, pick } = await dropdown("Skippy");
  const stop = await activate(api, track(deps));
  await pick("Skippy");
  expect(spawned).toHaveLength(1);
  await stop();
});

test("another persona or None stops the server the extension started", async () => {
  const { deps, signals } = standIn();
  const { api, pick } = await dropdown("Skippy");
  const stop = await activate(api, track(deps));
  await pick("Spock");
  expect(signals).toEqual([[1000, "SIGTERM"]]);
  await stop();

  const second = standIn();
  const again = await dropdown("Skippy");
  const stopAgain = await activate(again.api, track(second.deps));
  await again.pick("None");
  expect(second.signals).toEqual([[1000, "SIGTERM"]]);
  await stopAgain();
});

test("the stop function the host calls (disable, unload, reload) stops it", async () => {
  const { deps, signals } = standIn();
  const { api } = await dropdown("Skippy");
  const stop = await activate(api, track(deps));
  await stop();
  expect(signals).toEqual([[1000, "SIGTERM"]]);
});

test("the stop function resolves only once the server is down, SIGKILL included", async () => {
  const { deps, signals } = standIn({ exitsOnTerm: false, graceMs: 20 });
  const { api } = await dropdown("Skippy");
  const stop = await activate(api, track(deps));
  await stop();
  expect(signals).toEqual([
    [1000, "SIGTERM"],
    [1000, "SIGKILL"],
  ]);
});

test("a reloaded extension's server waits for the old one's stop before spawning", async () => {
  const old = standIn({ exitsOnTerm: false, graceMs: 50 });
  const oldServer = track(old.deps);
  await oldServer.ensure();
  const stopping = oldServer.stop();
  const next = standIn();
  const nextServer = track(next.deps);
  await nextServer.ensure();
  // The new spawn came after the old server's SIGKILL, not beside it.
  expect(old.signals.map(([, signal]) => signal)).toEqual(["SIGTERM", "SIGKILL"]);
  expect(next.spawned).toHaveLength(1);
  await stopping;
});

test("a server that was already healthy and not spawned by us is never signalled", async () => {
  const { deps, spawned, signals } = standIn({ healthy: true });
  const { api, pick } = await dropdown("Skippy");
  const stop = await activate(api, track(deps));
  await pick("Spock");
  await pick("Skippy");
  await stop();
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(spawned).toHaveLength(0);
  expect(signals).toEqual([]);
});

test("SIGKILL follows when the server has not exited within the grace period", async () => {
  const { deps, signals } = standIn({ exitsOnTerm: false, graceMs: 20 });
  const server = track(deps);
  await server.ensure();
  await server.stop();
  expect(signals).toEqual([
    [1000, "SIGTERM"],
    [1000, "SIGKILL"],
  ]);
});

test("reselecting Skippy after a stop starts the voice again", async () => {
  const { deps, spawned, signals } = standIn();
  const { api, pick } = await dropdown("Skippy");
  const stop = await activate(api, track(deps));
  await pick("None");
  await pick("Skippy");
  expect(spawned).toHaveLength(2);
  expect(signals).toEqual([[1000, "SIGTERM"]]);
  await stop();
});

test("concurrent ensure calls share one launch", async () => {
  const { deps, spawned } = standIn();
  const server = track(deps);
  await Promise.all([server.ensure(), server.ensure()]);
  expect(spawned).toHaveLength(1);
  await server.stop();
});
