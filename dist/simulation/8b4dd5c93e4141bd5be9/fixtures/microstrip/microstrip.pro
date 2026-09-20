// This tutorial computes the electric field around a microstrip line on top of
// a grounded dielectric substrate. The problem is electrostatic, obtained by
// combining the time-invariant Faraday equation ("curl e = 0", with "e" the
// electric field) with Gauss' law ("div d = rho", with "d" the displacement
// field and "rho" the charge density) and the dielectric constitutive law
// ("d = epsilon e", with "epsilon" the dielectric permittivity).
//
// Since "curl e = 0", "e" can be derived from a scalar electric potential "v",
// such that "e = -grad v". Plugging this potential in Gauss' law and using the
// constitutive law leads to a scalar (generalized) Poisson equation in terms of
// the electric potential: "-div(epsilon grad v) = rho".
//
// We consider here the special case where "rho = 0" to model a conducting
// microstrip line on top of a dielectric substrate. A Dirichlet boundary
// condition sets the potential to 1 mV on the boundary of the microstrip line
// and to 0 V on the ground. A homogeneous Neumann boundary condition (zero
// normal component of the displacement field, i.e. "n . d = 0") is imposed on
// the left boundary of the domain to account for the symmetry of the problem. A
// homogeneous Neumann condition is also called a "natural" boundary condition:
// it appears in the weak formulation as a vanishing boundary integral, and
// therefore requires no explicit treatment in the model -- we simply do
// nothing. The domain is truncated on the top and right with a homogeneous
// Dirichlet boundary condition ("v = 0"), assumed to be imposed sufficiently
// far away from the microstrip.

Group {
  // Create region groups associated with the physical groups defined in the
  // "microstrip.msh" mesh file produced by Gmsh:
  Air = Region[ 1 ];
  Dielectric = Region[ 2 ];
  Ground = Region[ 10 ];
  Microstrip = Region[ 11 ];
  Inf = Region[ 12 ];

  // Define abstract regions to be used below in the definition of the scalar
  // electric potential formulation:
  //  - "Vol_Ele": overall volume domain where "-div(epsilon grad v) = 0" is
  //    solved; it contains only "volume" elements of the mesh (triangles here)
  //  - "Sur_Neu_Ele": surface where non homogeneous Neumann boundary conditions
  //    (on "n . d = -n . (epsilon grad v)") are imposed; it contain only
  //    "surface" elements of the mesh (lines here).
  //
  // The purpose of abstract regions is to allow a generic definition of the
  // FunctionSpace, Formulation and PostProcessing objects with no reference to
  // model-specific physical groups. We will show in tutorial 9 how abstract
  // formulations can then be isolated in geometry-independent template files,
  // thanks to an appropriate declaration mechanism (using "DefineConstant[]",
  // "DefineGroup[]" and "DefineFunction[]").
  //
  // Since there are no non-homogeneous Neumann conditions in this particular
  // example, "Sur_Neu_Ele" is defined as empty.
  //
  // Note that volume elements are those that correspond to the higher dimension
  // of the model at hand (2D elements here), surface elements correspond to the
  // higher dimension of the model minus one (1D elements here).
  Vol_Ele = Region[ {Air, Dielectric} ];
  Sur_Neu_Ele = Region[ {} ];
}

Function {
  // Material laws (here the dielectric permittivity) are defined as piecewise
  // functions (note the square brackets), in terms of the above defined groups:
  eps0 = 8.854187818e-12;
  epsilon[ Air ] = 1. * eps0;
  epsilon[ Dielectric ] = 9.8 * eps0;
}

Constraint {
  // The Dirichlet boundary condition is also defined piecewise, through the
  // following "v_Ele" constraint, invoked in the FunctionSpace below. The
  // constraint type "Assign" means that the coefficients in the finite element
  // expansion will be assigned the prescribed values:
  { Name v_Ele; Type Assign;
    Case {
      { Region Ground; Value 0.; }
      { Region Microstrip; Value 1.e-3; }
      { Region Inf; Value 0; }
    }
  }
}

