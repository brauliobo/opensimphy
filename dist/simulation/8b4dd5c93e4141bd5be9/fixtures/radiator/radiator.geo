// Gmsh script describing the geometry of the radiator and the associated
// meshing constraints.

// Instead of the built-in Gmsh geometry kernel we use the OpenCASCADE kernel,
// in order to benefit from boolean operations:
SetFactory("OpenCASCADE");

// Definition of a global mesh size factor that can be modified interactively in
// the Gmsh graphical interface (in the same way as with DefineNumber[] - see
// tutorial 1), but that can also be overridden beforehand, e.g. on the command
// line with "-setnumber s value":
DefineConstant[
  s = {1., Name "Parameters/Global mesh size factor"}
];

fh = 40e-3; // fin height
fw = 2e-3; // fin width
bh = 10e-3; // base plate height
lc = fw / 3 * s; // mesh size

// We include a file that defines the number of fins and the width of one cell:
// the same file will be included in radiator.pro to guarantee consistency
// between Gmsh and GetDP when defining the periodic boundary condition
Include "radiator_common.pro";

DefineConstant[
  position = {0.5, Min 0.1, Max 0.9, Step 0.1,
    Name "Parameters/Fin position in [0,1]"}
  // Note that a number prefix in a parameter name is invisible in the graphical
  // user interface: "0Model dimension" will appear as "Model dimension". It
  // enables sorting the menu entries, i.e. in this case making sure that "Model
  // dimension" is the first entry in the "Parameters" menu.
  dim = {2, Choices{2="2D", 3="3D"},
    Name "Parameters/0Model dimension"}
  zh = {fh / 20, Min 1e-3, Max 2 * fh, Step 1e-3, Visible dim == 3,
    Name "Parameters/Fin thickness [m]"}
  AnalysisType = {0, Choices{0="Steady-state", 1="Transient"},
    Name "Parameters/Analysis"}
  tmax = {360, Min 1, Max 3600, Step 10,
    Name "Parameters/Simulation time [s]", Visible AnalysisType}
  dt = {5, Min 0.1, Max 100, Step 0.1,
    Name "Parameters/Time step [s]", Visible AnalysisType}
];

For i In {0 : N - 1}
  x0 = i * bw;
  Rectangle(2 * i + 1) = {x0 + position * (bw - fw), bh, 0, fw, fh}; // fin
  Rectangle(2 * i + 2) = {x0, 0, 0, bw, bh}; // base plate
EndFor

// Compute the boolean union of all the surfaces:
surf() = BooleanUnion{ Surface{1}; Delete; }{ Surface{2 : 2 * N}; Delete; };

// Assign lc as target mesh size on all model points:
MeshSize{:} = lc;

// Define a small tolerance for the bounding box searches below ("Curve In
// BoundingBox", "Surface In BoundingBox"), which are used to identify model
// boundaries:
e = 1e-6;

If(dim == 2)
  interior = surf(0);
  bottom() = Curve In BoundingBox{-e, -e, -e, N * bw + e, e, e};
  left() = Curve In BoundingBox{-e, -e, -e, e, bh + e, e};
  right() = Curve In BoundingBox{N * bw - e, -e, -e, N * bw + e, bh + e, e};
  // Compute the boundary, then remove the bottom, left and right parts:
  top() = Boundary{ Surface{interior}; };
  top() -= {bottom(), left(), right()};

  // Set a periodic mesh constraint on the right curve: this forces Gmsh to
  // generate identical meshes on the "right" and "left" boundaries (the nodes
  // and elements of one are obtained from those of the other by the prescribed
  // translation). This matching of the two meshes is what enables the "Link"
  // constraint defined in "radiator.pro" to connect the degrees of freedom of
  // the two boundaries node-by-node:
  Periodic Curve { right() } = { left() } Translate {N * bw, 0, 0};
Else
  // Extrude the surface along "z" to create the 3D model. The "Extrude" command
  // returns a list: the first element (index 0) is the top surface, and the
  // second (index 1) is the newly created volume:
  ex() = Extrude {0, 0, zh}{ Surface{surf()}; };
  interior = ex(1);
  bottom() = Surface In BoundingBox{-e, -e, -e, N * bw + e, e, zh + e};
  left() = Surface In BoundingBox{-e, -e, -e, e, bh + e, zh + e};
  right() = Surface In BoundingBox{N * bw - e, -e, -e, N * bw + e, bh + e, zh + e};
  top() = Boundary{ Volume{interior}; };
  top() -= {bottom(), left(), right()}; // try adding e.g. surf() and ex(0)

  // Set a periodic mesh constraint on the right surface (same purpose as in
  // the 2D case above):
  Periodic Surface { right() } = { left() } Translate {N * bw, 0, 0};
EndIf

// Define physical groups (GeoEntity{dim} can be used as a synonym for Curve,
// Surface and Volume respectively for dim == 1, 2 and 3):
Physical GeoEntity{dim} ("Radiator", 1) = interior;
Physical GeoEntity{dim - 1} ("Bottom base plate", 10) = bottom();
Physical GeoEntity{dim - 1} ("Left base plate", 11) = left();
Physical GeoEntity{dim - 1} ("Right base plate", 12) = right();
Physical GeoEntity{dim - 1} ("Top fins", 13) = top();
