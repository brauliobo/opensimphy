// This tutorial introduces the full-wave Maxwell problem in the frequency
// domain, with lowest order Whitney edge elements to discretize the vector
// electric field in both 2D and 3D. The vector-valued basis functions are
// associated with the edges of the mesh, i.e. the electric field "e(x, y, z)"
// is expanded as
//
//   e(x, y, z) = Sum_{k in E} ee_k se_k(x, y, z)
//
// where the sum runs over all the edges of the mesh and the vector-valued edge
// basis functions "se_k(x, y, z)" are tangentially continuous across the mesh
// elements. The coefficients "ee_k" (i.e. the values of the degrees of
// freedom), correspond to the circulations of the electric field on the edges
// of the mesh. This identification between DoFs and edge circulations is a
// defining property of the lowest-order Whitney edge element: each basis
// function "se_k" is designed so that its line integral along edge "k" is
// equal to 1, and its line integral along any other edge is equal to 0. By
// linearity, "\int_{edge k} e . dl = ee_k", so each coefficient "ee_k" is
// literally the circulation of "e" along edge "k".
//
// Edge elements are one member of a larger family known as Whitney
// elements. Nodal "BF_Node" functions (associated with nodes, one pointwise
// scalar DoF per node) discretize scalar fields and belong to "H1"; edge
// "BF_Edge" functions (associated with edges, one circulation DoF per edge)
// discretize vector fields whose curl must remain square-integrable and belong
// to "H(curl)"; facet "BF_Facet" functions (associated with faces, one flux DoF
// per face) discretize vector fields whose divergence must remain
// square-integrable and belong to "H(div)"; and volume "BF_Volume" functions
// (associated with elements, one DoF per element) discretize scalar densities
// in "L2". These spaces are linked by the gradient, curl and divergence
// operators: "grad" maps "H1" into "H(curl)", "curl" maps "H(curl)" into
// "H(div)", and "div" maps "H(div)" into "L2", reflecting the identities "curl
// grad = 0" and "div curl = 0" at the discrete level.  Each physical quantity
// encountered in the tutorials has a natural home in this hierarchy: "v" and
// "T" live in "H1", "e" and "h" live in "H(curl)", "b" and "d" live in
// "H(div)", and charge or energy densities live in "L2".
//
// We model a rectangular waveguide, excited by a given electric field mode on
// an input port. Since the degrees of freedom correspond to the circulation of
// the electric field, imposing a Dirichlet boundary condition is not as trivial
// as with Lagrange finite elements (where the coefficients correspond to the
// value of the field at the nodes). With edge elements, the coefficients will
// change depending on the length and the orientation of the mesh edges: in this
// tutorial we will use a pre-resolution to compute the coefficients on the
// waveguide port.
//
// We assume that the waveguide is a good conductor, so we impose a "Perfect
// Electric Conductor" (PEC) boundary condition on the rest of the waveguide
// boundary, which amounts to imposing that the tangential component of the
// electric field, "e_t", is zero. Since the degrees of freedom are the
// circulation of the electric field, this amounts to setting the coefficients
// "ee_k" to 0 on the boundary edges of the waveguide.
//
// To truncate the computational domain, we cannot use the same infinite
// elements as in tutorial 3: the oscillatory nature of the wave solution
// prevents simply compressing an outside ring around the computational
// domain. Instead, we use a Silver-Muller Absorbing Boundary Condition (ABC),
// which expresses that the field behaves locally like an outgoing plane wave:
//
//   n x h = - sqrt(epsilon / mu) e_t,
//
// with "n" the exterior normal on the boundary, "h" the magnetic field,
// "epsilon" the dielectric permittivity, "mu" the magnetic permeability and
// "e_t = e - (e . n) n = (n x e) x n" the tangential electric field.
//
// We use the same phasor convention as in tutorial 4, i.e. "e(x, y, z, t) = Re(
// E(x, y, z) exp(i omega t) )", with the angular frequency "omega = 2 pi f".

Group {
  // Physical regions:
  Waveguide = Region[ 1000 ];
  Air = Region[ 1001 ];
  BndPEC = Region[ 2000 ]; // Boundary with PEC condition
  BndPort = Region[ 2001 ]; // Input port
  BndInf = Region[ 2002 ]; // Boundary with ABC

  // Abstract regions:
  //  - "Vol_Wav": overall domain
  //  - "Sur_Port_Wav": port with imposed electric field mode
  //  - "Sur_Inf_Wav": truncation surface with absorbing boundary condition
  Vol_Wav = Region[ {Waveguide, Air} ];
  Sur_Port_Wav = Region[ BndPort ];
  Sur_Inf_Wav = Region[ BndInf ];
}

