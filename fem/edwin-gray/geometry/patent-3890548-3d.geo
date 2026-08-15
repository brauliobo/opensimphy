// US3890548A illustrative full 3D geometry.
//
// This is a parameterized topology model, not a dimensioned replica. The
// patent-described counts are retained: 9 stator pair stations, 3 rotor pair
// stations, major/minor elements, and front/back axial planes.
// Exactly 48 named assembly groups are created: 36 stator + 12 rotor.

SetFactory("OpenCASCADE");
Geometry.OCCBooleanPreserveNumbering = 1;

MeshSizeValue = DefineNumber[0.025, Name "Parameters/Mesh size (m)"];
FeatureMeshSizeM = DefineNumber[0.002, Name "Meshing/Feature mesh size (m)"];
SmokeMesh = DefineNumber[0, Choices{0="Production", 1="Smoke"}, Name "Meshing/Mode"];
RotorAngleDeg = DefineNumber[0, Name "Parameters/Rotor angle (deg)"];
EventIndex = DefineNumber[0, Name "Parameters/Excitation event index", Min 0, Max 26, Step 1];
PairOffsetDeg = DefineNumber[13.3333333333, Name "Parameters/Major-minor offset (deg)"];
StatorPhaseDeg = DefineNumber[0, Name "Parameters/Stator phase (deg)"];
RotorPhaseDeg = DefineNumber[0, Name "Parameters/Rotor phase (deg)"];

AirOuterRadiusM = DefineNumber[0.14, Name "Parameters/Air outer radius (m)"];
AirZMinM = DefineNumber[-0.12, Name "Parameters/Air z minimum (m)"];
AirZMaxM = DefineNumber[0.12, Name "Parameters/Air z maximum (m)"];
RotorCoreInnerRadiusM = DefineNumber[0.048, Name "Parameters/Rotor core inner radius (m)"];
RotorCoreRadialDepthM = DefineNumber[0.02, Name "Parameters/Rotor core radial depth (m)"];
StatorCoreInnerRadiusM = DefineNumber[0.078, Name "Parameters/Stator core inner radius (m)"];
StatorCoreRadialDepthM = DefineNumber[0.022, Name "Parameters/Stator core radial depth (m)"];
CoilRadialDepthM = DefineNumber[0.008, Name "Parameters/Coil radial depth (m)"];
CoilRadialMarginM = DefineNumber[0.001, Name "Parameters/Coil radial margin (m)"];
MinorTangentialWidthM = DefineNumber[0.01, Name "Parameters/Minor tangential width (m)"];
MajorTangentialWidthM = DefineNumber[0.016, Name "Parameters/Major tangential width (m)"];
RotorMinorTangentialWidthM = DefineNumber[0.008, Name "Parameters/Rotor minor tangential width (m)"];
RotorMajorTangentialWidthM = DefineNumber[0.012, Name "Parameters/Rotor major tangential width (m)"];
ElectromagnetAxialLengthM = DefineNumber[0.03, Name "Parameters/Electromagnet axial length (m)"];
CoilTangentialMarginM = DefineNumber[0.003, Name "Parameters/Coil tangential margin (m)"];
RotorCoilTangentialMarginM = DefineNumber[0.001, Name "Parameters/Rotor coil tangential margin (m)"];
CoilAxialMarginM = DefineNumber[0.004, Name "Parameters/Coil axial margin (m)"];

Deg = Pi / 180.;
FrontZ = DefineNumber[0.035, Name "Parameters/Front plane z (m)"];
BackZ = DefineNumber[-0.035, Name "Parameters/Back plane z (m)"];
Eps = 1.e-6;

// Record source-box bounds before fragmentation. Rotor dimensions are separate
// assumptions because stator-sized major/minor envelopes overlap at the smaller
// rotor radius and create a nonphysical sliver in the OCC partition.
Cylinder(1) = {0, 0, AirZMinM, 0, 0, AirZMaxM - AirZMinM, AirOuterRadiusM};

