// Parameters shared by Gmsh and GetDP: core and coil dimensions.

mm = 1e-3;
wCore = 100 * mm;
hCore = 100 * mm;
wCoil1 = 10 * mm;
hCoil1 = 40 * mm;
wCoil2 = 20 * mm;
hCoil2 = 40 * mm;

DefineConstant[
  thickCore = {30, Min 5, Max 60, Step 0.1,
    Name "Parameters/Core thickness [mm]", Visible 0}
  gapCoil = {2, Min 0.5, Max 7.5, Step 0.1,
    Name "Parameters/Coil gap [mm]"}
  wCoreLeg = {20, Min 10, Max 27, Step 0.1,
    Name "Parameters/Core width [mm]"}
];

thickCore = thickCore * mm;
gapCoil = gapCoil * mm;
wCoreLeg = wCoreLeg * mm;

// Inner and outer radii for the infinite shell Jacobian (see tutorial 3),
// chosen to be large enough to enclose the full geometry:
r = Max[(wCore + 2 * gapCoil + wCoil1 + wCoil2) / 2, hCore / 2];
JacRadiusInt = r * Sqrt[2] + 30 * mm;
JacRadiusExt = JacRadiusInt + 50 * mm;
