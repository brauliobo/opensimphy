# GetDP tutorial 2: Thermal conduction in a radiator with fins

A 2D and 3D thermal model of an aluminum radiator is considered. A heat flux is
applied to the bottom of the base plate of the radiator, while convection is
modelled using Newton's law of cooling on the radiator fins. Periodic boundary
conditions allow the simulation of non-symmetric elementary radiator cells. Both
steady-state and transient simulations can be performed.

## Features

 - Thermal model with conduction and convection
 - Two- and three-dimensional models
 - Steady-state and transient simulations
 - Neumann, Robin and periodic boundary conditions

See the comments in `radiator.pro` and `radiator.geo` for details.

## Running the tutorial

On the command line (2D analysis):
```
> gmsh radiator.geo -2
> getdp radiator.pro -solve The -pos Map
```

On the command line (3D analysis):
```
> gmsh radiator.geo -3 -setnumber dim 3
> getdp radiator.pro -solve The -pos Map -setnumber dim 3
```

Interactively with Gmsh: open `radiator.pro` with "File->Open", then press
"Run".
