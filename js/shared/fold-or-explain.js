/* ============================================================
   One heading, two gestures: click to fold, double-click to explain.

   Getting this right is entirely about not assuming how fast someone
   double-clicks. The first attempt deferred the fold by 220ms and
   cancelled it if a second click arrived — but macOS counts clicks up
   to about half a second apart as a double click, so any double click
   slower than 220ms folded the section *and* opened the guide. It
   passed its test because the test fired both clicks in the same tick,
   which no hand does.

   There is no timer here. A double click delivers two `click` events
   and then a `dblclick`, and the second click reports `detail === 2`,
   so it can be told apart from a click that stands alone. The first
   click folds, the second is ignored, and the dblclick puts the fold
   back before explaining — so the outcome is identical at any speed.
   ============================================================ */

/**
 * @param {EventTarget} el
 * @param {object} handlers
 * @param {(opts?: {animate?: boolean}) => void} handlers.fold
 * @param {() => void} handlers.explain
 */
export function foldOrExplain(el, { fold, explain }) {
  el.addEventListener('click', (e) => {
    // The second click of a double click; dblclick deals with the pair.
    if (e.detail > 1) return;
    fold();
  });

  el.addEventListener('dblclick', (e) => {
    e.preventDefault?.();
    // Undo what the first click did, without animating, so it reads as
    // "nothing happened" rather than the section flapping open again.
    fold({ animate: false });
    explain();
  });
}
