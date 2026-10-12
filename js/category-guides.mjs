/* ============================================================
   What each family of algorithms is actually for.

   The sidebar groups 94 algorithms into eleven families and tells you
   almost nothing about the families themselves. But "which family does
   this problem belong to" is the first decision you make, and it is a
   bigger decision than which algorithm you then pick inside it —
   choosing between Dijkstra and Bellman-Ford matters far less than
   realising you have a graph problem at all.

   So: what the family is for, when you reach for it, and how to choose
   within it. Deliberately about the family, never about one algorithm;
   the per-algorithm case lives on the Learn page.
   ============================================================ */

export const GUIDES = {
  sorting: {
    what: 'Putting a collection into order. It looks like a solved problem — every language ships a sort — and it is worth understanding anyway, because sorting is how an enormous number of other problems become easy. Finding duplicates, finding the median, grouping records, merging two datasets, binary searching anything at all: each is awkward on unordered data and nearly free once it is sorted.',
    when: 'Reach for a sort when you will ask more than one question of the same data. One lookup in an unsorted million-item list is half a million comparisons; sorting it first costs about twenty million, so a single query never pays for the sort and a few thousand queries pay for it many times over.',
    choosing: 'Start with the one your language gives you — it is Timsort or an introsort and it is better tuned than anything you will write. Deviate only for a reason you can name: insertion sort when the data is nearly ordered, counting or radix sort when the keys are small integers, heapsort when you need a worst-case guarantee in constant memory, merge sort when stability matters and memory does not.',
    watch: 'Stability — whether equal items keep their original order — is invisible until you sort by one key and then another, at which point an unstable sort quietly destroys the first ordering. That is the bug that takes an afternoon to find.',
  },

  searching: {
    what: 'Finding one value among many. The whole family is a study in what prior work buys you: linear search assumes nothing and reads everything, binary search demands sorted input and answers in a handful of comparisons, interpolation search additionally assumes the values are evenly spread and does better still when they are.',
    when: 'Whenever you are about to write a loop that scans a collection looking for something. The question to ask is not "which search is fastest" but "how many times will I search this, and is it worth preparing the data first".',
    choosing: 'One lookup on unsorted data: scan it. Many lookups on data that does not change: sort once, then binary search. Many lookups with insertions in between: you want a tree or a hash table rather than an array. Searching something you can only read forwards, like a stream or a tape: jump or exponential search, which never go backwards.',
    watch: 'Binary search on unsorted data does not fail loudly — it returns a confident wrong answer. And the midpoint is the classic off-by-one: a loop written "while lo < hi" silently skips the last candidate.',
  },

  pathfinding: {
    what: 'Getting from one square to another on a board, around obstacles. A grid is really a graph in disguise — each cell is a node, each step to a neighbour an edge — so everything here is a graph algorithm with the structure made visible. It is the easiest place to see the difference between searching blindly and searching with a hint.',
    when: 'Games and robotics are the obvious uses, and the shape turns up far more widely: anything where states connect to neighbouring states and you want the cheapest route between two of them. A puzzle solver, a routing engine and a build planner are the same problem wearing different clothes.',
    choosing: 'Unweighted board, shortest path: breadth-first search. Weighted terrain: Dijkstra. You know where the goal is: A*, which is Dijkstra plus that knowledge and explores a fraction as much. Only need some path rather than the shortest: depth-first or greedy best-first will find one much faster, and it may well be ugly.',
    watch: 'A* is only guaranteed to find the shortest path if its heuristic never overestimates the remaining distance. Overestimate and it returns something plausible, quickly, and wrong.',
  },

  graphs: {
    what: 'Things and the connections between them: roads, friendships, dependencies, packets, citations. Graphs are the most general structure here — lists and trees are both special cases — and recognising that a problem is a graph problem is usually the hard part. Once you see the nodes and edges, the right algorithm is usually already written.',
    when: 'When relationships matter as much as the things themselves. "What depends on what", "is everything still connected", "what is the cheapest way through", "are there circular references" are all graph questions, and all of them are miserable to answer any other way.',
    choosing: 'Follow the question. Fewest hops: breadth-first search. Ordering with dependencies: topological sort. Cheapest route with positive weights: Dijkstra; with negative ones: Bellman-Ford. Cheapest way to connect everything: Kruskal or Prim. Mutually reachable groups: Tarjan. Most that can flow through: Edmonds-Karp.',
    watch: 'Directed and undirected are genuinely different problems, and so are weighted and unweighted — an algorithm that is correct on one can be silently wrong on another. Dijkstra on a graph with one negative edge is the standard trap.',
  },

  trees: {
    what: 'Hierarchies, and the discipline needed to keep them useful. A binary search tree keeps everything in order while allowing cheap insertion and removal, which an array cannot — but only while it stays balanced. Most of this family exists because of what goes wrong when it does not, and watching a plain BST degenerate into a linked list on sorted input explains AVL and red-black trees better than any description.',
    when: 'When you need the data ordered and changing at the same time. A sorted array gives fast lookup and slow insertion; a hash table gives fast insertion and no order at all. A balanced tree is the structure that refuses to choose, which is why it sits under every database index and every sorted map in every standard library.',
    choosing: 'Ordered data with updates: a balanced tree — red-black if updates are frequent, AVL if lookups dominate. Only ever need the smallest or largest: a heap, which promises far less and costs far less. Keys that are strings and queries that are prefixes: a trie. Range sums over changing data: a segment tree.',
    watch: 'A plain BST has no defence against sorted input, and sorted input is extremely common — imported records, timestamps, autoincrement ids. The structure degrades to O(n) exactly when the data looks tidiest.',
  },

  dp: {
    what: 'Solving each subproblem once and remembering the answer. Dynamic programming is less an algorithm than a way of noticing: when a recursive solution keeps recomputing the same thing, writing the answers down converts exponential work into polynomial. Naive Fibonacci makes 200 million calls for fib(40) and the memoised version makes 41.',
    when: 'When a problem splits into overlapping subproblems and a best answer is built from best answers to smaller versions. The telltale signs are a recursion that revisits the same arguments, and a greedy approach that looks right but fails on an example you can construct.',
    choosing: 'The work is not picking an algorithm, it is finding the state. Ask what the smallest set of facts is that captures a subproblem, how the answer for one is built from smaller ones, and what the base cases are. The implementation — a table filled bottom-up, or a recursion with a cache — is the easy half and the two are equivalent.',
    watch: 'Several of these are pseudo-polynomial: the knapsack and coin change tables are sized by a value from the input rather than by how many items there are, so doubling the capacity doubles the work even though the input only grew by one number.',
  },

  strings: {
    what: 'Finding a pattern inside text without re-reading what you have already read. The naive approach restarts from scratch at every position, throwing away everything a failed comparison just told it; this whole family is different ways of keeping that information. KMP precomputes how far it can safely jump, Boyer-Moore reads backwards so it can skip ahead, Rabin-Karp compares cheap hashes instead of characters.',
    when: 'Search in an editor, filtering logs, matching DNA, routing on a URL, deciding whether a line matters. Any time text is long enough that the inner loop matters, which is sooner than you would think.',
    choosing: 'One pattern, long text, large alphabet: Boyer-Moore, which is what grep reaches for. One pattern, worst-case guarantee needed: KMP, which is linear whatever the input. Many patterns in one pass: Rabin-Karp, since comparing a set of hashes is a set lookup. Short text: the naive loop, which on ordinary text is linear anyway and is three lines.',
    watch: 'The naive version is quadratic only on text that shares long prefixes with the pattern — "aaaa…" searched for "aaab". Ordinary prose almost never does, so measuring on real text tells you very little about the worst case.',
  },

  backtracking: {
    what: 'Building a solution one choice at a time and undoing the moment a choice cannot work. It is brute force with the ability to give up early, and that ability is doing almost all the work: eight queens has nearly 17 million placements, and checking each queen against the ones already placed cuts the search to a few thousand steps.',
    when: 'Constraint problems where you must find an arrangement satisfying rules, and no formula gets you there — puzzles, scheduling, packing, colouring, layout. The signature is that a partial answer can be judged before it is finished, which is exactly what makes pruning possible.',
    choosing: 'The algorithm is nearly always the same; what differs is how early you detect failure and in what order you try choices. Both matter enormously. A Sudoku solver that fills the most-constrained cell first is dramatically faster than one going left to right, with identical code around it.',
    watch: 'The bounds here are honest but useless as predictions: N-Queens is quoted as O(n!) and measures nothing like it, because the pruning is the point. Do not conclude a backtracking search is hopeless from its worst case alone.',
  },

  math: {
    what: 'Algorithms on the integers themselves — divisibility, primes, modular arithmetic. This family looks academic and is anything but: modular exponentiation is what makes public-key cryptography possible, and Euclid\'s algorithm is from 300 BC and is still what every rational-number implementation uses to reduce a fraction.',
    when: 'Cryptography, hashing, random number generation, anything periodic or cyclic, and the small daily business of reducing fractions and testing divisibility.',
    choosing: 'These are specific tools for specific jobs rather than alternatives to weigh. The lesson they share is that the obvious method is often exponentially worse than the clever one: computing b^n by multiplying n times, versus squaring your way there in log n steps.',
    watch: 'Complexity here is measured in the size of the numbers — their digits — not their value. An algorithm linear in n is exponential in the number of bits used to write n down, which is the whole reason factoring large numbers is hard and RSA works.',
  },

  geometry: {
    what: 'Questions about points, lines and shapes in space. The algorithms are short and the difficulty is unusual: correctness depends on predicates like "do these three points turn left or right", and the natural way to compute that involves division and floating point, which rounds, which makes the answer wrong in ways that are very hard to debug.',
    when: 'Graphics, mapping, collision detection, layout, robotics, and any analysis where the data has coordinates — clustering, nearest-neighbour lookups, spatial joins.',
    choosing: 'Convex hull: Graham scan in general; gift wrapping when you expect few points on the hull, since it costs O(n·h) and h may be tiny. Closest pair: divide and conquer, which gets n log n out of what looks unavoidably quadratic.',
    watch: 'Use integer arithmetic for the orientation test where you can — a cross product keeps it to multiplication and subtraction, with no division and no square roots. Comparing floating-point distances for equality is where these algorithms go subtly wrong.',
  },

  mazes: {
    what: 'Building a board rather than solving one. Every algorithm here carves a spanning tree over a grid, which is why a proper maze has exactly one route between any two cells and no loops. They are the counterpart to Pathfinding: generate a maze, then switch to A* and watch it solve what you just made.',
    when: 'Games and procedural content, and as a way of generating hard test cases — a maze is a far more interesting board to benchmark a pathfinder on than random walls, because the corridors are genuinely adversarial.',
    choosing: 'The choice is aesthetic rather than technical, and the differences are visible on the board. Recursive backtracking makes long winding corridors with few junctions. Prim\'s makes a bushy maze with many short dead ends. Recursive division makes long straight walls and a room-like feel.',
    watch: 'A maze carved as a spanning tree has exactly one solution. If you want loops and multiple routes — which usually plays better — you have to knock down extra walls deliberately afterwards.',
  },
};
