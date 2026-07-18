import type { Forest } from '../utils/randomForest';
import type { TrainRequest, TrainResponse } from './randomForest.worker';

/**
 * Promise-based wrapper around the training worker. Requests are matched
 * by an incrementing id so that if `sorted` changes again while a
 * previous training run is still in flight, the caller can tell which
 * response is which (or simply ignore stale ones) rather than risk
 * applying an out-of-date forest.
 */
export class RandomForestClient {
  private worker: Worker;
  private nextRequestId = 0;
  private pending = new Map<number, (forest: Forest) => void>();

  constructor() {
    this.worker = new Worker(new URL('./randomForest.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (event: MessageEvent<TrainResponse>) => {
      const { requestId, forest } = event.data;
      const resolve = this.pending.get(requestId);
      if (resolve) {
        this.pending.delete(requestId);
        resolve(forest);
      }
    };
  }

  train(X: number[][], y: number[]): { requestId: number; result: Promise<Forest> } {
    const requestId = this.nextRequestId++;
    const result = new Promise<Forest>(resolve => {
      this.pending.set(requestId, resolve);
    });
    const request: TrainRequest = { requestId, X, y };
    this.worker.postMessage(request);
    return { requestId, result };
  }

  terminate() {
    this.worker.terminate();
    this.pending.clear();
  }
}
