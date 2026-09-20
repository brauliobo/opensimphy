// This tutorial extends the electrostatic problem from tutorial 1 to introduce
// global basis functions, which are used to handle floating potentials and to
// compute global quantities such as electrode charges and capacitances.
//
// In a two-dimensional electrostatic model (see tutorial 1), the finite element
// expansion of the electric scalar potential "v(x, y)" associates basis
// functions with individual nodes in the mesh:
//
//   v(x, y) = Sum_{k in N} vn_k sn_k(x, y)
//
// with "N" the set of all the nodes in the mesh and "sn_k(x, y)" the Lagrange
// basis function associated with node "k". Now consider the situation where
// "v(x, y)" is constant over a region of the problem, e.g. "v(x, y) =
// vf_electrode" on an electrode. By factorizing the identical nodal values
// "vf_electrode", a global (non-local) basis function "sf_electrode(x, y)" is
// obtained as factor:
//
//   v(x, y) = Sum_{k in N} vn_k sn_k(x, y)
//     = Sum_{k in N \ E} vn_k sn_k(x, y) + Sum_{k in E} vn_k sn_k(x, y)
//     = Sum_{k in N \ E} vn_k sn_k(x, y) + vf_electrode Sum_{k in E} sn_k(x, y)
//     = Sum_{k in N \ E} vn_k sn_k(x, y) + vf_electrode sf_electrode(x, y)
//
// with "E" the set of nodes on the electrode. The global basis function
//
//   sf_electrode(x, y) = Sum_{k in E} sn_k(x, y)
//
// is the sum of the Lagrange (nodal) basis functions associated with the nodes
// of the electrode. This function
//  - is a continuous function, scalar in this case;
//  - is equal to 1 at the nodes of the electrode, and to 0 at all other nodes;
//  - decreases from 1 to 0 over the one-element-thick layer of elements sharing
//    at least one node with the electrode region.
//
// One such global basis function can be associated with each electrode in the
// system, so that the finite element expansion of the electric scalar potential
// reads:
//
//   v(x, y) = Sum_k vn_k sn_k(x, y)
//     + Sum_electrode vf_electrode sf_electrode(x, y)
//
// where "Sum_electrode" runs over all the electrodes in the model (one term per
// electrode, so two in the present example: the boundary of the microstrip line
// and the ground), and "Sum_k" runs over all nodes except those of the
// electrode regions.
//
// Below we show how GetDP takes advantage of global basis functions
//  - to efficiently compute the electrode charges "Q_electrode", which are the
//    energy duals of the global "vf_electrode" potentials;
//  - to deal with floating potentials, which are the computed electrode
//    potentials when the electrode charge is imposed;
//  - to provide output global quantities (charges, voltages, capacitances) that
//    can be used in an external circuit.

Group {
  // Physical regions:
  Air = Region[ 1 ];
  Dielectric = Region[ 2 ];
  Ground = Region[ 10 ];
  Microstrip = Region[ 11 ];
  Inf = Region[ 12 ];

  // Abstract regions:
  //  - "Vol_Ele": overall domain
  //  - "Sur_Neu_Ele": surface with non homogeneous Neumann boundary conditions
  //  - "Sur_Electrodes_Ele": electrode regions
  Vol_Ele = Region[ {Air, Dielectric} ];
  Sur_Neu_Ele = Region[ {} ];
  Sur_Electrodes_Ele = Region [ {Ground, Microstrip} ];
}

Function {
  DefineConstant[
    TypeBC = {0, Choices{0="Fixed voltage", 1="Fixed charge"},
      Name "Parameters/0Type"}
    ValueBC = {1e-3,
      Name "Parameters/1Value"}
    epsr = {9.8,
      Name "Parameters/2Relative permittivity"}
    DisplayGlobalBasisFunctions = {0, Choices {0, 1},
      Name "Parameters/3Display global basis functions"}
    OverwriteOutput = {1, Choices {0, 1},
      Name "Parameters/4Overwrite output.txt file"}
  ];

  eps0 = 8.854187818e-12;
  epsilon[ Air ] = eps0;
  epsilon[ Dielectric ] = epsr * eps0;
}

