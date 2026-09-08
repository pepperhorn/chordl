import { useCallback, useEffect, useRef, useState } from "react";
import { startPlayback } from "./playback";
import type { PlaybackController, StartPlaybackOptions } from "./playback";

export function usePlaybackTimeline(onActiveChange?: (indices: number[]) => void) {
  const controller = useRef<PlaybackController | null>(null);
  const runId = useRef(0);
  const activeCallback = useRef(onActiveChange);
  activeCallback.current = onActiveChange;
  const [playing, setPlaying] = useState<StartPlaybackOptions["mode"] | null>(null);

  const stop = useCallback(() => {
    runId.current++;
    controller.current?.cancel();
    controller.current = null;
    setPlaying(null);
    activeCallback.current?.([]);
  }, []);

  const play = useCallback(async (
    notes: Array<string | number>,
    options: Omit<StartPlaybackOptions, "onActiveChange">,
  ) => {
    stop();
    const currentRun = ++runId.current;
    setPlaying(options.mode);
    try {
      const next = await startPlayback(notes, {
        ...options,
        onActiveChange: (indices) => activeCallback.current?.(indices),
      });
      if (runId.current !== currentRun) {
        next.cancel();
        return;
      }
      controller.current = next;
      await next.completion;
      if (runId.current === currentRun) {
        controller.current = null;
        setPlaying(null);
      }
    } catch {
      if (runId.current === currentRun) setPlaying(null);
      activeCallback.current?.([]);
    }
  }, [stop]);

  useEffect(() => stop, [stop]);
  return { play, stop, playing };
}