Group{
  // The domain of definition of a FunctionSpace lists all regions on which a
  // field is defined. Domains of definitions may contain both volume and
  // surface regions, so we use a "Dom_" prefix to avoid confusion:
  Dom_H1_v_Ele =  Region[ {Vol_Ele, Sur_Neu_Ele} ];
}

FunctionSpace {
  // The function space in which we pick the electric scalar potential "v"
  // solution is defined by
  //  - a domain of definition (the "Support": "Dom_H1_v_Ele")
  //  - a type ("Form0", meaning "scalar field"; this corresponds to the
  //    function space "H1" of scalar fields with square-integrable gradient -
  //    see tutorial 5 for the full de Rham complex "H1", "H(curl)", "H(div)"
  //    and "L2")
  //  - a set of basis functions ("BF_Node" for scalar nodal basis functions,
  //    i.e. isoparametric Lagrange elements)
  //  - a set of entities to which the basis functions are associated ("Entity":
  //    here all the nodes of the domain of definition "NodesOf[All]")
  //  - a constraint (here the Dirichlet boundary conditions)
  //
  // The finite element expansion of the unknown field "v" reads
  //
  //   v(x, y) = Sum_k vn_k sn_k(x, y)
  //
  // where the "vn_k" coefficients are the nodal values and "sn_k(x, y)" are the
  // nodal basis functions. Not all coefficients vn_k are unknowns of the finite
  // element problem, due to the Dirichlet constraint, which assigns particular
  // values to the nodes of the "Ground" and "Microstrip" regions.
  //
  // The default mesh "microstrip.msh" is made of first order (3-node)
  // triangles: the nodal basis functions sn_k(x, y) are then piece-wise linear
  // on each triangle. If second order (6-node) triangles are used instead
  // ("gmsh microstrip.geo -order 2 -2"), the basis functions will be piece-wise
  // quadratic on each triangle. In all cases, with Lagrange elements, we have
  // "sn_k(x_l, y_l) = \delta_kl" (the Kronecker delta, which is 1 if "k = l"
  // and 0 otherwise) if "(x_l, y_l)" denotes the coordinates of node "l".
  { Name H1_v_Ele; Type Form0;
    BasisFunction {
      { Name sn; NameOfCoef vn; Function BF_Node;
        Support Dom_H1_v_Ele; Entity NodesOf[ All ]; }
      // Using "NodesOf[All]" instead of "NodesOf[Dom_H1_v_Ele]" is an
      // optimization, which avoids explicitly building the list of all the
      // nodes. It is always safe here: GetDP restricts the actual basis
      // functions to those that have support in "Dom_H1_v_Ele". In cases where
      // different basis functions must be associated with disjoint subsets of
      // nodes (see e.g. tutorial 6), the explicit form "NodesOf[ <subset> ]"
      // becomes necessary.
    }
    Constraint {
      { NameOfCoef vn; EntityType NodesOf; NameOfConstraint v_Ele; }
    }
  }
}

Jacobian {
  // Jacobians specify the mapping between elements in the mesh and the
  // reference elements over which integration is performed.
  //
  // "Vol" stands for the 1-to-1 mapping between identical spatial dimensions,
  // i.e. in this case a reference triangle (2D) onto triangles in the "z = 0"
  // plane (2D):
  { Name Vol;
    Case {
      { Region All; Jacobian Vol; }
    }
  }
  // "Sur" is used to map the reference line segment (1D) onto lines in the
  // plane (2D). It is not strictly needed in this particular example (because
  // "Sur_Neu_Ele" is empty), but is defined here for completeness, so that any
  // surface term that might be added later to the Formulation below (for
  // example the optional non-homogeneous Neumann term) can readily refer to it:
  { Name Sur;
    Case {
      { Region All; Jacobian Sur; }
    }
  }
}

Integration {
  // A Gauss numerical quadrature is used for the integrations:
  { Name Int;
    Case {
      { Type Gauss;
        Case {
          // One quadrature point is sufficient to integrate exactly the
          // stiffness matrix with first order elements (constant value per
          // element):
          { GeoElement Triangle; NumberOfPoints 1; }
          // But we need 3 quadrature points for second order elements:
          { GeoElement Triangle2; NumberOfPoints 3; }
        }
      }
    }
  }
}

