import type { NextFunction, Request, Response } from 'express';

export enum SimulateMode {
  None = 'none',
  Latency = 'latency',
  Drop = 'drop',
  Reject = 'reject',
  Hang = 'hang',
  Timeout = 'timeout',
  ServerError = '500',
}

const MODES = new Set<string>(Object.values(SimulateMode));

function resolveMode(req: Request): SimulateMode {
  const value = String(req.header('x-simulate') ?? req.query.simulate ?? '')
    .trim()
    .toLowerCase();

  if (MODES.has(value) && value !== SimulateMode.None) {
    return value as SimulateMode;
  }
  return SimulateMode.None;
}

export function simulateFailures(req: Request, res: Response, next: NextFunction) {
  switch (resolveMode(req)) {
    case SimulateMode.None:
      next();
      return;

    case SimulateMode.Latency:
      setTimeout(() => next(), 1500 + Math.floor(Math.random() * 2500));
      return;

    case SimulateMode.Hang:
      return;

    case SimulateMode.Drop:
      req.socket.destroy();
      return;

    case SimulateMode.Timeout:
      setTimeout(() => {
        if (!res.headersSent) {
          res.status(504).json({
            code: 'TIMEOUT',
            message: 'Simulated gateway timeout',
            retryable: true,
          });
        }
      }, 35_000);
      return;

    case SimulateMode.Reject:
      res.status(422).json({
        code: 'REJECTED',
        message: 'Simulated upload refusal',
        retryable: false,
      });
      return;

    case SimulateMode.ServerError:
      res.status(500).json({
        code: 'SERVER',
        message: 'Simulated internal server error',
        retryable: true,
      });
      return;
  }
}
