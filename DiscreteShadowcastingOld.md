This page describes the older version of Discrete shadowcasting. Please refer to DiscreteShadowcasting for newer algorithm.

# Discrete shadowcasting #

This algorithm computes a set of coordinates, visible from a given point. The area is bounded by a maximum sight distance. Discrete shadowcasting operates in O(N^2), where N is the maximum sight distance.

## Definitions ##

_PC_ is a Player Character. He stands on a fixed cell and has a _maximum sight distance_ called **R**. Nothing farther than R can be seen.

A _ring_ is a set of all cells with a given distance to PC. For a distance **r**, a ring consists of _8r_ cells.

PC's complete view (360 degrees) is divided into 8R _arcs_. Every arc thus corresponds to a cell in the outermost ring. Every arc is initially _visible_. However, during the visibility calculations, arcs may get blocked _from their left side_ or _from their right side_. The amount of blocking (from a given side) is a floating point number beween zero and one, inclusive.

## How it works ##

Discrete shadowcasting algorithm walks through all rings, 1 <= r <= R. Every cell corresponds to a certain amount of arcs (one or more); These arcs are checked for occlusion to determine if the cell in question is visible. Moreover, if the cell is by its nature "blocking" (a wall), relevant arcs are blocked by this cell for further computations.

## Example ##

**@** is the PC. **Numbers** correspond to cells in their respective rings (starting from 0 at lower right corner, numbered counter-clockwise).

```
 @  .  2  .  .  5
 .  .  X  .  .  4
14 15  0  .  .  3
 .  .  .  .  .  2
 .  .  .  .  .  1
35 36 37 38 39  0
```

This illustration shows a bottom-right segment of a view. R = 5, largest (fifth) ring consists of 40 cells. Therefore, there are 40 available arcs in this scenario.

We are currently testing cell marked with **X** - it is a second cell of a second ring (second ring has 16 cells). Every cell on ring #2 corresponds to 2.5 arcs (40/16). More specifically, cell X corresponds to arcs 1.75 - 4.25.

To determine X's visibility, we check how blocked are arcs 1.75-4.25. X will be visible if any of these statements is true:

  * arc #1 is blocked from left side by less than 0.25;
  * arc #2 is not completely blocked (left + right blocking < 1);
  * arc #3 is not completely blocked (left + right blocking < 1);
  * arc #4 is blocked from right side by less than 0.25.

Finally, if X was a wall, it would completely block (from both left and right sides) arcs #2 and #3; it would also block arc #1 (by 0.25 from left) and arc #4 (by 0.25 from right).