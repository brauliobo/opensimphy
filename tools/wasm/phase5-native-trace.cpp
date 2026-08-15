#include <cmath>
#include <cstdint>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#include "getdp.h"
#include "gmsh.h"
#include "onelab.h"
#include "onelabUtils.h"

namespace {
using Outputs = std::vector<std::pair<std::string, double>>;

std::vector<std::vector<double>> numericLines(const std::string &path)
{
  std::ifstream input(path);
  if(!input) throw std::runtime_error("could not read " + path);
  std::vector<std::vector<double>> rows;
  std::string line;
  while(std::getline(input, line)) {
    std::istringstream stream(line);
    std::vector<double> values;
    double value;
    while(stream >> value) values.push_back(value);
    if(values.size() > 1 && stream.eof()) rows.push_back(values);
  }
  return rows;
}

double number(onelab::server *server, const std::string &name)
{
  std::vector<onelab::number> values;
  if(!server->get(values, name) || values.size() != 1)
    throw std::runtime_error("missing ONELAB number " + name);
  return values[0].getValue();
}

Outputs outputs(const std::string &project)
{
  if(project == "global-quantity-real-loop") {
    const auto rows = numericLines("output.txt");
    if(rows.size() != 5) throw std::runtime_error("unexpected global quantity output");
    return {{"}Output/Global/Capacitance [F]", rows[3][1]},
            {"}Output/Global/Energy [J]", rows[4][1]},
            {"}Output/Ground/Charge [C]", rows[2][1]},
            {"}Output/Microstrip/Charge [C]", rows[0][1]},
            {"}Output/Microstrip/Potential [V]", rows[1][1]}};
  }
  const auto ui = numericLines("UI.txt");
  const auto losses = numericLines("losses.txt");
  if(ui.size() != 4 || losses.size() != 2)
    throw std::runtime_error("unexpected transformer output");
  return {{"}Output/0|V_in| [V]", std::hypot(ui[0][1], ui[0][2])},
          {"}Output/1|I_in| [A]", std::hypot(ui[1][1], ui[1][2])},
          {"}Output/2|V_out| [V]", std::hypot(ui[2][1], ui[2][2])},
          {"}Output/3|I_out| [A]", std::hypot(ui[3][1], ui[3][2])},
          {"}Output/p_H+EC [W m^-3]", losses[1][1]},
          {"}Output/p_Joule [W m^-3]", losses[0][1]}};
}

void writeValues(std::ostream &output, onelab::server *server,
                 const std::vector<std::string> &names)
{
  output << '{';
  for(std::size_t i = 0; i < names.size(); ++i) {
    if(i) output << ',';
    output << std::quoted(names[i]) << ':' << number(server, names[i]);
  }
  output << '}';
}

void writeOutputs(std::ostream &output, const Outputs &values)
{
  output << '{';
  for(std::size_t i = 0; i < values.size(); ++i) {
    if(i) output << ',';
    output << std::quoted(values[i].first) << ":[" << values[i].second << ']';
  }
  output << '}';
}
} // namespace

int main(int argc, char **argv)
{
  if(argc != 8) {
    std::cerr << "usage: phase5-native-trace project geometry problem mesh resolution set-number set-value\n";
    return 64;
  }
  const std::string project = argv[1], geometry = argv[2], problem = argv[3];
  const std::string mesh = argv[4], resolution = argv[5], setName = argv[6];
  const std::string setValue = argv[7];
  const std::string outputPath = project + "-native-trace.json";
  const std::vector<std::string> loopNames = project == "global-quantity-real-loop"
    ? std::vector<std::string>{"Parameters/1Value", "Parameters/Loop inner", "Parameters/Loop middle"}
    : std::vector<std::string>{"Parameters/3Load resistance [Ohm]"};
  const std::string loopConstant = project == "global-quantity-real-loop" ? "ValueBC" : "Rval";

  gmsh::initialize();
  try {
    gmsh::open(geometry);
    auto *server = onelab::server::instance();
    unsigned long getdpCalls = 0, initializeCalls = 0, incrementCalls = 0;
    const auto invoke = [&](std::vector<std::string> args) {
      args.insert(args.end(), {"-onelab", "GetDP"});
      ++getdpCalls;
      const int status = getdp(args, server);
      if(status) throw std::runtime_error("GetDP exited with status " + std::to_string(status));
    };
    invoke({"getdp", problem, "-setnumber", setName, setValue, "-check"});
    onelabUtils::initializeLoops();
    ++initializeCalls;

    std::ostringstream points;
    points << std::setprecision(17) << '[';
    std::size_t point = 0;
    bool next;
    do {
      if(point) points << ',';
      const double loopValue = number(server, loopNames[0]);
      invoke({"getdp", problem, "-msh", mesh, "-setnumber", setName, setValue,
              "-setnumber", loopConstant, std::to_string(loopValue), "-solve", resolution,
              "-pos", "Map"});
      points << "{\"index\":" << point << ",\"values\":";
      writeValues(points, server, loopNames);
      points << ",\"outputs\":";
      writeOutputs(points, outputs(project));
      points << '}';
      ++point;
      next = onelabUtils::incrementLoops();
      ++incrementCalls;
    } while(next);
    points << ']';

    std::ofstream output(outputPath);
    if(!output) throw std::runtime_error("could not create " + outputPath);
    output << std::setprecision(17)
           << "{\"schema\":1,\"project\":" << std::quoted(project)
           << ",\"serverIdentity\":" << reinterpret_cast<std::uintptr_t>(server)
           << ",\"lastGetdpServerIdentity\":" << reinterpret_cast<std::uintptr_t>(server)
           << ",\"sharedServer\":true,\"getdpCalls\":" << getdpCalls
           << ",\"loopInitializeCalls\":" << initializeCalls
           << ",\"loopIncrementCalls\":" << incrementCalls
           << ",\"points\":" << points.str() << "}\n";
    gmsh::finalize();
    return 0;
  }
  catch(...) {
    gmsh::finalize();
    throw;
  }
}
