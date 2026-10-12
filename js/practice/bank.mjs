/* ============================================================
   Written questions.

   Three of the five formats in IDEAS.md cannot be generated, because
   the whole question is the judgement: which algorithm fits a situation,
   what a snippet costs, what input breaks an implementation.

   IDEAS.md: "Writing good questions is slow, and bad questions are
   worse than none. Better to ship five genuinely good questions per
   category than forty filler ones." So every question here is one where
   a confident wrong answer is plausible, every wrong option says why it
   is wrong, and nothing is included just to make the count rounder.

   The `why` on each option is the part that teaches. Being told you are
   wrong is worth very little; being told what you were probably
   thinking, and where it breaks, is worth something.
   ============================================================ */

/* ────────── which algorithm would you use? ────────── */

const CHOOSE = [
  {
    id: 'choose:nearly-sorted',
    algo: 'insertion',
    categoryName: 'Sorting',
    difficulty: 1,
    prompt: 'A list of 50,000 records arrives already almost in order — a few dozen are out of place. You need it fully sorted. What do you reach for?',
    options: [
      { text: 'Insertion sort', correct: true, why: 'Its cost is the number of inversions, and there are only a few dozen, so this is effectively one linear pass.' },
      { text: 'Quick sort', why: 'It would work, but it does its full n log n regardless — nearly-sorted input buys it nothing, and with a naive pivot an already-sorted run is its worst case.' },
      { text: 'Heap sort', why: 'n log n whatever the input. Heapsort has no best case to speak of: it cannot exploit order that is already there.' },
      { text: 'Merge sort', why: 'Also n log n regardless, plus O(n) of scratch space. Timsort is the version of this idea that does detect existing runs.' },
    ],
    explain: 'Insertion sort is the one sort here whose cost depends on how disordered the input is rather than how big it is. O(n²) is its worst case, not its character — on nearly-sorted data it is O(n) and beats everything. This is exactly why Timsort runs insertion sort on small and nearly-ordered runs.',
  },
  {
    id: 'choose:tight-memory-guarantee',
    algo: 'heap',
    categoryName: 'Sorting',
    difficulty: 3,
    prompt: 'Embedded device. You must sort an array in place — there is no room for a second copy — and you need a hard guarantee on the worst case, because a slow frame is a failure.',
    options: [
      { text: 'Heap sort', correct: true, why: 'In place, and O(n log n) in the worst case as well as the average. It is the only sort here that gives you both.' },
      { text: 'Quick sort', why: 'In place, but its worst case is O(n²). "Unlikely" is not a guarantee, and this is the situation where the guarantee is the requirement.' },
      { text: 'Merge sort', why: 'The worst-case guarantee is there, but it needs O(n) extra space, which is the one thing you do not have.' },
      { text: 'Timsort', why: 'Also needs O(n) scratch space, and its advantage is on partly-ordered data rather than on the worst case.' },
    ],
    explain: 'This is the question heapsort exists to answer. Quicksort is usually faster in practice — better cache behaviour, tighter inner loop — but "usually" is the wrong word when a missed deadline is a failure. Trading average speed for a worst-case bound is the whole trade.',
  },
  {
    id: 'choose:stability-matters',
    algo: 'merge',
    categoryName: 'Sorting',
    difficulty: 2,
    prompt: 'A table is already sorted by date. You now need it sorted by customer, with each customer\'s rows still in date order. Memory is not a concern.',
    options: [
      { text: 'Merge sort', correct: true, why: 'Stable: equal keys keep the order they came in, which is precisely what preserves the date sort inside each customer.' },
      { text: 'Quick sort', why: 'Not stable. Partitioning moves equal elements past one another, so the date order within a customer is lost.' },
      { text: 'Heap sort', why: 'Not stable either — sifting through the heap reorders equal keys freely.' },
      { text: 'Selection sort', why: 'Also unstable in its usual form, and O(n²) besides. Minimal writes is its selling point, not stability.' },
    ],
    explain: 'Sorting by one key and then another, and expecting the first to survive, only works if the second sort is stable. It is the reason `sorted()` in Python and `Collections.sort` in Java are specified as stable: the guarantee is what makes sorting by several keys a sequence of simple sorts rather than one complicated comparator.',
  },
  {
    id: 'choose:search-once',
    algo: 'linear',
    categoryName: 'Searching',
    difficulty: 2,
    prompt: 'An unsorted array of a million items. You need to find one value, once, and you will never search it again.',
    options: [
      { text: 'Linear search', correct: true, why: 'One pass, about 500,000 comparisons on average, and no preparation at all.' },
      { text: 'Sort it, then binary search', why: 'The sort alone costs about 20 million comparisons. You would pay 40× the cost of just looking, to save 20 comparisons on a single lookup.' },
      { text: 'Build a hash set, then look up', why: 'Building it is a full pass plus the memory for a million entries — more work than the single pass you are trying to avoid.' },
      { text: 'Binary search', why: 'It needs sorted input. On unsorted data it does not give a wrong answer slowly, it gives a wrong answer quickly.' },
    ],
    explain: 'The question is always how many searches amortise the preparation. Sorting costs n log n to make each later lookup log n; that pays off over many searches and never pays off for one. "Binary search is faster than linear search" is a statement about lookups, not about the whole job.',
  },
  {
    id: 'choose:search-many',
    algo: 'binary',
    categoryName: 'Searching',
    difficulty: 1,
    prompt: 'Same million-item array — but now you will look up values in it a few million times, and it never changes.',
    options: [
      { text: 'Sort it once, then binary search', correct: true, why: 'One n log n sort, then 20 comparisons per lookup instead of 500,000. The sort is paid back within the first few lookups.' },
      { text: 'Linear search each time', why: 'About 500,000 comparisons per lookup, millions of times over. This is the case where the preparation obviously pays.' },
      { text: 'Sort it before every lookup', why: 'The data never changes, so sorting more than once is pure waste.' },
      { text: 'Interpolation search without sorting', why: 'It needs sorted input as much as binary search does, and it additionally assumes the values are evenly spread.' },
    ],
    explain: 'Same data, same operation, opposite answer — because the number of queries changed. Preparation is an investment, and whether it is worth making depends entirely on how many times you will draw on it.',
  },
  {
    id: 'choose:shortest-path-negative',
    algo: 'graph-bellman-ford',
    categoryName: 'Graphs',
    difficulty: 2,
    prompt: 'Cheapest route through a network of currency trades. Some edges have negative cost, because some trades make money.',
    options: [
      { text: "Bellman-Ford", correct: true, why: 'It handles negative edges, and tells you if there is a negative cycle — which here is an arbitrage loop you would want to know about.' },
      { text: "Dijkstra's algorithm", why: 'It assumes that settling the nearest unvisited node is final. A negative edge can improve a node after it is settled, so the answer is simply wrong — not slow, wrong.' },
      { text: 'Breadth-first search', why: 'BFS finds the fewest edges, not the cheapest route; it ignores weights entirely.' },
      { text: 'A* with a zero heuristic', why: 'That reduces to Dijkstra, and inherits the same broken assumption about negative edges.' },
    ],
    explain: 'Dijkstra rests on one assumption: that no route through unvisited nodes can be cheaper than the nearest one. A single negative edge destroys it. Bellman-Ford costs O(V·E) rather than O(E log V), and that extra factor of V buys negative edges and negative-cycle detection.',
  },
  {
    id: 'choose:mst-dense',
    algo: 'graph-prim',
    categoryName: 'Graphs',
    difficulty: 3,
    prompt: 'Minimum spanning tree of a dense graph — 2,000 nodes and nearly two million edges.',
    options: [
      { text: "Prim's algorithm", correct: true, why: 'It grows one tree and never sorts the edge list, which is the expensive part when E is close to V².' },
      { text: "Kruskal's algorithm", why: 'Correct, but it begins by sorting all two million edges. On a dense graph that sort is the dominant cost and Prim avoids it.' },
      { text: "Dijkstra's algorithm", why: 'It finds shortest paths from a source, not a minimum spanning tree. The two are close cousins — the key differs — but they answer different questions.' },
      { text: 'Depth-first search', why: 'It finds *a* spanning tree, with no regard for weight. Any spanning tree is not a minimum one.' },
    ],
    explain: 'Prim and Kruskal both give a minimum spanning tree; the choice is about density. Kruskal sorts E edges, so it suits sparse graphs; Prim does V heap operations over the frontier, so it suits dense ones. Same answer, different cost profile.',
  },
  {
    id: 'choose:pathfind-grid',
    algo: 'grid-astar',
    categoryName: 'Pathfinding',
    difficulty: 1,
    prompt: 'A game character has to cross a tile map to a known destination, with walls in the way, as fast as you can compute it.',
    options: [
      { text: 'A*', correct: true, why: 'It uses the distance to a known goal to steer the search, so it explores a fraction of what an uninformed search would.' },
      { text: 'Breadth-first search', why: 'It gives the same shortest path on an unweighted grid, but expands in every direction equally and so visits far more tiles.' },
      { text: "Dijkstra's algorithm", why: 'Equivalent to BFS here, and equally uninformed: with no heuristic it has no reason to prefer the direction of the goal.' },
      { text: 'Greedy best-first search', why: 'Faster still, but it only follows the heuristic and will happily return a path that is not the shortest.' },
    ],
    explain: 'A* is Dijkstra plus a hint. As long as the heuristic never overestimates the remaining distance it still finds a shortest path, while skipping the half of the map that leads away from the goal. Knowing where you are going is worth a great deal, and it is the one thing BFS and Dijkstra cannot use.',
  },
  {
    id: 'choose:dp-or-greedy',
    algo: 'dp-coin-change',
    categoryName: 'Dynamic Programming',
    difficulty: 3,
    prompt: 'Make 63p from coins of 1p, 5p, 21p and 25p, using as few coins as possible. Taking the largest coin that fits each time gives 25 + 25 + 5 + 1 + 1 + 1 + 1 + 1 + 1 + 1 + 1 — eleven coins. What finds the real answer?',
    options: [
      { text: 'Dynamic programming over every amount up to 63', correct: true, why: 'It considers every coin at every amount, so it finds 21 + 21 + 21 — three coins — which no greedy rule would reach.' },
      { text: 'Greedy, but sort the coins first', why: 'They are already in order. The problem is not the order, it is that taking the biggest coin now can rule out the better combination later.' },
      { text: 'Greedy, taking the smallest coin that fits', why: 'That is worse: 63 pennies.' },
      { text: 'Greedy is optimal; eleven coins is the answer', why: 'Greedy is optimal for some coin systems — including ordinary currency, which is designed that way — but not for this one. 21 + 21 + 21 is three coins.' },
    ],
    explain: 'Greedy works when a locally best choice is always part of some globally best answer. That holds for UK and US coins by design, and fails for {1, 5, 21, 25}: taking 25 leaves 38, which no longer reaches the 21s. Dynamic programming is slower precisely because it refuses to commit — it solves every smaller amount before deciding.',
  },
  {
    id: 'choose:substring-many',
    algo: 'str-rabin-karp',
    categoryName: 'String Matching',
    difficulty: 3,
    prompt: 'Scanning a large log file for any of 500 known error signatures, in a single pass.',
    options: [
      { text: 'Rabin-Karp', correct: true, why: 'One rolling hash per position can be checked against a set of 500 pattern hashes at once, so all of them are searched in one pass.' },
      { text: 'Knuth-Morris-Pratt, once per pattern', why: 'Each pass is O(n), but 500 of them is 500 passes over a large file. KMP is excellent for one pattern.' },
      { text: 'Boyer-Moore, once per pattern', why: 'The fastest single-pattern search here, and still 500 separate passes over the file.' },
      { text: 'Naive search, once per pattern', why: '500 passes, each of them the slowest option available.' },
    ],
    explain: 'Multi-pattern search is where Rabin-Karp wins, and it is the only thing it is clearly best at: a hash is a number, and comparing one number against a set is a set lookup. Single-pattern search belongs to Boyer-Moore or KMP. (Aho-Corasick is the purpose-built answer for many patterns, and this is the shape of its idea.)',
  },
  {
    id: 'choose:kth-element',
    algo: 'quickselect',
    categoryName: 'Searching',
    difficulty: 2,
    prompt: 'You need the median of ten million unsorted numbers. Nothing else — just the median.',
    options: [
      { text: 'Quickselect', correct: true, why: 'Partition, then recurse only into the side holding the rank you want: O(n) on average, without ever sorting.' },
      { text: 'Sort the array and take the middle', why: 'Correct, and it does far more work than asked — you sorted ten million items to read one of them. O(n log n) for an O(n) job.' },
      { text: 'A max-heap of the first half', why: 'Workable, O(n log n), and much more code than quickselect for no gain.' },
      { text: 'Count how many items each item is smaller than', why: 'That is O(n²) — a hundred trillion comparisons here.' },
    ],
    explain: 'Sorting is a common way to get an answer and rarely the cheapest. Quickselect reuses quicksort\'s partition step but discards half the problem instead of recursing into both sides, so the cost is n + n/2 + n/4 + … = 2n. Asking for less lets you pay less.',
  },
  {
    id: 'choose:cycle-dependencies',
    algo: 'graph-topo',
    categoryName: 'Graphs',
    difficulty: 2,
    prompt: 'A build system has to compile modules in dependency order, and report a clear error if the dependencies are circular.',
    options: [
      { text: 'Topological sort', correct: true, why: 'It produces a valid order when one exists, and the fact that it cannot finish is itself the cycle detection.' },
      { text: 'Breadth-first search from each module', why: 'It explores the graph but produces no ordering, which is the actual requirement.' },
      { text: 'Sort the modules by number of dependencies', why: 'A plausible-sounding rule that is simply wrong: a module with one dependency may still have to wait for a long chain behind it.' },
      { text: "Dijkstra's algorithm", why: 'Shortest paths, not an ordering. Edge weights have no meaning here.' },
    ],
    explain: 'Topological sort is the answer whenever "do these in an order that respects the constraints" is the problem — build systems, task schedulers, spreadsheet recalculation. Kahn\'s version falls out of it: if nodes remain but none has an in-degree of zero, everything left is in a cycle, and that is your error message.',
  },
  {
    id: 'choose:prefix-autocomplete',
    algo: 'trie-search',
    categoryName: 'Trees',
    difficulty: 2,
    prompt: 'A search box must suggest every word beginning with what has been typed so far, updating on each keystroke.',
    options: [
      { text: 'A trie', correct: true, why: 'Walk one edge per character typed, and everything below that node is exactly the set of completions.' },
      { text: 'A hash set of all the words', why: 'Hashing gives you exact lookup and nothing else: a hash destroys the prefix structure, which is the only thing you need here.' },
      { text: 'A sorted array with binary search', why: 'Workable — the prefix matches form a contiguous block — but each keystroke costs another log n search, and you still need the block boundaries.' },
      { text: 'Linear scan with startsWith', why: 'O(total words) per keystroke. Fine for a hundred words, hopeless for a dictionary.' },
    ],
    explain: 'Pick the structure that matches the question you will ask. A hash table answers "is this exact string present". A trie answers "what starts with this", because the shared prefix is the shared path, and the cost depends on the length of the word rather than on how many words there are.',
  },
  {
    id: 'choose:huge-range-small-count',
    algo: 'counting',
    categoryName: 'Sorting',
    difficulty: 3,
    prompt: 'Sorting ten million integers, all of which are between 0 and 100.',
    options: [
      { text: 'Counting sort', correct: true, why: '101 counters, one pass to fill them and one to write the output: O(n + k) with k = 101, and no comparisons at all.' },
      { text: 'Quick sort', why: 'About 230 million comparisons for something achievable in two linear passes. With this many duplicates a plain quicksort also degrades badly.' },
      { text: 'Radix sort', why: 'It would work and is the right idea at larger scale, but with a range of 101 the single counting pass is simpler and faster.' },
      { text: 'Timsort', why: 'Comparison-based, so it is bound by n log n. The narrow value range is the fact worth exploiting, and Timsort cannot exploit it.' },
    ],
    explain: 'The n log n lower bound applies to algorithms that learn about the data by comparing pairs. Counting sort does not compare — it uses the values as array indices, which is extra information a comparison sort never has. The catch is always k: brilliant for 0–100, unusable for arbitrary 64-bit integers.',
  },
];

