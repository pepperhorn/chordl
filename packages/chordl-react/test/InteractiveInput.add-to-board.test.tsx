import { describe, it, expect, beforeEach } from "vitest";
import { render, fireEvent, waitFor, within } from "@testing-library/react";
import { InteractiveInput } from "../dev/App";

/**
 * "+ Add to board" has to store the voicing that is on screen, not the one the
 * chord box happens to spell. On the guitar side that already holds — the panel
 * reports its position up to `InteractiveInput`, which writes it onto the card.
 * The piano side had no such report: `VoicingVariantToggle` kept the selected
 * variant in private state, so every card was stored as the default voicing
 * however many pills had been clicked.
 *
 * The assertions read the persisted board rather than the rendered card. The
 * board renders a chord *diagram*, so the stored string is only visible there
 * as a shape — while `localStorage` holds the exact card the editor built,
 * which is precisely what is under test. `useChordBoard` writes through its
 * adapter on every change, so the write lands in the same tick as the click.
 */

const BOARD_KEY = "chordl-board";

interface StoredCard { nl?: string; display?: string }

const storedCards = (): StoredCard[] => {
  const raw = localStorage.getItem(BOARD_KEY);
  if (!raw) return [];
  return (JSON.parse(raw) as { items?: StoredCard[] }).items ?? [];
};

/** The last card added — the one the click under test just wrote. */
const lastCard = (): StoredCard => {
  const cards = storedCards();
  expect(cards.length).toBeGreaterThan(0);
  return cards[cards.length - 1];
};

const chordBox = (c: HTMLElement) =>
  within(c).getByPlaceholderText(/tell me what chord/i) as HTMLInputElement;

const pills = (c: HTMLElement) =>
  [...c.querySelectorAll<HTMLButtonElement>("button.variant-pill")];

const addToBoard = (c: HTMLElement) =>
  c.querySelector<HTMLButtonElement>("button.btn-add-to-board")!;

describe("InteractiveInput + Add to board — piano voicing", () => {
  beforeEach(() => {
    // The board hydrates from storage on mount, so a board left behind by the
    // previous test would be loaded and its cards counted as this one's.
    localStorage.clear();
  });

  it("stores the selected variant, not the typed chord", async () => {
    const { container } = render(
      <InteractiveInput uiTheme="light" showOptions={false} onToggleOptions={() => {}} />,
    );
    fireEvent.change(chordBox(container), { target: { value: "C" } });

    await waitFor(() => expect(pills(container).length).toBeGreaterThan(1));
    fireEvent.click(pills(container)[1]);

    fireEvent.click(addToBoard(container));

    await waitFor(() => {
      // An inversion is written as a rotation ("C starting on E") rather than
      // an inversion number, so the clause is the proof the variant survived.
      expect(lastCard().nl).toMatch(/starting on/);
    });
  });

  it("stores the plain chord when no pill has been clicked", async () => {
    // Regression guard on the default path: the variant report fires on mount
    // too, so the untouched case must still produce byte-for-byte what it
    // produced before any of this existed.
    const { container } = render(
      <InteractiveInput uiTheme="light" showOptions={false} onToggleOptions={() => {}} />,
    );
    fireEvent.change(chordBox(container), { target: { value: "C" } });
    await waitFor(() => expect(pills(container).length).toBeGreaterThan(1));

    fireEvent.click(addToBoard(container));

    await waitFor(() => expect(lastCard().nl).toBe("C"));
  });

  it("keeps the octave shift on a non-default variant", async () => {
    // The rebuilt variant string is assembled from the parsed chord name, which
    // does not carry the octave clause — so the shift used to be dropped by the
    // rebuild itself, losing it from the editor preview as well as the card.
    const { container } = render(
      <InteractiveInput uiTheme="light" showOptions={false} onToggleOptions={() => {}} />,
    );
    fireEvent.change(chordBox(container), { target: { value: "C" } });

    // Octave before pill: the editor's ErrorBoundary is keyed on the octave
    // shift, so shifting after a click would remount the toggle and reset the
    // selection — which is the app's behaviour, not a thing to test around.
    fireEvent.click(container.querySelector<HTMLButtonElement>("button.octave-up")!);
    await waitFor(() => expect(pills(container).length).toBeGreaterThan(1));
    fireEvent.click(pills(container)[1]);

    fireEvent.click(addToBoard(container));

    await waitFor(() => {
      const nl = lastCard().nl ?? "";
      expect(nl).toMatch(/starting on/);
      expect(nl).toMatch(/chord up 1 octave/);
    });
  });
});
