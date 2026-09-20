// Parameters shared by Gmsh and GetDP: number of fins and per-cell base width.

bw = 8e-3; // base plate width (for one fin)
DefineConstant[
  N = {1, Min 1, Max 100, Step 1, Name "Parameters/Number of fins"}
];
