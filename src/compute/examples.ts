export const COMPUTE_LAB_PATH = '/labs/compute'

export const COMPUTE_EXAMPLE_QUERIES = [
  '(Planck mass)/(Planck time)^2',
  'sqrt(((125.37560000 GeV)/(1.573886629 × 10^-18 meters)^3)/(1.2102526979 × 10^44 newtons))',
  'plot sin(x) * exp(-x/8)',
  'plot3d sin(x)*cos(y)',
  'integrate x^2 from 0 to 1',
  'd/dx sin(x)^2',
  'solve x^2 - 2*x - 3 = 0',
  'det([[1,2],[3,4]])',
] as const
