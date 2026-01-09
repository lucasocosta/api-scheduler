import { ManagedRuntime } from "effect";
import { engineLoop } from "./workflows/engine";
import { MySQLServiceLive } from "./infrastructure/repository";

const runtime = ManagedRuntime.make(MySQLServiceLive);

runtime.runFork(engineLoop());
