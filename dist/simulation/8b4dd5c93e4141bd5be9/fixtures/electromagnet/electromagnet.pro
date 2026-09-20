// This tutorial computes the static magnetic field produced by a DC current in
// an electromagnet. This corresponds to a magnetostatic physical model,
// obtained by combining the time-invariant Maxwell-Ampere equation ("curl h = js",
// with "h" the magnetic field and "js" the source current density) with the
// magnetic Gauss law ("div b = 0", with "b" the magnetic flux density) and the
// magnetic constitutive law ("b = mu h", with "mu" the magnetic permeability).
//
// Since "div b = 0", "b" can be derived from a vector magnetic potential "a",
// such that "b = curl a". Plugging this vector potential in Maxwell-Ampere's
// law and using the constitutive law leads to a generalized vector Poisson
// equation in terms of the magnetic vector potential: "curl(nu curl a) = js",
// where "nu = 1/mu" is the magnetic reluctivity.
//
// In the general (3D) case the vector potential is not unique, since for all
// scalar functions "f", "b = curl a = curl (a + grad f)". We will introduce
// explicit gauge conditions in tutorial 8 and 10 to ensure uniqueness. In the
// 2D setting however, with a source current density along the z-axis, the
// magnetic vector potential "a" is a vector field with a single non-zero
// component along the z-axis, i.e.:
//
//   a = (0, 0, az(x, y))
//
// which automatically removes gradient fields from the admissible space (the
// kernel reduces to constants, which a Dirichlet boundary condition is
// sufficient to fix).
//
// Magnetostatic fields expand to infinity. The corresponding boundary condition
// can be imposed rigorously by means of a geometrical transformation that maps
// a ring (a "shell") of finite elements to the complementary of its interior.
// As this is a mere geometric transformation, it is enough in the model
// description to attribute the special Jacobian "VolSphShell" to the ring
// region "AirInf". This Jacobian takes as arguments the inner ("rInt") and
// outer ("rExt") radii of the transformed ring region: to ensure consistency
// they are defined in a separate file, which is included in both the .geo and
// .pro file.  For a derivation and discussion of this transformation technique,
// see e.g. F. Henrotte et al., "Finite element modelling with transformation
// techniques", IEEE Transactions on Magnetics, 35(3), 1434-1437, 1999.

Include "electromagnet_common.pro";

// The model exhibits two symmetries (with respect to the X-axis and the
// Y-axis); the "SymmetryType" constant defined in "electromagnet_common.pro"
// selects whether to take advantage of one, both or none of them.

Group {
  // Physical regions:
  Core = Region[ 1 ];
  Air = Region[ 2 ];
  AirInf = Region[ 3 ];
  CoilRight = Region[ 4 ];
  // Left coil only if no symmetry, or if single symmetry with respect to X-axis:
  CoilLeft = Region[ {} ];
  If(SymmetryType == 0 || SymmetryType == 1)
    CoilLeft += Region[ 5 ];
  EndIf
  Coils = Region[ {CoilLeft, CoilRight} ];
  // Bottom boundary only if symmetry with respect to X-axis:
  Bottom = Region[ {} ];
  If(SymmetryType == 1 || SymmetryType == 3)
    Bottom += Region[ 10 ];
  EndIf
  // Left boundary only if symmetry with respect to Y-axis:
  Left = Region[ {} ];
  If(SymmetryType == 2 || SymmetryType == 3)
    Left += Region[ 11 ];
  EndIf
  Inf = Region[ 12 ];

  // The abstract regions in this model have the following interpretation:
  //  - "Vol_Mag": overall domain
  //  - "Vol_S_Mag": region with imposed current source js
  //  - "Vol_NL_Mag": region with nonlinear magnetic constitutive law
  //  - "Vol_L_Mag": region with linear magnetic constitutive law
  //  - "Vol_Inf_Mag": region with infinite shell geometric transformation
  //  - "Sur_Neu_Mag": part of the boundary with non-homogeneous Neumann
  //    conditions
  Vol_Mag = Region[ {Air, AirInf, Core, Coils} ];
  Vol_S_Mag = Region[ Coils ];
  Vol_Inf_Mag = Region[ AirInf ];
  Sur_Neu_Mag = Region[ {} ]; // empty

  DefineConstant[
    NonlinearCore = {0, Choices {0, 1},
      Help "Is the magnetic law in the core nonlinear?",
      Name "Parameters/Nonlinear core"}
  ];

  If(NonlinearCore)
    Vol_NL_Mag = Region[ Core ];
  Else
    Vol_NL_Mag = Region[ {} ];
  EndIf
  // "-" to subtract "Vol_NL_Mag" from "Vol_Mag". "Vol_L_Mag" is therefore the
  // linear part of the magnetic domain: in the linear case it coincides with
  // the full domain, and in the nonlinear case it is everything except the
  // (nonlinear) core:
  Vol_L_Mag = Region[ {Vol_Mag, -Vol_NL_Mag} ];
}

