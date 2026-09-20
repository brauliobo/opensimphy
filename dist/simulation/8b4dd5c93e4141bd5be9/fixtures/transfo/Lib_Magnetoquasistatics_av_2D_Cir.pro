// Lib_Magnetoquasistatics_av_2D_Cir.pro
//
// Template library for 2D magneto-quasistatic problems in terms of the magnetic
// vector potential "a" and the electric scalar potential "v", with optional
// circuit coupling.

// Default definitions of constants, groups and functions that can (should) be
// redefined from outside the template:

DefineConstant[
  AnalysisType = 1, // static (0), time-domain (1) or frequency-domain (2)
  Axisymmetric = 0, // axisymmetric model?
  CircuitCoupling = 0, // consider coupling with external electric circuit
  NewtonRaphson = 1, // Newton-Raphson or Picard method for nonlinear iterations
  CoefPower = 1, // power calculation coefficient (0.5 for peak-valued phasors)
  Freq = 50, // frequency (for harmonic simulations)
  TimeInit = 0, // initial time (for time-domain simulations)
  TimeFinal = 1/50, // final time (for time-domain simulations)
  DeltaTime = 1/500, // time step (for time-domain simulations)
  FEOrder = 1, // finite element order
  JacRadiusInt = 0, // interior radius for spherical shell (Vol_Inf_Mag)
  JacRadiusExt = 0, // exterior radius of spherical shell (Vol_Inf_Mag)
  JacCenterX = 0, // x-coordinate of center of Vol_Inf_Mag
  JacCenterY = 0, // y-coordinate of center of Vol_Inf_Mag
  JacCenterZ = 0, // z-coordinate of center of Vol_Inf_Mag
  NLTolAbs = 1e-10, // absolute tolerance on residual for nonlinear iterations
  NLTolRel = 1e-6, // relative tolerance on residual for nonlinear iterations
  NLIterMax = 20 // maximum number of nonlinear iterations
];

Group {
  DefineGroup[
    // The full magnetic domain:
    Vol_Mag,

    // Subsets of Vol_Mag:
    Vol_C_Mag, // massive conductors
    Vol_S_Mag, // stranded conductors
    Vol_S0_Mag, // stranded conductors with imposed current density js0
    Vol_NL_Mag, // nonlinear magnetic materials
    Vol_V_Mag, // moving massive conducting parts (with invariant mesh)
    Vol_M_Mag, // permanent magnets
    Vol_Inf_Mag, // annulus where an infinite shell transformation is applied

    // Boundaries:
    Sur_Neu_Mag, // non-homogeneous Neumann BC (flux tube with n x h = nxh[])
    Sur_Imped_Mag // conductors approximated by an impedance (non-meshed)
  ];
  If(CircuitCoupling)
    DefineGroup[
      Source_Cir, // voltage and current sources
      Resistance_Cir, // resistors
      Inductance_Cir, // inductors
      Capacitance_Cir // capacitors
    ];
  EndIf
}

Function {
  DefineFunction[
    nu, // reluctivity (in Vol_Mag)
    sigma, // conductivity (in Vol_C_Mag and Vol_S_Mag)
    br, // remanent magnetic flux density (in Vol_M_Mag)
    js0, // source current density (in Vol_S0_Mag)
    dhdb, // Jacobian for Newton-Raphson method (in Vol_NL_Mag)
    nxh, // n x magnetic field (on Sur_Neu_Mag)
    Velocity, // velocity of moving part (in Vol_V_Mag)
    Ns, // number of turns (in Vol_S_Mag)
    Sc, // cross-section of windings (in Vol_S_Mag)
    CoefGeo, // thickness (2D) or 2 * Pi (axisymmetric) geometrical coefficient
             // (in Vol_Mag); negative to set positive current along -z
    Ysur // surface admittance (on Sur_Imped_Mag)
  ];
  If(CircuitCoupling)
    DefineFunction[
      Resistance, // lumped resistance values
      Inductance, // lumped inductance values
      Capacitance // lumped capacitance values
    ];
  EndIf
}

