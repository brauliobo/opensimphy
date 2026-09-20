// Parameters shared by Gmsh and GetDP.

mm = 1e-3;

dxCore = 50 * mm;
dyCore = 100 * mm;
xCoil = 75 * mm;
dxCoil = 25 * mm;
dyCoil = 100 * mm;
rInt = 200 * mm;
rExt = 250 * mm;

DefineConstant[
  SymmetryType = {0, Choices{0="None", 1="X-axis", 2="Y-axis", 3="All"},
    Name "Parameters/0Symmetry"}
];
