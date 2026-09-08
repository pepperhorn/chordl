import { describe, it, expect, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { InteractiveInput } from "../dev/App";

/**
 * Regression for BLOCKER 1 in the level-control review: a legacy board card
 * (saved before experience levels existed) carries no `level` at all. Opening
 * it for editing used to seed the interactive level at "emerging" — a filter,
 * not "no filter" — which can exclude the card's own stored `position` from
 * the visible set. `GuitarChordPanel`'s drift effect then reports position 0
 * (the first *visible* shape) back to the host, and the live-edit effect
 * persists that over the card's real, stored position. The user opens a card
 * to retitle it and its shape silently changes underneath them.
 *
 * "established" matches every rung (level matching is cumulative), so it is
 * the only fallback equivalent to the "no filter" state every pre-levels card
 * was actually drawn under.
 */
describe("editing a legacy guitar card with no stored level", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not rewrite the card's stored fret position", async () => {
    // Am: an open shape (beginner), at least one barre-free shape away from
    // the nut (emerging), and barre shapes (established) — a real multi-tier
    // chord, so an "emerging" filter genuinely excludes position 1. No
    // `level` key at all, the way every card saved before this feature did.
    const legacyItem = { id: "legacy-1", nl: "Am", display: "guitar", position: 1 };
    localStorage.setItem("chordl-board", JSON.stringify({ items: [legacyItem], meta: {} }));

    const { container } = render(
      <InteractiveInput uiTheme="light" showOptions={false} onToggleOptions={() => {}} />,
    );

    // Board hydration from storage happens in an effect after mount.
    const editButton = await waitFor(() => {
      const btn = container.querySelector(".chordl-board-action-edit");
      if (!btn) throw new Error("board not hydrated yet");
      return btn as HTMLButtonElement;
    });
    fireEvent.click(editButton);

    // Wait for the lazy-loaded guitar panel to mount.
    await waitFor(() => {
      expect(container.querySelector(".bc-guitar-panel")).toBeTruthy();
    });

    // Let the drift-notification round trip (GuitarChordPanel's effect ->
    // onPositionChange -> InteractiveInput's guitarPosition state -> the
    // live-edit effect -> board.updateItem -> the board's persist effect)
    // fully settle before reading the persisted result. Each of those is a
    // real state update chained across renders/effects, not a single commit.
    for (let i = 0; i < 10; i++) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const stored = JSON.parse(localStorage.getItem("chordl-board") ?? "{}");
    expect(stored.items[0].position).toBe(1);
  });
});