statorCoreVolumes[] = {};
statorCoilVolumes[] = {};
rotorCoreVolumes[] = {};
rotorCoilVolumes[] = {};
allToolVolumes[] = {};
statorCoreBounds[] = {};
statorCoilBounds[] = {};
rotorCoreBounds[] = {};
rotorCoilBounds[] = {};

// Stator: 9 stations at 40 degrees, each with major/minor and front/back.
For station In {0:8}
  statorAngle = station * 40. + StatorPhaseDeg;
  For pair In {0:1}
    If(pair == 0)
      elementName = "Minor";
      elementWidth = MinorTangentialWidthM;
    Else
      elementName = "Major";
      elementWidth = MajorTangentialWidthM;
    EndIf

    If(pair == 0)
      elementAngle = statorAngle;
    Else
      elementAngle = statorAngle - PairOffsetDeg;
    EndIf

    For plane In {0:1}
      If(plane == 0)
        planeName = "Front";
        elementZ = FrontZ;
      Else
        planeName = "Back";
        elementZ = BackZ;
      EndIf

      index = station * 4 + pair * 2 + plane;
      coreTag = 10001 + index;
      coilTag = 20001 + index;

       Box(coreTag) = {StatorCoreInnerRadiusM, -elementWidth / 2.,
                      elementZ - ElectromagnetAxialLengthM / 2.,
                      StatorCoreRadialDepthM, elementWidth,
                      ElectromagnetAxialLengthM};
       Box(coilTag) = {StatorCoreInnerRadiusM + StatorCoreRadialDepthM + CoilRadialMarginM,
                       -(elementWidth + 2. * CoilTangentialMarginM) / 2.,
                      elementZ - (ElectromagnetAxialLengthM + 2. * CoilAxialMarginM) / 2.,
                      CoilRadialDepthM,
                       elementWidth + 2. * CoilTangentialMarginM,
                      ElectromagnetAxialLengthM + 2. * CoilAxialMarginM};
       Rotate {{0, 0, 1}, {0, 0, 0}, elementAngle * Deg} {
         Volume{coreTag};
         Volume{coilTag};
       }

       statorCoreVolumes[] += {coreTag};
       statorCoilVolumes[] += {coilTag};
       statorCoreBounds[] += BoundingBox Volume{coreTag};
       statorCoilBounds[] += BoundingBox Volume{coilTag};
       allToolVolumes[] += {coreTag, coilTag};
    EndFor
  EndFor
EndFor

// Rotor: 3 stations at 120 degrees, each with major/minor and front/back.
For station In {0:2}
  rotorAngle = RotorAngleDeg + RotorPhaseDeg + station * 120.;
  For pair In {0:1}
    If(pair == 0)
      elementName = "Minor";
      elementWidth = RotorMinorTangentialWidthM;
    Else
      elementName = "Major";
      elementWidth = RotorMajorTangentialWidthM;
    EndIf

    If(pair == 0)
      elementAngle = rotorAngle;
    Else
      elementAngle = rotorAngle + PairOffsetDeg;
    EndIf

    For plane In {0:1}
      If(plane == 0)
        planeName = "Front";
        elementZ = FrontZ;
      Else
        planeName = "Back";
        elementZ = BackZ;
      EndIf

      index = station * 4 + pair * 2 + plane;
      coreTag = 30001 + index;
      coilTag = 40001 + index;

      Box(coreTag) = {RotorCoreInnerRadiusM, -elementWidth / 2.,
                      elementZ - ElectromagnetAxialLengthM / 2.,
                      RotorCoreRadialDepthM, elementWidth,
                      ElectromagnetAxialLengthM};
       Box(coilTag) = {RotorCoreInnerRadiusM + RotorCoreRadialDepthM + CoilRadialMarginM,
                       -(elementWidth + 2. * RotorCoilTangentialMarginM) / 2.,
                      elementZ - (ElectromagnetAxialLengthM + 2. * CoilAxialMarginM) / 2.,
                      CoilRadialDepthM,
                       elementWidth + 2. * RotorCoilTangentialMarginM,
                      ElectromagnetAxialLengthM + 2. * CoilAxialMarginM};
       Rotate {{0, 0, 1}, {0, 0, 0}, elementAngle * Deg} {
         Volume{coreTag};
         Volume{coilTag};
       }

       rotorCoreVolumes[] += {coreTag};
       rotorCoilVolumes[] += {coilTag};
       rotorCoreBounds[] += BoundingBox Volume{coreTag};
       rotorCoilBounds[] += BoundingBox Volume{coilTag};
       allToolVolumes[] += {coreTag, coilTag};
    EndFor
  EndFor
