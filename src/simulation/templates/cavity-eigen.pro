// GetDP SLEPc eigen formulation for a Dirichlet cavity on cube.geo.
DefineConstant[
  s = {4, Name "Parameters/Global mesh size factor", Label "Global mesh size factor",
    Min 0.5, Max 8, Step 0.5, Help "Gmsh target mesh size for the cavity"}
];

Group {
  Cavity = Region[401];
  CavityBoundary = Region[{301, 302, 303, 304, 305, 306}];
  Vol = Region[Cavity];
  Dom = Region[{Cavity, CavityBoundary}];
}

Constraint {
  { Name Dirichlet; Type Assign;
    Case { { Region CavityBoundary; Value 0.; } }
  }
}

FunctionSpace {
  { Name H1; Type Form0;
    BasisFunction { { Name sn; NameOfCoef un; Function BF_Node; Support Dom; Entity NodesOf[All]; } }
    Constraint { { NameOfCoef un; EntityType NodesOf; NameOfConstraint Dirichlet; } }
  }
}

Jacobian { { Name Vol; Case { { Region All; Jacobian Vol; } } } }

Integration {
  { Name Int;
    Case {
      { Type Gauss;
        Case {
          { GeoElement Triangle; NumberOfPoints 3; }
          { GeoElement Tetrahedron; NumberOfPoints 4; }
        }
      }
    }
  }
}

Formulation {
  { Name LaplaceEigen; Type FemEquation;
    Quantity { { Name u; Type Local; NameOfSpace H1; } }
    Equation {
      Galerkin { [ Dof{d u}, {d u} ]; In Vol; Jacobian Vol; Integration Int; }
      Galerkin { DtDt[ Dof{u}, {u} ]; In Vol; Jacobian Vol; Integration Int; }
    }
  }
}

Resolution {
  { Name Eigen;
    System { { Name A; NameOfFormulation LaplaceEigen; } }
    Operation {
      GenerateSeparate[A];
      EigenSolve[A, 8, 0, 0];
      SaveSolutions[A];
    }
  }
}

PostProcessing {
  { Name Eigen; NameOfFormulation LaplaceEigen;
    Quantity { { Name u; Value { Local { [{u}]; In Vol; Jacobian Vol; } } } }
  }
}

PostOperation {
  { Name Map; NameOfPostProcessing Eigen;
    Operation { Print[u, OnElementsOf Vol, File "u.pos"]; }
  }
}
