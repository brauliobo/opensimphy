// Parameters shared by Gmsh and GetDP: model dimension and waveguide
// cross-section dimensions.

DefineConstant[
  dim = {2, Choices{2="2D", 3="3D"},
    Name "Parameters/0Model dimension"}
  Wx = {4, Min 1, Max 100, Step 1,
    Name "Parameters/Waveguide width [cm]"}
  Wz = {3, Min 1, Max 100, Step 1, Visible (dim == 3),
    Name "Parameters/Waveguide height [cm]"}
];

// back to meters:
Wx = Wx / 100;
Wz = Wz / 100;