EndFor

// Partition the cylinder and every material solid in one OCC operation. This
// removes material/air overlap and gives all regions the same interface faces.
// Original elementary tags are not reused after Delete.
fragmentedVolumes[] = BooleanFragments{ Volume{1}; Delete; }{ Volume{allToolVolumes[]}; Delete; };
allPostVolumes[] = Volume{:};

// Rebuild material and assembly groups from post-boolean fragments selected by
// the saved bounding boxes. This is stable even when OCC renumbers or splits a
// source box during fragmentation.
Physical Volume("StatorCores", 200) = {};
Physical Volume("StatorCoils", 3201) = {};
Physical Volume("RotorCores", 202) = {};
Physical Volume("RotorCoils", 3203) = {};
Physical Volume("AllCores", 204) = {};
Physical Volume("AllCoils", 3205) = {};
Physical Volume("Air", 100) = {};
statorCorePostVolumes[] = {};
statorCoilPostVolumes[] = {};
rotorCorePostVolumes[] = {};
rotorCoilPostVolumes[] = {};

For station In {0:8}
  For pair In {0:1}
    If(pair == 0)
      elementName = "Minor";
    Else
      elementName = "Major";
    EndIf
    For plane In {0:1}
      If(plane == 0)
        planeName = "Front";
      Else
        planeName = "Back";
      EndIf
      index = station * 4 + pair * 2 + plane;
      boundOffset = index * 6;
      coreFragments[] = Volume In BoundingBox {
        statorCoreBounds[boundOffset] - Eps,
        statorCoreBounds[boundOffset + 1] - Eps,
        statorCoreBounds[boundOffset + 2] - Eps,
        statorCoreBounds[boundOffset + 3] + Eps,
        statorCoreBounds[boundOffset + 4] + Eps,
        statorCoreBounds[boundOffset + 5] + Eps};
      coilFragments[] = Volume In BoundingBox {
        statorCoilBounds[boundOffset] - Eps,
        statorCoilBounds[boundOffset + 1] - Eps,
        statorCoilBounds[boundOffset + 2] - Eps,
        statorCoilBounds[boundOffset + 3] + Eps,
        statorCoilBounds[boundOffset + 4] + Eps,
        statorCoilBounds[boundOffset + 5] + Eps};
      assemblyTag = 5001 + index;
      Physical Volume(StrCat(Sprintf("Stator_%g_", station + 1),
                             elementName, "_", planeName, "_CoilCore"), assemblyTag) = {coreFragments[], coilFragments[]};
      Physical Volume(StrCat(Sprintf("Stator_%g_", station + 1),
                             elementName, "_", planeName, "_Coil"), 2101 + index) = {coilFragments[]};
      Physical Volume("StatorCores", 200) += coreFragments[];
      Physical Volume("StatorCoils", 3201) += coilFragments[];
      Physical Volume("AllCores", 204) += coreFragments[];
      Physical Volume("AllCoils", 3205) += coilFragments[];
      statorCorePostVolumes[] += {coreFragments[]};
      statorCoilPostVolumes[] += {coilFragments[]};
    EndFor
  EndFor
EndFor