// The weak formulation is derived in a similar way as for the electrostatic or
// thermal problems from previous tutorials. The main differences are that the
// unknown field is vector-valued, and that we want to handle the nonlinear case
// when nu is not constant. The weak formulation reads: find "a" such that
//
//   (curl(nu curl a), a')_Vol_Mag = (js, a')_Vol_S_Mag
//
// holds for all test functions "a'". After integration by parts it reads: find
// "a" such that
//
//   (nu curl a, curl a')_Vol_Mag + (n x (nu curl a), a')_Bnd_Vol_Mag =
//      (js, a')_Vol_S_Mag
//
// holds for all test functions "a'". In the electromagnet model the second
// (boundary) term vanishes:
//
//  - On the "Left" and "Inf" parts of the boundary, the normal component of "b"
//    must vanish by symmetry and decay, respectively. Imposing "a = 0" there
//    (homogeneous Dirichlet) enforces "b . n = 0" (since the tangential "a" is
//    zero, the flux of "b" through any surface patch on the boundary is zero by
//    Stokes' theorem). The boundary term vanishes because the test functions
//    "a'" are zero there -- GetDP automatically removes the corresponding test
//    functions when an "Assign" constraint is prescribed. For the "Left" part
//    of the 2D planar model, the "a = 0" condition can also be understood
//    directly: by symmetry with respect to the Y-axis the magnetic vector
//    potential has opposite signs on either side (the current density that
//    sources it is antisymmetric); continuity then forces "az = 0" on the axis
//    itself.
//
//  - On the "Bottom" boundary, the tangential component of "h" is zero by
//    symmetry, i.e. "n x h = n x (nu curl a) = 0". This is a homogeneous
//    Neumann condition: it is satisfied naturally (the boundary integrand is
//    zero).
//
// Note that depending on the value of "SymmetryType", the "Left" and/or
// "Bottom" region might be empty.
//
// We are thus eventually looking for functions a such that
//
//   (nu curl a, curl a')_Vol_Mag = (js, a')_Vol_S_Mag
//
// holds for all test functions "a'".
//
// If the magnetic constitutive law is nonlinear, i.e. if "nu" is not a constant
// but a function of "b = curl a", we need to linearize the formulation before
// we can solve it in GetDP. Several linearization methods are possible:
//
// 1) Newton-Raphson method - at iteration "k" we approximate
//
//   h(b_k) \approx h(b_k-1) + (dh/db)_k-1 (b_k - b_k-1)
//
// i.e.
//
//   (nu(curl a_k) curl a_k, curl a')
//     \approx (nu(curl a_k-1) curl a_k-1, curl a')
//           + (dh/db(curl a_k-1) curl a_k, curl a')
//           - (dh/db(curl a_k-1) curl a_k-1, curl a')
//
// 2) Picard method - at iteration "k" we approximate
//
//   (nu(curl a_k) curl a_k, curl a')
//     \approx (nu(curl a_k-1) curl a_k, curl a')

