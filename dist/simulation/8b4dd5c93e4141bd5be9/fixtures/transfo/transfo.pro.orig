// This tutorial models a single-phase transformer with two windings (primary
// and secondary) wound around a laminated ferromagnetic core, using a
// frequency-domain magneto-quasistatic a-v formulation coupled with two
// external circuits.
//
// Whereas previous tutorials built the complete formulation, function spaces,
// resolution and post-processing from scratch, this tutorial illustrates the
// use of a generic template library ("Lib_Magnetoquasistatics_av_2D_Cir.pro").
// The library provides a ready-made a-v formulation that handles massive
// conductors, stranded coils, nonlinear materials, permanent magnets, impedance
// boundary conditions, and circuit coupling. The user only needs to define the
// physical and abstract groups, the material properties, the constraints, and a
// few configuration variables -- the rest is taken care of by the library.
//
// The main new modelling concepts introduced in the tutorial are the modelling
// of stranded coils and of the ferromagnetic laminations in the core.
//
// Unlike the massive (solid) conductors of tutorials 7 and 8, where eddy
// currents are resolved inside the conductor cross-section, a stranded coil is
// modelled as a homogenized region carrying a uniform current density
//
//   j = Ns / Sc * I * z_hat,
//
// where "Ns" is the number of turns, "Sc" the cross-sectional area of the
// winding, "I" the total current (the same in each turn), and "z_hat" the unit
// vector along the conductor direction. This approximation is valid when the
// coil consists of a large number of turns in series with each other (so that
// each turn carries the same current), where each individual turn is thin
// compared to the skin depth (so that the current distribution within each turn
// is essentially uniform).

// Each winding consists of two coil sides (the "go" and "return" halves of the
// same winding), modelled as separate regions with opposite current
// directions. The two windings are connected to two independent circuits:
//
//   Circuit 1 (primary):   voltage source E_in -> Coil_1_M -> Coil_1_P
//   Circuit 2 (secondary): Coil_2_M -> Coil_2_P -> load impedance Z_out
//
// The magnetic coupling between the two circuits occurs through the shared
// magnetic flux in the core -- there is no explicit electrical connection
// between them, i.e., they are galvanically isolated. The load connected at the
// terminals of the secondary can be a resistance, an inductance, or a
// capacitance, selected at runtime through a "DefineConstant" parameter.
//
// We define an effective complex reluctivity "nu = nu_r + i * nu_i = nu_r + i *
// (nu_H + nu_EC)" to model the hysteresis and eddy current losses in the
// laminated ferromagnetic core. The imaginary part of the reluctivity
// introduces a dissipative contribution "(1/2) * omega * (nu_H + nu_EC) *
// |B_peak|^2" per unit volume.
//
//  - Hysteresis losses: Each magnetisation cycle dissipates approximately
//
//      p_H = kh * |B_peak|^2,
//
//    with an empirical coefficient kh, so the time-averaged hysteresis power
//    density is "p_H * f". Matching this with the complex-reluctivity
//    dissipation "(1/2) * omega * nu_H * |B_peak|^2" gives
//
//      nu_H = kh / Pi.
//
//    This equivalent reluctivity is frequency-independent and hysteresis losses
//    p_H are proportional to the frequency "f" (through "omega").
//
//  - Eddy current losses: in a lamination of thickness "d" and bulk
//    conductivity "sigma_iron", eddy-current losses are approximately given by
//    (see e.g. J. Gyselinck et al., "Calculation of eddy currents and
//    associated losses in electrical steel laminations", IEEE Transactions on
//    Magnetics, 35(3), 1191-1194, 1999):
//
//      p_EC = (1/2) * sigma_iron * (d * omega * |B_peak|)^2 / 12.
//
//    Matching with "(1/2) * omega * nu_EC * |B_peak|^2" gives
//
//      nu_EC = sigma_iron * omega * d^2 / 12.
//
//    This equivalent reluctivity is proportional to the frequency, and
//    eddy-current losses "p_EC" thus scale as "f^2".

Include "transfo_common.pro";