For station In {0:2}
  For pair In {0:1}
    If(pair == 0)
      elementName = "Minor";
    Else
      elementName = "Major";
    EndIf
    For plane In {0:1}
      If(plane == 0)
        planeName = "Front";
      Else
        planeName = "Back";
      EndIf
      index = station * 4 + pair * 2 + plane;
      boundOffset = index * 6;
      coreFragments[] = Volume In BoundingBox {
        rotorCoreBounds[boundOffset] - Eps,
        rotorCoreBounds[boundOffset + 1] - Eps,
        rotorCoreBounds[boundOffset + 2] - Eps,
        rotorCoreBounds[boundOffset + 3] + Eps,
        rotorCoreBounds[boundOffset + 4] + Eps,
        rotorCoreBounds[boundOffset + 5] + Eps};
      coilFragments[] = Volume In BoundingBox {
        rotorCoilBounds[boundOffset] - Eps,
        rotorCoilBounds[boundOffset + 1] - Eps,
        rotorCoilBounds[boundOffset + 2] - Eps,
        rotorCoilBounds[boundOffset + 3] + Eps,
        rotorCoilBounds[boundOffset + 4] + Eps,
        rotorCoilBounds[boundOffset + 5] + Eps};
      assemblyTag = 5101 + index;
      Physical Volume(StrCat(Sprintf("Rotor_%g_", station + 1),
                             elementName, "_", planeName, "_CoilCore"), assemblyTag) = {coreFragments[], coilFragments[]};
      Physical Volume(StrCat(Sprintf("Rotor_%g_", station + 1),
                             elementName, "_", planeName, "_Coil"), 2201 + index) = {coilFragments[]};
      Physical Volume("RotorCores", 202) += coreFragments[];
      Physical Volume("RotorCoils", 3203) += coilFragments[];
      Physical Volume("AllCores", 204) += coreFragments[];
      Physical Volume("AllCoils", 3205) += coilFragments[];
      rotorCorePostVolumes[] += {coreFragments[]};
      rotorCoilPostVolumes[] += {coilFragments[]};
    EndFor
  EndFor
EndFor

materialVolumes[] = statorCorePostVolumes[];
materialVolumes[] += statorCoilPostVolumes[];
materialVolumes[] += rotorCorePostVolumes[];
materialVolumes[] += rotorCoilPostVolumes[];
airVolumes[] = allPostVolumes[];
airVolumes[] -= materialVolumes[];
Physical Volume("Air", 100) += airVolumes[];
outerBoundary[] = CombinedBoundary{ Volume{allPostVolumes[]}; };
Physical Surface("OuterBoundary", 300) = {outerBoundary[]};

Mesh.MeshSizeFromPoints = 0;
Mesh.MeshSizeFromCurvature = 0;
Mesh.MeshSizeExtendFromBoundary = 0;
localFeatureSize = FeatureMeshSizeM;
localAirSize = MeshSizeValue;
If(SmokeMesh)
  localFeatureSize = 0.005;
  localAirSize = 0.04;
EndIf

// Resolve the 1 mm core/coil clearance and the 8 mm/10 mm material features
// locally without paying that resolution throughout the far-field air.
materialSurfaces[] = Boundary{ Volume{materialVolumes[]}; };
Field[1] = Distance;
Field[1].FacesList = {materialSurfaces[]};
Field[2] = Threshold;
Field[2].InField = 1;
Field[2].SizeMin = localFeatureSize;
Field[2].SizeMax = localAirSize;
Field[2].DistMin = 0.006;
Field[2].DistMax = 0.02;
Background Field = 2;
Mesh.MeshSizeMin = localFeatureSize;
Mesh.MeshSizeMax = localAirSize;
// Mesh.Algorithm3D = 4 requires Netgen, which is absent from the pinned build.
Mesh.Algorithm3D = 1;
Mesh.Optimize = 1;
Mesh.MshFileVersion = 4.1;