Function {
  DefineConstant[
    NewtonRaphson = {1, Choices {0="Picard", 1="Newton-Raphson"},
      Visible NonlinearCore,
      Name "Parameters/Linearization method"}
    Current = {1, Min 0.01, Max 100, Step 0.1,
      Name "Parameters/Current [A]"}
  ];

  mu0 = 4.e-7 * Pi;
  nu0 = 1 / mu0;
  nu [ Air ] = nu0;
  nu [ AirInf ] = nu0;
  nu [ Coils ] = nu0;

  If(!NonlinearCore)
    // Linear magnetic law in the core
    mur = 1000;
    nu [ Core ]  = 1 / (mur * mu0);
  Else
    // Nonlinear magnetic law in the core, defined by interpolating b-h curve
    // samples, provided in the following "data_h()" and "data_b()" lists:
    data_h() = {
      0.0000e+00, 5.5023e+00, 1.1018e+01, 1.6562e+01, 2.2149e+01, 2.7798e+01,
      3.3528e+01, 3.9363e+01, 4.5335e+01, 5.1479e+01, 5.7842e+01, 6.4481e+01,
      7.1470e+01, 7.8906e+01, 8.6910e+01, 9.5644e+01, 1.0532e+02, 1.1620e+02,
      1.2868e+02, 1.4322e+02, 1.6050e+02, 1.8139e+02, 2.0711e+02, 2.3932e+02,
      2.8028e+02, 3.3314e+02, 4.0231e+02, 4.9395e+02, 6.1678e+02, 7.8320e+02,
      1.0110e+03, 1.3257e+03, 1.7645e+03, 2.3819e+03, 3.2578e+03, 4.5110e+03,
      6.3187e+03, 8.9478e+03, 1.2802e+04, 1.8500e+04, 2.6989e+04, 3.9739e+04,
      5.9047e+04, 8.8520e+04, 1.3388e+05, 2.0425e+05, 3.1434e+05, 4.8796e+05,
      7.6403e+05
    };
    data_b() = {
      0.0000e+00, 5.0000e-02, 1.0000e-01, 1.5000e-01, 2.0000e-01, 2.5000e-01,
      3.0000e-01, 3.5000e-01, 4.0000e-01, 4.5000e-01, 5.0000e-01, 5.5000e-01,
      6.0000e-01, 6.5000e-01, 7.0000e-01, 7.5000e-01, 8.0000e-01, 8.5000e-01,
      9.0000e-01, 9.5000e-01, 1.0000e+00, 1.0500e+00, 1.1000e+00, 1.1500e+00,
      1.2000e+00, 1.2500e+00, 1.3000e+00, 1.3500e+00, 1.4000e+00, 1.4500e+00,
      1.5000e+00, 1.5500e+00, 1.6000e+00, 1.6500e+00, 1.7000e+00, 1.7500e+00,
      1.8000e+00, 1.8500e+00, 1.9000e+00, 1.9500e+00, 2.0000e+00, 2.0500e+00,
      2.1000e+00, 2.1500e+00, 2.2000e+00, 2.2500e+00, 2.3000e+00, 2.3500e+00,
      2.4000e+00
    };

    // We first compute a list of reluctivity values for each b-h sample (and
    // fix the first value, when "h = b = 0"):
    data_nu = data_h() / data_b();
    data_nu(0) = data_nu(1);

    // We then create a function "nu(|b|^2)" by spline interpolation. Note
    // that we interpolate against "|b|^2" (the squared norm) rather than "|b|"
    // itself: this avoids computing a square root at each evaluation, and
    // makes the derivative "d(nu)/d(|b|^2)" (needed for Newton-Raphson below)
    // directly available:
    data_b2_nu = ListAlt[data_b()^2, data_nu()];
    nu[ Core ] = InterpolationAkima[ SquNorm[$1] ]{ data_b2_nu() };

    // "nu[]" is a piecewise-defined function: its left-hand side above is
    // "nu[ Core ]", meaning that for elements in "Core" the formula on the
    // right is used. When called inside the Formulation as "nu[{d a}]", the
    // argument "{d a}" (= curl a = b) is substituted for "$1" in the formula.
    // With no argument -- "nu[]" as it appears in the linear branch and in
    // the Formulation in the linear regions Vol_L_Mag -- the formula is
    // simply evaluated as written (here, a constant).

    // The function "nu[]" is expected to take b (a vector value) as its first
    // (and only) argument, "$1". As we will also see below in the Resolution,
    // the $ sign identifies runtime quantities (function arguments, global
    // variables, user runtime variables), whose values are not yet known when
    // GetDP parses the ".pro" file. Here "nu[]" computes the square of the norm
    // of its first argument ("SquNorm[$1]") and passes it as argument to the
    // built-in "InterpolationAkima[]" function. In addition to its single
    // argument, "InterpolationAkima[]" takes a list of values as parameters -
    // provided after the arguments between braces - here the list of values to
    // interpolate.

    // The derivative of "nu" with respect to "|b|^2" is directly available
    // through the built-in "dInterpolationAkima[]" function:
    dnudb2[ Core ] = dInterpolationAkima[ SquNorm[$1] ]{ data_b2_nu() };

    // The components of the Jacobian "dh/db", for "h = nu b", are
    //
    //   (dh/db)_ij = dh_i/db_j = nu delta_ij + dnu/db_j b_i
    //
    // which, in matrix form, reads (with "I" the identity tensor -- i.e. the
    // 3x3 identity matrix in Cartesian components):
    //
    //   dh/db = I nu + b (grad nu)^T
    //
    // With "nu = nu(|b|^2)", we have "grad nu = 2 nu'(|b|^2) b", and thus
    //
    //   dh/db = I nu + 2 nu'(|b|^2) b b^T
    //
    dhdb[ Core ] = TensorDiag[1, 1, 1] * nu[$1#1] + 2 * dnudb2[#1] *
      SquDyadicProduct[#1];

    // A small optimization has been applied in the above function definition to
    // avoid multiple evaluations of argument "$1" at runtime: "$1#1" stores the
    // value of the argument in a register ("#1"), which is then reused twice.

    // We also define absolute and relative tolerances on the residual, as well
    // as the maximum number of iterations, to control the iterative loop:
    NLTolAbs = 1e-10;
    NLTolRel = 1e-6;
    NLIterMax = 20;
  EndIf

  // Number of turns in the coil:
  NbTurns = 1000;

  // Current density in the inductor, along the z-axis:
  js[ CoilRight ] = Vector[0, 0, -NbTurns * Current / (dxCoil * dyCoil)];
  js[ CoilLeft ] = Vector[0, 0, NbTurns * Current / (dxCoil * dyCoil)];
}

Constraint {
  // Homogenous Dirichlet condition on the "Left" and "Inf" parts of the
  // boundary. When constraint type is given, "Type Assign" is assumed by
  // default:
  { Name a_Mag_2D;
    Case {
      { Region Left; Value 0.; }
      { Region Inf; Value 0.; }
    }
  }
}

// The magnetic vector potential has a single non-zero component along the
// z-axis: "a = (0, 0, az(x, y))". This is reflected in the "Type",
// "BasisFunction" and "Entity" specified in the "Hcurl_a_Mag_2D" FunctionSpace
// below: the vector potential is a "perpendicular 1-form" interpolated with
// "BF_PerpendicularEdge" basis functions associated to nodes of the mesh. With
// this information GetDP is able to correctly apply geometrical transformations
// and differentiate the vector potential in the Formulation and PostProcessing
// terms.

Group {
  Dom_Hcurl_a_Mag_2D = Region[ {Vol_Mag, Sur_Neu_Mag} ];
}

FunctionSpace {
  { Name Hcurl_a_Mag_2D; Type Form1P;
    BasisFunction {
      { Name se; NameOfCoef ae; Function BF_PerpendicularEdge;
        Support Dom_Hcurl_a_Mag_2D; Entity NodesOf[ All ]; }
    }
    Constraint {
      { NameOfCoef ae; EntityType NodesOf; NameOfConstraint a_Mag_2D; }
    }
  }
}

Jacobian {
  { Name Vol;
    Case {
      // Use the special infinite ring Jacobian in "Vol_Inf_Mag" (the "rInt"
      // and "rExt" radii come from "electromagnet_common.pro", included at
      // the top of the file)...
      { Region Vol_Inf_Mag; Jacobian VolSphShell {rInt, rExt}; }
      // ... and the standard "Vol" Jacobian everywhere else:
      { Region All; Jacobian Vol; }
    }
  }
}

Integration {
  { Name Int;
    Case {
      { Type Gauss;
        Case {
          { GeoElement Triangle; NumberOfPoints 1; }
        }
      }
    }
  }
}

Formulation {
  { Name Magnetostatics_a_2D; Type FemEquation;
    Quantity {
      { Name a; Type Local; NameOfSpace Hcurl_a_Mag_2D; }
    }
    Equation {
      // Since a is a "Form1P", the differential operator "d" means "curl":
      Integral { [ nu[] * Dof{d a} , {d a} ];
        In Vol_L_Mag; Jacobian Vol; Integration Int; }

      If(NonlinearCore && NewtonRaphson)
        // Newton-Raphson linearization:
        Integral { [ nu[{d a}] * {d a} , {d a} ];
          In Vol_NL_Mag; Jacobian Vol; Integration Int; }
        Integral { [ dhdb[{d a}] * Dof{d a} , {d a} ];
          In Vol_NL_Mag; Jacobian Vol; Integration Int; }
        Integral { [ - dhdb[{d a}] * {d a} , {d a} ];
          In Vol_NL_Mag; Jacobian Vol; Integration Int; }

        // [The following block can be skipped on a first reading.]
        //
        // Note that this implementation of the Newton-Raphson method can be
        // simplified (and accelerated) by directly defining the incremental
        // contribution to the system matrix through a "JacNL[]" term.
        //
        // With "nu = nu(|b|^2)", we have
        //
        //   h(b_k) \approx h(b_k-1) + (dh/db)_k-1 (b_k - b_k-1)
        //      = nu_k-1 b_k-1 + (I nu + 2 nu'(|b|^2) b b^T)_k-1 (b_k - b_k-1)
        //      = nu_k-1 b_k + 2 (nu'(|b|^2) b b^T)_k-1 (b_k - b_k-1)
        //
        // Defining the function
        //
        //   dhdb_NL[] = 2 * dnudb2[$1#1] * SquDyadicProduct[#1]
        //
        // we can then rewrite the Newton-Raphson linearization as follows:
        //
        //   Integral { [ nu[{d a}] * Dof{d a} , {d a} ]; // note the Dof{}!
        //     In Vol_NL_Mag; Jacobian Vol; Integration Int; }
        //   Integral { JacNL [ dhdb_NL[{d a}] * Dof{d a} , {d a} ];
        //     In Vol_NL_Mag; Jacobian Vol; Integration Int; }
        //
        // The system should then be assembled and solved with "GenerateJac[]"
        // and "SolveJac[]" (instead of "Generate[]" and "Solve[]"), which will
        // automatically handle the increment "b_k - b_k-1".

      ElseIf(NonlinearCore)
        // Picard linearization:
        Integral { [ nu[{d a}] * Dof{d a}, {d a} ];
          In Vol_NL_Mag; Jacobian Vol; Integration Int; }
      EndIf

      Integral { [ - js[] , {a} ];
        In Vol_S_Mag; Jacobian Vol; Integration Int; }
    }
  }
}

Resolution {
  { Name Mag;
    System {
      { Name Sys_Mag; NameOfFormulation Magnetostatics_a_2D; }
    }
    Operation {
      // Generate matrix "Mat_0" and right-hand-side "rhs_0" of the linear
      // system "Sys_Mag":
      Generate[Sys_Mag];

      // Solve "Mat_0 x_0 = rhs_0", i.e. compute "x_0 = Mat_0^-1 rhs_0":
      Solve[Sys_Mag];

      If(NonlinearCore)
        // Re-generate the system: "Generate[]" re-assembles a matrix "Mat_1"
        // and right-hand side "rhs_1", using the latest available solution to
        // evaluate the nonlinear coefficients (here "nu(|b_0|^2)" with "b_0 =
        // curl a_0"). The source "js" is unchanged since it is prescribed. The
        // resulting "Mat_1" thus reflects the new operating point of the
        // nonlinear law:
        Generate[Sys_Mag];

        // Compute residual "rhs_1 - Mat_1 x_0" and store its 2-norm in the user
        // runtime variable "$res0":
        GetResidual[Sys_Mag, $res0];

        // Initialize runtime variables to track the residual and the iteration
        // count, then print out the absolute and relative residual. User
        // runtime variables (prefixed by "$") must be declared and updated
        // through an "Evaluate[]" operation, rather than assigned directly like
        // ordinary ".pro" symbols (which are constants evaluated once at parse
        // time). "Evaluate[]" is the mechanism that lets the resolution create
        // or update such variables during the operation sequence:
        Evaluate[ $res = $res0, $iter = 0 ];
        Print[{$iter, $res, $res / $res0},
          Format "Residual %03g: abs %14.12e rel %14.12e"];

        // Iterate until convergence:
        While[$res > NLTolAbs && $res / $res0 > NLTolRel &&
              $res / $res0 <= 1 && $iter < NLIterMax]{
          // Solve "Mat_k x_k = rhs_k", generate "Mat_k+1" and "rhs_k+1", and
          // compute the residual "rhs_k+1 - Mat_k+1 x_k":
          Solve[Sys_Mag]; Generate[Sys_Mag]; GetResidual[Sys_Mag, $res];

          Evaluate[ $iter = $iter + 1 ];
          Print[{$iter, $res, $res / $res0},
            Format "Residual %03g: abs %14.12e rel %14.12e"];
        }
        // Note that this explicit implementation of the iterative loop can be
        // replaced by the built-in "IterativeLoop[]" or "IterativeLoopN[]"
        // resolution operations, which offer several refinements. The simplest
        // implementation would be (this requires using "JacNL[]" for
        // Newton-Raphson, as explained above):
        //
        //   IterativeLoop[NLIterMax, NLTolRel, 1] {
        //     GenerateJac[Sys_Mag]; SolveJac[Sys_Mag];
        //   }
      EndIf

      SaveSolution[Sys_Mag];
    }
  }
}

PostProcessing {
  { Name Mag; NameOfFormulation Magnetostatics_a_2D;
    Quantity {
      { Name a;
        Value {
          Term { [ {a} ]; In Vol_Mag; Jacobian Vol; }
        }
      }
      { Name az; // z-component of the vector potential
        Value {
          Term { [ CompZ[{a}] ]; In Vol_Mag; Jacobian Vol; }
        }
      }
      { Name b;
        Value {
          Term { [ {d a} ]; In Vol_Mag; Jacobian Vol; }
        }
      }
      { Name h;
        Value {
          Term { [ nu[] * {d a} ]; In Vol_Mag; Jacobian Vol; }
        }
      }
      { Name js;
        Value {
          Term { [ js[] ]; In Vol_S_Mag; Jacobian Vol; }
        }
      }
    }
  }
}

PostOperation {
  { Name Map; NameOfPostProcessing Mag;
    Operation {
      Print[ a, OnElementsOf Vol_Mag, File "a.pos" ];
      Print[ js, OnElementsOf Vol_S_Mag, File "js.pos" ];
      Print[ az, OnElementsOf Vol_Mag, File "az.pos" ];
      Print[ b, OnElementsOf Vol_Mag, File "b.pos" ];
      Print[ b, OnLine{{mm, mm, 0}{rInt, mm, 0}}{50}, File "cutb.pos" ];
    }
  }
}