/* ────────── spot the complexity ────────── */

const COMPLEXITY = [
  {
    id: 'cx:halving-loop',
    categoryName: 'Complexity',
    difficulty: 1,
    prompt: 'What is the running time of this, in terms of n?',
    code: `let count = 0;
for (let i = n; i > 1; i = i / 2) {
  count++;
}`,
    options: [
      { text: 'O(log n)', correct: true, why: 'i is halved each time, so the number of iterations is how many halvings reach 1 — log₂ n.' },
      { text: 'O(n)', why: 'The counter would be linear if i decreased by a fixed amount. Dividing is what makes it logarithmic.' },
      { text: 'O(n / 2)', why: 'That is O(n) with a constant attached, and in any case the loop variable is divided, not the iteration count.' },
      { text: 'O(√n)', why: 'Square-root behaviour comes from a loop whose bound is √n or whose step grows; halving gives a logarithm.' },
    ],
    explain: 'Multiplying or dividing the loop variable by a constant gives a logarithm; adding or subtracting a constant gives a linear count. This single pattern is behind binary search, heap operations and balanced-tree depth.',
  },
  {
    id: 'cx:nested-dependent',
    categoryName: 'Complexity',
    difficulty: 2,
    prompt: 'How many times does the body of the inner loop run?',
    code: `for (let i = 0; i < n; i++) {
  for (let j = i; j < n; j++) {
    visit(i, j);
  }
}`,
    options: [
      { text: 'O(n²)', correct: true, why: 'n + (n−1) + … + 1 = n(n+1)/2, and halving a quadratic leaves it quadratic.' },
      { text: 'O(n log n)', why: 'There is no halving or doubling here. Both loops are linear, and nesting two linear loops is quadratic.' },
      { text: 'O(n)', why: 'The outer loop runs n times and the inner one runs many times for each, so the total cannot be linear.' },
      { text: 'O(n² / 2)', why: 'Arithmetically right and not a complexity class: big-O drops constant factors, so this is O(n²).' },
    ],
    explain: 'The inner loop starting at i rather than 0 halves the work, which matters in practice and not at all asymptotically. Being comfortable discarding that ½ is most of what reading big-O is.',
  },
  {
    id: 'cx:sequential-not-nested',
    categoryName: 'Complexity',
    difficulty: 1,
    prompt: 'These two loops are one after the other, not nested. What is the total?',
    code: `for (let i = 0; i < n; i++) sumA += a[i];

for (let j = 0; j < n; j++) sumB += b[j];`,
    options: [
      { text: 'O(n)', correct: true, why: 'n + n = 2n, and the constant drops: still linear.' },
      { text: 'O(n²)', why: 'That would be right if the second loop were inside the first. Sequential code adds; nested code multiplies.' },
      { text: 'O(2n)', why: 'The same as O(n) — big-O has no room for a leading constant.' },
      { text: 'O(n log n)', why: 'Nothing here halves or doubles, so no logarithm can appear.' },
    ],
    explain: 'Sequential steps add, nested steps multiply. Everything else about reading complexity follows from keeping those two straight.',
  },
  {
    id: 'cx:nested-log',
    categoryName: 'Complexity',
    difficulty: 2,
    prompt: 'A linear loop containing a halving loop:',
    code: `for (let i = 0; i < n; i++) {
  for (let j = n; j > 1; j = j / 2) {
    step(i, j);
  }
}`,
    options: [
      { text: 'O(n log n)', correct: true, why: 'n iterations outside, log n inside, and nested loops multiply.' },
      { text: 'O(n²)', why: 'That would need the inner loop to be linear too. It is halved each time, so it contributes log n.' },
      { text: 'O(log n)', why: 'That is the inner loop alone, ignoring the n times it is entered.' },
      { text: 'O(n + log n)', why: 'Adding is for sequential code. These are nested, so the costs multiply.' },
    ],
    explain: 'This is the shape of heapsort and of "do a binary search for every element": a linear sweep with a logarithmic step inside it. Recognising it is usually what tells you an n log n algorithm when you see one.',
  },
  {
    id: 'cx:string-concat',
    categoryName: 'Complexity',
    difficulty: 3,
    prompt: 'The loop runs n times. What is the real cost of this function?',
    code: `function join(words) {    // n words, each short
  let out = '';
  for (const w of words) {
    out = out + w;          // strings are immutable
  }
  return out;
}`,
    options: [
      { text: 'O(n²)', correct: true, why: 'Each concatenation copies the whole string built so far, so the copying is 1 + 2 + … + n characters.' },
      { text: 'O(n)', why: 'The loop runs n times, but the work inside it is not constant — it grows with the output so far, and that is the catch.' },
      { text: 'O(n log n)', why: 'There is no halving. Some runtimes optimise this pattern, but the written algorithm copies linearly each time.' },
      { text: 'O(1), the compiler fixes it', why: 'Some engines do optimise repeated concatenation, and relying on that is how this becomes a production incident on another runtime.' },
    ],
    explain: 'Counting loop iterations is not the same as counting work. An O(n) loop whose body costs O(n) is O(n²), and immutable strings make concatenation exactly that — which is why every language with immutable strings also ships a builder or a join.',
  },
  {
    id: 'cx:recursive-double',
    categoryName: 'Complexity',
    difficulty: 2,
    prompt: 'Two recursive calls per level, each on n − 1:',
    code: `function f(n) {
  if (n <= 1) return 1;
  return f(n - 1) + f(n - 1);
}`,
    options: [
      { text: 'O(2ⁿ)', correct: true, why: 'Each call makes two more and the depth is n, so the call tree has about 2ⁿ nodes.' },
      { text: 'O(n²)', why: 'Two calls per level is not the same as squaring. The branching compounds with depth, which gives an exponential.' },
      { text: 'O(n)', why: 'That would be one recursive call per level. Two is what makes it explode.' },
      { text: 'O(n log n)', why: 'No halving anywhere: the argument drops by one each time, not by half.' },
    ],
    explain: 'The recursion does not divide the problem, it duplicates it: T(n) = 2·T(n−1) gives 2ⁿ. Compare merge sort, T(n) = 2·T(n/2) + n, which gives n log n — two calls each, but on half the input, and that is the entire difference between tractable and not.',
  },
  {
    id: 'cx:memoised',
    categoryName: 'Complexity',
    difficulty: 2,
    prompt: 'The same function with a cache. Now what?',
    code: `const seen = new Map();
function f(n) {
  if (n <= 1) return 1;
  if (seen.has(n)) return seen.get(n);
  const r = f(n - 1) + f(n - 1);
  seen.set(n, r);
  return r;
}`,
    options: [
      { text: 'O(n)', correct: true, why: 'There are only n distinct arguments, each computed once; every other call is a cache hit.' },
      { text: 'O(2ⁿ)', why: 'That is the cost without the cache. The second f(n−1) now returns immediately instead of re-expanding the whole tree.' },
      { text: 'O(n²)', why: 'Each distinct argument does a constant amount of work, so n arguments is linear, not quadratic.' },
      { text: 'O(log n)', why: 'Every value from 1 to n is needed at least once, so it cannot be sublinear.' },
    ],
    explain: 'This is the whole of dynamic programming in one diff. Count the distinct subproblems and multiply by the cost of combining each — here n subproblems at O(1), so O(n). Exponential to linear by refusing to compute the same thing twice.',
  },
  {
    id: 'cx:amortised-push',
    categoryName: 'Complexity',
    difficulty: 3,
    prompt: 'A dynamic array doubles its capacity whenever it fills up, copying everything across. What is the cost of one push?',
    options: [
      { text: 'O(1) amortised, O(n) in the worst case', correct: true, why: 'Most pushes are constant; the occasional doubling costs n, but it happens rarely enough that the average over any run of pushes is constant.' },
      { text: 'O(n), because it may copy everything', why: 'True of a single unlucky push, and it misleads about the sequence: n pushes cost O(n) in total, not O(n²).' },
      { text: 'O(1) always', why: 'The push that triggers a resize genuinely copies n items. Amortised O(1) is a claim about the total, not about every call.' },
      { text: 'O(log n), one for each doubling', why: 'There are log n doublings, but their cost is the items copied, not the number of doublings.' },
    ],
    explain: 'Doubling from 1 to n copies 1 + 2 + 4 + … + n/2 < n items in total, spread over n pushes — so the copying adds less than one item of work per push on average. This is why doubling and not "grow by 10": growing by a fixed amount gives n/10 resizes copying O(n) each, which is quadratic.',
  },
  {
    id: 'cx:sort-then-scan',
    categoryName: 'Complexity',
    difficulty: 1,
    prompt: 'A sort followed by a single pass. What dominates?',
    code: `items.sort((a, b) => a - b);     // n log n

for (const it of items) {         // n
  check(it);
}`,
    options: [
      { text: 'O(n log n)', correct: true, why: 'The larger term wins: n log n + n is O(n log n).' },
      { text: 'O(n log n + n)', why: 'Correct arithmetic, not a complexity class — smaller terms are dropped, so this is O(n log n).' },
      { text: 'O(n²)', why: 'The two steps are sequential, so their costs add. Nothing here multiplies.' },
      { text: 'O(n)', why: 'That is the scan alone; the sort is the expensive half and cannot be ignored.' },
    ],
    explain: 'Sequential costs add and big-O keeps only the largest term, so one n log n step makes any number of linear passes free in asymptotic terms. It is also why "I added another pass" is usually not where a performance problem is.',
  },
  {
    id: 'cx:two-pointer',
    categoryName: 'Complexity',
    difficulty: 3,
    prompt: 'Two pointers, but look carefully at when each one moves:',
    code: `let i = 0, j = 0, best = 0;
while (j < n) {
  total += a[j];
  while (total > limit) {
    total -= a[i];
    i++;
  }
  best = Math.max(best, j - i + 1);
  j++;
}`,
    options: [
      { text: 'O(n)', correct: true, why: 'Each pointer only ever moves forwards, so between them they take at most 2n steps however the loops nest.' },
      { text: 'O(n²)', why: 'The nesting suggests it, but i never resets — the inner loop can only run n times in total across the whole execution, not n times per outer step.' },
      { text: 'O(n log n)', why: 'No halving or doubling anywhere.' },
      { text: 'It depends on limit', why: 'limit changes which windows qualify, not how far the pointers travel. Each still moves at most n times.' },
    ],
    explain: 'A nested loop is not automatically quadratic. The test is how many times the inner body can run in total: here i only increases, so it contributes at most n steps for the entire function. This sliding-window argument is the same accounting that makes Knuth-Morris-Pratt linear.',
  },
];