Formulation {
  // The Formulation object encodes the weak formulation of the partial
  // differential equation, i.e. of "-div(epsilon grad v) = 0". This weak
  // formulation involves finding "v" such that
  //
  //   (-div(epsilon grad v) , v')_Vol_Ele = 0
  //
  // holds for all test functions "v'", where "(. , .)_D" denotes the inner
  // product over a domain "D". Integrating by parts (i.e. using Green's first
  // identity: "(div(f), u)_D = -(f, grad u)_D + (n . f, u)_Bnd_D"), the weak
  // formulation becomes: find "v" such that
  //
  //   (epsilon grad v, grad v')_Vol_Ele
  //     - (n . (epsilon grad v), v')_Bnd_Vol_Ele = 0
  //
  // holds for all "v'", where "Bnd_Vol_Ele" is the boundary of "Vol_Ele". In
  // our microstrip example this surface term vanishes, since
  //  - on the "Ground", "Microstrip" and "Inf" parts of the boundary we impose a
  //    Dirichlet boundary condition on "v" (through the "Assign" constraint)
  //    and the test functions "v'" vanish (there are actually none, as the
  //    corresponding unknowns have been fixed);
  //  - on the remaining part of the boundary (on the left side, at y = 0) by
  //    symmetry "n . d = - n. (epsilon grad v) = 0", i.e. we have a homogeneous
  //    Neumann ("natural") boundary condition.
  //
  // We are thus eventually looking for functions "v" in the function space
  // "H1_v_Ele" such that
  //
  //   (epsilon grad v, grad v')_Vol_Ele = 0
  //
  // holds for all "v'". Finally, our choice here is to use a Galerkin method,
  // where the test functions "v'" are the same basis functions ("sn_k") as the
  // ones used to interpolate the unknown potential "v".
  //
  // The "Integral" statement in the Formulation is a symbolic representation of
  // this weak formulation. It has 4 semicolon separated arguments:
  //  - the density "[. , .]" to be integrated (note the square brackets instead
  //    of the parentheses), with the test functions (always) after the comma;
  //  - the domain of integration;
  //  - the Jacobian of the transformation between the reference element and the
  //    element in the mesh;
  //  - the integration method.
  //
  // In the density, braces around a quantity (such as "{v}") indicate that this
  // quantity belongs to a FunctionSpace. Differential operators can be applied
  // within braces (such as "{Grad v}"); in particular the symbol "d" represents
  // the exterior derivative, and it is a synonym of "Grad" when applied to a
  // scalar function, declared with type "Form0" in the FunctionSpace.
  //
  // As the Galerkin method uses as test functions the same basis functions
  // "sn_k" as for the unknown field "v", the second term in the density should
  // be something like [ ... , basis_functions_of {d v} ]. However, since the
  // second term is always devoted to test functions, the operator
  // "basis_functions_of" would always be there.  It can therefore be made
  // implicit and, in the GetDP syntax, it is omitted. So, one simply writes "[
  // ... , {d v} ]".
  //
  // On the other hand, the first term can contain a much wider variety of
  // expressions. In our case it should be expressed in terms of the finite
  // element expansion of "v" at the present system solution, i.e. when the
  // coefficients "vn_k" in the expansion "v = Sum_k vn_k sn_k" are
  // unknown. This is indicated by prefixing the braces with "Dof" ("degree of
  // freedom"), which leads to the following density:
  //
  //   [ epsilon[] * Dof{d v} , {d v} ],
  //
  // a bilinear term that will contribute to the stiffness matrix of the
  // electrostatic problem at hand.
  //
  // Another option, which does not work here (because it would make the
  // problem trivial: there would be no unknowns left), is to evaluate the
  // first argument with the last available computed solution, i.e. simply
  // perform the interpolation with known coefficients "vn_k". The "Dof"
  // prefix is then omitted and we would have:
  //
  //   [ epsilon[] * {d v} , {d v} ],
  //
  // a linear term that would contribute to the right-hand side of the linear
  // system. This mechanism is not useful for a linear, one-shot problem like
  // the present one, but it is essential whenever a term depends on a
  // previously computed field: see tutorial 3 (where the reluctivity "nu" is
  // evaluated at the current iterate "{d a}" inside a Newton-Raphson loop)
  // and tutorial 7 (where the electrical conductivity is evaluated at the
  // temperature field "{T}" computed by a separate formulation).

  { Name Electrostatics_v; Type FemEquation;
    Quantity {
      { Name v; Type Local; NameOfSpace H1_v_Ele; }
    }
    Equation {
      Integral { [ epsilon[] * Dof{d v} , {d v} ];
        In Vol_Ele; Jacobian Vol; Integration Int; }

      // Additional "Integral" terms can be added here. For example, the
      // following term may account for non-homogeneous Neumann boundary
      // conditions, provided that the function "nd[]" is defined:
      //
      // Integral { [ nd[] , {v} ];
      //   In Sur_Neu_Ele; Jacobian Sur; Integration Int; }

      // All the terms in the "Equation" are added, and an implicit "= 0" is
      // considered at the end.
    }
  }
}