// End of default definitions.

Jacobian {
  { Name JacVol_Mag;
    Case {
      If(Axisymmetric)
        { Region Vol_Inf_Mag;
          Jacobian VolAxiSquSphShell{JacRadiusInt, JacRadiusExt,
                                     JacCenterX, JacCenterY, JacCenterZ}; }
        { Region All; Jacobian VolAxiSqu; }
      Else
        { Region Vol_Inf_Mag;
          Jacobian VolSphShell{JacRadiusInt, JacRadiusExt,
                               JacCenterX, JacCenterY, JacCenterZ}; }
        { Region All; Jacobian Vol; }
      EndIf
    }
  }
  { Name JacSur_Mag;
    Case {
      If(Axisymmetric)
        { Region All; Jacobian SurAxi; }
      Else
        { Region All; Jacobian Sur; }
      EndIf
    }
  }
}

Integration {
  { Name Int_Mag;
    Case {
      { Type Gauss;
        Case {
          { GeoElement Point; NumberOfPoints  1; }
          { GeoElement Line; NumberOfPoints (FEOrder == 1) ? 2 : 4; }
          { GeoElement Triangle; NumberOfPoints (FEOrder == 1) ? 3 : 6; }
          { GeoElement Quadrangle; NumberOfPoints (FEOrder == 1) ? 4 : 16; }
        }
      }
    }
  }
}

Group{
  Dom_Hcurl_a_Mag_2D = Region[ {Vol_Mag, Sur_Neu_Mag, Sur_Imped_Mag} ];
  Dom_Hcurl_u_Mag_2D = Region[ {Vol_C_Mag, Sur_Imped_Mag} ];
  If(CircuitCoupling)
    Dom_Cir = Region[ {Source_Cir, Resistance_Cir, Inductance_Cir, Capacitance_Cir} ];
  EndIf
}

FunctionSpace {
  // Magnetic vector potential
  { Name Hcurl_a_Mag_2D; Type Form1P;
    BasisFunction {
      { Name se; NameOfCoef ae; Function BF_PerpendicularEdge;
        Support Dom_Hcurl_a_Mag_2D; Entity NodesOf[All]; }
      If(FEOrder == 2)
        { Name se2; NameOfCoef ae2; Function BF_PerpendicularEdge_2E;
          Support Dom_Hcurl_a_Mag_2D; Entity EdgesOf[All]; }
      EndIf
    }
    Constraint {
      { NameOfCoef ae; EntityType NodesOf; NameOfConstraint a_Mag_2D; }
      If(FEOrder == 2)
        { NameOfCoef ae2; EntityType EdgesOf; NameOfConstraint a0_Mag_2D; }
      EndIf
    }
  }

  // Gradient of scalar electric potential
  { Name Hcurl_u_Mag_2D; Type Form1P;
    BasisFunction {
      { Name sr; NameOfCoef ur; Function BF_RegionZ;
        Support Dom_Hcurl_u_Mag_2D; Entity Dom_Hcurl_u_Mag_2D; }
    }
    GlobalQuantity {
      { Name Voltage; Type AliasOf; NameOfCoef ur; }
      { Name Current; Type AssociatedWith; NameOfCoef ur; }
    }
    Constraint {
      { NameOfCoef Voltage; EntityType Region; NameOfConstraint Voltage_Mag_2D; }
      { NameOfCoef Current; EntityType Region; NameOfConstraint Current_Mag_2D; }
    }
  }

  // Current in stranded coils
  { Name Hregion_i_Mag_2D; Type Vector;
    BasisFunction {
      { Name sr; NameOfCoef ir; Function BF_RegionZ;
        Support Vol_S_Mag; Entity Vol_S_Mag; }
    }
    GlobalQuantity {
      { Name Current; Type AliasOf; NameOfCoef ir; }
      { Name Voltage; Type AssociatedWith; NameOfCoef ir; }
    }
    Constraint {
      { NameOfCoef Voltage; EntityType Region; NameOfConstraint Voltage_Mag_2D; }
      { NameOfCoef Current; EntityType Region; NameOfConstraint Current_Mag_2D; }
    }
  }

  If(CircuitCoupling)
    // Current in lumped circuit elements
    { Name Hregion_i_Cir; Type Scalar;
      BasisFunction {
        { Name sr; NameOfCoef ir; Function BF_Region;
          Support Dom_Cir; Entity Dom_Cir; }
      }
      GlobalQuantity {
        { Name Current; Type AliasOf; NameOfCoef ir; }
        { Name Voltage; Type AssociatedWith; NameOfCoef ir; }
      }
      Constraint {
        { NameOfCoef Voltage; EntityType Region; NameOfConstraint Voltage_Cir; }
        { NameOfCoef Current; EntityType Region; NameOfConstraint Current_Cir; }
      }
    }
  EndIf
}

