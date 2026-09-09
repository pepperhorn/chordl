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

/** The "edit" affordance on the nth board card. */
const editCard = (c: HTMLElement, n: number) =>
  [...c.querySelectorAll<HTMLButtonElement>("button.chordl-board-action-edit")][n];

/** The "Done" control, which only exists while a card is being edited. */
const doneEditing = (c: HTMLElement) =>
  c.querySelector<HTMLButtonElement>("button.btn-stop-editing")!;

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

/**
 * `pianoVariantNl` names a voicing *of the chord in the box*, so it has to die
 * with any change to that box — including the two changes the form makes on
 * its own. Both of these were live: the report only re-fires when the toggle
 * has a reason to, and neither of these gives it one.
 */
describe("InteractiveInput — a reported voicing does not outlive the chord box", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not rewrite a card's chord when it is opened for editing", async () => {
    const { container } = render(
      <InteractiveInput uiTheme="light" showOptions={false} onToggleOptions={() => {}} />,
    );
    fireEvent.change(chordBox(container), { target: { value: "C" } });
    await waitFor(() => expect(pills(container).length).toBeGreaterThan(1));

    // A plain card first, so the card and the box hold the same chord text.
    fireEvent.click(addToBoard(container));
    await waitFor(() => expect(lastCard().nl).toBe("C"));

    // Then a variant, which is only ever a preview until something saves it.
    fireEvent.click(pills(container)[1]);
    await waitFor(() => expect(pills(container)[1].dataset.active).toBe("true"));

    // Opening the card for editing puts its own chord back in the box — the
    // same text, so nothing about the toggle changes and nothing re-reports.
    // The live-edit mirror then writes the form onto the card immediately.
    fireEvent.click(editCard(container, 0));

    await waitFor(() => expect(doneEditing(container)).toBeTruthy());
    expect(storedCards()[0].nl).toBe("C");
  });

  it("does not carry the finished chord into the next card after Done", async () => {
    const { container } = render(
      <InteractiveInput uiTheme="light" showOptions={false} onToggleOptions={() => {}} />,
    );
    fireEvent.change(chordBox(container), { target: { value: "C" } });
    await waitFor(() => expect(pills(container).length).toBeGreaterThan(1));
    fireEvent.click(pills(container)[1]);

    fireEvent.click(addToBoard(container));
    await waitFor(() => expect(lastCard().nl).toMatch(/starting on/));

    fireEvent.click(editCard(container, 0));
    await waitFor(() => expect(doneEditing(container)).toBeTruthy());

    // "Done" empties the box. With nothing in it there is no toggle on screen
    // to report anything, so a stale report would simply stand.
    fireEvent.click(doneEditing(container));
    await waitFor(() => expect(chordBox(container).value).toBe(""));

    fireEvent.click(addToBoard(container));

    await waitFor(() => expect(storedCards().length).toBe(2));
    expect(lastCard().nl).toBe("");
  });
});

/**
 * The variant string used to be rebuilt from the parsed chord name plus a
 * hand-kept list of clauses to re-emit, so any clause not on the list was
 * dropped by the click. Harmless while it only fed the preview; permanent, and
 * unrecoverable on re-edit, once the click writes it to a card.
 */
describe("InteractiveInput + Add to board — clauses survive the pill click", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps a clause the old rebuild never knew about", async () => {
    const { container } = render(
      <InteractiveInput uiTheme="light" showOptions={false} onToggleOptions={() => {}} />,
    );
    fireEvent.change(chordBox(container), { target: { value: "C 2 octaves" } });

    await waitFor(() => expect(pills(container).length).toBeGreaterThan(1));
    fireEvent.click(pills(container)[1]);

    fireEvent.click(addToBoard(container));

    await waitFor(() => {
      const nl = lastCard().nl ?? "";
      expect(nl).toMatch(/starting on/);
      expect(nl).toMatch(/2 octaves/);
    });
  });
});
