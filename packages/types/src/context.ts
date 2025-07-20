export interface EventContext {
  type: string;
  payload: any;
}

export interface RefloContext {
  event?: EventContext;
}