Group{
  // all linear materials
  Vol_L_Mag = Region[ {Vol_Mag, -Vol_NL_Mag} ];
}

Formulation {
  { Name Magnetoquasistatics_av_2D; Type FemEquation;
    Quantity {
      { Name a; Type Local; NameOfSpace Hcurl_a_Mag_2D; }
      { Name ir; Type Local; NameOfSpace Hregion_i_Mag_2D; }
      { Name Us; Type Global; NameOfSpace Hregion_i_Mag_2D [Voltage]; }
      { Name Is; Type Global; NameOfSpace Hregion_i_Mag_2D [Current]; }
      If(AnalysisType > 0)
        { Name ur; Type Local; NameOfSpace Hcurl_u_Mag_2D; }
        { Name U; Type Global; NameOfSpace Hcurl_u_Mag_2D [Voltage]; }
        { Name I; Type Global; NameOfSpace Hcurl_u_Mag_2D [Current]; }
        If(CircuitCoupling)
          { Name Uz; Type Global; NameOfSpace Hregion_i_Cir [Voltage]; }
          { Name Iz; Type Global; NameOfSpace Hregion_i_Cir [Current]; }
        EndIf
      EndIf
    }
    Equation {
      Integral { [ nu[] * Dof{d a} , {d a} ];
        In Vol_L_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }

      If(NewtonRaphson)
        Integral { [ nu[{d a}] * {d a} , {d a} ];
          In Vol_NL_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }
        Integral { [ dhdb[{d a}] * Dof{d a} , {d a} ];
          In Vol_NL_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }
        Integral { [ - dhdb[{d a}] * {d a} , {d a} ];
          In Vol_NL_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }
      Else
        Integral { [ nu[{d a}] * Dof{d a}, {d a} ];
          In Vol_NL_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }
      EndIf

      Integral { [ - nu[] * br[] , {d a} ];
        In Vol_M_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }

      Integral { [ - js0[] , {a} ];
        In Vol_S0_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }
      Integral { [ - Ns[] / Sc[] * Sign[CoefGeo[]] * Dof{ir} , {a} ];
        In Vol_S_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }

      Integral { [ Ns[]^2 / Sc[]^2 / sigma[] * Sign[CoefGeo[]] * Dof{ir} , {ir} ];
        In Vol_S_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }
      GlobalTerm { [ Dof{Us} / CoefGeo[] , {Is} ]; In Vol_S_Mag; }

      Integral { [ nxh[] , {a} ];
        In Sur_Neu_Mag; Jacobian JacSur_Mag; Integration Int_Mag; }

      If(AnalysisType > 0)
        Integral { DtDof [ sigma[] * Dof{a} , {a} ];
          In Vol_C_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }
        Integral { [ sigma[] * Dof{ur} / CoefGeo[] , {a} ];
          In Vol_C_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }

        Integral { [ - sigma[] * (Velocity[] /\ Dof{d a}) , {a} ];
          In Vol_V_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }

        Integral { DtDof [  Ysur[] * Dof{a} , {a} ];
          In Sur_Imped_Mag; Jacobian JacSur_Mag; Integration Int_Mag; }
        Integral { [ Ysur[] * Dof{ur} / CoefGeo[] , {a} ];
          In Sur_Imped_Mag; Jacobian JacSur_Mag; Integration Int_Mag; }

        Integral { DtDof [ sigma[] * Dof{a} , {ur} ];
          In Vol_C_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }
        Integral { [ sigma[] * Dof{ur} / CoefGeo[] , {ur} ];
          In Vol_C_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }
        GlobalTerm { [ Dof{I} *(CoefGeo[]/Fabs[CoefGeo[]]) , {U} ]; In Vol_C_Mag; }

        Integral { DtDof [ Ysur[] * Dof{a} , {ur} ];
          In Sur_Imped_Mag; Jacobian JacSur_Mag; Integration Int_Mag; }
        Integral { [ Ysur[] * Dof{ur} / CoefGeo[] , {ur} ];
          In Sur_Imped_Mag; Jacobian JacSur_Mag; Integration Int_Mag; }
        GlobalTerm { [ Dof{I} * (CoefGeo[] / Fabs[CoefGeo[]]) , {U} ]; In Sur_Imped_Mag; }

        Integral { DtDof [ Ns[] / Sc[] * Dof{a} , {ir} ];
          In Vol_S_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }

        If(CircuitCoupling)
          GlobalTerm { NeverDt[ Dof{Uz} , {Iz} ]; In Resistance_Cir; }
          GlobalTerm { NeverDt[ Resistance[{Uz}] * Dof{Iz} , {Iz} ]; In Resistance_Cir; }

          GlobalTerm { [ Dof{Uz} , {Iz} ]; In Inductance_Cir; }
          GlobalTerm { DtDof [ Inductance[] * Dof{Iz} , {Iz} ]; In Inductance_Cir; }

          GlobalTerm { NeverDt[ Dof{Iz} , {Iz} ]; In Capacitance_Cir; }
          GlobalTerm { DtDof [ Capacitance[] * Dof{Uz} , {Iz} ]; In Capacitance_Cir; }

          GlobalTerm { [ 0. * Dof{Iz} , {Iz} ]; In Source_Cir; }

          GlobalEquation {
            Type Network; NameOfConstraint ElectricalCircuit;
            { Node {I};  Loop {U};  Equation {I};  In Vol_C_Mag; }
            { Node {Is}; Loop {Us}; Equation {Us}; In Vol_S_Mag; }
            { Node {Iz}; Loop {Uz}; Equation {Uz}; In Dom_Cir; }
          }
        EndIf
      EndIf
    }
  }
}