Include "full_wave_common.pro";

Function {
  eps0 = 8.8541878176e-12;
  mu0 = 4 * Pi * 1e-7;

  DefineConstant[
    m = { 1, Min 1, Max 10, Step 1,
      Name "Parameters/Excitation mode (x)"},
    n = { 1, Min 1, Max 10, Step 1, Visible (dim == 3),
      Name "Parameters/Excitation mode (z)"},
    epsr = { 1, Min 1, Max 10, Step 0.1,
      Name "Parameters/Relative permittivity in waveguide"},
    f = { 8e9, Min 1e8, Max 1e10, Step 1e8,
      Name "Parameters/Frequency [Hz]"}
  ];

  epsilon[ Region[ {Air, BndInf} ] ] = eps0;
  epsilon[ Region[ {Waveguide, BndPort} ] ] = epsr * eps0;
  mu[] = mu0;
  nu[] = 1 / mu0;

  i[] = Complex[0, 1];
  omega = 2 * Pi * f;

  // The expressions that follow give the transverse electric-field profile of
  // the mode excited at the port, "ePort". Both in 2D and in 3D we excite a TM
  // mode (transverse magnetic with respect to the propagation direction y,
  // i.e. "H_y = 0"). In a TM mode, all six field components can be recovered
  // from the single longitudinal scalar "E_y" by algebra and one transverse
  // derivative (see the explicit formulas below).
  //
  // In our FEM setup we do not impose "E_y" at the port: only the tangential
  // components -- "E_x" in 2D, and "(E_x, E_z)" in 3D -- are prescribed there,
  // and "E_y" emerges in the interior as part of the full vector solve. The "0"
  // written for the y-component of "ePort" below is normal to the port and is
  // silently dropped by the tangential L2 projection on "Sur_Port_Wav".
  //
  // The generating scalar "E_y" satisfies a Helmholtz equation with Dirichlet
  // BC at the PEC walls ("E_y" being tangential to them):
  //   - In 3D,
  //
  //         E_y = E_0 sin(kx (x - Wx / 2)) sin(kz (z - Wz / 2)),
  //
  //     giving the TM_mn mode of the rectangular waveguide. Both indices must
  //     satisfy "m >= 1" and "n >= 1", otherwise "E_y" vanishes identically and
  //     the mode degenerates (the family TM_m0 or TM_0n does not exist).
  //   - In 2D the geometry is invariant in z (no PEC walls at z = const), so
  //     only "kx = m Pi / Wx" is quantized:
  //
  //        E_y = E_0 sin(kx (x - Wx / 2)),
  //
  //     giving the TM_m mode of the parallel-plate waveguide (m >= 1; the m = 0
  //     case would be the TEM mode).
  //
  // The transverse components follow from
  //
  //   E_x = -gamma / kc^2 * \partial_x E_y
  //
  // and (in 3D)
  //
  //   E_z = -gamma / kc^2 * \partial_z E_y,
  //
  // with "gamma" the longitudinal propagation constant and "kc^2 = kx^2 + kz^2"
  // in 3D, reducing to "kc^2 = kx^2" in 2D. From the dispersion relation
  //
  //   k^2 = kx^2 + kz^2 + (-i gamma)^2
  //
  // with "k = omega sqrt(mu eps)", it follows that
  //
  //   gamma = sqrt(k^2 - (kx^2 + kz^2)) * i
  //
  // i.e. "gamma" is purely imaginary above cutoff (propagating mode) and purely
  // real below cutoff (evanescent mode).

  k[] = omega * Sqrt[epsilon[] * mu[]];
  kx = m * Pi / Wx; // transverse wavevector (x)
  kz = n * Pi / Wz; // transverse wavevector (z)
  If(dim == 2)
    gamma[] = Sqrt[k[]^2 - kx^2] * i[];
    ePort[] = Vector[-gamma[] / kx * Cos[kx * (X[] - Wx / 2)], 0, 0];
  Else
    kc = Sqrt[kx^2 + kz^2];
    gamma[] = Sqrt[k[]^2 - kc^2] * i[];
    ePort[] = Vector[
      -gamma[] * kx / kc^2 * Cos[kx * (X[] - Wx / 2)] * Sin[kz * (Z[] - Wz / 2)],
      0.,
      -gamma[] * kz / kc^2 * Sin[kx * (X[] - Wx / 2)] * Cos[kz * (Z[] - Wz / 2)]
    ];
  EndIf

  c = 1 / Sqrt[epsr * eps0 * mu0];
  DefineConstant[
    lambda = {c / f * 100, ReadOnly 1, Highlight "LightGrey",
      Name "Parameters/}Wavelength [cm]"},
    f_cutoff = { (dim == 2) ? (0.5 * c * m / Wx) :
      0.5 * c * Sqrt[(m * m) / (Wx * Wx) + (n * n) / (Wz * Wz)],
      ReadOnly 1, Highlight "LightGrey",
      Name "Parameters/}Cutoff frequency [Hz]"}
  ];
}

