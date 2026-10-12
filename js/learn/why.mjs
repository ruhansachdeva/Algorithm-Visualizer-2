/* ============================================================
   Where the running time comes from.

   The cost table says O(n²); this says which two loops multiply, and
   why the answer could not have been anything else. The aim is the
   sentence that makes the figure stop being arbitrary.

   Not every algorithm has an entry. IDEAS.md is right that content is
   the whole cost here, and a derived, hedging paragraph is worse than
   no paragraph: the page simply leaves the section out when there is
   nothing worth saying yet. Everything else on the page — the cost
   table, the measurement, the trade-offs — is there for all 94.
   ============================================================ */

export const WHY = {
  /* ───────────────────────── sorting ───────────────────────── */

  bubble: 'Two nested loops over the same list. The outer one runs n times because a single pass can only move one item all the way to its end of the list, and the inner one walks what is left, so the comparisons are n + (n−1) + (n−2) + … = n(n+1)/2. Halve it and drop the constant and you have n². The best case is O(n) only because of the early exit: a pass with no swaps proves the list is already sorted.',

  cocktail: 'The same n(n+1)/2 comparisons as bubble sort, in both directions. Alternating the pass direction fixes one specific weakness — a small value stranded at the far end, which a one-way bubble sort drags back one position per pass — but it halves a constant rather than changing the shape, so it is still quadratic.',

  selection: 'n passes, and pass i scans the n−i unsorted items to find the smallest. That is the same n(n+1)/2 sum, but with one crucial difference from bubble sort: the comparisons are unavoidable, because you cannot know the minimum without looking at everything, while the writes are only n. That is why selection sort is the one to use when a write is far more expensive than a read.',

  insertion: 'Each new item walks backwards through the sorted part until it finds its place. The distance it walks is the number of items already larger than it — the number of inversions in the input. On random data that averages n²/4, giving O(n²). On nearly-sorted data it averages a constant, giving O(n). Insertion sort is not slow; it is fast when the input is nearly ordered, which is exactly why Timsort uses it on small runs.',

  'binary-insertion': 'Binary search finds the insertion point in log n comparisons instead of walking back one at a time, so the comparisons drop to O(n log n). The total is still O(n²), because finding the place was never the expensive part: inserting into an array means shifting everything after it along, and that shift is O(n) no matter how you located the spot.',

  shell: 'Insertion sort run several times with a gap, each pass moving items a long way cheaply, so that the final gap-1 pass has an almost-sorted list to finish. The cost depends entirely on the gap sequence and nobody has a tight bound for the good ones — Ciura\'s, used here, measures at roughly n^1.3 and has no proof at all. It is the one algorithm on this page whose complexity is an empirical result.',

  comb: 'Bubble sort with Shell sort\'s idea bolted on: shrink the comparison gap by about 1.3 each pass. Large gaps kill off the stranded small values that make bubble sort quadratic, and the final gap-1 pass has little left to do. The bound is not known in closed form, which is why the table gives it in terms of the number of shrinks.',

  gnome: 'Insertion sort written with one pointer that steps forward on a correct pair and backwards on a wrong one. The total number of backward steps is the number of inversions, exactly as in insertion sort, so the cost is identical — n²/4 on average. It is here because the loop is almost too simple to get wrong, not because it is fast.',

  'odd-even': 'Compare-and-swap every odd-indexed pair, then every even-indexed pair, and repeat. It needs n phases, each doing n/2 comparisons, so O(n²) on one processor. The reason it exists is the part this view cannot show: every comparison within a phase is independent, so with n/2 processors it finishes in O(n) time.',

  merge: 'The recursion halves the list until the pieces are single items, which takes log n levels, and merging the pieces at any one level touches every item exactly once, so each level costs n. n per level times log n levels is n log n, and there is no best or worst case because the halving does not depend on the values. The price is the O(n) scratch array: the merge cannot be done in place without giving up either the time or the stability.',

  timsort: 'Merge sort that looks for order already present. It finds the natural runs — stretches already ascending or descending — and merges those instead of starting from single items. Random data has runs of about 3, so you save almost nothing and it is n log n. Real data arrives in sorted chunks, and if the input is one run the whole sort is a single O(n) scan. That is why it is the standard library sort in Python and Java.',

  quick: 'Partitioning is one O(n) pass. The question is how many levels of partitioning there are, and that is decided by the pivot. A pivot near the median halves the problem, giving log n levels and n log n overall. A pivot at the extreme peels off one item, giving n levels and n² overall — which is exactly what happens on already-sorted input with a last-element pivot. The average is n log n because most pivots are good enough: you need a persistently terrible pivot, not an occasional one.',

  'quick-3way': 'Quicksort with the equal items collected in the middle rather than pushed to one side. On distinct values it behaves like ordinary quicksort. On input with many duplicates it is much better: a list of n items with k distinct values sorts in O(n log k), and a list that is all one value is a single O(n) pass, where ordinary quicksort degrades towards n².',

  heap: 'Two phases. Building the heap is O(n) — not n log n, because most nodes are near the leaves and sift down barely at all. Then n extractions, each sifting a value down through a tree of height log n, giving n log n. Heapsort is the only one here that is both n log n in the worst case and in place; the reason it still loses to quicksort in practice is that sifting jumps around the array and defeats the cache.',

  counting: 'No comparisons at all, which is why it can beat the n log n bound — that bound only applies to algorithms that learn about the data by comparing. Instead it counts how many of each value there are, which is O(n), then walks the counts to write the output, which is O(k) for a value range of k. Hence O(n + k). The catch is in that k: counting sort on 32-bit integers needs four billion counters.',

  radix: 'Counting sort applied one digit at a time, least significant first, which works only because counting sort is stable — each pass has to preserve the order the previous passes established. d passes over n items gives O(d·n). It looks linear, and it is, for fixed-width keys; but d is about log(range)/log(base), so the log has not vanished, it has moved into the key width.',

  bucket: 'Scatter the items into b buckets by value, sort each bucket, concatenate. If the data is uniform, every bucket holds about n/b items and the whole thing is O(n + k). If it is not, the work piles into one bucket and you pay whatever the inner sort costs on n items. This implementation keeps the bucket count fixed, so as n grows each bucket grows with it — which is why the measurement on this page comes out quadratic rather than linear, and is a fair illustration of the assumption bucket sort rests on.',

  cycle: 'Built to do the theoretical minimum number of writes: every item is written at most once, to the position it belongs in, so the writes are O(n) and no algorithm can do better. Finding that position means counting how many items are smaller, which is a full O(n) scan per item, hence O(n²) comparisons. It is the clearest case on this page of trading one cost right up against another.',

  pancake: 'You may only reverse a prefix. Bring the largest unplaced item to the front, then flip it to its final position: two flips per item, so O(n) flips, each costing O(n) to perform. The interesting number is the flip count rather than the time, and the question of the fewest flips that always suffice was open for decades.',

  bogo: 'Shuffle and check whether it happens to be sorted. One of the n! orderings is correct, so the expected number of shuffles is n!, each costing O(n) to check — hence O(n·n!). There is no worst case, because a run of bad luck has no upper bound. 10 items average around 3.6 million shuffles; 20 items average more shuffles than there are seconds in the age of the universe.',

  /* ──────────────────────── searching ──────────────────────── */

  linear: 'Look at each item until you find it. A hit lands halfway through on average, which is n/2 comparisons, and a miss costs all n. Both are O(n). It is the only search here that needs nothing of the data — no sorting, no indexing, no structure — and for a few dozen items it beats everything, because the comparison is all it does.',

  binary: 'Each comparison discards half of what is left, so from n candidates you reach one in log₂ n steps. 1,000 items take 10 comparisons, a million take 20, a billion take 30: every doubling of the data adds exactly one step. That is the strongest thing you can say about any algorithm on this page, and the whole cost of it is that the data must be sorted first.',

  jump: 'Step forward in blocks of size k until you overshoot, then walk back through the block. That is n/k jumps plus k steps, and minimising n/k + k gives k = √n and a cost of 2√n. It is worse than binary search but reads the data in order, which matters if a jump backwards is expensive — searching a tape, or a linked structure you can only walk forwards.',

  exponential: 'Double the bound — 1, 2, 4, 8 — until it overshoots the target, then binary search the range you have bracketed. Finding the bracket takes log i steps for a target at position i, and the binary search inside it takes another log i. The point is that the cost depends on where the answer is, not on how big the list is, so it works on a list of unknown or unbounded length.',

  interpolation: 'Binary search that guesses where the value should be instead of splitting down the middle, the way you open a dictionary near the back for "zebra". On uniformly distributed data the guess is so good that the cost is O(log log n) — about 5 probes for a million items against binary search\'s 20. On skewed data the guess is consistently wrong and it degrades to O(n), which is worse than the algorithm it is trying to improve on.',

  ternary: 'Split into three parts with two comparisons per step instead of two parts with one. That gives log₃ n steps, which sounds better than log₂ n until you count comparisons: 2·log₃ n is about 1.26·log₂ n, so it does about 26% more work than binary search. It is a clean demonstration that fewer levels does not mean less work.',

  'fib-search': 'Binary search using Fibonacci numbers to pick the split, so the index arithmetic is addition and subtraction with no division or midpoint. Still O(log n), with a slightly worse constant than binary search. It was genuinely useful on hardware where division was expensive, and it is a good reminder that "the same complexity" and "the same speed" are different claims.',

  quickselect: 'Quicksort that only recurses into the side containing the rank it wants. Each partition is O(n) and the remaining range shrinks by a constant factor on average, so the total is n + n/2 + n/4 + … = 2n, which is O(n) — you can find the median without sorting. The worst case is still O(n²) on bad pivots, and the fix, median-of-medians, guarantees linear time with a constant large enough that nobody uses it.',

  /* ───────────────────── graphs and paths ──────────────────── */

  'graph-bfs': 'Every node enters the queue once and leaves once, and when it leaves, every edge out of it is examined once. That is O(V) node work plus O(E) edge work: O(V + E), which is linear in the size of the graph and cannot be improved on, since you have to look at the graph to search it. On an unweighted graph the first time BFS reaches a node is by a shortest path, because it finishes every node at distance d before starting any at d + 1.',

  'graph-dfs': 'The same accounting as breadth-first search — each node visited once, each edge examined once, O(V + E) — with a stack in place of a queue. That single change gives up the shortest-path guarantee and gains the structure that topological sort, cycle detection, bridges and strongly connected components are all built on: the order in which depth-first search enters and leaves nodes.',

  'graph-dijkstra': 'Each node is settled once, and settling it means examining its edges and possibly pushing a shorter distance into the priority queue. That is V removals and up to E pushes, each O(log V) in a binary heap, giving O(E log V). The guarantee it rests on is that the nearest unsettled node cannot be improved by any longer route — which is why a single negative edge breaks it completely.',

  'graph-bellman-ford': 'Relax every edge, V−1 times over. A shortest path visits at most V−1 edges, and each full round guarantees one more edge of every shortest path is correct, so V−1 rounds is enough. E edges times V rounds is O(V·E) — much worse than Dijkstra, bought for two things Dijkstra cannot do: negative edges, and detecting a negative cycle, which shows up as a distance that is still improving on round V.',

  'graph-floyd-warshall': 'Three nested loops over the nodes: for every intermediate k, every source i and every target j, ask whether going via k is shorter. V³ exactly, with no best case. For a sparse graph, running Dijkstra from every node is better. For a dense one, or when you want every pair in one table, V³ with a tiny constant and no data structures wins — the inner loop is two array reads, an add and a compare.',

  'graph-union-find': 'The structure behind Kruskal\'s algorithm. Union by rank keeps the trees shallow and path compression flattens them as a side effect of each lookup; together they give an amortised cost of O(α(n)), the inverse Ackermann function, which is below 5 for any n that fits in the universe. It is effectively constant, and it is the standard example of amortised analysis telling you something a worst-case bound cannot.',

  'graph-kruskal': 'Sort the edges, then add each one whose endpoints are not already connected. The sort is O(E log E) and dominates, because the connectivity checks are near-constant with union-find. It is the greedy argument in its clearest form: the cheapest edge crossing any cut must be in some minimum spanning tree, so taking the cheapest safe edge every time cannot go wrong.',

  'graph-prim': 'Grow one tree, always taking the cheapest edge leaving it. With a binary heap that is O(E log V), the same shape as Dijkstra and for the same reason — the two algorithms differ only in whether the key is "distance from the start" or "distance from the tree". Prim beats Kruskal on dense graphs, where sorting every edge is the expensive part.',

  'graph-tarjan': 'Strongly connected components in one depth-first pass, O(V + E), where the obvious approach needs two passes over two graphs. The trick is the low-link number: the earliest node reachable from a subtree. A node whose low-link equals its own index is the root of a component, and everything above it on the stack belongs to that component.',

  'graph-max-flow': 'Find any path with spare capacity, push as much as it will take, repeat. Each search is O(E), and the bound on the number of searches is what the variants argue about: BFS always picking the shortest augmenting path — Edmonds-Karp, used here — gives O(V·E²). The idea that makes it correct is the residual edge, which lets flow be pushed back and a bad earlier choice undone.',

  /* ───────────────────────── trees ──────────────────────────── */

  'bst-insert': 'One insert walks from the root to a leaf, so it costs the height of the tree. A balanced tree has height log n, which is the O(log n) in the table. Nothing in a plain BST enforces that: insert already-sorted values and every node becomes the right child of the last, the height becomes n, and the tree is a linked list with extra steps. That failure is the entire reason AVL and red-black trees exist.',

  'avl-insert': 'A BST that re-checks the height difference of every node on the path back up, and rotates when it exceeds one. A rotation is O(1) and at most two fix any insert, so the insert stays O(log n) while the height is guaranteed below 1.44·log n. The balance is stricter than a red-black tree\'s, which makes lookups slightly faster and updates slightly more expensive.',

  'rb-insert': 'Balance kept with one bit per node instead of a height. The invariants — no red node has a red child, and every root-to-leaf path crosses the same number of black nodes — force the height below 2·log n. Fixing a violation is a recolour, which may push the problem up one level, or a rotation, which ends it; so an insert does at most O(log n) recolours and at most two rotations. Fewer rotations than AVL is why this is the tree inside std::map and TreeMap.',

  'heap-ops': 'A binary heap promises only that a parent beats its children, which is far weaker than a BST\'s ordering and therefore far cheaper to maintain: push or pop sifts one value along one root-to-leaf path, O(log n), with the tree held in a flat array and no pointers at all. The weak promise is also the limit — finding the minimum is instant, and finding anything else means looking at everything.',

  'segtree-query': 'A range query walks down from the root and stops as soon as a node\'s range lies entirely inside the query, so it never looks inside the big blocks it can use whole. Any range decomposes into at most two such nodes per level, which bounds the visited nodes at O(log n). That is the trade: O(n) memory and an O(n) build, in exchange for range answers in log n instead of a linear scan each time.',

  huffman: 'Take the two rarest symbols, make them siblings, put the pair back, repeat. Each round removes two and adds one, so there are n rounds, and a heap makes each round O(log n): O(n log n) overall. The reason the result is optimal is the exchange argument — in any optimal code the two rarest symbols can be moved to be deepest siblings without making it worse, so the greedy pairing never forecloses the best answer.',

  /* ────────────────── dynamic programming ──────────────────── */

  'dp-fib': 'The naive recursion recomputes the same subproblems exponentially many times: fib(40) makes over 200 million calls to compute 41 distinct values. Memoising turns that into 41 calls. The general shape of every entry in this category is right there — count the distinct subproblems, multiply by the cost of combining each one, and that is the complexity. Here it is n subproblems at O(1) each.',

  'dp-lis': 'n² because for each item you look back at every earlier item to find the best run you can extend. That is n subproblems with O(n) work each. It is also the clearest example of a DP that a better data structure improves: replace the backward scan with a binary search over the best run-ends and the same answer comes out in O(n log n).',

  'dp-coin-change': 'One subproblem per amount from 0 up to the target, and each is solved by trying every coin: O(amount × coins). Note what the "n" is — the target value, not the number of coins — so this is polynomial in the *value* of the input and exponential in the number of digits needed to write it down. That is what "pseudo-polynomial" means, and it is why this does not make the subset-sum problem easy.',

  'dp-knapsack': 'A table of items against capacities, so n × W cells, each filled in O(1) by comparing "skip this item" with "take it and look up the smaller capacity". Pseudo-polynomial again: double the capacity and the table doubles, even though the input grew by one bit.',

  'dp-lcs': 'A grid of one string against the other: n × m cells, each O(1) from the three neighbours above, left and diagonal. Matching characters extend the diagonal; mismatches take the better of the two sides. It is the engine under `diff`, and under the edit distance that spell checkers use.',

  'dp-edit-distance': 'The same n × m grid as the longest common subsequence, with three choices per cell instead of two — insert, delete, substitute — and the answer is the cheapest route from one corner to the other. Only the previous row is ever read, so the memory can be O(min(n, m)) even though the time cannot drop below the product.',

  'dp-matrix-chain': 'The subproblem is a contiguous run of matrices, and there are O(n²) of those; solving one means trying every split point inside it, which is O(n) more. n² subproblems times n work each is n³. The payoff is large: the parenthesisation matters enormously, and picking well can turn tens of thousands of multiplications into a few thousand.',

  /* ──────────────────── string matching ───────────────────── */

  'str-naive': 'Try the pattern at every one of the n starting positions, comparing up to m characters each time: O(n·m) in the worst case, which needs text and pattern to share long prefixes, like searching for "aaab" in a page of "a"s. On ordinary text a mismatch comes almost immediately and the real cost is close to O(n) — which the measurement on this page shows, and which is why the naive version is often perfectly fine.',

  'str-kmp': 'The insight is that a mismatch has already told you something. If the pattern matched k characters before failing, you know those k characters of the text, so you can slide the pattern to the longest prefix that is also a suffix of them and never re-examine a character. The text pointer only moves forwards, giving O(n) for the scan plus O(m) to build the prefix table — O(n + m), with a worst case no worse than its average.',

  'str-boyer-moore': 'Compare from the right-hand end of the pattern and, on a mismatch, skip forward by whatever the offending character allows. A character absent from the pattern lets you jump the entire pattern length, so the cost can be sublinear — O(n/m) at best, because it does not look at most of the text. Long patterns and large alphabets make it the fastest practical choice, and it is what `grep` reaches for.',

  'str-rabin-karp': 'Hash the pattern once and compare hashes instead of strings. A rolling hash updates in O(1) per position by removing the outgoing character and adding the incoming one, so one O(n) pass finds every candidate, with a full check only on a hash match. O(n + m) when collisions are rare; O(n·m) if the hash is poor and every position needs verifying. Its real advantage is searching for many patterns at once, since one pass can check a whole set of hashes.',

  /* ───────────────────── backtracking ─────────────────────── */

  'bt-subsets': 'Every item is either in or out, so there are exactly 2ⁿ subsets and no algorithm that lists them can be faster — the output is that size. 20 items is a million subsets, 30 is a billion. Worth separating from the backtracking algorithms around it: this one is exponential because the answer is exponential, not because the search is wasteful.',

  'bt-permutations': 'n! orderings, and n! is brutal in a way 2ⁿ is not: 10 items is 3.6 million, 15 is a trillion, 20 is beyond any computer. Any problem whose only known method is "try every ordering" — the travelling salesman, for one — is intractable at sizes that sound small.',

  'bt-n-queens': 'The naive bound is n! placements, but almost none are ever built. Checking each queen against those already placed prunes an entire subtree the moment two of them attack, so the search explores a tiny fraction of the space — this page measures around n^5 rather than n!. That gap between the bound and the behaviour is the whole point of backtracking, and the reason 8 queens is instant while the bound says it should not be.',

  'bt-sudoku': 'Exponential in principle: nine candidates per blank cell, so a grid with 50 blanks has 9⁵⁰ fillings. In practice the constraints prune so hard that most puzzles fall out in a few thousand steps, because a cell with one legal value forces the next. The puzzles that take millions of steps are the ones built specifically to defeat the ordering a solver tries.',

  'bt-hanoi': 'T(n) = 2·T(n−1) + 1, which solves to exactly 2ⁿ − 1 moves — and that is a minimum, not an estimate: the largest disc cannot move until the other n−1 are stacked elsewhere, so the recursion is forced. 64 discs at one move a second is about 585 billion years, which is the point of the legend.',

  /* ──────────────── number theory and geometry ─────────────── */

  'math-sieve': 'For each prime p, cross out its multiples. The work is n/2 + n/3 + n/5 + n/7 + … over the primes below n, and that sum is n·log log n — a result from analytic number theory, not something you can read off the loops. log log n is under 3 for any n you will ever sieve, so in practice this is linear with a small constant. Starting the crossing-out at p² rather than 2p matters: everything below it has a smaller factor and is already gone.',

  'math-gcd': 'Each step replaces (a, b) with (b, a mod b), and the pair shrinks fast: the worst case is consecutive Fibonacci numbers, which is where the golden ratio appears and gives O(log min(a, b)). The step count jumps around between neighbouring inputs — gcd(100, 99) takes two steps and gcd(89, 55) takes nine — so a measured curve of it is honestly noisy rather than badly measured.',

  'math-fast-power': 'Squaring repeatedly reaches bⁿ in log n multiplications instead of n: b¹⁶ is four squarings, not fifteen multiplications. The exponent is read in binary, one squaring per bit and one extra multiply per set bit. This is what makes RSA possible — exponentiating a 2048-bit number is about 3,000 multiplications rather than 2²⁰⁴⁸ of them.',

  'geo-graham': 'Sort the points by angle around the lowest one, then walk them, popping any point that turns the wrong way. The sort is O(n log n) and dominates: the walk is O(n), because each point is pushed once and popped at most once. The turn test is a cross product — an integer sign test with no trigonometry and no square roots, which is why it is also numerically well behaved.',

  'geo-jarvis': 'Wrap the points like string: from the current hull point, scan everything to find the next one, repeat until you are back where you started. Each sweep is O(n) and there is one per hull vertex, so O(n·h). When the hull is small this beats Graham scan — a few hundred points with a triangular hull is three sweeps — and when every point is on the hull it degrades to O(n²).',

  'geo-closest-pair': 'Divide by x, solve each half, then merge. The merge looks like it should be quadratic, but any point in the middle strip can only have a constant number of neighbours closer than the best distance already found — pack more into that box and two of them would be closer to each other. So the merge is linear, the recursion has log n levels, and the whole thing is n log n.',
};
