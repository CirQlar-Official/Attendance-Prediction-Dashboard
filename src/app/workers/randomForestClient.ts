import { trainRandomForest, type Forest } from '../utils/randomForest';
import type { TrainRequest, TrainResponse } from './randomForest.worker';

/**
 * Promise-based wrapper around the training worker. Requests are matched
 * by an incrementing id so that if `sorted` changes again while a
 * previous training run is still in flight, the caller can tell which
 * response is which (or simply ignore stale ones) rather than risk
 * applying an out-of-date forest.
 *
 * If the worker ever fails to load or throws (e.g. a bad base-path in a
 * subpath deployment, or a browser that blocks module workers), the
 * client transparently falls back to training on the main thread so the
 * forecast still produces a real prediction instead of silently sitting
 * at 0 with a promise that never resolves.
 */
export class RandomForestClient {
  private worker: Worker | null = null;
  private nextRequestId = 0;
  private pending = new Map<number, (forest: Forest) => void>();
  private workerFailed = false;
  // Retains the payload for each in-flight request so a mid-flight worker
  // failure can be re-run on the main thread with the same data.
  private lastRequestById = new Map<number, { X: number[][]; y: number[] }>();

  constructor() {
    try {
      this.worker = new Worker(new URL('./randomForest.worker.ts', import.meta.url), {
        type: 'module',
      });
      this.worker.onmessage = (event: MessageEvent<TrainResponse>) => {
        const { requestId, forest } = event.data;
        const resolve = this.pending.get(requestId);
        if (resolve) {
          this.pending.delete(requestId);
          this.lastRequestById.delete(requestId);
          resolve(forest);
        }
      };
      this.worker.onerror = event => {
        console.error('Random forest worker failed; falling back to main thread.', event);
        this.failoverToMainThread();
      };
      this.worker.onmessageerror = event => {
        console.error('Random forest worker message error; falling back to main thread.', event);
        this.failoverToMainThread();
      };
    } catch (err) {
      console.error('Random forest worker could not be created; using main thread.', err);
      this.worker = null;
      this.workerFailed = true;
    }
  }

  /**
   * Resolve any in-flight requests by training on the main thread, and
   * route all future requests there too. Called when the worker signals
   * an unrecoverable error - without this, pending promises would hang
   * forever and the forecast would never leave its 0 fallback.
   */
  private failoverToMainThread() {
    this.workerFailed = true;
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const [requestId, resolve] of this.pending) {
      const req = this.lastRequestById.get(requestId);
      resolve(req ? trainRandomForest(req.X, req.y) : []);
    }
    this.pending.clear();
    this.lastRequestById.clear();
  }

  train(X: number[][], y: number[]): { requestId: number; result: Promise<Forest> } {
    const requestId = this.nextRequestId++;

    // No worker available (creation failed earlier) - train synchronously
    // and resolve immediately.
    if (this.workerFailed || !this.worker) {
      return { requestId, result: Promise.resolve(trainRandomForest(X, y)) };
    }

    const result = new Promise<Forest>(resolve => {
      this.pending.set(requestId, resolve);
      this.lastRequestById.set(requestId, { X, y });
    });
    const request: TrainRequest = { requestId, X, y };
    this.worker.postMessage(request);
    return { requestId, result };
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
    this.lastRequestById.clear();
  }
}
