/* ============================================================
   TRADE-OFFS
   ------------------------------------------------------------
   What each algorithm is good at, what it is bad at, and when
   you would actually reach for it.

   Kept out of the algorithm files so the implementations stay
   readable, and because this is prose rather than code.

   One rule throughout: say something specific. "Slow" and
   "inefficient" help nobody. Where the honest answer is "never
   use this in practice", it says so.
   ============================================================ */

export const TRADEOFFS = {

  /* ───────────────────────── Sorting ───────────────────────── */

  bubble: {
    pros: ['Easy to write from memory and hard to get wrong.',
           'Stops early on a pass with no swaps, so already-sorted input is a single O(n) pass.',
           'Sorts in place and is stable.'],
    cons: ['Does far more swapping than any other simple sort — roughly n²/4 on random input.',
           'A small value near the end crawls left one position per pass, which is the worst case for its structure.'],
    useWhen: 'Teaching, or a list so short the choice cannot matter.',
    avoid: 'Essentially always in real code. Insertion sort is faster and no harder to write.',
  },
  cocktail: {
    pros: ['Fixes bubble sort\'s worst habit: alternating direction drags stranded small values left quickly.',
           'Still in place, still stable, still stops early when sorted.'],
    cons: ['Twice the code for the same O(n²).', 'Beaten by insertion sort on essentially every input.'],
    useWhen: 'Showing why the direction of a pass matters.',
    avoid: 'Production. It is a curiosity, not an improvement.',
  },
  selection: {
    pros: ['Makes exactly n-1 swaps, the fewest of any comparison sort — which matters when moving an item costs far more than comparing two.',
           'Uses no extra memory, and its running time does not depend on the input at all.'],
    cons: ['Always O(n²) comparisons, even on a sorted list — it cannot tell it is finished.',
           'Not stable: a long-range swap can jump one equal value past another.'],
    useWhen: 'Writes are expensive and reads are cheap — flash memory, or records far larger than their keys.',
    avoid: 'Anywhere comparisons dominate, which is almost everywhere.',
  },
  insertion: {
    pros: ['Genuinely fast on small or nearly-sorted data — O(n) when already in order.',
           'Stable, in place, and it can sort a stream as items arrive.',
           'Tiny constant factor, which is why real sorts fall back to it for short runs.'],
    cons: ['O(n²) on random data; shifting dominates once the list grows.'],
    useWhen: 'Under about 50 items, or nearly-sorted data. This is the simple sort worth knowing.',
    avoid: 'Large random lists.',
  },
  'binary-insertion': {
    pros: ['Cuts comparisons to O(n log n) by binary-searching for the landing spot.',
           'Worth it when a comparison is expensive — long strings, or one that hits the disk.'],
    cons: ['Still shifts every displaced element, so total work stays O(n²).',
           'More complex than plain insertion sort for a gain that usually does not show.'],
    useWhen: 'Comparisons cost far more than moves.',
    avoid: 'Ordinary numeric data, where the shifting was the bottleneck anyway.',
  },
  shell: {
    pros: ['Enormously better than insertion sort on random data for a few extra lines.',
           'In place, no recursion, no extra memory — fits where merge sort will not.'],
    cons: ['Not stable.',
           'Its running time depends on the gap sequence, and the best one is still an open question — the analysis is genuinely unsettled.'],
    useWhen: 'Memory is tight, recursion is unwelcome, and n is moderate. Common in embedded code.',
    avoid: 'When you need a bound you can state with confidence.',
  },
  comb: {
    pros: ['Nearly as simple as bubble sort and dramatically faster, because the shrinking gap kills stranded small values early.'],
    cons: ['Not stable.', 'No useful worst-case guarantee.', 'Shell sort does the same idea better.'],
    useWhen: 'You want bubble sort to stop embarrassing itself, with one extra variable.',
    avoid: 'Any situation where shell sort is an option.',
  },
  gnome: {
    pros: ['The simplest correct sort to state: one pointer, one rule, no nested loops.'],
    cons: ['Does the same work as insertion sort while being slower, because it steps back one at a time instead of shifting.'],
    useWhen: 'Explaining that a sort does not need nested loops.',
    avoid: 'Everywhere else — insertion sort is this idea done properly.',
  },
  'odd-even': {
    pros: ['Within a phase no two comparisons touch the same element, so all of them can run at once.',
           'That makes it a real choice on parallel hardware and in sorting-network design, where its serial cost is beside the point.'],
    cons: ['Pointless on one processor: O(n²) and slower than insertion sort.'],
    useWhen: 'You actually have parallel hardware, or are explaining sorting networks.',
    avoid: 'Ordinary single-threaded code.',
  },
  merge: {
    pros: ['O(n log n) guaranteed on every input, with no bad case to worry about.',
           'Stable.',
           'Only ever reads each half front-to-back, which suits data on disk or a linked list where you cannot jump around.'],
    cons: ['Needs O(n) scratch space — the one real reason to prefer quicksort.',
           'Slower than quicksort in practice on arrays, because of the copying and worse cache behaviour.'],
    useWhen: 'You need a guarantee, stability, or you are sorting a linked list or a file too big for memory.',
    avoid: 'Memory-constrained in-place sorting of arrays.',
  },
  timsort: {
    pros: ['What Python, Java and Swift actually use.',
           'O(n log n) guaranteed, stable, and it exploits runs already in order — so real data, which is rarely shuffled, sorts far faster than the worst case suggests.',
           'Already-sorted input is a single pass.'],
    cons: ['By far the most complicated sort here — the real implementation is hundreds of lines with genuinely subtle invariants.',
           'Needs O(n) scratch space.'],
    useWhen: 'You are writing a general-purpose sort for a language or library. Otherwise call the one your language ships.',
    avoid: 'Writing it yourself when a built-in exists.',
  },
  quick: {
    pros: ['Usually the fastest in practice: in place, a very tight inner loop, and excellent cache behaviour.',
           'O(log n) extra space, just the recursion.'],
    cons: ['O(n²) if the pivot keeps landing badly — sorted input with a naive pivot is the classic trap.',
           'Not stable.',
           'An adversary who knows your pivot rule can force the worst case, which has been a real denial-of-service vector.'],
    useWhen: 'In-place array sorting where memory matters and input is not hostile. Pick the pivot randomly or by median-of-three.',
    avoid: 'When a worst-case guarantee is required, or input may be adversarial.',
  },
  'quick-3way': {
    pros: ['Linear time when there are many repeated values — every copy of the pivot is finished at once.',
           'The right quicksort for low-cardinality data: a million rows over five categories.'],
    cons: ['Slightly slower than plain quicksort when values are mostly distinct.',
           'Still not stable, still O(n²) worst case.'],
    useWhen: 'The data has lots of duplicates.',
    avoid: 'Mostly-distinct data, where the third partition is pure overhead.',
  },
  heap: {
    pros: ['O(n log n) worst case with O(1) extra space — the only sort here offering both.',
           'Cannot be forced into a bad case by hostile input.'],
    cons: ['Noticeably slower than quicksort in practice despite matching it on paper, because it jumps around the array and misses the cache constantly.',
           'Not stable.'],
    useWhen: 'You need a hard guarantee and cannot spare memory. Real sorts use it as the safety net when quicksort recurses too deep.',
    avoid: 'When speed on typical data matters more than the guarantee.',
  },
  counting: {
    pros: ['Linear time — it beats the O(n log n) comparison bound by not comparing anything.',
           'Stable, and genuinely the fastest option when it applies.'],
    cons: ['Needs an array as wide as the range of values, so a few numbers spanning millions is hopeless.',
           'Integers, or things mappable to small integers, only.'],
    useWhen: 'Many values from a small known range — ages, grades, bytes, dates within a year.',
    avoid: 'Large or unknown value ranges, or anything not an integer.',
  },
  radix: {
    pros: ['Linear in the number of digits, with no comparisons at all.',
           'Stable, and handles a far wider value range than counting sort.',
           'Very fast on fixed-width keys — integers, dates, fixed-length strings.'],
    cons: ['Needs O(n) extra space.',
           'Only works on keys you can split into digits, which rules out arbitrary comparison rules.',
           'Cost scales with key width, so 64-bit integers take twice the passes of 32-bit ones.'],
    useWhen: 'Large volumes of fixed-width keys.',
    avoid: 'Custom comparison logic, or very long keys.',
  },
  bucket: {
    pros: ['Linear on average when values are spread evenly.',
           'Parallelises naturally — each bucket is independent.'],
    cons: ['Collapses to the inner sort\'s cost if the data clusters and everything lands in one bucket.',
           'You must know the value range in advance, and the bucket count is a tuning decision.'],
    useWhen: 'Values known to be roughly uniform — sensor readings, random floats in a range.',
    avoid: 'Skewed or unknown distributions.',
  },
  cycle: {
    pros: ['The theoretical minimum number of writes — every item is moved at most once.',
           'That is the entire reason it exists: for memory where writing physically wears the hardware out.'],
    cons: ['O(n²) comparisons, and slow in wall-clock terms.', 'Not stable.'],
    useWhen: 'Writes are catastrophically expensive — EEPROM, flash with limited write cycles.',
    avoid: 'Ordinary memory, where it is simply a slow sort.',
  },
  pancake: {
    pros: ['A genuine puzzle: the only move allowed is reversing a prefix.',
           'How many flips are needed in the worst case is a real open problem, and Bill Gates published on it.'],
    cons: ['Pointless as a sort — more work than selection sort for the same O(n²).'],
    useWhen: 'The flip really is your only move, which happens in some rearrangement problems and genome studies.',
    avoid: 'Sorting anything.',
  },
  bogo: {
    pros: ['Makes the case for every other algorithm here more effectively than any explanation could.'],
    cons: ['Expected O(n·n!) — ten items average around 36 million shuffles. There is no worst case, because it might never finish.'],
    useWhen: 'Never. It is a joke, and a useful one.',
    avoid: 'Everything.',
  },

  /* ──────────────────────── Searching ──────────────────────── */

  linear: {
    pros: ['Works on any list in any order, with no preparation at all.',
           'No extra memory, and trivially correct.',
           'For a single lookup on an unsorted list it beats sorting and then binary-searching — by a lot.'],
    cons: ['O(n): a million items means up to a million checks.'],
    useWhen: 'The list is unsorted, short, or you will only search it once or twice.',
    avoid: 'Repeated lookups into a large list — then sorting once pays for itself.',
  },
  binary: {
    pros: ['Twenty steps to search a million items instead of a million.',
           'No extra memory.',
           'The idea generalises everywhere — it is the same move as a BST lookup and as bisecting a git history.'],
    cons: ['Requires sorted data, and the cost table never says who sorted it. For one lookup on an unsorted list, sorting first costs far more than simply scanning.',
           'Keeping an array sorted as it changes costs O(n) per insertion.'],
    useWhen: 'Data is already sorted, or you will search it many times.',
    avoid: 'One-off lookups into unsorted data — set the list order to unsorted here and watch the total.',
  },
  quickselect: {
    pros: ['Finds the kth smallest in O(n) average — a median without sorting first.',
           'In place.'],
    cons: ['O(n²) worst case on bad pivots, same as quicksort.',
           'Rearranges your array as a side effect.',
           'Gives you that one item only; for several ranks, sorting is simpler.'],
    useWhen: 'Medians, percentiles, or top-k over a large array you do not need fully sorted.',
    avoid: 'When you need the whole thing in order anyway.',
  },
  jump: {
    pros: ['O(√n) using only forward movement in large strides, which suits media where seeking backwards is expensive.'],
    cons: ['Strictly worse than binary search on anything randomly accessible.', 'Still needs sorted data.'],
    useWhen: 'Sequential media, or a structure where jumping backwards costs.',
    avoid: 'Ordinary arrays. Binary search is better in every way.',
  },
  exponential: {
    pros: ['Finds a target near the front in O(log i) however long the list is — it never looks at the far end.',
           'Works on unbounded or streaming sorted data where the length is unknown.'],
    cons: ['No better than binary search when the target is far in.', 'Still needs sorted data.'],
    useWhen: 'The list is huge or its length is unknown, and hits tend to be near the start.',
    avoid: 'Ordinary bounded arrays.',
  },
  interpolation: {
    pros: ['O(log log n) on evenly spread data — astonishingly fast, and closer to how a human uses a phone book.'],
    cons: ['Degrades to O(n) on clustered data, which is worse than binary search.',
           'Needs numeric keys you can do arithmetic on.',
           'Harder to get right: the division can overflow or divide by zero.'],
    useWhen: 'Large, uniformly distributed numeric keys.',
    avoid: 'Skewed data or non-numeric keys. Binary search is the safer default.',
  },
  ternary: {
    pros: ['Genuinely useful for a different problem: finding the peak of a unimodal function.'],
    cons: ['For searching a sorted list it is worse than binary search — it discards two thirds per round but pays two comparisons to do it, which comes out behind.'],
    useWhen: 'Ternary search on a function, not on a list.',
    avoid: 'Sorted-array search. It is the standard example of why fewer rounds does not mean less work.',
  },
  'fib-search': {
    pros: ['Splits using only addition and subtraction, no division — which mattered on hardware without a divide instruction.',
           'Probes sit closer together than binary search\'s, so it can be kinder to a cache or a disk.'],
    cons: ['Same O(log n) as binary search with more bookkeeping.',
           'The division argument is obsolete on modern hardware.'],
    useWhen: 'Very constrained hardware, or when probe locality genuinely matters.',
    avoid: 'Normal code. Binary search is simpler and just as fast.',
  },
};
