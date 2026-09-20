// This tutorial computes the temperature profile in a radiator with fins.
// Starting at an initial temperature "T = T0", a heat flux "qn = qn0" is
// imposed through the bottom surface of the radiator base plate. Convection on
// the fins evacuates the heat based on Newton's law of cooling "qn = h (T -
// T0)", with "h" the convection coefficient.
//
// The governing partial differential equation links the temperature "T" and the
// heat flux density vector "q" through
//
//   rho * cp * \partial_t T + div(q) = 0,
//
// where "rho" is the mass density and "cp" the specific heat. Introducing
// Fourier's law "q = -k grad T", with "k" the thermal conductivity, we get the
// heat diffusion equation in terms of the temperature:
//
//   rho * cp * \partial_t T - div(k grad T) = 0.
//
// We will see below that the heat flux will be imposed naturally through a
// non-homogeneous Neumann boundary condition, while the convection condition
// will be imposed through a Robin boundary condition.

Group {
  // Physical regions:
  Radiator = Region[ 1 ];
  Bottom = Region[ 10 ];
  Left = Region[ 11 ];
  Right = Region[ 12 ];
  Top = Region[ 13 ];

  // The abstract regions in this model have the following interpretation:
  //  - "Vol_The": overall domain
  //  - "Sur_Neu_The": part of the boundary with non-homogeneous Neumann
  //    condition
  //  - "Sur_Rob_The": part of the boundary with Robin condition
  Vol_The = Region[ {Radiator} ];
  Sur_Neu_The = Region[ {Bottom} ];
  Sur_Rob_The = Region[ {Top} ];
}

Function {
  // "DefineConstant[]" declares parameters that can be modified interactively
  // in the Gmsh GUI, or overridden on the command line with "-setnumber name
  // value":
  DefineConstant[
    AnalysisType = {0, Choices{0="Steady-state", 1="Transient"},
      Name "Parameters/Analysis"}
    qn0 = {3e4, Min 1, Max 1e6, Step 1e3,
      Name "Parameters/Heat flux [W m^-2]"}
    h = {60, Min 0, Max 120, Step 1,
      Name "Parameters/Convection coefficient [W m^-2 K^-1]"}
    tmax = {360, Min 1, Max 3600, Step 10,
      Name "Parameters/Simulation time [s]", Visible AnalysisType}
    dt = {5, Min 0.1, Max 100, Step 0.1,
      Name "Parameters/Time step [s]", Visible AnalysisType}
  ];

  rho_cp[] = 2700 * 900;
  k[] = 170;
  qn0[] = -qn0; // negative sign to have flux coming into "Vol_The"
  h[] = h;
  T0[] = 20;
}

// The weak formulation reads: find "T" such that
//
//   (rho * cp * \partial_t T, T')_Vol_The - (div(k grad T), T')_Vol_The = 0
//
// holds for all test functions "T'". After integration by parts it reads: find
// "T" such that
//
//   (rho * cp * \partial_t T, T')_Vol_The + (k grad T, grad T')_Vol_The
//     - (k grad T . n, T')_Bnd_Vol_The = 0
//
// holds for all test functions "T'". The boundary term is split to handle the
// imposed flux ("-k grad T . n = qn0") as a non-homogeneous Neumann boundary
// condition on "Sur_Neu_The", and the convection condition ("-k grad T . n = h
// (T - T0)") as a Robin condition on "Sur_Rob_The". The final weak formulation
// then reads: find "T" such that
//
//   (rho * cp * \partial_t T, T')_Vol_The + (k grad T, grad T')_Vol_The
//     + (qn0, T')_Sur_Neu_The + (h (T - T0), T')_Sur_Rob_The = 0
//
// holds for all test functions "T'".
//
// In the steady-state, the first term vanishes. Note that this problem is still
// well-posed, even without Dirichlet boundary conditions, thanks to the Robin
// condition (with "h > 0"). Indeed, the bilinear form is coercive: "a(T, T) =
// \int_Vol_The k |grad T|^2 + \int_Sur_Rob_The h T^2 >= C ||T||^2_H1".

Jacobian {
  { Name Vol;
    Case {
      { Region All; Jacobian Vol; }
    }
  }
  { Name Sur;
    Case {
      { Region All; Jacobian Sur; }
    }
  }
}

Integration {
  { Name Int;
    Case {
      { Type Gauss;
        Case {
          // We need to integrate on lines and triangles for the 2D model, and
          // on triangles and tetrahedra for the 3D model. We need sufficiently
          // many quadrature points to integrate quadratic functions (inner
          // product "(T , T')" of piecewise linear functions):
          { GeoElement Line; NumberOfPoints 2; }
          { GeoElement Triangle; NumberOfPoints 3; }
          { GeoElement Tetrahedron; NumberOfPoints 4; }
        }
      }
    }
  }
}

// Include definitions needed for the Link constraint below:
Include "radiator_common.pro";