/* ────────── find the bug ────────── */

const BUGS = [
  {
    id: 'bug:binary-overflow-mid',
    algo: 'binary',
    categoryName: 'Searching',
    difficulty: 2,
    prompt: 'This binary search returns the wrong answer for some inputs. Which input breaks it?',
    code: `function search(a, target) {
  let lo = 0, hi = a.length - 1;
  while (lo < hi) {                  // ← note: < not <=
    const mid = (lo + hi) >> 1;
    if (a[mid] === target) return mid;
    if (a[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}`,
    options: [
      { text: 'Any array where the target is the only candidate left — a one-element array, or the last position checked', correct: true, why: 'When lo === hi the loop exits without testing that position, so a target sitting there is never found.' },
      { text: 'An array with duplicate values', why: 'Duplicates make *which* index you get ambiguous, but this version still finds one of them.' },
      { text: 'An unsorted array', why: 'True of every binary search and not this bug — the code is wrong even on perfectly sorted input.' },
      { text: 'An array with an even number of elements', why: 'The midpoint rounds down, which is fine either way. The parity is not the problem.' },
    ],
    explain: '`while (lo < hi)` skips the final candidate: once the window narrows to one position, lo === hi and the loop ends untested. `search([5], 5)` returns −1. The fix is `lo <= hi`, and this off-by-one is the classic binary search bug — famously present in the JDK for nine years.',
  },
  {
    id: 'bug:bubble-early-exit',
    algo: 'bubble',
    categoryName: 'Sorting',
    difficulty: 2,
    prompt: 'This bubble sort leaves some arrays unsorted. What input shows it?',
    code: `function sort(a) {
  for (let i = 0; i < a.length; i++) {
    let swapped = false;
    for (let j = 0; j < a.length - 1 - i; j++) {
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        swapped = true;
      }
    }
    if (!swapped) break;
  }
  return a;
}`,
    options: [
      { text: 'Nothing — this one is correct', correct: true, why: 'The early exit is sound: a pass with no swaps proves every adjacent pair is in order, which means the array is sorted.' },
      { text: 'A reversed array', why: 'The worst case for speed, and it sorts correctly — every pass swaps, so the early exit never fires.' },
      { text: 'An array with duplicates', why: '`>` rather than `>=` means equal neighbours are left alone, which is correct and also what keeps it stable.' },
      { text: 'A single-element array', why: 'The inner loop does not run, the first pass records no swaps, and it exits. Correct, if trivially.' },
    ],
    explain: 'Not every question has a bug, and "find the bug" is only a real test if sometimes there is not one. The reasoning that matters here is why the early exit is valid: sortedness is exactly the property that every adjacent pair is in order, so a pass with no swaps is a proof and not a guess.',
  },
  {
    id: 'bug:quicksort-pivot-equal',
    algo: 'quick',
    categoryName: 'Sorting',
    difficulty: 3,
    prompt: 'This partition loops forever on certain inputs. Which?',
    code: `function partition(a, lo, hi) {
  const pivot = a[lo];
  let i = lo, j = hi;
  while (i < j) {
    while (a[i] <= pivot) i++;      // ← no bound check
    while (a[j] > pivot) j--;
    if (i < j) [a[i], a[j]] = [a[j], a[i]];
  }
  return j;
}`,
    options: [
      { text: 'An array where every element is equal, or where the pivot is the largest', correct: true, why: '`a[i] <= pivot` never fails, so i walks off the end of the array into undefined, and the comparison with undefined keeps the loop going.' },
      { text: 'An already-sorted array', why: 'That is quicksort\'s classic O(n²) case — slow, not broken. This code hangs, which is a different failure.' },
      { text: 'An array containing negative numbers', why: 'Sign has no bearing on it; the comparisons work the same.' },
      { text: 'An empty array', why: 'Worth guarding, but the hang needs the scan to run off the end, which takes elements to scan past.' },
    ],
    explain: 'An unguarded scanning loop needs a sentinel or a bound, and `[3, 3, 3, 3]` supplies neither: nothing is greater than the pivot, so `while (a[i] <= pivot) i++` runs past the end. Equal elements are the input people forget to test, which is why three-way partitioning exists.',
  },
  {
    id: 'bug:dijkstra-visited',
    algo: 'graph-dijkstra',
    categoryName: 'Graphs',
    difficulty: 3,
    prompt: 'This Dijkstra gives wrong distances on some graphs. Which?',
    code: `while (queue.size) {
  const u = queue.popMin();
  for (const { to, w } of adj[u]) {
    if (dist[u] + w < dist[to]) {
      dist[to] = dist[u] + w;
      queue.push(to);
    }
  }
}
// no 'visited' set — nodes can be processed more than once`,
    options: [
      { text: 'A graph with a negative edge weight', correct: true, why: 'Without negative edges the missing visited set costs extra work but not correctness. With one, a settled node can be improved later, and the answer is wrong.' },
      { text: 'A disconnected graph', why: 'Unreachable nodes simply keep their initial infinite distance, which is the right answer.' },
      { text: 'A graph with a cycle', why: 'Ordinary positive-weight cycles are fine: going round one only ever makes a path longer, so no distance improves.' },
      { text: 'A graph with duplicate edge weights', why: 'Ties affect which equally-short path is reported, not the distances.' },
    ],
    explain: 'The missing visited set is a performance bug on a positive-weight graph — the same node may be popped repeatedly — and it masks the deeper point: Dijkstra is wrong on negative edges whether or not you track visited nodes. Its correctness rests on the assumption that the nearest unsettled node is final, and a negative edge is exactly what breaks that assumption.',
  },
  {
    id: 'bug:merge-stability',
    algo: 'merge',
    categoryName: 'Sorting',
    difficulty: 3,
    prompt: 'This merge sort is correct but no longer stable. What is the one character to blame?',
    code: `while (i < left.length && j < right.length) {
  if (left[i] <= right[j]) out.push(left[i++]);
  else                     out.push(right[j++]);
}
// changed to:
while (i < left.length && j < right.length) {
  if (left[i] < right[j]) out.push(left[i++]);
  else                    out.push(right[j++]);
}`,
    options: [
      { text: '`<` instead of `<=`: on a tie it now takes from the right half first', correct: true, why: 'Equal elements must come from the left half to keep their original relative order, and strict `<` sends ties to the right.' },
      { text: 'The post-increments', why: '`i++` inside the push is only terse — it reads and then advances, which is what is wanted.' },
      { text: 'The loop condition', why: 'Identical in both versions, and correct: it stops when either half runs out.' },
      { text: 'Nothing — stability is about the algorithm, not the comparison', why: 'The opposite: for merge sort, stability lives entirely in this tie-break. The structure is unchanged and the guarantee is gone.' },
    ],
    explain: 'Merge sort is stable because of one character. Equal elements must be taken from the left run, since the left run held the earlier items; `<` takes from the right on a tie and silently loses the guarantee. The sort still returns a correctly sorted array, so no test that only checks order will notice.',
  },
  {
    id: 'bug:recursive-no-base',
    algo: 'tree-inorder',
    categoryName: 'Trees',
    difficulty: 1,
    prompt: 'This traversal crashes. On what?',
    code: `function inorder(node, out) {
  inorder(node.left, out);
  out.push(node.value);
  inorder(node.right, out);
  return out;
}`,
    options: [
      { text: 'Any tree at all, including a single node', correct: true, why: 'There is no null check, so it recurses into the leaves\' missing children and dereferences null immediately.' },
      { text: 'Only an unbalanced tree', why: 'Shape is irrelevant: the first leaf reached has a null left child, and that is enough.' },
      { text: 'Only a tree deeper than the stack allows', why: 'A deep tree does overflow the stack, but this fails on a one-node tree long before depth matters.' },
      { text: 'An empty tree only', why: 'It fails on that too, and on every non-empty tree as well.' },
    ],
    explain: 'The missing `if (!node) return out;` is the base case, and a recursion without one does not terminate. Worth contrasting with the stack-overflow failure: that one needs a tree of 10,000 nodes, this one needs a tree of 1 — which is why the base case is the first thing to look for and the first thing to test.',
  },
];