Group {
  // Physical regions:
  Air = Region[ 1 ];
  AirInf = Region[ 2 ];
  Coil_1_M = Region[ 3 ];
  Coil_1_P = Region[ 4 ];
  Coil_2_M = Region[ 5 ];
  Coil_2_P = Region[ 6 ];
  Coil_1 = Region[ {Coil_1_M, Coil_1_P} ];
  Coil_2 = Region[ {Coil_2_M, Coil_2_P} ];
  Coils = Region[ {Coil_1, Coil_2} ];
  Core = Region[ 7 ];
  Bnd = Region[ 10 ]; // exterior boundary

  // Abstract regions expected by the template library. The role of each group
  // is documented in "Lib_Magnetoquasistatics_av_2D_Cir.pro":
  //  - "Vol_Mag": full magnetic domain
  //  - "Vol_S_Mag": stranded conductors (windings with Ns turns)
  //  - "Vol_Inf_Mag": region with infinite shell transformation
  Vol_Mag = Region[ {Air, AirInf, Core, Coils} ];
  Vol_S_Mag = Region[ Coils ];
  Vol_Inf_Mag = Region[ AirInf ];

  // Circuit regions (fictitious, as in tutorial 8): the voltage source on the
  // primary side and the load impedance on the secondary side:
  E_in = Region[ 100 ];
  Z_out = Region[ 102 ];

  // Abstract circuit regions expected by the library:
  //  - "Source_Cir": all voltage and current sources
  //  - "Resistance_Cir": all resistors
  //  - "Inductance_Cir": all inductors
  //  - "Capacitance_Cir": all capacitors
  Source_Cir = Region[ {E_in} ];
  DefineConstant[
    LoadType = {0, Choices {0="Resistance", 1="Inductance", 2="Capacitance"},
      Name "Parameters/2Load type"}
  ];
  // "LoadType" determines which abstract circuit group "Z_out" belongs to.
  // Each group has a different constitutive relation in the library formulation
  // (see tutorial 8 for the lumped element GlobalTerms):
  If(LoadType == 0)
    Resistance_Cir = Region[ {Z_out} ];
  ElseIf(LoadType == 1)
    Inductance_Cir = Region[ {Z_out} ];
  Else
    Capacitance_Cir = Region[ {Z_out} ];
  EndIf
}

Function {
  DefineConstant[
    Voltage = {1, Min 1e-3, Max 10,
      Name "Parameters/0Primary voltage [V]"}
    f = {50, Min 0, Max 1e3, Step 1,
      Name "Parameters/1Frequency [Hz]"}
    Rval = {50, Min 1e-3, Max 50, Step 0.25, Visible (LoadType == 0),
      Name "Parameters/3Load resistance [Ohm]"}
    Lval = {1e-6, Min 1e-9, Max 0.1, Step 1e-3, Visible (LoadType == 1),
      Name "Parameters/3Load inductance [H]"}
    Cval = {1e-6, Min 1e-9, Max 0.1, Step 1e-4, Visible (LoadType == 2),
      Name "Parameters/3Load capacitance [F]"}
    // Typical values for grain-oriented Si-steel (M3, 0.35 mm laminations):
    murCore = {2000, Min 1, Max 10000, Step 1,
      Name "Parameters/4Core relative permeability"}
    dlam = {0.35e-3, Min 0.1e-3, Max 1e-3, Step 0.05e-3,
      Name "Parameters/5Lamination thickness [m]"}
    kh = {100, Min 10, Max 500, Step 10,
      Name "Parameters/6Hysteresis coeff [W m^-3 T^-2 s]"}
  ];

  mu0 = 4e-7 * Pi;
  nu[ Air ] = 1 / mu0;
  nu[ AirInf ] = 1 / mu0;

  // Homogenized effective reluctivity to take into account losses in the
  // laminated ferromagnetic core:
  nu_r = 1 / (murCore * mu0);
  sigma_iron = 2e6;
  nu_i = kh / Pi + sigma_iron * (2 * Pi * f) * dlam^2 / 12;
  nu[ Core ] = Complex[nu_r, nu_i];

  // Stranded coil parameters expected by the library:
  //  - "Ns[]": number of turns in each winding
  //  - "Sc[]": cross-sectional area of each coil side. "SurfaceArea[]" is a
  //    built-in GetDP function that returns the area of the region on which it
  //    is evaluated
  Ns[ Coil_1 ] = 100;
  Ns[ Coil_2 ] = 200;
  Sc[ Coil_1_M ] = SurfaceArea[];
  Sc[ Coil_1_P ] = SurfaceArea[];
  Sc[ Coil_2_M ] = SurfaceArea[];
  Sc[ Coil_2_P ] = SurfaceArea[];
  nu[ Coils ] = 1 / mu0;
  // The conductivity of the stranded coils enters the Joule losses calculation
  // in the library (via the DC resistance term "Ns^2 / (sigma * Sc^2)"):
  sigma[ Coils ] = 5.8e7;

  // Geometrical coefficient in all the regions with global voltages and
  // currents, to specify the out-of-plane thickness and control the current
  // direction (as in tutorials 7 and 8):
  CoefGeo[ Coil_1_M ] = -1 * thickCore;
  CoefGeo[ Coil_1_P ] = 1 * thickCore;
  CoefGeo[ Coil_2_M ] = -1 * thickCore;
  CoefGeo[ Coil_2_P ] = 1 * thickCore;
  CoefGeo[ Core ] = thickCore;

  // Lumped circuit element parameters (as in tutorial 8):
  Resistance[ Z_out ] = Rval;
  Inductance[ Z_out ] = Lval;
  Capacitance[ Z_out ] = Cval;
}