// In the Resolution object we specify what to do with a weak formulation: here
// we simply generate a linear system, solve it and save the solution to disk
// (in a ".res" file).
Resolution {
  { Name Ele;
    System {
      { Name Sys_Ele; NameOfFormulation Electrostatics_v; }
    }
    Operation {
      Generate[Sys_Ele]; Solve[Sys_Ele]; SaveSolution[Sys_Ele];
    }
  }
}

// Post-processing is done in two parts.
//
// The first part defines, in terms of the Formulation, which itself refers to
// the FunctionSpace, a number of quantities that can be evaluated at the
// post-processing stage. The three quantities defined here are:
//  - the scalar electric potential;
//  - the electric field;
//  - the electric displacement.
PostProcessing {
  { Name Ele; NameOfFormulation Electrostatics_v;
    Quantity {
      { Name v; Value {
          Term { [ {v} ]; In Vol_Ele; Jacobian Vol; }
        }
      }
      { Name e; Value {
          Term { [ -{d v} ]; In Vol_Ele; Jacobian Vol; }
        }
      }
      { Name d; Value {
          Term { [ -epsilon[] * {d v} ]; In Vol_Ele; Jacobian Vol; }
        }
      }
    }
  }
}

// The second part consists in defining post-processing operations, which can be
// invoked separately. (The first PostOperation is invoked by default when Gmsh
// is run interactively. The generated post-processing files are automatically
// displayed by Gmsh if the "Merge result automatically" option is enabled in
// the Gmsh "gear" menu.)

tol = 1.e-7; // small offset to ensure the cut is inside the simulation domain
yCut = 2.e-3; // vertical position of the cut

PostOperation {
  { Name Map; NameOfPostProcessing Ele;
     Operation {
       Print [ v, OnElementsOf Vol_Ele, File "v.pos" ];
       Print [ e, OnElementsOf Vol_Ele, File "e.pos" ];
       Print [ d, OnElementsOf Vol_Ele, File "d.pos" ];
       Print [ e, OnLine {{tol, yCut, 0}{14.e-3, yCut, 0}}{60}, File "e_cut.pos" ];
     }
  }
  { Name Cut; NameOfPostProcessing Ele;
    // Same cut as above, with more points and exported in raw text format.
    // "Format Table" requests an ASCII file (one row of numbers per evaluation
    // point) instead of the default Gmsh ".pos" format, which carries mesh
    // information and is automatically rendered by Gmsh. A ".txt" file is
    // primarily intended for post-processing by external tools (spreadsheets,
    // plotting scripts, etc.).
    //
    // Note that PostOperations other than the default one are invoked from the
    // Gmsh GUI through the "Modules > GetDP > Post-processing" menu (or from
    // the command line, e.g. with "getdp microstrip.pro -solve Ele -pos Cut"):
    Operation {
      Print [ e, OnLine {{tol, tol, 0}{14.e-3, tol, 0}} {500}, Format Table,
        File "e_cut.txt" ];
    }
  }
}
