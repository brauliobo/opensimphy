// Gmsh script describing the geometry of an electromagnet with an iron core and
// two coil sides, surrounded by air. The 3D setup is invariant along the
// out-of-plane direction "z" (the axis of the coils), so we model a 2D
// cross-section in the "(x, y)" plane. The two additional symmetries of this
// cross-section -- with respect to the X-axis (separating the two coil sides)
// and to the Y-axis (passing through the core) -- make it possible to model
// only a half (or even a quarter) of the cut. The "SymmetryType" parameter
// defined in "electromagnet_common.pro" selects which part is meshed.

// We include a file with the dimensions as well as the symmetry type; the same
// file will be included in electromagnet.pro to guarantee consistency between
// Gmsh and GetDP:
Include "electromagnet_common.pro";

SetFactory("OpenCASCADE");
Rectangle(1) = {-dxCore, -dyCore, 0, 2 * dxCore, 2 * dyCore};
Rectangle(2) = {xCoil, -dyCoil / 2, 0, dxCoil, dyCoil};
Rectangle(3) = {-xCoil - dxCoil, -dyCoil / 2, 0, dxCoil, dyCoil};
Disk(4) = {0, 0, 0, rInt};
Disk(5) = {0, 0, 0, rExt};

If(SymmetryType == 0) // no symmetry
  // With the OpenCASCADE kernel the "Coherence" command is a shortcut for
  // "BooleanFragments" applied to all entities of the highest dimension. It
  // computes the intersections of all overlapping entities and replaces them
  // with a conformal (non-overlapping) set of entities. This is essential when
  // building a geometry from overlapping primitives with the OpenCASCADE
  // kernel: without it, entities would overlap and the resulting mesh would not
  // be conformal at region interfaces. After "Coherence" each original primitive
  // has been fragmented into the pieces that actually belong to each physical
  // region (core, coils, air, infinite shell), which is what the "Closest"
  // queries below rely on to retrieve them by position.
  Coherence;
Else
  // A bounding rectangle is built and intersected with the previously defined
  // primitives. The three non-trivial values of "SymmetryType" are handled
  // uniformly by the following formulas:
  //   - SymmetryType == 1: keep the upper half (y >= 0), X-axis is a symmetry
  //     plane, so "bot()" later carries the "n x h = 0" boundary condition;
  //   - SymmetryType == 2: keep the right half (x >= 0), Y-axis is a symmetry
  //     plane, so "left()" later carries the "b . n = 0" boundary condition;
  //   - SymmetryType == 3: keep the first quadrant (x >= 0 and y >= 0), both
  //     axes are symmetry planes, so both "bot()" and "left()" are defined
  //     below.
  d = 1.1 * rExt;
  x = (SymmetryType == 1) ? -d : 0; // symmetry w.r.t. X-axis ?
  dx = (SymmetryType == 1) ? 2 * d : d;
  y = (SymmetryType == 2) ? -d : 0; // symmetry w.r.t. Y-axis ?
  dy = (SymmetryType == 2) ? 2 * d : d;
  Rectangle(6) = {x, y, 0, dx, dy};
  BooleanIntersection{ Surface{6}; Delete; }{ Surface{1:5}; Delete; }
EndIf

// After boolean operations the original surface tags may have changed. The
// "Closest" command retrieves the entities closest to a given point, sorted by
// distance, which is a convenient way to identify the desired surfaces by their
// geometric location -- it is enough that the probe point lies inside the target
// region to retrieve it unambiguously:
core() = Closest{0, 0, 0}{ Surface{:}; };
air() = Closest{dxCore + mm, 0, 0}{ Surface{:}; };
airinf() = Closest{rInt + mm, 0, 0}{ Surface{:}; };
indr() = Closest{xCoil + mm, 0, 0}{ Surface{:}; };
indl() = Closest{-xCoil - mm, 0, 0}{ Surface{:}; };
Physical Surface("Core", 1) = core(0);
Physical Surface("Air", 2) = air(0);
Physical Surface("AirInf", 3) = airinf(0);
Physical Surface("CoilRight", 4) = indr(0);
If(SymmetryType == 0 || SymmetryType == 1)
  Physical Surface("CoilLeft", 5) = indl(0);
EndIf

bot() = {};
left() = {};
If(SymmetryType == 1 || SymmetryType == 3)
  bot() = Curve In BoundingBox{-d, -mm, -mm, d, mm, mm};
  Physical Curve("Bottom", 10) = bot();
EndIf
If(SymmetryType == 2 || SymmetryType == 3)
  left() = Curve In BoundingBox{-mm, -d, -mm, mm, d, mm};
  Physical Curve("Left", 11) = left();
EndIf

inf() = CombinedBoundary{ Surface{:}; };
inf() -= {bot(), left()};
Physical Curve("Inf", 12) = inf();

// Mesh size constraints:
DefineConstant[
  s = {1, Name "Parameters/}Global mesh size factor"}
  NonlinearCore = {0, Choices {0, 1},
    Help "Is the magnetic law in the core nonlinear?",
    Name "Parameters/Nonlinear core"}
  NewtonRaphson = {1, Choices {0="Picard", 1="Newton-Raphson"},
    Visible NonlinearCore, Name "Parameters/Linearization method"}
  Current = {1, Min 0.01, Max 100, Step 0.1,
    Name "Parameters/Current [A]"}
];

MeshSize{:} = 12.5 * mm * s;
MeshSize{ PointsOf{ Surface{indr(0)}; } } = 5 * mm * s;
If(SymmetryType == 0 || SymmetryType == 1)
  MeshSize{ PointsOf{ Surface{indl(0)}; } } = 5 * mm * s;
EndIf
MeshSize{ PointsOf{ Surface{core(0)}; } } = 4 * mm * s;