Resolution {
  { Name Mag;
    System {
      { Name A; NameOfFormulation Magnetoquasistatics_av_2D;
        If(AnalysisType == 2)
          Type ComplexValue; Frequency Freq;
        EndIf
      }
    }
    Operation {
      If(AnalysisType == 0 || AnalysisType == 2)
        Generate[A]; Solve[A]; SaveSolution[A];
      Else
        InitSolution[A];
        TimeLoopTheta[TimeInit, TimeFinal, DeltaTime, 1.]{
          Generate[A]; Solve[A];
          If(NbrRegions[Vol_NL_Mag])
            Generate[A]; GetResidual[A, $res0];
            Evaluate[ $res = $res0, $iter = 0 ];
            Print[{$iter, $res, $res / $res0},
              Format "Residual %03g: abs %14.12e rel %14.12e"];
            While[$res > NLTolAbs && $res / $res0 > NLTolRel &&
                  $res / $res0 <= 1 && $iter < NLIterMax]{
              Solve[A]; Generate[A]; GetResidual[A, $res];
              Evaluate[ $iter = $iter + 1 ];
              Print[{$iter, $res, $res / $res0},
                Format "Residual %03g: abs %14.12e rel %14.12e"];
            }
          EndIf
          SaveSolution[A];
        }
      EndIf
    }
  }
}

