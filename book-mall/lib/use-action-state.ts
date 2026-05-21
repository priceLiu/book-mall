"use client";

import { useFormState } from "react-dom";

/**
 * React 18 兼容：正式 API 为 react-dom 的 useFormState；React 19 起更名为 useActionState。
 */
export function useActionState<State, Payload>(
  action: (state: Awaited<State>, payload: Payload) => State | Promise<State>,
  initialState: State,
  permalink?: string,
): [Awaited<State>, (payload: Payload) => void] {
  return useFormState(action, initialState, permalink);
}