Constraint {
  // Homogeneous Dirichlet condition on the vector potential at infinity:
  { Name a_Mag_2D;
    Case {
      { Region Bnd; Value 0; }
    }
  }

  // No imposed current or voltage on the FE coils (determined by the circuit):
  { Name Current_Mag_2D;
    Case {
    }
  }
  { Name Voltage_Mag_2D;
    Case {
    }
  }

  // No imposed current on circuit elements (the inductor initial condition is
  // only needed in the time domain, which is not used here):
  { Name Current_Cir ;
    Case {
    }
  }

  // Imposed voltage on the primary voltage source (as in tutorial 8):
  { Name Voltage_Cir ;
    Case {
      { Region E_in; Value Voltage; TimeFunction F_Cos_wt_p[]{2 * Pi * f, 0}; }
    }
  }

  // The circuit topology uses two independent circuits. "Circuit_1" and
  // "Circuit_2" define separate connected networks, each with its own set of
  // circuit nodes (the node numbers are local to each case). This allows
  // modelling magnetically coupled but electrically isolated windings -- the
  // coupling between the two circuits happens through the shared magnetic flux
  // in the finite element model, not through any electrical connection.
  { Name ElectricalCircuit ; Type Network ;
    Case Circuit_1 {
      // Primary circuit: voltage source driving the primary winding. The two
      // coil sides are connected in series (nodes 1 -> 2 -> 3 -> back to 1):
      { Region E_in; Branch {1, 2}; }
      { Region Coil_1_M; Branch {2, 3} ; }
      { Region Coil_1_P; Branch {3, 1} ; }
    }
    Case Circuit_2 {
      // Secondary circuit: the secondary winding drives the load. Note that the
      // secondary has no external source -- the voltage is induced by the
      // time-varying flux from the primary:
      { Region Coil_2_M; Branch {1, 2} ; }
      { Region Coil_2_P; Branch {2, 3} ; }
      { Region Z_out; Branch {3, 1}; }
    }
  }
}

// Configuration of the template library. The following variables are read by
// "Lib_Magnetoquasistatics_av_2D_Cir.pro" to select the analysis type and
// enable the appropriate features (the full list of configuration variables is
// documented at the beginning of the library file):
CircuitCoupling = 1;
AnalysisType = 2; // frequency-domain
CoefPower = 0.5; // peak-valued phasors
Freq = f;
Include "Lib_Magnetoquasistatics_av_2D_Cir.pro";