PostProcessing {
  { Name Mag; NameOfFormulation Magnetoquasistatics_av_2D;
    Quantity {
      { Name a; Value {
          Term { [ {a} ]; In Vol_Mag; Jacobian JacVol_Mag; }
        }
      }
      { Name az; Value {
          Term { [ CompZ[{a}] ]; In Vol_Mag; Jacobian JacVol_Mag; }
        }
      }
      { Name xaz; Value {
          Term { [ X[] * CompZ[{a}] ]; In Vol_Mag; Jacobian JacVol_Mag; }
        }
      }
      { Name b; Value {
          Term { [ {d a} ]; In Vol_Mag; Jacobian JacVol_Mag; }
        }
      }
      { Name NormB; Value {
          Term { [ Norm[{d a}] ]; In Vol_Mag; Jacobian JacVol_Mag; }
        }
      }
      { Name h; Value {
          Term { [ nu[] * {d a} ]; In Vol_L_Mag; Jacobian JacVol_Mag; }
          Term { [ nu[{d a}] * {d a} ]; In Vol_NL_Mag; Jacobian JacVol_Mag; }
          Term { [ -nu[] * br[] ]; In Vol_M_Mag; Jacobian JacVol_Mag; }
        }
      }
      { Name j; Value {
          If(AnalysisType > 0)
            Term { [ -sigma[] * (Dt[{a}] + {ur} / CoefGeo[]) ];
              In Vol_C_Mag; Jacobian JacVol_Mag; }
            // Current density in A/m
            Term { [ -Ysur[] * (Dt[{a}] + {ur} / CoefGeo[]) ];
              In Sur_Imped_Mag; Jacobian JacSur_Mag; }
          EndIf
          Term { [ js0[] ];
            In Vol_S0_Mag; Jacobian JacVol_Mag; }
          Term { [ Ns[] / Sc[] * Sign[CoefGeo[]] * {ir} ];
            In Vol_S_Mag; Jacobian JacVol_Mag; }
          Term { [ Vector[0, 0, 0] ];
            In Vol_Mag; Jacobian JacVol_Mag; }
        }
      }
      { Name U; Value {
          If(AnalysisType > 0)
            Term { [ {U} ]; In Vol_C_Mag; }
            If(CircuitCoupling)
              Term { [ {Uz} ]; In Dom_Cir; }
            EndIf
          EndIf
          Term { [ {Us} ]; In Vol_S_Mag; }
        }
      }
      { Name I; Value {
          If(AnalysisType > 0)
            Term { [ {I} ]; In Vol_C_Mag; }
            If(CircuitCoupling)
              Term { [ {Iz} ]; In Dom_Cir; }
            EndIf
          EndIf
          Term { [ {Is} ]; In Vol_S_Mag; }
        }
      }
      { Name NormU; Value {
          If(AnalysisType > 0)
            Term { [ Norm[{U}] ]; In Vol_C_Mag; }
            If(CircuitCoupling)
              Term { [ Norm[{Uz}] ]; In Dom_Cir; }
            EndIf
          EndIf
          Term { [ Norm[{Us}] ]; In Vol_S_Mag; }
        }
      }
      { Name NormI; Value {
          If(AnalysisType > 0)
            Term { [ Norm[{I}] ]; In Vol_C_Mag; }
            If(CircuitCoupling)
              Term { [ Norm[{Iz}] ]; In Dom_Cir; }
            EndIf
          EndIf
          Term { [ Norm[{Is}] ]; In Vol_S_Mag; }
        }
      }
      { Name JouleLosses; Value {
          If(AnalysisType > 0)
            Integral { [ CoefPower * sigma[] * SquNorm[Dt[{a}] + {ur} / CoefGeo[]] ];
              In Vol_C_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }
            Integral { [ CoefPower * Ysur[] * SquNorm[Dt[{a}] + {ur} / CoefGeo[]] ];
              In Sur_Imped_Mag; Jacobian JacSur_Mag; Integration Int_Mag; }
          EndIf
          Integral { [ CoefPower * 1. / sigma[] * SquNorm[js0[]] ];
            In Vol_S0_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }
          Integral { [ CoefPower * 1. / sigma[] *
              SquNorm[Ns[] / Sc[] * Sign[CoefGeo[]] * {ir}] ];
            In Vol_S_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }
        }
      }
      { Name HarmonicMagneticLosses; Value {
          If(AnalysisType == 2)
            Integral { [ CoefPower * 2 * Pi * Freq * Im[nu[]] * SquNorm[{d a}] ];
              In Vol_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }
          EndIf
        }
      }
      { Name LaplaceForce; Value {
          If(AnalysisType == 2)
            // DC component (phasor at 2 * Freq in HarmonicLaplaceForce2F)
            Integral { [
                Re[-sigma[] * (Dt[{a}] + {ur} / CoefGeo[])] /\ Re[{d a}] / 2. +
                Im[-sigma[] * (Dt[{a}] + {ur} / CoefGeo[])] /\ Im[{d a}] / 2. ];
              In Vol_C_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }
            Integral { [
                Re[js0[]] /\ Re[{d a}] / 2. +
                Im[js0[]] /\ Im[{d a}] / 2. ];
              In Vol_S0_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }
            Integral { [
                Re[(js0[] *Vector[0, 0, 1]) * {ir}] /\ Re[{d a}] / 2. +
                Im[(js0[] *Vector[0, 0, 1]) * {ir}] /\ Im[{d a}] / 2. ];
              In Vol_S_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }
          Else
            If(AnalysisType == 1)
              Integral { [ -sigma[] * (Dt[{a}] + {ur} / CoefGeo[]) /\ {d a} ];
                In Vol_C_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }
            EndIf
            Integral { [ js0[] /\ {d a} ];
              In Vol_S0_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }
            Integral { [ Ns[] / Sc[] * Sign[CoefGeo[]] * {ir} /\ {d a} ];
              In Vol_S_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }
          EndIf
        }
      }
      { Name HarmonicLaplaceForce2F; Value {
          If(AnalysisType == 2)
            // 2 * Freq component
            Integral { [ Complex[
                  Re[-sigma[] * (Dt[{a}] + {ur} / CoefGeo[])] /\ Re[{d a}] / 2. -
                  Im[-sigma[] * (Dt[{a}] + {ur} / CoefGeo[])] /\ Im[{d a}] / 2. ,
                  Im[-sigma[] * (Dt[{a}] + {ur} / CoefGeo[])] /\ Re[{d a}] / 2. +
                  Re[-sigma[] * (Dt[{a}] + {ur} / CoefGeo[])] /\ Im[{d a}] / 2. ] ];
              In Vol_C_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }
            Integral { [ Complex [
                  Re[js0[]] /\ Re[{d a}] / 2. -
                  Im[js0[]] /\ Im[{d a}] / 2. ,
                  Im[js0[]] /\ Re[{d a}] / 2. +
                  Re[js0[]] /\ Im[{d a}] / 2. ] ];
              In Vol_S0_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }
            Integral { [ Complex [
                  Re[Ns[] / Sc[] * Sign[CoefGeo[]] * {ir}] /\ Re[{d a}] / 2. -
                  Im[Ns[] / Sc[] * Sign[CoefGeo[]] * {ir}] /\ Im[{d a}] / 2. ,
                  Im[Ns[] / Sc[] * Sign[CoefGeo[]] * {ir}] /\ Re[{d a}] / 2. +
                  Re[Ns[] / Sc[] * Sign[CoefGeo[]] * {ir}] /\ Im[{d a}] / 2. ] ];
              In Vol_S_Mag; Jacobian JacVol_Mag; Integration Int_Mag; }
          EndIf
        }
      }
    }
  }
}
