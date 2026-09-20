# GetDP tutorial 3: Magnetostatic model of an electromagnet

A 2D magnetostatic model of an electromagnet is considered. A current density is
imposed in the coil, and the ferromagnetic core can be modelled either using a
linear or a nonlinear constitutive law. Infinite elements are used to accurately
model the unbounded domain.

## Features

 - Magnetostatic model in terms of the magnetic vector potential
 - Infinite ring geometrical transformation
 - Function space for the 2D vector potential ("perpendicular edges")
 - Newton-Raphson and Picard linearization schemes

See the comments in `electromagnet.pro` and `electromagnet.geo` for details.

## Running the tutorial

On the command line:
```
> gmsh electromagnet.geo -2
> getdp electromagnet.pro -solve Mag -pos Map
```

Interactively with Gmsh: open `electromagnet.pro` with "File->Open", then press
"Run".
