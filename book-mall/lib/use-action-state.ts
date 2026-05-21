"use client";

import { useFormState } from "react-dom";

type FormAction<State, Payload> = (state: State, payload: Payload) => State | Promise<State>;

/**
 * React 18 兼容：正式 API 为 react-dom 的 useFormState；React 19 起更名为 useActionState。
 */
export function useActionState<State, Payload>(
  action: FormAction<State, Payload>,
  initialState: State,
  permalink?: string,
): [State, (payload: Payload) => void] {
  const [state, formAction] = useFormState(
    action,
    initialState as Awaited<State>,
    permalink,
  );
  return [state as State, formAction as (payload: Payload) => void];
}
