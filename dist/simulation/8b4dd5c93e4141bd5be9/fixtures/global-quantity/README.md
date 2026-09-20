# GetDP tutorial 6: Global quantities in electrostatics

We consider the same model as in tutorial 1, i.e. a 2D electrostatic model of a
microstrip line with only one half of the geometry modelled by symmetry. We
introduce global quantities (voltage and charge) in the function space, which
lets us naturally handle floating potentials and compute the capacitance.

## Features

 - Global quantities and their special basis functions
 - Handling the floating potential and its energy dual, the charge
 - Calculation of capacitances
 - Fine-tuning of post-processing options

See the comments in `microstrip.pro` and `microstrip.geo` for details.

## Running the tutorial

On the command line:
```
> gmsh microstrip.geo -2
> getdp microstrip.pro -solve Ele -pos Map
```

Interactively with Gmsh: open `microstrip.pro` with "File->Open", then press
"Run".
