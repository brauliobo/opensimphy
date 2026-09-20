// Gmsh script describing the geometry of the microstrip line (same geometry as
// in tutorial 1).

h = 1.e-3;
w = 4.72e-3;
t = 0.035e-3;
xBox = w / 2 * 6;
yBox = h * 12;

s = DefineNumber[1., Name "Parameters/Global mesh size factor"];

p0 = h / 10 * s;
pLine0 = w / 20 * s;
pLine1 = w / 100 * s;
pxBox = xBox / 10 * s;
pyBox = yBox / 8 * s;

Point(1) = {0, 0, 0, p0};
Point(2) = {xBox, 0, 0, pxBox};
Point(3) = {xBox, h, 0, pxBox};
Point(4) = {0, h, 0, pLine0};
Point(5) = {w / 2, h, 0, pLine1};
Point(6) = {0, h + t, 0, pLine0};
Point(7) = {w / 2, h + t, 0, pLine1};
Point(8) = {0, yBox, 0, pyBox};
Point(9) = {xBox, yBox, 0, pyBox};
Line(1) = {1, 2};
Line(2) = {2, 3};
Line(3) = {3, 9};
Line(4) = {9, 8};
Line(5) = {8, 6};
Line(7) = {4, 1};
Line(8) = {5, 3};
Line(9) = {4, 5};
Line(10) = {6, 7};
Line(11) = {5, 7};
Curve Loop(12) = {1, 2, -8, -9, 7};
Plane Surface(13) = {12};
Curve Loop(14) = {10, -11, 8, 3, 4, 5};
Plane Surface(15) = {14};

Physical Surface("Air", 1) = {15};
Physical Surface("Dielectric", 2) = {13};
Physical Curve("Ground", 10) = {1};
Physical Curve("Microstrip boundary", 11) = {9, 10, 11};
Physical Curve("Inf", 12) = {2, 3, 4};