// The library is made generic through three GetDP declaration commands:
//  - "DefineConstant[]": defines a constant only if it has not already been
//    defined. The library uses it to set default values for all its
//    configuration variables (AnalysisType, Axisymmetric, Freq, etc.). If the
//    user sets a variable before the "Include", it takes precedence; otherwise
//    the library's default applies.
//  - "DefineGroup[]": similarly, declares a group only if it does not already
//    exist. The library declares all the abstract groups it knows about
//    (Vol_Mag, Vol_C_Mag, Vol_S_Mag, Vol_NL_Mag, Vol_M_Mag, etc.) with empty
//    defaults. The user populates only the groups relevant to the problem at
//    hand; unused groups remain empty and the corresponding terms in the
//    formulation are silently skipped (since an integral over an empty region
//    contributes nothing).
//  - "DefineFunction[]": declares a function only if it does not already exist.
//    The library declares all the material functions it may use (nu[], sigma[],
//    br[], js0[], etc.); the user defines only those needed for the problem.
//
// This "define-if-absent" mechanism allows a single library file to handle
// magnetostatics, eddy currents, permanent magnets, stranded coils, circuit
// coupling, nonlinear materials and impedance boundary conditions -- all
// controlled by which groups and functions the user chooses to populate before
// the "Include".

// The PostOperation is specific to this model: the library provides the
// PostProcessing (with quantities like "az", "b", "j", "U", "I", "NormU",
// "NormI", etc.), but the user decides what to print and where.
PostOperation {
  { Name Map; NameOfPostProcessing Mag;
    Operation {
      Print[ j, OnElementsOf Vol_Mag, Format Gmsh, File "j.pos" ];
      Print[ b, OnElementsOf Vol_Mag, Format Gmsh, File "b.pos" ];
      Print[ NormB, OnElementsOf Vol_Mag, Format Gmsh, File "normb.pos" ];
      Print[ az, OnElementsOf Vol_Mag, Format Gmsh, File "az.pos" ];
      Print[ h, OnElementsOf Core, Format Gmsh, File "h.pos" ];

      Echo[ "E_in", Format Table, File "UI.txt" ];
      Print[ U, OnRegion E_in, Format FrequencyTable, File > "UI.txt"];
      Print[ I, OnRegion E_in, Format FrequencyTable, File > "UI.txt"];
      Echo[ "Z_out", Format Table, File > "UI.txt" ];
      Print[ U, OnRegion Z_out, Format FrequencyTable, File > "UI.txt"];
      Print[ I, OnRegion Z_out, Format FrequencyTable, File > "UI.txt"];

      // The "{0}" suffix after the parameter name selects only the first
      // component to be sent to Gmsh (instead of both the real and imaginary
      // part, as all values are complex):
      Print[ NormU, OnRegion E_in, Format Table, File "",
        SendToServer "}Output/0|V_in| [V]"{0} ];
      Print[ NormI, OnRegion E_in, Format Table, File "",
        SendToServer "}Output/1|I_in| [A]"{0} ];
      Print[ NormU, OnRegion Z_out, Format Table, File "",
        SendToServer "}Output/2|V_out| [V]"{0} ];
      Print[ NormI, OnRegion Z_out, Format Table, File "",
        SendToServer "}Output/3|I_out| [A]"{0} ];

      // To interactively plot the exterior characteristic |V_out|(|I_out|) with
      // Gmsh, click the "Loop" arrow button next to the load value in the
      // "Parameters" menu (this sweeps the load over its allowed range), then
      // press "Run". Click the "Draw" graph button next to |I_out| and select
      // e.g. "Top left -> X", then click the "Draw" graph button next to
      // |V_out| and select "Top left -> Y" -- you can do this while the sweep
      // is still running to watch the curve build up live. The two quantities
      // are then plotted against each other in a graph anchored to the top-left
      // corner of the Gmsh window, with |I_out| on the X axis and |V_out| on
      // the Y axis.

      Print[ JouleLosses[Vol_Mag], OnGlobal, Format Table,
        File "losses.txt", SendToServer "}Output/p_Joule [W m^-3]"{0} ];
      Print[ HarmonicMagneticLosses[Vol_Mag], OnGlobal, Format Table,
        File > "losses.txt", SendToServer "}Output/p_H+EC [W m^-3]"{0} ];
    }
  }
}