Constraint {
  // The Dirichlet boundary condition on the local electric potential is only
  // used for the homogeneous condition on the top and right boundaries. The
  // boundary of the microstrip line and the ground are now treated as
  // electrodes, on which either the potential or the charge is imposed through
  // the "Voltage_Ele" or "Charge_Ele" constraints below.
  { Name v_Ele;
    Case {
      { Region Inf; Value 0; }
    }
  }

  { Name Voltage_Ele;
    Case {
      // If the "Fixed voltage" option is enabled (i.e. when "TypeBC == 0"),
      // impose the global potential on the boundary of the microstrip line (and
      // thus the voltage, i.e. the potential difference between the microstrip
      // and the ground) to "ValueBC":
      If(TypeBC == 0)
        { Region Microstrip; Value ValueBC; }
      EndIf
      // Impose the global (i.e. region-wise) potential to 0 on the ground
      // electrode:
      { Region Ground; Value 0; }
    }
  }
  { Name Charge_Ele;
    Case {
      // If the "Fixed charge" option is enabled (i.e. when "TypeBC == 1"),
      // impose the global charge on the boundary of the microstrip line:
      If(TypeBC == 1)
        { Region Microstrip; Value ValueBC; }
      EndIf
      // Since "Ground" is always constrained to zero potential by "Voltage_Ele"
      // above, its charge cannot be prescribed; it will be computed as a global
      // output, cf. "Q" in the PostProcessing below.
    }
  }
}

Group{
  Dom_H1_v_Ele =  Region[ {Vol_Ele, Sur_Neu_Ele, Sur_Electrodes_Ele} ];
}