/* ──────────────────────────────────────────────────────────── */

const tag = (kind) => (q) => ({ ...q, kind });

export const BANK = [
  ...CHOOSE.map(tag('choose')),
  ...COMPLEXITY.map(tag('complexity')),
  ...BUGS.map(tag('bug')),
];

/**
 * Shuffle a question's options.
 *
 * The bank above lists the correct answer first, because that is how it
 * stays readable as source. Shown in that order it is not a quiz: an
 * automated run that always clicked the first option scored 27 out of
 * 30. Callers must put every question through this before showing it.
 *
 * This is the one piece of randomness in the app that deliberately does
 * not come from rng.js. Everything else is seeded so that a shared link
 * reproduces exactly; option order is the opposite requirement, because
 * a reproducible shuffle is one you can learn the shape of.
 */
export function withShuffledOptions(q) {
  const options = [...q.options];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { ...q, options };
}

export const KINDS = {
  predict:    { label: 'Predict the next step', blurb: 'A real run, paused. What happens next?' },
  trace:      { label: 'Trace it by hand',      blurb: 'An exact input. How much work does it take?' },
  choose:     { label: 'Which would you use?',  blurb: 'A situation, and four defensible-looking answers.' },
  complexity: { label: 'Spot the complexity',   blurb: 'A snippet. What does it cost?' },
  bug:        { label: 'Find the bug',          blurb: 'A broken implementation. What input breaks it?' },
};
