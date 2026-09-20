# GetDP tutorial 5: Full-wave model of a rectangular waveguide

A full-wave time-harmonic Maxwell model of a rectangular waveguide is
considered, in both 2D and 3D. The electric field is discretized with edge
elements, with perfectly electrically conducting (PEC) walls, a Silver-Muller
absorbing boundary condition on the outer domain boundary, and a modal
excitation imposed at the input port through an auxiliary projection resolution.

## Features

 - Harmonic full-wave Maxwell formulation in terms of the electric field
 - Edge finite elements (lowest-order Whitney elements in H(curl))
 - Two- and three-dimensional models
 - Dirichlet boundary condition through an auxiliary resolution

See the comments in `full_wave.pro` and `full_wave.geo` for details.

## Running the tutorial

On the command line (2D analysis):
```
> gmsh full_wave.geo -2
> getdp full_wave.pro -solve Wav -pos Map
```

On the command line (3D analysis):
```
> gmsh full_wave.geo -3 -setnumber dim 3
> getdp full_wave.pro -solve Wav -pos Map -setnumber dim 3
```

Interactively with Gmsh: open `full_wave.pro` with "File->Open", then press
"Run".