FunctionSpace {
  // The natural treatment of global quantities in GetDP stems from the fact
  // that nearly all the work is done at the level of the FunctionSpace
  // definition. As seen above, the finite element expansion of the potential
  // "v" is
  //
  //   v(x, y) = Sum_k vn_k sn_k(x, y)
  //     + Sum_electrode vf_electrode sf_electrode(x, y)
  //
  // with "Sum_k" running over all nodes except those of the electrode
  // regions. The global basis function "sf_electrode(x, y)" is the sum of the
  // nodal basis functions associated with the nodes of the electrode. This is
  // precisely what one finds in the FunctionSpace definition below, where:
  //  - "BF_Node" is the standard Lagrange basis function, that we associate
  //    with all the nodes of the domain except those on the electrode regions
  //    ("Entity NodesOf[ All, Not Sur_Electrodes_Ele ]"). One degree of freedom
  //    is created per node of the region.
  //  - "BF_GroupOfNodes" is the sum of Lagrange basis functions associated with
  //    the group of nodes of the electrodes ("Entity GroupsOfNodesOf[
  //    Sur_Electrodes_Ele ]"). A single degree of freedom is shared by all the
  //    nodes of each listed region -- whose value is the "vf_electrode"
  //    coefficient attached to the global basis function "sf_electrode".
  //
  // By activating the "Display global basis functions" option, you can
  // visualize the two "sf_electrode" basis functions in the model: one
  // associated with the boundary of the microstrip line, the other with the
  // ground.
  //
  // The global quantities are attributed an explicit name in the
  // "GlobalQuantity" section; these names are used in the corresponding
  // "GlobalTerm" in the Formulation. Such global terms are the equivalent of a
  // "Integral" term, but where no integration needs to be performed. The
  // "AssociatedWith" statement refers to the fact that the global potential of
  // an electrode is the (electrostatic) energy dual of the electric charge
  // carried by that electrode. Indeed, let us consider the electrostatic weak
  // formulation derived in tutorial 1: find "v" in H1_v_Ele such that
  //
  //   (epsilon grad v, grad v')_Vol_Ele
  //     - (n . (epsilon grad v), v')_Bnd_Vol_Ele = 0
  //
  // holds for all test functions "v'". When the test-function "v'" is
  // "sf_electrode", the boundary term reduces to
  //
  //   - (n . (epsilon grad v), sf_electrode)_Sur_Electrodes_Ele.
  //
  // Since "sf_electrode == 1" on the electrode, and since "e = -grad v" and "d
  // = epsilon e", the boundary term is equal to
  //
  //   - \int_Sur_Electrodes_Ele n . (epsilon grad v)
  //     = \int_Sur_Electrodes_Ele n . (epsilon e)
  //     = \int_Sur_Electrodes_Ele n . d
  //     = - \int_Electrodes (div d)
  //     = - \int_Electrodes rho
  //     = - Q_electrode
  //
  // i.e. the charge carried by the electrode.
  //
  // Constraints can be set on either component of the FunctionSpace. Besides
  // the usual Dirichlet boundary condition on the local field, one may fix
  // either the "Voltage" or the "Charge" of each individual electrode (never
  // both, of course). When the "Charge" is fixed, the computed "Voltage" for
  // that electrode is the so-called floating potential.
  { Name H1_v_Ele; Type Form0;
    BasisFunction {
      { Name sn; NameOfCoef vn; Function BF_Node;
        Support Dom_H1_v_Ele; Entity NodesOf[ All, Not Sur_Electrodes_Ele ]; }
      { Name sf; NameOfCoef vf; Function BF_GroupOfNodes;
        Support Dom_H1_v_Ele; Entity GroupsOfNodesOf[ Sur_Electrodes_Ele ]; }
    }
    GlobalQuantity {
      { Name Voltage; Type AliasOf; NameOfCoef vf; }
      { Name Charge; Type AssociatedWith; NameOfCoef vf; }
    }
    Constraint {
      { NameOfCoef vn; EntityType NodesOf;
        NameOfConstraint v_Ele; }
      { NameOfCoef Voltage; EntityType GroupsOfNodesOf;
        NameOfConstraint Voltage_Ele; }
      { NameOfCoef Charge; EntityType GroupsOfNodesOf;
        NameOfConstraint Charge_Ele; }
    }
    // Subspace definition only needed to display the global basis functions in
    // post-processing:
    SubSpace {
      { Name vf; NameOfBasisFunction sf; }
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
  // The formulation contains two changes compared to the formulation from the
  // first tutorial: the global quantities are declared as "Global" in the
  // "Quantity" section, and a "GlobalTerm" is added that triggers the assembly
  // of the additional equation per electrode (the "pre-integrated" boundary
  // term) in the system to compute the charge "Q_electrode". "Q_electrode"
  // satisfies (just consider the equation corresponding to the test function
  // "sf_electrode"):
  //
  //   Q_electrode = (epsilon grad v, grad sf_electrode)_Vol_Ele
  //
  // Note that, although "Vol_Ele" appears as the integration domain, "grad
  // sf_electrode" is nonzero only in the one-element-thick layer adjacent to
  // the electrode.
  { Name Electrostatics_v; Type FemEquation;
    Quantity {
      { Name v; Type Local; NameOfSpace H1_v_Ele; }
      { Name V; Type Global; NameOfSpace H1_v_Ele [Voltage]; }
      { Name Q; Type Global; NameOfSpace H1_v_Ele [Charge]; }
      // The following line is only needed to display the global basis functions
      // in post-processing:
      { Name vf; Type Local; NameOfSpace H1_v_Ele [vf]; }
    }
    Equation {
      Integral { [ epsilon[] * Dof{d v} , {d v} ];
        In Vol_Ele; Jacobian Vol; Integration Int; }
      // As with "Integral" terms, the second argument of "GlobalTerm [. , .]"
      // is the test function (the "AliasOf" quantity, here "{V}"), and the
      // first argument is the term multiplying the basis function (involving
      // the "AssociatedWith" Dof, here "{Q}"). The "In" keyword specifies the
      // region on which the GlobalQuantity is defined. No integration is
      // performed (hence "Global", not "Integral"):
      GlobalTerm { [ -Dof{Q} , {V} ]; In Sur_Electrodes_Ele; }
    }
  }
}

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

PostProcessing {
 { Name Ele; NameOfFormulation Electrostatics_v;
    Quantity {
      // Local post-processing quantities are defined as usual:
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
      // Global quantities defined in a similar way:
      { Name Q; Value {
          Term { [ {Q} ]; In Sur_Electrodes_Ele; }
        }
      }
      { Name V; Value {
          Term { [ {V} ]; In Sur_Electrodes_Ele; }
        }
      }
      // Since we have access to the voltage and the charge we can directly
      // compute the capacitance:
      { Name C; Value {
          Term { [ {Q} / {V} ]; In Sur_Electrodes_Ele; }
        }
      }
      // We could also compute the capacitance by way of the energy ("C = 2 *
      // energy / V^2"), obtained by integrating ("epsilon / 2 * |grad v|^2")
      // over the domain, which can be done by defining an "Integral"
      // post-processing quantity:
      { Name energy; Value {
          Integral { [ epsilon[] / 2. * SquNorm[{d v}] ]; In Vol_Ele;
            Jacobian Vol; Integration Int; }
        }
      }
      // Finally we can use the "BF[]" operator to retrieve the global basis
      // functions on the two electrodes, in order to visualize them:
      { Name sf_Ground; Value {
          Term { [ BF{vf} ]; In Vol_Ele; SubRegion Ground; Jacobian Vol; }
        }
      }
      { Name sf_Microstrip; Value {
          Term { [ BF{vf} ]; In Vol_Ele; SubRegion Microstrip; Jacobian Vol; }
        }
      }
    }
  }
}

PostOperation {
  { Name Map; NameOfPostProcessing Ele;
    Operation {
      Print[ v, OnElementsOf Vol_Ele, File "v.pos" ];

      If(DisplayGlobalBasisFunctions)
        // If "DisplayGlobalBasisFunctions" is set, save the global basis
        // function associated with the ground in a Gmsh post-processing file:
        Print[ sf_Ground, OnElementsOf Vol_Ele, File "sf_Ground.pos" ];
        // To better visualize the global function, print some Gmsh options in
        // an additional option file, that will also be automatically merged by
        // Gmsh and that will modify the view's display options:
        Echo[ StrCat[
            "l = PostProcessing.NbViews - 1;", // get last view index
            "View[l].IntervalsType = 1;", // display iso-curves
            "View[l].NbIso = 40;", // display 40 iso-curves
            "View[l].ShowElement = 1;" // display the element outlines
          ], File "sf.opt"];

        // Do the same with the global function associated with the microstrip:
        Print[ sf_Microstrip, OnElementsOf Vol_Ele,
          File "sf_Microstrip.pos" ];
        // Instead of creating the same option file, just append (using ">") an
        // empty string to the existing file, which will also trigger Gmsh to
        // merge it:
        Echo[ "", File > "sf.opt"];
      EndIf

      If(OverwriteOutput)
        // Remove the "output.txt" file if the "OverwriteOutput" option is set:
        DeleteFile[ "output.txt" ];
      EndIf

      // Output global quantities in the "output.txt" file, and also send them
      // to the graphical user interface using the "SendToServer" option:
      Echo[ "Microstrip charge [C]:", Format Table, File > "output.txt"];
      Print[ Q, OnRegion Microstrip, File > "output.txt", Color "AliceBlue",
        Format Table, SendToServer "}Output/Microstrip/Charge [C]" ];

      Echo[ "Microstrip potential [V]:", Format Table, File > "output.txt"];
      Print[ V, OnRegion Microstrip, File > "output.txt", Color "AliceBlue",
        Format Table, SendToServer "}Output/Microstrip/Potential [V]" ];

      Echo[ "Ground charge [C]:", Format Table, File > "output.txt"];
      Print[ Q, OnRegion Ground, File > "output.txt", Color "AliceBlue",
        Format Table, SendToServer "}Output/Ground/Charge [C]" ];

      Echo[ "Microstrip capacitance [F]:", Format Table, File > "output.txt"];
      Print[ C, OnRegion Microstrip, File > "output.txt", Color "AliceBlue",
        Format Table, SendToServer "}Output/Global/Capacitance [F]" ];

      Echo[ "Electrostatic energy [J]:", Format Table, File > "output.txt"];
      Print[ energy[Vol_Ele], OnGlobal, File > "output.txt", Color "AliceBlue",
        Format Table, SendToServer "}Output/Global/Energy [J]" ];
    }
  }
}
