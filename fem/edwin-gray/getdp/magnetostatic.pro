/*
   Basic 3D magnetostatic / energy / inductance-proxy problem.

   Run with a mesh made from patent-3890548-3d.geo:
     getdp magnetostatic.pro -msh motor.msh -solve Magnetostatics3D
     getdp magnetostatic.pro -msh motor.msh -pos MagnetostaticResults

   Limitations are intentional: this is a linear isotropic H(curl) solve with
   a uniform impressed current density in homogenized coil volumes. It does
   not solve the capacitor discharge transient, spark gaps, commutator,
   winding turns, motion, torque, mechanical load, saturation, hysteresis,
   lamination loss, eddy currents, thermal effects, or energy recovery. The
   inductance is the linear energy proxy 2 W / I^2. No non-Maxwell term is used.
*/

Group {
  Air = Region[100];
  StatorCores = Region[200];
  StatorCoils = Region[201];
  RotorCores = Region[202];
  RotorCoils = Region[203];
  AllCores = Region[204];
  AllCoils = Region[205];
  OuterBoundary = Region[300];

  Domain = Region[{Air, AllCores, AllCoils}];
  DomainWithSourceCurrentDensity = Region[AllCoils];
}

Function {
  mu0 = 4.e-7 * Pi;
  CoreRelativePermeability = DefineNumber[1000., Name "Parameters/Core relative permeability"];
  DriveCurrentA = DefineNumber[1., Name "Parameters/Drive current (A)"];
  Turns = DefineNumber[100., Name "Parameters/Turns"];
  EffectiveCoilCrossSectionM2 = DefineNumber[1.e-4, Name "Parameters/Effective coil cross-section (m^2)"];

  nu[Region[{Air, AllCoils}]] = 1. / mu0;
  nu[AllCores] = 1. / (CoreRelativePermeability * mu0);
  SourceCurrentDensity[AllCoils] = Vector[0., 0., Turns * DriveCurrentA / EffectiveCoilCrossSectionM2];
}

Constraint {
  // The complete boundary of the cut air volume is used for a simple gauge
  // anchor. For production work, distinguish the external boundary from
  // material interfaces and choose a domain-specific gauge.
  { Name GaugeCondition; Type Assign;
    Case {
      { Region Domain; SubRegion OuterBoundary; Value 0.; }
    }
  }
}

Jacobian {
  { Name Vol;
    Case {
      { Region All; Jacobian Vol; }
    }
  }
}

Integration {
  { Name Int_1;
    Case {
      { Type Gauss;
        Case {
          { GeoElement Tetrahedron; NumberOfPoints 4; }
          { GeoElement Hexahedron; NumberOfPoints 6; }
          { GeoElement Prism; NumberOfPoints 9; }
        }
      }
    }
  }
}

FunctionSpace {
  { Name Hcurl_a_Gauge; Type Form1;
    BasisFunction {
      { Name se; NameOfCoef ae; Function BF_Edge;
        Support Domain; Entity EdgesOf[All]; }
    }
    Constraint {
      { NameOfCoef ae;
        EntityType EdgesOfTreeIn; EntitySubType StartingOn;
        NameOfConstraint GaugeCondition; }
    }
  }
}

Formulation {
  { Name Magnetostatics3D; Type FemEquation;
    Quantity {
      { Name a; Type Local; NameOfSpace Hcurl_a_Gauge; }
    }
    Equation {
      Integral { [nu[] * Dof{Curl a}, {Curl a}];
                 In Domain; Jacobian Vol; Integration Int_1; }
      Integral { [-SourceCurrentDensity[], {a}];
                 In DomainWithSourceCurrentDensity;
                 Jacobian Vol; Integration Int_1; }
    }
  }
}

Resolution {
  { Name Magnetostatics3D;
    System {
      { Name Sys_Mag; NameOfFormulation Magnetostatics3D; }
    }
    Operation {
      Generate[Sys_Mag];
      Solve[Sys_Mag];
      SaveSolution[Sys_Mag];
    }
  }
}

PostProcessing {
  { Name MagnetostaticResults; NameOfFormulation Magnetostatics3D;
    Quantity {
      { Name VectorPotential;
        Value { Local { [{a}]; In Domain; Jacobian Vol; } }
      }
      { Name MagneticFluxDensity;
        Value { Local { [{Curl a}]; In Domain; Jacobian Vol; } }
      }
      { Name MagneticEnergyJ;
        Value { Integral { [0.5 * nu[] * SquNorm[{Curl a}]];
                           In Domain; Integration Int_1; Jacobian Vol; } }
      }
      { Name CoEnergyJ;
        Value { Integral { [0.5 * nu[] * SquNorm[{Curl a}]];
                           In Domain; Integration Int_1; Jacobian Vol; } }
      }
      { Name InductanceH;
        Value { Integral { [nu[] * SquNorm[{Curl a}] / (DriveCurrentA ^ 2)];
                           In Domain; Integration Int_1; Jacobian Vol; } }
      }
    }
  }
}

PostOperation {
  { Name MagnetostaticResults; NameOfPostProcessing MagnetostaticResults;
    Operation {
      Print[VectorPotential, OnElementsOf Domain, File "magnetic-potential.pos"];
      Print[MagneticFluxDensity, OnElementsOf Domain, File "magnetic-flux-density.pos"];
      Print[MagneticEnergyJ[Domain], OnGlobal, Format Table, File "observables.dat"];
      Print[CoEnergyJ[Domain], OnGlobal, Format Table, File "coenergy.dat"];
      Print[InductanceH[Domain], OnGlobal, Format Table, File "inductance.dat"];
    }
  }
}
