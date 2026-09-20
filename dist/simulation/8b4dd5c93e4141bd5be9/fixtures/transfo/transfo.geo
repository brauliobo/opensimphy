// Gmsh script describing the geometry of a single-phase transformer: a
// ferromagnetic core with a primary winding (two coil sides) and a secondary
// winding (two coil sides), surrounded by an air region with an infinite shell
// for the unbounded domain (see tutorial 3).

SetFactory("OpenCASCADE");

Include "transfo_common.pro";

// The core is created by subtracting the inner rectangle (the window) from
// the outer rectangle:
Rectangle(1) = {-wCore / 2, -hCore / 2, 0,
  wCore, hCore};
Rectangle(2) = {-wCore / 2 + wCoreLeg, -hCore / 2 + wCoreLeg, 0,
  wCore - 2 * wCoreLeg, hCore - 2 * wCoreLeg};

// Primary winding: two coil sides (minus and plus) on either side of the left
// core leg. "Coil1M" carries the current in the -z direction and "Coil1P" in
// the +z direction (the go and return paths of the same winding):
Rectangle(3) = {-wCore / 2 - gapCoil - wCoil1, -hCoil1 / 2, 0,
  wCoil1, hCoil1};
Rectangle(4) = {-wCore / 2 + wCoreLeg + gapCoil, -hCoil1 / 2, 0,
  wCoil1, hCoil1};

// Secondary winding: two coil sides on either side of the right core leg:
Rectangle(5) = {wCore / 2 - wCoreLeg - gapCoil - wCoil2, -hCoil2 / 2, 0,
  wCoil2, hCoil2};
Rectangle(6) = {wCore / 2 + gapCoil, -hCoil2 / 2, 0,
  wCoil2, hCoil2};

// Air region (disk) and infinite ring:
Disk(7) = {0, 0, 0, JacRadiusInt};
Disk(8) = {0, 0, 0, JacRadiusExt};

// Make all overlapping surfaces conformal (see tutorial 3):
Coherence;

// Use the "Closest" command to retrieve the regions that were split by the
// boolean operation in "Coherence":
airinf() = Closest {JacRadiusInt + 1e-6, 0, 0} { Surface{:}; };
core() = Closest {wCore / 2 - 1e-6, 0, 0} { Surface{:}; };

// The air region is everything except the infinite shell, the core and the
// coils:
air() = Surface{:};
air() -= {airinf(0), core(0), 3, 4, 5, 6};

bnd() = CombinedBoundary{ Surface{:}; };

DefineConstant[
  s = {1, Min 0.1, Max 10, Step 0.1,
    Name "Parameters/}Global mesh size factor"}
];

MeshSize{:} = 2 * mm * s;
MeshSize{ PointsOf{ Surface{airinf(0)}; } } = 8 * mm * s;

Physical Surface("Air", 1) = air();
Physical Surface("AirInf", 2) = airinf(0);
Physical Surface("Coil1M", 3) = 3;
Physical Surface("Coil1P", 4) = 4;
Physical Surface("Coil2M", 5) = 5;
Physical Surface("Coil2P", 6) = 6;
Physical Surface("Core", 7) = core(0);
Physical Curve("Bnd", 10) = bnd();
