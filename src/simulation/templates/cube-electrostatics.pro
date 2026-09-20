DefineConstant[
  s = {2, Name "Parameters/Global mesh size factor", Label "Global mesh size factor",
    Min 0.5, Max 8, Step 0.5, Help "Gmsh target mesh size for the imported STEP volume"}
];

Group {
  Ground = Region[1001];
  Electrode = Region[1002];
  Dielectric = Region[1003];
  Vol_Ele = Region[Dielectric];
  Sur_Dir_Ele = Region[{Ground, Electrode}];
  Dom_H1_v_Ele = Region[{Vol_Ele, Sur_Dir_Ele}];
}

Function {
  eps0 = 8.854187818e-12;
  epsilon[Dielectric] = 1. * eps0;
}

Constraint {
  { Name v_Ele; Type Assign;
    Case {
      { Region Ground; Value 0.; }
      { Region Electrode; Value 1.; }
    }
  }
}

FunctionSpace {
  { Name H1_v_Ele; Type Form0;
    BasisFunction {
      { Name sn; NameOfCoef vn; Function BF_Node;
        Support Dom_H1_v_Ele; Entity NodesOf[All]; }
    }
    Constraint {
      { NameOfCoef vn; EntityType NodesOf; NameOfConstraint v_Ele; }
    }
  }
}

Jacobian {
  { Name Vol; Case { { Region All; Jacobian Vol; } } }
  { Name Sur; Case { { Region All; Jacobian Sur; } } }
}

Integration {
  { Name Int;
    Case {
      { Type Gauss;
        Case {
          { GeoElement Triangle; NumberOfPoints 3; }
          { GeoElement Quadrangle; NumberOfPoints 4; }
          { GeoElement Tetrahedron; NumberOfPoints 4; }
          { GeoElement Hexahedron; NumberOfPoints 6; }
          { GeoElement Prism; NumberOfPoints 6; }
        }
      }
    }
  }
}

Formulation {
  { Name Electrostatics; Type FemEquation;
    Quantity { { Name v; Type Local; NameOfSpace H1_v_Ele; } }
    Equation {
      Galerkin { [ epsilon[] * Dof{d v}, {d v} ]; In Vol_Ele; Jacobian Vol; Integration Int; }
    }
  }
}

Resolution {
  { Name Ele;
    System { { Name Sys_Ele; NameOfFormulation Electrostatics; } }
    Operation { Generate[Sys_Ele]; Solve[Sys_Ele]; SaveSolution[Sys_Ele]; }
  }
}

PostProcessing {
  { Name Ele; NameOfFormulation Electrostatics;
    Quantity {
      { Name v; Value { Local { [{v}]; In Vol_Ele; Jacobian Vol; } } }
      { Name e; Value { Local { [{-d v}]; In Vol_Ele; Jacobian Vol; } } }
    }
  }
}

PostOperation {
  { Name Map; NameOfPostProcessing Ele;
    Operation {
      Print[v, OnElementsOf Vol_Ele, File "v.pos"];
      Print[e, OnElementsOf Vol_Ele, File "e.pos"];
    }
  }
}