Jacobian {
  // Instead of explicitly defining a Jacobian method for volumes and surfaces,
  // a single Jacobian method can be defined piecewise:
  { Name Jac;
    Case {
      { Region Sur_Port_Wav; Jacobian Sur; }
      { Region Sur_Inf_Wav; Jacobian Sur; }
      { Region Vol_Wav; Jacobian Vol; }
    }
  }
}

Integration {
  { Name Int;
    Case {
      { Type Gauss;
        Case {
          { GeoElement Line; NumberOfPoints 4; }
          { GeoElement Triangle; NumberOfPoints 4; }
          { GeoElement Tetrahedron; NumberOfPoints 4; }
        }
      }
    }
  }
}

Constraint {
  { Name e_Wav;
    Case {
      // On the PEC boundary, the circulation of the electric field is imposed
      // to 0 on the edges:
      { Region BndPEC; Type Assign; Value 0.; }
      // On the input port, the circulation of the electric field is imposed
      // through the resolution of a linear system, performing the L2 projection
      // of a known mode:
      { Region BndPort; Type AssignFromResolution; NameOfResolution Proj_e; }
    }
  }
}

Group{
  Dom_Hcurl_e_Wav =  Region[ {Vol_Wav, Sur_Port_Wav, Sur_Inf_Wav} ];
}

FunctionSpace {
  // The electric "e" field belongs to H(curl), meaning that both "e" and "curl
  // e" are square integrable. Basis functions "BF_Edge" are associated with the
  // edges of the mesh, and ensure the tangential continuity of the electric
  // field across mesh elements:
  { Name Hcurl_e_Wav; Type Form1;
    BasisFunction {
      { Name se; NameOfCoef ee; Function BF_Edge;
        Support Dom_Hcurl_e_Wav; Entity EdgesOf[All]; }
    }
    Constraint {
      { NameOfCoef ee; EntityType EdgesOf; NameOfConstraint e_Wav; }
    }
  }
}

