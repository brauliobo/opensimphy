// ONELAB project for the Edwin Gray illustrative magnetostatic case.
// Scientific parameters remain defined by the existing geometry and case JSON.
Include "../geometry/patent-3890548-3d.geo";

Solver.Name0 = "Edwin Gray Magnetostatics";
Solver.Executable0 = "node launcher.mjs client";
Solver.AutoShowViews = 1;
