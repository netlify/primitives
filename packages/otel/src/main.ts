import { type SugaredTracer } from '@opentelemetry/api/experimental';
import { GET_TRACER, SHUTDOWN_TRACERS } from './constants.js';

export const getTracer = async (name?: string, version?: string): Promise<SugaredTracer | undefined> => {
    // @ts-ignore 
    return globalThis[GET_TRACER]?.(name, version);
}

export const shutdownTracers = async (): Promise<void> => {
    // @ts-ignore 
    return globalThis[SHUTDOWN_TRACERS]?.();
}