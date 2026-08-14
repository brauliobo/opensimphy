#include <gmsh.h>

#include <iomanip>
#include <iostream>
#include <vector>

int main(int argc, char **argv)
{
  if(argc != 5) return 2;
  gmsh::initialize();
  gmsh::option::setNumber("General.Terminal", 0);
  gmsh::open(argv[1]);
  std::vector<int> tags;
  gmsh::view::getTags(tags);
  if(tags.size() != 1) return 3;
  std::vector<double> values;
  double distance = 0.;
  gmsh::view::probe(tags[0], std::stod(argv[2]), std::stod(argv[3]),
                    std::stod(argv[4]), values, distance, -1, -1, false, 0.);
  if(values.empty() || distance != 0.) return 4;
  std::cout << std::setprecision(17) << distance;
  for(double value : values) std::cout << ' ' << value;
  std::cout << '\n';
  gmsh::finalize();
}
