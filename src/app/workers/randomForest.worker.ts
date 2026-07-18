/**
 * Runs Random Forest training off the main thread. Training is the only
 * expensive part of the model (benchmarked ~1s+ at 10 years of weekly
 * history, blocking the UI); prediction and feature-importance are cheap
 * tree traversals and stay on the main thread once a trained Forest is
 * available there.
 */
import { trainRandomForest, type Forest } from '../utils/randomForest';

export interface TrainRequest {
  requestId: number;
  X: number[][];
  y: number[];
}

export interface TrainResponse {
  requestId: number;
  forest: Forest;
}

self.onmessage = (event: MessageEvent<TrainRequest>) => {
  const { requestId, X, y } = event.data;
  const forest = trainRandomForest(X, y);
  const response: TrainResponse = { requestId, forest };
  (self as unknown as Worker).postMessage(response);
};
