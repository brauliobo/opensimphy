// Gmsh script describing the geometry of a rectangular waveguide, in 2D or 3D
// (selected by the "dim" parameter defined in "full_wave_common.pro"),
// optionally enclosed in a surrounding air region for the absorbing boundary
// condition.

SetFactory("OpenCASCADE");

Include "full_wave_common.pro";

DefineConstant[
  L = {9, Min 1, Max 100, Step 1,
    Name "Parameters/Waveguide length [cm]"}
  res = {0.4, Min 1e-2, Max 50e-1, Step 1e-2,
    Name "Parameters/Mesh size [cm]"}
  airRadius = {6, Min 0, Max 100, Step 1,
    Name "Parameters/Air radius [cm]"}
];

// Convert dimensions back to meters:
L = L / 100;
res = res / 100;
airRadius = airRadius / 100;

// Inner part of waveguide:
xMinIn = -Wx / 2;
yMinIn = -L;
zMinIn = -Wz / 2;

// Wall thickness:
t = 2e-3;

// Outer part of waveguide:
xMinOut = xMinIn - t;
yMinOut = yMinIn - t;
zMinOut = zMinIn - t;
WxOut = Wx + 2 * t;
WzOut = Wz + 2 * t;

If(dim == 2)
  // 2D geometry in z == 0 plane:
  zMinIn = 0;
  zMinOut = 0;
  If(airRadius > 0)
    Disk(1) = {0, 0, 0, airRadius};
    Rectangle(2) = {xMinOut, yMinOut, zMinOut, WxOut, L + t};
    vAir() = BooleanDifference{ Surface{1}; Delete; }{ Surface{2}; Delete; };
  Else
    vAir() = {};
  EndIf
  vGuideIn = news; // next available surface tag
  Rectangle(vGuideIn) = {xMinIn, yMinIn, zMinIn, Wx, L};
Else
  // 3D geometry:
  If(airRadius > 0)
    Sphere(1) = {0, 0, 0, airRadius};
    Box(2) = {xMinOut, yMinOut, zMinOut, WxOut, L + t, WzOut};
    vAir() = BooleanDifference{ Volume{1}; Delete; }{ Volume{2}; Delete; };
  Else
    vAir() = {};
  EndIf
  vGuideIn = newv; // next available volume tag
  Box(vGuideIn) = {xMinIn, yMinIn, zMinIn, Wx, L, Wz};
EndIf

If(airRadius > 0)
  // Make all entities conformal (see tutorial 3):
  Coherence;
EndIf

// Retrieve surfaces for boundary conditions using a bounding box search, with a
// small tolerance:
tol = 1e-6;

// Excitation port at yMinIn:
sPort() = GeoEntity{dim - 1} In BoundingBox {
  xMinIn - tol, yMinIn - tol, zMinIn - tol,
  xMinIn + Wx + tol, yMinIn + tol, zMinIn + Wz + tol};

// Output port at yMinIn + L:
sOut() = GeoEntity{dim - 1} In BoundingBox {
  xMinIn - tol, yMinIn + L - tol, zMinIn - tol,
  xMinIn + Wx + tol, yMinIn + L + tol, zMinIn + Wz + tol};

// Waveguide walls excluding ports for PEC conditions:
sPEC() = GeoEntity{dim - 1} In BoundingBox {
  xMinOut - tol, yMinOut - tol, zMinOut - tol,
  xMinOut + WxOut + tol, yMinOut + L + t + tol, zMinOut + WzOut + tol};
sPEC() -= {sPort(), sOut()};

// Infinite boundary for ABC. "CombinedBoundary" returns the exterior boundary
// curves (resp. surfaces) of a set of surfaces (resp. volumes), combining
// (i.e. removing) internal boundaries shared by adjacent entities.  Here it
// returns the outermost boundary of the entire model:
sInf() = CombinedBoundary{ GeoEntity{dim}{:}; };
sInf() -= {sPort(), sOut(), sPEC()};

// Uniform mesh size constraint:
MeshSize{:} = res;

// Physical groups:
Physical GeoEntity{dim}("Waveguide", 1000) = {vGuideIn};
Physical GeoEntity{dim}("Air", 1001) = {vAir()};
Physical GeoEntity{dim - 1}("PEC", 2000) = {sPEC()};
Physical GeoEntity{dim - 1}("Port", 2001) = {sPort()};
Physical GeoEntity{dim - 1}("Inf", 2002) = {sInf()};
