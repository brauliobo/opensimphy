// Gmsh script describing the geometry of the microstrip line and the associated
// meshing constraints.
//
// The microstrip line is a three-dimensional structure, but here we exploit the
// translation invariance along the line and model a 2D cross-section (a
// two-dimensional cut in a plane of constant "z"). All results are thus
// understood as values "per unit length along z".
//
// In this first tutorial we use the built-in Gmsh CAD kernel. Later tutorials
// (starting with tutorial 2) will use the more powerful OpenCASCADE kernel to
// build geometries from boolean operations on solid primitives.

// Dimensions (there are no units in Gmsh -- the following values should be
// interpreted as dimensions in meters due to the definition of the physical
// parameters in MKS units in "microstrip.pro"):
h = 1.e-3; // thickness of dielectric substrate
w = 4.72e-3; // width of microstrip line
t = 0.035e-3; // thickness of microstrip line
xBox = w / 2 * 6; // width of air box
yBox = h * 12; // height of air box

// Global mesh size factor (that can be modified interactively in the Gmsh
// graphical interface), with a default value of "1":
s = DefineNumber[1., Min 0.5, Max 2, Step 0.5,
  Name "Parameters/Mesh/Global mesh size factor",
  Help "Scales every target point mesh size in this tutorial geometry"];
workflow = DefineNumber[0, Choices {0="Electrostatic solve", 1="Mesh audit"},
  Name "Parameters/Run/Workflow"];
label = DefineString["upstream tutorial",
  Choices {"upstream tutorial", "parameter audit"},
  Name "Parameters/Run/Label",
  Visible workflow == 0];
targetSize = DefineNumber[h / 10 * s,
  Name "Parameters/Mesh/Derived substrate target [m]",
  Help "Computed by the Gmsh parser from h / 10 * s",
  Visible workflow == 0,
  ReadOnly 1];

// Target mesh sizes on some model points:
p0 = h / 10 * s;
pLine0 = w / 20 * s;
pLine1 = w / 100 * s;
pxBox = xBox / 10 * s;
pyBox = yBox / 8 * s;

// We create the geometry in a bottom-up manner, successively defining model
// points, lines, loops and surfaces:
Point(1) = {0, 0, 0, p0};
Point(2) = {xBox, 0, 0, pxBox};
Point(3) = {xBox, h, 0, pxBox};
Point(4) = {0, h, 0, pLine0};
Point(5) = {w / 2, h, 0, pLine1};
Point(6) = {0, h + t, 0, pLine0};
Point(7) = {w / 2, h + t, 0, pLine1};
Point(8) = {0, yBox, 0, pyBox};
Point(9) = {xBox, yBox, 0, pyBox};
Line(1) = {1, 2};
Line(2) = {2, 3};
Line(3) = {3, 9};
Line(4) = {9, 8};
Line(5) = {8, 6};
Line(7) = {4, 1};
Line(8) = {5, 3};
Line(9) = {4, 5};
Line(10) = {6, 7};
Line(11) = {5, 7};
Curve Loop(12) = {1, 2, -8, -9, 7};
Plane Surface(13) = {12};
Curve Loop(14) = {10, -11, 8, 3, 4, 5};
Plane Surface(15) = {14};

// The last step is to define physical groups, assigning unique tags (and names)
// to groups of model entities. Physical groups serve two purposes: when they
// are defined they tell Gmsh which elements to save in the mesh file (by
// default only elements belonging to at least one physical group are saved),
// and they provide the tags that GetDP uses in "Region[]" to identify parts of
// the domain.
Physical Surface("Air", 1) = {15};
Physical Surface("Dielectric", 2) = {13};
Physical Curve("Ground", 10) = {1};
Physical Curve("Microstrip boundary", 11) = {9, 10, 11};
Physical Curve("Inf", 12) = {2, 3, 4};