Constraint {
  { Name T_The;
    Case {
      // Initial condition for transient solution (different constraint types
      // can be specified for each region within the "Case" -- compare with the
      // global "Type Assign" used in tutorial 1):
      If(AnalysisType == 1)
        { Region Vol_The; Type Init; Value T0[]; }
      EndIf
      // For a symmetric geometry (with position = 0.5 in "radiator.geo") a
      // homogeneous Neumann boundary condition on the Left and Right boundaries
      // is sufficient to ensure periodicity. Otherwise an explicit periodicity
      // condition is required. This can be achieved in GetDP with a "Link"
      // constraint, which links degrees of freedom from two regions ("Region"
      // and "RegionRef", geometrically mapped onto each other with "Function"),
      // with a coefficient. This requires the mesh to match on both regions.
      { Region Right; Type Link; RegionRef Left; Coefficient 1;
        // The function maps Region onto RegionRef, using the built-in "X[]",
        // "Y[]", "Z[]" coordinate functions to define the translation vector:
        Function Vector[X[] - N * bw, Y[], Z[]]; }
    }
  }
}

Group{
  Dom_H1_T_The =  Region[ {Vol_The, Sur_Neu_The, Sur_Rob_The} ];
}

FunctionSpace {
  { Name H1_T_The; Type Form0;
    BasisFunction {
      { Name sn; NameOfCoef Tn; Function BF_Node; Support Dom_H1_T_The;
        Entity NodesOf[All]; }
    }
    Constraint {
      { NameOfCoef Tn; EntityType NodesOf; NameOfConstraint T_The; }
    }
  }
}

Formulation {
  { Name Thermal_T; Type FemEquation;
    Quantity {
      { Name T; Type Local; NameOfSpace H1_T_The; }
    }
    Equation {
      // A "DtDof" term enables GetDP to handle time discretization
      // automatically (depending on the operation) in a "Resolution":
      Integral { DtDof [ rho_cp[] * Dof{T} , {T} ];
        In Vol_The; Jacobian Vol; Integration Int; }

      Integral { [ k[] * Dof{d T} , {d T} ];
        In Vol_The; Jacobian Vol; Integration Int; }

      Integral { [ qn0[] , {T} ];
        In Sur_Neu_The; Jacobian Sur; Integration Int; }

      // In GetDP equation terms with "Dof" must be linear with respect to the
      // value of the degree of freedom, so a "Dof" term with an affine part
      // such as "[ h[] * (Dof{T} - T0[]), {T} ]" is invalid and must be split
      // into two separate terms:
      Integral { [ h[] * Dof{T} , {T} ];
        In Sur_Rob_The; Jacobian Sur; Integration Int; }
      Integral { [ -h[] * T0[] , {T} ];
        In Sur_Rob_The; Jacobian Sur; Integration Int; }
    }
  }
}

Resolution {
  { Name The;
    System {
      { Name Sys_The; NameOfFormulation Thermal_T; }
    }
    Operation {
      If(AnalysisType == 1) // Transient
        // Initialize the solution:
        InitSolution[Sys_The];
        // Perform a time loop with an implicit Euler scheme, from time == 0 to
        // time == "tmax", with fixed time step "dt":
        TimeLoopTheta[0, tmax, dt, 1] {
          Generate[Sys_The]; Solve[Sys_The]; SaveSolution[Sys_The];
        }
        // More advanced time discretizations are available as built-in
        // resolution operations (see e.g. "TimeLoopAdaptive"). They could also be
        // implemented manually by replacing the "DtDof" term in the formulation
        // with the chosen approximation, e.g.
        //
        //   Integral { [ rho_cp[] * Dof{T} / dt, {T} ];
        //     In Vol_The; Integration Int; Jacobian Vol;  }
        //   Integral { [ - rho_cp[] * {T}[1] / dt, {T} ];
        //     In Vol_The; Integration Int; Jacobian Vol;  }
        //
        // for implicit Euler ("{T}[1]" denotes the value of "{T}" at the
        // previous step). A custom time integration loop can then be
        // constructed in the resolution with the "While[]" operation.
      Else // Steady-state
        // The "DtDof" term is automatically disregarded by GetDP if there is no
        // time loop, so we can generate and solve the steady-state system
        // directly:
        Generate[Sys_The]; Solve[Sys_The]; SaveSolution[Sys_The];
      EndIf
    }
  }
}

PostProcessing {
  { Name The; NameOfFormulation Thermal_T;
    Quantity {
      { Name T; Value{ Local{ [ {T} ]; In Vol_The; Jacobian Vol;} } }
      { Name q; Value{ Local{ [ -k[] * {d T} ]; In Vol_The; Jacobian Vol; } } }
    }
  }
}

PostOperation {
  { Name Map; NameOfPostProcessing The;
    Operation {
      Print[ T, OnElementsOf Vol_The, File "T.pos"];
      Print[ q, OnElementsOf Vol_The, File "q.pos"];
    }
  }
}