Formulation {
  // To derive the finite element formulation in terms of the electric field "e"
  // in the frequency domain, we start from Faraday's law:
  //
  //   curl e = - i omega b,
  //
  // with "b = mu h" the magnetic flux density. Taking its curl and introducing
  // the reluctivity "nu = 1 / mu", we get
  //
  //   curl (nu curl e) = -i omega curl h.
  //
  // Assuming no conduction currents (we treat the waveguide walls as perfect
  // conductors), Maxwell-Ampere's equation reduces to
  //
  //   curl h = i omega d,
  //
  // with "d = epsilon e" the displacement field. Combining the last two
  // equations leads to the strong form
  //
  //   curl (nu curl e) - omega^2 epsilon e = 0.
  //
  // The weak formulation is obtained by multiplying by test functions "e'" in
  // H(curl) and integrating over the domain "Vol_Wav". This leads to finding
  // "e" such that
  //
  //   (curl (nu curl e), e')_Vol_Wav - (omega^2 epsilon e, e')_Vol_Wav = 0.
  //
  // holds for all test functions "e'". After integration by parts, the weak form
  // becomes: find "e" such that, for all "e'":
  //
  //   (nu curl e, curl e')_Vol_Wav + (n x nu curl e, e')_Bnd_Vol_Wav
  //      - (omega^2 epsilon e, e')_Vol_Wav = 0.
  //
  // The boundary term vanishes where Dirichlet boundary conditions are applied
  // (PEC and input port). On the outside boundary, the Silver-Muller ABC leads
  // to a Robin boundary condition:
  //
  //   (n x nu curl e, e')_Sur_Inf
  //     = (n x nu (- i omega b), e')_Sur_Inf
  //     = - (i omega n x h, e')_Sur_Inf
  //     = (i omega sqrt(epsilon / mu) e_t, e')_Sur_Inf
  //
  { Name FullWave_e; Type FemEquation;
    Quantity {
      { Name e; Type Local; NameOfSpace Hcurl_e_Wav; }
    }
    Equation {
      Integral { [ nu[] * Dof{d e} , {d e} ];
        In Vol_Wav; Integration Int; Jacobian Jac; }

      Integral { [ -omega^2 * epsilon[] * Dof{e} , {e} ];
        In Vol_Wav; Integration Int; Jacobian Jac; }

      Integral { [ i[] * omega * Sqrt[epsilon[] / mu[]] * Dof{e} , {e} ];
        In Sur_Inf_Wav; Integration Int; Jacobian Jac; }
    }
  }

  // In order to compute the coefficients of the imposed electric field mode on
  // the input port, we define an auxiliary weak formulation to perform the
  // L2-projection of the "ePort[]" function onto the finite element basis: find
  // "e" such that
  //
  //   (e, e')_Sur_Port_Wav - (ePort, e')_Sur_Port_Wav = 0
  //
  // holds for all test functions "e'".
  //
  // A direct Dirichlet assignment (as we did for the PEC boundary above, where
  // the imposed circulation was simply zero) is impractical here: each
  // coefficient "ee_k" is an integral of "ePort" along an individual mesh edge,
  // which would have to be computed by hand for every edge on the port --
  // depending on its length, orientation, and the local value of "ePort".  The
  // L2 projection does this automatically and consistently: it solves a small
  // auxiliary system whose solution is, by construction, the best
  // tangentially-continuous edge-element approximation of "ePort" on the port.
  { Name Projection_e; Type FemEquation;
    Quantity {
      { Name e; Type Local; NameOfSpace Hcurl_e_Wav; }
    }
    Equation {
      Integral { [ Dof{e} , {e} ];
        In Sur_Port_Wav; Integration Int; Jacobian Jac; }
      Integral { [ -ePort[] , {e} ];
        In Sur_Port_Wav; Integration Int; Jacobian Jac; }
    }
  }
}

Resolution {
  { Name Wav;
    System {
      { Name Sys_Wav; NameOfFormulation FullWave_e; Type Complex; }
    }
    Operation {
      Generate[Sys_Wav]; Solve[Sys_Wav]; SaveSolution[Sys_Wav];
    }
  }

  // One constraint associated to the function space used in the "FullWave_e"
  // formulation is of type "AssignFromResolution Proj_e". GetDP will
  // automatically perform the "Proj_e" resolution during the pre-processing
  // stage of the main "Wav" resolution:
  { Name Proj_e;
    System {
      { Name Sys_Proj; NameOfFormulation Projection_e; Type Complex;
        DestinationSystem Sys_Wav; }
    }
    Operation {
      // Note the "TransferSolution[]" operation, which will copy the ee_k
      // coefficients computed on "Sur_Port_Wav" into the "DestinationSystem"
      // "Sys_Wav", defined in the "Wav" resolution:
      Generate[Sys_Proj]; Solve[Sys_Proj]; TransferSolution[Sys_Proj];
    }
  }
}

PostProcessing {
  { Name Wav; NameOfFormulation FullWave_e;
    Quantity {
      { Name e;
        Value {
          Term{ [ {e} ]; In Vol_Wav; Jacobian Jac; }
        }
      }
      { Name eNorm;
        Value {
          Term{ [ Norm[{e}] ]; In Vol_Wav; Jacobian Jac; }
        }
      }
      { Name h;
        Value{
          Term{ [ i[] * nu[] / omega * {d e} ]; In Vol_Wav; Jacobian Jac; }
        }
      }
      // The (complex) Poynting vector "s = e x h*" gives the time-averaged
      // power flux density (with factor 1/2 for peak-value phasors). The symbol
      // "/\" is GetDP's cross-product operator; "Conj[...]" takes the complex
      // conjugate:
      { Name s;
        Value{
          Term{ [ 0.5 * {e} /\ Conj[i[] * nu[] / omega * {d e}] ]; In Vol_Wav;
            Jacobian Jac; }
        }
      }
    }
  }
}

PostOperation {
  { Name Map; NameOfPostProcessing Wav;
    Operation {
      Print [ e, OnElementsOf Vol_Wav, File "e.pos"];
      Print [ eNorm, OnElementsOf Vol_Wav, File "eNorm.pos"];
      Print [ h, OnElementsOf Vol_Wav, File "h.pos"];
      Print [ s, OnElementsOf Vol_Wav, File "s.pos"];
    }
  }
}
