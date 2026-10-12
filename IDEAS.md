# Ideas

Things worth building, not built yet. Nothing here is a commitment — it is a
place to put an idea so it stops rattling around.

---

## Make it learning-based, not just watching-based

**Built.** This is the Learn and Practice pages. What follows is the original
note, kept because it is the argument for why those pages exist, with what
actually shipped recorded at the end.

Right now the app *shows* you an algorithm running. It does not teach you, and
it never checks whether you understood. Watching bubble sort is not the same as
being able to reason about it.

The idea is to turn it from a demonstration into something you can actually
learn from:

**Go deeper on time complexity.** Not just `O(n²)` in a table, but *why* — what
the nested loops are doing, where the n² comes from, what "amortised" means and
why a dynamic array is O(1) per push despite occasionally copying everything.
Possibly measure it: run an algorithm at increasing input sizes, plot the real
operation count, and lay the theoretical curve over it so you can see them
agree.

**Explain when you would actually reach for each one.** The current "worth
reaching for" note is a start, but it is one paragraph. Real guidance would
cover the situation, not just the algorithm: sorted vs unsorted input, how often
you read against how often you write, whether memory is tight, whether stability
matters, how big n actually gets.

**Practice questions and tests.** The missing half. Ideas:

- *Predict the next step.* Pause mid-run and ask what happens next before
  revealing it.
- *Which algorithm would you use?* Give a scenario — "a nearly-sorted list of
  ten million records, memory is tight" — and ask for a choice plus a reason.
- *Spot the complexity.* Show a snippet, ask for its big-O.
- *Trace it by hand.* Give an input and a final state, ask how many comparisons
  it took.
- *Find the bug.* Show a subtly broken implementation and ask what input breaks
  it. The off-by-one in a binary search is the classic.

**Track what you have learned.** Which algorithms you have actually worked
through, which questions you got wrong, what to revisit. Browser storage is
probably enough; no accounts.

### Why this is the right direction

The hard part of algorithms is not watching one run — it is knowing which to
reach for and being able to justify it. The visualizer is a good explanation
and a poor teacher, and the gap between those is where the learning actually
happens.

### What makes it hard

Writing good questions is slow, and bad questions are worse than none. Content
is the whole cost here, not code. Better to ship five genuinely good questions
per category than forty filler ones.

### What shipped

All four parts, as `learn.html` and `practice.html`.

The complexity measurement went further than planned: rather than illustrating
the curve, the page runs each algorithm at up to nine input sizes and fits the
predicted shape to the real operation counts. That turned out to be worth more
than the explanation, because it shows where theory and practice part company —
17 algorithms measure well under their stated cost, and saying why is a better
lesson about big-O than any amount of prose about ceilings.

Two of the five question formats are generated from real runs rather than
written, so their answers cannot be wrong and there is an endless supply. The
other three are written, 30 of them, and the worry above was the right one:
every one of them took longer than the code around it.

Written explanations of where the cost comes from exist for 66 of the 94. The
remaining 28 have the measurement, the cost table and the trade-offs, and no
"where that comes from" section at all — an empty, hedging paragraph would be
exactly the filler this file warned about.

### Still not done

- A per-algorithm complexity explanation for the remaining 28.
- Questions that are harder than multiple choice — "what is the invariant
  here", with a free-text answer, is the obvious next format and needs a way
  to mark an answer that is right but differently worded.
- Nothing adapts. The queue prefers what you got wrong, which is not the same
  as noticing that you are reliably weak on amortised analysis.
